"""Persistent, shared user dictionary for the desktop app and extension."""

import json
import os
import sys
import tempfile
import threading
from pathlib import Path

STORE_VERSION = 1
DICTIONARY_FILENAME = "dictionary.json"
_STORE_LOCK = threading.RLock()


def app_data_dir() -> Path:
    """Return the platform-specific Lexicon application-data directory."""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Lexicon"
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home())) / "Lexicon"
    return Path.home() / ".local" / "share" / "Lexicon"


def dictionary_path() -> Path:
    """Return the dictionary path without creating the directory."""
    return app_data_dir() / DICTIONARY_FILENAME


def normalize_word(value: object) -> str:
    """Trim a dictionary entry and reject non-string or empty values."""
    if not isinstance(value, str):
        return ""
    return value.strip()


def normalize_words(values: object) -> list[str]:
    """Normalize entries while preserving the first spelling of each word."""
    if not isinstance(values, list):
        return []
    seen: set[str] = set()
    words: list[str] = []
    for value in values:
        word = normalize_word(value)
        key = word.casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        words.append(word)
    return words


def _empty_store() -> dict:
    return {"version": STORE_VERSION, "revision": 0, "words": []}


def _read_store_unlocked() -> dict:
    path = dictionary_path()
    try:
        with path.open("r", encoding="utf-8") as stream:
            data = json.load(stream)
    except FileNotFoundError:
        return _empty_store()
    except (OSError, ValueError, TypeError):
        return _empty_store()

    if isinstance(data, list):
        return {"version": STORE_VERSION, "revision": 0, "words": normalize_words(data)}
    if not isinstance(data, dict):
        return _empty_store()

    try:
        revision = max(0, int(data.get("revision", 0)))
    except (TypeError, ValueError):
        revision = 0
    return {
        "version": STORE_VERSION,
        "revision": revision,
        "words": normalize_words(data.get("words")),
    }


def _snapshot(store: dict) -> dict:
    return {
        "words": list(store["words"]),
        "revision": int(store["revision"]),
    }


def _write_store_unlocked(words: list[str], revision: int) -> None:
    path = dictionary_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    file_descriptor, temporary_path = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    try:
        with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(
                {
                    "version": STORE_VERSION,
                    "revision": revision,
                    "words": words,
                },
                stream,
                ensure_ascii=False,
                indent=2,
            )
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass


def get_dictionary() -> dict:
    """Return the current canonical words and revision."""
    with _STORE_LOCK:
        return _snapshot(_read_store_unlocked())


def add_word(value: object) -> dict:
    """Add one word idempotently and return the resulting snapshot."""
    word = normalize_word(value)
    if not word:
        raise ValueError("Dictionary word cannot be empty.")

    with _STORE_LOCK:
        store = _read_store_unlocked()
        existing = next(
            (item for item in store["words"] if item.casefold() == word.casefold()),
            None,
        )
        if existing is not None:
            result = _snapshot(store)
            result.update({"word": existing, "added": False})
            return result

        words = [*store["words"], word]
        revision = store["revision"] + 1
        _write_store_unlocked(words, revision)
        result = {"words": words, "revision": revision}
        result.update({"word": word, "added": True})
        return result


def remove_word(value: object) -> dict:
    """Remove one word idempotently and return the resulting snapshot."""
    word = normalize_word(value)
    if not word:
        raise ValueError("Dictionary word cannot be empty.")

    with _STORE_LOCK:
        store = _read_store_unlocked()
        existing = next(
            (item for item in store["words"] if item.casefold() == word.casefold()),
            None,
        )
        if existing is None:
            result = _snapshot(store)
            result.update({"word": word, "removed": False})
            return result

        words = [item for item in store["words"] if item.casefold() != word.casefold()]
        revision = store["revision"] + 1
        _write_store_unlocked(words, revision)
        result = {"words": words, "revision": revision}
        result.update({"word": existing, "removed": True})
        return result
