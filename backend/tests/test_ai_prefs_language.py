"""Proofreading language preference round-trips through ai_prefs."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import ai_prefs  # noqa: E402
from main import ProofreadingLanguageRequest, proofreading_language_set  # noqa: E402


def _prefs_path(tmp_path, monkeypatch):
    path = tmp_path / "ai_prefs.json"
    monkeypatch.setattr(ai_prefs, "PREFS_PATH", str(path))
    return path


def test_proofreading_language_defaults_to_us(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    assert ai_prefs.load_prefs()["proofreading_language"] == "en-US"


def test_proofreading_language_roundtrip(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    prefs = ai_prefs.save_prefs("auto", "2b", proofreading_language="es")
    assert prefs["proofreading_language"] == "es"
    assert ai_prefs.load_prefs()["proofreading_language"] == "es"


def test_proofreading_language_rejects_garbage(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    prefs = ai_prefs.save_prefs("auto", "2b", proofreading_language="not a language!!")
    assert prefs["proofreading_language"] == "en-US"


def test_proofreading_language_kept_when_omitted(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    ai_prefs.save_prefs("auto", "2b", proofreading_language="de")
    prefs = ai_prefs.save_prefs("auto", "2b")
    assert prefs["proofreading_language"] == "de"


def test_proofreading_language_endpoint_roundtrip(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    resp = proofreading_language_set(ProofreadingLanguageRequest(language="es"))
    assert resp["proofreading_language"] == "es"
    assert ai_prefs.load_prefs()["proofreading_language"] == "es"


def test_proofreading_language_endpoint_coerces_garbage(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    resp = proofreading_language_set(
        ProofreadingLanguageRequest(language="not a tag!!")
    )
    assert resp["proofreading_language"] == "en-US"
