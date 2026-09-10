"""Proofreading language preference round-trips through ai_prefs."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import ai_prefs  # noqa: E402
import inference  # noqa: E402
import main  # noqa: E402
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


def _raise_if_probed(name):
    def _raise(*args, **kwargs):
        raise AssertionError(f"{name} must not be probed")
    return _raise


def test_status_lite_skips_external_probes_for_bundled(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    monkeypatch.setattr(inference, "_backend", None)
    ai_prefs.save_prefs("bundled", "2b", proofreading_language="es")
    monkeypatch.setattr(main, "OllamaBackend", _raise_if_probed("OllamaBackend"))
    monkeypatch.setattr(main, "LMStudioBackend", _raise_if_probed("LMStudioBackend"))
    resp = main.ai_status_lite()
    assert resp["ollama_available"] is False
    assert resp["lmstudio_available"] is False
    assert resp["preference"]["proofreading_language"] == "es"
    assert resp["active_backend"] == "bundled"
    assert "gpu_info" not in resp
    assert "hardware" not in resp
    assert "tier_upgrades" not in resp


def test_status_lite_reports_ollama_when_preferred(tmp_path, monkeypatch):
    _prefs_path(tmp_path, monkeypatch)
    monkeypatch.setattr(inference, "_backend", None)
    ai_prefs.save_prefs("ollama", "2b", proofreading_language="de")
    monkeypatch.setattr(main, "LMStudioBackend", _raise_if_probed("LMStudioBackend"))

    class FakeOllama:
        def _chat_models(self):
            return ["llama3"]

    monkeypatch.setattr(main, "OllamaBackend", FakeOllama)
    resp = main.ai_status_lite()
    assert resp["ollama_available"] is True
    assert resp["preference"]["proofreading_language"] == "de"
