"""Save the selected AI backend.

The backend can be Ollama, LM Studio, or the bundled model. The file also
stores the bundled model tier and the selected server models. The inference
module reads this file after the application restarts.
"""

import json
import os

from model_manager import models_dir

PREFS_PATH = os.path.join(models_dir(), "ai_prefs.json")

# Sentinel meaning "no explicit choice yet — auto-detect (prefer Ollama)."
DEFAULT_PREFS = {
    "backend": "auto",
    "model_key": "2b",
    "ollama_model": "",
    "lmstudio_model": "",
    "lmstudio_url": "",
    "lmstudio_api_key": "",
}

_VALID_BACKENDS = ("auto", "ollama", "lmstudio", "bundled")
_VALID_KEYS = ("2b", "0.8b")


def load_prefs() -> dict:
    """Return the saved preference, falling back to defaults if missing/unreadable."""
    try:
        with open(PREFS_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_PREFS)
    backend = data.get("backend", DEFAULT_PREFS["backend"])
    model_key = data.get("model_key", DEFAULT_PREFS["model_key"])
    ollama_model = data.get("ollama_model", DEFAULT_PREFS["ollama_model"])
    lmstudio_model = data.get("lmstudio_model", DEFAULT_PREFS["lmstudio_model"])
    lmstudio_url = data.get("lmstudio_url", DEFAULT_PREFS["lmstudio_url"])
    lmstudio_api_key = data.get(
        "lmstudio_api_key",
        DEFAULT_PREFS["lmstudio_api_key"],
    )
    if not isinstance(lmstudio_url, str):
        lmstudio_url = DEFAULT_PREFS["lmstudio_url"]
    if not isinstance(lmstudio_api_key, str):
        lmstudio_api_key = DEFAULT_PREFS["lmstudio_api_key"]
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    return {
        "backend": backend,
        "model_key": model_key,
        "ollama_model": ollama_model,
        "lmstudio_model": lmstudio_model,
        "lmstudio_url": lmstudio_url,
        "lmstudio_api_key": lmstudio_api_key,
    }


def save_prefs(
    backend: str,
    model_key: str,
    ollama_model: str = "",
    lmstudio_model: str = "",
    lmstudio_url: str = "",
    lmstudio_api_key: str | None = None,
) -> dict:
    """Persist a choice. Unknown values are coerced to defaults."""
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    if lmstudio_api_key is None:
        lmstudio_api_key = load_prefs().get(
            "lmstudio_api_key",
            DEFAULT_PREFS["lmstudio_api_key"],
        )
    if not isinstance(lmstudio_api_key, str):
        lmstudio_api_key = DEFAULT_PREFS["lmstudio_api_key"]
    prefs = {
        "backend": backend,
        "model_key": model_key,
        "ollama_model": ollama_model,
        "lmstudio_model": lmstudio_model,
        "lmstudio_url": lmstudio_url,
        "lmstudio_api_key": lmstudio_api_key.strip(),
    }
    try:
        with open(PREFS_PATH, "w", encoding="utf-8") as fh:
            json.dump(prefs, fh)
    except OSError:
        # Non-fatal: the in-memory choice still applies for this session.
        pass
    return prefs


def public_prefs(prefs: dict | None = None) -> dict:
    """Return preferences without exposing the LM Studio API token."""
    data = dict(prefs or load_prefs())
    api_key = data.pop("lmstudio_api_key", "")
    data["lmstudio_api_key_configured"] = bool(api_key)
    return data
