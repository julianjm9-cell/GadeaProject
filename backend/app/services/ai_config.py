from __future__ import annotations


OPENAI_CHAT_DEFAULT = "gpt-4o-mini"
OPENAI_TRANSCRIBE_DEFAULT = "whisper-1"
GROQ_CHAT_DEFAULT = "openai/gpt-oss-120b"
GROQ_FAST_CHAT_DEFAULT = "openai/gpt-oss-20b"
GROQ_TRANSCRIBE_DEFAULT = "whisper-large-v3-turbo"
GEMINI_CHAT_DEFAULT = "gemini-2.5-flash"

DEPRECATED_GROQ_CHAT_MODELS = {
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "llama3-70b-8192",
    "qwen/qwen3-32b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
}


def valid_openai_key(value: str) -> bool:
    return bool((value or "").strip().startswith(("sk-", "sk-proj-")))


def valid_groq_key(value: str) -> bool:
    return bool((value or "").strip().startswith("gsk_"))


def valid_gemini_key(value: str) -> bool:
    return bool((value or "").strip())


def default_chat_model(provider: str) -> str:
    provider = (provider or "").strip().lower()
    if provider == "groq":
        return GROQ_CHAT_DEFAULT
    if provider == "gemini":
        return GEMINI_CHAT_DEFAULT
    return OPENAI_CHAT_DEFAULT


def default_transcribe_model(provider: str) -> str:
    return GROQ_TRANSCRIBE_DEFAULT if (provider or "").strip().lower() == "groq" else OPENAI_TRANSCRIBE_DEFAULT


def normalize_chat_model(provider: str, model: str) -> str:
    provider = (provider or "").strip().lower()
    model = (model or "").strip()
    if provider == "groq":
        if not model or model in DEPRECATED_GROQ_CHAT_MODELS or model.startswith(("gpt-4", "gpt-5", "gemini-")):
            return GROQ_CHAT_DEFAULT
    elif provider == "gemini":
        if not model or not model.startswith("gemini-"):
            return GEMINI_CHAT_DEFAULT
    elif not model or model.startswith(("llama-", "openai/gpt-oss", "groq/", "qwen/", "gemini-")):
        return OPENAI_CHAT_DEFAULT
    return model


def normalize_transcribe_model(provider: str, model: str) -> str:
    provider = (provider or "").strip().lower()
    model = (model or "").strip()
    if provider == "groq":
        if not model or model == OPENAI_TRANSCRIBE_DEFAULT or model.startswith("gpt-"):
            return GROQ_TRANSCRIBE_DEFAULT
    elif not model or model.startswith("whisper-large"):
        return OPENAI_TRANSCRIBE_DEFAULT
    return model
