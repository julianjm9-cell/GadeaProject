"""
Aliot Innovación · Procesador de Facturas v14
==============================================
v14 (desde auditoría + notas Julian):
  - Config dinámica: OLLAMA_URL, modelos, etc. se releen en cada operación
  - Groq Cloud + Llama Vision: soporte OCR+análisis en un solo paso vía API externa
  - Parseo JSON robusto con balance de llaves
  - Texto inteligente: primeros N + últimos M chars para no perder datos
  - IVA%: acepta cualquier valor 0-30 (no solo lista fija)
  - Proveedores transversales (no por workspace)
  - Sin workspace "default" — siempre con nombre
  - Race condition Excel: lock por workspace
  - except:pass → except con logging
  - Retry inteligente en llamadas LLM (distingue transitorio vs permanente)
  - PDF multipágina: OCR correcto y preview de todas las páginas
  - Prompts mejorados y en español para modelos pequeños
  - Límite importes subido a 99.999.999
"""

import io, re, sys, json, time, shutil, base64, logging, threading, unicodedata, os, html
import requests, openpyxl
from pathlib import Path
from datetime import datetime
from collections import Counter
from collections.abc import Mapping
from contextlib import nullcontext

ollama_lock = threading.Lock()
api_externa_lock = threading.Lock()
_api_externa_last_call = 0.0
_excel_locks = {}  # lock por workspace para Excel
_excel_locks_lock = threading.Lock()

estado_procesador = {"estado": "idle", "archivo": "", "workspace": "", "ts": 0}
DEFAULT_WATCHDOG_TIMEOUT = 900
MAX_REINTENTOS = 3
UMBRAL_DOBLE_CHECK = 10000.0
MAX_IMPORTE = 99_999_999
LLM_RETRY = 2
LLM_RETRY_DELAY = 3

log = logging.getLogger("facturas")


def _latido_procesador(estado=None, archivo=None, workspace=None):
    if estado is not None:
        estado_procesador["estado"] = estado
    if archivo is not None:
        estado_procesador["archivo"] = archivo
    if workspace is not None:
        estado_procesador["workspace"] = workspace
    estado_procesador["ts"] = time.time()


# ═══════════════════════════════════════════════════════════════════
# CONFIG — SIEMPRE DINÁMICA
# ═══════════════════════════════════════════════════════════════════

def _base_dir():
    if os.environ.get("ALIOT_DATA_DIR"):
        return Path(os.environ["ALIOT_DATA_DIR"]).resolve()
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent

def _load_config():
    for p in [_base_dir() / "config.json", Path("config.json")]:
        if p.exists():
            try:
                cfg = json.loads(p.read_text(encoding="utf-8-sig"))
                if os.environ.get("ALIOT_OLLAMA_URL"):
                    cfg["ollama_url"] = os.environ["ALIOT_OLLAMA_URL"]
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
            except Exception as e:
                log.warning(f"Error leyendo config {p}: {e}")
    return {}

CONFIG_PATH      = _base_dir() / "config.json"
PROVEEDORES_PATH = _base_dir() / "proveedores.json"

# Todas las "constantes" ahora son funciones que releen config
def ollama_url():      return _load_config().get("ollama_url", os.environ.get("ALIOT_OLLAMA_URL", "http://localhost:11435"))
def modelo_ocr():      return _load_config().get("modelo_ocr", "glm-ocr:latest")
def modelo_analisis(): return _load_config().get("modelo_analisis", "llama3.2:3b")
def min_chars_pdf():   return int(_load_config().get("min_chars_pdf", 80))
def max_ancho_imagen():return int(_load_config().get("max_ancho_imagen", 800))
def timeout_ollama():  return int(_load_config().get("timeout_ollama", 600))
def timeout_api_ext(): return int(_load_config().get("timeout_api_ext", 120))
def watchdog_timeout():return int(_load_config().get("watchdog_timeout", max(DEFAULT_WATCHDOG_TIMEOUT, timeout_ollama() + 180)))
def pausa_entre_arch():return int(_load_config().get("pausa_entre_archivos", 2))
def pausa_cola_vacia():return int(_load_config().get("pausa_cola_vacia", 10))

EXTENSIONES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp"}

MESES_ES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
            "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
MESES_MAP = {
    "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
    "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
    "enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
    "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12,
    "jan":1,"feb":2,"mar":3,"apr":4,"may":5,"jun":6,"jul":7,"aug":8,
    "sep":9,"sept":9,"oct":10,"nov":11,"dec":12,"ene":1,"ago":8,"dic":12,
}

COLUMNAS_EXCEL = [
    "archivo_original", "archivo_guardado", "workspace",
    "numero_factura", "proveedor", "empresa_receptora", "nif_cif",
    "fecha_factura", "duracion_licencia",
    "base_imponible", "iva_porcentaje", "iva_importe", "irpf_porcentaje", "irpf_importe", "total_pagar", "moneda",
    "base_eur", "total_eur", "tipo_cambio", "fecha_tipo_cambio", "fuente_tipo_cambio",
    "concepto_mejorado", "conceptos_originales",
    "idioma_factura", "calidad_ocr", "alertas",
    "texto_ocr_bruto", "deducible", "estado", "fecha_proceso",
]


# ═══════════════════════════════════════════════════════════════════
# EXCEL LOCK POR WORKSPACE
# ═══════════════════════════════════════════════════════════════════

def _get_excel_lock(workspace):
    with _excel_locks_lock:
        if workspace not in _excel_locks:
            _excel_locks[workspace] = threading.Lock()
        return _excel_locks[workspace]


# ═══════════════════════════════════════════════════════════════════
# PROVEEDORES CONOCIDOS (TRANSVERSALES)
# ═══════════════════════════════════════════════════════════════════

def leer_proveedores():
    """Devuelve solo los proveedores personalizados del usuario."""
    if PROVEEDORES_PATH.exists():
        try:
            custom = json.loads(PROVEEDORES_PATH.read_text(encoding="utf-8-sig"))
            return {
                k.lower(): v
                for k, v in custom.items()
                if str((v or {}).get("nif", "")).strip()
            }
        except Exception as e:
            log.warning(f"Error leyendo proveedores: {e}")
    return {}

def guardar_proveedor(nombre: str, nif: str = "", pais: str = "", alias: list = None):
    nombre = str(nombre or "").strip()
    nif = str(nif or "").strip()
    pais = str(pais or "").strip()
    if not nombre:
        raise ValueError("Nombre vacío")
    if not nif:
        raise ValueError("NIF/CIF vacío")
    try:
        custom = {}
        if PROVEEDORES_PATH.exists():
            custom = json.loads(PROVEEDORES_PATH.read_text(encoding="utf-8-sig"))
        custom = {k: v for k, v in custom.items() if str((v or {}).get("nif", "")).strip()}
        key = nombre.lower().strip()
        custom[key] = {"nombre": nombre, "nif": nif, "pais": pais}
        if alias:
            for a in alias:
                alias_key = str(a or "").lower().strip()
                if alias_key:
                    custom[alias_key] = {"nombre": nombre, "nif": nif, "pais": pais}
        PROVEEDORES_PATH.write_text(json.dumps(custom, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Error guardando proveedor: {e}")
        raise

def eliminar_proveedor(key: str):
    if not PROVEEDORES_PATH.exists():
        return
    try:
        custom = json.loads(PROVEEDORES_PATH.read_text(encoding="utf-8-sig"))
        target = str(key or "").lower().strip()
        borrar = []
        for k, v in custom.items():
            nombre = str((v or {}).get("nombre", "")).lower().strip()
            if k.lower().strip() == target or nombre == target:
                borrar.append(k)
        for k in borrar:
            custom.pop(k, None)
        PROVEEDORES_PATH.write_text(json.dumps(custom, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Error eliminando proveedor: {e}")
        raise

def _norm_nombre_proveedor(valor: str) -> str:
    txt = unicodedata.normalize("NFD", str(valor or "").lower())
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    txt = re.sub(r'[^a-z0-9]+', ' ', txt)
    stop = {
        "inc", "llc", "ltd", "sl", "sa", "s", "l", "srl", "gmbh", "limited",
        "software", "services", "systems", "technologies", "technology"
    }
    return " ".join(t for t in txt.split() if t and t not in stop)

def _coinciden_nombres_proveedor(a: str, b: str) -> bool:
    na = _norm_nombre_proveedor(a)
    nb = _norm_nombre_proveedor(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    ta, tb = set(na.split()), set(nb.split())
    comunes = ta & tb
    if min(len(ta), len(tb)) <= 2:
        minimo = min(len(ta), len(tb))
    else:
        minimo = max(2, min(len(ta), len(tb)) - 1)
    return len(comunes) >= minimo

def buscar_proveedor_conocido_por_nombre(nombre: str):
    if not nombre:
        return None, None
    for key, datos in leer_proveedores().items():
        if _coinciden_nombres_proveedor(nombre, datos.get("nombre") or key):
            return key, datos
    return None, None

def buscar_proveedor_en_texto(texto: str, nombre_archivo: str = ""):
    proveedores = leer_proveedores()
    texto_lower = (texto + " " + nombre_archivo).lower()
    _sufijos = {"inc", "inc.", "llc", "ltd", "ltd.", "s.l", "s.l.", "sl", "s.a", "s.a.", "sa",
                "gmbh", "srl", "corp", "corp.", "co", "co."}

    for key, datos in proveedores.items():
        nif = (datos.get("nif") or "").strip().lower()
        if nif and len(nif) >= 5:
            pat = r'(?<![a-z0-9])' + re.escape(nif) + r'(?![a-z0-9])'
            if re.search(pat, texto_lower):
                return key, datos

    for key, datos in proveedores.items():
        nombre = (datos.get("nombre") or key).strip().lower()
        partes = re.split(r'[,\s]+', nombre)
        tokens = [p for p in partes if p and p not in _sufijos]
        nombre_limpio = " ".join(tokens).strip()
        if nombre_limpio and len(nombre_limpio) >= 5 and re.search(r'(?<![a-z0-9])' + re.escape(nombre_limpio) + r'(?![a-z0-9])', texto_lower):
            return key, datos
        if len(tokens) >= 2:
            encontrados = sum(
                1 for t in tokens
                if len(t) >= 4 and re.search(r'(?<![a-z0-9])' + re.escape(t) + r'(?![a-z0-9])', texto_lower)
            )
            minimo = len(tokens) if len(tokens) <= 2 else max(3, min(len(tokens), len(tokens) - 1))
            if encontrados >= minimo:
                return key, datos
    return None, None

def construir_bloque_proveedores_prompt(texto: str, nombre_archivo: str = ""):
    key, datos = buscar_proveedor_en_texto(texto, nombre_archivo)
    if datos:
        return f'\nPROVEEDOR DETECTADO: "{datos["nombre"]}" (NIF: {datos["nif"]}, País: {datos["pais"]}). Usa este como proveedor.\n'
    return ""


# ═══════════════════════════════════════════════════════════════════
# API EXTERNA (OpenAI / Anthropic / Groq / Gemini / compatible)
# ═══════════════════════════════════════════════════════════════════

def leer_config_api():
    cfg = _load_config()
    return {
        "tipo": cfg.get("api_tipo", "ollama"),
        "api_key": cfg.get("api_key", ""),
        "modelo_externo": cfg.get("modelo_externo", "gpt-4o-mini"),
        "api_url": cfg.get("api_url", ""),
        "vision_enabled": cfg.get("vision_enabled", False),
        "anyformat_api_key": cfg.get("anyformat_api_key", ""),
        "anyformat_workflow_id": cfg.get("anyformat_workflow_id", ""),
        "anyformat_base_url": cfg.get("anyformat_base_url", "https://api.anyformat.ai"),
    }

def usar_api_externa() -> bool:
    cfg = leer_config_api()
    return cfg["tipo"] not in ("ollama", "anyformat") and bool(cfg["api_key"])

def usar_anyformat() -> bool:
    cfg = leer_config_api()
    return cfg["tipo"] == "anyformat" and bool(cfg.get("anyformat_api_key")) and bool(cfg.get("anyformat_workflow_id"))

def usar_vision_externa() -> bool:
    """True si la API externa soporta imágenes (Groq+LlamaVision, OpenAI GPT-4o, etc.)"""
    cfg = leer_config_api()
    return usar_api_externa() and cfg.get("vision_enabled", False)

def usar_vision_ollama() -> bool:
    """True si el toggle manual de visión Ollama está activo.
    Permite usar qwen3-vl, llama3.2-vision, etc. en un solo paso sin API externa."""
    return bool(_load_config().get("modo_vision_ollama", False))

def usar_vision_unico_paso() -> bool:
    """True si hay que procesar en un solo paso (visión Ollama o API externa con visión)."""
    return usar_vision_externa() or usar_vision_ollama()

def motor_local_disponible(timeout: int = 3) -> bool:
    """Comprueba Ollama antes de consumir reintentos de la cola."""
    if usar_api_externa():
        return True
    try:
        resp = requests.get(f"{ollama_url()}/api/tags", timeout=timeout)
        return resp.ok
    except Exception:
        return False

def _api_url_for_tipo(cfg):
    """Devuelve la URL correcta según el tipo de API."""
    tipo = cfg["tipo"]
    custom_url = cfg.get("api_url", "").strip()
    if custom_url:
        return custom_url
    urls = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "anthropic": "https://api.anthropic.com/v1/messages",
        "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
        "openai_compatible": "https://api.openai.com/v1/chat/completions",
    }
    return urls.get(tipo, "")

def llamar_api_externa(prompt: str, imagen_b64: str = None) -> str:
    """Llama a la API externa. Si imagen_b64 se proporciona y vision está activo, envía la imagen."""
    cfg = leer_config_api()
    tipo = cfg["tipo"]
    api_key = cfg["api_key"]
    modelo = cfg["modelo_externo"]
    url = _api_url_for_tipo(cfg)
    timeout = timeout_api_ext()
    # Solo afecta a APIs externas; Ollama no pasa por esta funcion.
    min_interval = float(_load_config().get("api_min_interval", 60))

    global _api_externa_last_call
    for intento in range(4):
        with api_externa_lock:
            espera = min_interval - (time.time() - _api_externa_last_call)
            if espera > 0:
                time.sleep(espera)
            try:
                if tipo == "anthropic":
                    resultado = _llamar_anthropic(url, api_key, modelo, prompt, imagen_b64, timeout)
                else:
                    # OpenAI, Gemini, Groq y compatibles usan el mismo formato
                    resultado = _llamar_openai_compatible(url, api_key, modelo, prompt, imagen_b64, timeout)
                _api_externa_last_call = time.time()
                return resultado
            except requests.exceptions.HTTPError as e:
                _api_externa_last_call = time.time()
                status = e.response.status_code if e.response is not None else None
                if status == 429 and intento < 3:
                    retry_after = e.response.headers.get("Retry-After") if e.response is not None else None
                    try:
                        pausa = float(retry_after) if retry_after else min(300, 60 * (2 ** intento))
                    except Exception:
                        pausa = min(300, 60 * (2 ** intento))
                    log.warning(f"  → API externa rate limit 429; pausa {pausa:.0f}s (intento {intento+1}/4)")
                    time.sleep(pausa)
                    continue
                raise


# ═══════════════════════════════════════════════════════════════════
# ANYFORMAT (workflow externo con polling)
# ═══════════════════════════════════════════════════════════════════

def _anyformat_base_url(cfg: dict) -> str:
    return (cfg.get("anyformat_base_url") or "https://api.anyformat.ai").strip().rstrip("/")

def llamar_anyformat_workflow(ruta: Path) -> tuple[dict, dict]:
    """Ejecuta un workflow de anyformat y devuelve (respuesta completa, campos planos)."""
    cfg = leer_config_api()
    api_key = cfg.get("anyformat_api_key", "").strip()
    workflow_id = cfg.get("anyformat_workflow_id", "").strip()
    if not api_key or not workflow_id:
        raise ValueError("Anyformat requiere API key y workflow_id en configuración")

    base_url = _anyformat_base_url(cfg)
    headers = {"Authorization": f"Bearer {api_key}"}
    run_url = f"{base_url}/v2/workflows/{workflow_id}/run/"
    results_url_tpl = f"{base_url}/v2/workflows/{workflow_id}/files/{{file_id}}/results/"
    timeout = timeout_api_ext()

    log.info("  -> Anyformat: enviando documento al workflow...")
    with open(ruta, "rb") as f:
        resp = requests.post(run_url, headers=headers, files={"file": (ruta.name, f)}, timeout=timeout)
    resp.raise_for_status()
    run_data = resp.json()
    file_id = run_data.get("id") or run_data.get("file_id") or run_data.get("collection_id")
    if not file_id:
        raise ValueError(f"Anyformat no devolvió id de archivo: {run_data}")

    deadline = time.time() + max(timeout, 60)
    delay = 5
    last_status = None
    while time.time() < deadline:
        log.info(f"  -> Anyformat: consultando resultado {file_id}...")
        r = requests.get(results_url_tpl.format(file_id=file_id), headers=headers, timeout=timeout)
        if r.status_code == 412:
            last_status = "procesando"
            time.sleep(delay)
            delay = min(int(delay * 1.5), 30)
            continue
        if r.status_code == 429:
            last_status = "rate_limit"
            time.sleep(10)
            continue
        r.raise_for_status()
        data = r.json()
        return data, _flatten_anyformat_results(data)

    raise TimeoutError(f"Anyformat no devolvió resultados a tiempo ({last_status or 'sin estado'})")

def _flatten_anyformat_results(data) -> dict:
    flat = {}

    def add_value(key, value):
        if key and value not in (None, ""):
            flat[str(key).strip()] = value

    def walk(obj, prefix=""):
        if isinstance(obj, list):
            for item in obj:
                walk(item, prefix)
            return
        if not isinstance(obj, Mapping):
            return

        field_name = obj.get("field_name") or obj.get("name") or obj.get("key")
        if field_name and "value" in obj:
            add_value(field_name, obj.get("value"))

        for key, value in obj.items():
            if key in {"evidence", "confidence", "verification_status", "value_unit"}:
                continue
            if isinstance(value, Mapping):
                if "value" in value and not isinstance(value.get("value"), Mapping):
                    add_value(key, value.get("value"))
                walk(value, key)
            elif isinstance(value, list):
                add_value(key, value)
                walk(value, key)
            else:
                add_value(key, value)

    walk(data)
    return flat

def _anyformat_field(flat: dict, aliases: list[str]):
    norm = {_norm_anyformat_key(k): v for k, v in flat.items()}
    for alias in aliases:
        value = norm.get(_norm_anyformat_key(alias))
        if value not in (None, ""):
            return _stringify_anyformat_value(value)
    return ""

def _norm_anyformat_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(key or "").lower())

def _stringify_anyformat_value(value) -> str:
    if isinstance(value, list):
        parts = []
        for item in value:
            if isinstance(item, Mapping):
                desc = item.get("description") or item.get("name") or item.get("concept") or item.get("value")
                amount = item.get("amount") or item.get("total") or item.get("price")
                txt = " ".join(str(x) for x in (desc, amount) if x not in (None, ""))
                if txt:
                    parts.append(txt)
            elif item not in (None, ""):
                parts.append(str(item))
        return " | ".join(parts)
    if isinstance(value, Mapping):
        if "value" in value:
            return _stringify_anyformat_value(value.get("value"))
        return json.dumps(value, ensure_ascii=False)
    return str(value).strip()

def normalizar_anyformat(flat: dict) -> dict:
    return {
        "numero_factura": _anyformat_field(flat, ["numero_factura", "invoice_number", "invoice_no", "invoice_id", "number", "numero"]),
        "proveedor": _anyformat_field(flat, ["proveedor", "supplier_name", "supplier", "vendor_name", "vendor", "seller_name", "seller", "emisor"]),
        "empresa_receptora": _anyformat_field(flat, ["empresa_receptora", "customer_name", "buyer_name", "recipient_name", "bill_to", "cliente", "receptor"]),
        "nif_cif": _anyformat_field(flat, ["nif_cif", "supplier_tax_id", "vendor_tax_id", "seller_tax_id", "vat_number", "tax_id", "cif", "nif", "vat"]),
        "fecha_factura": _anyformat_field(flat, ["fecha_factura", "invoice_date", "issue_date", "date", "fecha", "fecha_emision"]),
        "duracion_licencia": _anyformat_field(flat, ["duracion_licencia", "service_period", "period", "billing_period", "license_period"]),
        "base_imponible": _anyformat_field(flat, ["base_imponible", "net_amount", "subtotal", "taxable_base", "base", "amount_before_tax"]),
        "iva_porcentaje": _anyformat_field(flat, ["iva_porcentaje", "vat_rate", "tax_rate", "iva_rate"]),
        "iva_importe": _anyformat_field(flat, ["iva_importe", "vat_amount", "tax_amount", "iva", "tax"]),
        "irpf_porcentaje": _anyformat_field(flat, ["irpf_porcentaje", "withholding_rate", "retention_rate", "irpf_rate"]),
        "irpf_importe": _anyformat_field(flat, ["irpf_importe", "withholding_amount", "retention_amount", "irpf"]),
        "total_pagar": _anyformat_field(flat, ["total_pagar", "total_amount", "amount_due", "grand_total", "total", "invoice_total"]),
        "moneda": _anyformat_field(flat, ["moneda", "currency", "currency_code"]),
        "concepto_mejorado": _anyformat_field(flat, ["concepto_mejorado", "summary", "description", "concept", "concepto"]),
        "conceptos_originales": _anyformat_field(flat, ["conceptos_originales", "line_items", "items", "invoice_lines", "descriptions"]),
    }

def _anyformat_texto_respaldo(raw: dict, flat: dict) -> str:
    for key in ("markdown", "text", "content", "ocr_text", "parsed_text"):
        value = _anyformat_field(flat, [key])
        if value:
            return value
    return json.dumps(raw or flat, ensure_ascii=False, indent=2)

def _llamar_openai_compatible(url, api_key, modelo, prompt, imagen_b64, timeout):
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    if imagen_b64:
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{imagen_b64}"}}
        ]
    else:
        content = prompt

    payload = {
        "model": modelo,
        "messages": [{"role": "user", "content": content}],
        "max_tokens": 2000,
        "temperature": 0.1,
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()

def _llamar_anthropic(url, api_key, modelo, prompt, imagen_b64, timeout):
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    if imagen_b64:
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": imagen_b64}},
            {"type": "text", "text": prompt},
        ]
    else:
        content = [{"type": "text", "text": prompt}]

    payload = {
        "model": modelo,
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": content}],
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=timeout)
    resp.raise_for_status()
    return resp.json()["content"][0]["text"].strip()


# ═══════════════════════════════════════════════════════════════════
# WORKSPACES — SIN DEFAULT
# ═══════════════════════════════════════════════════════════════════

def _carpeta_base():
    return Path(_load_config().get("carpeta_facturas", "").strip() or (_base_dir() / "facturas"))

def validar_workspace(workspace: str) -> str:
    workspace = (workspace or "default").strip() or "default"
    if Path(workspace).is_absolute() or any(sep in workspace for sep in ("/", "\\")):
        raise ValueError("Nombre de workspace invalido")
    if workspace in (".", "..") or ".." in Path(workspace).parts or any(ch in workspace for ch in '<>:"|?*'):
        raise ValueError("Nombre de workspace invalido")
    if any(ord(ch) < 32 for ch in workspace):
        raise ValueError("Nombre de workspace invalido")
    return workspace

def _workspace_dir(workspace: str) -> Path:
    base = _carpeta_base().resolve()
    ws_base = (base / validar_workspace(workspace)).resolve()
    try:
        ws_base.relative_to(base)
    except ValueError:
        raise ValueError("Workspace fuera de la carpeta de facturas")
    return ws_base

def get_workspace_paths(workspace: str):
    ws_base = _workspace_dir(workspace)
    return {
        "entrada":    ws_base / "entrada",
        "procesados": ws_base / "entrada" / "procesados",
        "errores":    ws_base / "entrada" / "errores",
        "eliminados": ws_base / "entrada" / "eliminados",
        "salida":     ws_base / "salida",
        "ocr":        ws_base / "salida" / "ocr",
        "excel":      ws_base / "salida" / "facturas.xlsx",
    }

def crear_carpetas_workspace(workspace: str):
    paths = get_workspace_paths(workspace)
    for key in ["entrada", "procesados", "errores", "eliminados", "salida", "ocr"]:
        paths[key].mkdir(parents=True, exist_ok=True)

def listar_workspaces():
    base = _carpeta_base()
    if not base.exists():
        return []
    ws = [d.name for d in sorted(base.iterdir()) if d.is_dir() and not d.name.startswith('.')]
    return ws

def crear_workspace(nombre: str):
    nombre_limpio = re.sub(r'[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]', '_', nombre.strip())[:40]
    nombre_limpio = validar_workspace(nombre_limpio)
    if not nombre_limpio:
        raise ValueError("Nombre de workspace inválido")
    crear_carpetas_workspace(nombre_limpio)
    return nombre_limpio

def renombrar_workspace(nombre_actual: str, nombre_nuevo: str):
    base = _carpeta_base()
    origen = _workspace_dir(nombre_actual)
    nombre_limpio = re.sub(r'[^a-zA-Z0-9_\-áéíóúñÁÉÍÓÚÑ ]', '_', nombre_nuevo.strip())[:40]
    nombre_limpio = validar_workspace(nombre_limpio)
    if not nombre_limpio:
        raise ValueError("Nombre nuevo inválido")
    destino = _workspace_dir(nombre_limpio)
    if destino.exists():
        raise ValueError(f"Ya existe un workspace '{nombre_limpio}'")
    if origen.exists():
        origen.rename(destino)
    else:
        crear_carpetas_workspace(nombre_limpio)
    try:
        excel_path = _get_excel_path(nombre_limpio)
        if excel_path.exists():
            wb = openpyxl.load_workbook(excel_path)
            ws = wb.active
            headers = [str(c.value or "").strip() for c in ws[1]]
            if "workspace" in headers:
                col = headers.index("workspace") + 1
                for row in range(2, ws.max_row + 1):
                    ws.cell(row=row, column=col).value = nombre_limpio
                wb.save(excel_path)
            wb.close()
    except Exception as e:
        log.debug(f"No se pudo actualizar workspace en Excel tras renombrar: {e}")
    return nombre_limpio

def eliminar_workspace(nombre: str):
    nombre = validar_workspace(nombre)
    if nombre == "default":
        raise ValueError("No se puede eliminar default")
    ws_path = _workspace_dir(nombre)
    if ws_path.exists():
        shutil.rmtree(str(ws_path))

def crear_carpetas(workspace):
    """Compat — crea carpetas para un workspace."""
    crear_carpetas_workspace(workspace)


# ═══════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════

def leer_empresa_receptora(workspace=""):
    """Lee empresa receptora — primero del config del workspace, luego del global."""
    if workspace and workspace != "default":
        ws_cfg_path = _workspace_dir(workspace) / "workspace_config.json"
        if ws_cfg_path.exists():
            try:
                wc = json.loads(ws_cfg_path.read_text(encoding="utf-8-sig"))
                if wc.get("empresa_receptora"):
                    return wc["empresa_receptora"].strip()
            except Exception:
                pass
    return _load_config().get("empresa_receptora", "").strip()

def leer_empresa_cif(workspace=""):
    """Lee CIF empresa receptora — primero del workspace, luego del global."""
    if workspace and workspace != "default":
        ws_cfg_path = _workspace_dir(workspace) / "workspace_config.json"
        if ws_cfg_path.exists():
            try:
                wc = json.loads(ws_cfg_path.read_text(encoding="utf-8-sig"))
                if wc.get("empresa_cif"):
                    return wc["empresa_cif"].strip()
            except Exception:
                pass
    return _load_config().get("empresa_cif", "").strip()

def guardar_empresa_workspace(workspace: str, nombre: str, cif: str = ""):
    """Guarda nombre y CIF de la empresa receptora en el config del workspace."""
    ws_cfg_path = _workspace_dir(workspace) / "workspace_config.json"
    cfg = {}
    if ws_cfg_path.exists():
        try: cfg = json.loads(ws_cfg_path.read_text(encoding="utf-8-sig"))
        except Exception: pass
    cfg["empresa_receptora"] = nombre.strip()
    cfg["empresa_cif"] = cif.strip()
    ws_cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

def leer_config_workspace(workspace: str) -> dict:
    """Lee el config completo de un workspace."""
    ws_cfg_path = _workspace_dir(workspace) / "workspace_config.json"
    if ws_cfg_path.exists():
        try: return json.loads(ws_cfg_path.read_text(encoding="utf-8-sig"))
        except Exception: pass
    return {}

# ─── Prompts editables ───────────────────────────────────────────────────────

PROMPTS_DEFAULT = {
    "ocr": (
        "Extract ALL text from this invoice image exactly as it appears. "
        "Preserve original layout and spacing. "
        "Pay special attention to: "
        "1) TAX IDs — look for NIF, CIF, VAT, VAT No, EU VAT, Tax ID, EIN, SIRET, USt-IdNr, "
        "EU OSS VAT — copy them EXACTLY including country prefix (e.g. IE9740720B, EU372041333). "
        "2) Invoice number — look for Invoice No, Invoice #, Nº Factura, Factura Nº, Ref, Folio, "
        "Bill No — include the full identifier. "
        "3) ALL monetary amounts — Subtotal, Base imponible, Tax, IVA, VAT amount, TOTAL, "
        "Amount due, Total due — include every number with its label. "
        "4) Dates — invoice date, billing period, service period. "
        "5) Company names — both seller (FROM) and buyer (TO/Bill To/Facturado a). "
        "Return ONLY raw extracted text, no interpretation, no markdown."
    ),
    "importes": (
        "Eres un experto en extracción de importes de facturas.\n"
        "Extrae SOLO los importes principales de esta factura.\n\n"
        "Números encontrados en el documento: [{lista}]\n"
        "TOTAL pre-detectado: {total_pre_txt}\n"
        "BASE/SUBTOTAL pre-detectado: {base_pre_txt}\n"
        "IVA/VAT porcentaje: {iva_hint}\n\n"
        "Extrae SOLO estos 6 campos:\n"
        "1. \"base_imponible\": Base imponible (subtotal antes de impuestos). UN SOLO NÚMERO.\n"
        "2. \"iva_porcentaje\": Porcentaje IVA como dígitos (\"21\", \"10\", \"4\"). Vacío si no aparece.\n"
        "3. \"iva_importe\": Importe del IVA. UN SOLO NÚMERO.\n"
        "4. \"irpf_porcentaje\": Porcentaje IRPF/retención como dígitos. Vacío si no aparece.\n"
        "5. \"irpf_importe\": Importe retenido de IRPF/retención. UN SOLO NÚMERO, positivo aunque aparezca con signo menos.\n"
        "6. \"total_pagar\": TOTAL FINAL/líquido a pagar. En autónomos con IRPF puede ser menor que base+IVA.\n\n"
        "REGLA normal: base_imponible + iva_importe = total_pagar.\n"
        "REGLA autónomos/IRPF: base_imponible + iva_importe - irpf_importe = total_pagar. La base imponible NO incluye IVA ni resta IRPF.\n\n"
        "Devuelve SOLO JSON válido con esos 6 campos, sin markdown:\n\n"
        "Texto de la factura:\n{texto}\n\nJSON:"
    ),
    "campos": (
        "Eres un experto en extracción de datos de facturas. Extrae los campos NO monetarios.\n"
        "{bloque_rec}{bloque_arch}{bloque_prov_conocido}{bloque_plant}\n"
        "REGLAS CRÍTICAS:\n"
        "- nif_cif es SIEMPRE el NIF/CIF/VAT del VENDEDOR (el que emite la factura), NUNCA del comprador.\n"
        "- Si ves NIF, CIF, VAT No, Tax ID, EU VAT, EU OSS VAT seguido de un código alfanumérico → ese es el nif_cif.\n"
        "- empresa_receptora es el COMPRADOR. Si se proporciona una empresa esperada, úsala SOLO si aparece claramente en el texto como comprador/receptor.\n"
        "- proveedor es SIEMPRE el VENDEDOR/emisor. NUNCA puede ser igual que empresa_receptora.\n"
        "- concepto_mejorado: describe EN ESPAÑOL qué se compró de forma clara y profesional, "
        "máximo 8 palabras. Ejemplos buenos: \"Licencia ChatGPT Plus mensual\", "
        "\"Servicios cloud Google Workspace\", \"Suscripción Adobe Creative Cloud\", "
        "\"Alojamiento web y dominio\", \"Licencia software Microsoft 365\". "
        "Ejemplos malos: \"Services\", \"Invoice\", \"Pago\", \"Varios\"\n\n"
        "Campos a extraer:\n"
        "1. \"numero_factura\": Identificador completo de la factura. Pista detectada: \"{num_pre}\".\n"
        "2. \"proveedor\": Nombre empresa VENDEDORA. En español si tiene traducción conocida.\n"
        "3. \"empresa_receptora\": Usa exactamente \"{empresa_receptora}\" solo si aparece como comprador/receptor. Si no aparece claramente, deja vacío.\n"
        "4. \"nif_cif\": NIF/CIF/VAT/Tax ID del VENDEDOR. Copia el código exactamente como aparece.\n"
        "5. \"fecha_factura\": Fecha emisión → DD/MM/AAAA. OBLIGATORIA si aparece cualquier fecha de factura/emisión/invoice date en el OCR; no la dejes vacía salvo que no haya ninguna fecha en el texto.\n"
        "6. \"duracion_licencia\": Periodo de servicio si aparece, ej \"enero 2025\", \"Q1 2025\". Vacío si no.\n"
        "7. \"moneda\": Código ISO: EUR, USD, GBP, etc.\n"
        "8. \"concepto_mejorado\": Descripción profesional EN ESPAÑOL, máximo 8 palabras. Ver ejemplos arriba.\n"
        "9. \"conceptos_originales\": Líneas originales de la factura separadas por \" | \".\n\n"
        "Devuelve SOLO JSON válido sin markdown:\n\n"
        "Texto de la factura:\n{texto}\n\nJSON:"
    ),
}

def leer_prompts_custom() -> dict:
    """Lee prompts personalizados del config. Devuelve solo los que el usuario ha editado."""
    return _load_config().get("prompts_custom", {})

def _prompt_custom_obsoleto(nombre: str, texto: str) -> bool:
    """Detecta prompts guardados por versiones anteriores que bloquean defaults nuevos."""
    t = (texto or "").strip()
    if nombre == "campos":
        return (
            "fecha_factura es OBLIGATORIA" in t
            and "NO lo dejes vacio si hay producto" not in t
            and "concepto_mejorado: describe EN ESPANOL" in t
        )
    return False

def get_prompt(nombre: str) -> str:
    """Devuelve el prompt activo para 'nombre' (custom si existe, default si no)."""
    custom = leer_prompts_custom()
    texto_custom = custom.get(nombre)
    if texto_custom and not _prompt_custom_obsoleto(nombre, texto_custom):
        return texto_custom
    return PROMPTS_DEFAULT.get(nombre, "")

def guardar_prompt_custom(nombre: str, texto: str):
    """Guarda un prompt personalizado. Si texto==default, lo elimina (vuelve al original)."""
    cfg_path = _base_dir() / "config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8-sig")) if cfg_path.exists() else {}
    prompts = cfg.get("prompts_custom", {})
    default = PROMPTS_DEFAULT.get(nombre, "")
    if texto.strip() == default.strip() or not texto.strip():
        prompts.pop(nombre, None)  # vuelve al default
    else:
        prompts[nombre] = texto
    cfg["prompts_custom"] = prompts
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info(f"  → Prompt '{nombre}' {'personalizado' if nombre in prompts else 'restaurado al default'}")

def guardar_empresa_receptora(nombre: str):
    p = CONFIG_PATH
    try:
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        cfg["empresa_receptora"] = nombre
        p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Error guardando empresa: {e}")

def leer_plantillas():
    return _load_config().get("plantillas_proveedores", {})

def guardar_plantilla(proveedor: str, ejemplo: dict):
    p = CONFIG_PATH
    try:
        cfg = json.loads(p.read_text(encoding="utf-8-sig")) if p.exists() else {}
        if "plantillas_proveedores" not in cfg:
            cfg["plantillas_proveedores"] = {}
        cfg["plantillas_proveedores"][proveedor.lower().strip()] = ejemplo
        p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        log.error(f"Error guardando plantilla: {e}")

def detectar_plantilla(texto_ocr: str, nombre_archivo: str = ""):
    plantillas = leer_plantillas()
    if not plantillas:
        return None, None
    texto_lower = (texto_ocr + " " + nombre_archivo).lower()
    for key, ejemplo in plantillas.items():
        if key in texto_lower:
            log.info(f"  → Plantilla: '{key}'")
            return key, ejemplo
    return None, None


# ═══════════════════════════════════════════════════════════════════
# ENTRENAMIENTO POR PROVEEDOR — guías estructurales (sin valores)
# ═══════════════════════════════════════════════════════════════════

ENTRENAMIENTO_PATH = _base_dir() / "entrenamiento.json"

def entrenamiento_activo() -> bool:
    """True si el sistema de entrenamiento está activado en config."""
    return bool(_load_config().get("entrenamiento_activo", False))

def leer_entrenamiento() -> dict:
    """Lee todas las guías de entrenamiento guardadas."""
    if not ENTRENAMIENTO_PATH.exists():
        return {}
    try:
        return json.loads(ENTRENAMIENTO_PATH.read_text(encoding="utf-8-sig"))
    except Exception as e:
        log.error(f"Error leyendo entrenamiento.json: {e}")
        return {}

def _limpiar_identificador_proveedor(valor: str) -> str:
    return re.sub(r"\s+", " ", str(valor or "").strip())

def _normalizar_guia_identificadores(proveedor: str, guia: dict) -> dict:
    """
    Limita los identificadores de deteccion al nombre del proveedor y su NIF/CIF.
    Evita listas largas de palabras clave que pueden activar guias equivocadas.
    """
    guia = dict(guia or {})
    proveedor_nombre = _limpiar_identificador_proveedor(guia.get("proveedor_nombre") or proveedor)
    nif = validar_nif(guia.get("nif_proveedor") or guia.get("nif_cif") or "")
    guia["proveedor_nombre"] = proveedor_nombre
    guia["nif_proveedor"] = nif
    claves = []
    if proveedor_nombre:
        claves.append(proveedor_nombre.lower())
    if nif:
        claves.append(nif.lower())
    guia["palabras_clave"] = claves
    return guia

def guardar_entrenamiento(proveedor: str, guia: dict):
    """Guarda la guía estructural de un proveedor. Preserva ejemplos_validados existentes."""
    try:
        datos = leer_entrenamiento()
        key = proveedor.lower().strip()
        guia = {k: v for k, v in dict(guia or {}).items() if not str(k).startswith("_")}
        # Si nif_proveedor está vacío, intentar rescatarlo de notas_extraccion
        # (el usuario pudo haber escrito el NIF en el campo de notas)
        if not guia.get("nif_proveedor"):
            notas = str(guia.get("notas_extraccion", "")) + " " + str(guia.get("contexto_manual", "")) + " " + str(guia.get("notas", ""))
            m = re.search(r'\b([A-Z]{1,3}[0-9]{6,12}[A-Z0-9]?)\b', notas, re.IGNORECASE)
            if m:
                guia["nif_proveedor"] = m.group(1).upper()
                log.info(f"  → NIF rescatado de notas para '{key}': {guia['nif_proveedor']}")
        pat_num = str(guia.get("numero_factura_patron", "") or "")
        numero_factura_ref = str(guia.get("numero_factura", "") or guia.get("numero_factura_ejemplo", "") or "")
        texto_ocr_ref = str(guia.get("texto_ocr_bruto", "") or "")
        if _valor_a_regex_patron(pat_num):
            num_info = describir_patron_numero_factura(pat_num, texto_ocr_ref)
            guia["numero_factura_patron"] = num_info["descripcion"]
            guia["numero_factura_regex"] = num_info["regex"]
        elif numero_factura_ref and not guia.get("numero_factura_regex"):
            guia["numero_factura_regex"] = describir_patron_numero_factura(numero_factura_ref, texto_ocr_ref).get("regex", "")
        guia = _normalizar_guia_identificadores(proveedor, guia)
        # Preservar ejemplos validados si ya existían
        if key in datos and "ejemplos_validados" in datos[key]:
            guia["ejemplos_validados"] = datos[key]["ejemplos_validados"]
        if key in datos and "archivos_usados_entrenamiento" in datos[key] and "archivos_usados_entrenamiento" not in guia:
            guia["archivos_usados_entrenamiento"] = datos[key]["archivos_usados_entrenamiento"]
        datos[key] = guia
        ENTRENAMIENTO_PATH.write_text(
            json.dumps(datos, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        log.info(f"  → Entrenamiento guardado: '{key}'")
    except Exception as e:
        log.error(f"Error guardando entrenamiento: {e}")
        raise

def añadir_ejemplo_validado(proveedor: str, ejemplo: dict, max_ejemplos: int = 5):
    """
    Añade un ejemplo de factura validada al entrenamiento del proveedor.
    Guarda hasta max_ejemplos ejemplos, descartando el más antiguo si se supera el límite.
    El ejemplo debe contener: numero_factura, fecha_factura, base_imponible, iva_porcentaje,
    irpf_porcentaje, total_pagar, moneda, concepto_mejorado, texto_ocr_bruto (opcional).
    NUNCA guarda el texto OCR completo — solo los primeros 500 chars como contexto.
    """
    try:
        datos = leer_entrenamiento()
        key = proveedor.lower().strip()
        if key not in datos:
            datos[key] = {"proveedor_nombre": proveedor}
        entrada = datos[key]
        if "ejemplos_validados" not in entrada:
            entrada["ejemplos_validados"] = []
        # Limpiar valores sensibles — solo guardar estructura/patrón
        num_info = describir_patron_numero_factura(
            ejemplo.get("numero_factura", ""),
            ejemplo.get("texto_ocr_bruto", ""),
        )
        ejemplo_limpio = {
            "numero_factura_patron": num_info["descripcion"],
            "numero_factura_regex": num_info["regex"],
            "fecha_formato": "DD/MM/AAAA" if "/" in str(ejemplo.get("fecha_factura","")) else str(ejemplo.get("fecha_factura","")),
            "base_imponible": ejemplo.get("base_imponible", ""),
            "total_pagar": ejemplo.get("total_pagar", ""),
            "iva_porcentaje": ejemplo.get("iva_porcentaje", ""),
            "irpf_porcentaje": ejemplo.get("irpf_porcentaje", ""),
            "irpf_importe": ejemplo.get("irpf_importe", ""),
            "moneda": ejemplo.get("moneda", "EUR"),
            "concepto": ejemplo.get("concepto_mejorado", "")[:100],
            "conceptos_originales": extraer_conceptos_originales_respaldo(
                ejemplo.get("texto_ocr_bruto", ""),
                ejemplo.get("conceptos_originales", ""),
            )[:900],
            "texto_contexto": enmascarar_contexto_entrenamiento(
                ejemplo.get("texto_ocr_bruto",""),
                ejemplo.get("numero_factura", ""),
            ),
            "guardado_en": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "archivo": ejemplo.get("archivo_guardado",""),
            "workspace": ejemplo.get("workspace", ""),
            "imagen_b64": str(ejemplo.get("imagen_b64", ""))[:250000],
        }
        ejemplos = entrada["ejemplos_validados"]
        ejemplos.append(ejemplo_limpio)
        usados = entrada.get("archivos_usados_entrenamiento", [])
        archivo_usado = ejemplo_limpio.get("archivo", "")
        if archivo_usado and archivo_usado not in usados:
            usados.append(archivo_usado)
        # Mantener solo los últimos max_ejemplos
        if len(ejemplos) > max_ejemplos:
            ejemplos = ejemplos[-max_ejemplos:]
        entrada["ejemplos_validados"] = ejemplos
        entrada["archivos_usados_entrenamiento"] = usados[-50:]
        datos[key] = entrada
        ENTRENAMIENTO_PATH.write_text(
            json.dumps(datos, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        log.info(f"  → Ejemplo validado añadido a '{key}' ({len(ejemplos)}/{max_ejemplos})")
        return len(ejemplos)
    except Exception as e:
        log.error(f"Error añadiendo ejemplo validado: {e}")
        return 0

def eliminar_ejemplo_validado(proveedor: str, idx: int):
    """Elimina un ejemplo validado por índice."""
    try:
        datos = leer_entrenamiento()
        key = proveedor.lower().strip()
        if key not in datos or "ejemplos_validados" not in datos[key]:
            return False
        ejemplos = datos[key]["ejemplos_validados"]
        if 0 <= idx < len(ejemplos):
            eliminado = ejemplos.pop(idx)
            datos[key]["ejemplos_validados"] = ejemplos
            archivo = eliminado.get("archivo", "")
            if archivo and "archivos_usados_entrenamiento" in datos[key]:
                sigue_en_ejemplos = any(ej.get("archivo") == archivo for ej in ejemplos)
                if not sigue_en_ejemplos:
                    datos[key]["archivos_usados_entrenamiento"] = [
                        a for a in datos[key]["archivos_usados_entrenamiento"] if a != archivo
                    ]
            ENTRENAMIENTO_PATH.write_text(
                json.dumps(datos, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )
            return True
        return False
    except Exception as e:
        log.error(f"Error eliminando ejemplo: {e}")
        return False

def eliminar_entrenamiento(proveedor: str):
    """Elimina la guía de un proveedor."""
    try:
        datos = leer_entrenamiento()
        datos.pop(proveedor.lower().strip(), None)
        ENTRENAMIENTO_PATH.write_text(
            json.dumps(datos, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
    except Exception as e:
        log.error(f"Error eliminando entrenamiento: {e}")

def generar_guia_desde_ejemplo(texto_ocr: str, campos_validados: dict) -> dict:
    """
    Genera una guía ESTRUCTURAL a partir de un ejemplo validado.
    NUNCA guarda valores numéricos — solo describe dónde y cómo aparecen los campos.
    Llama al modelo para que analice el ejemplo y genere las instrucciones.
    """
    proveedor = campos_validados.get("proveedor", "este proveedor")
    nif_proveedor = validar_nif(campos_validados.get("nif_cif", ""))
    numero_factura = campos_validados.get("numero_factura", "")
    iva_pct = campos_validados.get("iva_porcentaje", "")
    irpf_pct = campos_validados.get("irpf_porcentaje", "")
    moneda = campos_validados.get("moneda", "EUR")
    idioma = campos_validados.get("idioma_factura", "")
    concepto = campos_validados.get("concepto_mejorado", "")
    conceptos_originales = campos_validados.get("conceptos_originales", "")
    fecha = campos_validados.get("fecha_factura", "")
    contexto_manual = campos_validados.get("notas_adicionales", "") or campos_validados.get("contexto_manual", "")

    # Construir contexto con pistas estructurales (sin valores numéricos)
    pistas = []
    if numero_factura:
        num_info = describir_patron_numero_factura(numero_factura, texto_ocr)
        pistas.append(
            f"Número de factura: {num_info['descripcion']}"
            + (f" Regex: /{num_info['regex']}/" if num_info.get("regex") else "")
        )
    if iva_pct == "" or iva_pct == "0" or iva_pct == "0%":
        pistas.append("Este proveedor NO aplica IVA (campo iva_porcentaje vacío o 0%)")
    elif iva_pct:
        pistas.append(f"Este proveedor aplica IVA del {iva_pct}")
    if irpf_pct:
        pistas.append(f"Este proveedor suele aplicar retención IRPF del {irpf_pct}; la base imponible no debe restar IRPF")
    if moneda and moneda != "EUR":
        pistas.append(f"Las facturas de este proveedor suelen estar en {moneda}")
    if idioma:
        pistas.append(f"Idioma habitual de las facturas: {idioma}")
    if concepto:
        pistas.append(f"Tipo de servicio habitual: {concepto}")
    if conceptos_originales:
        pistas.append("Conceptos originales: describir dónde aparecen esas líneas; no tratarlas como valor fijo")
    if fecha:
        # Solo el formato, no la fecha concreta
        if "/" in fecha:
            pistas.append("Formato de fecha: DD/MM/AAAA")

    if contexto_manual:
        pistas.append(f"Contexto manual aportado por el usuario: {contexto_manual}")

    texto_prompt = texto_ocr[:2500]

    prompt = f"""Analiza este ejemplo REAL de factura de "{proveedor}" que ha sido validado manualmente.

Tu tarea es generar una GUÍA ESTRUCTURAL para ayudar a extraer datos de futuras facturas del MISMO proveedor.

IMPORTANTE: La guía debe describir DÓNDE aparecen los campos y qué etiquetas/palabras clave los identifican.
NUNCA incluyas valores numéricos específicos (importes, totales, bases). Solo la estructura y ubicación.

Pistas del ejemplo validado:
{chr(10).join('- ' + p for p in pistas)}

Genera un JSON con esta estructura exacta:
{{
  "proveedor_nombre": "Nombre oficial del proveedor",
  "nif_proveedor": "NIF/CIF/VAT del proveedor si aparece",
  "numero_factura_patron": "Describe el formato y ubicación del número de factura (ej: 'aparece como Invoice Number en cabecera, formato INV-XXXX-XXXX')",
  "total_ubicacion": "Describe dónde está el total final (ej: 'al final del documento como Total amount due')",
  "base_ubicacion": "Describe dónde está la base imponible (ej: 'como Subtotal antes de impuestos')",
  "iva_comportamiento": "Describe el IVA (ej: 'no aplica IVA, campo vacío' o 'IVA 21% como Tax al final')",
  "irpf_comportamiento": "Describe el IRPF/retención si aplica; vacío si no aplica",
  "moneda_habitual": "Moneda que suelen usar (EUR/USD/etc)",
  "idioma_factura": "Idioma habitual",
  "conceptos_originales_ubicacion": "Dónde aparecen las líneas originales de concepto/descripción y qué columnas/etiquetas las delimitan. No copies el concepto del ejemplo como valor fijo.",
  "palabras_clave": ["solo el nombre del proveedor y su NIF/CIF/VAT si existe"],
  "contexto_manual": "Copia aqui literalmente las instrucciones manuales del usuario si las hay",
  "notas_extraccion": "Cualquier particularidad importante para extraer datos de este proveedor"
}}

Texto del ejemplo de factura:
{texto_prompt}

JSON (sin markdown):"""

    _PROHIBIDAS = {
        "total","subtotal","importe","factura","invoice","amount","due","fecha","date",
        "iva","vat","tax","base","net","gross","payment","precio","price","euro","eur",
        "usd","gbp","nif","cif","s.l.","s.a.","ltd","inc","llc","srl","gmbh","nota","note","ref",
    }
    try:
        raw = _llamar_modelo(prompt)
        guia = extraer_json_robusto(raw)
        if not guia or not guia.get("proveedor_nombre"):
            guia = {
                "proveedor_nombre": proveedor,
                "nif_proveedor": nif_proveedor,
                "numero_factura_patron": describir_patron_numero_factura(numero_factura, texto_ocr).get("descripcion", "Buscar Invoice No, Nº Factura, Ref") if numero_factura else "Buscar Invoice No, Nº Factura, Ref",
                "numero_factura_regex": describir_patron_numero_factura(numero_factura, texto_ocr).get("regex", "") if numero_factura else "",
                "iva_comportamiento": f"IVA: {iva_pct}" if iva_pct else "Sin IVA o no detectado",
                "irpf_comportamiento": f"IRPF: {irpf_pct}" if irpf_pct else "",
                "moneda_habitual": moneda,
                "idioma_factura": idioma,
                "palabras_clave": [proveedor.lower()],
                "contexto_manual": contexto_manual,
                "notas_extraccion": "; ".join(pistas),
            }
        # El NIF introducido por el usuario es siempre más fiable que el del LLM
        guia["nif_proveedor"] = nif_proveedor or validar_nif(guia.get("nif_proveedor", ""))
        if contexto_manual:
            guia["contexto_manual"] = contexto_manual
        guia = _normalizar_guia_identificadores(proveedor, guia)
        log.info(f"  → Guía generada para '{proveedor}': {list(guia.keys())} | claves: {guia['palabras_clave']}")
        return guia
    except Exception as e:
        log.error(f"Error generando guía: {e}")
        return {
            "proveedor_nombre": proveedor,
            "nif_proveedor": nif_proveedor,
            "palabras_clave": [p for p in [proveedor.lower().strip(), nif_proveedor.lower().strip()] if p],
            "iva_comportamiento": f"IVA: {iva_pct}" if iva_pct else "No detectado",
            "moneda_habitual": moneda,
            "contexto_manual": contexto_manual,
            "notas_extraccion": "; ".join(pistas),
        }

def buscar_entrenamiento_para_factura(texto_ocr: str, nombre_archivo: str = "") -> tuple:
    """
    Busca si existe una guía de entrenamiento para el proveedor de esta factura.
    Devuelve (nombre_proveedor, guia) o (None, None).
    La deteccion se limita al nombre del proveedor y su NIF/CIF guardado.
    """
    if not entrenamiento_activo():
        return None, None
    datos = leer_entrenamiento()
    if not datos:
        return None, None

    texto_lower = (texto_ocr + " " + nombre_archivo).lower()

    # Palabras genéricas que NO sirven como identificador único de proveedor
    _STOPWORDS = {
        "ireland", "limited", "operations", "software", "services", "solutions",
        "systems", "network", "networks", "international", "global", "group",
        "technologies", "technology", "inc", "llc", "ltd", "s.l", "s.a", "sl",
        "sa", "gmbh", "srl", "the", "de", "and", "for", "web", "cloud",
        "pay", "payments", "online", "digital",
    }

    for key, guia in datos.items():
        proveedor_nombre = _limpiar_identificador_proveedor(guia.get("proveedor_nombre") or key).lower()
        # Buscar NIF también en notas_extraccion como fallback (el usuario puede haberlo escrito ahí)
        nif_raw = guia.get("nif_proveedor") or guia.get("nif_cif") or ""
        if not nif_raw:
            notas = guia.get("notas_extraccion", "") + " " + guia.get("contexto_manual", "") + " " + guia.get("notas", "")
            m_nif = re.search(r'\b([A-Z]{1,3}[0-9]{6,12}[A-Z0-9]?)\b', notas, re.IGNORECASE)
            if m_nif:
                nif_raw = m_nif.group(1)
                log.debug(f"  → NIF extraído de notas para '{key}': {nif_raw}")
        nif = validar_nif(nif_raw).lower()

        # 1. Match por NIF/CIF — lookaround de no-alfanumérico
        #    (NIFs mezclan letras+dígitos como IE9740720B, \b no funciona bien)
        if nif and len(nif) >= 3:
            pat_nif = r'(?<![a-z0-9])' + re.escape(nif) + r'(?![a-z0-9])'
            if re.search(pat_nif, texto_lower):
                log.info(f"  → Entrenamiento detectado por NIF '{nif}': '{key}'")
                return key, guia

        # 2. Match por nombre completo como substring (ej: "google", "notion")
        if len(proveedor_nombre) >= 4:
            if proveedor_nombre in texto_lower:
                log.info(f"  → Entrenamiento detectado por nombre completo '{proveedor_nombre}': '{key}'")
                return key, guia

        # 3. Match por tokens del nombre ignorando palabras genéricas
        #    ej: "Amazon Web Services" -> tokens ["amazon"] -> buscar "amazon" en texto
        tokens = [t for t in re.split(r'[\s\-_,\.]+', proveedor_nombre)
                  if len(t) >= 4 and t not in _STOPWORDS]
        if tokens:
            minimo = len(tokens) if len(tokens) <= 2 else max(3, min(len(tokens), len(tokens) - 1))
            encontrados = sum(
                1 for t in tokens
                if re.search(r'(?<![a-z0-9])' + re.escape(t) + r'(?![a-z0-9])', texto_lower)
            )
            if encontrados >= minimo:
                log.info(f"  → Entrenamiento detectado por tokens {tokens[:3]} ({encontrados}/{len(tokens)}): '{key}'")
                return key, guia

    return None, None

def buscar_entrenamiento_por_nombre_proveedor(nombre: str) -> tuple:
    if not nombre or not entrenamiento_activo():
        return None, None
    for key, guia in leer_entrenamiento().items():
        proveedor_nombre = guia.get("proveedor_nombre") or key
        if _coinciden_nombres_proveedor(nombre, proveedor_nombre):
            return key, guia
    return None, None

def construir_bloque_entrenamiento(guia: dict) -> str:
    """
    Construye el bloque de texto que se inyecta en los prompts
    cuando hay una guía de entrenamiento para el proveedor.
    Incluye la guía estructural + hasta 5 ejemplos validados como contexto.
    NUNCA incluye importes numéricos concretos — solo estructura y patrones.
    """
    if not guia:
        return ""
    partes = [f"\nGUÍA ESPECÍFICA PARA FACTURAS DE '{guia.get('proveedor_nombre','este proveedor').upper()}':"]
    if guia.get("numero_factura_patron"):
        partes.append(f"- Número de factura: {guia['numero_factura_patron']}")
    if guia.get("numero_factura_regex"):
        partes.append(f"- Patrón formal del número de factura: /{guia['numero_factura_regex']}/")
    if guia.get("total_ubicacion"):
        partes.append(f"- Total a pagar: {guia['total_ubicacion']}")
    if guia.get("base_ubicacion"):
        partes.append(f"- Base imponible: {guia['base_ubicacion']}")
    if guia.get("iva_comportamiento"):
        partes.append(f"- IVA: {guia['iva_comportamiento']}")
    if guia.get("irpf_comportamiento"):
        partes.append(f"- IRPF/retención: {guia['irpf_comportamiento']}")
    if guia.get("moneda_habitual"):
        partes.append(f"- Moneda habitual: {guia['moneda_habitual']}")
    if guia.get("duracion_licencia_ubicacion"):
        partes.append(f"- Periodo/duración del servicio: {guia['duracion_licencia_ubicacion']}")
    if guia.get("conceptos_originales_ubicacion"):
        partes.append(f"- Conceptos originales: {guia['conceptos_originales_ubicacion']}")
    if guia.get("contexto_manual"):
        partes.append(f"- Contexto manual del usuario: {guia['contexto_manual']}")
    if guia.get("notas_extraccion"):
        partes.append(f"- Notas IA: {guia['notas_extraccion']}")
    # Inyectar ejemplos validados como contexto adicional
    ejemplos = guia.get("ejemplos_validados", [])
    if ejemplos:
        partes.append(f"\nEJEMPLOS VALIDADOS MANUALMENTE ({len(ejemplos)}):")
        for i, ej in enumerate(ejemplos, 1):
            partes.append(f"  Ejemplo {i} ({ej.get('guardado_en','')}):")
            if ej.get("numero_factura_patron"):
                desc = ej["numero_factura_patron"]
                if _valor_a_regex_patron(desc):
                    desc = describir_patron_numero_factura(desc).get("descripcion", "Patrón estructural de número de factura")
                partes.append(f"    - Regla nº factura: {desc}")
            if ej.get("numero_factura_regex"):
                partes.append(f"    - Regex nº factura: /{ej['numero_factura_regex']}/")
            if ej.get("iva_porcentaje") is not None and ej.get("iva_porcentaje") != "":
                partes.append(f"    - IVA: {ej['iva_porcentaje']}%")
            if ej.get("irpf_porcentaje") is not None and ej.get("irpf_porcentaje") != "":
                partes.append(f"    - IRPF/retención: {ej['irpf_porcentaje']}%")
            if ej.get("moneda"):
                partes.append(f"    - Moneda: {ej['moneda']}")
            if ej.get("concepto"):
                partes.append(f"    - Concepto mejorado validado: {ej['concepto']} (orientativo, no valor fijo)")
            if ej.get("conceptos_originales"):
                partes.append(f"    - Conceptos originales OCR: {ej['conceptos_originales']}")
    partes.append("Regla de seguridad: usa los ejemplos para ubicar campos y formato; NO copies un concepto antiguo si el OCR actual trae otra descripcion.")
    partes.append("Usa esta guía para localizar los campos correctamente.\n")
    return "\n".join(partes)


# ═══════════════════════════════════════════════════════════════════
# FECHAS
# ═══════════════════════════════════════════════════════════════════

def normalizar_fecha(fecha):
    if not fecha:
        return ""
    s = str(fecha).strip()
    directa = _norm_fecha(s)
    if directa != s:
        return directa
    rango = re.split(r'\s*[–\-—]\s*', s, maxsplit=1)
    if len(rango) == 2 and len(rango[0]) > 3 and len(rango[1]) > 3:
        p1 = rango[0].strip()
        p2 = rango[1].strip()
        f1 = _norm_fecha(p1)
        f2 = _norm_fecha(p2)
        if f1 and f2 and f1 != p1 and f2 != p2:
            return f"{f1} – {f2}"
    return _norm_fecha(s)

def _fecha_valida_normalizada(valor):
    f = _norm_fecha(valor)
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', f or "")
    if not m:
        return ""
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (2000 <= y <= 2099 and 1 <= mo <= 12 and 1 <= d <= 31):
        return ""
    try:
        datetime(y, mo, d)
    except ValueError:
        return ""
    return f

def extraer_fecha_factura_del_texto(texto_bruto):
    """Busca una fecha plausible en el OCR, priorizando etiquetas de factura/emision."""
    texto = str(texto_bruto or "")
    if not texto.strip():
        return ""

    candidatos = []
    patrones_fecha = [
        r'\b\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}\b',
        r'\b\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}\b',
        r'\b\d{1,2}\s+(?:de\s+)?[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\.?\s+(?:de\s+)?\d{4}\b',
        r'\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\.?\s+\d{1,2},?\s+\d{4}\b',
        r'\b\d{1,2}[\s\-\.]+[A-Za-z]{3,12}[\s\-\.]+\d{4}\b',
    ]
    etiqueta_rx = re.compile(
        r'(fecha\s*(?:de\s*)?(?:factura|emision|emisión|expedicion|expedición)|'
        r'invoice\s*date|date\s*of\s*issue|issue\s*date|billing\s*date|'
        r'fecha|date)',
        re.IGNORECASE
    )
    fuerte_rx = re.compile(
        r'(invoice\s*date|fecha\s*(?:de\s*)?(?:factura|emision|emisión|expedicion|expedición))',
        re.IGNORECASE
    )
    penaliza_rx = re.compile(
        r'(vencimiento|due\s*date|payment|pago|period|periodo|período|service|servicio|desde|hasta|from|to)',
        re.IGNORECASE
    )

    for pat in patrones_fecha:
        for m in re.finditer(pat, texto, re.IGNORECASE):
            raw = m.group(0).strip(" .,:;")
            fecha = _fecha_valida_normalizada(raw)
            if not fecha:
                continue
            ini = max(0, m.start() - 80)
            fin = min(len(texto), m.end() + 40)
            contexto = texto[ini:fin]
            score = 1
            if etiqueta_rx.search(contexto):
                score += 5
            if fuerte_rx.search(contexto):
                score += 4
            if penaliza_rx.search(contexto) and not fuerte_rx.search(contexto):
                score -= 3
            candidatos.append((score, m.start(), fecha, raw))

    if not candidatos:
        return ""
    candidatos.sort(key=lambda x: (-x[0], x[1]))
    mejor = candidatos[0]
    log.info(f"  -> Fecha fallback OCR: {mejor[2]} (texto: {mejor[3]!r}, score {mejor[0]})")
    return mejor[2]

def _norm_fecha(s):
    s = str(s or "").strip()
    # AAAA-MM-DD
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', s)
    if m:
        return f"{int(m.group(3)):02d}/{int(m.group(2)):02d}/{m.group(1)}"
    # DD/MM/AAAA o variantes
    m = re.match(r'^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$', s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if len(y) == 2:
            y = "20" + y
        if mo > 12 and d <= 12:
            d, mo = mo, d
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{d:02d}/{mo:02d}/{y}"
    # "15 de Enero de 2024"
    m = re.match(r'^(\d{1,2})\s+(?:de\s+)?([a-zA-Záéíóúñ]+)\s+(?:de\s+)?(\d{4})$', s, re.IGNORECASE)
    if m:
        d = int(m.group(1))
        mo = MESES_MAP.get(m.group(2).lower(), 0)
        y = m.group(3)
        if mo and 1 <= d <= 31:
            return f"{d:02d}/{mo:02d}/{y}"
    # "January 15, 2024"
    m = re.match(r'^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$', s, re.IGNORECASE)
    if m:
        mo = MESES_MAP.get(m.group(1).lower(), 0)
        d = int(m.group(2))
        y = m.group(3)
        if mo and 1 <= d <= 31:
            return f"{d:02d}/{mo:02d}/{y}"
    # "05-FEB-2025" / "05 FEB 2025"
    m = re.match(r'^(\d{1,2})[\s\-\.]+([a-zA-Z]+)[\s\-\.]+(\d{4})$', s, re.IGNORECASE)
    if m:
        d = int(m.group(1))
        mo = MESES_MAP.get(m.group(2).lower(), 0)
        y = m.group(3)
        if mo and 1 <= d <= 31:
            return f"{d:02d}/{mo:02d}/{y}"
    # "Enero 2024" → 01/01/2024
    m = re.match(r'^([a-zA-Záéíóúñ]+)\s+(\d{4})$', s, re.IGNORECASE)
    if m:
        mo = MESES_MAP.get(m.group(1).lower(), 0)
        y = m.group(2)
        if mo:
            return f"01/{mo:02d}/{y}"
    # Fallback: buscar fecha dentro del string
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})', s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if len(y) == 2:
            y = "20" + y
        if mo > 12 and d <= 12:
            d, mo = mo, d
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{d:02d}/{mo:02d}/{y}"
    return s

def normalizar_duracion(dur):
    if not dur:
        return ""
    s = str(dur).strip()
    partes = re.split(r'\s*[–\-—]\s*', s, maxsplit=1)
    if len(partes) == 2:
        p1 = partes[0].strip()
        p2 = partes[1].strip()
        f1 = _norm_fecha(p1)
        f2 = _norm_fecha(p2)
        if f1 and f2 and f1 != p1 and f2 != p2:
            return f"{f1} – {f2}"
    t = s.lower()
    if re.search(r'annual|anual|año|year|yearly', t):
        return "Anual (12 meses)"
    if re.search(r'semestral|6\s*mes', t):
        return "Semestral (6 meses)"
    if re.search(r'trimestral|3\s*mes|quarter', t):
        return "Trimestral (3 meses)"
    m = re.search(r'(\d+)\s*mes', t)
    if m:
        return f"{m.group(1)} meses"
    m = re.search(r'(\d+)\s*(year|año)', t)
    if m:
        return f"{int(m.group(1))*12} meses"
    return s


def _periodo_exacto_para_concepto(duracion: str) -> str:
    """Devuelve un rango DD/MM/AAAA - DD/MM/AAAA solo cuando ambas fechas son claras."""
    s = str(duracion or "").strip()
    if not s:
        return ""
    partes = re.split(r'(?:\s+[–—-]\s+|\s+\ba\b\s+|\s+\bal\b\s+|\s+\bto\b\s+)', s, maxsplit=1, flags=re.IGNORECASE)
    if len(partes) != 2:
        return ""
    izquierda, derecha = partes[0].strip(), partes[1].strip()
    year_derecha = re.search(r'\b(20\d{2}|19\d{2})\b', derecha)
    if year_derecha and not re.search(r'\b(20\d{2}|19\d{2})\b', izquierda):
        izquierda = f"{izquierda} {year_derecha.group(1)}"
    f1 = _norm_fecha(izquierda)
    f2 = _norm_fecha(derecha)
    if _fecha_valida_normalizada(f1) and _fecha_valida_normalizada(f2):
        return f"{f1} - {f2}"
    return ""


# ═══════════════════════════════════════════════════════════════════
# IMPORTES
# ═══════════════════════════════════════════════════════════════════

def parsear_importe(valor):
    if not valor:
        return 0.0
    raw = str(valor)
    negativo = bool(re.search(r'(^|[\s(])-', raw))
    limpio = re.sub(r'[€$£\s]', '', raw)
    limpio = re.sub(r'(?i)(EUR|USD|GBP|CAD|CHF)', '', limpio).strip()
    limpio = re.sub(r'[^\d.,]', '', limpio)
    if not limpio:
        return 0.0
    np_ = limpio.count('.')
    nc = limpio.count(',')
    try:
        if np_ >= 1 and nc >= 1:
            if limpio.rfind(',') > limpio.rfind('.'):
                val = float(limpio.replace('.','').replace(',','.'))
            else:
                val = float(limpio.replace(',',''))
            return -val if negativo else val
        if nc >= 1 and np_ == 0:
            if nc > 1:
                val = float(limpio.replace(',',''))
                return -val if negativo else val
            p = limpio.split(',')
            if len(p) == 2:
                val = float(limpio.replace(',','.')) if len(p[1]) <= 2 else float(limpio.replace(',',''))
                return -val if negativo else val
            val = float(limpio.replace(',','.'))
            return -val if negativo else val
        if np_ >= 1 and nc == 0:
            if np_ > 1:
                val = float(limpio.replace('.',''))
                return -val if negativo else val
            p = limpio.split('.')
            if len(p) == 2:
                val = float(limpio) if len(p[1]) <= 2 else float(limpio.replace('.',''))
                return -val if negativo else val
            val = float(limpio)
            return -val if negativo else val
        val = float(limpio)
        return -val if negativo else val
    except Exception:
        return 0.0

def normalizar_importe(valor):
    """Devuelve SOLO el número en formato europeo: 1.234,56"""
    if not valor:
        return ""
    solo_num = re.sub(r'[^\d.,€$£]', ' ', str(valor)).strip()
    match = re.search(r'[\d.,]+', solo_num)
    if not match:
        return ""
    num = parsear_importe(match.group(0))
    if num == 0.0:
        return ""
    if num > MAX_IMPORTE:
        return ""
    entero = int(num)
    decimal = round((num - entero) * 100)
    return f"{entero:,}".replace(",", ".") + f",{decimal:02d}"

def es_nif_persona_fisica(nif):
    v = re.sub(r'[^A-Z0-9]', '', str(nif or "").upper())
    return bool(re.match(r'^\d{8}[A-Z]$', v) or re.match(r'^[XYZ]\d{7}[A-Z]$', v))

def contiene_retencion_irpf(texto):
    return re.search(r'\b(irpf|retenci[oó]n|retenido|withholding|retention)\b', str(texto or ""), re.IGNORECASE) is not None

def detectar_irpf_porcentaje(texto):
    patrones = [
        r'(?:irpf|retenci[oó]n|retencion|withholding|retention)[^\n%]{0,45}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%',
        r'(\d{1,2}(?:[.,]\d{1,2})?)\s*%[^\n]{0,35}(?:irpf|retenci[oó]n|retencion|withholding|retention)',
    ]
    for pat in patrones:
        m = re.search(pat, str(texto or ""), re.IGNORECASE)
        if m:
            try:
                pct = float(m.group(1).replace(",", "."))
            except Exception:
                continue
            if 0 < pct <= 60:
                return pct
    return None

def extraer_irpf_importe_del_texto(texto):
    lineas = [ln.strip() for ln in str(texto or "").splitlines() if ln.strip()]
    for i, linea in enumerate(lineas):
        if not re.search(r'\b(irpf|retenci[oó]n|retencion|withholding|retention)\b', linea, re.IGNORECASE):
            continue
        ventana = " ".join(lineas[i:min(len(lineas), i + 2)])
        candidatos = []
        for m in re.finditer(r'[-−]?\s*\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|[-−]?\s*\d+(?:\.\d{2})', ventana):
            raw = m.group(0).strip()
            despues = ventana[m.end():m.end() + 3]
            if "%" in despues:
                continue
            val = abs(parsear_importe(raw))
            if 0 < val <= MAX_IMPORTE:
                candidatos.append(val)
        if candidatos:
            return normalizar_importe(f"{max(candidatos):.2f}")
    return ""

def mayor_importe_preextraido(importes_pre):
    nums = [(txt, val) for txt, val in (importes_pre or []) if val and val > 0]
    if not nums:
        return ""
    _, mayor = max(nums, key=lambda x: x[1])
    return normalizar_importe(f"{mayor:.2f}")

def detectar_moneda(texto):
    t = (texto or "").upper()
    if re.search(r'\bUSD\b|\bDOLLAR\b', t) or ('$' in t and '€' not in t):
        return "USD"
    if re.search(r'\bGBP\b|\bPOUND\b', t) or '£' in t:
        return "GBP"
    if re.search(r'\bCHF\b', t):
        return "CHF"
    return "EUR"

def detectar_idioma(texto):
    t = texto.lower()
    scores = {
        'es': sum(1 for w in ['factura','importe','pagar','fecha','proveedor','base','cliente','concepto'] if w in t),
        'en': sum(1 for w in ['invoice','amount','due','payment','total','date','bill','receipt','description'] if w in t),
        'fr': sum(1 for w in ['facture','montant','payer','fournisseur','client'] if w in t),
        'de': sum(1 for w in ['rechnung','betrag','zahlen','lieferant','kunde'] if w in t),
    }
    return max(scores, key=scores.get) if max(scores.values()) > 0 else 'es'

def preextraer_importes(texto):
    patrones = [
        r'(-?\d{1,3}(?:\.\d{3})+,\d{2})',
        r'(-?\d{1,3}(?:,\d{3})+\.\d{2})',
        r'(-?\d+,\d{2})\b',
        r'(-?\d+\.\d{2})\b',
    ]
    importes = {}
    for pat in patrones:
        for m in re.finditer(pat, texto):
            txt = m.group(1)
            val = parsear_importe(txt)
            if 0.01 < val < MAX_IMPORTE:
                importes[txt] = val
    return sorted(importes.items(), key=lambda x: x[1], reverse=True)

def extraer_total_del_texto(texto):
    lineas = texto.split('\n')
    for i, linea in enumerate(lineas):
        if re.search(r'\b(grand\s+total|total\s+(?:a\s+)?pagar|amount\s+due|importe\s+total)\b', linea, re.IGNORECASE):
            bloque = " ".join(lineas[i:i+4])
            nums = []
            for num in re.findall(r'\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2}', bloque):
                n = parsear_importe(num)
                if n > 0:
                    nums.append((num, n))
            if nums:
                nums.sort(key=lambda x: x[1], reverse=True)
                return nums[0]
    patrones = [
        r'total\s+(?:a\s+)?pagar\s*[:\s]*([0-9][0-9.,\s]*)',
        r'amount\s+due\s*[:\s]*([0-9][0-9.,\s]*)',
        r'grand\s+total\s*[:\s]*([0-9][0-9.,\s]*)',
        r'importe\s+total\s*[:\s]*([0-9][0-9.,\s]*)',
        r'total\s+factura\s*[:\s]*([0-9][0-9.,\s]*)',
        r'total\s+invoice\s*[:\s]*([0-9][0-9.,\s]*)',
        r'(?:^|\s)total\s+(?:con\s+)?iva\s*[:\s]*([0-9][0-9.,\s]*)',
        r'(?:^|\s)total\s*[:\=\s]+([0-9][0-9.,\s]*)',
    ]
    for linea in reversed(lineas):
        for pat in patrones:
            m = re.search(pat, linea, re.IGNORECASE)
            if m:
                cand = m.group(1).strip().split()[0]
                n = parsear_importe(cand)
                if n > 0:
                    return cand, n
    importes = []
    for linea in reversed(lineas[-25:]):
        for num in re.findall(r'\d+[.,]\d+', linea):
            n = parsear_importe(num)
            if n > 0:
                importes.append((num, n))
    if importes:
        importes.sort(key=lambda x: x[1], reverse=True)
        return importes[0]
    return "", 0.0

def extraer_base_del_texto(texto):
    patrones = [
        r'(?:base\s+imponible|subtotal|sub\s*total|net\s+amount|neto|base)\s*[:\s]*([0-9][0-9.,\s]*)',
        r'(?:taxable\s+(?:amount|base))\s*[:\s]*([0-9][0-9.,\s]*)',
    ]
    for pat in patrones:
        m = re.search(pat, texto, re.IGNORECASE)
        if m:
            cand = m.group(1).strip().split()[0]
            n = parsear_importe(cand)
            if n > 0:
                return cand, n
    return "", 0.0

def detectar_iva_porcentaje(texto):
    """Devuelve el % IVA si lo encuentra (0-30), None si no."""
    patrones = [
        r'(?:iva|i\.v\.a\.|vat|tax|impuesto)\s*[:\s]*(\d{1,2})\s*%',
        r'(\d{1,2})\s*%\s*(?:iva|i\.v\.a\.|vat|tax)',
        r'(?:iva|vat)\s+(\d{1,2})\b',
    ]
    for pat in patrones:
        m = re.search(pat, texto, re.IGNORECASE)
        if m:
            pct = float(m.group(1))
            if 0 <= pct <= 30:
                return pct
    return None

def validar_coherencia_matematica(base, iva_pct, total):
    if base <= 0 or total <= 0:
        return True, total
    if iva_pct and iva_pct > 0:
        total_esperado = base * (1 + iva_pct / 100)
    else:
        return base <= total * 1.01, total
    margen = total_esperado * 0.02
    return abs(total - total_esperado) <= margen, total_esperado

def fallback_matematico(importes_pre, base_num, iva_pct):
    if not importes_pre:
        return {}, []
    nums = [(txt, val) for txt, val in importes_pre if val > 0]
    if not nums:
        return {}, []
    total_txt, total_val = nums[0]
    resultado = {"total_pagar": total_txt}
    if iva_pct and iva_pct > 0:
        base_calc = total_val / (1 + iva_pct / 100)
        resultado["base_imponible"] = f"{base_calc:.2f}"
        resultado["iva_porcentaje"] = str(int(iva_pct))
        resultado["iva_importe"] = f"{total_val - base_calc:.2f}"
    elif len(nums) >= 2:
        base_txt, base_val = nums[1]
        if base_val < total_val:
            resultado["base_imponible"] = base_txt
            iva_val = total_val - base_val
            resultado["iva_importe"] = f"{iva_val:.2f}"
            if base_val > 0:
                pct = round((iva_val / base_val) * 100)
                if 0 <= pct <= 30:
                    resultado["iva_porcentaje"] = str(pct)
    return resultado, ["Total por fallback matemático"]


def extraer_importes_aws_summary(texto: str) -> dict:
    """Extrae importes del Invoice Summary de AWS evitando mezclar EUR/USD y detalles."""
    txt = str(texto or "")
    if not re.search(r'amazon\s+web\s+services|aws\s+service\s+charges|vat\s+invoice\s+number', txt, re.IGNORECASE):
        return {}
    lineas = [ln.strip() for ln in txt.splitlines() if ln.strip()]
    if not any(re.search(r'\bInvoice Summary\b', ln, re.IGNORECASE) for ln in lineas):
        return {}

    amount_rx = re.compile(r'\b(EUR|USD|GBP)\s+(-?[0-9][0-9.,]*)\b', re.IGNORECASE)

    def amounts_after(label_rx: str, max_next: int = 8):
        out = []
        label = re.compile(label_rx, re.IGNORECASE)
        for i, linea in enumerate(lineas):
            if not label.search(linea):
                continue
            for ln in lineas[i:min(len(lineas), i + max_next + 1)]:
                for m in amount_rx.finditer(ln):
                    out.append((m.group(1).upper(), m.group(2)))
            if out:
                return out
        return out

    total_amounts = amounts_after(r'^TOTAL\s+AMOUNT(?:\s+DUE\s+ON)?\b', 10)
    if not total_amounts:
        total_amounts = amounts_after(r'^AWS\s+Service\s+Charges\b', 6)
    if not total_amounts:
        return {}

    moneda = ""
    m_pref = re.search(r'You have selected\s+(EUR|USD|GBP)\s+as your preferred payment currency', txt, re.IGNORECASE)
    if m_pref:
        moneda = m_pref.group(1).upper()
    else:
        moneda = total_amounts[0][0]

    def pick(amounts, currency=moneda):
        for cur, val in amounts:
            if cur.upper() == currency:
                return val
        return ""

    total = pick(total_amounts)
    base = pick(amounts_after(r'^Net\s+Charges\s*\(After Credits/Discounts,\s*excl\.\s*Tax\)', 6))
    iva = pick(amounts_after(r'^VAT\s*-\s*\d{1,2}\s*%', 6))
    if not iva:
        iva = pick(amounts_after(r'^TOTAL\s+VAT\b', 4))

    res = {}
    if base:
        res["base_imponible"] = normalizar_importe(base)
    if total:
        res["total_pagar"] = normalizar_importe(total)
    if iva:
        res["iva_importe"] = normalizar_importe(iva)
    if moneda:
        res["moneda"] = moneda
    if iva:
        res["iva_porcentaje"] = "21%"
    return res


def guia_es_amazon_web_services(guia: dict | None) -> bool:
    if not guia:
        return False
    proveedor = str(guia.get("proveedor_nombre", "") or "").lower()
    contexto = str(guia.get("contexto_manual", "") or "").lower()
    return "amazon web services" in proveedor or "aws" in contexto


# ═══════════════════════════════════════════════════════════════════
# NÚMERO DE FACTURA
# ═══════════════════════════════════════════════════════════════════

_PATRON_NUM = re.compile(
    r'(?:invoice\s*(?:no\.?|n[º°o]?\.?|number|#|num\.?)|'
    r'rechnungs\s*[- ]?\s*(?:nr\.?|nummer|no\.?|#)|rechnung\s*(?:nr\.?|nummer|#)|'
    r'factura\s*(?:n[oº°]?\.?|número|num\.?|#)|'
    r'n[uú]mero\s*/\s*number|numero\s*/\s*number|'
    r'n[oº°]?\.\s*(?:factura|invoice)?|'
    r'ref(?:erence)?\.?\s*(?:no\.?|#)?|'
    r'folio|serie|número\s+de\s+(?:factura|pedido)|'
    r'bill\s*(?:no\.?|#|number)|'
    r'receipt\s*(?:no\.?|#|number))'
    r'\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-\/\._]{1,30})',
    re.IGNORECASE
)

def extraer_numero_factura_del_texto(texto, nombre_archivo: str = "", guia: dict | None = None):
    candidatos = extraer_candidatos_numero_factura(texto, nombre_archivo, guia)
    if candidatos:
        return candidatos[0]["valor"]
    texto_norm = (texto or "").replace("—", "-").replace("–", "-")
    for linea in texto_norm.splitlines():
        m = _PATRON_NUM.search(linea)
        if m:
            cand = m.group(1).strip(" .,:;")
            if es_numero_factura_valido(cand, linea):
                return cand
    m = _PATRON_NUM.search(texto_norm)
    if m:
        cand = m.group(1).strip(" .,:;")
        contexto = texto_norm[max(0, m.start() - 50):m.end() + 50]
        if es_numero_factura_valido(cand, contexto):
            return cand
    for pat in [r'[A-Z]{1,4}[\-\/]?\d{4}[\-\/]?\d{1,6}', r'[A-Z]{1,4}\d{4,10}']:
        m = re.search(pat, texto_norm)
        contexto = texto_norm[max(0, m.start() - 50):m.end() + 50] if m else ""
        if m and es_numero_factura_valido(m.group(0), contexto):
            return m.group(0)
    return ""


# ═══════════════════════════════════════════════════════════════════
# UTILS
# ═══════════════════════════════════════════════════════════════════

def limpiar_nombre(texto, max_len=40):
    if not texto:
        return ""
    n = unicodedata.normalize("NFD", texto)
    n = "".join(c for c in n if unicodedata.category(c) != "Mn")
    n = re.sub(r"[^a-zA-Z0-9 \-_]", "", n).strip().replace(" ", "_")
    return n[:max_len]

def es_numero_valido(num):
    if not num:
        return False
    l = num.strip()
    if len(l) < 2:
        return False
    if re.match(r'^[A-Za-z\s]{4,}$', l):
        return False
    if not re.search(r'\d', l):
        return False
    return True

def parece_id_fiscal(valor):
    if not valor:
        return False
    v = re.sub(r"\s+", "", str(valor).upper())
    if re.match(r'^(?:ES|IE|DE|DK|EU|GB|FR|IT|NL|PT|EE|BE|AT|SE|FI|NO|PL|CZ|HU|US)?[A-Z]\d{7,12}[A-Z0-9]?$', v):
        return True
    if re.match(r'^(?:EU|IE|DE|DK|GB|FR|IT|NL|PT|EE|BE|AT|SE|FI|NO|PL|CZ|HU)\d{6,12}[A-Z0-9]*$', v):
        return True
    return False

def parece_fecha_como_numero_factura(valor):
    if not valor:
        return False
    v_raw = re.sub(r'\s+', ' ', str(valor).strip().upper()).replace(",", "")
    v = re.sub(r'\s+', '', v_raw)
    meses = (
        "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|"
        "ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SEPT|OCT|NOV|DIC"
    )
    meses_largos = (
        "JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|"
        "ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SETIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE"
    )
    if re.match(rf'^(?:{meses_largos})\s+\d{{1,2}}\s+\d{{2,4}}$', v_raw, re.IGNORECASE):
        return True
    if re.match(rf'^\d{{1,2}}\s+(?:{meses_largos})\s+\d{{2,4}}$', v_raw, re.IGNORECASE):
        return True
    if re.match(rf'^\d{{1,2}}[-_/\.](?:{meses})[-_/\.]\d{{2,4}}$', v, re.IGNORECASE):
        return True
    if re.match(rf'^(?:{meses})[-_/\.]\d{{2,4}}$', v, re.IGNORECASE):
        return True
    if re.match(r'^\d{1,2}[-_/\.]\d{1,2}[-_/\.]\d{2,4}$', v):
        return True
    m = re.match(r'^(\d{4})(\d{2})(\d{2})$', v)
    if m:
        yyyy, mm, dd = map(int, m.groups())
        if 1900 <= yyyy <= 2100 and 1 <= mm <= 12 and 1 <= dd <= 31:
            return True
    return False

def es_numero_factura_valido(num, contexto=""):
    if not es_numero_valido(num):
        return False
    if parece_fecha_como_numero_factura(num):
        return False
    if parece_id_fiscal(num):
        return False
    if contexto and re.search(r'\b(vat|nif|cif|tax\s*id|taxpayer|ein|siret|iva|ust[-\s]*id|registro\s+de\s+iva)\b', contexto, re.IGNORECASE):
        return False
    return True

def _normalizar_codigo_factura(cand: str) -> str:
    cand = str(cand or "").strip()
    cand = cand.strip(" .,:;()[]{}")
    cand = re.sub(r'^[#:\-_\s]+|[#:\-_\s]+$', '', cand)
    cand = re.sub(r'\s*([\-\/\._])\s*', r'\1', cand)
    return cand.upper() if re.search(r'[A-Z]', cand, re.IGNORECASE) else cand

def _es_codigo_factura_especial(cand: str, texto_contexto: str = "") -> bool:
    cand = _normalizar_codigo_factura(cand)
    contexto = str(texto_contexto or "")
    if re.match(r'^I(?:EE|EN)\d{10,16}$', cand):
        return True
    return False

def _valor_a_regex_patron(valor: str) -> str:
    valor = str(valor or "").strip()
    if not valor or parece_fecha_como_numero_factura(valor):
        return ""
    v = _normalizar_codigo_factura(valor)
    if re.match(r'^I(?:EE|EN)\d{10,16}$', v):
        return r'^' + v[:3] + r'\d{' + str(len(v) - 3) + r'}$'
    if re.match(r'^[A-Z0-9]{6,12}-\d{3,6}$', v):
        pref = v.split("-", 1)[0]
        return r'^[A-Z0-9]{' + str(len(pref)) + r'}-\d{' + str(len(v.split("-", 1)[1])) + r'}$'
    if re.match(r'^[A-Z]{1,4}-\d{6,10}-\d{3,6}$', v):
        partes = v.split("-")
        return r'^[A-Z]{' + str(len(partes[0])) + r'}-\d{' + str(len(partes[1])) + r'}-\d{' + str(len(partes[2])) + r'}$'
    if re.match(r'^[A-Z]{1,5}\d{4,16}$', v):
        letras = re.match(r'^[A-Z]+', v).group(0)
        return r'^' + re.escape(letras) + r'\d{' + str(len(v) - len(letras)) + r'}$'
    if re.match(r'^\d{7,14}$', v):
        return r'^\d{' + str(len(v)) + r'}$'
    return ""

def describir_patron_numero_factura(valor: str, texto_ocr: str = "") -> dict:
    valor = _normalizar_codigo_factura(valor)
    regex = _valor_a_regex_patron(valor)
    if not valor or parece_fecha_como_numero_factura(valor):
        return {"descripcion": "No usar fechas como numero de factura", "regex": ""}
    desc = ""
    if regex.startswith("^IEE") or regex.startswith("^IEN"):
        desc = "Codigo Adobe IEE/IEN seguido de digitos; suele aparecer en Informacion de facturacion junto a Numero de factura. No usar la fecha ni Transaction No."
    elif "-" in valor:
        desc = "Identificador alfanumerico con guiones; buscarlo junto a etiquetas de numero de factura, invoice number o factura numero."
    elif re.match(r'^\d+$', valor):
        desc = "Identificador numerico; solo aceptarlo si esta junto a etiqueta clara de numero de factura, no junto a fecha, orden o cliente."
    else:
        desc = "Identificador alfanumerico; buscarlo junto a etiquetas de numero de factura."
    return {"descripcion": desc, "regex": regex}

def enmascarar_contexto_entrenamiento(texto: str, numero_factura: str = "") -> str:
    texto = str(texto or "")[:500]
    numero_factura = str(numero_factura or "").strip()
    if numero_factura:
        texto = texto.replace(numero_factura, "<NUMERO_FACTURA>")
    texto = re.sub(r'\b\d{1,2}[-_/\.](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|ENE|ABR|AGO|DIC)[-_/\.]\d{2,4}\b', "<FECHA>", texto, flags=re.IGNORECASE)
    texto = re.sub(r'\b\d{1,2}[-_/\.]\d{1,2}[-_/\.]\d{2,4}\b', "<FECHA>", texto)
    texto = re.sub(r'\b\d+[.,]\d{2}\b', "<IMPORTE>", texto)
    return texto

def _compila_regex_guia(guia: dict | None):
    if not guia:
        return []
    regs = []
    def add_regex(rx):
        rx = str(rx or "").strip()
        if not rx:
            return
        regs.append(rx)
        if rx.startswith("^") and rx.endswith("$") and len(rx) > 2:
            regs.append(r"\b(?:" + rx[1:-1] + r")\b")

    for fuente in [guia, *guia.get("ejemplos_validados", [])]:
        if not isinstance(fuente, dict):
            continue
        for key in ("numero_factura_regex", "numero_factura_patron_regex"):
            add_regex(fuente.get(key))
        patron = str(fuente.get("numero_factura_patron", "") or "")
        for rx in re.findall(r'/(.*?)/', patron):
            add_regex(rx)

    compilados = []
    vistos = set()
    for rx in regs:
        if rx in vistos:
            continue
        vistos.add(rx)
        try:
            compilados.append(re.compile(rx, re.IGNORECASE | re.MULTILINE))
        except re.error:
            pass
    return compilados

def _puntuar_candidato_numero(cand: str, contexto: str, fuente: str, guia: dict | None = None, nombre_archivo: str = "") -> int:
    cand = _normalizar_codigo_factura(cand)
    contexto = str(contexto or "")
    texto_eval = f"{nombre_archivo}\n{contexto}"
    if _es_codigo_factura_especial(cand, texto_eval):
        score = 85
    elif not es_numero_factura_valido(cand, contexto):
        return -999
    else:
        score = 10
    ctx_low = contexto.lower()
    etiqueta_fuerte = bool(re.search(
        r'invoice\s*(?:number|no|n[º°o]|#)|'
        r'rechnungs\s*[- ]?\s*(?:nr|nummer)|rechnung\s*(?:nr|nummer)|'
        r'n[uú]mero\s*/\s*number|numero\s*/\s*number|'
        r'n[uú]mero\s+de\s+factura|n[ºo]\s*factura|factura\s*(?:n[ºo]|#)',
        ctx_low
    ))
    recibo_ctx = bool(re.search(r'\b(receipt|recibo|total\s+paid|order\s+total|payment\s+received)\b', ctx_low))
    if fuente == "receipt_order" and recibo_ctx:
        etiqueta_fuerte = True
    if etiqueta_fuerte:
        score += 60
    if fuente == "receipt_order" and recibo_ctx:
        score += 65
    if re.search(r'informaci[oó]n\s+de\s+facturaci[oó]n|billing\s+information|invoice\s+details', ctx_low):
        score += 15
    if fuente in ("same_line", "prev_line", "next_line"):
        score += 12
    if fuente == "guia_regex":
        score += 30
    if cand.lower() in str(nombre_archivo or "").lower():
        score += 8
    for rx in _compila_regex_guia(guia):
        if rx.search(cand):
            score += 35
            break
    if re.search(r'\b(date|fecha|due|vencimiento|period|periodo|duraci[oó]n|service\s+period)\b', ctx_low):
        score -= 10 if etiqueta_fuerte else 45
    if re.search(r'\b(order|orden|pedido|purchase|customer|cliente|producto|product|transaction|transacci[oó]n)\b', ctx_low):
        score -= 25
    if re.match(r'^\d{7,14}$', cand) and not re.search(r'invoice|factura|rechnungs|rechnung|receipt|recibo|n[uú]mero', ctx_low):
        score -= 30
    return score

def extraer_candidatos_numero_factura(texto: str, nombre_archivo: str = "", guia: dict | None = None) -> list[dict]:
    texto_norm = (texto or "").replace("—", "-").replace("–", "-").replace("â€”", "-").replace("â€“", "-")
    lineas = [ln.strip() for ln in texto_norm.splitlines() if ln.strip()]
    candidatos = {}

    def add(cand, idx, fuente, extra_ctx=""):
        cand = _normalizar_codigo_factura(cand)
        if not cand or len(cand) > 40:
            return
        ini = max(0, idx - 2)
        fin = min(len(lineas), idx + 3)
        contexto = "\n".join(lineas[ini:fin]) + ("\n" + extra_ctx if extra_ctx else "")
        score = _puntuar_candidato_numero(cand, contexto, fuente, guia, nombre_archivo)
        if score <= -100:
            return
        key = cand.upper()
        actual = candidatos.get(key)
        item = {"valor": cand, "score": score, "fuente": fuente, "contexto": contexto[:350]}
        if not actual or item["score"] > actual["score"]:
            candidatos[key] = item

    etiqueta = re.compile(
        r'(invoice\s*(?:number|no\.?|n[º°o]\.?|#)|'
        r'rechnungs\s*[- ]?\s*(?:nr\.?|nummer)|rechnung\s*(?:nr\.?|nummer)|'
        r'n[uú]mero\s*/\s*number|numero\s*/\s*number|'
        r'n[uú]mero\s+de\s+factura|n[ºo]\s*factura|factura\s*(?:n[ºo]|#))',
        re.IGNORECASE
    )
    etiqueta_recibo = re.compile(r'\border\s+number\b', re.IGNORECASE)
    cand_rx = re.compile(r'\b([A-Z0-9]{4,16}\s*[\-\/]\s*\d{2,8}|[A-Z]{1,6}[\w\-\/\.]{2,30}\d[\w\-\/\.]*|\d{7,14}|I(?:EE|EN)\d{10,16})\b', re.IGNORECASE)
    cand_cerca_etiqueta_rx = re.compile(
        r'\b([A-Z]{0,6}\d{1,6}\s*[\-/]\s*\d{1,8}(?:\s*[\-/]\s*\d{1,8})?|'
        r'[A-Z0-9]{4,16}\s*[\-/]\s*\d{2,8}|'
        r'[A-Z]{1,6}[\w\-\/\.]{2,30}\d[\w\-\/\.]*|'
        r'\d{3,14}|I(?:EE|EN)\d{10,16})\b',
        re.IGNORECASE
    )
    linea_no_numero_factura_rx = re.compile(
        r'[$€£]|\b(total|amount|importe|subtotal|date|due|fecha|vencimiento|iban|swift|vat|nif|cif|tax|'
        r'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|'
        r'sep|sept|september|oct|october|nov|november|dec|december|ene|enero|abr|abril|ago|agosto|dic|diciembre)\b',
        re.IGNORECASE
    )

    for i, linea in enumerate(lineas):
        if etiqueta.search(linea):
            resto = etiqueta.sub(" ", linea)
            for m in cand_cerca_etiqueta_rx.finditer(resto):
                add(m.group(1), i, "same_line")
            if i > 0 and not linea_no_numero_factura_rx.search(lineas[i - 1]):
                for m in cand_cerca_etiqueta_rx.finditer(lineas[i - 1]):
                    add(m.group(1), i - 1, "prev_line", linea)
            if i + 1 < len(lineas) and not linea_no_numero_factura_rx.search(lineas[i + 1]):
                for m in cand_cerca_etiqueta_rx.finditer(lineas[i + 1]):
                    add(m.group(1), i + 1, "next_line", linea)
        if etiqueta_recibo.search(linea):
            ventana_recibo = "\n".join(lineas[max(0, i - 5):min(len(lineas), i + 8)])
            if re.search(r'\b(receipt|recibo|total\s+paid|order\s+total|payment\s+received)\b', ventana_recibo, re.IGNORECASE):
                resto = etiqueta_recibo.sub(" ", linea)
                for m in cand_rx.finditer(resto):
                    add(m.group(1), i, "receipt_order", ventana_recibo)
                if i + 1 < len(lineas):
                    for m in cand_rx.finditer(lineas[i + 1]):
                        add(m.group(1), i + 1, "receipt_order", ventana_recibo)
    for rx in _compila_regex_guia(guia):
        for m in rx.finditer(texto_norm):
            pos = texto_norm[:m.start()].count("\n")
            add(m.group(0), min(pos, max(0, len(lineas) - 1)), "guia_regex")
    for m in re.finditer(r'\bI(?:EE|EN)\d{10,16}\b', texto_norm, re.IGNORECASE):
        pos = texto_norm[:m.start()].count("\n")
        add(m.group(0), min(pos, max(0, len(lineas) - 1)), "codigo_estructural")
    for m in _PATRON_NUM.finditer(texto_norm):
        pos = texto_norm[:m.start()].count("\n")
        add(m.group(1), min(pos, max(0, len(lineas) - 1)), "patron_general")

    return sorted(candidatos.values(), key=lambda x: x["score"], reverse=True)

def extraer_numero_adobe_transaction(texto: str, nombre_archivo: str = "") -> str:
    combinado = f"{nombre_archivo}\n{texto or ''}"
    if not re.search(r'\badobe\b|adobe[_\s-]+transaction|creative\s+cloud', combinado, re.IGNORECASE):
        return ""
    patrones = [
        r'\b(I(?:EE|EN)\d{10,16})\b',
        r'adobe[_\s-]+transaction[_\s-]*(?:no\.?|number|#)?[_\s:.-]*([0-9]{7,12})',
        r'adobe[_\s-]+transaction[_\s-]+no[_\s-]+([0-9]{7,12})',
        r'\btransaction\s*(?:no\.?|number|#)?\s*[:#-]?\s*([0-9]{7,12})\b',
        r'\btransaction[_\s-]+no[_\s-]+([0-9]{7,12})\b',
    ]
    for pat in patrones:
        m = re.search(pat, combinado, re.IGNORECASE)
        if m:
            cand = m.group(1).strip().upper()
            if re.match(r'^I(?:EE|EN)\d{10,16}$', cand):
                return cand
            if es_numero_factura_valido(cand, combinado[max(0, m.start() - 80):m.end() + 80]):
                return cand
    return ""

def parece_nombre_empresa(texto):
    if not texto:
        return False
    t = texto.strip()
    letras = sum(c.isalpha() for c in t)
    digitos = sum(c.isdigit() for c in t)
    if letras > 3 and digitos == 0:
        return True
    if letras > digitos * 3 and len(t) > 6:
        return True
    return False

def validar_nif(nif):
    if not nif:
        return ""
    l = re.sub(r"\s", "", str(nif).upper())
    if re.match(r'^[A-Z0-9][0-9]{7}[A-Z0-9]$', l):
        return l
    if 7 <= len(l) <= 15:
        return l
    return ""

def proveedor_desde_archivo(nombre_archivo):
    if not nombre_archivo:
        return ""
    stem = Path(nombre_archivo).stem
    limpio = re.sub(r'\d{4,}', '', stem)
    limpio = re.sub(r'(?i)(invoice|factura|receipt|bill|order|ref|num|fra|pdf)', '', limpio)
    limpio = re.sub(r'[_\-\.]', ' ', limpio).strip()
    palabras = [p for p in limpio.split() if len(p) > 2 and not re.search(r'\d', p)]
    if palabras:
        return ' '.join(palabras[:3]).title()
    return ""

def generar_nombre_archivo(datos, ext):
    num = limpiar_nombre(datos.get("numero_factura", ""))
    prov = limpiar_nombre(datos.get("proveedor", ""), max_len=30)
    if prov and num and es_numero_factura_valido(datos.get("numero_factura", "")):
        return f"{prov}_{num}{ext}"
    if num and es_numero_factura_valido(datos.get("numero_factura", "")):
        return f"{num}{ext}"
    mes = ""
    fecha = datos.get("fecha_factura", "")
    if fecha:
        for p in re.split(r"[/\-\.\s]", fecha):
            try:
                mv = int(p)
                if 1 <= mv <= 12:
                    mes = MESES_ES[mv]
                    break
            except ValueError:
                pl = p.lower()
                if pl in MESES_MAP:
                    mes = MESES_ES[MESES_MAP[pl]]
                    break
    if prov and mes:
        return f"{prov}_{mes}{ext}"
    elif prov:
        return f"{prov}{ext}"
    return f"factura_{datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"

def nombre_ocr_para_archivo(nombre_archivo):
    return limpiar_nombre(Path(nombre_archivo).stem, max_len=80) + ".txt"

def _norm_busqueda(txt):
    txt = unicodedata.normalize("NFKD", str(txt or ""))
    txt = "".join(ch for ch in txt if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", txt).lower().strip()

def _solo_alnum(txt):
    return re.sub(r"[^A-Za-z0-9]", "", str(txt or "")).upper()

def receptor_confirmado_en_texto(texto_bruto, empresa_receptora="", empresa_cif=""):
    """Confirma el receptor por CIF exacto o por tokens de nombre suficientemente claros."""
    texto_norm = _norm_busqueda(texto_bruto)
    texto_alnum = _solo_alnum(texto_bruto)
    if not texto_norm:
        return False
    cif_norm = _solo_alnum(empresa_cif)
    if cif_norm and cif_norm in texto_alnum:
        return True
    tokens = [
        t for t in re.findall(r"[a-z0-9]{3,}", _norm_busqueda(empresa_receptora))
        if t not in {"sl", "sll", "slu", "sa", "sau", "ltd", "limited", "company", "empresa"}
    ]
    if not tokens:
        return False
    if "dubme" in tokens:
        return re.search(r"\bdubme\b", texto_norm) is not None
    encontrados = sum(1 for t in tokens if re.search(rf"\b{re.escape(t)}\b", texto_norm))
    return encontrados >= min(2, len(tokens))


# ═══════════════════════════════════════════════════════════════════
# VERIFICACIÓN LÓGICA
# ═══════════════════════════════════════════════════════════════════

def verificar_logica(datos, texto_bruto):
    alertas = []
    if not datos.get("numero_factura"):
        alertas.append("Sin número de factura")
    total = parsear_importe(datos.get("total_pagar", ""))
    if total <= 0:
        alertas.append("Total no detectado")
    base = parsear_importe(datos.get("base_imponible", ""))
    if base > 0 and total > 0 and base > total * 1.01:
        alertas.append("Base mayor que total")
    if not datos.get("fecha_factura"):
        alertas.append("Sin fecha")
    if not datos.get("proveedor"):
        alertas.append("Sin proveedor")
    moneda = datos.get("moneda", "EUR")
    if moneda and moneda != "EUR":
        alertas.append(f"Moneda extranjera: {moneda}")
    if total > UMBRAL_DOBLE_CHECK:
        alertas.append(f"Importe alto (>10.000€)")
    if datos.get("_receptor_no_confirmado"):
        alertas.append("Receptor no confirmado en OCR")
    er = datos.get("empresa_receptora", "").strip()
    prov = datos.get("proveedor", "").strip()
    if er and prov and er.lower() == prov.lower():
        alertas.append("Proveedor = receptor (error)")
    return alertas


# ═══════════════════════════════════════════════════════════════════
# PDF / IMAGEN — MULTIPÁGINA
# ═══════════════════════════════════════════════════════════════════

def redimensionar_imagen_bytes(img_bytes):
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(img_bytes))
        w, h = img.size
        max_w = max_ancho_imagen()
        if w > max_w:
            h = int(h * max_w / w)
            w = max_w
        w = max(14, (w // 14) * 14)
        h = max(14, (h // 14) * 14)
        img = img.resize((w, h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        log.warning(f"Error redimensionando imagen: {e}")
        return img_bytes

def pdf_a_png(ruta, pagina=0):
    """Convierte una página de un PDF a PNG."""
    try:
        import fitz
        doc = fitz.open(str(ruta))
        if pagina >= len(doc):
            pagina = 0
        pix = doc[pagina].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
        img = pix.tobytes("png")
        doc.close()
        return img
    except Exception as e:
        log.warning(f"PDF→PNG (pág {pagina}): {e}")
        return b""

def pdf_num_paginas(ruta):
    try:
        import fitz
        doc = fitz.open(str(ruta))
        n = len(doc)
        doc.close()
        return n
    except Exception:
        return 1

def extraer_texto_pdf_multipagina(ruta):
    import fitz
    doc = fitz.open(str(ruta))
    n_paginas = len(doc)
    log.info(f"  → PDF: {n_paginas} página(s)")

    texto_total = ""
    tiene_imagenes = False
    for i, pagina in enumerate(doc):
        texto_pag = pagina.get_text().strip()
        if texto_pag:
            texto_total += f"\n--- Página {i+1} ---\n{texto_pag}"
        try:
            if pagina.get_images(full=True):
                tiene_imagenes = True
        except Exception:
            pass

    if len(texto_total.strip()) >= min_chars_pdf():
        if tiene_imagenes:
            log.info(f"  -> PDF mixto: texto nativo ({len(texto_total)} chars) + imagen(es), OCR complementario...")
            imagenes = []
            for pagina in doc:
                pix = pagina.get_pixmap(matrix=fitz.Matrix(200/72, 200/72))
                imagenes.append(redimensionar_imagen_bytes(pix.tobytes("png")))
            doc.close()
            return texto_total.strip(), imagenes, n_paginas
        log.info(f"  → PDF nativo: {len(texto_total)} chars")
        doc.close()
        return texto_total.strip(), None, n_paginas

    log.info(f"  → PDF escaneado, OCR de {n_paginas} página(s)…")
    imagenes = []
    for pagina in doc:
        pix = pagina.get_pixmap(matrix=fitz.Matrix(200/72, 200/72))
        imagenes.append(redimensionar_imagen_bytes(pix.tobytes("png")))
    doc.close()
    return "", imagenes, n_paginas

def combinar_texto_nativo_y_ocr(texto_nativo, texto_ocr):
    texto_nativo = (texto_nativo or "").strip()
    texto_ocr = (texto_ocr or "").strip()
    if texto_nativo and texto_ocr:
        return (
            "--- TEXTO NATIVO PDF ---\n"
            f"{texto_nativo}\n\n"
            "--- OCR VISUAL COMPLEMENTARIO ---\n"
            f"{texto_ocr}"
        )
    return texto_nativo or texto_ocr

def extraer_imagen(ruta):
    with open(ruta, "rb") as f:
        return redimensionar_imagen_bytes(f.read())

def evaluar_calidad(texto):
    chars = len(texto.strip())
    if chars < 50:
        return "baja"
    if chars < 200:
        return "media"
    return "alta"


# ═══════════════════════════════════════════════════════════════════
# JSON ROBUSTO
# ═══════════════════════════════════════════════════════════════════

def extraer_json_robusto(raw: str) -> dict:
    """Intenta extraer un objeto JSON de la respuesta del LLM, con balance de llaves."""
    if not raw:
        return {}
    # 1. Intentar directo
    limpio = raw.strip()
    if limpio.startswith("```"):
        limpio = re.sub(r'^```(?:json)?\s*', '', limpio)
        limpio = re.sub(r'\s*```$', '', limpio)
    try:
        return json.loads(limpio)
    except Exception:
        pass
    # 2. Buscar con balance de llaves
    start = raw.find('{')
    if start == -1:
        return {}
    depth = 0
    end = -1
    for i in range(start, len(raw)):
        if raw[i] == '{':
            depth += 1
        elif raw[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end > start:
        try:
            return json.loads(raw[start:end])
        except Exception:
            pass
    # 3. Fallback: regex non-greedy (último recurso)
    m = re.search(r'\{[^{}]*\}', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {}


# ═══════════════════════════════════════════════════════════════════
# TEXTO INTELIGENTE PARA PROMPTS
# ═══════════════════════════════════════════════════════════════════

def texto_para_prompt(texto_bruto, max_total=4000, ratio_inicio=0.65):
    """Toma primeros N chars + últimos M chars del texto para no perder datos clave."""
    if len(texto_bruto) <= max_total:
        return texto_bruto.replace('"', "'").replace('\r', ' ')
    inicio = int(max_total * ratio_inicio)
    fin = max_total - inicio
    resultado = texto_bruto[:inicio] + "\n[…texto intermedio omitido…]\n" + texto_bruto[-fin:]
    return resultado.replace('"', "'").replace('\r', ' ')


# ═══════════════════════════════════════════════════════════════════
# OLLAMA — DETECCIÓN MODELOS VISIÓN
# ═══════════════════════════════════════════════════════════════════

MODELOS_VISION_OLLAMA = {
    "llama3.2-vision", "llama3.2-vision:11b", "llama3.2-vision:latest",
    "llava", "llava:7b", "llava:13b", "llava:34b", "llava:latest",
    "llava-phi3", "llava-phi3:latest",
    "moondream", "moondream:latest",
    "bakllava", "bakllava:latest",
    "minicpm-v", "minicpm-v:latest",
}

def es_modelo_vision_ollama(nombre_modelo: str) -> bool:
    """True si el modelo usa /api/chat con imágenes (llama3.2-vision, llava…)."""
    nombre = nombre_modelo.lower().strip()
    if nombre in MODELOS_VISION_OLLAMA:
        return True
    for m in ["llama3.2-vision", "llava", "moondream", "bakllava", "minicpm-v", "vision"]:
        if m in nombre:
            return True
    return False


# ═══════════════════════════════════════════════════════════════════
# OLLAMA — OCR
# ═══════════════════════════════════════════════════════════════════

def llamar_ocr_imagen(img_bytes):
    """
    OCR de una imagen.
    - API externa activa → _ocr_via_api_externa()
    - Modelo visión Ollama (llama3.2-vision, llava…) → /api/chat
    - Modelo clásico (glm-ocr, etc.) → /api/generate
    """
    if usar_vision_externa():
        return _ocr_via_api_externa(img_bytes)
    # Modo visión Ollama activado manualmente: delegar a _llamar_modelo con imagen
    if usar_vision_ollama():
        b64 = base64.b64encode(img_bytes).decode()
        return _llamar_modelo("Extrae TODO el texto de esta imagen de factura exactamente como aparece. Devuelve SOLO el texto.", imagen_b64=b64)

    _modelo = modelo_ocr()
    _url = ollama_url()
    b64 = base64.b64encode(img_bytes).decode()

    if es_modelo_vision_ollama(_modelo):
        log.debug(f"  → OCR visión Ollama: {_modelo}")
        resp = requests.post(f"{_url}/api/chat", json={
            "model": _modelo,
            "messages": [{
                "role": "user",
                "content": (
                    "Extrae TODO el texto de esta imagen de factura exactamente como aparece. "
                    "Incluye: nombres de empresa, direcciones, NIF/CIF/VAT, "
                    "números de factura (Invoice No, Nº Factura, Ref, Folio), "
                    "fechas, TODOS los importes (base, subtotal, IVA% e importe, TOTAL). "
                    "Devuelve SOLO el texto extraído conservando el formato original."
                ),
                "images": [b64],
            }],
            "stream": False,
            "keep_alive": "5m",
        }, timeout=timeout_ollama())
        resp.raise_for_status()
        return resp.json().get("message", {}).get("content", "").strip()
    else:
        log.debug(f"  → OCR clásico Ollama: {_modelo}")
        resp = requests.post(f"{_url}/api/generate", json={
            "model": _modelo,
            "prompt": get_prompt("ocr"),
            "images": [b64],
            "stream": False,
            "keep_alive": "5m",
        }, timeout=timeout_ollama())
        resp.raise_for_status()
        return resp.json().get("response", "").strip()

def _ocr_via_api_externa(img_bytes):
    """OCR usando API externa con soporte de visión (Groq+LlamaVision, GPT-4o, etc.)"""
    b64 = base64.b64encode(img_bytes).decode()
    prompt = (
        "Extrae TODO el texto de esta imagen de factura tal como aparece. "
        "Incluye: nombres de empresa, direcciones, NIFs/CIFs/VAT, "
        "números de factura, fechas, TODOS los importes (base, subtotal, IVA%, importe IVA, TOTAL), "
        "descripción de servicios. "
        "Devuelve SOLO el texto extraído conservando el formato."
    )
    return llamar_api_externa(prompt, imagen_b64=b64)

def llamar_ocr_multipagina(imagenes):
    log.info(f"  → OCR: {len(imagenes)} página(s)…")
    _latido_procesador("ocr")
    textos = []
    for i, img in enumerate(imagenes):
        _latido_procesador("ocr")
        log.info(f"    → OCR pág {i+1}/{len(imagenes)}…")
        try:
            t = llamar_ocr_imagen(img)
            if t:
                textos.append(f"--- Página {i+1} ---\n{t}")
            _latido_procesador("ocr")
        except Exception as e:
            log.error(f"    → Error OCR pág {i+1}: {e}")
    resultado = "\n\n".join(textos)
    log.info(f"  → OCR total: {len(resultado)} chars")
    return resultado


# ═══════════════════════════════════════════════════════════════════
# LLaMA / API EXTERNA — LLAMADAS CON RETRY
# ═══════════════════════════════════════════════════════════════════

def _llamar_modelo(prompt: str, imagen_b64: str = None) -> str:
    """
    Llama al modelo de análisis con retry inteligente.
    Soporta:
      - API externa (Groq texto, OpenAI, Anthropic)
      - Ollama modelos visión (llama3.2-vision, llava) → /api/chat
      - Ollama modelos texto (mistral, llama3.1:8b, nemotron, llama3.2) → /api/generate
    """
    _modelo = modelo_analisis()
    _url = ollama_url()
    for intento in range(LLM_RETRY + 1):
        try:
            if usar_api_externa():
                return llamar_api_externa(prompt, imagen_b64=imagen_b64)

            if es_modelo_vision_ollama(_modelo) and imagen_b64:
                # Modelo visión con imagen: /api/chat
                resp = requests.post(f"{_url}/api/chat", json={
                    "model": _modelo,
                    "messages": [{
                        "role": "user",
                        "content": prompt,
                        "images": [imagen_b64],
                    }],
                    "stream": False,
                    "keep_alive": "5m",
                }, timeout=timeout_ollama())
                resp.raise_for_status()
                return resp.json().get("message", {}).get("content", "").strip()
            else:
                # Modelos texto: mistral, llama3.1:8b, nemotron, llama3.2, etc.
                resp = requests.post(f"{_url}/api/generate", json={
                    "model": _modelo,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "5m",
                }, timeout=timeout_ollama())
                resp.raise_for_status()
                return resp.json().get("response", "").strip()

        except requests.exceptions.Timeout:
            log.warning(f"  → Timeout [{_modelo}] (intento {intento+1}/{LLM_RETRY+1})")
            if intento < LLM_RETRY:
                time.sleep(LLM_RETRY_DELAY)
        except requests.exceptions.ConnectionError:
            log.warning(f"  → Conexión rechazada [{_modelo}] (intento {intento+1}/{LLM_RETRY+1})")
            if intento < LLM_RETRY:
                time.sleep(LLM_RETRY_DELAY * 2)
        except Exception as e:
            log.error(f"  → Error LLM [{_modelo}]: {e}")
            raise
    raise TimeoutError(f"LLM no respondió tras {LLM_RETRY+1} intentos")


# ═══════════════════════════════════════════════════════════════════
# VISION: TODO EN UN PASO (Groq+LlamaVision, GPT-4o, etc.)
# ═══════════════════════════════════════════════════════════════════

def procesar_con_vision_unico_paso(img_bytes_list, empresa_receptora="", nombre_archivo="", guia_entrenamiento=None):
    """Procesa la factura en UN solo paso usando un modelo con visión."""
    log.info("  → Procesando con visión (paso único)…")
    _latido_procesador("vision")

    bloque_prov = ""
    # No tenemos texto aún, pero podemos buscar en el nombre del archivo
    _, datos_prov = buscar_proveedor_en_texto("", nombre_archivo)
    if datos_prov:
        bloque_prov = f'\nPROVEEDOR DETECTADO por nombre de archivo: "{datos_prov["nombre"]}" (NIF: {datos_prov["nif"]})\n'

    bloque_rec = f'\nEmpresa receptora esperada: "{empresa_receptora}". Escríbela solo si aparece claramente como comprador/receptor en la factura. El vendedor es diferente.\n' if empresa_receptora else ""

    prompt = f"""Eres un experto en extracción de datos de facturas. Analiza esta imagen de factura y extrae TODOS los campos.
{bloque_rec}{bloque_prov}
Devuelve SOLO un JSON válido con exactamente estos campos (sin markdown, sin explicaciones):

{{
  "numero_factura": "ID de la factura con dígitos",
  "proveedor": "Nombre del VENDEDOR/emisor (NUNCA la empresa receptora)",
  "empresa_receptora": "{empresa_receptora or 'Empresa compradora'} si aparece claramente; vacío si no",
  "nif_cif": "NIF/CIF del VENDEDOR solamente",
  "fecha_factura": "DD/MM/AAAA",
  "duracion_licencia": "Periodo del servicio si aparece, vacío si no",
  "base_imponible": "Importe base antes de impuestos (SOLO número)",
  "iva_porcentaje": "Porcentaje IVA como dígitos: 21, 10, etc. Vacío si no aparece",
  "iva_importe": "Importe del IVA (SOLO número)",
  "irpf_porcentaje": "Porcentaje IRPF/retención como dígitos; vacío si no aparece",
  "irpf_importe": "Importe retenido de IRPF/retención, positivo aunque aparezca con signo menos",
  "total_pagar": "TOTAL FINAL/líquido a pagar (SOLO número)",
  "moneda": "EUR, USD, GBP, etc.",
  "concepto_mejorado": "Resumen profesional EN ESPAÑOL de lo comprado, máximo 8 palabras",
  "conceptos_originales": "Descripciones originales separadas por |"
}}

REGLAS:
- Factura normal: base_imponible + iva_importe = total_pagar. Autónomos con IRPF: base_imponible + iva_importe - irpf_importe = total_pagar.
- La base_imponible siempre es la base antes de IVA e IRPF; no uses el líquido a pagar como base.
- Si no encuentras un campo, déjalo como cadena vacía "".
- NUNCA escribas "unknown", "n/a" o "null".
- El concepto_mejorado SIEMPRE en español.
- Los importes son SOLO números, sin símbolos de moneda.

JSON:"""

    # Usar la primera imagen (o combinar si hay varias)
    if len(img_bytes_list) == 1:
        b64 = base64.b64encode(img_bytes_list[0]).decode()
        if usar_vision_ollama() and not usar_api_externa():
            # Ollama local visión (qwen3-vl, llama3.2-vision, etc.)
            raw = _llamar_modelo(prompt, imagen_b64=b64)
        else:
            raw = llamar_api_externa(prompt, imagen_b64=b64)
    else:
        # Multipágina: OCR página a página, luego análisis conjunto
        textos_paginas = []
        for i, img in enumerate(img_bytes_list):
            log.info(f"    → Visión pág {i+1}/{len(img_bytes_list)}…")
            b64 = base64.b64encode(img).decode()
            ocr_prompt = "Extrae TODO el texto de esta imagen de factura exactamente como aparece. Devuelve SOLO el texto."
            if usar_vision_ollama() and not usar_api_externa():
                texto_pag = _llamar_modelo(ocr_prompt, imagen_b64=b64)
            else:
                texto_pag = llamar_api_externa(ocr_prompt, imagen_b64=b64)
            if texto_pag:
                textos_paginas.append(f"--- Página {i+1} ---\n{texto_pag}")
        texto_combinado = "\n\n".join(textos_paginas)
        prompt_texto = prompt.replace("Analiza esta imagen de factura", "Analiza esta factura")
        raw = _llamar_modelo(prompt_texto + f"\n\nTexto extraído:\n{texto_para_prompt(texto_combinado)}")

    datos = extraer_json_robusto(raw)
    log.info(f"  → Visión raw: {raw[:300]}")

    # Limpiar campos
    todos_campos = ["numero_factura","proveedor","empresa_receptora","nif_cif","fecha_factura",
                     "duracion_licencia","base_imponible","iva_porcentaje","iva_importe",
                     "irpf_porcentaje","irpf_importe","total_pagar","moneda",
                     "concepto_mejorado","conceptos_originales"]
    for c in todos_campos:
        v = str(datos.get(c, "") or "").strip()
        if v.lower() in ["unknown","n/a","none","null","-"]:
            v = ""
        datos[c] = v

    return datos, raw


# ═══════════════════════════════════════════════════════════════════
# LLaMA — DOBLE LLAMADA (modo clásico Ollama)
# ═══════════════════════════════════════════════════════════════════

def llamar_llama_importes(texto_bruto, importes_pre, total_pre_txt, base_pre_txt, iva_pct, guia_entrenamiento=None):
    log.info("  → LLM [1/2] importes…")
    _latido_procesador("llm")
    lista = ", ".join([f"{txt} ({val:.2f})" for txt, val in importes_pre[:12]])
    texto = texto_para_prompt(texto_bruto, max_total=3500)

    iva_hint = f"{iva_pct}%" if iva_pct else "no detectado"
    # NOTA: la guía de entrenamiento NO se inyecta aquí.
    # Se usa solo en postprocesar como paso de verificación/complemento.

    _tpl_importes = get_prompt("importes")
    prompt = _tpl_importes.format(
        lista=lista,
        total_pre_txt=total_pre_txt or "desconocido",
        base_pre_txt=base_pre_txt or "desconocido",
        iva_hint=iva_hint,
        texto=texto,
    )

    raw = _llamar_modelo(prompt)
    log.info(f"  → importes raw: {raw[:200]}")
    datos = extraer_json_robusto(raw)

    for c in ["base_imponible", "iva_porcentaje", "iva_importe", "irpf_porcentaje", "irpf_importe", "total_pagar"]:
        v = str(datos.get(c, "") or "").strip()
        if v.lower() in ["unknown", "n/a", "none", "null", "-"]:
            v = ""
        datos[c] = v
    return datos

def llamar_llama_campos(texto_bruto, empresa_receptora="", nombre_archivo="", plantilla=None, guia_entrenamiento=None, empresa_cif=""):
    log.info("  → LLM [2/2] campos…")
    _latido_procesador("llm")
    num_pre = extraer_numero_factura_del_texto(texto_bruto, nombre_archivo, guia_entrenamiento)
    prov_archivo = proveedor_desde_archivo(nombre_archivo)
    bloque_prov_conocido = construir_bloque_proveedores_prompt(texto_bruto, nombre_archivo)
    texto = texto_para_prompt(texto_bruto, max_total=4000)

    cif_rec_str = f" (CIF/NIF: {empresa_cif})" if empresa_cif else ""
    bloque_rec = f'\nEmpresa receptora esperada: "{empresa_receptora}"{cif_rec_str}. Escríbela solo si aparece claramente como comprador/receptor. Su CIF es "{empresa_cif}" — NUNCA pongas este CIF en nif_cif; nif_cif es SOLO del VENDEDOR.\n' if empresa_receptora else ""
    bloque_arch = f'\nPista del proveedor por nombre de archivo: "{prov_archivo}"\n' if prov_archivo else ""
    bloque_plant = f'\nPlantilla de referencia: {json.dumps(plantilla, ensure_ascii=False)}\n' if plantilla else ""
    if guia_entrenamiento and entrenamiento_activo():
        bloque_plant += (
            "\n"
            + construir_bloque_entrenamiento(guia_entrenamiento)
            + "\nUsa la guia solo para localizar campos y formatos de este proveedor. "
              "No copies valores antiguos de ejemplos si el OCR actual contiene otros.\n"
        )

    _tpl_campos = get_prompt("campos")
    prompt = _tpl_campos.format(
        bloque_rec=bloque_rec,
        bloque_arch=bloque_arch,
        bloque_prov_conocido=bloque_prov_conocido,
        bloque_plant=bloque_plant,
        num_pre=num_pre,
        empresa_receptora=empresa_receptora,
        texto=texto,
    )

    raw = _llamar_modelo(prompt)
    log.info(f"  → campos raw: {raw[:200]}")
    datos = extraer_json_robusto(raw)

    campos = ["numero_factura","proveedor","empresa_receptora","nif_cif","fecha_factura",
              "duracion_licencia","moneda","concepto_mejorado","conceptos_originales"]
    for c in campos:
        v = str(datos.get(c, "") or "").strip()
        if v.lower() in ["unknown","n/a","none","null","-"]:
            v = ""
        datos[c] = v
    return datos

def aplicar_guia_entrenamiento_postproceso(datos: dict, guia: dict, texto_bruto: str) -> dict:
    """
    Aplica la guía de entrenamiento DESPUÉS de que el LLM ya ha extraído los datos.
    Solo actúa para RELLENAR campos vacíos o CORREGIR inconsistencias conocidas.
    NUNCA sobreescribe un campo que ya tiene valor correcto.
    Esto evita que la guía degrade extracción que ya funcionaba bien.
    """
    if not guia:
        return datos
    log.info(f"  → Postproceso guía entrenamiento: '{guia.get('proveedor_nombre','?')}'")

    # 1. IVA: si la guía dice que no aplica IVA y el LLM puso algo raro, limpiar
    iva_guia = guia.get("iva_comportamiento", "").lower()
    if ("no aplica" in iva_guia or "sin iva" in iva_guia or "vacío" in iva_guia) and datos.get("iva_porcentaje"):
        try:
            v = float(re.sub(r'[^\d.]', '', datos["iva_porcentaje"]))
            if v == 0 or v > 30:
                datos["iva_porcentaje"] = ""
                datos["iva_importe"] = ""
                log.info("  → Guía: IVA limpiado (proveedor sin IVA)")
        except Exception:
            pass

    # 2. Moneda: si la guía tiene moneda y el LLM no detectó nada, usar la de la guía
    if not datos.get("moneda") and guia.get("moneda_habitual"):
        datos["moneda"] = guia["moneda_habitual"]
        log.info(f"  → Guía: moneda completada → {guia['moneda_habitual']}")

    # 3. Proveedor: si el LLM no lo extrajo pero la guía lo tiene
    if not datos.get("proveedor") and guia.get("proveedor_nombre"):
        datos["proveedor"] = guia["proveedor_nombre"]
        log.info(f"  → Guía: proveedor completado → {guia['proveedor_nombre']}")

    # 4. NIF: el NIF de la guía de entrenamiento (validado por el usuario) siempre gana
    #    No solo rellenamos si está vacío — también corregimos si el LLM puso algo incorrecto
    nif_guia = guia.get("nif_proveedor", "")
    if nif_guia:
        if not datos.get("nif_cif"):
            datos["nif_cif"] = nif_guia
            log.info(f"  → Guía: NIF completado → {nif_guia}")
        elif datos.get("nif_cif", "").upper() != nif_guia.upper():
            log.info(f"  → Guía: NIF corregido {datos['nif_cif']!r} → {nif_guia}")
            datos["nif_cif"] = nif_guia

    # 5. Ejemplos validados: si el LLM dejó iva_porcentaje vacío pero los ejemplos
    #    muestran consistentemente un IVA, usar ese valor de referencia
    ejemplos = guia.get("ejemplos_validados", [])
    if ejemplos and not datos.get("iva_porcentaje"):
        ivas = [ej.get("iva_porcentaje", "") for ej in ejemplos if ej.get("iva_porcentaje")]
        if ivas:
            # Mayoría
            from collections import Counter as _Counter
            iva_comun = _Counter(ivas).most_common(1)[0][0]
            if iva_comun and iva_comun != "0":
                datos["iva_porcentaje"] = iva_comun
                log.info(f"  → Guía ejemplos: iva_porcentaje completado → {iva_comun}%")

    candidatos_num = extraer_candidatos_numero_factura(texto_bruto, "", guia)
    cand_guia = next((c for c in candidatos_num if c.get("fuente") == "guia_regex" and c.get("score", 0) >= 70), None)
    if cand_guia:
        actual = _normalizar_codigo_factura(datos.get("numero_factura", ""))
        encaja_guia = actual and any(rx.search(actual) for rx in _compila_regex_guia(guia))
        if not encaja_guia or not es_numero_factura_valido(actual):
            anterior = datos.get("numero_factura", "")
            datos["numero_factura"] = cand_guia["valor"]
            log.info(f"  → Guía ejemplos: número factura corregido {anterior!r} → {cand_guia['valor']!r}")

    return datos


def llamar_llama_verificacion_doble(texto_bruto: str, datos_importes: dict):
    """Verificación independiente de importes para facturas > 10.000€."""
    log.info("  → Verificación doble (importe alto)…")
    _latido_procesador("llm")
    texto = texto_para_prompt(texto_bruto, max_total=3000)
    prompt = f"""VERIFICACIÓN: comprueba independientemente si estos importes son correctos.

Importes a verificar:
- base_imponible: {datos_importes.get('base_imponible','?')}
- iva_porcentaje: {datos_importes.get('iva_porcentaje','?')}
- total_pagar: {datos_importes.get('total_pagar','?')}

Lee la factura y extrae los mismos campos independientemente.
Incluye "verificado": true si tus valores coinciden (margen 1%), false si difieren.

Devuelve SOLO JSON válido:

Texto de la factura:
{texto}

JSON:"""
    try:
        raw = _llamar_modelo(prompt)
        resultado = extraer_json_robusto(raw)
        verificado = resultado.get("verificado", None)
        log.info(f"  → Doble check: verificado={verificado}, total_v2={resultado.get('total_pagar','?')}")
        return resultado, verificado
    except Exception as e:
        log.error(f"  → Doble check error: {e}")
        return {}, None

def liberar_modelos():
    if not usar_api_externa():
        _url = ollama_url()
        for mod in [modelo_ocr(), modelo_analisis()]:
            try:
                requests.post(f"{_url}/api/generate", json={"model": mod, "keep_alive": 0}, timeout=30)
            except Exception as e:
                log.debug(f"Error liberando modelo {mod}: {e}")
    estado_procesador["estado"] = "idle"
    estado_procesador["ts"] = 0

def reset_estado_procesador():
    """Fuerza el reset del estado del procesador. Útil si se quedó bloqueado."""
    estado_procesador["estado"] = "idle"
    estado_procesador["archivo"] = ""
    estado_procesador["ts"] = 0
    log.warning("  ⚠ Estado procesador reseteado manualmente")


# ═══════════════════════════════════════════════════════════════════
# POST-PROCESAMIENTO
# ═══════════════════════════════════════════════════════════════════

def _limpiar_texto_concepto(txt: str) -> str:
    txt = re.sub(r'\s+', ' ', str(txt or '')).strip(" -:;|.,\t\r\n")
    txt = re.sub(r'(?i)\bocr\s+visual\s+complementario\b', '', txt)
    txt = re.sub(r'\b(?:qty|quantity|cantidad|unit price|precio|amount|importe|total|subtotal|vat|iva)\b.*$', '', txt, flags=re.IGNORECASE).strip()
    txt = re.sub(r'\b(?:EUR|USD|GBP|CAD|CHF)\b|[€$£]', '', txt, flags=re.IGNORECASE)
    txt = re.sub(r'\b\d+[.,]\d{2}\b', '', txt).strip(" -:;|.,")
    return re.sub(r'\s+', ' ', txt).strip()

def _concepto_espanol_desde_texto(txt: str) -> str:
    t = _limpiar_texto_concepto(txt)
    low = t.lower()
    if re.search(r'\b(sfx|sfxs|sound effects?|ost|song|music|audio|logo sound|radio)\b', low, re.IGNORECASE):
        return "Musica y efectos de sonido"
    if re.search(r'\bmonster\s+con\s+development\b', low, re.IGNORECASE):
        return "Desarrollo de Monster Con"
    if re.search(r'\b(event\s*\d+|reading\s*\+\s*feedback|softcombat|vtuber|teleprompter|autograph|tabletop|guest)\b', low, re.IGNORECASE):
        return "Guion y feedback de eventos"
    if re.search(r'\b(edici[oó]n|master|mastering|edicion)\b', low, re.IGNORECASE):
        return "Edicion y master de personajes"
    if re.search(r'\b(concept art|illustration|outfit|personajes|characters?)\b', low, re.IGNORECASE):
        return "Arte conceptual e ilustracion"
    if re.search(r'\b(asistencia creativa|creative assistance|trabajo editorial|editorial work)\b', low, re.IGNORECASE):
        return "Asistencia creativa y editorial"
    if re.search(r'creative\s+cloud', low, re.IGNORECASE):
        if re.search(r'todas\s+las\s+aplicaciones|all\s+apps', low, re.IGNORECASE):
            return "Creative Cloud Todas las aplicaciones"
        return "Suscripcion Creative Cloud"
    reglas = [
        (r'chatgpt|openai', "Suscripcion ChatGPT"),
        (r'adobe|creative cloud|frame\.?io|frame io', "Suscripcion Adobe"),
        (r'google cloud|cloud platform|workspace|g suite', "Servicios cloud Google"),
        (r'microsoft|office 365|microsoft 365|azure', "Licencia Microsoft 365"),
        (r'github', "Suscripcion GitHub"),
        (r'deepl', "Suscripcion DeepL"),
        (r'hosting|domain|dominio|server|vps|cloudflare', "Alojamiento web y dominio"),
        (r'programming|programiranje|software development|desarrollo de software|savjetovanje', "Programacion y consultoria informatica"),
        (r'software|licen[cs]e|licencia|subscription|suscripci[oó]n|plan', "Licencia software"),
        (r'consulting|consultoria|consultor[ií]a|professional services', "Servicios de consultoria"),
        (r'service|servicio|services|fee|honorarios', "Servicios profesionales"),
        (r'usage|consumption|characters|tokens|minutes', "Consumo de servicios digitales"),
    ]
    for pat, concepto in reglas:
        if re.search(pat, low, re.IGNORECASE):
            return concepto

    palabras_ruido = {
        "invoice","factura","receipt","recibo","date","fecha","number","numero","nº","no",
        "bill","billing","payment","pago","due","total","subtotal","amount","importe",
        "tax","vat","iva","base","cliente","customer","supplier","proveedor"
    }
    palabras = []
    for p in re.findall(r'[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9+.#/-]*', t):
        if len(p) <= 2 and not re.search(r'\d', p):
            continue
        if p.lower() in palabras_ruido:
            continue
        palabras.append(p)
        if len(palabras) >= 7:
            break
    if palabras:
        return " ".join(palabras)
    return ""

def _texto_plano_celda_ocr(txt: str) -> str:
    txt = re.sub(r'(?i)<br\s*/?>', ' ', str(txt or ''))
    txt = re.sub(r'<[^>]+>', ' ', txt)
    txt = html.unescape(txt)
    return _limpiar_texto_concepto(txt)

def _linea_ruido_concepto(txt: str) -> bool:
    raw = str(txt or "")
    if re.search(r'(?i)\bocr\s+visual\s+complementario\b', raw):
        return True
    t = _limpiar_texto_concepto(txt).lower()
    if not t:
        return True
    if concepto_es_generico(t):
        return True
    if len(t) > 140:
        return True
    if re.search(r'@|\b\w+\.(?:com|es|pizza|fi|io)\b|[a-z]{2}\d{2}\s*\d{4}', t, re.IGNORECASE):
        return True
    if re.fullmatch(r'(?:p[aá]gina|page)\s*\d+|(?:concepto|descripci[oó]n|description|work|fecha|date|precio|price|importe|amount|tarifa|horas/?unidades|horas|unidades|quantity|qty|cant|cant\.|cantida|kopurua|prezioa|unitario|cost|sum|excl\.?\s*vat)+', t, re.IGNORECASE):
        return True
    if re.fullmatch(r'b\.?\s*e\.?\s*%?|%?\s*re', t, re.IGNORECASE):
        return True
    if re.search(r'\b(?:reverse charge|tax to be accounted|subject to tax|tax(?:es)?|impuestos?|p[aá]gina|page|factura|faktura|n[uú]mero|numero|zenbakia|nif|cif|vat id|iban|bic|bank|address|calle|carrer|gran via|barcelona|spain|finland|email|gmail|hotmail|tel|phone|invoice|invoice number|numero de factura|reference number|customer reference|supplier order|freelancer invoice|invoice date|customer id|account id|orden de compra|fecha factura|fecha de vencimiento|vencimiento|billing date|due date|payment|forma de pago|datos bancarios|cuenta para ingreso|period|service period|intereses|subtotal|total|guztira|oinarria|t\s*o\s*t\s*a\s*l|iva|vat|bez|zerga|zergak|irpf|base|base imponible|base imp|retenci[oó]n|retencion|recargo|errekargua|quantity|qty|amount|price|unit price|cost|sum|order|cantidad|importe|tarifa|dtu|dto|incl|excl)\b', t, re.IGNORECASE):
        return True
    if re.fullmatch(r'[\d\s.,:/#%()/-]+|\d+\s*(?:h|x)', t, re.IGNORECASE):
        return True
    return False

def _extraer_candidatos_tablas_ocr(texto: str) -> list:
    candidatos = []
    for tabla in re.findall(r'(?is)<table\b.*?</table>', str(texto or "")):
        filas = re.findall(r'(?is)<tr\b[^>]*>(.*?)</tr>', tabla)
        for fila in filas:
            celdas = re.findall(r'(?is)<t[dh]\b[^>]*>(.*?)</t[dh]>', fila)
            limpias = [_texto_plano_celda_ocr(c) for c in celdas]
            limpias = [c for c in limpias if c]
            if not limpias:
                continue
            fila_txt = " ".join(limpias)
            if _linea_ruido_concepto(fila_txt):
                continue
            # En tablas de factura el primer campo suele ser concepto/descripcion/trabajo.
            primera = limpias[0]
            if not _linea_ruido_concepto(primera):
                candidatos.append(primera)
                continue
            for celda in limpias[1:]:
                if not _linea_ruido_concepto(celda):
                    candidatos.append(celda)
                    break
    return candidatos

def _extraer_candidatos_lineales_ocr(lineas: list) -> list:
    candidatos = []
    cabecera_concepto = False
    cabecera_tabla = 0
    for idx, ln in enumerate(lineas):
        if len(candidatos) >= 20:
            break
        limpia = _texto_plano_celda_ocr(ln)
        if not limpia:
            continue
        if re.search(r'^(?:concepto|description|work|descripci[oó]n)\s*[:\-]?\s*$', limpia, re.IGNORECASE):
            cabecera_concepto = True
            cabecera_tabla = 4
            continue
        m = re.search(r'^(?:concepto|description|work|descripci[oó]n)\s*[:\-]\s*(.{4,120})$', limpia, re.IGNORECASE)
        if m and not _linea_ruido_concepto(m.group(1)):
            candidatos.append(m.group(1))
            continue
        if cabecera_concepto and not _linea_ruido_concepto(limpia):
            candidatos.append(limpia)
            cabecera_concepto = False
            continue
        if cabecera_tabla:
            cabecera_tabla -= 1
            if re.search(r'\b(?:cantidad|amount|price|importe|tarifa|horas|unit|qty|fecha)\b', limpia, re.IGNORECASE):
                continue
            if not _linea_ruido_concepto(limpia):
                candidatos.append(limpia)
                cabecera_tabla = 0
                continue
        if re.search(r'\b(?:concept art|illustration|outfit|edici[oó]n|master|asistencia creativa|trabajo editorial|sound effects?|ost|song|sfx|event\s*\d+|reading\s*\+\s*feedback)\b', limpia, re.IGNORECASE):
            if not _linea_ruido_concepto(limpia):
                candidatos.append(limpia)
                continue
        if idx + 1 < len(lineas) and re.search(r'\b(?:\d+\s*x\s*)?\d+[.,]\d{2}\b|€|\$|eur|usd|\d+\s*h\b', lineas[idx + 1], re.IGNORECASE):
            if not _linea_ruido_concepto(limpia):
                candidatos.append(limpia)
    return candidatos

def _dedupe_conceptos_originales(candidatos: list, limite: int = 8) -> list:
    vistos = set()
    limpios = []
    for cand in candidatos:
        c = _texto_plano_celda_ocr(cand)
        if _linea_ruido_concepto(c):
            continue
        key = re.sub(r'[^a-z0-9]+', '', c.lower())
        if not key or key in vistos:
            continue
        vistos.add(key)
        limpios.append(c[:140])
        if len(limpios) >= limite:
            break
    return limpios

def conceptos_originales_pobres(valor: str, concepto_mejorado: str = "") -> bool:
    partes = _dedupe_conceptos_originales(re.split(r'\s*\|\s*|\n+', str(valor or "")), limite=4)
    if not partes:
        return True
    unido = " | ".join(partes)
    if concepto_mejorado and _limpiar_texto_concepto(unido).lower() == _limpiar_texto_concepto(concepto_mejorado).lower():
        return True
    if concepto_es_generico(unido):
        return True
    return False

def extraer_conceptos_originales_respaldo(texto_bruto: str, valor_actual: str = "") -> str:
    """Devuelve lineas originales del OCR; no resume ni usa ejemplos antiguos como plantilla."""
    candidatos = []
    candidatos.extend(re.split(r'\s*\|\s*|\n+', str(valor_actual or "")))
    candidatos.extend(_extraer_candidatos_tablas_ocr(texto_bruto))
    lineas = [ln.strip() for ln in str(texto_bruto or "").splitlines() if ln.strip()]
    candidatos.extend(_extraer_candidatos_lineales_ocr(lineas))
    return " | ".join(_dedupe_conceptos_originales(candidatos, limite=10))[:900]

def generar_concepto_respaldo(datos: dict, texto_bruto: str, nombre_archivo: str = "") -> str:
    """Evita conceptos vacios usando descripcion original, OCR y proveedor como respaldo."""
    candidatos = []
    for fuente in [datos.get("conceptos_originales", ""), datos.get("concepto_mejorado", "")]:
        for parte in re.split(r'\s*\|\s*|\n+', str(fuente or "")):
            if parte.strip():
                candidatos.append(parte)

    candidatos.extend(_extraer_candidatos_tablas_ocr(texto_bruto))
    lineas = [ln.strip() for ln in str(texto_bruto or "").splitlines() if ln.strip()]
    candidatos.extend(_extraer_candidatos_lineales_ocr(lineas))
    producto_contexto = False
    for ln in lineas:
        if len(candidatos) >= 12:
            break
        if re.search(r'descripci[oó]n\s+del\s+producto|product\s+description|descripci[oó]n|description', ln, re.IGNORECASE):
            producto_contexto = True
            continue
        if len(ln) < 5 or len(ln) > 180:
            continue
        if re.search(r'adobe\s+systems|riverwalk|citywest|business\s+campus|ireland|receptor\s+de\s+factura|contacto\s+de\s+facturaci[oó]n', ln, re.IGNORECASE):
            continue
        if re.search(r'^\s*(?:total|subtotal|iva|vat|tax|base|fecha|date|invoice|factura)\b', ln, re.IGNORECASE):
            continue
        if producto_contexto and _linea_ruido_concepto(ln):
            continue
        if producto_contexto and re.fullmatch(r'(?:n[uú]mero\s+de\s+)?producto|descripci[oó]n\s+del\s+producto|cantidad|unidad|precio|unitario|importe\s+neto|tipo|impuestos|total|ea|\d{4,12}', ln, re.IGNORECASE):
            continue
        if producto_contexto and not re.search(r'\b(?:cantidad|unidad|precio|importe|tipo|impuestos|total|ea)\b', ln, re.IGNORECASE):
            candidatos.insert(0, ln)
            producto_contexto = False
            continue
        if re.search(r'\b(?:description|descripci[oó]n|concepto|item|subscription|suscripci[oó]n|software|licen[cs]e|licencia|service|servicio|plan|usage|cloud|hosting|consulting|consultor[ií]a)\b', ln, re.IGNORECASE):
            m = re.search(r'(?:concepto|descripci[oó]n|description|item|producto|servicio|services?|details?)[:\s-]+(.{5,100})', ln, re.IGNORECASE)
            candidatos.append(m.group(1) if m else ln)

    for cand in candidatos:
        if concepto_es_generico(cand):
            continue
        concepto = _concepto_espanol_desde_texto(cand)
        if concepto and len(concepto) >= 4:
            return concepto[:90]

    proveedor = (datos.get("proveedor") or proveedor_desde_archivo(nombre_archivo) or "").strip()
    if proveedor:
        prov_low = proveedor.lower()
        if re.search(r'openai|chatgpt', prov_low): return "Suscripcion ChatGPT"
        if re.search(r'frame\.?io', prov_low): return "Suscripcion Frame.io"
        if re.search(r'adobe', prov_low): return "Suscripcion Adobe"
        if re.search(r'google', prov_low): return "Servicios cloud Google"
        if re.search(r'deepl', prov_low): return "Suscripcion DeepL"
        if re.search(r'github', prov_low): return "Suscripcion GitHub"
        return f"Servicios de {proveedor}"[:90]

    return "Servicios profesionales"

def concepto_es_generico(concepto: str) -> bool:
    t = _limpiar_texto_concepto(concepto).lower()
    if not t:
        return True
    meses = r'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|ene|abr|ago|dic|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre'
    if re.fullmatch(rf'\d{{1,2}}[-_/\.](?:{meses})[-_/\.]\d{{2,4}}\s+(?:a|al|to|-|–|—)\s+\d{{1,2}}[-_/\.](?:{meses})[-_/\.]\d{{2,4}}', t, re.IGNORECASE):
        return True
    if re.fullmatch(rf'(?:duraci[oó]n\s+del\s+servicio|service\s+period)?\s*[:\-]?\s*\d{{1,2}}[-_/\.](?:{meses})[-_/\.]\d{{2,4}}.*', t, re.IGNORECASE):
        return True
    genericos = {
        "description", "product service description", "product/service description",
        "concepto", "servicio", "servicios", "services", "service", "invoice",
        "factura", "pago", "payment", "varios", "otros", "subject",
        "servicios profesionales"
    }
    if t in genericos or len(t) < 4:
        return True
    if re.fullmatch(r'servicios?\s+de\s+.+', t, re.IGNORECASE) and not re.search(r'gesti[oó]n|proyectos?|i\+d|consultor|desarrollo|software|cloud|audio|sonido|m[uú]sica|edici[oó]n|master|locuci[oó]n|doblaje|plataforma|cliente|editorial|creativ', t, re.IGNORECASE):
        return True
    ruido = [
        r'\bsubject\s+to\s+(?:the\s+)?reverse\s+charge\b',
        r'\breverse\s+charge\b',
        r'\bvat\s+to\s+be\s+accounted\s+for\b',
        r'\barticle\s+196\b',
        r'\bcouncil\s+directive\b',
        r'^\s*description\s*(?:qty|unit price|amount)?\s*$',
        r'^\s*(?:qty|unit price|amount|subtotal|total|tax|vat)\s*$',
    ]
    return any(re.search(pat, t, re.IGNORECASE) for pat in ruido)

def extraer_nif_vendedor_seller_buyer(texto: str, empresa_cif: str = "") -> str:
    """Extrae VAT/NIF del bloque Seller cuando el OCR separa Seller y Buyer."""
    txt = str(texto or "")
    emp = re.sub(r'[^A-Z0-9]', '', str(empresa_cif or "").upper())

    bloques = []
    m = re.search(r'(?is)\bSeller\b(?P<block>.*?)(?:\bBuyer\b|\bCustomer\b|\bClient\b|$)', txt)
    if m:
        bloques.append(m.group("block"))
    m = re.search(r'(?is)\bLegal information\b(?P<block>.*?)(?:\bContacts\b|$)', txt)
    if m:
        bloques.append(m.group("block"))

    for bloque in bloques:
        for pat in [
            r'\bVAT\s+ID\s*[:\s]*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})',
            r'\bVAT\s*[:\s]*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})',
            r'\b(?:Tax\s*ID|NIF|CIF)\s*[:\s]*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})',
        ]:
            for mm in re.finditer(pat, bloque, re.IGNORECASE):
                cand = re.sub(r'[\s-]+', '', mm.group(1).upper())
                if emp and cand == emp:
                    continue
                nif = validar_nif(cand)
                if nif:
                    return nif
    return ""

def extraer_nif_vendedor_ocr_general(texto: str, empresa_cif: str = "") -> str:
    txt = str(texto or "")
    emp = re.sub(r'[^A-Z0-9]', '', str(empresa_cif or "").upper())

    patrones_prioritarios = [
        r'(?is)\bDATOS\s+EMPRESA\b.*?\bNIF/CIF\s*:\s*([A-Z0-9][A-Z0-9\s.-]{6,20})',
        r'(?is)\bSeller\b.*?\b(?:VAT|VAT\s+ID|Tax\s*ID|NIF|CIF)\s*[:\s]*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})',
        r'(?is)\bLegal information\b.*?\bVAT\s+ID\s*[:\s]*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})',
        r'(?im)^\s*(?:Tax\s*Id|Tax\s*ID|VAT\s*number|VAT\s*ID|NIF/CIF|NIF|CIF)\s*[:#]?\s*([A-Z]{0,3}[-\s]?[A-Z0-9]{7,15})\s*$',
        r'(?i)\bCIF\s+([A-Z]{2}[A-Z0-9]{7,15})\b',
    ]
    for pat in patrones_prioritarios:
        for m in re.finditer(pat, txt):
            cand = re.sub(r'[\s.-]+', '', m.group(1).upper())
            if emp and (cand == emp or cand in emp or emp in cand):
                continue
            nif = validar_nif(cand)
            if nif:
                return nif

    bloque_pre_cliente = re.split(r'(?i)\bCLIENTE\b|\bDATOS\s+CLIENTE\b|\bBill\s+to\b|\bBuyer\b', txt, maxsplit=1)[0]
    for m in re.finditer(r'(?<![A-Z0-9])([XYZ]?\d{7,8}[A-Z]|[A-Z]\d{7,8}[A-Z0-9]?)(?![A-Z0-9])', bloque_pre_cliente.upper()):
        cand = m.group(1)
        if emp and (cand == emp or cand in emp or emp in cand):
            continue
        nif = validar_nif(cand)
        if nif:
            return nif
    return ""

def extraer_numero_factura_tabla(texto: str) -> str:
    """Respaldo para formatos con cabecera: Invoice # / Invoice date / Due date / valor."""
    lineas = [ln.strip() for ln in str(texto or "").splitlines() if ln.strip()]
    etiqueta = re.compile(
        r'\binvoice\s*(?:#|no\.?|n[º°o]\.?|number)\b|'
        r'\bfactura\s*(?:n[oº°]?|#)\b|'
        r'\brechnungs\s*[- ]?\s*(?:nr\.?|nummer)\b|'
        r'\brechnung\s*(?:nr\.?|nummer)\b|'
        r'\bn[uú]mero\s*/\s*number\b|'
        r'\bnumero\s*/\s*number\b',
        re.IGNORECASE
    )
    for i, linea in enumerate(lineas):
        if etiqueta.search(linea):
            for cand in lineas[i+1:i+8]:
                if re.search(r'\b(date|due|fecha|vencimiento)\b', cand, re.IGNORECASE):
                    continue
                valor = cand.strip(" .,:;")
                if es_numero_factura_valido(valor, "\n".join(lineas[max(0, i-2):i+8])):
                    return valor
    return ""

def postprocesar(datos_importes, datos_campos, texto_bruto, empresa_receptora, nombre_archivo, importes_pre, iva_pct_pre, guia_entrenamiento=None, empresa_cif=""):
    datos = {}
    numero_campos = datos_campos.get("numero_factura", "") if isinstance(datos_campos, dict) else ""
    numero_importes = datos_importes.get("numero_factura", "") if isinstance(datos_importes, dict) else ""
    datos.update(datos_campos)
    datos.update(datos_importes)
    if numero_campos and es_numero_factura_valido(numero_campos, "") and (
        not numero_importes or not es_numero_factura_valido(numero_importes, "")
    ):
        datos["numero_factura"] = numero_campos
        if numero_importes and numero_importes != numero_campos:
            log.info(f"  → Número de campos conservado frente a importes: {numero_importes!r} → {numero_campos!r}")

    # Número de factura
    if parece_nombre_empresa(datos.get("numero_factura", "")):
        datos["numero_factura"] = ""
    if not es_numero_factura_valido(datos.get("numero_factura", "")):
        datos["numero_factura"] = ""
    candidatos_num = extraer_candidatos_numero_factura(texto_bruto, nombre_archivo, guia_entrenamiento)
    if candidatos_num and (
        not datos.get("numero_factura")
        or (
            candidatos_num[0]["score"] >= 70
            and datos.get("numero_factura", "").upper() != candidatos_num[0]["valor"].upper()
        )
    ):
        datos["numero_factura"] = candidatos_num[0]["valor"]
    if not datos.get("numero_factura"):
        num = extraer_numero_factura_del_texto(texto_bruto, nombre_archivo, guia_entrenamiento)
        if num:
            datos["numero_factura"] = num
    num_tabla = extraer_numero_factura_tabla(texto_bruto)
    if num_tabla and (
        not datos.get("numero_factura")
        or datos.get("numero_factura", "").lower() in Path(nombre_archivo).stem.lower()
    ):
        datos["numero_factura"] = num_tabla
    if not datos.get("numero_factura"):
        num_adobe = extraer_numero_adobe_transaction(texto_bruto, nombre_archivo)
        if num_adobe:
            datos["numero_factura"] = num_adobe

    datos["nif_cif"] = validar_nif(datos.get("nif_cif", ""))

    # Guardián: si el LLM puso el CIF de la empresa receptora en nif_cif, limpiarlo
    if not empresa_cif:
        empresa_cif = leer_empresa_cif()
    if empresa_cif and datos.get("nif_cif"):
        nif_actual = datos["nif_cif"].upper().strip()
        emp_cif_up = empresa_cif.upper().strip()
        if nif_actual == emp_cif_up or emp_cif_up in nif_actual or nif_actual in emp_cif_up:
            log.warning(f"  → GUARDIÁN: nif_cif era el CIF de la empresa receptora ({nif_actual}), limpiando")
            datos["nif_cif"] = ""

    nif_seller = extraer_nif_vendedor_seller_buyer(texto_bruto, empresa_cif)
    if nif_seller and not datos.get("nif_cif"):
        datos["nif_cif"] = nif_seller
        log.info(f"  → NIF/VAT vendedor por bloque Seller: {nif_seller}")
    if not datos.get("nif_cif"):
        nif_ocr = extraer_nif_vendedor_ocr_general(texto_bruto, empresa_cif)
        if nif_ocr:
            datos["nif_cif"] = nif_ocr
            log.info(f"  → NIF/VAT vendedor por OCR estructural: {nif_ocr}")

    datos["fecha_factura"] = normalizar_fecha(datos.get("fecha_factura", ""))
    if not _fecha_valida_normalizada(datos.get("fecha_factura", "")):
        datos["fecha_factura"] = extraer_fecha_factura_del_texto(texto_bruto)
    datos["duracion_licencia"] = normalizar_duracion(datos.get("duracion_licencia", ""))

    # Empresa receptora: no se fuerza; debe aparecer en el OCR o por CIF.
    if empresa_receptora:
        if receptor_confirmado_en_texto(texto_bruto, empresa_receptora, empresa_cif):
            datos["empresa_receptora"] = empresa_receptora
        else:
            if _norm_busqueda(datos.get("empresa_receptora")) == _norm_busqueda(empresa_receptora):
                datos["empresa_receptora"] = ""
            datos["_receptor_no_confirmado"] = "1"

    # Proveedor ≠ receptor
    er = datos.get("empresa_receptora", "").strip().lower()
    prov = datos.get("proveedor", "").strip().lower()
    prov_archivo = proveedor_desde_archivo(nombre_archivo)

    _, datos_prov_conocido = buscar_proveedor_en_texto(texto_bruto, nombre_archivo)
    if not datos_prov_conocido and datos.get("proveedor"):
        _, datos_prov_conocido = buscar_proveedor_conocido_por_nombre(datos.get("proveedor", ""))
    if datos_prov_conocido:
        nombre_conocido = datos_prov_conocido.get("nombre", "")
        if nombre_conocido and (not datos.get("proveedor") or nombre_conocido.lower() != prov):
            datos["proveedor"] = datos_prov_conocido["nombre"]
        # NIF del proveedor conocido: siempre aplicar si existe (es más fiable que el LLM)
        nif_conocido = datos_prov_conocido.get("nif", "")
        if nif_conocido and nif_conocido != "US":  # "US" es placeholder para empresas americanas
            datos["nif_cif"] = nif_conocido
            log.info(f"  → NIF proveedor conocido aplicado: {nif_conocido}")
    elif er and prov and (er == prov or er in prov or prov in er):
        log.warning(f"  → Proveedor=Receptor, usando archivo: '{prov_archivo}'")
        datos["proveedor"] = prov_archivo if prov_archivo else ""

    if not datos.get("proveedor") and prov_archivo:
        datos["proveedor"] = prov_archivo

    # Importes
    base_num = parsear_importe(datos.get("base_imponible", ""))
    total_num = parsear_importe(datos.get("total_pagar", ""))

    # IVA porcentaje
    iva_pct_str = datos.get("iva_porcentaje", "").strip()
    iva_pct_str = re.sub(r'[^\d]', '', iva_pct_str)
    iva_pct = float(iva_pct_str) if iva_pct_str else iva_pct_pre
    hay_irpf = contiene_retencion_irpf(texto_bruto)

    t_txt, t_num = extraer_total_del_texto(texto_bruto)
    if t_num > 0 and (total_num <= 0 or (not iva_pct and abs(total_num - t_num) > max(0.05, t_num * 0.002))):
        datos["total_pagar"] = t_txt
        total_num = t_num
        log.info(f"  → Total corregido desde OCR: {t_txt}")

    if base_num > 0 and total_num > 0 and base_num > total_num * 1.01:
        datos["base_imponible"], datos["total_pagar"] = datos["total_pagar"], datos["base_imponible"]
        base_num, total_num = total_num, base_num

    if base_num > 0 and total_num > 0 and abs(base_num - total_num) < 0.01 and iva_pct and iva_pct > 0:
        datos["base_imponible"] = ""
        base_num = 0

    if base_num > 0 and total_num > 0 and not hay_irpf:
        es_coherente, _ = validar_coherencia_matematica(base_num, iva_pct, total_num)
        if not es_coherente and iva_pct and iva_pct > 0:
            total_calc = base_num * (1 + iva_pct / 100)
            mejor = min(importes_pre, key=lambda x: abs(x[1]-total_calc), default=None)
            if mejor and abs(mejor[1]-total_calc) < total_calc * 0.03:
                datos["total_pagar"] = mejor[0]
                total_num = mejor[1]

    # Valores imposibles
    if parsear_importe(datos.get("base_imponible", "")) > MAX_IMPORTE:
        datos["base_imponible"] = ""
    if parsear_importe(datos.get("total_pagar", "")) > MAX_IMPORTE:
        datos["total_pagar"] = ""

    # Normalizar a números limpios
    datos["base_imponible"] = normalizar_importe(datos.get("base_imponible", ""))
    datos["total_pagar"]    = normalizar_importe(datos.get("total_pagar", ""))
    datos["iva_importe"]    = normalizar_importe(datos.get("iva_importe", ""))
    datos["irpf_importe"]   = normalizar_importe(datos.get("irpf_importe", ""))

    if not guia_entrenamiento and datos.get("proveedor"):
        _, guia_entrenamiento = buscar_entrenamiento_por_nombre_proveedor(datos.get("proveedor", ""))

    aws_summary = extraer_importes_aws_summary(texto_bruto) if guia_es_amazon_web_services(guia_entrenamiento) else {}
    if aws_summary:
        datos.update(aws_summary)
        log.info(
            "  → Guía Amazon: Invoice Summary aplicado: "
            f"base={datos.get('base_imponible','')} IVA={datos.get('iva_importe','')} "
            f"total={datos.get('total_pagar','')} moneda={datos.get('moneda','')}"
        )

    irpf_pct = detectar_irpf_porcentaje(texto_bruto)
    irpf_pct_str = re.sub(r'[^\d]', '', str(datos.get("irpf_porcentaje", "") or ""))
    if irpf_pct and 0 < irpf_pct <= 60:
        datos["irpf_porcentaje"] = f"{int(irpf_pct)}%"
    elif irpf_pct_str:
        datos["irpf_porcentaje"] = f"{irpf_pct_str}%"
    else:
        datos["irpf_porcentaje"] = ""
    if not datos.get("irpf_importe") and contiene_retencion_irpf(texto_bruto):
        datos["irpf_importe"] = extraer_irpf_importe_del_texto(texto_bruto)

    if es_nif_persona_fisica(datos.get("nif_cif", "")) and contiene_retencion_irpf(texto_bruto):
        base_irpf_txt, base_irpf_num = extraer_base_del_texto(texto_bruto)
        base_actual = parsear_importe(datos.get("base_imponible", ""))
        if base_irpf_num > 0:
            datos["base_imponible"] = normalizar_importe(base_irpf_txt)
            log.info(f"  -> Persona fisica con NIF e IRPF: base fijada desde etiqueta base ({datos['base_imponible']}); total conservado")
        elif base_actual <= 0:
            mayor = mayor_importe_preextraido(importes_pre)
            if mayor:
                datos["base_imponible"] = mayor
                log.info(f"  -> Persona fisica con NIF e IRPF: base de respaldo ({mayor}); total conservado")

    # IVA porcentaje
    if iva_pct and 0 < iva_pct <= 30:
        datos["iva_porcentaje"] = f"{int(iva_pct)}%"
    elif iva_pct_str and iva_pct_str.isdigit():
        datos["iva_porcentaje"] = f"{iva_pct_str}%"
    else:
        datos["iva_porcentaje"] = ""

    if not datos.get("moneda"):
        datos["moneda"] = detectar_moneda(texto_bruto)

    # Conceptos originales: evidencia literal del OCR, separada del resumen.
    if conceptos_originales_pobres(datos.get("conceptos_originales", ""), datos.get("concepto_mejorado", "")):
        conceptos_ocr = extraer_conceptos_originales_respaldo(texto_bruto, datos.get("conceptos_originales", ""))
        if conceptos_ocr:
            datos["conceptos_originales"] = conceptos_ocr
            log.info(f"  -> Conceptos originales desde OCR: {conceptos_ocr[:120]!r}")

    # Concepto en español
    if concepto_es_generico(datos.get("concepto_mejorado", "")):
        for pat in [r'(?:concepto|descripcion|services?|servicios?)[:\s]+([^\n]{5,60})']:
            m = re.search(pat, texto_bruto, re.IGNORECASE)
            if m:
                datos["concepto_mejorado"] = " ".join(m.group(1).strip().split()[:6])
                break
    if concepto_es_generico(datos.get("concepto_mejorado", "")):
        datos["concepto_mejorado"] = generar_concepto_respaldo(datos, texto_bruto, nombre_archivo)
        log.info(f"  -> Concepto de respaldo: {datos['concepto_mejorado']!r}")

    # Enriquecer concepto solo si hay periodo de servicio/licencia real.
    concepto = datos.get("concepto_mejorado", "")
    duracion = (datos.get("duracion_licencia") or "").strip()
    if concepto and duracion:
        periodo_exacto = _periodo_exacto_para_concepto(duracion)
        _meses_es = ["enero","febrero","marzo","abril","mayo","junio",
                     "julio","agosto","septiembre","octubre","noviembre","diciembre"]
        _meses_en = ["january","february","march","april","may","june","july","august","september","october","november","december",
                     "jan","feb","mar","apr","jun","jul","aug","sep","sept","oct","nov","dec"]
        if periodo_exacto and periodo_exacto not in concepto:
            datos["concepto_mejorado"] = f"{concepto} ({periodo_exacto})"
            log.info(f"  -> Concepto enriquecido con fechas exactas: {periodo_exacto}")
        elif not any(mes in concepto.lower() for mes in _meses_es + _meses_en) and not re.search(r'20\d\d', concepto):
            periodo_str = ""
            _m = re.search(r'(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s*(?:\d{1,2})?,?\s*(20\d\d)?', duracion, re.IGNORECASE)
            if _m:
                mes_n = MESES_MAP.get(_m.group(1).lower(), 0)
                year = _m.group(2) or ""
                if mes_n:
                    periodo_str = f"{MESES_ES[mes_n]} {year}".strip()
            if periodo_str:
                datos["concepto_mejorado"] = f"{concepto} — {periodo_str}"
                log.info(f"  → Concepto enriquecido con periodo: {periodo_str}")

    # Aplicar guía de entrenamiento como verificación/complemento final (nunca sobreescribe)
    if guia_entrenamiento and entrenamiento_activo():
        datos = aplicar_guia_entrenamiento_postproceso(datos, guia_entrenamiento, texto_bruto)

    nf = datos.get("numero_factura","")
    pv = datos.get("proveedor","")
    ba = datos.get("base_imponible","")
    iv = datos.get("iva_porcentaje","")
    to = datos.get("total_pagar","")
    log.info(f"  → FINAL nº={nf!r} prov={pv!r} base={ba!r} IVA={iv!r} total={to!r}")

    return datos


# ═══════════════════════════════════════════════════════════════════
# EXCEL
# ═══════════════════════════════════════════════════════════════════

EXCEL_IMPORTES = {"base_imponible", "iva_importe", "irpf_importe", "total_pagar", "base_eur", "total_eur", "tipo_cambio", "base_imponible_EUR", "total_pagar_EUR"}
EXCEL_IMPORTES_EUR = {"iva_importe", "irpf_importe", "base_eur", "total_eur", "base_imponible_EUR", "total_pagar_EUR"}
EXCEL_IMPORTES_SIN_MONEDA = {"base_imponible", "total_pagar", "tipo_cambio"}
EXCEL_FECHAS = {"fecha_factura", "fecha_proceso"}
EXCEL_ILLEGAL_CHARS_RE = re.compile(r"[\000-\010\013-\014\016-\037]")
EXCEL_WIDTHS = {
    "archivo_original": 34, "archivo_guardado": 26, "workspace": 14,
    "numero_factura": 18, "proveedor": 30, "empresa_receptora": 24,
    "nif_cif": 16, "fecha_factura": 14, "duracion_licencia": 22,
    "base_imponible": 15, "iva_porcentaje": 12, "iva_importe": 14,
    "irpf_porcentaje": 12, "irpf_importe": 14,
    "total_pagar": 15, "moneda": 10, "base_eur": 14, "total_eur": 14,
    "base_imponible_EUR": 18, "total_pagar_EUR": 16,
    "tipo_cambio": 12, "fecha_tipo_cambio": 16, "fuente_tipo_cambio": 18, "concepto_mejorado": 30,
    "conceptos_originales": 34, "idioma_factura": 12, "calidad_ocr": 12,
    "alertas": 28, "texto_ocr_bruto": 38, "deducible": 12, "estado": 14, "fecha_proceso": 22,
}

def _valor_excel(col, valor):
    if col in EXCEL_IMPORTES:
        n = parsear_importe(valor)
        return n if n else None
    return _limpiar_valor_excel(valor)

def _limpiar_valor_excel(valor):
    if not isinstance(valor, str):
        return valor
    limpio = EXCEL_ILLEGAL_CHARS_RE.sub("", valor)
    if len(limpio) > 32700:
        limpio = limpio[:32700]
    return limpio

def _limpiar_fila_excel_dict(fila):
    return {k: _limpiar_valor_excel(v) for k, v in (fila or {}).items()}

def _valores_fila_excel(fila):
    return [_valor_excel(col, fila.get(col, "")) for col in COLUMNAS_EXCEL]

def _valor_fila_por_col(cabeceras, fila, col):
    i = _idx(cabeceras, col)
    return fila[i] if i >= 0 and i < len(fila) else ""

def _importe_eur_desde_fila(cabeceras, fila, col_original, col_eur):
    moneda = str(_valor_fila_por_col(cabeceras, fila, "moneda") or "EUR").strip().upper()
    original = _valor_fila_por_col(cabeceras, fila, col_original)
    eur = _valor_fila_por_col(cabeceras, fila, col_eur)
    if moneda and moneda != "EUR" and eur not in ("", None):
        return eur
    return original

def preparar_filas_excel_descarga(cabeceras, filas):
    columnas_export = [
        "archivo_original", "archivo_guardado", "workspace",
        "numero_factura", "proveedor", "empresa_receptora", "nif_cif",
        "fecha_factura", "duracion_licencia",
        "base_imponible_EUR", "total_pagar_EUR",
        "moneda", "base_imponible", "total_pagar",
        "iva_porcentaje", "iva_importe", "irpf_porcentaje", "irpf_importe",
        "base_eur", "total_eur", "tipo_cambio", "fecha_tipo_cambio", "fuente_tipo_cambio",
        "concepto_mejorado", "conceptos_originales",
        "idioma_factura", "calidad_ocr", "alertas",
        "texto_ocr_bruto", "deducible", "estado", "fecha_proceso",
    ]
    filas_export = []
    for fila in filas:
        nueva = []
        for col in columnas_export:
            if col == "base_imponible_EUR":
                nueva.append(_importe_eur_desde_fila(cabeceras, fila, "base_imponible", "base_eur"))
            elif col == "total_pagar_EUR":
                nueva.append(_importe_eur_desde_fila(cabeceras, fila, "total_pagar", "total_eur"))
            else:
                nueva.append(_valor_fila_por_col(cabeceras, fila, col))
        filas_export.append(nueva)
    return columnas_export, filas_export

def _aplicar_formato_excel(ws_sheet):
    try:
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.table import Table, TableStyleInfo
        if ws_sheet.max_row < 1:
            return

        cabeceras = [cell.value for cell in ws_sheet[1]]
        header_fill = PatternFill("solid", fgColor="1F6F8B")
        header_font = Font(bold=True, color="FFFFFF", size=10)
        thin = Side(style="thin", color="D8DDE8")
        border = Border(bottom=thin)

        for cell in ws_sheet[1]:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
            cell.border = border
        ws_sheet.row_dimensions[1].height = 22
        ws_sheet.freeze_panes = "A2"
        ws_sheet.auto_filter.ref = ws_sheet.dimensions

        for idx, col in enumerate(cabeceras, start=1):
            letter = get_column_letter(idx)
            ws_sheet.column_dimensions[letter].width = EXCEL_WIDTHS.get(str(col), 16)
            for cell in ws_sheet.iter_cols(min_col=idx, max_col=idx, min_row=2, max_row=ws_sheet.max_row):
                for c in cell:
                    c.border = border
                    c.alignment = Alignment(vertical="top", wrap_text=False)
                    if col in EXCEL_IMPORTES:
                        c.number_format = '#,##0.00 "€"' if col in EXCEL_IMPORTES_EUR else '#,##0.00'
                        c.alignment = Alignment(horizontal="right", vertical="top")
                    elif col == "iva_porcentaje":
                        c.alignment = Alignment(horizontal="center", vertical="top")
                    elif col in EXCEL_FECHAS:
                        c.alignment = Alignment(horizontal="center", vertical="top")

        if ws_sheet.max_row > 1:
            ref = f"A1:{get_column_letter(ws_sheet.max_column)}{ws_sheet.max_row}"
            ws_sheet.tables.clear()
            tab = Table(displayName="TablaFacturas", ref=ref)
            tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True, showColumnStripes=False)
            ws_sheet.add_table(tab)
    except Exception as e:
        log.debug(f"Error aplicando estilos Excel: {e}")

def _actualizar_resumen_proveedores(wb):
    try:
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.table import Table, TableStyleInfo

        if "Facturas" not in wb.sheetnames:
            return
        ws_fact = wb["Facturas"]
        cabeceras = [c.value for c in ws_fact[1]]
        i_prov = _idx(cabeceras, "proveedor") + 1
        i_base = _idx(cabeceras, "base_imponible") + 1
        i_base_eur = _idx(cabeceras, "base_eur") + 1
        i_total = _idx(cabeceras, "total_pagar") + 1
        i_moneda = _idx(cabeceras, "moneda") + 1
        if i_prov <= 0 or (i_base <= 0 and i_total <= 0):
            return

        datos = {}
        for row in ws_fact.iter_rows(min_row=2, values_only=True):
            prov = str(row[i_prov - 1] or "").strip() or "Sin proveedor"
            base = row[i_base - 1] if i_base > 0 and i_base - 1 < len(row) else 0
            base_eur = row[i_base_eur - 1] if i_base_eur > 0 and i_base_eur - 1 < len(row) else 0
            total = row[i_total - 1] if i_total > 0 and i_total - 1 < len(row) else 0
            moneda = str(row[i_moneda - 1] or "EUR").strip() if i_moneda > 0 and i_moneda - 1 < len(row) else "EUR"
            if not isinstance(base, (int, float)):
                base = parsear_importe(base)
            if not isinstance(base_eur, (int, float)):
                base_eur = parsear_importe(base_eur)
            if not isinstance(total, (int, float)):
                total = parsear_importe(total)
            cifra = float(base_eur or 0) if base_eur else (float(base or 0) if base else float(total or 0))
            moneda_resumen = "EUR" if base_eur else moneda
            if prov not in datos:
                datos[prov] = {"count": 0, "base": 0.0, "monedas": set()}
            datos[prov]["count"] += 1
            datos[prov]["base"] += cifra
            if moneda_resumen:
                datos[prov]["monedas"].add(moneda_resumen)

        if "Resumen proveedores" in wb.sheetnames:
            del wb["Resumen proveedores"]
        ws = wb.create_sheet("Resumen proveedores")
        ws.append(["Proveedor", "Nº facturas", "Moneda", "Base imponible total"])
        for prov, vals in sorted(datos.items(), key=lambda kv: kv[1]["base"], reverse=True):
            monedas = sorted(vals["monedas"])
            ws.append([prov, vals["count"], monedas[0] if len(monedas) == 1 else "VARIAS", vals["base"]])

        header_fill = PatternFill("solid", fgColor="1F6F8B")
        header_font = Font(bold=True, color="FFFFFF", size=10)
        thin = Side(style="thin", color="D8DDE8")
        border = Border(bottom=thin)
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
            cell.border = border
        ws.row_dimensions[1].height = 22
        ws.freeze_panes = "A2"
        widths = [34, 12, 10, 16]
        for idx, width in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(idx)].width = width
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.border = border
                cell.alignment = Alignment(vertical="top", wrap_text=False)
            row[1].alignment = Alignment(horizontal="center", vertical="top", wrap_text=False)
            row[2].alignment = Alignment(horizontal="center", vertical="top", wrap_text=False)
            row[3].number_format = '#,##0.00'
            row[3].alignment = Alignment(horizontal="right", vertical="top", wrap_text=False)

        if ws.max_row > 1:
            ref = f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"
            tab = Table(displayName="TablaResumenProveedores", ref=ref)
            tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True, showColumnStripes=False)
            ws.add_table(tab)
    except Exception as e:
        log.debug(f"Error creando resumen de proveedores: {e}")

def _actualizar_resumen_anexo(wb):
    try:
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter
        from openpyxl.worksheet.table import Table, TableStyleInfo

        if "Facturas" not in wb.sheetnames:
            return
        ws_fact = wb["Facturas"]
        cabeceras = [c.value for c in ws_fact[1]]
        base_col = "base_imponible_EUR" if _idx(cabeceras, "base_imponible_EUR") >= 0 else "base_eur"
        if _idx(cabeceras, base_col) < 0:
            base_col = "base_imponible"
        columnas = [
            ("Nombre proveedor", "proveedor"),
            ("CIF proveedor", "nif_cif"),
            ("Fecha", "fecha_factura"),
            ("Base imponible EUR", base_col),
            ("Concepto mejorado", "concepto_mejorado"),
        ]
        idxs = [_idx(cabeceras, origen) for _, origen in columnas]

        if "Resumen anexo" in wb.sheetnames:
            del wb["Resumen anexo"]
        ws = wb.create_sheet("Resumen anexo")
        ws.append([titulo for titulo, _ in columnas])
        for row in ws_fact.iter_rows(min_row=2, values_only=True):
            valores = []
            for idx in idxs:
                valores.append(row[idx] if idx >= 0 and idx < len(row) else "")
            if any(str(v or "").strip() for v in valores):
                ws.append(valores)

        header_fill = PatternFill("solid", fgColor="1F6F8B")
        header_font = Font(bold=True, color="FFFFFF", size=10)
        thin = Side(style="thin", color="D8DDE8")
        border = Border(bottom=thin)
        widths = [34, 16, 14, 16, 48]
        for cell in ws[1]:
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
            cell.border = border
        ws.row_dimensions[1].height = 22
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions
        for idx, width in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(idx)].width = width
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.border = border
                cell.alignment = Alignment(vertical="top", wrap_text=False)
            row[1].alignment = Alignment(horizontal="center", vertical="top")
            row[2].alignment = Alignment(horizontal="center", vertical="top")
            row[3].number_format = '#,##0.00 "€"'
            row[3].alignment = Alignment(horizontal="right", vertical="top")

        if ws.max_row > 1:
            ref = f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"
            tab = Table(displayName="TablaResumenAnexo", ref=ref)
            tab.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True, showColumnStripes=False)
            ws.add_table(tab)
    except Exception as e:
        log.debug(f"Error creando resumen anexo: {e}")

def _cabecera_style(ws_sheet):
    _aplicar_formato_excel(ws_sheet)

def _aplicar_estilo_fila_estado(row, estado, deducible=""):
    try:
        from openpyxl.styles import PatternFill
        estado_norm = str(estado or "").strip().lower()
        ded_norm = str(deducible or "").strip().lower()
        if estado_norm == "validada" and ded_norm == "no":
            fill = PatternFill("solid", fgColor="FEE2E2")
        elif estado_norm == "validada":
            fill = PatternFill("solid", fgColor="D1FAE5")
        else:
            fill = PatternFill(fill_type=None)
        for cell in row:
            cell.fill = fill
    except Exception as e:
        log.debug(f"Error aplicando estilo de estado Excel: {e}")

def _normalizar_cabeceras_filas(cabeceras, filas):
    cabeceras = [str(c).strip() if c else "" for c in (cabeceras or [])]
    if not cabeceras:
        return list(COLUMNAS_EXCEL), []
    if "deducible" not in cabeceras:
        pos_estado = _idx(cabeceras, "estado")
        pos = pos_estado if pos_estado >= 0 else len(cabeceras)
        cabeceras = cabeceras[:pos] + ["deducible"] + cabeceras[pos:]
        filas_norm = []
        for fila in filas:
            fila = list(fila)
            estado = str(fila[pos_estado] if pos_estado >= 0 and pos_estado < len(fila) else "").strip()
            ded = "Si" if estado == "Validada" else ""
            filas_norm.append(fila[:pos] + [ded] + fila[pos:])
        filas = filas_norm
    for col in COLUMNAS_EXCEL:
        if col not in cabeceras:
            cabeceras.append(col)
            filas = [list(fila) + [""] for fila in filas]
    return cabeceras, filas

def _asegurar_columnas_excel_ws(ws_sheet):
    cabeceras = [cell.value for cell in ws_sheet[1]]
    if "deducible" not in cabeceras:
        pos_estado = _idx(cabeceras, "estado")
        insert_at = (pos_estado + 1) if pos_estado >= 0 else (len(cabeceras) + 1)
        ws_sheet.insert_cols(insert_at)
        ws_sheet.cell(row=1, column=insert_at).value = "deducible"
        pos_estado = _idx(cabeceras, "estado") + 1
        for row_idx in range(2, ws_sheet.max_row + 1):
            estado = str(ws_sheet.cell(row=row_idx, column=pos_estado).value or "").strip() if pos_estado > 0 else ""
            ws_sheet.cell(row=row_idx, column=insert_at).value = "Si" if estado == "Validada" else ""
    cabeceras = [cell.value for cell in ws_sheet[1]]
    for col in COLUMNAS_EXCEL:
        if col not in cabeceras:
            insert_at = ws_sheet.max_column + 1
            ws_sheet.cell(row=1, column=insert_at).value = col
            cabeceras.append(col)
    return [cell.value for cell in ws_sheet[1]]

def _get_excel_path(workspace):
    return get_workspace_paths(workspace)["excel"]

def _leer_todas_las_filas(workspace):
    path = _get_excel_path(workspace)
    if not path.exists():
        return list(COLUMNAS_EXCEL), []
    lock = _get_excel_lock(workspace)
    with lock:
        try:
            wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
            ws_sheet = wb.active
            filas = list(ws_sheet.iter_rows(values_only=True))
            wb.close()
            if not filas:
                return list(COLUMNAS_EXCEL), []
            return _normalizar_cabeceras_filas(list(filas[0]), [list(f) for f in filas[1:] if any(f)])
        except Exception as e:
            log.error(f"Error leyendo Excel [{workspace}]: {e}")
            return list(COLUMNAS_EXCEL), []

def _idx(cabeceras, col):
    try:
        return cabeceras.index(col)
    except ValueError:
        return -1

def _reconstruir_excel(filas_nuevas, workspace):
    path = _get_excel_path(workspace)
    lock = _get_excel_lock(workspace)
    with lock:
        wb = openpyxl.Workbook()
        ws_sheet = wb.active
        ws_sheet.title = "Facturas"
        cabeceras = filas_nuevas[0] if filas_nuevas else list(COLUMNAS_EXCEL)
        for i, fila in enumerate(filas_nuevas):
            if i == 0:
                ws_sheet.append(list(fila))
            else:
                ws_sheet.append([_valor_excel(cabeceras[j], fila[j] if j < len(fila) else "") for j in range(len(cabeceras))])
            if i == 0:
                _cabecera_style(ws_sheet)
            else:
                i_estado = _idx(cabeceras, "estado")
                estado = fila[i_estado] if i_estado >= 0 and i_estado < len(fila) else ""
                i_deducible = _idx(cabeceras, "deducible")
                deducible = fila[i_deducible] if i_deducible >= 0 and i_deducible < len(fila) else ""
                _aplicar_estilo_fila_estado(ws_sheet[ws_sheet.max_row], estado, deducible)
        _aplicar_formato_excel(ws_sheet)
        _actualizar_resumen_proveedores(wb)
        _actualizar_resumen_anexo(wb)
        wb.save(str(path))
        wb.close()

def escribir_excel(fila, workspace):
    path = _get_excel_path(workspace)
    lock = _get_excel_lock(workspace)
    with lock:
        if path.exists():
            wb = openpyxl.load_workbook(str(path))
            ws_sheet = wb.active
            _asegurar_columnas_excel_ws(ws_sheet)
        else:
            wb = openpyxl.Workbook()
            ws_sheet = wb.active
            ws_sheet.title = "Facturas"
            ws_sheet.append(COLUMNAS_EXCEL)
            _cabecera_style(ws_sheet)
        cabeceras_actuales = [cell.value for cell in ws_sheet[1]]
        ws_sheet.append([_valor_excel(col, fila.get(col, "")) for col in cabeceras_actuales])
        _aplicar_estilo_fila_estado(ws_sheet[ws_sheet.max_row], fila.get("estado", ""), fila.get("deducible", ""))
        _aplicar_formato_excel(ws_sheet)
        _actualizar_resumen_proveedores(wb)
        _actualizar_resumen_anexo(wb)
        wb.save(str(path))
        wb.close()

def actualizar_fila_excel(archivo_original, campos, archivo_guardado_nuevo=None, workspace=""):
    path = _get_excel_path(workspace)
    if not path.exists():
        return False
    lock = _get_excel_lock(workspace)
    with lock:
        try:
            wb = openpyxl.load_workbook(str(path))
            ws_sheet = wb.active
            cabeceras = _asegurar_columnas_excel_ws(ws_sheet)
            i_orig = _idx(cabeceras, "archivo_original")
            if i_orig < 0:
                wb.close()
                return False
            i_guard_match = _idx(cabeceras, "archivo_guardado")
            for row in ws_sheet.iter_rows(min_row=2):
                orig_val = row[i_orig].value if i_orig >= 0 else ""
                guard_val = row[i_guard_match].value if i_guard_match >= 0 else ""
                if archivo_original in (orig_val, guard_val):
                    for key, val in campos.items():
                        i = _idx(cabeceras, key)
                        if i >= 0:
                            row[i].value = _valor_excel(key, val)
                    if archivo_guardado_nuevo:
                        i = _idx(cabeceras, "archivo_guardado")
                        if i >= 0:
                            row[i].value = _limpiar_valor_excel(archivo_guardado_nuevo)
                    i_estado = _idx(cabeceras, "estado")
                    estado = campos.get("estado", row[i_estado].value if i_estado >= 0 else "")
                    i_deducible = _idx(cabeceras, "deducible")
                    deducible = campos.get("deducible", row[i_deducible].value if i_deducible >= 0 else "")
                    _aplicar_estilo_fila_estado(row, estado, deducible)
                    break
            _aplicar_formato_excel(ws_sheet)
            _actualizar_resumen_proveedores(wb)
            _actualizar_resumen_anexo(wb)
            wb.save(str(path))
            wb.close()
            return True
        except Exception as e:
            log.error(f"Error actualizando Excel: {e}")
            return False

def eliminar_fila_excel(archivo_original, workspace):
    cabeceras, filas = _leer_todas_las_filas(workspace)
    i_orig = _idx(cabeceras, "archivo_original")
    i_guard = _idx(cabeceras, "archivo_guardado")
    archivo_busqueda = str(archivo_original or "").strip()
    archivo_guardado = ""
    nuevas = []
    for fila in filas:
        orig = str(fila[i_orig] or "").strip() if i_orig >= 0 and i_orig < len(fila) else ""
        guard = str(fila[i_guard] or "").strip() if i_guard >= 0 and i_guard < len(fila) else ""
        if archivo_busqueda and archivo_busqueda in (orig, guard):
            if i_guard >= 0 and i_guard < len(fila):
                archivo_guardado = str(fila[i_guard] or "")
            continue
        nuevas.append(fila)
    _reconstruir_excel([cabeceras] + nuevas, workspace)
    return archivo_guardado

def corregir_formatos_excel(workspace):
    path = _get_excel_path(workspace)
    if not path.exists():
        return {"corregidas": 0}
    try:
        cabeceras, filas = _leer_todas_las_filas(workspace)
        proveedores_conocidos = leer_proveedores()
        fecha_cols = [i for i, c in enumerate(cabeceras) if c and "fecha" in str(c).lower()]
        imp_cols = [i for i, c in enumerate(cabeceras) if c and any(x in str(c).lower() for x in ["imponible","pagar","total","base","iva_importe","irpf_importe"])]
        i_prov = _idx(cabeceras, "proveedor")
        i_nif = _idx(cabeceras, "nif_cif")
        i_rec = _idx(cabeceras, "empresa_receptora")
        i_iva_pct = _idx(cabeceras, "iva_porcentaje")
        empresa_rec = leer_empresa_receptora()
        corregidas = 0

        for fila in filas:
            for i in fecha_cols:
                if i < len(fila) and fila[i]:
                    nuevo = normalizar_fecha(str(fila[i]))
                    if nuevo and nuevo != str(fila[i]):
                        fila[i] = nuevo
                        corregidas += 1

            for i in imp_cols:
                if i < len(fila) and fila[i]:
                    nuevo = normalizar_importe(str(fila[i]))
                    if nuevo and nuevo != str(fila[i]):
                        fila[i] = nuevo
                        corregidas += 1

            if i_iva_pct >= 0 and i_iva_pct < len(fila):
                v = str(fila[i_iva_pct] or "").strip().lower()
                if v in ["unknown", "n/a", "none", "null", "-"]:
                    fila[i_iva_pct] = ""
                    corregidas += 1

            if empresa_rec and i_rec >= 0 and i_rec < len(fila) and not str(fila[i_rec] or "").strip():
                fila[i_rec] = empresa_rec
                corregidas += 1

            if i_prov >= 0 and i_nif >= 0 and i_prov < len(fila) and i_nif < len(fila):
                prov = str(fila[i_prov] or "").strip().lower()
                nif_actual = str(fila[i_nif] or "").strip()
                if prov and not nif_actual:
                    for key, datos_p in proveedores_conocidos.items():
                        if key in prov or prov in key:
                            nif_nuevo = datos_p.get("nif", "")
                            if nif_nuevo and nif_nuevo != "US":
                                fila[i_nif] = nif_nuevo
                                corregidas += 1
                                break

        _reconstruir_excel([cabeceras] + filas, workspace)
        return {"corregidas": corregidas}
    except Exception as e:
        log.error(f"Error corrigiendo formatos: {e}")
        return {"error": str(e)}

def _clave_texto_duplicado(valor):
    valor = str(valor or "").strip().lower()
    if not valor:
        return ""
    valor = unicodedata.normalize("NFD", valor)
    valor = "".join(c for c in valor if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", valor)

def _clave_numero_factura_duplicado(valor):
    valor = str(valor or "").strip().upper()
    if not valor or not es_numero_valido(valor):
        return ""
    return re.sub(r"[^A-Z0-9]+", "", valor)

def _clave_fecha_duplicado(valor):
    fecha = _fecha_valida_normalizada(valor)
    return fecha or ""

def _clave_importe_duplicado(*valores):
    for valor in valores:
        importe = parsear_importe(valor)
        if importe:
            return f"{importe:.2f}"
    return ""

def detectar_duplicados_excel(workspace):
    path = _get_excel_path(workspace)
    if not path.exists():
        return {}
    try:
        cabeceras, filas = _leer_todas_las_filas(workspace)
        i_num = _idx(cabeceras, "numero_factura")
        i_prov = _idx(cabeceras, "proveedor")
        i_fecha = _idx(cabeceras, "fecha_factura")
        i_base = _idx(cabeceras, "base_imponible")
        i_tot = _idx(cabeceras, "total_pagar")
        i_arch = _idx(cabeceras, "archivo_guardado")
        i_orig = _idx(cabeceras, "archivo_original")
        claves = []
        for fila in filas:
            num = _clave_numero_factura_duplicado(fila[i_num] if i_num >= 0 and i_num < len(fila) else "")
            prov = _clave_texto_duplicado(fila[i_prov] if i_prov >= 0 and i_prov < len(fila) else "")
            fecha = _clave_fecha_duplicado(fila[i_fecha] if i_fecha >= 0 and i_fecha < len(fila) else "")
            base = fila[i_base] if i_base >= 0 and i_base < len(fila) else ""
            total = fila[i_tot] if i_tot >= 0 and i_tot < len(fila) else ""
            importe = _clave_importe_duplicado(base, total)
            clave = f"num:{num}|prov:{prov}|fecha:{fecha}|imp:{importe}" if (num and prov and fecha and importe) else None
            claves.append(clave)
        conteo = Counter(c for c in claves if c)
        resultado = {}
        for i, fila in enumerate(filas):
            arch = str(fila[i_arch]).strip() if i_arch >= 0 and i_arch < len(fila) else ""
            orig = str(fila[i_orig]).strip() if i_orig >= 0 and i_orig < len(fila) else ""
            es_dup = bool(claves[i] and conteo[claves[i]] > 1)
            if arch:
                resultado[arch] = es_dup
            if orig:
                resultado[orig] = es_dup
        return resultado
    except Exception as e:
        log.error(f"Error detectando duplicados: {e}")
        return {}


# ═══════════════════════════════════════════════════════════════════
# PROCESADOR PRINCIPAL
# ═══════════════════════════════════════════════════════════════════

def procesar_archivo(ruta, workspace="", modelo_override=None):
    log.info(f"═══ [{workspace}] {ruta.name} ═══")
    _latido_procesador(archivo=ruta.name, workspace=workspace)
    ext = ruta.suffix.lower()
    empresa_receptora = leer_empresa_receptora(workspace)
    empresa_cif = leer_empresa_cif(workspace)
    paths = get_workspace_paths(workspace)

    try:
        # Motor alternativo: anyformat conserva el flujo de salida de Aliot.
        if usar_anyformat():
            n_paginas = pdf_num_paginas(ruta) if ext == ".pdf" else 1
            _latido_procesador("anyformat")
            raw_anyformat, flat_anyformat = llamar_anyformat_workflow(ruta)
            datos_anyformat = normalizar_anyformat(flat_anyformat)
            texto_bruto = _anyformat_texto_respaldo(raw_anyformat, flat_anyformat)
            importes_pre = preextraer_importes(texto_bruto)
            iva_pct_pre = detectar_iva_porcentaje(texto_bruto)
            _, guia_anyformat = buscar_entrenamiento_para_factura(texto_bruto, ruta.name)

            datos = postprocesar(
                datos_anyformat, {}, texto_bruto, empresa_receptora, ruta.name,
                importes_pre, iva_pct_pre, guia_entrenamiento=guia_anyformat,
                empresa_cif=empresa_cif
            )
            calidad = evaluar_calidad(texto_bruto)
            idioma = detectar_idioma(texto_bruto)
            alertas = verificar_logica(datos, texto_bruto)
            alertas.append("Procesado con Anyformat")
            return _guardar_resultado(datos, texto_bruto, ruta, ext, workspace, paths,
                                      calidad, idioma, alertas, n_paginas)

        # PASO 1: Extraer imágenes/texto
        n_paginas = 1
        if ext == ".pdf":
            texto_bruto, imagenes_bytes, n_paginas = extraer_texto_pdf_multipagina(ruta)
        else:
            texto_bruto = ""
            imagenes_bytes = [extraer_imagen(ruta)]

        # ¿Modo visión (todo en un paso)?
        vision_necesaria_api = usar_api_externa() and imagenes_bytes and len(texto_bruto or "") < min_chars_pdf()
        if (usar_vision_unico_paso() or vision_necesaria_api) and (imagenes_bytes or not texto_bruto):
            # Si tenemos texto nativo del PDF, no necesitamos visión para OCR
            if texto_bruto and len(texto_bruto) >= min_chars_pdf():
                # PDF con texto nativo: usar modo clásico con API externa
                pass
            else:
                # Imagen o PDF escaneado: usar visión
                imgs = imagenes_bytes if imagenes_bytes else [extraer_imagen(ruta)]
                if usar_api_externa():
                    datos_vision, raw_vision = procesar_con_vision_unico_paso(
                        imgs, empresa_receptora, ruta.name
                    )
                    if not texto_bruto:
                        texto_bruto = raw_vision or ""
                    if not texto_bruto:
                        texto_bruto = ""
                    liberar_modelos()
                else:
                    with ollama_lock:
                        datos_vision, raw_vision = procesar_con_vision_unico_paso(
                            imgs, empresa_receptora, ruta.name
                        )
                        if not texto_bruto:
                            texto_bruto = llamar_ocr_imagen(imgs[0]) if len(imgs) == 1 else llamar_ocr_multipagina(imgs)
                        if not texto_bruto:
                            texto_bruto = raw_vision or ""
                        liberar_modelos()

                # Postprocesar datos de visión
                importes_pre = preextraer_importes(texto_bruto)
                iva_pct_pre = detectar_iva_porcentaje(texto_bruto)
                # Buscar guía ANTES del postproceso (se aplica como verificación final)
                _, guia_vision = buscar_entrenamiento_para_factura(texto_bruto, ruta.name)
                datos = postprocesar(datos_vision, {}, texto_bruto, empresa_receptora, ruta.name, importes_pre, iva_pct_pre, guia_entrenamiento=guia_vision, empresa_cif=empresa_cif)

                calidad = evaluar_calidad(texto_bruto)
                idioma = detectar_idioma(texto_bruto)
                alertas = verificar_logica(datos, texto_bruto)

                return _guardar_resultado(datos, texto_bruto, ruta, ext, workspace, paths,
                                          calidad, idioma, alertas, n_paginas)

        # MODO CLÁSICO: OCR local si hace falta + doble llamada LLM.
        necesita_ocr_local = bool(imagenes_bytes) and (not usar_api_externa() or not texto_bruto)
        if necesita_ocr_local:
            log.info("  → Esperando lock Ollama…")
        with (ollama_lock if necesita_ocr_local else nullcontext()):
            if necesita_ocr_local:
                log.info("  → Lock adquirido")
            if imagenes_bytes:
                if usar_api_externa() and texto_bruto:
                    log.info("  -> PDF mixto con texto nativo: se omite OCR Ollama; análisis por API externa")
                else:
                    if texto_bruto:
                        log.info("  -> OCR visual complementario para PDF mixto")
                    else:
                        _latido_procesador("ocr")
                    if len(imagenes_bytes) == 1:
                        texto_ocr = llamar_ocr_imagen(imagenes_bytes[0])
                    else:
                        texto_ocr = llamar_ocr_multipagina(imagenes_bytes)
                    texto_bruto = combinar_texto_nativo_y_ocr(texto_bruto, texto_ocr)
            if not texto_bruto.strip():
                raise ValueError("No se pudo extraer texto")

            # Preextracción Python
            importes_pre = preextraer_importes(texto_bruto)
            total_pre_txt, total_pre_num = extraer_total_del_texto(texto_bruto)
            base_pre_txt, base_pre_num = extraer_base_del_texto(texto_bruto)
            iva_pct = detectar_iva_porcentaje(texto_bruto)
            log.info(f"  → Pre: {len(importes_pre)} importes, total={total_pre_txt}({total_pre_num:.2f}), IVA={iva_pct}")

            _, plantilla = detectar_plantilla(texto_bruto, ruta.name)
            # Buscar guía de entrenamiento (tiene prioridad si existe)
            _, guia_entrenamiento = buscar_entrenamiento_para_factura(texto_bruto, ruta.name)
            if guia_entrenamiento:
                log.info(f"  → Guía de entrenamiento activa: '{guia_entrenamiento.get('proveedor_nombre','?')}'")

            # LLM 1 — importes
            datos_importes = llamar_llama_importes(texto_bruto, importes_pre, total_pre_txt, base_pre_txt, iva_pct, guia_entrenamiento=guia_entrenamiento)

            # Verificar coherencia
            base_llm = parsear_importe(datos_importes.get("base_imponible", ""))
            total_llm = parsear_importe(datos_importes.get("total_pagar", ""))
            iva_pct_llm = float(re.sub(r'[^\d]', '', datos_importes.get("iva_porcentaje", ""))) if re.sub(r'[^\d]', '', datos_importes.get("iva_porcentaje", "")) else iva_pct

            if base_llm > 0 and total_llm > 0 and not contiene_retencion_irpf(texto_bruto):
                es_coh, _ = validar_coherencia_matematica(base_llm, iva_pct_llm, total_llm)
                if not es_coh:
                    log.warning("  → Incoherente → fallback")
                    fb, _ = fallback_matematico(importes_pre, base_llm, iva_pct_llm)
                    if fb.get("total_pagar"):
                        datos_importes.update(fb)
            elif total_llm <= 0 and total_pre_num > 0:
                fb, _ = fallback_matematico(importes_pre, base_pre_num, iva_pct)
                if fb:
                    datos_importes.update(fb)

            # Doble verificación > 10.000€
            total_actual = parsear_importe(datos_importes.get("total_pagar", ""))
            alerta_doble = ""
            if total_actual > UMBRAL_DOBLE_CHECK:
                _, verificado = llamar_llama_verificacion_doble(texto_bruto, datos_importes)
                if verificado is False:
                    alerta_doble = "Doble check: posible discrepancia en importes"
                elif verificado is True:
                    alerta_doble = "Doble check: importes confirmados"

            # LLM 2 — campos
            datos_campos = llamar_llama_campos(texto_bruto, empresa_receptora, ruta.name, plantilla, guia_entrenamiento=guia_entrenamiento, empresa_cif=empresa_cif)

            liberar_modelos()

        # Postprocesar — la guía se aplica aquí como verificación/complemento final
        datos = postprocesar(datos_importes, datos_campos, texto_bruto, empresa_receptora, ruta.name, importes_pre, iva_pct, guia_entrenamiento=guia_entrenamiento, empresa_cif=empresa_cif)

        calidad = evaluar_calidad(texto_bruto)
        idioma = detectar_idioma(texto_bruto)
        alertas = verificar_logica(datos, texto_bruto)
        if alerta_doble:
            alertas.append(alerta_doble)

        return _guardar_resultado(datos, texto_bruto, ruta, ext, workspace, paths,
                                  calidad, idioma, alertas, n_paginas)

    except Exception as e:
        log.error(f"  ✗ [{workspace}]: {e}")
        estado_procesador["estado"] = "idle"
        estado_procesador["ts"] = 0
        return False

def _guardar_resultado(datos, texto_bruto, ruta, ext, workspace, paths, calidad, idioma, alertas, n_paginas):
    """Guarda el resultado procesado en Excel y mueve archivos."""
    estado_inicial = "Pendiente"
    if calidad == "baja":
        estado_inicial = "⚠ OCR bajo"
    elif any("discrepancia" in a.lower() for a in alertas):
        estado_inicial = "⚠ Doble check"

    nombre_guardado = generar_nombre_archivo(datos, ext)
    ruta_salida = paths["salida"] / nombre_guardado
    if ruta_salida.exists():
        ts_str = datetime.now().strftime("%H%M%S")
        nombre_guardado = f"{Path(nombre_guardado).stem}_{ts_str}{ext}"
        ruta_salida = paths["salida"] / nombre_guardado

    shutil.copy2(str(ruta), str(ruta_salida))
    try:
        paths["ocr"].mkdir(parents=True, exist_ok=True)
        (paths["ocr"] / nombre_ocr_para_archivo(nombre_guardado)).write_text(texto_bruto or "", encoding="utf-8")
    except Exception as e:
        log.warning(f"  No se pudo guardar OCR completo: {e}")

    fila = {
        "archivo_original": ruta.name, "archivo_guardado": nombre_guardado, "workspace": workspace,
        "numero_factura": datos.get("numero_factura", ""), "proveedor": datos.get("proveedor", ""),
        "empresa_receptora": datos.get("empresa_receptora", ""), "nif_cif": datos.get("nif_cif", ""),
        "fecha_factura": datos.get("fecha_factura", ""), "duracion_licencia": datos.get("duracion_licencia", ""),
        "base_imponible": datos.get("base_imponible", ""), "iva_porcentaje": datos.get("iva_porcentaje", ""),
        "iva_importe": datos.get("iva_importe", ""), "irpf_porcentaje": datos.get("irpf_porcentaje", ""),
        "irpf_importe": datos.get("irpf_importe", ""), "total_pagar": datos.get("total_pagar", ""),
        "moneda": datos.get("moneda", ""),
        "base_eur": datos.get("base_eur", ""), "total_eur": datos.get("total_eur", ""),
        "tipo_cambio": datos.get("tipo_cambio", ""), "fecha_tipo_cambio": datos.get("fecha_tipo_cambio", ""),
        "fuente_tipo_cambio": datos.get("fuente_tipo_cambio", ""),
        "concepto_mejorado": datos.get("concepto_mejorado", ""),
        "conceptos_originales": datos.get("conceptos_originales", ""),
        "idioma_factura": idioma, "calidad_ocr": calidad,
        "alertas": " | ".join(alertas) if alertas else "",
        "texto_ocr_bruto": texto_bruto[:32700], "deducible": "", "estado": estado_inicial,
        "fecha_proceso": datetime.now().isoformat(),
    }
    escribir_excel(_limpiar_fila_excel_dict(fila), workspace)

    destino = paths["procesados"] / ruta.name
    if destino.exists():
        ts_str = datetime.now().strftime("%H%M%S")
        destino = paths["procesados"] / f"{ruta.stem}_{ts_str}{ext}"
    shutil.move(str(ruta), str(destino))

    log.info(f"  ✓ → {nombre_guardado} [{estado_inicial}] págs={n_paginas}")
    estado_procesador["estado"] = "idle"
    return True

def mover_a_errores(ruta, workspace=""):
    paths = get_workspace_paths(workspace)
    try:
        destino = paths["errores"] / ruta.name
        if destino.exists():
            ts_str = datetime.now().strftime("%H%M%S")
            destino = paths["errores"] / f"{ruta.stem}_{ts_str}{ruta.suffix}"
        shutil.move(str(ruta), str(destino))
    except Exception as e:
        log.error(f"  No se pudo mover a errores: {e}")

def bucle(workspace="", stop_flags: dict | None = None, pause_flags: dict | None = None):
    log.info(f"  Procesador [{workspace}] v14 iniciado")
    crear_carpetas_workspace(workspace)
    paths = get_workspace_paths(workspace)
    reintentos = {}
    while True:
        try:
            # ── Salida limpia si el workspace fue eliminado ──
            if stop_flags and stop_flags.get(workspace):
                log.info(f"  Procesador [{workspace}] detenido (workspace eliminado)")
                break
            ws_dir = _workspace_dir(workspace)
            if workspace != "default" and not ws_dir.exists():
                log.info(f"  Procesador [{workspace}] detenido (carpeta no existe)")
                break

            # ── Watchdog: limpiar solo estados viejos que ya no tengan trabajo activo ──
            if pause_flags and pause_flags.get(workspace):
                time.sleep(pausa_cola_vacia())
                continue

            est = estado_procesador.get("estado", "idle")
            ts  = estado_procesador.get("ts", 0)
            ws_est = estado_procesador.get("workspace", "")
            secs = int(time.time() - ts) if ts else 0
            if (
                est in ("ocr", "llm", "vision")
                and ts
                and secs > watchdog_timeout()
                and ws_est == workspace
                and not ollama_lock.locked()
            ):
                log.warning(f"  ⚠ Watchdog: estado viejo en '{est}' ({secs}s) — limpiando")
                estado_procesador["estado"] = "idle"
                estado_procesador["ts"] = 0

            archivos = [f for f in sorted(paths["entrada"].iterdir())
                        if f.is_file() and f.suffix.lower() in EXTENSIONES]
            if archivos:
                if not motor_local_disponible():
                    log.warning(f"  [{workspace}] Ollama no disponible; cola pausada ({len(archivos)} pendiente/s)")
                    estado_procesador["estado"] = "error"
                    estado_procesador["archivo"] = "Ollama no disponible"
                    estado_procesador["workspace"] = workspace
                    estado_procesador["ts"] = time.time()
                    time.sleep(pausa_cola_vacia())
                    continue
                for ruta in archivos:
                    if pause_flags and pause_flags.get(workspace):
                        log.info(f"  [{workspace}] cola pausada; no se procesan mas facturas")
                        break
                    nombre = ruta.name
                    intentos = reintentos.get(nombre, 0)
                    if intentos >= MAX_REINTENTOS:
                        log.warning(f"  → {nombre}: máximo reintentos, moviendo a errores")
                        mover_a_errores(ruta, workspace)
                        reintentos.pop(nombre, None)
                        continue
                    ok = procesar_archivo(ruta, workspace)
                    if ok:
                        reintentos.pop(nombre, None)
                    else:
                        reintentos[nombre] = intentos + 1
                        log.info(f"  → {nombre}: intento {intentos+1}/{MAX_REINTENTOS}")
                    time.sleep(pausa_entre_arch())
            else:
                time.sleep(pausa_cola_vacia())
        except KeyboardInterrupt:
            break
        except Exception as e:
            log.error(f"  Error bucle [{workspace}]: {e}")
            time.sleep(pausa_cola_vacia())
