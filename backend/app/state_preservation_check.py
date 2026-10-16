"""Fail deployment if migrations alter an existing teacher's private content."""
from __future__ import annotations

import hashlib
import json
import sys
import zlib
from uuid import UUID

from sqlalchemy import inspect, text

from app.database.session import engine


def digest(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False,
        separators=(",", ":")).encode("utf-8")).hexdigest()


def fingerprints(connection) -> dict[str, dict]:
    if not inspect(connection).has_table("client_states"):
        return {}
    result = {}
    has_revision = "profesor_revision" in {c["name"] for c in inspect(connection).get_columns("client_states")}
    revision_sql = "profesor_revision" if has_revision else "0 AS profesor_revision"
    for row in connection.execute(text(f"SELECT id, data, {revision_sql} FROM client_states")):
        data = json.loads(row.data) if isinstance(row.data, str) else row.data
        apps = data.get("__apps") if isinstance(data, dict) else None
        teacher = apps.get("profesor_particular") if isinstance(apps, dict) else None
        if isinstance(teacher, dict):
            result[str(row.id)] = {"digest": digest(teacher), "revision": row.profesor_revision}
    return result


def versioned_save_preserved(connection, row_id: str, before: dict, after: dict) -> bool:
    if after["revision"] <= before["revision"]:
        return False
    if inspect(connection).has_table("audit_logs"):
        rows = connection.execute(text("""SELECT metadata FROM audit_logs
            WHERE action = 'profesor_state_saved' AND entity_type = 'client_state' AND entity_id = :id"""), {"id": str(UUID(row_id))})
        receipts = {}
        for row in rows:
            item = json.loads(row[0]) if isinstance(row[0], str) else row[0]
            if isinstance(item, dict) and isinstance(item.get("revision"), int):
                receipts[item["revision"]] = item
        revision, current_digest = before["revision"], before["digest"]
        while revision < after["revision"]:
            receipt = receipts.get(revision + 1)
            if not receipt or receipt.get("previous_revision") != revision or receipt.get("previous_digest") != current_digest:
                break
            revision += 1
            current_digest = receipt.get("digest")
        if revision == after["revision"] and current_digest == after["digest"]:
            return True
    # Compatibility with writes from the old backend during this deployment.
    if not inspect(connection).has_table("profesor_state_snapshots"):
        return False
    rows = connection.execute(text("""SELECT s.revision, s.payload_zlib FROM profesor_state_snapshots s
        JOIN client_states c ON c.user_id = s.user_id AND c.organization_id = s.organization_id
        WHERE c.id = :id AND s.revision IN (:old_revision, :new_revision)"""),
        {"id": row_id, "old_revision": before["revision"], "new_revision": after["revision"]})
    snapshots = {}
    for row in rows:
        snapshots[row.revision] = digest(json.loads(zlib.decompress(row.payload_zlib)))
    return snapshots.get(before["revision"]) == before["digest"] and snapshots.get(after["revision"]) == after["digest"]


def verify(before: dict, after: dict, connection=None) -> None:
    changed = 0
    for key, previous in before.items():
        current = after.get(key)
        if current and current["digest"] == previous["digest"]:
            continue
        # Real users can save during deployment. Require a continuous chain of
        # trusted save receipts (or the old backend's matching full snapshots).
        if connection is not None and current and versioned_save_preserved(connection, key, previous, current):
            continue
        changed += 1
    if changed:
        raise RuntimeError(f"No se ha podido verificar la conservación de {changed} escritorios de Profesor Particular tras las migraciones. "
            "Despliegue detenido. Conserva la copia previa y revisa la migración antes de continuar.")


def main():
    with engine.connect() as connection:
        current = fingerprints(connection)
        if sys.argv[1:] == ["capture"]:
            print(json.dumps(current, sort_keys=True))
        elif sys.argv[1:] == ["verify"]:
            verify(json.load(sys.stdin), current, connection)
            print(f"OK contenido de {len(current)} escritorios conservado tras las migraciones")
        else:
            raise SystemExit("Uso: python -m app.state_preservation_check capture|verify")


if __name__ == "__main__":
    main()
