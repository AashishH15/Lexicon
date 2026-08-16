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
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    return {
        "backend": backend,
        "model_key": model_key,
        "ollama_model": ollama_model,
        "lmstudio_model": lmstudio_model,
    }


def save_prefs(
    backend: str,
    model_key: str,
    ollama_model: str = "",
    lmstudio_model: str = "",
) -> dict:
    """Persist a choice. Unknown values are coerced to defaults."""
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    prefs = {
        "backend": backend,
        "model_key": model_key,
        "ollama_model": ollama_model,
        "lmstudio_model": lmstudio_model,
    }
    try:
        with open(PREFS_PATH, "w", encoding="utf-8") as fh:
            json.dump(prefs, fh)
    except OSError:
        # Non-fatal: the in-memory choice still applies for this session.
        pass
    return prefs
