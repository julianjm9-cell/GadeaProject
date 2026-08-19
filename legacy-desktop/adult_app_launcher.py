from __future__ import annotations

import json
import re
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib import error, request
from urllib.parse import unquote, urlparse


DEFAULT_LICENSE_SERVER_URL = "http://127.0.0.1:8787"


class AdultAppConfig:
    def __init__(self, app_name: str, html_file: str, data_dir_name: str, client_app: str, license_label: str) -> None:
        self.app_name = app_name
        self.html_file = html_file
        self.data_dir_name = data_dir_name
        self.client_app = client_app
        self.license_label = license_label


def resource_dir() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS).resolve()
    return Path(__file__).parent.resolve()


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent.resolve()
    return Path(__file__).parent.resolve()


def safe_filename(name: str, default: str = "export.txt") -> str:
    clean = unquote(name or "").strip().replace("\\", "_").replace("/", "_")
    clean = re.sub(r"[^A-Za-z0-9._() -]+", "_", clean).strip(" .")
    return clean or default


def safe_path_parts(parts: Any) -> list[str]:
    if not isinstance(parts, list):
        return []
    return [safe_filename(str(part), "carpeta")[:80] for part in parts[:6] if str(part or "").strip()]


def run(config: AdultAppConfig) -> int:
    paths = data_paths(config)
    ensure_structure(config, paths)
    html_file = resource_dir() / config.html_file
    if not html_file.exists():
        show_error(config.app_name, f"No se encuentra {config.html_file}.\n\nRuta buscada:\n{html_file}")
        return 1
    handler = make_handler(config, paths)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = int(server.server_address[1])
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/"
    print("=" * 58)
    print(f"  {config.app_name}")
    print("=" * 58)
    print(f"  Aplicacion: {url}")
    print(f"  Datos:      {paths['root']}")
    print("  Puedes cerrar esta ventana al terminar.")
    print("=" * 58)
    webbrowser.open(url)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()
        server.server_close()
    return 0


def data_paths(config: AdultAppConfig) -> dict[str, Path]:
    root = app_dir() / config.data_dir_name
    return {
        "root": root,
        "exports": root / "exports",
        "backups": root / "backups",
        "logs": root / "logs",
        "state": root / "state.json",
        "profile": root / "profile.json",
        "license": root / "license.txt",
        "backend_server": root / "backend_server.txt",
        "readme": root / "LEEME.txt",
        "log": root / "logs" / "app.log",
    }


def ensure_structure(config: AdultAppConfig, paths: dict[str, Path]) -> None:
    for key in ("root", "exports", "backups", "logs"):
        paths[key].mkdir(parents=True, exist_ok=True)
    if not paths["state"].exists():
        write_json(paths["state"], {})
    if not paths["profile"].exists():
        write_json(paths["profile"], {"name": "", "email": "modo local", "status": "local"})
    if not paths["license"].exists():
        paths["license"].write_text("", encoding="utf-8")
    if not paths["backend_server"].exists() or not paths["backend_server"].read_text(encoding="utf-8").strip():
        paths["backend_server"].write_text(DEFAULT_LICENSE_SERVER_URL, encoding="utf-8")
    if not paths["readme"].exists():
        paths["readme"].write_text(
            f"{config.app_name} - carpeta de datos\n"
            "================================\n\n"
            "state.json: progreso, tests, examenes e historial.\n"
            f"license.txt: clave de licencia {config.license_label}.\n"
            "backend_server.txt: URL del backend Docker.\n"
            "exports/: textos exportados.\n"
            "backups/: copias automaticas antes de sobrescribir state.json.\n",
            encoding="utf-8",
        )


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def read_json(path: Path) -> Any:
    try:
        raw = path.read_text(encoding="utf-8")
        return json.loads(raw) if raw.strip() else {}
    except Exception:
        return {}


def public_local_user(config: AdultAppConfig, paths: dict[str, Path]) -> dict[str, Any]:
    profile = read_json(paths["profile"])
    name = str(profile.get("name") or "").strip()
    email = str(profile.get("email") or "modo local").strip()
    return {
        "id": "local",
        "organization_id": "local",
        "license_key": paths["license"].read_text(encoding="utf-8").strip(),
        "username": email,
        "has_password": False,
        "name": name or config.app_name,
        "email": email,
        "phone": "",
        "status": str(profile.get("status") or "local"),
        "plan": "local",
        "notes": "",
        "expires_at": "",
        "monthly_quota": 0,
        "usage_month": 0,
        "google_connected": False,
        "drive_connected": False,
        "drive_folder_id": "",
        "created_at": "",
        "updated_at": "",
        "last_used_at": "",
    }


def make_handler(config: AdultAppConfig, paths: dict[str, Path]):
    class AdultHandler(SimpleHTTPRequestHandler):
        server_version = "AdultAppLocal/1.0"

        def __init__(self, *args: Any, directory: str | None = None, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(resource_dir()), **kwargs)

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, fmt: str, *args: Any) -> None:
            stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            try:
                with paths["log"].open("a", encoding="utf-8") as fh:
                    fh.write(f"[{stamp}] {fmt % args}\n")
            except Exception:
                pass

        def do_GET(self) -> None:
            route = urlparse(self.path).path
            if route == "/":
                self.path = "/" + config.html_file
                return super().do_GET()
            if route == "/api/status":
                return self.send_json({"ok": True, "app": config.app_name, "dataDir": str(paths["root"]), "exportsDir": str(paths["exports"])})
            if route == "/api/me":
                return self.send_json({"ok": True, "user": public_local_user(config, paths), "limits": {}})
            if route == "/auth/google/drive-status":
                return self.send_json({"ok": True, "drive_connected": False, "drive_folder_id": ""})
            if route == "/api/drive/folder":
                profile = read_json(paths["profile"])
                return self.send_json({"ok": True, "drive_connected": False, "drive_folder_id": str(profile.get("drive_folder_id") or "")})
            if route == "/api/state":
                return self.send_json(read_json(paths["state"]))
            if route == "/api/license":
                return self.send_json({"license": paths["license"].read_text(encoding="utf-8").strip(), "serverUrl": paths["backend_server"].read_text(encoding="utf-8").strip() or DEFAULT_LICENSE_SERVER_URL})
            return super().do_GET()

        def do_POST(self) -> None:
            route = urlparse(self.path).path
            try:
                payload = self.read_payload()
                if route == "/api/state":
                    backup_state(paths)
                    write_json(paths["state"], payload)
                    return self.send_json({"ok": True})
                if route == "/api/profile":
                    name = str(payload.get("name") or "").strip()
                    if not name:
                        return self.send_json({"ok": False, "detail": "El nombre no puede estar vacio."}, HTTPStatus.BAD_REQUEST)
                    profile = read_json(paths["profile"])
                    profile["name"] = name[:90]
                    profile["updated_at"] = datetime.now().isoformat()
                    write_json(paths["profile"], profile)
                    return self.send_json({"ok": True, "user": public_local_user(config, paths)})
                if route == "/api/drive/folder":
                    profile = read_json(paths["profile"])
                    profile["drive_folder_id"] = str(payload.get("folder") or payload.get("folder_id") or "").strip()
                    profile["updated_at"] = datetime.now().isoformat()
                    write_json(paths["profile"], profile)
                    return self.send_json({"ok": True, "drive_connected": False, "drive_folder_id": profile["drive_folder_id"]})
                if route == "/auth/google/drive-disconnect":
                    profile = read_json(paths["profile"])
                    profile["drive_folder_id"] = ""
                    profile["updated_at"] = datetime.now().isoformat()
                    write_json(paths["profile"], profile)
                    return self.send_json({"ok": True})
                if route == "/api/license":
                    paths["license"].write_text(str(payload.get("license") or "").strip(), encoding="utf-8")
                    paths["backend_server"].write_text(str(payload.get("serverUrl") or DEFAULT_LICENSE_SERVER_URL).strip(), encoding="utf-8")
                    return self.send_json({"ok": True})
                if route == "/api/license/validate":
                    return self.send_json(backend_json(config, paths, "/validate", {}, 20))
                if route == "/api/chat":
                    return self.send_json(backend_json(config, paths, "/chat", {"payload": payload}, 120))
                if route == "/api/documents/save-local":
                    return self.save_document(payload, paths)
                if route == "/api/drive/upload-document":
                    return self.send_json({"ok": False, "detail": "Drive solo esta disponible desde el backend Docker conectado a Google."}, HTTPStatus.BAD_REQUEST)
                if route == "/api/export-text":
                    target = paths["exports"] / safe_filename(str(payload.get("filename") or "export.txt"))
                    target.write_text(str(payload.get("content") or ""), encoding="utf-8")
                    return self.send_json({"ok": True, "path": str(target)})
                self.send_error(HTTPStatus.NOT_FOUND, "Endpoint no encontrado")
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

        def read_payload(self) -> dict[str, Any]:
            length = int(self.headers.get("Content-Length", "0") or "0")
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}") if length > 0 else {}

        def save_document(self, payload: dict[str, Any], paths: dict[str, Path]) -> None:
            filename = safe_filename(str(payload.get("filename") or "documento.doc"), "documento.doc")
            content = str(payload.get("content") or "")
            if not content.strip():
                return self.send_json({"ok": False, "detail": "Documento vacio."}, HTTPStatus.BAD_REQUEST)
            target_dir = paths["exports"] / "docs" / safe_filename(str(payload.get("app") or config.client_app), config.client_app)
            for part in safe_path_parts(payload.get("folder_path")):
                target_dir = target_dir / part
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / filename
            target.write_text(content, encoding="utf-8")
            return self.send_json({"ok": True, "filename": filename, "path": str(target)})

        def send_json(self, data: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return AdultHandler


def backup_state(paths: dict[str, Path]) -> None:
    if not paths["state"].exists() or paths["state"].stat().st_size == 0:
        return
    target = paths["backups"] / f"state_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    target.write_text(paths["state"].read_text(encoding="utf-8"), encoding="utf-8")


def backend_json(config: AdultAppConfig, paths: dict[str, Path], route: str, extra: dict[str, Any], timeout: int) -> dict[str, Any]:
    license_key = paths["license"].read_text(encoding="utf-8").strip()
    if not license_key:
        raise RuntimeError(f"Falta la clave de licencia {config.license_label}.")
    url = (paths["backend_server"].read_text(encoding="utf-8").strip() or DEFAULT_LICENSE_SERVER_URL).rstrip("/") + route
    body = json.dumps({"license_key": license_key, "client_app": config.client_app, **extra}, ensure_ascii=False).encode("utf-8")
    req = request.Request(url, data=body, headers={"Accept": "application/json", "Content-Type": "application/json"}, method="POST")
    try:
        with request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read().decode("utf-8"))
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
            message = data.get("detail") or data.get("error") or data.get("message") or raw
        except Exception:
            message = raw or str(exc)
        raise RuntimeError(message) from exc
    except error.URLError as exc:
        raise RuntimeError(f"No se pudo conectar con el servidor en {url}: {exc.reason}") from exc


def show_error(title: str, message: str) -> None:
    try:
        import tkinter.messagebox as mb

        mb.showerror(title, message)
    except Exception:
        print(message)
