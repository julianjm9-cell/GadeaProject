"""
Diplomator - lanzador de escritorio.

Crea la estructura de datos local, sirve la interfaz en localhost y abre el
navegador. Funciona en desarrollo y empaquetado con PyInstaller.
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import webbrowser
import base64
import mimetypes
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, request
from urllib.parse import unquote, urlparse


APP_NAME = "Diplomator"
HTML_FILE = "apps/diplomator/index.html"
DATA_DIR_NAME = "Diplomator_Data"
DEFAULT_API_KEY = ""
DEFAULT_LICENSE_SERVER_URL = "http://127.0.0.1:8787"
DEFAULT_PROFILE = (
    "The student is preparing high-level C1/C2 oral answers in English and French, "
    "with a focus on diplomacy, international relations, current affairs, culture, "
    "history and public policy. The output should sound like a polished oral briefing: "
    "analytical, elegant, precise and easy to recite. Avoid generic textbook wording. "
    "Prioritise clear argument structure, useful transitions, concrete dates, named "
    "actors, recent examples, historical context, controversies, consequences and "
    "advanced vocabulary that can be reused in an exam. Each idea should help the "
    "student speak with authority for several minutes, not merely memorise facts."
)
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_TEXT_MODELS = ("openai/gpt-oss-120b", "llama-3.3-70b-versatile")
GROQ_TRANSCRIBE_MODEL = "whisper-large-v3-turbo"
GROQ_BASE_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Diplomator/1.0 (+https://localhost)",
}
DEFAULT_STATE: dict[str, Any] = {
    "lang": "en",
    "history": [],
    "completedTopics": [],
    "currentSession": None,
    "recitePractice": {"topic": "", "notes": "", "transcript": "", "correction": "", "selectedMode": "prep"},
    "topicChats": {"session": [], "recite": [], "temas": []},
    "config": {
        "numPoints": 5,
        "numVocab": 5,
        "profile": DEFAULT_PROFILE,
        "pointFontSize": 13,
    },
}


def resource_dir() -> Path:
    """Return the folder where bundled read-only resources live."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).parent.resolve()


def app_dir() -> Path:
    """Return the writable folder next to the exe or script."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent.resolve()
    return Path(__file__).parent.resolve()


def data_paths() -> dict[str, Path]:
    root = app_dir() / DATA_DIR_NAME
    return {
        "root": root,
        "exports": root / "exports",
        "backups": root / "backups",
        "logs": root / "logs",
        "state": root / "state.json",
        "apikey": root / "apikey.txt",
        "license": root / "license.txt",
        "backend_server": root / "backend_server.txt",
        "readme": root / "LEEME.txt",
        "log": root / "logs" / "app.log",
    }


def ensure_structure() -> dict[str, Path]:
    paths = data_paths()
    for key in ("root", "exports", "backups", "logs"):
        paths[key].mkdir(parents=True, exist_ok=True)

    if not paths["state"].exists():
        write_json_atomic(paths["state"], DEFAULT_STATE)

    if not paths["apikey"].exists() or not paths["apikey"].read_text(encoding="utf-8").strip():
        paths["apikey"].write_text(DEFAULT_API_KEY, encoding="utf-8")

    if not paths["license"].exists():
        paths["license"].write_text("", encoding="utf-8")

    if not paths["backend_server"].exists() or not paths["backend_server"].read_text(encoding="utf-8").strip():
        paths["backend_server"].write_text(DEFAULT_LICENSE_SERVER_URL, encoding="utf-8")

    if not paths["readme"].exists():
        paths["readme"].write_text(
            "Diplomator - carpeta de datos\n"
            "================================\n\n"
            "state.json: historial, temas completados y configuraciÃ³n.\n"
            "license.txt: clave de licencia DIPLOMATOR del usuario.\n"
            "backend_server.txt: URL del backend Docker.\n"
            "apikey.txt: archivo antiguo, ya no se usa para clientes.\n"
            "exports/: sesiones y bases de datos exportadas.\n"
            "backups/: copias automÃ¡ticas antes de sobrescribir state.json.\n"
            "logs/: registro tecnico de arranque y errores.\n\n"
            "Puedes enviar esta carpeta junto al ejecutable si quieres conservar\n"
            "los datos de una instalacion.\n",
            encoding="utf-8",
        )

    log("Estructura de datos lista: " + str(paths["root"]))
    return paths


def log(message: str) -> None:
    try:
        paths = data_paths()
        paths["logs"].mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with paths["log"].open("a", encoding="utf-8") as fh:
            fh.write(f"[{stamp}] {message}\n")
    except Exception:
        pass


def read_json_file(path: Path, fallback: Any) -> Any:
    try:
        raw = path.read_text(encoding="utf-8")
        if not raw.strip():
            return fallback
        return json.loads(raw)
    except Exception as exc:
        log(f"No se pudo leer JSON {path.name}: {exc}")
        return fallback


def write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def backup_state_if_needed(path: Path) -> None:
    if not path.exists() or path.stat().st_size == 0:
        return
    backups = data_paths()["backups"]
    backups.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = backups / f"state_{stamp}.json"
    try:
        backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    except Exception as exc:
        log(f"No se pudo crear backup de state.json: {exc}")


def safe_filename(name: str, default: str = "export.txt") -> str:
    clean = unquote(name or "").strip().replace("\\", "_").replace("/", "_")
    clean = re.sub(r"[^A-Za-z0-9._() -]+", "_", clean)
    clean = clean.strip(" .")
    return clean or default


def get_api_key() -> str:
    return data_paths()["apikey"].read_text(encoding="utf-8").strip()


def get_license_key() -> str:
    return data_paths()["license"].read_text(encoding="utf-8").strip()


def get_backend_server_url() -> str:
    url = data_paths()["backend_server"].read_text(encoding="utf-8").strip() or DEFAULT_LICENSE_SERVER_URL
    return url.rstrip("/")


def backend_server_json(path: str, payload: dict[str, Any] | None = None, timeout: int = 120) -> dict[str, Any]:
    body = json.dumps(payload or {}, ensure_ascii=False).encode("utf-8")
    url = get_backend_server_url() + path
    req = request.Request(
        url,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Diplomator/1.0 (+https://localhost)",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            message = data.get("error") or data.get("message") or raw
        except Exception:
            message = raw or str(exc)
        raise RuntimeError(message) from exc
    except error.URLError as exc:
        raise RuntimeError(
            "No se pudo conectar con el servidor DIPLOMATOR. "
            f"Comprueba que Docker estÃ¡ arrancado en {get_backend_server_url()}. Detalle: {exc.reason}"
        ) from exc


def license_payload(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    license_key = get_license_key()
    if not license_key:
        raise RuntimeError("Falta la clave de licencia DIPLOMATOR.")
    return {"license_key": license_key, **(extra or {})}


def validate_license() -> dict[str, Any]:
    return backend_server_json("/validate", license_payload(), timeout=20)


def post_json(url: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        headers={
            **GROQ_BASE_HEADERS,
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=90) as res:
            return json.loads(res.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            message = data.get("error", {}).get("message") or raw
        except Exception:
            message = raw or str(exc)
        raise RuntimeError(message) from exc
    except error.URLError as exc:
        raise RuntimeError(f"No se pudo conectar con Groq: {exc.reason}") from exc


def groq_chat(payload: dict[str, Any]) -> dict[str, Any]:
    return backend_server_json("/chat", license_payload({"payload": payload}), timeout=120)


def groq_chat_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("Falta la API key del proveedor antiguo.")

    requested_model = str(payload.get("model") or GROQ_TEXT_MODELS[0])
    models = (requested_model,) + tuple(m for m in GROQ_TEXT_MODELS if m != requested_model)
    last_error: Exception | None = None
    for model in models:
        try:
            data = post_json(
                GROQ_CHAT_URL,
                api_key,
                {
                    "model": model,
                    "messages": payload.get("messages", []),
                    "max_tokens": int(payload.get("max_tokens") or 2200),
                    "temperature": float(payload.get("temperature", 0.35)),
                    **({"response_format": payload["response_format"]} if payload.get("response_format") else {}),
                },
            )
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"ok": True, "model": model, "content": content}
        except Exception as exc:
            last_error = exc
            log(f"Groq chat fallo con {model}: {exc}")
    raise RuntimeError(str(last_error) if last_error else "Groq no devolviÃ³ respuesta.")


def multipart_body(fields: dict[str, str], file_field: str, filename: str, content_type: str, data: bytes) -> tuple[bytes, str]:
    boundary = f"----Diplomator{int(time.time() * 1000)}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"),
            str(value).encode("utf-8"),
            b"\r\n",
        ])
    chunks.extend([
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode("utf-8"),
        f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
        data,
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ])
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def groq_transcribe(payload: dict[str, Any]) -> dict[str, Any]:
    return backend_server_json("/transcribe", license_payload({"payload": payload}), timeout=180)


def groq_ocr(payload: dict[str, Any]) -> dict[str, Any]:
    return backend_server_json("/ocr", license_payload({"payload": payload}), timeout=180)


def groq_transcribe_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = get_api_key()
    if not api_key:
        raise RuntimeError("Falta la API key del proveedor antiguo.")

    audio_b64 = str(payload.get("audio", ""))
    if "," in audio_b64:
        audio_b64 = audio_b64.split(",", 1)[1]
    if not audio_b64.strip():
        raise RuntimeError("No se recibio audio para transcribir.")
    try:
        audio = base64.b64decode(audio_b64, validate=True)
    except Exception as exc:
        raise RuntimeError("El audio recibido no tiene un formato vÃ¡lido.") from exc
    if len(audio) < 1500:
        raise RuntimeError("El audio estÃ¡ vacÃ­o o es demasiado corto. Graba de nuevo y revisa el permiso del micrÃ³fono.")
    filename = safe_filename(str(payload.get("filename") or "recitation.webm"), "recitation.webm")
    content_type = str(payload.get("contentType") or mimetypes.guess_type(filename)[0] or "audio/webm")
    body, boundary_type = multipart_body(
        {
            "model": str(payload.get("model") or GROQ_TRANSCRIBE_MODEL),
            "language": str(payload.get("language") or "en"),
        },
        "file",
        filename,
        content_type,
        audio,
    )
    req = request.Request(
        GROQ_TRANSCRIBE_URL,
        data=body,
        headers={**GROQ_BASE_HEADERS, "Authorization": f"Bearer {api_key}", "Content-Type": boundary_type},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=120) as res:
            data = json.loads(res.read().decode("utf-8"))
            return {"ok": True, "text": data.get("text", "")}
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            message = data.get("error", {}).get("message") or raw
        except Exception:
            message = raw or str(exc)
        raise RuntimeError(message) from exc
    except error.URLError as exc:
        raise RuntimeError(f"No se pudo conectar con Groq: {exc.reason}") from exc


class GadeaHandler(SimpleHTTPRequestHandler):
    server_version = "DiplomatorLocal/1.0"

    def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(resource_dir()), **kwargs)

    def log_message(self, fmt: str, *args: Any) -> None:
        log(fmt % args)

    @property
    def paths(self) -> dict[str, Path]:
        return data_paths()

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        route = urlparse(self.path).path
        if route == "/":
            self.path = "/" + HTML_FILE
            return super().do_GET()
        if route == "/api/status":
            return self.send_json(
                {
                    "ok": True,
                    "app": APP_NAME,
                    "dataDir": str(self.paths["root"]),
                    "exportsDir": str(self.paths["exports"]),
                }
            )
        if route == "/api/state":
            return self.send_json(read_json_file(self.paths["state"], DEFAULT_STATE))
        if route == "/api/apikey":
            key = self.paths["apikey"].read_text(encoding="utf-8").strip()
            return self.send_json({"apikey": key})
        if route == "/api/license":
            key = self.paths["license"].read_text(encoding="utf-8").strip()
            server_url = self.paths["backend_server"].read_text(encoding="utf-8").strip() or DEFAULT_LICENSE_SERVER_URL
            return self.send_json({"license": key, "serverUrl": server_url})
        return super().do_GET()

    def do_POST(self) -> None:
        route = urlparse(self.path).path
        try:
            payload = self.read_payload()
            if route == "/api/state":
                backup_state_if_needed(self.paths["state"])
                write_json_atomic(self.paths["state"], payload)
                return self.send_json({"ok": True})
            if route == "/api/apikey":
                key = str(payload.get("apikey", "")).strip()
                self.paths["apikey"].write_text(key, encoding="utf-8")
                return self.send_json({"ok": True})
            if route == "/api/license":
                key = str(payload.get("license", "")).strip()
                server_url = str(payload.get("serverUrl", "")).strip() or DEFAULT_LICENSE_SERVER_URL
                self.paths["license"].write_text(key, encoding="utf-8")
                self.paths["backend_server"].write_text(server_url, encoding="utf-8")
                status = validate_license() if key else {"ok": False, "error": "Licencia vacÃ­a"}
                return self.send_json({"ok": True, "status": status})
            if route == "/api/license/validate":
                return self.send_json(validate_license())
            if route == "/api/chat":
                return self.send_json(groq_chat(payload))
            if route == "/api/transcribe":
                return self.send_json(groq_transcribe(payload))
            if route == "/api/ocr":
                return self.send_json(groq_ocr(payload))
            if route == "/api/export-text":
                filename = safe_filename(str(payload.get("filename", "")))
                content = str(payload.get("content", ""))
                target = self.paths["exports"] / filename
                target.write_text(content, encoding="utf-8")
                return self.send_json({"ok": True, "path": str(target)})
            if route == "/api/export-db":
                filename = safe_filename(
                    str(payload.get("filename", "")),
                    f"Diplomator_BD_{datetime.now().date().isoformat()}.json",
                )
                target = self.paths["exports"] / filename
                write_json_atomic(target, payload.get("data", {}))
                return self.send_json({"ok": True, "path": str(target)})
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint no encontrado")
        except Exception as exc:
            log(f"Error en {route}: {exc}")
            self.send_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def read_payload(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def send_json(self, data: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def start_server() -> tuple[ThreadingHTTPServer, int]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), GadeaHandler)
    port = int(server.server_address[1])
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log(f"Servidor iniciado en http://127.0.0.1:{port}/")
    return server, port


def show_error(message: str) -> None:
    try:
        import tkinter.messagebox as mb

        mb.showerror("Diplomator", message)
    except Exception:
        print(message)


def main() -> int:
    html_file = resource_dir() / HTML_FILE
    if not html_file.exists():
        show_error(f"No se encuentra {HTML_FILE}.\n\nRuta buscada:\n{html_file}")
        return 1

    paths = ensure_structure()
    server, port = start_server()
    url = f"http://127.0.0.1:{port}/"

    print("=" * 58)
    print("  Diplomator")
    print("=" * 58)
    print(f"  AplicaciÃ³n: {url}")
    print(f"  Datos:      {paths['root']}")
    print("  Puedes cerrar esta ventana al terminar.")
    print("=" * 58)

    webbrowser.open(url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Cierre solicitado por teclado")
    finally:
        server.shutdown()
        server.server_close()
        log("Servidor cerrado")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

