"""Test local inference backends."""

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import ai_prefs  # noqa: E402
import inference  # noqa: E402
from inference import InferenceUnavailable, LMStudioBackend  # noqa: E402


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def test_lmstudio_uses_v1_models_endpoint(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout):
        requests_seen.append((url, timeout))
        return FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]})

    monkeypatch.setattr("inference.requests.get", fake_get)

    backend = LMStudioBackend("http://localhost:1234/v1")

    assert backend.available()
    assert backend._models() == ["qwen/qwen3-4b"]
    assert requests_seen == [
        ("http://localhost:1234/v1/models", 3.0),
        ("http://localhost:1234/v1/models", 3.0),
    ]


def test_lmstudio_sends_openai_chat_completion(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout):
        return FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]})

    def fake_post(url, json, timeout):
        requests_seen.append((url, json, timeout))
        return FakeResponse(
            {
                "choices": [
                    {"message": {"content": "<think>skip</think>Rewritten text"}}
                ]
            }
        )

    monkeypatch.setattr("inference.requests.get", fake_get)
    monkeypatch.setattr("inference.requests.post", fake_post)

    result = LMStudioBackend().complete("Make it concise.", "A long sentence.")

    assert result == "Rewritten text"
    assert requests_seen[0][0] == "http://localhost:1234/v1/chat/completions"
    assert requests_seen[0][1]["model"] == "qwen/qwen3-4b"
    assert requests_seen[0][1]["stream"] is False
    assert requests_seen[0][1]["messages"][1]["content"] == (
        "Make it concise.\n\nA long sentence."
    )


def test_lmstudio_requires_a_loaded_model(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": []}),
    )

    with pytest.raises(InferenceUnavailable, match="no loaded model"):
        LMStudioBackend().complete("Rewrite.", "Text.")


def test_lmstudio_model_preference_round_trips(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_prefs, "PREFS_PATH", str(tmp_path / "ai_prefs.json"))

    saved = ai_prefs.save_prefs("lmstudio", "2b", "", "qwen/qwen3-4b")

    assert saved["backend"] == "lmstudio"
    assert saved["lmstudio_model"] == "qwen/qwen3-4b"
    assert ai_prefs.load_prefs() == saved


def test_saved_lmstudio_preference_selects_lmstudio_backend(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_prefs, "PREFS_PATH", str(tmp_path / "ai_prefs.json"))
    ai_prefs.save_prefs("lmstudio", "2b", "", "qwen/qwen3-4b")
    monkeypatch.setattr(inference, "_backend", None)
    monkeypatch.setattr(inference, "FORCE_BACKEND", "")

    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]}),
    )

    backend = inference.get_backend(force_refresh=True)

    assert isinstance(backend, LMStudioBackend)
