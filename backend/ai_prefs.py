"""Persisted AI backend preference.

The user's chosen backend (Ollama vs bundled) and, for the bundled path, which
model tier (2B / 0.8B) is the *active* one. This is the single source of truth
that drives `inference.get_backend()` and survives restarts — without it, the
editor would re-probe Ollama on every launch and silently forget the user's
pick. Stored as a tiny JSON file in the same app-data dir as the models.
"""

import json
import os

from model_manager import models_dir

PREFS_PATH = os.path.join(models_dir(), "ai_prefs.json")

# Sentinel meaning "no explicit choice yet — auto-detect (prefer Ollama)."
DEFAULT_PREFS = {"backend": "auto", "model_key": "2b"}

_VALID_BACKENDS = ("auto", "ollama", "bundled")
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
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    return {"backend": backend, "model_key": model_key}


def save_prefs(backend: str, model_key: str) -> dict:
    """Persist a choice. Unknown values are coerced to defaults."""
    if backend not in _VALID_BACKENDS:
        backend = DEFAULT_PREFS["backend"]
    if model_key not in _VALID_KEYS:
        model_key = DEFAULT_PREFS["model_key"]
    prefs = {"backend": backend, "model_key": model_key}
    try:
        with open(PREFS_PATH, "w", encoding="utf-8") as fh:
            json.dump(prefs, fh)
    except OSError:
        # Non-fatal: the in-memory choice still applies for this session.
        pass
    return prefs
