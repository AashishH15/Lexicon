"""Authentication tests for local loopback API.

These tests verify bearer token generation, validation, and endpoint security.
"""

import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import auth  # noqa: E402
from main import app  # noqa: E402


def test_generate_token_format():
    """The generated token must be a 64-character hexadecimal string."""
    token = auth.generate_token()
    assert isinstance(token, str)
    assert len(token) == 64
    int(token, 16)


def test_validate_token_constant_time():
    """Validation must succeed for matching tokens and fail otherwise."""
    token = auth.generate_token()
    assert auth.validate_token(token, token) is True
    assert auth.validate_token("wrong-token", token) is False
    assert auth.validate_token(None, token) is False
    assert auth.validate_token("", token) is False


def test_auth_token_file_lifecycle(tmp_path):
    """The daemon writes the token file on start and deletes it on exit."""
    token_file = tmp_path / "auth_token"
    token = auth.generate_token()

    with patch.object(auth, "get_auth_token_path", return_value=token_file):
        auth.save_auth_token_file(token)
        assert token_file.is_file()
        assert token_file.read_text(encoding="utf-8").strip() == token

        auth.cleanup_auth_token_file()
        assert not token_file.exists()


def test_protected_endpoint_rejects_missing_token():
    """Protected endpoints must reject requests without a bearer token."""
    client = TestClient(app)
    response = client.post("/grammar/check", json={"text": "Hello"})
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"


def test_protected_endpoint_rejects_invalid_token():
    """Protected endpoints must reject requests with an incorrect token."""
    client = TestClient(app)
    response = client.post(
        "/grammar/check",
        headers={"Authorization": "Bearer invalid-token"},
        json={"text": "Hello"},
    )
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"


def test_public_probes_allow_unauthenticated_requests():
    """Public health probes must stay accessible without authentication."""
    client = TestClient(app)
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json() == {"status": "ok"}

    ping_resp = client.get("/extension/ping")
    assert ping_resp.status_code == 200
    assert ping_resp.json() == {"ok": True, "app": "lexicon"}


def test_handshake_rejects_disallowed_origin():
    """Handshake must return 403 for untrusted web origins."""
    client = TestClient(app)
    response = client.post(
        "/auth/handshake",
        headers={"Origin": "https://malicious-website.com"},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"


def test_handshake_accepts_pinned_chrome_extension():
    """Handshake must return the active session token for pinned Chrome origins."""
    client = TestClient(app)
    origin = "chrome-extension://egcfmlgpcidpanppnampkkdknogccpjg"
    response = client.post("/auth/handshake", headers={"Origin": origin})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert isinstance(data["token"], str)
    assert len(data["token"]) == 64


def test_handshake_accepts_valid_firefox_extension():
    """Handshake must accept valid moz-extension UUID origins."""
    client = TestClient(app)
    origin = "moz-extension://9a08d798-af1b-4572-95ab-9d6866517ade"
    response = client.post("/auth/handshake", headers={"Origin": origin})
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert isinstance(data["token"], str)


def test_authenticated_request_succeeds_with_handshake_token():
    """Requests with a token from the handshake must succeed."""
    client = TestClient(app)
    origin = "chrome-extension://egcfmlgpcidpanppnampkkdknogccpjg"
    handshake = client.post("/auth/handshake", headers={"Origin": origin})
    token = handshake.json()["token"]

    response = client.get(
        "/dictionary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
