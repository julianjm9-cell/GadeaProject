"""Identify the running image and the last deployment that passed its checks."""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD_FILE = ROOT / 'BUILD_REVISION'
RECEIPT_FILE = ROOT / 'DEPLOYMENT_RECEIPT.json'
REVISION = re.compile(r'[a-f0-9]{40}')


def running_revision():
    try:
        value = BUILD_FILE.read_text(encoding='utf-8').strip()
        return value if REVISION.fullmatch(value) else None
    except OSError:
        return None


def release_status():
    running = running_revision()
    try:
        receipt = json.loads(RECEIPT_FILE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        receipt = {}
    if not isinstance(receipt, dict):
        receipt = {}
    timestamp = receipt.get('verified_at')
    try:
        valid_date = isinstance(timestamp, str) and datetime.fromisoformat(timestamp.replace('Z', '+00:00')).utcoffset() is not None
    except ValueError:
        valid_date = False
    verified = bool(running and receipt.get('revision') == running and valid_date)
    return {'running_revision': running, 'verified_revision': running if verified else None,
            'verified_at': timestamp if verified else None}


def stamp(expected):
    running = running_revision()
    if expected != 'unknown' and (not REVISION.fullmatch(expected) or running != expected):
        raise ValueError('La imagen en ejecución no corresponde a la revisión desplegada.')
    if expected == 'unknown' and running is not None:
        raise ValueError('La revisión de la imagen y el checkout no coinciden.')
    receipt = {'revision': running, 'verified_at': datetime.now(timezone.utc).isoformat()}
    temporary = RECEIPT_FILE.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8') as handle:
        json.dump(receipt, handle)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, RECEIPT_FILE)


if __name__ == '__main__':
    import sys
    if len(sys.argv) != 3 or sys.argv[1] != 'stamp':
        raise SystemExit('Uso: python -m app.services.release_status stamp REVISION')
    stamp(sys.argv[2])
    print('Despliegue comprobado; revisión de código sin identificar.' if sys.argv[2] == 'unknown' else 'OK revisión de despliegue verificada: ' + sys.argv[2])
