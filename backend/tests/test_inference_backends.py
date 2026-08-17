"""Test local inference backends."""

import sys
import threading
import time
from pathlib import Path

import pytest
import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import ai_prefs  # noqa: E402
import inference  # noqa: E402
from inference import (  # noqa: E402
    InferenceCancelled,
    InferenceUnavailable,
    LMStudioBackend,
)


class FakeResponse:
    def __init__(self, payload=None, lines=None, status_code=200):
        self.payload = payload
        self.lines = lines or []
        self.status_code = status_code
        self.closed = False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)
        return None

    def json(self):
        return self.payload

    def iter_lines(self, decode_unicode=True):
        return iter(self.lines)

    def close(self):
        self.closed = True


def test_lmstudio_uses_native_models_endpoint(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout):
        requests_seen.append((url, timeout))
        return FakeResponse(
            {
                "models": [
                    {
                        "type": "llm",
                        "key": "qwen/qwen3-4b",
                        "loaded_instances": [{"id": "qwen/qwen3-4b"}],
                    },
                    {
                        "type": "embedding",
                        "key": "nomic-embed-text",
                        "loaded_instances": [{"id": "nomic-embed-text"}],
                    },
                    {
                        "type": "llm",
                        "key": "llama/llama-3.2-3b",
                        "loaded_instances": [],
                    },
                ]
            }
        )

    monkeypatch.setattr("inference.requests.get", fake_get)

    backend = LMStudioBackend("http://localhost:1234/v1")

    assert backend.available()
    assert backend._models() == ["qwen/qwen3-4b", "llama/llama-3.2-3b"]
    assert backend.loaded_models() == ["qwen/qwen3-4b"]
    assert requests_seen == [
        ("http://localhost:1234/api/v1/models", 3.0),
        ("http://localhost:1234/api/v1/models", 3.0),
    ]


def test_lmstudio_falls_back_to_openai_models_endpoint(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout):
        requests_seen.append(url)
        if url.endswith("/api/v1/models"):
            return FakeResponse(status_code=404)
        return FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]})

    monkeypatch.setattr("inference.requests.get", fake_get)

    backend = LMStudioBackend()

    assert backend.available()
    assert requests_seen == [
        "http://localhost:1234/api/v1/models",
        "http://localhost:1234/v1/models",
    ]


def test_lmstudio_allows_jit_model_without_loaded_instance(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse(
            {
                "models": [
                    {
                        "type": "llm",
                        "key": "qwen/qwen3.5-9b",
                        "loaded_instances": [],
                    }
                ]
            }
        ),
    )

    backend = LMStudioBackend()

    assert backend._models() == ["qwen/qwen3.5-9b"]
    assert backend.loaded_models() == []
    assert backend.available()


def test_lmstudio_reports_authentication_required(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse(status_code=401),
    )

    backend = LMStudioBackend()

    assert backend._models() == []
    assert backend.server_reachable()
    assert backend.authentication_required()


def test_lmstudio_sends_openai_chat_completion(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout):
        if url.endswith("/api/v1/models"):
            return FakeResponse(status_code=404)
        return FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]})

    def fake_post(url, json, stream, timeout):
        requests_seen.append((url, json, timeout))
        return FakeResponse(
            lines=[
                'data: {"choices":[{"delta":{"reasoning":"skip"}}]}',
                'data: {"choices":[{"delta":{"content":"Rewritten "}}]}',
                'data: {"choices":[{"delta":{"content":"text"}}]}',
                "data: [DONE]",
            ],
        )

    monkeypatch.setattr("inference.requests.get", fake_get)
    monkeypatch.setattr("inference.requests.post", fake_post)

    result = LMStudioBackend().complete("Make it concise.", "A long sentence.")

    assert result == "Rewritten text"
    assert requests_seen[0][0] == "http://localhost:1234/v1/chat/completions"
    assert requests_seen[0][1]["model"] == "qwen/qwen3-4b"
    assert requests_seen[0][1]["stream"] is True
    assert requests_seen[0][1]["reasoning_effort"] == "none"
    assert requests_seen[0][1]["messages"][1]["content"] == (
        "Make it concise.\n\nA long sentence."
    )


def test_lmstudio_sends_api_token_to_probe_and_completion(monkeypatch):
    requests_seen = []

    def fake_get(url, timeout, headers):
        requests_seen.append(("get", url, headers))
        return FakeResponse(
            {
                "models": [
                    {
                        "type": "llm",
                        "loaded_instances": [{"id": "qwen/qwen3-4b"}],
                    }
                ]
            }
        )

    def fake_post(url, json, stream, timeout, headers):
        requests_seen.append(("post", url, headers))
        return FakeResponse(lines=['data: {"choices":[{"delta":{"content":"Done"}}]}'])

    monkeypatch.setattr("inference.requests.get", fake_get)
    monkeypatch.setattr("inference.requests.post", fake_post)

    result = LMStudioBackend(api_key="  test-token  ").complete("Rewrite.", "Text.")

    assert result == "Done"
    assert requests_seen[0][2] == {"Authorization": "Bearer test-token"}
    assert requests_seen[1][2] == {"Authorization": "Bearer test-token"}


def test_lmstudio_uses_manual_preferred_model_name(monkeypatch):
    requests_seen = []

    def fake_post(url, json, stream, timeout):
        requests_seen.append(json)
        return FakeResponse(lines=['data: {"choices":[{"delta":{"content":"Done"}}]}'])

    monkeypatch.setattr("inference.requests.post", fake_post)

    result = LMStudioBackend(model="publisher/model@q4_k_m").complete(
        "Rewrite.", "Text."
    )

    assert result == "Done"
    assert requests_seen[0]["model"] == "publisher/model@q4_k_m"


def test_lmstudio_rejects_reasoning_only_output(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]}),
    )
    monkeypatch.setattr(
        "inference.requests.post",
        lambda url, json, stream, timeout: FakeResponse(
            lines=[
                'data: {"choices":[{"delta":{"reasoning":"still thinking"}}]}',
                "data: [DONE]",
            ]
        ),
    )

    with pytest.raises(InferenceUnavailable, match="no final text"):
        LMStudioBackend().complete("Rewrite.", "Text.")


def test_ollama_disables_thinking_and_returns_streamed_text(monkeypatch):
    requests_seen = []

    def fake_post(url, json, stream, timeout):
        requests_seen.append((url, json, stream, timeout))
        return FakeResponse(
            lines=[
                '{"response":"Rewritten "}',
                '{"response":"text","done":true}',
            ]
        )

    monkeypatch.setattr("inference.requests.post", fake_post)

    result = inference.OllamaBackend(model="qwen3.5").complete(
        "Make it concise.", "A long sentence."
    )

    assert result == "Rewritten text"
    assert requests_seen[0][1]["stream"] is True
    assert requests_seen[0][1]["think"] is False


def test_ollama_stream_stops_after_cancellation(monkeypatch):
    started = threading.Event()
    cancel_event = threading.Event()
    response = FakeResponse()

    def iter_lines(decode_unicode=True):
        started.set()
        while not response.closed:
            time.sleep(0.001)
            if not response.closed:
                yield '{"response":"partial"}'

    response.iter_lines = iter_lines
    monkeypatch.setattr(
        "inference.requests.post",
        lambda url, json, stream, timeout: response,
    )
    errors = []

    def run():
        try:
            inference.OllamaBackend(model="qwen3.5").complete(
                "Rewrite.", "Text.", cancel_event=cancel_event
            )
        except Exception as exc:  # noqa: BLE001 - The test checks the exception type.
            errors.append(exc)

    thread = threading.Thread(target=run)
    thread.start()
    assert started.wait(1)
    cancel_event.set()
    response.close()
    thread.join(1)

    assert not thread.is_alive()
    assert isinstance(errors[0], InferenceCancelled)


def test_lmstudio_requires_an_available_model(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": []}),
    )

    with pytest.raises(InferenceUnavailable, match="no available LLM"):
        LMStudioBackend().complete("Rewrite.", "Text.")


def test_lmstudio_reports_a_reachable_server_without_a_loaded_model(monkeypatch):
    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": []}),
    )

    backend = LMStudioBackend()

    assert not backend.available()
    assert backend.server_reachable()


def test_lmstudio_model_preference_round_trips(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_prefs, "PREFS_PATH", str(tmp_path / "ai_prefs.json"))

    saved = ai_prefs.save_prefs(
        "lmstudio",
        "2b",
        "",
        "qwen/qwen3-4b",
        "http://192.168.1.25:1234",
        "test-token",
    )

    assert saved["backend"] == "lmstudio"
    assert saved["lmstudio_model"] == "qwen/qwen3-4b"
    assert saved["lmstudio_url"] == "http://192.168.1.25:1234"
    assert saved["lmstudio_api_key"] == "test-token"
    assert ai_prefs.load_prefs() == saved
    public = ai_prefs.public_prefs(saved)
    assert "lmstudio_api_key" not in public
    assert public["lmstudio_api_key_configured"] is True


def test_saved_lmstudio_preference_selects_lmstudio_backend(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_prefs, "PREFS_PATH", str(tmp_path / "ai_prefs.json"))
    ai_prefs.save_prefs(
        "lmstudio",
        "2b",
        "",
        "qwen/qwen3-4b",
        "http://192.168.1.25:1234",
    )
    monkeypatch.setattr(inference, "_backend", None)
    monkeypatch.setattr(inference, "FORCE_BACKEND", "")

    monkeypatch.setattr(
        "inference.requests.get",
        lambda url, timeout: FakeResponse({"data": [{"id": "qwen/qwen3-4b"}]}),
    )

    backend = inference.get_backend(force_refresh=True)

    assert isinstance(backend, LMStudioBackend)
    assert backend.base_url == "http://192.168.1.25:1234"
