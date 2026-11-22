"""Per-application password gates shared by both administration panels."""
from datetime import timedelta
from hashlib import sha256
from html import escape
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database.session import get_db
from app.security.passwords import verify_password
from app.security.tokens import create_token, decode_claims
from app.services.app_registry import registry

router = APIRouter(tags=["app-access"])


def stamp(app):
    return sha256(app["access_password_hash"].encode()).hexdigest()


def granted(request, app):
    try:
        claims = decode_claims(request.cookies.get("educame_gate_" + app["id"], ""), "app_gate")
        return claims.get("app") == app["id"] and claims.get("version") == app.get("access_version", 0) and claims.get("stamp") == stamp(app)
    except ValueError:
        return False


class AccessPassword(BaseModel):
    password: str = Field(max_length=72)


@router.post("/api/app-access/{app_id}/unlock")
def unlock(app_id: str, payload: AccessPassword, request: Request, response: Response, db: Session = Depends(get_db)):
    from app.api.auth import rate_limit_key
    rate_limit_key("app-gate:" + app_id + ":" + (request.client.host if request.client else "unknown"), limit=20)
    app = next((item for item in registry(db, include_secrets=True)["apps"] if item["id"] == app_id), None)
    if not app:
        raise HTTPException(404, "Aplicación no encontrada.")
    if app["state"] == "pausada":
        raise HTTPException(503, "Esta aplicación está pausada.")
    hashed = app.get("access_password_hash")
    if app["state"] != "privada" or not hashed or len(payload.password.encode()) > 72 or not verify_password(payload.password, hashed):
        raise HTTPException(403, "La contraseña no es correcta.")
    token = create_token(UUID(int=0), "app_gate", timedelta(days=7), app=app_id, version=app.get("access_version", 0), stamp=stamp(app))
    response.set_cookie("educame_gate_" + app_id, token, max_age=604800, httponly=True, secure=get_settings().cookie_secure, samesite="strict", path="/")
    return {"ok": True}


def gate_page(app_id, app_name):
    name = escape(app_name)
    # IDs come from the registry's restricted slug alphabet.
    html = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Acceso privado</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#f4f3ec;color:#203e34;font:16px system-ui}main{width:min(100%,420px);padding:32px;background:white;border:1px solid #d9dfd5;border-radius:24px;box-shadow:0 16px 60px #203e3410}h1{font-size:25px;margin:0 0 12px}p{line-height:1.6}label{display:grid;gap:10px}input,button{font:inherit;padding:14px;border-radius:12px;width:100%;border:1px solid #bac9bd}button{background:#285743;color:white;margin-top:18px;cursor:pointer}input:focus-visible,button:focus-visible{outline:3px solid #9abfab;outline-offset:3px}#error{color:#a22c25}
</style><main><h1>APP_NAME</h1><p>Introduce la contraseña para acceder.</p><form><label>Contraseña de acceso<input type="password" required maxlength="72" autocomplete="current-password"></label><button>Entrar</button><p id="error" role="alert" hidden></p></form></main><script>
document.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const input=document.querySelector('input'),button=document.querySelector('button'),error=document.querySelector('#error');if(button.disabled)return;button.disabled=true;error.hidden=true;try{const response=await fetch('/api/app-access/APP_ID/unlock',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:input.value})});const data=await response.json();input.value='';if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'No se pudo abrir la aplicación.');location.reload();}catch(problem){error.textContent=problem.message;error.hidden=false;button.disabled=false;input.focus();}});
</script></html>'''
    return HTMLResponse(html.replace("APP_NAME", name).replace("APP_ID", app_id), status_code=401, headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"})
