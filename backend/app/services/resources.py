from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONTENT_DIR = Path(__file__).resolve().parents[1] / "content"
RESOURCE_FILE = CONTENT_DIR / "official_resources.json"
RESOURCE_KEYS = ("universidad_adultos", "eso_adultos")


def _empty_catalog() -> dict[str, list[dict[str, Any]]]:
    return {key: [] for key in RESOURCE_KEYS}


def normalize_resource(item: dict[str, Any]) -> dict[str, Any]:
    tags = item.get("tags") or []
    return {
        "title": str(item.get("title") or "").strip()[:180],
        "source": str(item.get("source") or "").strip()[:120],
        "url": str(item.get("url") or "").strip()[:600],
        "tags": [str(tag).strip().lower()[:40] for tag in tags if str(tag).strip()][:12],
        "desc": str(item.get("desc") or "").strip()[:500],
    }


def load_resource_catalog() -> dict[str, list[dict[str, Any]]]:
    if not RESOURCE_FILE.exists():
        return _empty_catalog()
    try:
        data = json.loads(RESOURCE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return _empty_catalog()
    catalog = _empty_catalog()
    for key in RESOURCE_KEYS:
        items = data.get(key, [])
        if isinstance(items, list):
            catalog[key] = [normalize_resource(item) for item in items if isinstance(item, dict)]
    return catalog


def save_resource_catalog(catalog: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    normalized = _empty_catalog()
    for key in RESOURCE_KEYS:
        items = catalog.get(key, [])
        if isinstance(items, list):
            normalized[key] = [
                item
                for item in (normalize_resource(raw) for raw in items if isinstance(raw, dict))
                if item["title"] and item["url"]
            ]
    CONTENT_DIR.mkdir(parents=True, exist_ok=True)
    RESOURCE_FILE.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized
