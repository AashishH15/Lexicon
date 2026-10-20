"""HTTP handlers must not send exception text to the client."""

import json
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402
from inference import InferenceUnavailable  # noqa: E402
from main import app  # noqa: E402

SECRET_PATH = r"C:\Users\secret\AppData\Lexicon\models\secret.gguf"


def _auth_client():
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {app.state.auth_token}"
    return client


def test_grammar_check_keeps_java_hint_without_exception_text(monkeypatch):
    def boom(*_args, **_kwargs):
        raise Exception(f"can't find Java at {SECRET_PATH}")

    monkeypatch.setattr(main, "check_text", boom)
    response = main.grammar_check(main.GrammarRequest(text="teh cat"))
    body = json.loads(response.body.decode())

    assert response.status_code == 503
    assert body["error"] == "grammar_engine_unavailable"
    assert "java" in body["detail"].lower()
    assert SECRET_PATH not in body["detail"]
    assert SECRET_PATH not in json.dumps(body)


def test_grammar_check_uses_generic_detail_for_other_failures(monkeypatch):
    def boom(*_args, **_kwargs):
        raise Exception(f"JVM exploded at {SECRET_PATH}")

    monkeypatch.setattr(main, "check_text", boom)
    response = main.grammar_check(main.GrammarRequest(text="teh cat"))
    body = json.loads(response.body.decode())

    assert response.status_code == 503
    assert body["error"] == "grammar_engine_unavailable"
    assert body["detail"] == "grammar_engine_unavailable"
    assert SECRET_PATH not in json.dumps(body)


def test_model_delete_does_not_echo_oserror_text():
    with patch("main.delete_model", side_effect=OSError(f"locked {SECRET_PATH}")):
        response = _auth_client().post("/model/delete", json={"model_key": "2b"})

    body = response.json()
    assert response.status_code == 500
    assert body["error"] == "model_delete_failed"
    assert SECRET_PATH not in json.dumps(body)


def test_model_download_does_not_echo_runtime_error_text():
    with patch(
        "main.download_model",
        side_effect=RuntimeError(f"disk full at {SECRET_PATH}"),
    ):
        response = _auth_client().post("/model/download", json={"model_key": "2b"})

    body = response.json()
    assert response.status_code == 500
    assert body["error"] == "model_download_failed"
    assert SECRET_PATH not in json.dumps(body)


def test_transform_does_not_echo_inference_error_text():
    class BoomBackend:
        name = "bundled"

        def complete(self, *_args, **_kwargs):
            raise InferenceUnavailable(f"missing weights at {SECRET_PATH}")

    with patch("main.get_backend", return_value=BoomBackend()):
        response = _auth_client().post(
            "/transform",
            json={"prompt": "Rewrite.", "text": "Hello."},
        )

    body = response.json()
    assert response.status_code == 503
    assert body["error"] == "inference_unavailable"
    assert SECRET_PATH not in json.dumps(body)
