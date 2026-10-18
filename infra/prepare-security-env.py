"""Add deployment security settings without replacing credentials or user licences."""
import base64
import os
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit


def prepare(path):
    path = Path(path)
    source = path.read_text(encoding="utf-8")
    values = {}
    for line in source.splitlines():
        match = re.match(r"^([A-Z_]+)=(.*)$", line.strip())
        if match:
            values[match[1]] = match[2].strip().strip("\"'")
    site = values.get("SITE_ADDRESS", "educame.tech")
    callback = values.get("GOOGLE_REDIRECT_URI", "")
    base = values.get("PUBLIC_BASE_URL") or (callback.split("/auth/")[0] if callback.startswith("https://") else "https://" + site.removeprefix("https://").rstrip("/"))
    host = urlsplit(base).hostname
    if not host or host in {"localhost", "127.0.0.1"} or not base.startswith("https://"):
        raise SystemExit("Configura PUBLIC_BASE_URL=https://tu-dominio antes de desplegar en Hostinger.")
    additions = {"PUBLIC_BASE_URL": base, "ALLOWED_HOSTS": f"{host},www.{host},localhost,127.0.0.1,backend",
        "OAUTH_TOKEN_ENCRYPTION_KEY": base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
        "PROFESOR_SIGNUP_PLAN": "PROFESOR_FREE"}
    for key, value in additions.items():
        if key != "PROFESOR_SIGNUP_PLAN" and values.get(key):
            continue
        source = re.sub(r"^" + key + r"=.*$", key + "=" + value, source, flags=re.M) if key in values else source.rstrip() + "\n" + key + "=" + value + "\n"
    temporary = path.with_name(path.name + ".security.tmp")
    temporary.write_text(source, encoding="utf-8", newline="\n")
    try:
        os.chmod(temporary, 0o600)
    except OSError:
        pass
    temporary.replace(path)
    print("OK configuración segura; clave OAuth conservada y solo nuevas altas como normales. SMTP requiere configuración propia.")


if __name__ == "__main__":
    import sys
    prepare(sys.argv[1] if len(sys.argv) > 1 else ".env")
