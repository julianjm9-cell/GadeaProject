"""Read every archived document without extracting it over production files."""

from __future__ import annotations

import sys
import tarfile
from pathlib import PurePosixPath


def verify_archive(path: str) -> tuple[int, int]:
    count = 0
    total_bytes = 0
    with tarfile.open(path, mode="r|") as archive:
        for member in archive:
            name = PurePosixPath(member.name)
            if name.is_absolute() or ".." in name.parts or not name.parts or name.parts[0] != "documents":
                raise ValueError("La copia contiene una ruta fuera de documents/.")
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError("La copia contiene un enlace u otro elemento inesperado.")
            extracted = archive.extractfile(member)
            if extracted is None:
                raise ValueError("No se pudo leer un documento de la copia.")
            actual = 0
            with extracted:
                while chunk := extracted.read(1024 * 1024):
                    actual += len(chunk)
            if actual != member.size:
                raise ValueError("Un documento de la copia está incompleto.")
            count += 1
            total_bytes += actual
    return count, total_bytes


if __name__ == "__main__":
    try:
        files, size = verify_archive(sys.argv[1])
    except (IndexError, OSError, tarfile.TarError, ValueError) as exc:
        raise SystemExit(f"Copia de documentos no verificable: {exc}") from exc
    print(f"OK copia de documentos: {files} archivos y {size} bytes leídos sin tocar producción.")
