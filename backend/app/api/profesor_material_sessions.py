"""Live, student-owned practice sessions for Profesor Particular."""
from __future__ import annotations

import json
import math
import random
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.auth.dependencies import current_user
from app.database.session import get_db
from app.models import ClientState, Document, ProfesorMaterialSession, ProfesorStudentAccess, User
from app.api.profesor_access import active_student, owned_access, teacher_premium, teacher_students
from app.api.app_routes import LOCAL_DOCUMENT_DIR

router = APIRouter(tags=["profesor-material-sessions"])
CHOICE = {"quiz", "boolean", "classify", "visualquiz", "pairs"}
SEQUENCE = {"order", "sentence", "timeline"}
OPEN = {"short", "reading", "problem", "error"}
SUPPORTED = CHOICE | SEQUENCE | OPEN | {"gaps", "multigaps", "numeric", "flashcard", "memory", "dragdrop", "pasapalabra", "hangman", "wordsearch", "crossword", "imagepoint"}


class SendMaterial(BaseModel):
    access_id: UUID
    material_id: str = Field(min_length=1, max_length=120)


class StudentMove(BaseModel):
    action: str = Field(pattern="^(start|draft|check|next|finish|heartbeat|reveal|focus)$")
    question_index: int = Field(default=0, ge=0, le=19)
    part: int | None = Field(default=None, ge=0, le=30)
    value: object | None = None
    current_index: int | None = Field(default=None, ge=0, le=19)


class ReviewGrade(BaseModel):
    question_index: int = Field(ge=0, le=19)
    grade: str = Field(pattern="^(correct|partial|incorrect)$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def norm(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def clean_word(value: str) -> str:
    import unicodedata
    return "".join(ch for ch in unicodedata.normalize("NFD", value.upper()) if unicodedata.category(ch) != "Mn")


def rows(question: dict) -> list[list[str]]:
    return [[part.strip() for part in str(value).split("|")] for value in question.get("options", [])]


def expected_sequence(question: dict) -> list[str]:
    options = question["options"]
    if question["type"] != "timeline":
        return options
    years = [re.search(r"\b(?:1\d{3}|20\d{2})\b", item) for item in options]
    if any(year is None for year in years) or len({year.group() for year in years}) != len(options):
        return options
    return [item for _, item in sorted(zip((int(year.group()) for year in years), options))]


def wordsearch_board(question: dict, seed: int) -> dict:
    words = [clean_word(str(word).strip()) for word in question["options"]]
    size = max(10, len(words), *(len(word) for word in words))
    grid = [[""] * size for _ in range(size)]
    rng = random.Random(seed)
    positions = []
    for word in words:
        candidates = []
        for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
            for row in range(size):
                for col in range(size):
                    end_r, end_c = row + dr * (len(word) - 1), col + dc * (len(word) - 1)
                    if not (0 <= end_r < size and 0 <= end_c < size):
                        continue
                    cells = [[row + dr * i, col + dc * i] for i in range(len(word))]
                    if all(not grid[r][c] or grid[r][c] == word[i] for i, (r, c) in enumerate(cells)):
                        candidates.append((sum(bool(grid[r][c]) for r, c in cells), cells))
        if not candidates:
            # A plain row is always possible in a fresh board.
            grid = [[""] * size for _ in range(size)]
            positions = [[[r, c] for c in range(len(item))] for r, item in enumerate(words)]
            for item, cells in zip(words, positions):
                for letter, (r, c) in zip(item, cells):
                    grid[r][c] = letter
            break
        best = max(score for score, _ in candidates)
        cells = rng.choice([cells for score, cells in candidates if score == best])
        positions.append(cells)
        for letter, (r, c) in zip(word, cells):
            grid[r][c] = letter
    alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"
    for row in grid:
        for col, letter in enumerate(row):
            if not letter:
                row[col] = rng.choice(alphabet)
    return {"grid": grid, "words": words, "positions": positions}


def crossword_board(question: dict) -> dict:
    clues = rows(question)
    words = [clean_word(pair[0]) for pair in clues]
    for anchor in sorted(words, key=len, reverse=True):
        others = [(i, word) for i, word in enumerate(words) if word != anchor]
        placed: list[tuple[int, int, int, str]] = []
        used: set[int] = set()

        def fit(index: int) -> bool:
            if index == len(others):
                return True
            n, word = others[index]
            for row, letter in enumerate(anchor):
                if row in used:
                    continue
                for col, candidate in enumerate(word):
                    if letter == candidate:
                        used.add(row); placed.append((n, row, col, word))
                        if fit(index + 1):
                            return True
                        placed.pop(); used.remove(row)
            return False

        if not fit(0):
            continue
        left = max((col for _, _, col, _ in placed), default=0)
        right = max((len(word) - col - 1 for _, _, col, word in placed), default=0)
        grid = [[False] * (left + right + 1) for _ in anchor]
        for row in range(len(anchor)):
            grid[row][left] = True
        entries = [{"number": words.index(anchor) + 1, "clue": clues[words.index(anchor)][1], "row": 0, "col": left, "direction": "down", "length": len(anchor)}]
        for n, row, col, word in placed:
            start = left - col
            for offset in range(len(word)):
                grid[row][start + offset] = True
            entries.append({"number": n + 1, "clue": clues[n][1], "row": row, "col": start, "direction": "across", "length": len(word)})
        return {"grid": grid, "entries": sorted(entries, key=lambda item: item["number"]), "words": words}
    raise HTTPException(422, "El crucigrama no tiene cruces válidos. Edita el material antes de enviarlo.")


def prepare(question: dict, seed: int) -> dict:
    q = dict(question)
    kind = q.get("type")
    if kind == "wordsearch":
        q["_board"] = wordsearch_board(q, seed)
    elif kind == "crossword":
        q["_board"] = crossword_board(q)
    elif kind == "memory":
        cards = []
        for n, pair in enumerate(rows(q)):
            if len(pair) != 2:
                raise HTTPException(422, "Revisa las parejas del material.")
            cards.extend([{"token": secrets.token_urlsafe(12), "label": pair[0], "pair": n}, {"token": secrets.token_urlsafe(12), "label": pair[1], "pair": n}])
        random.Random(seed).shuffle(cards)
        q["_cards"] = cards
    elif kind == "dragdrop":
        targets = list(dict.fromkeys(pair[1] for pair in rows(q)))
        random.Random(seed).shuffle(targets)
        q["_targets"] = targets
    return q


def safe_question(q: dict, all_questions: list[dict], completed: bool, revealed: bool = False, response: object = None) -> dict:
    kind = q["type"]
    out = {key: q[key] for key in ("id", "type", "prompt", "text", "unit", "wordBank") if key in q}
    out["hints"] = q.get("hints", [])
    if kind in CHOICE:
        out["options"] = list(dict.fromkeys(other.get("answer", "") for other in all_questions if other.get("type") == "pairs")) if kind == "pairs" else q.get("options", [])
        if kind == "pairs" and len(out["options"]) < 2:
            out["options"] = []
    elif kind in SEQUENCE:
        out["options"] = q.get("options", [])[:]
        random.Random(str(q.get("id"))).shuffle(out["options"])
    elif kind == "multigaps":
        out["count"] = len(q.get("options", []))
    elif kind == "pasapalabra":
        out["entries"] = [{"letter": parts[0], "clue": parts[1]} for parts in rows(q)]
    elif kind == "dragdrop":
        pairs = rows(q)
        out["items"] = [pair[0] for pair in pairs]
        out["targets"] = q["_targets"]
    elif kind == "memory":
        out["cards"] = [{"token": card["token"], "label": card["label"]} for card in q["_cards"]]
    elif kind == "wordsearch":
        out["grid"] = q["_board"]["grid"]
        out["words"] = q["_board"]["words"]
    elif kind == "crossword":
        out["grid"] = q["_board"]["grid"]
        out["entries"] = q["_board"]["entries"]
    elif kind == "hangman":
        out["length"] = len(q.get("answer", ""))
        solution = clean_word(q.get("answer", ""))
        chosen = {clean_word(str(letter)) for letter in response if isinstance(letter, str) and len(letter) == 1} if isinstance(response, list) else set()
        out["mask"] = "".join(c if c in chosen or not c.isalpha() else "_" for c in solution)
        out["errors"] = sum(letter not in solution for letter in chosen)
    if kind in {"visualquiz", "imagepoint"} and q.get("image"):
        out["image"] = {"id": q["image"]["id"], "filename": q["image"].get("filename", "Imagen")}
    if completed:
        out["solution"] = q.get("answer", "")
        if kind == "pasapalabra":
            out["solutions"] = [parts[2] for parts in rows(q)]
        elif kind == "crossword":
            out["solutions"] = q["_board"]["words"]
        elif kind == "multigaps":
            out["solutions"] = q["options"]
        elif kind == "dragdrop":
            out["solutions"] = [parts[1] for parts in rows(q)]
        elif kind == "imagepoint":
            out["target"] = q.get("target")
    elif kind == "flashcard" and revealed:
        out["revealed_answer"] = q.get("answer", "")
    return out


def grade(q: dict, value: object, part: int | None = None) -> str:
    kind = q["type"]
    if value is None or value == "":
        return "unanswered"
    if kind == "error":
        if not isinstance(value, dict):
            return "pending" if str(value).strip() else "unanswered"  # Older sessions used plain text.
        chosen = value.get("selected")
        correction = value.get("correction")
        if not isinstance(chosen, str) or not chosen.strip() or not isinstance(correction, str) or not correction.strip():
            return "unanswered"
        if not q.get("errorSegment") or not q.get("correctedSegment"):
            return "pending"
        marks = '.,;:!?«»“”"'
        return "correct" if norm(chosen.strip(marks)) == norm(q["errorSegment"].strip(marks)) and norm(correction.strip(marks)) == norm(q["correctedSegment"].strip(marks)) else "incorrect"
    if kind in OPEN:
        return "pending" if str(value or "").strip() else "unanswered"
    if kind == "flashcard":
        return str(value) if value in ("correct", "partial", "incorrect") else "unanswered"
    if kind == "memory":
        if not isinstance(value, list) or not value:
            return "unanswered"
        cards = {card["token"]: card["pair"] for card in q["_cards"]}
        pair = value[part] if part is not None and part < len(value) else None
        def valid(candidate):
            return isinstance(candidate, list) and len(candidate) == 2 and all(isinstance(token, str) for token in candidate) and candidate[0] != candidate[1] and candidate[0] in cards and cards.get(candidate[0]) == cards.get(candidate[1])
        if part is not None:
            return "correct" if valid(pair) else "incorrect"
        return "correct" if len(value) == len(q["_cards"]) // 2 and all(valid(item) for item in value) and len({token for item in value for token in item}) == len(q["_cards"]) else "incorrect"
    if kind == "hangman":
        if not isinstance(value, list):
            return "unanswered"
        letters = {clean_word(str(letter)) for letter in value if isinstance(letter, str) and len(letter) == 1}
        solution = clean_word(q["answer"])
        wrong = sum(letter not in solution for letter in letters)
        return "incorrect" if wrong >= 7 else "correct" if all(letter in letters for letter in solution if letter.isalpha()) else "unanswered"
    if kind == "pasapalabra":
        if not isinstance(value, list):
            return "unanswered"
        answers = [parts[2] for parts in rows(q)]
        if part is not None:
            return "correct" if part < len(answers) and part < len(value) and norm(value[part]) == norm(answers[part]) else "incorrect"
        if len(value) < len(answers) or any(not norm(v) for v in value):
            return "unanswered"
        return "correct" if all(norm(v) == norm(a) for v, a in zip(value, answers)) else "incorrect"
    if kind == "multigaps":
        if not isinstance(value, list):
            return "unanswered"
        expected = [str(option).split("~") for option in q["options"]]
        if part is not None:
            return "correct" if part < len(expected) and part < len(value) and norm(value[part]) in [norm(a) for a in expected[part]] else "incorrect"
        if len(value) < len(expected) or any(not norm(v) for v in value):
            return "unanswered"
        return "correct" if all(norm(v) in [norm(a) for a in alternatives] for v, alternatives in zip(value, expected)) else "incorrect"
    if kind == "crossword":
        if not isinstance(value, list):
            return "unanswered"
        answers = q["_board"]["words"]
        if part is not None:
            return "correct" if part < len(answers) and part < len(value) and clean_word(str(value[part])) == answers[part] else "incorrect"
        if len(value) < len(answers) or any(not str(v).strip() for v in value):
            return "unanswered"
        return "correct" if all(clean_word(str(v)) == a for v, a in zip(value, answers)) else "incorrect"
    if kind == "wordsearch":
        if not isinstance(value, list):
            return "unanswered"
        positions = q["_board"]["positions"]
        if part is not None:
            if part >= len(positions) or part >= len(value) or not isinstance(value[part], list):
                return "incorrect"
            candidate = value[part]
            expected = positions[part]
            return "correct" if candidate == expected or candidate == expected[::-1] else "incorrect"
        if len(value) < len(positions) or any(not item for item in value):
            return "unanswered"
        return "correct" if all(grade(q, value, i) == "correct" for i in range(len(positions))) else "incorrect"
    if kind == "dragdrop":
        if not isinstance(value, list):
            return "unanswered"
        expected = [parts[1] for parts in rows(q)]
        if part is not None:
            return "correct" if part < len(expected) and part < len(value) and norm(value[part]) == norm(expected[part]) else "incorrect"
        if len(value) < len(expected) or any(not norm(v) for v in value):
            return "unanswered"
        return "correct" if all(norm(v) == norm(a) for v, a in zip(value, expected)) else "incorrect"
    if kind == "imagepoint":
        if not isinstance(value, list) or len(value) != 2:
            return "unanswered"
        try:
            x, y = float(value[0]), float(value[1]); target = q["target"]
            width, height = target.get("width"), target.get("height")
            right = abs(x - target["x"]) <= width / 2 and abs(y - target["y"]) <= height / 2 if width and height else math.hypot(x - target["x"], y - target["y"]) <= 10
            return "correct" if right else "incorrect"
        except (TypeError, ValueError, KeyError):
            return "incorrect"
    if kind in SEQUENCE:
        return "correct" if isinstance(value, list) and value == expected_sequence(q) else "incorrect"
    if kind == "numeric":
        try:
            def number(raw):
                pieces = str(raw).replace(",", ".").split("/")
                if len(pieces) > 2 or not all(re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", p.strip()) for p in pieces):
                    raise ValueError()
                return float(pieces[0]) / float(pieces[1]) if len(pieces) == 2 else float(pieces[0])
            return "correct" if abs(number(value) - number(q["answer"])) <= float(q.get("tolerance") or 0) + 1e-12 else "incorrect"
        except (ValueError, ZeroDivisionError, OverflowError):
            return "incorrect"
    return "correct" if norm(value) in [norm(q.get("answer")), *[norm(a) for a in q.get("alternatives", [])]] else "incorrect"


def student_session(db: Session, access: ProfesorStudentAccess, session_id: UUID, *, lock: bool = False) -> ProfesorMaterialSession:
    query = select(ProfesorMaterialSession).where(ProfesorMaterialSession.id == session_id, ProfesorMaterialSession.access_id == access.id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Material no encontrado en tu espacio.")
    return row


def teacher_session(db: Session, teacher: User, session_id: UUID, *, lock: bool = False) -> ProfesorMaterialSession:
    query = select(ProfesorMaterialSession).where(ProfesorMaterialSession.id == session_id, ProfesorMaterialSession.teacher_user_id == teacher.id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Sesión no encontrada.")
    return row


def public_session(row: ProfesorMaterialSession, *, teacher: bool = False) -> dict:
    questions = row.material_snapshot["questions"]
    progress = row.progress or {}
    completed = row.status == "completed"
    return {"id": str(row.id), "title": row.title, "subject": row.subject, "status": row.status, "revision": row.revision,
            "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat(), "questions": [safe_question(q, questions, completed or teacher, n in progress.get("reveals", []), progress.get("responses", {}).get(str(n))) for n, q in enumerate(questions)],
            "progress": progress}


@router.post("/api/profesor/material-sessions")
def send_material(payload: SendMaterial, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, payload.access_id)
    if not access.is_active:
        raise HTTPException(409, "Activa el acceso del alumno antes de enviarle un material.")
    state = db.scalar(select(ClientState).where(ClientState.user_id == user.id, ClientState.organization_id == user.organization_id))
    app = (state.data or {}).get("__apps", {}).get("profesor_particular", {}) if state else {}
    material = next((item for item in app.get("library", []) if isinstance(item, dict) and str(item.get("id")) == payload.material_id), None)
    if not material or not isinstance(material.get("activity"), dict):
        raise HTTPException(404, "Material interactivo no encontrado.")
    questions = material["activity"].get("questions")
    if not isinstance(questions, list) or not 1 <= len(questions) <= 20 or any(not isinstance(q, dict) or q.get("type") not in SUPPORTED for q in questions):
        raise HTTPException(422, "Revisa los ejercicios antes de enviarlos.")
    if any(isinstance(q.get("image"), dict) and q["image"].get("local") for q in questions):
        raise HTTPException(422, "Este material usa una imagen local. Guárdala en la cuenta antes de enviarlo al alumno.")
    student = teacher_students(db, user)[access.student_id]
    if student.get("subjects") and material.get("subject") not in student["subjects"]:
        raise HTTPException(422, "El alumno no tiene esta asignatura en su ficha.")
    if len(json.dumps(questions, ensure_ascii=False)) > 120_000:
        raise HTTPException(422, "El material es demasiado grande para compartirlo en directo.")
    seed = random.SystemRandom().randrange(2**32)
    try:
        prepared = [prepare(question, seed + n) for n, question in enumerate(questions)]
    except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(422, "Este material contiene un ejercicio incompleto. Revísalo antes de enviarlo.") from exc
    row = ProfesorMaterialSession(teacher_user_id=user.id, access_id=access.id, material_id=payload.material_id,
                                  title=str(material.get("title") or "Material")[:180], subject=str(material.get("subject") or "")[:100],
                                  material_snapshot={"questions": prepared}, progress={"current_index": 0, "responses": {}, "grades": {}, "parts": {}, "last_seen": None})
    db.add(row); db.commit(); db.refresh(row)
    return {"ok": True, "session": public_session(row, teacher=True)}


@router.get("/api/profesor/material-sessions")
def teacher_sessions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    rows_ = db.scalars(select(ProfesorMaterialSession).where(ProfesorMaterialSession.teacher_user_id == user.id).order_by(ProfesorMaterialSession.created_at.desc()).limit(100)).all()
    valid = teacher_students(db, user)
    accesses = {a.id: a for a in db.scalars(select(ProfesorStudentAccess).where(ProfesorStudentAccess.teacher_user_id == user.id)).all()}
    return {"sessions": [{"id": str(row.id), "title": row.title, "subject": row.subject, "status": row.status,
                          "student_name": valid.get(accesses[row.access_id].student_id, {}).get("name", "Alumno") if row.access_id in accesses else "Alumno",
                          "created_at": row.created_at.isoformat()} for row in rows_ if row.access_id in accesses and accesses[row.access_id].student_id in valid]}


@router.get("/api/profesor/access/{access_id}/material-sessions")
def teacher_student_live_sessions(access_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    access = owned_access(db, user, access_id)
    rows_ = db.scalars(
        select(ProfesorMaterialSession)
        .where(ProfesorMaterialSession.access_id == access.id,
               ProfesorMaterialSession.status.in_(("pending", "in_progress")))
        .order_by(case((ProfesorMaterialSession.status == "in_progress", 0), else_=1),
                  ProfesorMaterialSession.created_at.desc())
        .limit(20)
    ).all()
    return {"sessions": [{"id": str(row.id), "title": row.title, "subject": row.subject,
                          "status": row.status, "created_at": row.created_at.isoformat()} for row in rows_]}


@router.get("/api/profesor/material-sessions/{session_id}")
def teacher_watch(session_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    row = teacher_session(db, user, session_id)
    access = owned_access(db, user, row.access_id)
    info = public_session(row, teacher=True)
    info["student_name"] = teacher_students(db, user).get(access.student_id, {}).get("name", "Alumno")
    return {"session": info}


@router.post("/api/profesor/material-sessions/{session_id}/cancel")
def teacher_cancel(session_id: UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    row = teacher_session(db, user, session_id, lock=True)
    if row.status not in {"completed", "cancelled"}:
        row.status = "cancelled"; row.revision += 1; db.commit()
    return {"ok": True}


@router.post("/api/profesor/material-sessions/{session_id}/review")
def teacher_review(session_id: UUID, payload: ReviewGrade, user: User = Depends(current_user), db: Session = Depends(get_db)):
    teacher_premium(db, user)
    row = teacher_session(db, user, session_id, lock=True)
    if row.status != "completed" or payload.question_index >= len(row.material_snapshot["questions"]) or row.material_snapshot["questions"][payload.question_index]["type"] not in OPEN:
        raise HTTPException(409, "Esta respuesta no está pendiente de revisión.")
    progress = dict(row.progress); grades = dict(progress.get("grades", {})); grades[str(payload.question_index)] = payload.grade
    progress["grades"] = grades; row.progress = progress; row.revision += 1; db.commit()
    return {"ok": True, "session": public_session(row, teacher=True)}


@router.get("/api/profesor/student-material-sessions")
def student_sessions(request: Request, db: Session = Depends(get_db)):
    access, _, _ = active_student(request, db)
    rows_ = db.scalars(select(ProfesorMaterialSession).where(ProfesorMaterialSession.access_id == access.id, ProfesorMaterialSession.status.in_(("pending", "in_progress", "completed"))).order_by(case((ProfesorMaterialSession.status == "in_progress", 0), (ProfesorMaterialSession.status == "pending", 1), else_=2), ProfesorMaterialSession.created_at.desc()).limit(50)).all()
    return {"sessions": [{"id": str(row.id), "title": row.title, "subject": row.subject, "status": row.status,
                          "count": len(row.material_snapshot["questions"]), "created_at": row.created_at.isoformat()} for row in rows_]}


@router.get("/api/profesor/student-material-sessions/{session_id}")
def student_material(session_id: UUID, request: Request, db: Session = Depends(get_db)):
    access, _, _ = active_student(request, db)
    row = student_session(db, access, session_id)
    if row.status == "cancelled":
        raise HTTPException(410, "El profesor retiró este material.")
    return {"session": public_session(row)}


@router.post("/api/profesor/student-material-sessions/{session_id}/move")
def student_move(session_id: UUID, payload: StudentMove, request: Request, db: Session = Depends(get_db)):
    access, _, _ = active_student(request, db)
    row = student_session(db, access, session_id, lock=True)
    if row.status in {"cancelled", "completed"}:
        raise HTTPException(409, "Esta sesión ya está cerrada.")
    questions = row.material_snapshot["questions"]
    if payload.question_index >= len(questions) or (payload.current_index is not None and payload.current_index >= len(questions)):
        raise HTTPException(422, "Ejercicio no válido.")
    if len(json.dumps(payload.value, ensure_ascii=False)) > 8000:
        raise HTTPException(422, "La respuesta es demasiado larga.")
    if payload.action == "start":
        other = db.scalar(select(ProfesorMaterialSession.id).where(ProfesorMaterialSession.access_id == access.id, ProfesorMaterialSession.status == "in_progress", ProfesorMaterialSession.id != row.id))
        if other:
            raise HTTPException(409, "Termina el material que ya tienes abierto antes de empezar otro.")
    if row.status == "pending" and payload.action not in {"start", "heartbeat"}:
        raise HTTPException(409, "Abre el material antes de responder.")
    progress = dict(row.progress or {})
    progress["last_seen"] = now_iso()
    feedback = None
    if payload.action == "start":
        row.status = "in_progress"
    elif payload.action == "focus":
        progress["focus"] = {"question_index": payload.question_index, "part": payload.part,
                             "token": payload.value[:100] if isinstance(payload.value, str) else None}
    elif payload.action in {"draft", "check", "next", "finish"}:
        if payload.value is not None:
            responses = dict(progress.get("responses", {})); responses[str(payload.question_index)] = payload.value; progress["responses"] = responses
            if payload.action == "draft" and questions[payload.question_index]["type"] in {"timeline", "error"}:
                grades = dict(progress.get("grades", {})); grades.pop(str(payload.question_index), None); progress["grades"] = grades
                if questions[payload.question_index]["type"] == "timeline":
                    parts = dict(progress.get("parts", {})); parts.pop(str(payload.question_index), None); progress["parts"] = parts
        if payload.current_index is not None:
            progress["current_index"] = payload.current_index
        if payload.action == "check":
            q = questions[payload.question_index]
            if q["type"] == "flashcard" and payload.question_index not in progress.get("reveals", []):
                raise HTTPException(409, "Gira la tarjeta antes de valorarla.")
            feedback = grade(q, payload.value, payload.part)
            if payload.part is None:
                grades = dict(progress.get("grades", {})); grades[str(payload.question_index)] = feedback; progress["grades"] = grades
                if q["type"] == "timeline" and isinstance(payload.value, list):
                    parts = dict(progress.get("parts", {}))
                    expected = expected_sequence(q)
                    parts[str(payload.question_index)] = {str(i): "correct" if i < len(expected) and item == expected[i] else "incorrect" for i, item in enumerate(payload.value)}
                    progress["parts"] = parts
            else:
                parts = dict(progress.get("parts", {})); question_parts = dict(parts.get(str(payload.question_index), {})); question_parts[str(payload.part)] = feedback; parts[str(payload.question_index)] = question_parts; progress["parts"] = parts
        if payload.action == "finish":
            grades = {str(n): grade(q, progress.get("responses", {}).get(str(n))) for n, q in enumerate(questions)}
            progress["grades"] = grades; row.status = "completed"
            parts = dict(progress.get("parts", {}))
            for n, q in enumerate(questions):
                if q["type"] == "timeline" and isinstance(progress.get("responses", {}).get(str(n)), list):
                    expected = expected_sequence(q)
                    parts[str(n)] = {str(i): "correct" if i < len(expected) and item == expected[i] else "incorrect" for i, item in enumerate(progress["responses"][str(n)])}
            progress["parts"] = parts
    elif payload.action == "reveal":
        if questions[payload.question_index]["type"] != "flashcard":
            raise HTTPException(422, "Esta actividad no tiene reverso.")
        reveals = list(progress.get("reveals", []))
        if payload.question_index not in reveals:
            reveals.append(payload.question_index)
        progress["reveals"] = reveals
        feedback = questions[payload.question_index].get("answer", "")
    row.progress = progress; row.revision += 1; db.commit(); db.refresh(row)
    extra = {}
    if questions[payload.question_index]["type"] == "hangman" and isinstance(payload.value, list):
        solution = clean_word(questions[payload.question_index]["answer"])
        chosen = {clean_word(str(v)) for v in payload.value if isinstance(v, str) and len(v) == 1}
        extra = {"mask": "".join(c if c in chosen or not c.isalpha() else "_" for c in solution), "errors": sum(c not in solution for c in chosen)}
    return {"ok": True, "revision": row.revision, "status": row.status, "feedback": feedback, "extra": extra,
            "session": public_session(row) if payload.action in {"finish", "start"} or (payload.action == "check" and questions[payload.question_index]["type"] == "timeline") else None}


@router.get("/api/profesor/student-material-sessions/{session_id}/images/{image_id}")
def student_material_image(session_id: UUID, image_id: UUID, request: Request, db: Session = Depends(get_db)):
    access, teacher, _ = active_student(request, db)
    row = student_session(db, access, session_id)
    if row.status == "cancelled" or not any(str((q.get("image") or {}).get("id")) == str(image_id) for q in row.material_snapshot["questions"]):
        raise HTTPException(404, "Imagen no encontrada.")
    document = db.get(Document, image_id)
    if not document or document.user_id != teacher.id or document.organization_id != teacher.organization_id:
        raise HTTPException(404, "Imagen no encontrada.")
    root = (LOCAL_DOCUMENT_DIR / str(teacher.organization_id) / str(teacher.id) / "profesor_materials").resolve()
    target = Path(document.storage_path).resolve()
    if not target.is_relative_to(root) or not target.is_file() or target.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(404, "Imagen no encontrada.")
    media = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}[target.suffix.lower()]
    return FileResponse(target, media_type=media, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
