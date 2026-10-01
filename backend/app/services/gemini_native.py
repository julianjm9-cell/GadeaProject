from __future__ import annotations

import asyncio
import random
import re


def is_auth_key(key: str) -> bool:
    return (key or "").startswith("AQ.")


def generate_url(model: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,120}", model):
        raise ValueError("Identificador de modelo Gemini no válido.")
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def request_body(payload: dict) -> dict:
    instructions = []
    contents = []
    for message in payload.get("messages", []):
        if not isinstance(message, dict) or not isinstance(message.get("content"), str):
            continue
        role = message.get("role")
        if role in {"system", "developer"}:
            instructions.append(message["content"])
        elif role in {"user", "assistant"}:
            contents.append({"role": "model" if role == "assistant" else "user", "parts": [{"text": message["content"]}]})
    body = {"contents": contents or [{"role": "user", "parts": [{"text": ""}]}]}
    if instructions:
        body["systemInstruction"] = {"parts": [{"text": "\n\n".join(instructions)}]}
    generation = {}
    if payload.get("max_tokens"):
        generation["maxOutputTokens"] = int(payload["max_tokens"])
    if payload.get("temperature") is not None:
        generation["temperature"] = payload["temperature"]
    if payload.get("response_format", {}).get("type") == "json_object":
        generation["responseMimeType"] = "application/json"
    if generation:
        body["generationConfig"] = generation
    return body


def chat_data(body: dict) -> dict:
    candidates = body.get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    content = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    usage = body.get("usageMetadata") or {}
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {
            "prompt_tokens": usage.get("promptTokenCount", 0),
            "completion_tokens": usage.get("candidatesTokenCount", 0),
        },
    }


async def post_with_retry(client, url: str, *, headers: dict, json: dict, delays=(1,)):
    """Retry brief Gemini overloads; the caller records usage only after success."""
    response = None
    for attempt in range(len(delays) + 1):
        response = await client.post(url, headers=headers, json=json)
        if response.status_code not in {408, 500, 502, 503, 504} or attempt == len(delays):
            return response
        await asyncio.sleep(delays[attempt] + (random.uniform(0, 0.25) if delays[attempt] else 0))
    return response


def failure_message(response, key: str) -> str:
    try:
        error = response.json().get("error", {})
        message = str(error.get("message") or "").replace(key, "[clave]")[:240]
    except (ValueError, AttributeError, TypeError):
        message = ""
    explanations = {
        400: "Petición o modelo no admitido.",
        401: "Google rechazó la clave.",
        403: "La clave no tiene permiso para este servicio o modelo.",
        404: "Google no encuentra el modelo o la ruta.",
        429: "Cuota o límite de uso alcanzado.",
        503: "El modelo está saturado temporalmente. Inténtalo más tarde o elige otro modelo.",
    }
    return f"Gemini {response.status_code}: {explanations.get(response.status_code, 'No se pudo conectar.')} {message}".strip()
