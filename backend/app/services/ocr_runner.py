"""One child process per invoice. No shared legacy globals or customer config."""
import json
import os
import sys
from pathlib import Path


def main():
    payload = json.load(sys.stdin)
    folder = Path(payload["folder"]).resolve()
    os.environ["ALIOT_DATA_DIR"] = str(folder)
    os.environ["ALIOT_FACTURAS_DIR"] = str(folder / "work")
    from app.ocr_engine import procesador_facturas as engine
    config = payload["config"]
    config["carpeta_facturas"] = str(folder / "work")
    engine._load_config = lambda: config
    engine.leer_config_api = lambda: {**config, "tipo": config["api_tipo"]}
    engine.crear_carpetas_workspace("invoice")
    output = {}
    usage = {"input_tokens": 0, "output_tokens": 0}
    original_post = engine.requests.post
    def counted_post(*args, **kwargs):
        response = original_post(*args, **kwargs)
        response.raise_for_status()
        info = response.json().get("usage", {})
        usage["input_tokens"] += int(info.get("prompt_tokens", info.get("input_tokens", 0)))
        usage["output_tokens"] += int(info.get("completion_tokens", info.get("output_tokens", 0)))
        return response
    engine.requests.post = counted_post
    def save(datos, texto, ruta, ext, workspace, paths, calidad, idioma, alertas, pages):
        output.update({"fields": datos, "quality": calidad, "language": idioma, "warnings": alertas, "pages": pages})
        return True
    engine._guardar_resultado = save
    # Do not silently turn an invalid model response into an empty invoice.
    parse = engine.extraer_json_robusto
    def strict_json(raw):
        data = parse(raw)
        if not data:
            raise ValueError("Respuesta de IA sin datos válidos")
        return data
    engine.extraer_json_robusto = strict_json
    if not engine.procesar_archivo(folder / ("source" + payload["suffix"]), "invoice") or not output:
        raise ValueError("No se pudo extraer la factura")
    output["usage"] = usage
    (folder / "result.json").write_text(json.dumps(output, ensure_ascii=False, default=str), encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Provider errors may contain sensitive request data. Never return them.
        sys.exit(1)
