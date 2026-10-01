"""
Aliot Innovación · Main v10
============================
v9:
  - Endpoints proveedores: listar, añadir, eliminar
  - Config API externa: OpenAI / Anthropic
  - Link conversión USD automático
  - Pestaña Configuración en interfaz
  - Todos los endpoints con workspace
v10:
  - Entrenamiento: preview imagen en procesar-ejemplo (imagen_b64)
  - Entrenamiento: POST /api/entrenamiento/añadir-ejemplo (subir factura adicional)
  - Entrenamiento: DELETE /api/entrenamiento/ejemplo (eliminar ejemplo por índice)
  - Entrenamiento: POST /api/entrenamiento/añadir-ejemplo-validado (desde tabla)
  - Procesador v15: ejemplos_validados hasta 5 por proveedor inyectados en prompts
"""

import io, sys, json, shutil, zipfile, logging, threading, webbrowser, time, os, asyncio, csv, base64, re, socket
import requests, openpyxl
from pathlib import Path
from datetime import datetime

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import aiofiles

import procesador_facturas as fac

if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

_ollama_lock = threading.Lock()
fac.ollama_lock = _ollama_lock

def _base_dir():
    if getattr(sys, 'frozen', False): return Path(sys.executable).parent
    return Path(__file__).parent

def _data_dir():
    return Path(os.environ.get("ALIOT_DATA_DIR", _base_dir())).resolve()

def _load_config():
    for p in [_data_dir() / "config.json", _base_dir() / "config.json", Path("config.json")]:
        if p.exists():
            try:
                cfg = json.loads(p.read_text(encoding="utf-8-sig"))
                if os.environ.get("ALIOT_OLLAMA_URL"):
                    cfg["ollama_url"] = os.environ["ALIOT_OLLAMA_URL"]
                if os.environ.get("ALIOT_PORT"):
                    cfg["puerto"] = int(os.environ["ALIOT_PORT"])
                if os.environ.get("ALIOT_FACTURAS_DIR"):
                    cfg["carpeta_facturas"] = os.environ["ALIOT_FACTURAS_DIR"]
                if os.environ.get("ALIOT_MODELO_ANALISIS"):
                    cfg["modelo_analisis"] = os.environ["ALIOT_MODELO_ANALISIS"]
                if os.environ.get("ALIOT_MODELO_OCR"):
                    cfg["modelo_ocr"] = os.environ["ALIOT_MODELO_OCR"]
                if os.environ.get("ALIOT_MODO_VISION_OLLAMA"):
                    cfg["modo_vision_ollama"] = os.environ["ALIOT_MODO_VISION_OLLAMA"].strip().lower() in ("1", "true", "si", "yes", "on")
                if os.environ.get("ALIOT_TIMEOUT_OLLAMA"):
                    cfg["timeout_ollama"] = int(os.environ["ALIOT_TIMEOUT_OLLAMA"])
                if os.environ.get("ALIOT_WATCHDOG_TIMEOUT"):
                    cfg["watchdog_timeout"] = int(os.environ["ALIOT_WATCHDOG_TIMEOUT"])
                return cfg
            except: pass
    return {}

_CFG     = _load_config()
API_PORT = int(_CFG.get("puerto", os.environ.get("ALIOT_PORT", 8000)))
OLLAMA_URL = _CFG.get("ollama_url", os.environ.get("ALIOT_OLLAMA_URL", "http://localhost:11435"))
HTML_PATH  = _base_dir() / "aliot-suite.html"
CFG_PATH   = _data_dir() / "config.json"
ACCESS_PATH = _data_dir() / "access_control.json"
FX_CACHE_PATH = _data_dir() / "tipo_cambio_cache.json"
ECB_FX_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.zip"
_data_dir().mkdir(parents=True, exist_ok=True)
for _seed in ("config.json", "proveedores.json", "entrenamiento.json"):
    _src = _base_dir() / _seed
    _dst = _data_dir() / _seed
    if _src.exists() and not _dst.exists():
        try:
            shutil.copy2(_src, _dst)
        except Exception:
            pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-12s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(_data_dir() / "aliot.log"), encoding="utf-8"),
    ],
)
log = logging.getLogger("main")


ROLES = {
    "admin": {
        "label": "Administrador",
        "permissions": ["view", "process", "review", "manage_workspaces", "manage_config", "manage_access"],
    },
    "usuario": {
        "label": "Usuario",
        "permissions": ["view", "process", "review", "manage_workspaces"],
    },
}
ROLE_ORDER = ["admin", "usuario"]
LEGACY_ROLE_MAP = {"gestor": "usuario", "revisor": "usuario", "lectura": "usuario"}
DEV_EMAIL = os.environ.get("ALIOT_DEV_USER_EMAIL", "admin@local").strip().lower()
BOOTSTRAP_ADMIN = os.environ.get("ALIOT_BOOTSTRAP_ADMIN_EMAIL", DEV_EMAIL).strip().lower()


def _norm_email(email: str) -> str:
    return str(email or "").strip().lower()


def _access_seed():
    email = BOOTSTRAP_ADMIN or DEV_EMAIL or "admin@local"
    return {
        "version": 1,
        "users": {
            email: {
                "email": email,
                "role": "admin",
                "name": "Administrador inicial",
                "active": True,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }
        },
    }


def _load_access():
    if not ACCESS_PATH.exists():
        data = _access_seed()
        _save_access(data)
        return data
    try:
        data = json.loads(ACCESS_PATH.read_text(encoding="utf-8-sig"))
    except Exception:
        data = _access_seed()
    users = data.setdefault("users", {})
    for email, info in list(users.items()):
        norm = _norm_email(info.get("email") or email)
        if norm != email:
            users.pop(email, None)
            users[norm] = {**info, "email": norm}
        role = users.get(norm, {}).get("role")
        users[norm]["role"] = LEGACY_ROLE_MAP.get(role, role if role in ROLES else "usuario")
        users[norm]["active"] = bool(users[norm].get("active", True))
    if not users:
        data = _access_seed()
        _save_access(data)
    return data


def _save_access(data):
    ACCESS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _decode_client_principal(raw: str):
    if not raw:
        return {}
    try:
        padded = raw + "=" * (-len(raw) % 4)
        return json.loads(base64.b64decode(padded).decode("utf-8"))
    except Exception:
        return {}


def _current_identity(request: Request):
    dev_header = request.headers.get("x-aliot-dev-user")
    principal = _decode_client_principal(request.headers.get("x-ms-client-principal", ""))
    claims = principal.get("claims") or []
    claim_map = {str(c.get("typ") or "").lower(): c.get("val") for c in claims if isinstance(c, dict)}
    email = (
        dev_header
        or request.headers.get("x-ms-client-principal-name")
        or request.headers.get("x-ms-client-principal-id")
        or principal.get("userDetails")
        or claim_map.get("preferred_username")
        or claim_map.get("email")
        or claim_map.get("upn")
    )
    if not email and os.environ.get("ALIOT_AUTH_MODE", "dev").lower() == "dev":
        email = DEV_EMAIL
    name = (
        request.headers.get("x-ms-client-principal-name")
        or principal.get("userDetails")
        or claim_map.get("name")
        or email
    )
    return {"email": _norm_email(email), "name": str(name or "").strip()}


def _permissions_for_role(role: str):
    return set(ROLES.get(role, ROLES["usuario"])["permissions"])


def _user_for_request(request: Request):
    identity = _current_identity(request)
    email = identity.get("email")
    if not email:
        return None
    users = _load_access().get("users", {})
    user = users.get(email)
    if (
        not user
        and email == DEV_EMAIL
        and os.environ.get("ALIOT_AUTH_MODE", "dev").lower() == "dev"
        and not request.headers.get("x-ms-client-principal")
    ):
        user = {"email": email, "name": "Administrador local", "role": "admin", "active": True}
    if not user or not user.get("active", True):
        return {"email": email, "name": identity.get("name") or email, "role": "sin_acceso", "permissions": []}
    role = request.cookies.get("aliot_role") or user.get("role", "usuario")
    role = LEGACY_ROLE_MAP.get(role, role if role in ROLES else "usuario")
    return {
        "email": email,
        "name": user.get("name") or identity.get("name") or email,
        "role": role,
        "permissions": sorted(_permissions_for_role(role)),
        "active": True,
    }


def _required_permission(method: str, path: str):
    if not path.startswith("/api/"):
        return None
    if path in ("/api/health", "/api/auth/me"):
        return None
    if path.startswith("/api/auth/access"):
        return "manage_access"
    if path.startswith("/api/config") or path.startswith("/api/ollama") or path.startswith("/api/prompts"):
        return "manage_config"
    if path.startswith("/api/proveedores") or path.startswith("/api/plantillas") or path.startswith("/api/entrenamiento"):
        return "manage_config"
    if path.startswith("/api/workspaces"):
        return "manage_workspaces" if method in ("POST", "DELETE") else "view"
    if path.startswith("/api/facturas/download") or method == "GET":
        return "view"
    if path.startswith("/api/facturas/results/") and path.endswith(("/accept", "/fx")):
        return "review"
    if path.startswith("/api/facturas/results/") and method in ("DELETE", "POST"):
        return "process"
    if path.startswith("/api/facturas"):
        return "process"
    return "view"


def _public_auth_disabled():
    return os.environ.get("ALIOT_DISABLE_AUTH", "").strip().lower() in ("1", "true", "si", "yes", "on")


class _IgnorarResetConexionAsyncio(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        return not (
            record.name == "asyncio"
            and "Exception in callback _ProactorBasePipeTransport._call_connection_lost" in msg
        )


logging.getLogger("asyncio").addFilter(_IgnorarResetConexionAsyncio())

# workspace "default" eliminado — se usa el primer cliente disponible

app = FastAPI(title="Aliot Suite v10", version="10.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def access_control_middleware(request: Request, call_next):
    if _public_auth_disabled():
        return await call_next(request)
    required = _required_permission(request.method.upper(), request.url.path)
    if not required:
        return await call_next(request)
    user = _user_for_request(request)
    if not user or not user.get("email"):
        return JSONResponse({"error": "No autenticado"}, status_code=401)
    if required not in set(user.get("permissions", [])):
        return JSONResponse({
            "error": "Sin permiso",
            "required": required,
            "user": {"email": user.get("email"), "role": user.get("role")},
        }, status_code=403)
    request.state.user = user
    return await call_next(request)

@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse({"error": str(exc)}, status_code=400)

@app.get("/")
def serve_html():
    if HTML_PATH.exists(): return FileResponse(str(HTML_PATH), media_type="text/html")
    return JSONResponse({"error": "aliot-suite.html no encontrado"}, status_code=404)

@app.get("/api/health")
def health():
    return {"status": "ok", "ts": datetime.now().isoformat(), "port": API_PORT}


@app.get("/api/auth/me")
def auth_me(request: Request):
    user = _user_for_request(request)
    return JSONResponse({
        "authenticated": bool(user and user.get("email") and user.get("role") != "sin_acceso"),
        "user": user,
        "roles": ROLES,
        "auth_disabled": _public_auth_disabled(),
    })


@app.post("/api/auth/role")
async def set_active_role(datos: dict):
    role = str(datos.get("role") or "usuario").strip().lower()
    if role not in ROLES:
        raise HTTPException(400, "Rol no valido")
    resp = JSONResponse({"ok": True, "role": role, "roles": ROLES})
    resp.set_cookie("aliot_role", role, max_age=60 * 60 * 24 * 365, samesite="lax")
    return resp


@app.get("/api/auth/access")
def list_access_users():
    users = list(_load_access().get("users", {}).values())
    users.sort(key=lambda u: (_norm_email(u.get("email"))))
    return JSONResponse({"users": users, "roles": ROLES, "role_order": ROLE_ORDER})


@app.post("/api/auth/access")
async def save_access_user(datos: dict):
    email = _norm_email(datos.get("email"))
    role = str(datos.get("role") or "usuario").strip().lower()
    role = LEGACY_ROLE_MAP.get(role, role)
    name = str(datos.get("name") or "").strip()
    active = bool(datos.get("active", True))
    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(400, "Correo no valido")
    if role not in ROLES:
        raise HTTPException(400, "Rol no valido")
    data = _load_access()
    existing = data.setdefault("users", {}).get(email, {})
    now = datetime.now().isoformat()
    data["users"][email] = {
        "email": email,
        "role": role,
        "name": name or existing.get("name") or email,
        "active": active,
        "created_at": existing.get("created_at") or now,
        "updated_at": now,
    }
    _save_access(data)
    log.info(f"Acceso actualizado: {email} -> {role} active={active}")
    return JSONResponse({"ok": True, "user": data["users"][email]})


@app.delete("/api/auth/access/{email}")
def delete_access_user(email: str):
    email = _norm_email(email)
    data = _load_access()
    users = data.setdefault("users", {})
    if email not in users:
        raise HTTPException(404, "Usuario no encontrado")
    admins = [u for u in users.values() if u.get("active", True) and u.get("role") == "admin" and _norm_email(u.get("email")) != email]
    if users[email].get("role") == "admin" and not admins:
        raise HTTPException(400, "No se puede eliminar el ultimo admin activo")
    users.pop(email, None)
    _save_access(data)
    log.info(f"Acceso eliminado: {email}")
    return JSONResponse({"ok": True})


# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/config")
def get_config():
    cfg = _load_config()
    # No exponer api_key completa, solo si existe
    api_key = cfg.get("api_key", "")
    anyformat_key = cfg.get("anyformat_api_key", "")
    return JSONResponse({
        "empresa_receptora": cfg.get("empresa_receptora", ""),
        "modelo_analisis": cfg.get("modelo_analisis", "llama3.2:3b"),
        "modelo_ocr": cfg.get("modelo_ocr", "glm-ocr:latest"),
        "ollama_url": cfg.get("ollama_url", os.environ.get("ALIOT_OLLAMA_URL", "http://localhost:11435")),
        "puerto": cfg.get("puerto", 8000),
        "api_tipo": cfg.get("api_tipo", "ollama"),
        "api_key_existe": bool(api_key),
        "api_key_preview": api_key[:8] + "…" if len(api_key) > 8 else "",
        "modelo_externo": cfg.get("modelo_externo", "gpt-4o-mini"),
        "api_url": cfg.get("api_url", ""),
        "anyformat_api_key_existe": bool(anyformat_key),
        "anyformat_api_key_preview": anyformat_key[:8] + "…" if len(anyformat_key) > 8 else "",
        "anyformat_workflow_id": cfg.get("anyformat_workflow_id", ""),
        "anyformat_base_url": cfg.get("anyformat_base_url", "https://api.anyformat.ai"),
        "modo_vision_ollama": bool(cfg.get("modo_vision_ollama", False)),
        "vision_enabled": bool(cfg.get("vision_enabled", False)),
        "empresa_cif": cfg.get("empresa_cif", ""),
        "entrenamiento_activo": bool(cfg.get("entrenamiento_activo", False)),
    })

@app.post("/api/config")
async def post_config(datos: dict):
    """Guarda configuración completa."""
    try:
        p = CFG_PATH
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        campos_permitidos = [
            "empresa_receptora","modelo_analisis","modelo_ocr","ollama_url","puerto",
            "api_tipo","api_key","modelo_externo","api_url","carpeta_facturas",
            "anyformat_api_key","anyformat_workflow_id","anyformat_base_url",
            "modo_vision_ollama","vision_enabled","empresa_cif","entrenamiento_activo",
        ]
        for campo in campos_permitidos:
            if campo in datos:
                cfg[campo] = datos[campo]
        p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info(f"  Config actualizado: {list(datos.keys())}")
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.post("/api/empresa_receptora")
async def set_empresa(datos: dict):
    nombre = datos.get("nombre", "").strip()
    try:
        fac.guardar_empresa_receptora(nombre)
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.get("/api/workspaces/{workspace}/config")
def get_workspace_config(workspace: str):
    """Devuelve config del workspace (empresa, CIF)."""
    cfg = fac.leer_config_workspace(workspace)
    return JSONResponse({
        "workspace": workspace,
        "empresa_receptora": cfg.get("empresa_receptora", ""),
        "empresa_cif": cfg.get("empresa_cif", ""),
    })

@app.post("/api/workspaces/{workspace}/config")
async def save_workspace_config(workspace: str, datos: dict):
    """Guarda empresa receptora y CIF para un workspace específico."""
    nombre = datos.get("empresa_receptora", "").strip()
    cif    = datos.get("empresa_cif", "").strip()
    fac.guardar_empresa_workspace(workspace, nombre, cif)
    log.info(f"  Workspace '{workspace}': empresa='{nombre}' CIF='{cif}'")
    return JSONResponse({"ok": True, "empresa_receptora": nombre, "empresa_cif": cif})

@app.post("/api/set_modelo")
async def set_modelo(datos: dict):
    modelo = datos.get("modelo", "").strip()
    tipo = datos.get("tipo", "analisis")
    if not modelo: raise HTTPException(400, "Modelo vacío")
    try:
        p = CFG_PATH
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        key = "modelo_ocr" if tipo == "ocr" else "modelo_analisis"
        cfg[key] = modelo
        p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        return JSONResponse({"ok": True, "modelo": modelo, "tipo": tipo})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")


# ═══════════════════════════════════════════════════════════════════
# OLLAMA / MODELOS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/ollama/status")
def ollama_status():
    ollama_url = _load_config().get("ollama_url", "http://localhost:11435")
    try:
        r = requests.get(f"{ollama_url}/api/tags", timeout=4)
        modelos = [m["name"] for m in r.json().get("models", [])]
        ollama_ok = True
    except:
        modelos = []; ollama_ok = False

    fac_est = fac.estado_procesador.copy()
    lock_ocupado = _ollama_lock.locked()

    api_ext = fac.usar_api_externa()
    anyformat_ok = fac.usar_anyformat()
    if anyformat_ok:
        estado_global = "idle" if not lock_ocupado else "facturas"
        mensaje = "API externa: anyformat"
    elif api_ext:
        estado_global = "idle" if not lock_ocupado else "facturas"
        mensaje = f"API externa: {fac.leer_config_api()['tipo']}"
    elif not ollama_ok:
        estado_global = "error"; mensaje = "Ollama no responde"
    elif lock_ocupado:
        estado_global = "facturas"; mensaje = f"Procesando: {fac_est.get('archivo','')}"
    else:
        estado_global = "idle"; mensaje = "Listo"

    return JSONResponse({
        "ollama_ok": ollama_ok or api_ext or anyformat_ok,
        "estado": estado_global, "mensaje": mensaje,
        "modelos": modelos, "fac_estado": fac_est["estado"],
        "api_externa": api_ext or anyformat_ok,
        "anyformat_ok": anyformat_ok,
    })

@app.get("/api/ollama/modelos")
def ollama_modelos():
    cfg = _load_config()
    ollama_url = cfg.get("ollama_url", "http://localhost:11435")
    modelos = []
    try:
        r = requests.get(f"{ollama_url}/api/tags", timeout=4)
        modelos = [m["name"] for m in r.json().get("models", [])]
    except: pass
    return JSONResponse({
        "modelos": modelos,
        "modelo_actual": cfg.get("modelo_analisis", "llama3.2:3b"),
        "modelo_ocr_actual": cfg.get("modelo_ocr", "glm-ocr:latest"),
    })


# ═══════════════════════════════════════════════════════════════════
# PROVEEDORES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/proveedores")
def get_proveedores():
    """Devuelve los proveedores personalizados del usuario."""
    proveedores = dict(sorted(
        fac.leer_proveedores().items(),
        key=lambda kv: str((kv[1] or {}).get("nombre") or kv[0]).casefold()
    ))
    return JSONResponse({
        "todos": proveedores,
        "custom": proveedores,
        "custom_count": len(proveedores),
    })

@app.post("/api/proveedores")
async def add_proveedor(datos: dict):
    nombre = datos.get("nombre", "").strip()
    nif = datos.get("nif", "").strip()
    if not nif: raise HTTPException(400, "NIF/CIF vacío")
    if not nombre: raise HTTPException(400, "Nombre vacío")
    try:
        fac.guardar_proveedor(
            nombre=nombre,
            nif=nif,
            pais=datos.get("pais", ""),
            alias=datos.get("alias", []),
        )
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.delete("/api/proveedores/{key}")
def del_proveedor(key: str):
    try:
        fac.eliminar_proveedor(key)
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")


# ═══════════════════════════════════════════════════════════════════
# TIPO DE CAMBIO USD (link automático)
# ═══════════════════════════════════════════════════════════════════

def _fecha_iso_o_hoy(fecha: str):
    fecha = (fecha or "").strip()
    if not fecha:
        return datetime.now().strftime("%Y-%m-%d")
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(fecha, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    raise HTTPException(400, "Fecha no válida. Usa DD/MM/AAAA o AAAA-MM-DD")

def _parse_float_q(v):
    try:
        return float(fac.parsear_importe(v))
    except Exception:
        return 0.0

def _load_fx_cache():
    try:
        return json.loads(FX_CACHE_PATH.read_text(encoding="utf-8-sig")) if FX_CACHE_PATH.exists() else {}
    except Exception:
        return {}

def _save_fx_cache(cache):
    try:
        FX_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

def _fx_response(moneda, fecha_iso, eur_por_unidad, fecha_tipo, base, total, cached=False):
    base_num = _parse_float_q(base)
    total_num = _parse_float_q(total)
    return {
        "ok": True,
        "moneda": moneda,
        "eur_por_unidad": round(float(eur_por_unidad), 6),
        "base_eur": round(base_num * float(eur_por_unidad), 2) if base_num else "",
        "total_eur": round(total_num * float(eur_por_unidad), 2) if total_num else "",
        "fecha_solicitada": fecha_iso,
        "fecha_tipo_cambio": fecha_tipo,
        "fuente": "BCE" + (" cache" if cached else ""),
        "fuente_url": "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
    }

def _auto_fx_campos(datos: dict):
    moneda = str(datos.get("moneda") or "").strip().upper()
    if not moneda or moneda == "EUR":
        return {}
    if datos.get("base_eur") or datos.get("total_eur"):
        return {}
    try:
        fecha_iso = _fecha_iso_o_hoy(str(datos.get("fecha_factura") or ""))
        cache = _load_fx_cache()
        cache_key = f"{moneda}:{fecha_iso}"
        if cache_key in cache:
            c = cache[cache_key]
            eur_por_unidad = float(c["eur_por_unidad"])
            fecha_tipo = c.get("fecha_tipo_cambio", fecha_iso)
        else:
            eur_por_unidad, fecha_tipo = _buscar_tipo_ecb(moneda, fecha_iso)
            cache[cache_key] = {"eur_por_unidad": float(eur_por_unidad), "fecha_tipo_cambio": fecha_tipo}
            _save_fx_cache(cache)
        base_num = _parse_float_q(datos.get("base_imponible", ""))
        total_num = _parse_float_q(datos.get("total_pagar", ""))
        return {
            "base_eur": round(base_num * eur_por_unidad, 2) if base_num else "",
            "total_eur": round(total_num * eur_por_unidad, 2) if total_num else "",
            "tipo_cambio": round(eur_por_unidad, 6),
            "fecha_tipo_cambio": datetime.strptime(fecha_tipo, "%Y-%m-%d").strftime("%d/%m/%Y"),
            "fuente_tipo_cambio": "BCE",
        }
    except Exception:
        return {}

def _descargar_ecb_hist():
    r = requests.get(ECB_FX_URL, timeout=12)
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        csv_name = next((n for n in zf.namelist() if n.lower().endswith(".csv")), "")
        if not csv_name:
            raise RuntimeError("El ZIP del BCE no contiene CSV")
        return zf.read(csv_name).decode("utf-8-sig")

def _buscar_tipo_ecb(moneda: str, fecha_iso: str):
    csv_text = _descargar_ecb_hist()
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    moneda = moneda.upper()
    if not rows or moneda not in rows[0]:
        raise RuntimeError(f"El BCE no publica tipo para {moneda}")
    objetivo = datetime.strptime(fecha_iso, "%Y-%m-%d").date()
    candidatos = []
    for row in rows:
        try:
            f = datetime.strptime(row.get("Date", ""), "%Y-%m-%d").date()
        except ValueError:
            continue
        if f <= objetivo and row.get(moneda):
            candidatos.append((f, row[moneda]))
    if not candidatos:
        raise RuntimeError("No hay tipo BCE para esa fecha")
    fecha_tipo, eur_to_moneda = max(candidatos, key=lambda x: x[0])
    eur_to_moneda = float(eur_to_moneda)
    if eur_to_moneda <= 0:
        raise RuntimeError("Tipo BCE inválido")
    return 1 / eur_to_moneda, fecha_tipo.strftime("%Y-%m-%d")

@app.get("/api/tipo-cambio/proponer")
def proponer_tipo_cambio(moneda: str = "USD", fecha: str = "", base: str = "", total: str = ""):
    """Propone conversión a EUR usando el histórico oficial del BCE."""
    moneda = (moneda or "USD").strip().upper()
    if moneda in ("", "EUR"):
        return JSONResponse({"ok": False, "mensaje": "La factura ya está en EUR"})
    fecha_iso = _fecha_iso_o_hoy(fecha)
    cache = _load_fx_cache()
    cache_key = f"{moneda}:{fecha_iso}"
    if cache_key in cache:
        c = cache[cache_key]
        return JSONResponse(_fx_response(moneda, fecha_iso, c["eur_por_unidad"], c.get("fecha_tipo_cambio", fecha_iso), base, total, cached=True))
    try:
        eur_por_unidad, fecha_tipo = _buscar_tipo_ecb(moneda, fecha_iso)
        cache[cache_key] = {"eur_por_unidad": float(eur_por_unidad), "fecha_tipo_cambio": fecha_tipo}
        _save_fx_cache(cache)
        return JSONResponse(_fx_response(moneda, fecha_iso, eur_por_unidad, fecha_tipo, base, total))
    except Exception:
        pass
    return JSONResponse({
        "ok": False,
        "mensaje": "No se pudo obtener el tipo de cambio",
        "link": f"https://www.xe.com/currencyconverter/convert/?Amount=1&From={moneda}&To=EUR",
    })

@app.get("/api/tipo-cambio/usd")
def tipo_cambio_usd(fecha: str = "", base: str = "", total: str = ""):
    return proponer_tipo_cambio("USD", fecha, base, total)


# ═══════════════════════════════════════════════════════════════════
# WORKSPACES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/workspaces")
def list_workspaces():
    ws_list = fac.listar_workspaces()
    return JSONResponse({"workspaces": ws_list, "paused": {ws: bool(_pause_flags.get(ws)) for ws in ws_list}})

@app.post("/api/workspaces")
async def create_workspace(datos: dict):
    nombre = datos.get("nombre", "").strip()
    if not nombre: raise HTTPException(400, "Nombre vacío")
    try:
        nombre_creado = fac.crear_workspace(nombre)
        arrancar_procesador(nombre_creado)   # ← arrancar hilo para el nuevo workspace
        log.info(f"  Workspace '{nombre_creado}' creado y procesador arrancado")
        return JSONResponse({"ok": True, "workspace": nombre_creado})
    except Exception as e:
        raise HTTPException(400, f"Error: {e}")

@app.delete("/api/workspaces/{workspace}")
def delete_workspace(workspace: str):
    if workspace == "default": raise HTTPException(400, "No se puede eliminar default")
    try:
        _stop_flags[workspace] = True   # señalizar al hilo que pare
        _pause_flags.pop(workspace, None)
        fac.eliminar_workspace(workspace)
        _hilos.pop(workspace, None)
        log.info(f"  Workspace '{workspace}' eliminado y hilo señalizado")
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(400, f"Error: {e}")

@app.post("/api/workspaces/{workspace}/rename")
async def rename_workspace(workspace: str, datos: dict):
    nuevo = (datos.get("nombre") or "").strip()
    if not nuevo:
        raise HTTPException(400, "Nombre vacio")
    try:
        workspace_ok = fac.validar_workspace(workspace)
        _stop_flags[workspace_ok] = True
        paused = _pause_flags.pop(workspace_ok, None)
        nombre_creado = fac.renombrar_workspace(workspace_ok, nuevo)
        if paused:
            _pause_flags[nombre_creado] = True
        _hilos.pop(workspace_ok, None)
        if not paused:
            arrancar_procesador(nombre_creado)
        log.info(f"  Workspace '{workspace_ok}' renombrado a '{nombre_creado}'")
        return JSONResponse({"ok": True, "workspace": nombre_creado})
    except Exception as e:
        raise HTTPException(400, f"Error: {e}")


# ═══════════════════════════════════════════════════════════════════
# PLANTILLAS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/workspaces/{workspace}/pause")
def get_workspace_pause(workspace: str):
    workspace = fac.validar_workspace(workspace)
    return JSONResponse({"workspace": workspace, "paused": bool(_pause_flags.get(workspace))})

@app.post("/api/workspaces/{workspace}/pause")
async def set_workspace_pause(workspace: str, datos: dict):
    workspace = fac.validar_workspace(workspace)
    paused = bool(datos.get("paused", True))
    if paused:
        _pause_flags[workspace] = True
        log.info(f"  Cola [{workspace}] pausada manualmente")
    else:
        _pause_flags.pop(workspace, None)
        arrancar_procesador(workspace)
        log.info(f"  Cola [{workspace}] reanudada")
    return JSONResponse({"ok": True, "workspace": workspace, "paused": bool(_pause_flags.get(workspace))})

@app.get("/api/plantillas")
def get_plantillas():
    return JSONResponse({"plantillas": fac.leer_plantillas()})

@app.post("/api/plantillas/{proveedor}")
async def save_plantilla(proveedor: str, datos: dict):
    try: fac.guardar_plantilla(proveedor, datos); return JSONResponse({"ok": True})
    except Exception as e: raise HTTPException(500, f"Error: {e}")

@app.delete("/api/plantillas/{proveedor}")
def del_plantilla(proveedor: str):
    try:
        p = CFG_PATH
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        if "plantillas_proveedores" in cfg and proveedor in cfg["plantillas_proveedores"]:
            del cfg["plantillas_proveedores"][proveedor]
            p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        return JSONResponse({"ok": True})
    except Exception as e: raise HTTPException(500, f"Error: {e}")


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

FAC_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp"}
UPLOAD_EXT = FAC_EXT | {".zip"}

def _safe_filename(nombre: str, require_ext: bool = True):
    nombre = (nombre or "").strip()
    if not nombre or nombre in (".", ".."):
        raise HTTPException(400, "archivo vacio")
    if Path(nombre).is_absolute() or any(sep in nombre for sep in ("/", "\\")) or any(ch in nombre for ch in '<>:"|?*'):
        raise HTTPException(400, "nombre de archivo invalido")
    limpio = Path(nombre).name
    if limpio != nombre or ".." in Path(nombre).parts or any(ord(ch) < 32 for ch in nombre):
        raise HTTPException(400, "nombre de archivo invalido")
    if require_ext and Path(limpio).suffix.lower() not in FAC_EXT:
        raise HTTPException(400, "extension no permitida")
    return limpio

def _require_arch(arch: str):
    if not arch or arch.strip() in ("", "/"): raise HTTPException(400, "archivo vacío")
    return _safe_filename(arch)

def _safe_file_path(carpeta: Path, nombre: str, require_ext: bool = True) -> Path:
    nombre = _safe_filename(nombre, require_ext=require_ext)
    base = carpeta.resolve()
    ruta = (base / nombre).resolve()
    try:
        ruta.relative_to(base)
    except ValueError:
        raise HTTPException(400, "ruta de archivo invalida")
    return ruta

def _safe_upload_filename(nombre: str):
    nombre = (nombre or "").replace("\\", "/").split("/")[-1].strip()
    limpio = _safe_filename(nombre, require_ext=False)
    if Path(limpio).suffix.lower() not in UPLOAD_EXT:
        raise HTTPException(400, "extension no permitida")
    return limpio

def _unique_upload_path(carpeta: Path, nombre: str) -> Path:
    destino = _safe_file_path(carpeta, nombre)
    if not destino.exists():
        return destino
    stem, ext = Path(nombre).stem, Path(nombre).suffix
    n = 2
    while True:
        candidato = _safe_file_path(carpeta, f"{stem}_{_ts()}_{n}{ext}")
        if not candidato.exists():
            return candidato
        n += 1

def _zip_safe_part(valor: str, fallback: str = "Sin proveedor") -> str:
    limpio = "".join(ch if ch not in '<>:"/\\|?*' and ord(ch) >= 32 else "_" for ch in str(valor or "").strip())
    limpio = " ".join(limpio.split()).strip(" .")
    return limpio[:90] or fallback

def _zip_unique_name(usados: set, nombre: str) -> str:
    carpeta, sep, archivo = nombre.rpartition("/")
    base = Path(archivo).stem
    ext = Path(archivo).suffix
    candidato = nombre
    n = 2
    while candidato.lower() in usados:
        archivo_n = f"{base}_{n}{ext}"
        candidato = f"{carpeta}/{archivo_n}" if sep else archivo_n
        n += 1
    usados.add(candidato.lower())
    return candidato

def _ts(): return datetime.now().strftime("%H%M%S")

def _listar(carpeta, exts):
    if not carpeta.exists(): return []
    return [{"nombre": f.name, "tamaño": f.stat().st_size,
             "modificado": datetime.fromtimestamp(f.stat().st_mtime).strftime("%H:%M:%S")}
            for f in sorted(carpeta.iterdir()) if f.is_file() and f.suffix.lower() in exts]

def _leer_excel(workspace="default"):
    path = fac._get_excel_path(workspace)
    if not path.exists(): return [], []
    try:
        wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
        ws_sheet = wb.active; filas = list(ws_sheet.iter_rows(values_only=True)); wb.close()
        if len(filas) < 2: return [], []
        cabeceras = [str(c).strip() if c else f"col_{i}" for i, c in enumerate(filas[0])]
        return fac._normalizar_cabeceras_filas(cabeceras, [list(f) for f in filas[1:] if any(f)])
    except Exception as e:
        log.error(f"Error leyendo Excel [{workspace}]: {e}")
        return [], []

def _nombres_en_cola(paths: dict) -> set[str]:
    entrada = paths.get("entrada")
    if not entrada or not entrada.exists():
        return set()
    return {f.name.casefold() for f in entrada.iterdir() if f.is_file() and f.suffix.lower() in FAC_EXT}

def _fila_esta_en_cola(cabeceras: list, fila: list, nombres_cola: set[str]) -> bool:
    if not nombres_cola:
        return False
    i_orig = next((i for i, c in enumerate(cabeceras) if c == "archivo_original"), -1)
    i_guard = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    orig = str(fila[i_orig] or "").strip().casefold() if i_orig >= 0 and i_orig < len(fila) else ""
    guard = str(fila[i_guard] or "").strip().casefold() if i_guard >= 0 and i_guard < len(fila) else ""
    return bool((orig and orig in nombres_cola) or (guard and guard in nombres_cola))

def _regeneraciones_en_eliminados(paths: dict) -> set[str]:
    backup_dir = paths.get("salida") / "_regeneracion_backups" if paths.get("salida") else None
    eliminados = paths.get("eliminados")
    entrada = paths.get("entrada")
    if not backup_dir or not eliminados or not entrada or not backup_dir.exists() or not eliminados.exists():
        return set()
    en_entrada = {f.name.casefold() for f in entrada.iterdir() if f.is_file() and f.suffix.lower() in FAC_EXT}
    en_eliminados = {f.name.casefold() for f in eliminados.iterdir() if f.is_file() and f.suffix.lower() in FAC_EXT}
    regeneradas = set()
    for backup in backup_dir.glob("*.json"):
        try:
            data = json.loads(backup.read_text(encoding="utf-8"))
            orig = str(data.get("archivo_original") or "").strip().casefold()
            guard = str(data.get("archivo_guardado") or "").strip().casefold()
            if orig in en_entrada and guard in en_eliminados:
                regeneradas.add(guard)
        except Exception:
            continue
    return regeneradas

def _fila_resultado_por_archivo(archivo: str, workspace="default") -> dict:
    cabeceras, filas = _leer_excel(workspace)
    if not cabeceras:
        return {}
    i_orig = next((i for i, c in enumerate(cabeceras) if c == "archivo_original"), -1)
    i_guard = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    for fila in filas:
        orig = str(fila[i_orig] or "") if i_orig >= 0 and i_orig < len(fila) else ""
        guard = str(fila[i_guard] or "") if i_guard >= 0 and i_guard < len(fila) else ""
        if archivo in (orig, guard):
            return {c: fila[i] if i < len(fila) and fila[i] is not None else "" for i, c in enumerate(cabeceras)}
    return {}

def _nombre_automatico_validado(datos: dict, actual: str):
    ext = Path(actual or "").suffix.lower()
    if ext not in FAC_EXT:
        ext = ".pdf"
    elif ext == ".pdf":
        ext = ".PDF"
    try:
        return _safe_filename(fac.generar_nombre_archivo(datos, ext))
    except Exception:
        return ""

def _renombrar_archivo_salida(paths: dict, nombre_actual: str, nombre_nuevo: str):
    if not nombre_actual or not nombre_nuevo or nombre_actual == nombre_nuevo:
        return nombre_actual or nombre_nuevo
    nombre_actual = _safe_filename(nombre_actual)
    nombre_nuevo = _safe_filename(nombre_nuevo)
    origen = _safe_file_path(paths["salida"], nombre_actual)
    if not origen.exists():
        return nombre_actual
    destino = _safe_file_path(paths["salida"], nombre_nuevo)
    if destino.exists() and destino.resolve() != origen.resolve():
        stem, ext = Path(nombre_nuevo).stem, Path(nombre_nuevo).suffix
        destino = _safe_file_path(paths["salida"], f"{stem}_{_ts()}{ext}")
    try:
        origen.rename(destino)
        ocr_origen = paths["ocr"] / fac.nombre_ocr_para_archivo(nombre_actual)
        ocr_destino = paths["ocr"] / fac.nombre_ocr_para_archivo(destino.name)
        if ocr_origen.exists() and not ocr_destino.exists():
            ocr_origen.rename(ocr_destino)
        return destino.name
    except Exception as e:
        log.error(f"Error renombrando: {e}")
        return nombre_actual


# ═══════════════════════════════════════════════════════════════════
def _nombre_descarga_factura(cabeceras: list, fila: list, nombre_actual: str):
    datos = {c: (fila[i] if i < len(fila) and fila[i] is not None else "") for i, c in enumerate(cabeceras)}
    proveedor = str(datos.get("proveedor") or "").strip()
    numero = str(datos.get("numero_factura") or "").strip()
    if proveedor and fac.es_numero_factura_valido(numero):
        generado = _nombre_automatico_validado(datos, nombre_actual)
        if generado:
            return generado
    return _safe_filename(nombre_actual)

# FACTURAS
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/facturas/health")
def fac_health():
    est = fac.estado_procesador
    ts  = est.get("ts", 0)
    secs = int(time.time() - ts) if ts else 0
    return JSONResponse({
        "estado":    est.get("estado", "idle"),
        "archivo":   est.get("archivo", ""),
        "workspace": est.get("workspace", ""),
        "segundos":  secs,
        "atascado":  est.get("estado") in ("ocr","llm","vision") and secs > fac.watchdog_timeout(),
    })

@app.post("/api/facturas/reset-procesador")
def reset_procesador():
    """Fuerza el reset del estado si el procesador está atascado."""
    fac.reset_estado_procesador()
    for ws_name in fac.listar_workspaces():
        arrancar_procesador(ws_name)
    return JSONResponse({"ok": True, "mensaje": "Procesador reseteado"})

@app.post("/api/facturas/upload")
async def fac_upload(files: list[UploadFile] = File(...), workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    fac.crear_carpetas_workspace(workspace)
    subidos, errores = [], []
    max_mb = int(_load_config().get("max_upload_mb", 75))
    max_bytes = max_mb * 1024 * 1024

    async def guardar_stream_upload(file: UploadFile, destino: Path):
        size = 0
        async with aiofiles.open(destino, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    await f.close()
                    destino.unlink(missing_ok=True)
                    raise HTTPException(413, f"Archivo demasiado grande (max {max_mb} MB)")
                await f.write(chunk)
        return size

    async def extraer_zip_a_cola(zip_path: Path, zip_nombre: str):
        extraidos = []
        total_unzip = 0
        max_unzip_bytes = max_bytes * 10
        try:
            with zipfile.ZipFile(zip_path) as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    nombre_interno = (info.filename or "").replace("\\", "/").split("/")[-1].strip()
                    if not nombre_interno or Path(nombre_interno).suffix.lower() not in FAC_EXT:
                        continue
                    if info.file_size > max_bytes:
                        errores.append({"file": f"{zip_nombre}/{nombre_interno}", "error": f"Archivo dentro del ZIP demasiado grande (max {max_mb} MB)"})
                        continue
                    total_unzip += info.file_size
                    if total_unzip > max_unzip_bytes:
                        errores.append({"file": zip_nombre, "error": f"ZIP demasiado grande al descomprimir (max {max_mb * 10} MB)"})
                        break
                    try:
                        nombre_extraido = _safe_upload_filename(nombre_interno)
                        destino_extraido = _unique_upload_path(paths["entrada"], nombre_extraido)
                        with zf.open(info) as src:
                            async with aiofiles.open(destino_extraido, "wb") as out:
                                while True:
                                    chunk = src.read(1024 * 1024)
                                    if not chunk:
                                        break
                                    await out.write(chunk)
                        extraidos.append({"file": destino_extraido.name, "size": info.file_size, "zip": zip_nombre})
                    except Exception as e:
                        errores.append({"file": f"{zip_nombre}/{nombre_interno}", "error": str(e)})
        except zipfile.BadZipFile:
            errores.append({"file": zip_nombre, "error": "ZIP no valido o danado"})
        except Exception as e:
            errores.append({"file": zip_nombre, "error": str(e)})
        return extraidos

    for file in files:
        try:
            nombre = _safe_upload_filename(file.filename)
        except HTTPException as e:
            errores.append({"file": file.filename, "error": e.detail}); continue
        ext = Path(nombre).suffix.lower()
        if ext not in UPLOAD_EXT:
            errores.append({"file": file.filename, "error": "Extensión no permitida"}); continue
        destino = _unique_upload_path(paths["entrada"], nombre) if ext in FAC_EXT else _safe_file_path(paths["entrada"], f"__upload_{_ts()}_{nombre}", require_ext=False)
        try:
            size = await guardar_stream_upload(file, destino)
            if ext == ".zip":
                extraidos = await extraer_zip_a_cola(destino, nombre)
                subidos.extend(extraidos)
                if not extraidos:
                    errores.append({"file": nombre, "error": "No se encontraron PDF o imagenes dentro del ZIP"})
                destino.unlink(missing_ok=True)
            else:
                subidos.append({"file": destino.name, "size": size})
        except HTTPException as e:
            errores.append({"file": file.filename, "error": e.detail})
        except Exception as e:
            errores.append({"file": file.filename, "error": str(e)})
    if subidos:
        arrancar_procesador(workspace)
    return JSONResponse({"subidos": subidos, "errores": errores, "total": len(subidos)})

@app.post("/api/facturas/upload-manual")
async def fac_upload_manual(files: list[UploadFile] = File(...), workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    fac.crear_carpetas_workspace(workspace)
    subidos, errores = [], []
    max_mb = int(_load_config().get("max_upload_mb", 75))
    max_bytes = max_mb * 1024 * 1024

    async def guardar_manual(file: UploadFile, destino: Path):
        size = 0
        async with aiofiles.open(destino, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    await f.close()
                    destino.unlink(missing_ok=True)
                    raise HTTPException(413, f"Archivo demasiado grande (max {max_mb} MB)")
                await f.write(chunk)
        return size

    for file in files:
        try:
            nombre = _safe_upload_filename(file.filename)
            ext = Path(nombre).suffix.lower()
            if ext not in FAC_EXT:
                errores.append({"file": file.filename, "error": "Solo PDF o imagen para factura manual"})
                continue
            destino = _unique_upload_path(paths["salida"], nombre)
            size = await guardar_manual(file, destino)
            fila = {
                "archivo_original": destino.name,
                "archivo_guardado": destino.name,
                "workspace": workspace,
                "numero_factura": "",
                "proveedor": "",
                "empresa_receptora": "",
                "nif_cif": "",
                "fecha_factura": "",
                "duracion_licencia": "",
                "base_imponible": "",
                "iva_porcentaje": "",
                "iva_importe": "",
                "irpf_porcentaje": "",
                "irpf_importe": "",
                "total_pagar": "",
                "moneda": "EUR",
                "concepto_mejorado": "",
                "conceptos_originales": "",
                "idioma_factura": "",
                "calidad_ocr": "Manual",
                "alertas": "Factura manual: sin OCR",
                "texto_ocr_bruto": "",
                "deducible": "",
                "estado": "Pendiente",
                "fecha_proceso": datetime.now().isoformat(),
            }
            fac.escribir_excel(fila, workspace)
            subidos.append({"file": destino.name, "size": size})
        except HTTPException as e:
            errores.append({"file": file.filename, "error": e.detail})
        except Exception as e:
            errores.append({"file": file.filename, "error": str(e)})
    return JSONResponse({"subidos": subidos, "errores": errores, "total": len(subidos)})

def _fila_factura_manual(nombre_archivo: str, workspace: str):
    return {
        "archivo_original": nombre_archivo,
        "archivo_guardado": nombre_archivo,
        "workspace": workspace,
        "numero_factura": "",
        "proveedor": "",
        "empresa_receptora": "",
        "nif_cif": "",
        "fecha_factura": "",
        "duracion_licencia": "",
        "base_imponible": "",
        "iva_porcentaje": "",
        "iva_importe": "",
        "irpf_porcentaje": "",
        "irpf_importe": "",
        "total_pagar": "",
        "moneda": "EUR",
        "concepto_mejorado": "",
        "conceptos_originales": "",
        "idioma_factura": "",
        "calidad_ocr": "Manual",
        "alertas": "Factura manual: desde errores",
        "texto_ocr_bruto": "",
        "deducible": "",
        "estado": "Pendiente",
        "fecha_proceso": datetime.now().isoformat(),
    }

@app.get("/api/facturas/queue")
def fac_queue(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    p = _listar(paths["entrada"], FAC_EXT)
    ws_ok = fac.validar_workspace(workspace)
    if p and not _pause_flags.get(ws_ok):
        arrancar_procesador(ws_ok)
    pr = _listar(paths["procesados"], FAC_EXT)
    er = _listar(paths["errores"], FAC_EXT)
    return JSONResponse({
        "pendientes": p, "procesados": pr, "errores": er,
        "total_pendientes": len(p), "total_procesados": len(pr), "total_errores": len(er),
        "paused": bool(_pause_flags.get(ws_ok)),
        "ultima_actualizacion": datetime.now().strftime("%H:%M:%S"),
    })

@app.delete("/api/facturas/cola/{nombre}")
def eliminar_de_cola(nombre: str, workspace: str = "default"):
    """Elimina un archivo de la carpeta de entrada (cola pendiente)."""
    paths = fac.get_workspace_paths(workspace)
    nombre_safe = _safe_filename(nombre)
    ruta = paths["entrada"] / nombre_safe
    if not ruta.exists():
        raise HTTPException(404, f"Archivo no encontrado en cola: {nombre_safe}")
    try:
        ruta.unlink()
        log.info(f"  Cola [{workspace}]: '{nombre_safe}' eliminado manualmente")
        return JSONResponse({"ok": True, "eliminado": nombre_safe})
    except Exception as e:
        raise HTTPException(500, f"Error al eliminar: {e}")

@app.get("/api/facturas/results")
def fac_results(workspace: str = "default"):
    cabeceras, filas = _leer_excel(workspace)
    if not filas: return JSONResponse({"resultados": [], "total": 0})
    paths = fac.get_workspace_paths(workspace)
    nombres_cola = _nombres_en_cola(paths)
    filas = [fila for fila in filas if not _fila_esta_en_cola(cabeceras, fila, nombres_cola)]
    resultados = [
        {cabeceras[i]: (str(v) if v is not None else "") for i, v in enumerate(fila) if i < len(cabeceras)}
        for fila in filas
    ]
    dups = fac.detectar_duplicados_excel(workspace)
    usados_entrenamiento = set()
    for guia in fac.leer_entrenamiento().values():
        for ej in guia.get("ejemplos_validados", []):
            if ej.get("archivo"):
                usados_entrenamiento.add(str(ej["archivo"]).strip())
        for arch in guia.get("archivos_usados_entrenamiento", []):
            if arch:
                usados_entrenamiento.add(str(arch).strip())
    for r in resultados:
        r["_duplicado"] = dups.get(r.get("archivo_guardado", ""), False)
        r["_entrenamiento_usado"] = bool(
            r.get("archivo_guardado", "") in usados_entrenamiento
            or r.get("archivo_original", "") in usados_entrenamiento
        )
        if fac.entrenamiento_activo() and r.get("proveedor"):
            key, guia = fac.buscar_entrenamiento_por_nombre_proveedor(r.get("proveedor", ""))
            if guia:
                r["_entrenamiento_guia"] = guia.get("proveedor_nombre") or key
                r["_entrenamiento_bloque"] = fac.construir_bloque_entrenamiento(guia)
    return JSONResponse({"resultados": resultados, "total": len(resultados)})

@app.get("/api/facturas/stats")
def fac_stats(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    def contar(c, excluir=None):
        excluir = excluir or set()
        return sum(1 for f in c.iterdir() if f.is_file() and f.suffix.lower() in FAC_EXT and f.name.casefold() not in excluir) if c.exists() else 0
    total = 0
    try:
        cabeceras, filas = _leer_excel(workspace)
        nombres_cola = _nombres_en_cola(paths)
        total = sum(1 for fila in filas if not _fila_esta_en_cola(cabeceras, fila, nombres_cola))
    except Exception as e:
        log.error(f"Error calculando stats [{workspace}]: {e}")
    regeneradas_en_eliminados = _regeneraciones_en_eliminados(paths)
    eliminadas = contar(paths["eliminados"], regeneradas_en_eliminados)
    return JSONResponse({
        "procesadas_hoy": contar(paths["procesados"]),
        "en_cola": contar(paths["entrada"]),
        "en_errores": contar(paths["errores"]),
        "eliminadas": eliminadas,
        "regeneradas_en_eliminados": len(regeneradas_en_eliminados),
        "total_en_excel": total,
        "total_procesadas": total,
    })

@app.get("/api/facturas/preview/{archivo}")
def fac_preview(archivo: str, workspace: str = "default", pagina: int = 0):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    for carpeta in [paths["salida"], paths["procesados"], paths["errores"], paths["entrada"], paths["eliminados"]]:
        ruta = _safe_file_path(carpeta, arch)
        if ruta.exists():
            ext = ruta.suffix.lower()
            if ext == ".pdf":
                img = fac.pdf_a_png(ruta, max(0, pagina))
                if img: return StreamingResponse(io.BytesIO(img), media_type="image/png")
                return FileResponse(str(ruta), media_type="application/pdf")
            tipos = {".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".bmp":"image/bmp"}
            return FileResponse(str(ruta), media_type=tipos.get(ext,"image/png"))
    raise HTTPException(404, f"'{archivo}' no encontrado")

@app.get("/api/facturas/pages/{archivo}")
def fac_pages(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    for carpeta in [paths["salida"], paths["procesados"], paths["errores"], paths["entrada"], paths["eliminados"]]:
        ruta = _safe_file_path(carpeta, arch)
        if ruta.exists():
            return JSONResponse({"paginas": fac.pdf_num_paginas(ruta) if ruta.suffix.lower() == ".pdf" else 1})
    raise HTTPException(404, f"'{archivo}' no encontrado")

@app.get("/api/facturas/ocr/{archivo}")
def fac_ocr(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    ocr_path = paths["ocr"] / fac.nombre_ocr_para_archivo(arch)
    if ocr_path.exists():
        return JSONResponse({"texto": ocr_path.read_text(encoding="utf-8", errors="replace"), "completo": True})
    cabeceras, filas = _leer_excel(workspace)
    i_guard = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    i_orig = next((i for i, c in enumerate(cabeceras) if c == "archivo_original"), -1)
    i_ocr = next((i for i, c in enumerate(cabeceras) if c == "texto_ocr_bruto"), -1)
    for fila in filas:
        orig = str(fila[i_orig] or "") if i_orig >= 0 and i_orig < len(fila) else ""
        guard = str(fila[i_guard] or "") if i_guard >= 0 and i_guard < len(fila) else ""
        if arch in (orig, guard):
            texto = str(fila[i_ocr] or "") if i_ocr >= 0 and i_ocr < len(fila) else ""
            return JSONResponse({"texto": texto, "completo": False})
    raise HTTPException(404, f"OCR de '{archivo}' no encontrado")

@app.get("/api/facturas/gallery")
def fac_gallery(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    if not paths["salida"].exists(): return JSONResponse({"imagenes": []})
    cabeceras, filas = _leer_excel(workspace)
    dups = fac.detectar_duplicados_excel(workspace)
    i_guard = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    i_estado = next((i for i, c in enumerate(cabeceras) if c == "estado"), -1)
    i_deducible = next((i for i, c in enumerate(cabeceras) if c == "deducible"), -1)
    en_excel = set()
    estados = {}
    deducibles = {}
    if i_guard >= 0:
        for fila in filas:
            if i_guard < len(fila) and fila[i_guard]:
                nombre = str(fila[i_guard]).strip()
                en_excel.add(nombre)
                estados[nombre] = str(fila[i_estado] or "").strip() if i_estado >= 0 and i_estado < len(fila) else ""
                deducibles[nombre] = str(fila[i_deducible] or "").strip() if i_deducible >= 0 and i_deducible < len(fila) else ""
    imagenes = []
    for f in sorted(paths["salida"].iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in FAC_EXT and f.name in en_excel:
            imagenes.append({
                "nombre": f.name, "tamaño": f.stat().st_size,
                "fecha": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d/%m/%Y %H:%M"),
                "es_pdf": f.suffix.lower() == ".pdf",
                "estado": estados.get(f.name, ""),
                "deducible": deducibles.get(f.name, ""),
                "duplicado": bool(dups.get(f.name, False)),
            })
    return JSONResponse({"imagenes": imagenes, "total": len(imagenes)})

@app.get("/api/facturas/eliminados")
def fac_eliminados(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    if not paths["eliminados"].exists(): return JSONResponse({"eliminados": []})
    eliminados = []
    for f in sorted(paths["eliminados"].iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in FAC_EXT:
            eliminados.append({
                "nombre": f.name, "tamaño": f.stat().st_size,
                "fecha": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d/%m/%Y %H:%M"),
            })
    return JSONResponse({"eliminados": eliminados})

@app.get("/api/facturas/errores")
def fac_errores(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    if not paths["errores"].exists(): return JSONResponse({"errores": []})
    errores = []
    for f in sorted(paths["errores"].iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix.lower() in FAC_EXT:
            errores.append({
                "nombre": f.name, "tamaÃ±o": f.stat().st_size,
                "fecha": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d/%m/%Y %H:%M"),
            })
    return JSONResponse({"errores": errores})

@app.get("/api/facturas/errores/{archivo}/download")
def fac_dl_error(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    ruta = _safe_file_path(paths["errores"], arch)
    if not ruta.exists(): raise HTTPException(404, f"'{arch}' no encontrado")
    return FileResponse(str(ruta), filename=ruta.name)

@app.post("/api/facturas/errores/{archivo}/recuperar")
async def fac_recuperar_error(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    origen = _safe_file_path(paths["errores"], arch)
    if not origen.exists(): raise HTTPException(404, f"'{arch}' no encontrado")
    destino = _safe_file_path(paths["entrada"], arch)
    if destino.exists(): destino = _safe_file_path(paths["entrada"], f"{Path(arch).stem}_{_ts()}{Path(arch).suffix}")
    shutil.move(str(origen), str(destino))
    return JSONResponse({"ok": True, "mensaje": f"{arch} vuelve a la cola"})

@app.post("/api/facturas/errores/{archivo}/manual")
async def fac_error_a_manual(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    origen = _safe_file_path(paths["errores"], arch)
    if not origen.exists():
        raise HTTPException(404, f"'{arch}' no encontrado")
    destino = _safe_file_path(paths["salida"], arch)
    if destino.exists():
        destino = _safe_file_path(paths["salida"], f"{Path(arch).stem}_{_ts()}{Path(arch).suffix}")
    shutil.move(str(origen), str(destino))
    fac.escribir_excel(_fila_factura_manual(destino.name, workspace), workspace)
    return JSONResponse({"ok": True, "archivo": destino.name, "mensaje": f"{destino.name} listo para editar manualmente"})

@app.post("/api/facturas/errores/recuperar-todos")
async def fac_recuperar_todos_errores(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    recuperados = []
    if paths["errores"].exists():
        for origen in sorted(paths["errores"].iterdir()):
            if not origen.is_file() or origen.suffix.lower() not in FAC_EXT:
                continue
            destino = _safe_file_path(paths["entrada"], origen.name)
            if destino.exists():
                destino = _safe_file_path(paths["entrada"], f"{origen.stem}_{_ts()}{origen.suffix}")
            shutil.move(str(origen), str(destino))
            recuperados.append(destino.name)
    return JSONResponse({"ok": True, "total": len(recuperados), "recuperados": recuperados})

@app.get("/api/facturas/eliminados/{archivo}/download")
def fac_dl_eliminado(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    ruta = _safe_file_path(paths["eliminados"], arch)
    if not ruta.exists(): raise HTTPException(404, f"'{arch}' no encontrado")
    return FileResponse(str(ruta), filename=ruta.name)

@app.post("/api/facturas/eliminados/{archivo}/recuperar")
async def fac_recuperar(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    origen = _safe_file_path(paths["eliminados"], arch)
    if not origen.exists(): raise HTTPException(404, f"'{arch}' no encontrado")
    destino = _safe_file_path(paths["entrada"], arch)
    if destino.exists(): destino = _safe_file_path(paths["entrada"], f"{Path(arch).stem}_{_ts()}{Path(arch).suffix}")
    shutil.move(str(origen), str(destino))
    return JSONResponse({"ok": True, "mensaje": f"{arch} vuelve a la cola"})

@app.get("/api/facturas/download/excel")
def fac_dl_excel(workspace: str = "default"):
    if not fac._get_excel_path(workspace).exists(): raise HTTPException(404, "Excel no existe")
    try:
        cabeceras, filas = _leer_excel(workspace)
        if not cabeceras:
            raise HTTPException(404, "Excel vacío")
        wb = openpyxl.Workbook()
        ws_sheet = wb.active
        ws_sheet.title = "Facturas"
        cabeceras_export, filas_export = fac.preparar_filas_excel_descarga(cabeceras, filas)
        ws_sheet.append(cabeceras_export)
        i_estado = fac._idx(cabeceras_export, "estado")
        i_deducible = fac._idx(cabeceras_export, "deducible")
        for fila in filas_export:
            ws_sheet.append([fac._valor_excel(cabeceras_export[i], fila[i] if i < len(fila) else "") for i in range(len(cabeceras_export))])
            row = ws_sheet[ws_sheet.max_row]
            estado = fila[i_estado] if i_estado >= 0 and i_estado < len(fila) else ""
            deducible = fila[i_deducible] if i_deducible >= 0 and i_deducible < len(fila) else ""
            fac._aplicar_estilo_fila_estado(row, estado, deducible)
        fac._aplicar_formato_excel(ws_sheet)
        fac._actualizar_resumen_proveedores(wb)
        fac._actualizar_resumen_anexo(wb)
        buf = io.BytesIO()
        wb.save(buf)
        wb.close()
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="facturas_{workspace}.xlsx"'},
        )
    except Exception as e:
        log.error(f"No se pudo generar Excel de descarga: {e}")
        raise HTTPException(500, f"No se pudo generar Excel: {e}")

@app.get("/api/facturas/download/zip")
def fac_dl_zip(workspace: str = "default"):
    paths = fac.get_workspace_paths(workspace)
    cabeceras, filas = _leer_excel(workspace)
    i_guard = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    nombres_excel = []
    if i_guard >= 0:
        for fila in filas:
            if i_guard < len(fila) and fila[i_guard]:
                nombres_excel.append(str(fila[i_guard]).strip())
    archivos = []
    filas_por_nombre = {}
    if i_guard >= 0:
        for fila in filas:
            nombre = str(fila[i_guard]).strip() if i_guard < len(fila) and fila[i_guard] else ""
            if nombre and nombre not in filas_por_nombre:
                filas_por_nombre[nombre] = fila
    for nombre in dict.fromkeys(nombres_excel):
        try:
            ruta = _safe_file_path(paths["salida"], nombre)
        except HTTPException:
            continue
        if ruta.exists() and ruta.is_file() and ruta.suffix.lower() in FAC_EXT:
            fila = filas_por_nombre.get(nombre)
            nombre_zip = _nombre_descarga_factura(cabeceras, fila, nombre) if fila else nombre
            archivos.append((ruta, nombre_zip))
    if not archivos: raise HTTPException(404, "No hay archivos")
    buf = io.BytesIO()
    usados = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f, nombre_zip in archivos:
            zf.write(f, _zip_unique_name(usados, nombre_zip))
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=facturas_{workspace}_{datetime.now().strftime('%Y%m%d')}.zip"})

@app.get("/api/facturas/download/{archivo}")
def fac_dl_archivo(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    for carpeta in [paths["salida"], paths["procesados"], paths["entrada"]]:
        ruta = _safe_file_path(carpeta, arch)
        if ruta.exists() and ruta.is_file() and ruta.suffix.lower() in FAC_EXT:
            return FileResponse(str(ruta), filename=ruta.name)
    raise HTTPException(404, f"'{arch}' no encontrado")

@app.post("/api/facturas/download/cifra")
async def fac_dl_cifra(datos: dict, workspace: str = "default"):
    archivos_sel = datos.get("archivos", [])
    if not archivos_sel: raise HTTPException(400, "Sin archivos")
    cabeceras, filas = _leer_excel(workspace)
    idx_arch = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    dups = fac.detectar_duplicados_excel(workspace)
    rows_sel = [
        (fila, dups.get(str(fila[idx_arch]).strip() if idx_arch >= 0 and idx_arch < len(fila) else "", False))
        for fila in filas
        if idx_arch >= 0 and idx_arch < len(fila) and str(fila[idx_arch]).strip() in archivos_sel
    ]
    filas_por_nombre = {
        str(fila[idx_arch]).strip(): fila
        for fila, _ in rows_sel
        if idx_arch >= 0 and idx_arch < len(fila) and fila[idx_arch]
    }
    wb_new = openpyxl.Workbook(); ws_new = wb_new.active; ws_new.title = f"Archivos {workspace}"
    if cabeceras:
        ws_new.append(cabeceras)
    for fila, es_dup in rows_sel:
        ws_new.append([fac._valor_excel(cabeceras[i], fila[i] if i < len(fila) else "") for i in range(len(cabeceras))])
        if es_dup:
            try:
                from openpyxl.styles import PatternFill as PF2
                for cell in ws_new[ws_new.max_row]: cell.fill = PF2("solid", fgColor="FFCCCC")
            except: pass
    try:
        fac._aplicar_formato_excel(ws_new)
    except Exception:
        pass
    excel_buf = io.BytesIO(); wb_new.save(excel_buf); excel_buf.seek(0)
    paths = fac.get_workspace_paths(workspace)
    buf = io.BytesIO()
    usados = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"archivos_{workspace}.xlsx", excel_buf.read())
        for nombre in archivos_sel:
            ruta = _safe_file_path(paths["salida"], nombre)
            if ruta.exists():
                fila = filas_por_nombre.get(str(nombre).strip())
                nombre_zip = _nombre_descarga_factura(cabeceras, fila, nombre) if fila else nombre
                zf.write(ruta, _zip_unique_name(usados, nombre_zip))
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=archivos_{workspace}.zip"})

@app.post("/api/facturas/download/cifra-proveedor")
async def fac_dl_cifra_proveedor(datos: dict, workspace: str = "default"):
    archivos_sel = datos.get("archivos", [])
    if not archivos_sel: raise HTTPException(400, "Sin archivos")
    seleccion = {str(a).strip() for a in archivos_sel if str(a or "").strip()}
    cabeceras, filas = _leer_excel(workspace)
    idx_arch = next((i for i, c in enumerate(cabeceras) if c == "archivo_guardado"), -1)
    idx_prov = next((i for i, c in enumerate(cabeceras) if c == "proveedor"), -1)
    idx_ded = next((i for i, c in enumerate(cabeceras) if c == "deducible"), -1)
    idx_estado = next((i for i, c in enumerate(cabeceras) if c == "estado"), -1)
    dups = fac.detectar_duplicados_excel(workspace)
    rows_sel = []
    for fila in filas:
        nombre = str(fila[idx_arch]).strip() if idx_arch >= 0 and idx_arch < len(fila) and fila[idx_arch] else ""
        if nombre in seleccion:
            rows_sel.append((fila, dups.get(nombre, False)))

    wb_new = openpyxl.Workbook(); ws_new = wb_new.active; ws_new.title = f"Archivos {workspace}"
    if cabeceras:
        ws_new.append(cabeceras)
    for fila, es_dup in rows_sel:
        ws_new.append([fac._valor_excel(cabeceras[i], fila[i] if i < len(fila) else "") for i in range(len(cabeceras))])
        if es_dup:
            try:
                from openpyxl.styles import PatternFill as PF2
                for cell in ws_new[ws_new.max_row]: cell.fill = PF2("solid", fgColor="FFCCCC")
            except: pass
    try:
        fac._aplicar_formato_excel(ws_new)
    except Exception:
        pass
    excel_buf = io.BytesIO(); wb_new.save(excel_buf); excel_buf.seek(0)

    paths = fac.get_workspace_paths(workspace)
    buf = io.BytesIO()
    usados = set()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"archivos_{workspace}.xlsx", excel_buf.read())
        for fila, _es_dup in rows_sel:
            nombre = str(fila[idx_arch]).strip() if idx_arch >= 0 and idx_arch < len(fila) and fila[idx_arch] else ""
            if not nombre:
                continue
            ruta = _safe_file_path(paths["salida"], nombre)
            if not ruta.exists() or not ruta.is_file():
                continue
            estado = str(fila[idx_estado] or "").strip().lower() if idx_estado >= 0 and idx_estado < len(fila) else ""
            deducible = str(fila[idx_ded] or "").strip().lower() if idx_ded >= 0 and idx_ded < len(fila) else ""
            if estado == "validada" and deducible == "no":
                carpeta = "No deducibles"
            else:
                proveedor = str(fila[idx_prov] or "").strip() if idx_prov >= 0 and idx_prov < len(fila) else ""
                carpeta = _zip_safe_part(proveedor)
            nombre_zip = _nombre_descarga_factura(cabeceras, fila, nombre)
            arcname = _zip_unique_name(usados, f"{carpeta}/{nombre_zip}")
            zf.write(ruta, arcname)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=archivos_por_proveedor_{workspace}.zip"})

@app.post("/api/facturas/results/{archivo}/accept")
async def fac_accept(archivo: str, datos: dict, workspace: str = "default"):
    arch = _require_arch(archivo)
    datos.pop("archivo_guardado_nuevo", None)
    nombre_actual = datos.pop("archivo_guardado_actual", None)
    paths = fac.get_workspace_paths(workspace)
    fila_actual = _fila_resultado_por_archivo(arch, workspace)
    if not nombre_actual:
        nombre_actual = fila_actual.get("archivo_guardado") or arch
    estado = str(datos.get("estado") or "Validada").strip()
    deducible = str(datos.get("deducible") or "").strip()
    if estado != "Validada":
        estado = "Pendiente"
        deducible = ""
    elif deducible.lower() == "no":
        deducible = "No"
    else:
        deducible = "Si"
    datos["estado"] = estado
    datos["deducible"] = deducible
    if datos["estado"] == "Pendiente":
        datos["deducible"] = ""
    datos.update(_auto_fx_campos({**fila_actual, **datos}))
    nombre_nuevo = None
    if datos["estado"] == "Validada":
        datos_nombre = {**fila_actual, **datos}
        generado = _nombre_automatico_validado(datos_nombre, nombre_actual)
        if generado:
            nombre_nuevo = _renombrar_archivo_salida(paths, nombre_actual, generado)
    fac.actualizar_fila_excel(arch, datos, archivo_guardado_nuevo=nombre_nuevo, workspace=workspace)
    return JSONResponse({"ok": True, "archivo_guardado": nombre_nuevo or nombre_actual})

@app.post("/api/facturas/results/{archivo}/fx")
async def fac_update_fx(archivo: str, datos: dict, workspace: str = "default"):
    arch = _require_arch(archivo)
    campos = {k: datos.get(k, "") for k in ["base_eur", "total_eur", "tipo_cambio", "fecha_tipo_cambio", "fuente_tipo_cambio"]}
    fac.actualizar_fila_excel(arch, campos, workspace=workspace)
    return JSONResponse({"ok": True})

@app.delete("/api/facturas/results/{archivo}")
def fac_delete(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    archivo_guardado = fac.eliminar_fila_excel(arch, workspace)
    if archivo_guardado:
        ruta = _safe_file_path(paths["salida"], archivo_guardado)
        if ruta.exists():
            paths["eliminados"].mkdir(parents=True, exist_ok=True)
            destino = _safe_file_path(paths["eliminados"], archivo_guardado)
            if destino.exists():
                destino = _safe_file_path(paths["eliminados"], f"{Path(archivo_guardado).stem}_{_ts()}{Path(archivo_guardado).suffix}")
            try: shutil.move(str(ruta), str(destino))
            except Exception as e: log.error(f"Error moviendo: {e}")
    return JSONResponse({"ok": True, "movido_a_eliminados": True})

@app.post("/api/facturas/results/{archivo}/discard")
async def fac_discard(archivo: str, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    cabeceras, filas = fac._leer_todas_las_filas(workspace)
    i_orig = fac._idx(cabeceras, "archivo_original")
    i_guard = fac._idx(cabeceras, "archivo_guardado")
    archivo_guardado = ""
    for fila in filas:
        if i_orig >= 0 and i_orig < len(fila) and fila[i_orig] == arch:
            if i_guard >= 0 and i_guard < len(fila): archivo_guardado = str(fila[i_guard] or "")
            break
    if archivo_guardado:
        archivo_guardado = _safe_filename(archivo_guardado)
        ruta_sal = _safe_file_path(paths["salida"], archivo_guardado)
        if ruta_sal.exists():
            paths["eliminados"].mkdir(parents=True, exist_ok=True)
            dest = _safe_file_path(paths["eliminados"], archivo_guardado)
            if dest.exists(): dest = _safe_file_path(paths["eliminados"], f"{Path(archivo_guardado).stem}_{_ts()}{Path(archivo_guardado).suffix}")
            try: shutil.move(str(ruta_sal), str(dest))
            except Exception as e: log.error(f"Error descartando archivo de salida: {e}")
    for carpeta in [paths["procesados"], paths["entrada"]]:
        origen = _safe_file_path(carpeta, arch)
        if origen.exists():
            dest = _safe_file_path(paths["errores"], arch)
            if dest.exists(): dest = _safe_file_path(paths["errores"], f"{Path(arch).stem}_{_ts()}{Path(arch).suffix}")
            shutil.move(str(origen), str(dest)); break
    fac.actualizar_fila_excel(arch, {"estado": "Descartada"}, workspace=workspace)
    return JSONResponse({"ok": True})

@app.post("/api/facturas/results/{archivo}/regenerar")
async def fac_regenerar(archivo: str, datos: dict, workspace: str = "default"):
    arch = _require_arch(archivo)
    paths = fac.get_workspace_paths(workspace)
    cabeceras, filas = fac._leer_todas_las_filas(workspace)
    i_orig = fac._idx(cabeceras, "archivo_original")
    i_guard = fac._idx(cabeceras, "archivo_guardado")
    archivo_original = _safe_filename(datos.get("archivo_original", arch))
    archivo_guardado = ""
    fila_backup = None

    for fila in filas:
        orig = str(fila[i_orig] or "") if i_orig >= 0 and i_orig < len(fila) else ""
        guard = str(fila[i_guard] or "") if i_guard >= 0 and i_guard < len(fila) else ""
        if arch in (orig, guard) or archivo_original in (orig, guard):
            archivo_original = _safe_filename(orig or archivo_original)
            archivo_guardado = _safe_filename(guard) if guard else ""
            fila_backup = {cabeceras[i]: (str(v) if v is not None else "") for i, v in enumerate(fila) if i < len(cabeceras)}
            break

    en_entrada = _safe_file_path(paths["entrada"], archivo_original)
    ya_en_cola = en_entrada.exists()
    movido = False
    if not ya_en_cola:
        origen = _safe_file_path(paths["procesados"], archivo_original)
        if origen.exists():
            dest = en_entrada
            if dest.exists():
                dest = _safe_file_path(paths["entrada"], f"{Path(archivo_original).stem}_{_ts()}{Path(archivo_original).suffix}")
            shutil.move(str(origen), str(dest))
            movido = True

    if archivo_guardado:
        ruta_sal = _safe_file_path(paths["salida"], archivo_guardado)
        if ruta_sal.exists() and not movido and not ya_en_cola:
            dest = en_entrada
            if dest.exists():
                dest = _safe_file_path(paths["entrada"], f"{Path(archivo_original).stem}_{_ts()}{Path(archivo_original).suffix}")
            shutil.move(str(ruta_sal), str(dest))
            movido = True
        if ruta_sal.exists():
            backup_dir = paths["salida"] / "_regeneracion_backups"
            backup_dir.mkdir(parents=True, exist_ok=True)
            dest = _safe_file_path(backup_dir, archivo_guardado)
            if dest.exists():
                dest = _safe_file_path(backup_dir, f"{Path(archivo_guardado).stem}_{_ts()}{Path(archivo_guardado).suffix}")
            shutil.move(str(ruta_sal), str(dest))
        ocr_path = paths["ocr"] / fac.nombre_ocr_para_archivo(archivo_guardado)
        if ocr_path.exists():
            ocr_path.unlink()

    if movido or ya_en_cola:
        if fila_backup:
            try:
                backup_dir = paths["salida"] / "_regeneracion_backups"
                backup_dir.mkdir(parents=True, exist_ok=True)
                backup_file = backup_dir / f"{Path(archivo_original).stem}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                backup_file.write_text(json.dumps(fila_backup, ensure_ascii=False, indent=2), encoding="utf-8")
            except Exception as e:
                log.warning(f"No se pudo guardar backup de regeneracion: {e}")
        fac.eliminar_fila_excel(archivo_original, workspace)
        if arch != archivo_original:
            fac.eliminar_fila_excel(arch, workspace)
        msg = "Ya estaba en cola" if ya_en_cola else f"{archivo_original} vuelve a la cola"
        return JSONResponse({"ok": True, "mensaje": msg})
    return JSONResponse({"ok": False, "mensaje": "No encontrado"})

@app.post("/api/facturas/corregir-formatos")
def fac_corregir(workspace: str = "default"):
    return JSONResponse(fac.corregir_formatos_excel(workspace))


# ═══════════════════════════════════════════════════════════════════
# ENTRENAMIENTO
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/prompts")
def get_prompts():
    """Devuelve los prompts activos (custom si existen, default si no) y los defaults."""
    return JSONResponse({
        "defaults": fac.PROMPTS_DEFAULT,
        "custom":   fac.leer_prompts_custom(),
        "activos":  {k: fac.get_prompt(k) for k in fac.PROMPTS_DEFAULT},
    })

@app.post("/api/prompts/{nombre}")
async def save_prompt(nombre: str, datos: dict):
    """Guarda o restaura un prompt. Si texto==default o vacío, restaura el original."""
    if nombre not in fac.PROMPTS_DEFAULT:
        raise HTTPException(400, f"Prompt desconocido: '{nombre}'. Válidos: {list(fac.PROMPTS_DEFAULT)}")
    texto = datos.get("texto", "")
    fac.guardar_prompt_custom(nombre, texto)
    activo = fac.get_prompt(nombre)
    es_custom = bool(fac.leer_prompts_custom().get(nombre))
    return JSONResponse({"ok": True, "nombre": nombre, "es_custom": es_custom, "activo": activo})

@app.get("/api/entrenamiento")
def get_entrenamiento():
    """Lista todas las guías de entrenamiento guardadas."""
    guias = fac.leer_entrenamiento()
    for guia in guias.values():
        guia["_bloque_influencia"] = fac.construir_bloque_entrenamiento(guia)
    return JSONResponse({
        "activo": fac.entrenamiento_activo(),
        "guias": guias,
    })

@app.post("/api/entrenamiento/toggle")
async def toggle_entrenamiento(datos: dict):
    """Activa o desactiva el sistema de entrenamiento."""
    activo = datos.get("activo", False)
    try:
        p = CFG_PATH
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        cfg["entrenamiento_activo"] = activo
        p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        return JSONResponse({"ok": True, "activo": activo})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.post("/api/entrenamiento/generar-guia")
async def generar_guia(datos: dict):
    """
    Genera una guía estructural a partir de un ejemplo validado.
    Recibe: texto_ocr + campos_validados. Devuelve la guía sin guardarla aún.
    """
    texto_ocr = datos.get("texto_ocr", "")
    campos = datos.get("campos_validados", {})
    if not texto_ocr or not campos:
        raise HTTPException(400, "Faltan texto_ocr o campos_validados")
    try:
        guia = fac.generar_guia_desde_ejemplo(texto_ocr, campos)
        return JSONResponse({"ok": True, "guia": guia})
    except Exception as e:
        raise HTTPException(500, f"Error generando guía: {e}")

@app.post("/api/entrenamiento/guardar")
async def guardar_guia(datos: dict):
    """Guarda una guía de entrenamiento para un proveedor."""
    proveedor = datos.get("proveedor", "").strip()
    guia = datos.get("guia", {})
    if not proveedor or not guia:
        raise HTTPException(400, "Faltan proveedor o guia")
    try:
        fac.guardar_entrenamiento(proveedor, guia)
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.delete("/api/entrenamiento/{proveedor}")
def eliminar_guia(proveedor: str):
    """Elimina la guía de entrenamiento de un proveedor."""
    try:
        fac.eliminar_entrenamiento(proveedor)
        return JSONResponse({"ok": True})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.post("/api/entrenamiento/procesar-ejemplo")
async def procesar_ejemplo_entrenamiento(files: list[UploadFile] = File(...)):
    """
    Procesa una factura de ejemplo para entrenamiento.
    Hace OCR + LLM completo (igual que el procesado normal) pero sin guardar en Excel
    ni mover archivos. Devuelve todos los campos extraídos + imagen preview en base64.
    El usuario revisa/corrige y luego guarda como guía.
    """
    if not files:
        raise HTTPException(400, "Sin archivo")
    file = files[0]
    nombre = _safe_filename(file.filename)
    ext = Path(nombre).suffix.lower()
    if ext not in FAC_EXT:
        raise HTTPException(400, "Extensión no permitida")
    try:
        import base64
        contenido = await file.read()
        tmp_path = _base_dir() / f"_tmp_entrenamiento{ext}"
        tmp_path.write_bytes(contenido)

        empresa_receptora = fac.leer_empresa_receptora()
        texto_bruto = ""
        imagenes_bytes = []
        imagen_b64 = ""

        # Paso 1: extraer texto e imágenes
        if ext == ".pdf":
            texto_bruto, imagenes_bytes, _ = fac.extraer_texto_pdf_multipagina(tmp_path)
        else:
            imagenes_bytes = [fac.extraer_imagen(tmp_path)]

        # Paso 2: generar preview imagen (siempre, independiente del OCR)
        if imagenes_bytes:
            try:
                from PIL import Image as PILImage
                img = PILImage.open(io.BytesIO(imagenes_bytes[0]))
                img.thumbnail((700, 900), PILImage.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                imagen_b64 = base64.b64encode(buf.getvalue()).decode()
            except Exception as ex:
                log.warning(f"Preview PIL falló ({ex}), usando imagen cruda")
                try:
                    # Fallback: devolver la imagen tal cual si es PNG/JPG
                    raw = imagenes_bytes[0]
                    imagen_b64 = base64.b64encode(raw).decode()
                except Exception as ex2:
                    log.warning(f"Preview fallback también falló: {ex2}")

        # Paso 3: OCR si no hay texto nativo o si el PDF mezcla texto e imagen
        datos_extraidos = {}
        if fac.usar_vision_unico_paso() and (imagenes_bytes or not texto_bruto) and not (texto_bruto and len(texto_bruto) >= fac.min_chars_pdf()):
            if not (texto_bruto and len(texto_bruto) >= fac.min_chars_pdf()):
                with fac.ollama_lock:
                    datos_vision, raw_vision = fac.procesar_con_vision_unico_paso(
                        imagenes_bytes, empresa_receptora, nombre
                    )
                    texto_bruto = raw_vision or ""
                    fac.liberar_modelos()
                importes_pre = fac.preextraer_importes(texto_bruto)
                iva_pct_pre = fac.detectar_iva_porcentaje(texto_bruto)
                datos_extraidos = fac.postprocesar(datos_vision, {}, texto_bruto, empresa_receptora, nombre, importes_pre, iva_pct_pre)
        else:
            # Modo clásico: OCR + doble LLM
            with fac.ollama_lock:
                if imagenes_bytes:
                    if len(imagenes_bytes) == 1:
                        texto_ocr = fac.llamar_ocr_imagen(imagenes_bytes[0])
                    else:
                        texto_ocr = fac.llamar_ocr_multipagina(imagenes_bytes)
                    texto_bruto = fac.combinar_texto_nativo_y_ocr(texto_bruto, texto_ocr)

                if texto_bruto.strip():
                    importes_pre = fac.preextraer_importes(texto_bruto)
                    total_pre_txt, total_pre_num = fac.extraer_total_del_texto(texto_bruto)
                    base_pre_txt, base_pre_num = fac.extraer_base_del_texto(texto_bruto)
                    iva_pct = fac.detectar_iva_porcentaje(texto_bruto)
                    _, plantilla = fac.detectar_plantilla(texto_bruto, nombre)

                    datos_importes = fac.llamar_llama_importes(
                        texto_bruto, importes_pre, total_pre_txt, base_pre_txt, iva_pct
                    )
                    datos_campos = fac.llamar_llama_campos(
                        texto_bruto, empresa_receptora, nombre, plantilla
                    )
                    fac.liberar_modelos()

                    datos_extraidos = fac.postprocesar(
                        datos_importes, datos_campos, texto_bruto,
                        empresa_receptora, nombre, importes_pre, iva_pct
                    )

        tmp_path.unlink(missing_ok=True)

        # Moneda e idioma de fallback
        if not datos_extraidos.get("moneda"):
            datos_extraidos["moneda"] = fac.detectar_moneda(texto_bruto)
        idioma = fac.detectar_idioma(texto_bruto)

        return JSONResponse({
            "ok": True,
            "texto_ocr": texto_bruto,
            "imagen_b64": imagen_b64,
            "campos": {
                "proveedor":         datos_extraidos.get("proveedor", ""),
                "nif_cif":           datos_extraidos.get("nif_cif", ""),
                "numero_factura":    datos_extraidos.get("numero_factura", ""),
                "fecha_factura":     datos_extraidos.get("fecha_factura", ""),
                "base_imponible":    datos_extraidos.get("base_imponible", ""),
                "iva_porcentaje":    datos_extraidos.get("iva_porcentaje", ""),
                "iva_importe":       datos_extraidos.get("iva_importe", ""),
                "irpf_porcentaje":   datos_extraidos.get("irpf_porcentaje", ""),
                "irpf_importe":      datos_extraidos.get("irpf_importe", ""),
                "total_pagar":       datos_extraidos.get("total_pagar", ""),
                "moneda":            datos_extraidos.get("moneda", "EUR"),
                "concepto_mejorado": datos_extraidos.get("concepto_mejorado", ""),
                "conceptos_originales": datos_extraidos.get("conceptos_originales", ""),
                "idioma_factura":    idioma,
                "duracion_licencia": datos_extraidos.get("duracion_licencia", ""),
            }
        })
    except Exception as e:
        log.error(f"Error procesando ejemplo entrenamiento: {e}")
        raise HTTPException(500, f"Error procesando ejemplo: {e}")

@app.post("/api/entrenamiento/añadir-ejemplo")
async def añadir_ejemplo_entrenamiento(files: list[UploadFile] = File(...), proveedor: str = ""):
    """
    Añade una factura adicional como ejemplo validado.
    Hace OCR + LLM completo y guarda el ejemplo sin tocar la guía existente.
    """
    if not files:
        raise HTTPException(400, "Sin archivo")
    if not proveedor.strip():
        raise HTTPException(400, "Falta el proveedor")
    file = files[0]
    nombre = _safe_filename(file.filename)
    ext = Path(nombre).suffix.lower()
    if ext not in FAC_EXT:
        raise HTTPException(400, "Extensión no permitida")
    try:
        contenido = await file.read()
        tmp_path = _base_dir() / f"_tmp_ejemplo{ext}"
        tmp_path.write_bytes(contenido)
        empresa_receptora = fac.leer_empresa_receptora()
        texto = ""
        imagenes = []
        imagen_b64 = ""

        if ext == ".pdf":
            texto, imagenes, _ = fac.extraer_texto_pdf_multipagina(tmp_path)
        else:
            imagenes = [fac.extraer_imagen(tmp_path)]

        if imagenes:
            try:
                import base64
                from PIL import Image as PILImage
                img = PILImage.open(io.BytesIO(imagenes[0]))
                img.thumbnail((700, 900), PILImage.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                imagen_b64 = base64.b64encode(buf.getvalue()).decode()
            except Exception as ex:
                log.warning(f"Preview ejemplo entrenamiento fallo: {ex}")

        datos_extraidos = {}
        if fac.usar_vision_unico_paso() and (imagenes or not texto) and not (texto and len(texto) >= fac.min_chars_pdf()):
            if not (texto and len(texto) >= fac.min_chars_pdf()):
                with fac.ollama_lock:
                    datos_vision, raw_vision = fac.procesar_con_vision_unico_paso(imagenes, empresa_receptora, nombre)
                    texto = raw_vision or ""
                    fac.liberar_modelos()
                importes_pre = fac.preextraer_importes(texto)
                iva_pct_pre = fac.detectar_iva_porcentaje(texto)
                datos_extraidos = fac.postprocesar(datos_vision, {}, texto, empresa_receptora, nombre, importes_pre, iva_pct_pre)
        else:
            with fac.ollama_lock:
                if imagenes:
                    texto_ocr = fac.llamar_ocr_imagen(imagenes[0]) if len(imagenes) == 1 else fac.llamar_ocr_multipagina(imagenes)
                    texto = fac.combinar_texto_nativo_y_ocr(texto, texto_ocr)
                if texto.strip():
                    importes_pre = fac.preextraer_importes(texto)
                    total_pre_txt, _ = fac.extraer_total_del_texto(texto)
                    base_pre_txt, _ = fac.extraer_base_del_texto(texto)
                    iva_pct = fac.detectar_iva_porcentaje(texto)
                    _, plantilla = fac.detectar_plantilla(texto, nombre)
                    datos_importes = fac.llamar_llama_importes(texto, importes_pre, total_pre_txt, base_pre_txt, iva_pct)
                    datos_campos = fac.llamar_llama_campos(texto, empresa_receptora, nombre, plantilla)
                    fac.liberar_modelos()
                    datos_extraidos = fac.postprocesar(datos_importes, datos_campos, texto, empresa_receptora, nombre, importes_pre, iva_pct)

        tmp_path.unlink(missing_ok=True)

        ejemplo = {
            "numero_factura":    datos_extraidos.get("numero_factura", ""),
            "fecha_factura":     datos_extraidos.get("fecha_factura", ""),
            "base_imponible":     datos_extraidos.get("base_imponible", ""),
            "iva_porcentaje":    datos_extraidos.get("iva_porcentaje", ""),
            "iva_importe":        datos_extraidos.get("iva_importe", ""),
            "irpf_porcentaje":   datos_extraidos.get("irpf_porcentaje", ""),
            "irpf_importe":      datos_extraidos.get("irpf_importe", ""),
            "total_pagar":        datos_extraidos.get("total_pagar", ""),
            "moneda":            datos_extraidos.get("moneda") or fac.detectar_moneda(texto),
            "concepto_mejorado": datos_extraidos.get("concepto_mejorado", ""),
            "conceptos_originales": datos_extraidos.get("conceptos_originales", ""),
            "texto_ocr_bruto":   texto,
            "archivo_guardado":  nombre,
            "imagen_b64":         imagen_b64,
        }
        total = fac.añadir_ejemplo_validado(proveedor, ejemplo)
        return JSONResponse({"ok": True, "total": total})
    except Exception as e:
        raise HTTPException(500, f"Error añadiendo ejemplo: {e}")

@app.post("/api/entrenamiento/guardar-ejemplo-directo")
async def guardar_ejemplo_directo(datos: dict):
    """
    Guarda un ejemplo validado directamente (sin subir archivo) a partir de un dict de campos.
    Usado internamente cuando se crea la guía desde la pestaña de entrenamiento.
    """
    proveedor = datos.get("proveedor", "").strip()
    ejemplo = datos.get("ejemplo", {})
    if not proveedor or not ejemplo:
        raise HTTPException(400, "Faltan proveedor o ejemplo")
    try:
        total = fac.añadir_ejemplo_validado(proveedor, ejemplo)
        return JSONResponse({"ok": True, "total": total})
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.delete("/api/entrenamiento/ejemplo")
async def eliminar_ejemplo_entrenamiento(datos: dict):
    """Elimina un ejemplo validado por índice de un proveedor."""
    proveedor = datos.get("proveedor", "").strip()
    idx = datos.get("idx", -1)
    if not proveedor or idx < 0:
        raise HTTPException(400, "Faltan proveedor o idx")
    try:
        ok = fac.eliminar_ejemplo_validado(proveedor, idx)
        if not ok:
            raise HTTPException(404, "Ejemplo no encontrado")
        return JSONResponse({"ok": ok})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")

@app.post("/api/entrenamiento/añadir-ejemplo-validado")
async def añadir_ejemplo_desde_factura(datos: dict):
    """
    Añade como ejemplo de entrenamiento una factura ya procesada y validada en la tabla.
    Recibe: archivo (nombre), proveedor, workspace.
    Lee el texto OCR del Excel y los campos validados para construir el ejemplo.
    """
    archivo = datos.get("archivo", "").strip()
    proveedor = datos.get("proveedor", "").strip()
    workspace = datos.get("workspace", "default").strip()
    if not archivo or not proveedor:
        raise HTTPException(400, "Faltan archivo o proveedor")
    try:
        # Buscar la fila en el Excel de ese workspace
        cabeceras, filas = fac._leer_todas_las_filas(workspace)
        i_orig = fac._idx(cabeceras, "archivo_original")
        i_guard = fac._idx(cabeceras, "archivo_guardado")
        fila_encontrada = None
        for fila in filas:
            nombre = str(fila[i_orig] or "") if i_orig >= 0 and i_orig < len(fila) else ""
            nombre_g = str(fila[i_guard] or "") if i_guard >= 0 and i_guard < len(fila) else ""
            if nombre == archivo or nombre_g == archivo:
                fila_encontrada = {cabeceras[i]: (str(v) if v is not None else "") for i, v in enumerate(fila) if i < len(cabeceras)}
                break
        if not fila_encontrada:
            raise HTTPException(404, f"Factura '{archivo}' no encontrada en el workspace '{workspace}'")
        # Construir ejemplo con campos del Excel
        ejemplo = {
            "numero_factura": fila_encontrada.get("numero_factura", ""),
            "fecha_factura": fila_encontrada.get("fecha_factura", ""),
            "base_imponible": fila_encontrada.get("base_imponible", ""),
            "iva_porcentaje": fila_encontrada.get("iva_porcentaje", ""),
            "iva_importe": fila_encontrada.get("iva_importe", ""),
            "irpf_porcentaje": fila_encontrada.get("irpf_porcentaje", ""),
            "irpf_importe": fila_encontrada.get("irpf_importe", ""),
            "total_pagar": fila_encontrada.get("total_pagar", ""),
            "moneda": fila_encontrada.get("moneda", "EUR"),
            "concepto_mejorado": fila_encontrada.get("concepto_mejorado", ""),
            "conceptos_originales": fila_encontrada.get("conceptos_originales", ""),
            "texto_ocr_bruto": fila_encontrada.get("texto_ocr_bruto", ""),
            "archivo_guardado": fila_encontrada.get("archivo_guardado", archivo),
            "workspace": workspace,
        }
        total = fac.añadir_ejemplo_validado(proveedor, ejemplo)
        return JSONResponse({"ok": True, "total": total, "proveedor": proveedor})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")


# ═══════════════════════════════════════════════════════════════════
# ARRANQUE
# ═══════════════════════════════════════════════════════════════════

_hilos = {}
_stop_flags: dict[str, bool] = {}   # workspace → True cuando hay que parar el hilo
_pause_flags: dict[str, bool] = {}  # workspace -> True cuando la cola esta pausada

def arrancar_procesador(workspace: str):
    if workspace not in _hilos or not _hilos[workspace].is_alive():
        _stop_flags.pop(workspace, None)   # limpiar flag anterior si existía
        h = threading.Thread(target=fac.bucle, args=(workspace, _stop_flags, _pause_flags), daemon=True, name=f"fac_{workspace}")
        h.start(); _hilos[workspace] = h
        log.info(f"  ✓ Procesador [{workspace}] arrancado")

def _puerto_en_uso(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except OSError:
        return False

def main():
    _data_dir().mkdir(parents=True, exist_ok=True)
    if _puerto_en_uso("127.0.0.1", API_PORT):
        url = f"http://localhost:{API_PORT}"
        print(f"Aliot ya esta abierto en {url}")
        print("Abriendo navegador...")
        webbrowser.open(url)
        print()
        print("Si quieres reiniciar Aliot, cierra primero la ventana/proceso Python que ya esta abierto.")
        try:
            input("Pulsa Enter para cerrar esta ventana...")
        except Exception:
            pass
        return
    log.info("═" * 58)
    log.info("  Aliot Innovación · Suite Facturas v10")
    log.info(f"  Interfaz : http://localhost:{API_PORT}")
    log.info(f"  Ollama   : {OLLAMA_URL}")
    log.info(f"  App      : {_base_dir()}")
    log.info(f"  Datos    : {_data_dir()}")
    if HTML_PATH.exists():
        log.info("  HTML     : ✓ aliot-suite.html encontrado")
    else:
        log.warning(f"  HTML     : ✗ NO ENCONTRADO en {HTML_PATH}")
        log.warning("             Asegúrate de que aliot-suite.html está junto a main.py")
    log.info("═" * 58)
    log.info(f"  ➜ Abre en el navegador: http://localhost:{API_PORT}")
    log.info("  ⚠  NO abras el archivo HTML directamente (file://)")
    log.info("═" * 58)
    for ws in fac.listar_workspaces():
        arrancar_procesador(ws)
    # Arrancar el primer workspace disponible si no hay ninguno configurado
    if not fac.listar_workspaces():
        log.warning("  Sin clientes configurados — crea uno desde la interfaz")
    if os.environ.get("ALIOT_OPEN_BROWSER", "1").lower() not in ("0", "false", "no"):
        threading.Timer(2.0, lambda: webbrowser.open(f"http://localhost:{API_PORT}")).start()
    uvicorn.run(app, host="127.0.0.1", port=API_PORT, log_level="warning")

if __name__ == "__main__":
    main()
