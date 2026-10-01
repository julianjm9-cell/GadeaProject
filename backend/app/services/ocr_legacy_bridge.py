"""Run the original Aliot app with a private, empty data directory per suite user."""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

_lock = threading.RLock()
_servers: dict[str, tuple[subprocess.Popen, int, float]] = {}
MAX_ACTIVE = 3


def legacy_dir(user):
    root = Path(os.environ.get("OCR_DATA_DIR", "/app/data/documents/ocr"))
    return root / "legacy" / str(user.organization_id) / str(user.id)


def _free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _has_queued_files(key):
    root = Path(os.environ.get("OCR_DATA_DIR", "/app/data/documents/ocr")) / "legacy" / key / "facturas"
    try:
        return any(file.is_file() for incoming in root.glob("*/entrada") for file in incoming.iterdir())
    except OSError:
        return True


def _stop_idle(now):
    for key, (proc, _port, last_used) in list(_servers.items()):
        if proc.poll() is not None or (now - last_used > 3600 and not _has_queued_files(key)):
            if proc.poll() is None:
                proc.terminate()
            _servers.pop(key, None)


def get_legacy_port(user, config):
    key = f"{user.organization_id}/{user.id}"
    with _lock:
        now = time.monotonic()
        _stop_idle(now)
        if key in _servers:
            proc, port, _ = _servers[key]
            saved_config = legacy_dir(user) / "config.json"
            current = json.loads(saved_config.read_text(encoding="utf-8-sig")) if saved_config.exists() else {}
            if all(current.get(field) == config[value] for field, value in (("api_tipo", "api_tipo"), ("api_key", "api_key"), ("modelo_externo", "modelo_externo"))):
                _servers[key] = proc, port, now
                return port
            if _has_queued_files(key):
                raise RuntimeError("Espera a que termine el procesamiento antes de cambiar el modelo")
            proc.terminate()
            _servers.pop(key, None)
        if len(_servers) >= MAX_ACTIVE:
            idle = [(last, existing) for existing, (_proc, _port, last) in _servers.items() if not _has_queued_files(existing)]
            if idle:
                _, oldest = min(idle)
                previous, _, _ = _servers.pop(oldest)
                previous.terminate()
            else:
                raise RuntimeError("Hay demasiados procesamientos simultáneos. Vuelve a intentarlo en unos minutos.")
        data = legacy_dir(user)
        data.mkdir(parents=True, exist_ok=True)
        (data / "facturas").mkdir(exist_ok=True)
        config_file = data / "config.json"
        if config_file.exists():
            saved = json.loads(config_file.read_text(encoding="utf-8-sig"))
        else:
            # No users, templates, training, workspaces or processed invoices are imported.
            saved = {"entrenamiento_activo": False}
        saved.update({
            "api_tipo": config["api_tipo"],
            "api_key": config["api_key"],
            "modelo_externo": config["modelo_externo"],
            "vision_enabled": config.get("vision_enabled", True),
            "api_min_interval": 1,
            "api_url": "",
            "carpeta_facturas": str(data / "facturas"),
        })
        config_file.write_text(json.dumps(saved, ensure_ascii=False), encoding="utf-8")
        try:
            os.chmod(config_file, 0o600)
        except OSError:
            pass
        port = _free_port()
        env = os.environ.copy()
        env.update({"ALIOT_DATA_DIR": str(data), "ALIOT_FACTURAS_DIR": str(data / "facturas"), "ALIOT_PORT": str(port), "ALIOT_OPEN_BROWSER": "0", "ALIOT_DISABLE_AUTH": "1", "ALIOT_AUTH_MODE": "dev"})
        script = Path(__file__).resolve().parents[1] / "ocr_engine" / "main.py"
        proc = subprocess.Popen([sys.executable, "-u", str(script)], cwd=str(script.parent), env=env, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        _servers[key] = proc, port, now
        return port
