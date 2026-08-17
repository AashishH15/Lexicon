"""Tests for Lexicon's LanguageTool HTTP client and process lifecycle."""

import json
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

import pytest
import requests

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import languagetool  # noqa: E402


class FakeProcess:
    def __init__(self):
        self.running = True
        self.terminated = False
        self.killed = False
        self.pid = None

    def poll(self):
        return None if self.running else 1

    def terminate(self):
        self.running = False
        self.terminated = True

    def kill(self):
        self.running = False
        self.killed = True

    def wait(self, timeout=None):
        del timeout
        self.running = False
        return 0


@pytest.fixture(autouse=True)
def reset_languagetool_state(monkeypatch):
    languagetool.close_tool()
    monkeypatch.setattr(languagetool, "CHECK_URL", None)
    monkeypatch.setattr(languagetool, "_server_process", None)
    monkeypatch.setattr(languagetool, "_server_url", None)
    monkeypatch.setattr(languagetool, "_warm", False)
    yield
    languagetool.close_tool()


@pytest.fixture
def fake_language_tool_server():
    requests_seen = []

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_GET(self):
            if self.path != "/v2/languages":
                self.send_response(404)
                self.end_headers()
                return
            body = json.dumps([{"name": "English", "code": "en-US"}]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0"))
            payload = self.rfile.read(length)
            values = parse_qs(payload.decode("utf-8"), keep_blank_values=True)
            requests_seen.append(values)
            body = json.dumps(
                {
                    "matches": [
                        {
                            "offset": 0,
                            "length": 3,
                            "message": "Test match",
                            "replacements": [{"value": "The"}],
                            "rule": {"id": "TEST_RULE", "description": "Test"},
                        }
                    ]
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests_seen
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_http_client_posts_form_data_and_normalizes_response(
    monkeypatch, fake_language_tool_server
):
    base_url, requests_seen = fake_language_tool_server
    monkeypatch.setattr(languagetool, "CHECK_URL", f"{base_url}/v2/check")

    matches = languagetool.check_text("The + emoji 😀", "en-US")

    assert matches[0] == {
        "offset": 0,
        "length": 3,
        "message": "Test match",
        "replacements": ["The"],
        "rule": {"id": "TEST_RULE", "description": "Test"},
    }
    assert requests_seen[0]["text"] == ["The + emoji 😀"]
    assert requests_seen[0]["language"] == ["en-US"]


def test_http_client_supports_server_url_with_v2_suffix(
    monkeypatch, fake_language_tool_server
):
    base_url, requests_seen = fake_language_tool_server
    monkeypatch.setattr(languagetool, "CHECK_URL", f"{base_url}/v2/check")

    assert languagetool._post_check(f"{base_url}/v2/check", "text", "en-GB")
    assert requests_seen[0]["language"] == ["en-GB"]


def test_http_client_handles_concurrent_requests(monkeypatch, fake_language_tool_server):
    base_url, requests_seen = fake_language_tool_server
    monkeypatch.setattr(languagetool, "CHECK_URL", f"{base_url}/v2/check")

    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(
            executor.map(
                lambda index: languagetool.check_text(f"Text {index}", "en-US"),
                range(24),
            )
        )

    assert len(results) == 24
    assert len(requests_seen) == 24


def test_http_client_handles_empty_and_large_text(
    monkeypatch, fake_language_tool_server
):
    base_url, requests_seen = fake_language_tool_server
    monkeypatch.setattr(languagetool, "CHECK_URL", f"{base_url}/v2/check")
    texts = ["", "x" * 100_000]

    for text in texts:
        languagetool._post_check(languagetool.CHECK_URL, text, "en-US")

    assert [request["text"][0] for request in requests_seen] == texts


def test_http_error_is_propagated(monkeypatch):
    class ErrorResponse:
        def raise_for_status(self):
            raise requests.HTTPError("LanguageTool unavailable")

    monkeypatch.setattr(languagetool.requests, "post", lambda *_args, **_kwargs: ErrorResponse())

    with pytest.raises(requests.HTTPError, match="unavailable"):
        languagetool._post_check("http://127.0.0.1:1/v2/check", "text", "en-US")


def test_http_timeout_is_propagated(monkeypatch):
    def timeout(*_args, **_kwargs):
        raise requests.Timeout("LanguageTool timed out")

    monkeypatch.setattr(languagetool.requests, "post", timeout)

    with pytest.raises(requests.Timeout, match="timed out"):
        languagetool._post_check("http://127.0.0.1:1/v2/check", "text", "en-US")


def test_readiness_probe_waits_for_http_server(fake_language_tool_server):
    base_url, _requests_seen = fake_language_tool_server

    languagetool._wait_for_server(FakeProcess(), base_url)


@pytest.mark.parametrize(
    "result",
    [
        None,
        [],
        {"matches": "invalid"},
        {"matches": [None]},
        {"matches": [{"rule": "invalid"}]},
    ],
)
def test_normalize_rejects_malformed_responses(result):
    with pytest.raises(RuntimeError):
        languagetool._normalize(result)


def test_normalize_preserves_unicode_offsets():
    result = {
        "matches": [
            {
                "offset": 7,
                "length": 3,
                "message": "Use a different word",
                "replacements": [],
                "rule": {"id": "RULE", "description": "Description"},
            }
        ]
    }

    assert languagetool._normalize(result)[0]["offset"] == 7
    assert languagetool._normalize(result)[0]["length"] == 3


def test_ignore_dictionary_handles_utf16_server_offsets():
    text = "😀 bad"
    match = {
        "offset": 3,
        "length": 3,
        "message": "Ignored",
        "replacements": [],
        "rule": {"id": "RULE", "description": ""},
    }

    assert languagetool._filter_ignored([match], text, ["bad"]) == []


def test_concurrent_first_checks_start_one_server(monkeypatch, tmp_path):
    engine_dir = tmp_path / "LanguageTool-6.8"
    engine_dir.mkdir()
    (engine_dir / "languagetool-server.jar").write_bytes(b"jar")
    processes = []

    def fake_popen(*_args, **_kwargs):
        process = FakeProcess()
        processes.append(process)
        return process

    monkeypatch.setenv("LEXICON_LT_DIR", str(engine_dir))
    monkeypatch.setattr(languagetool, "_resolve_java", lambda: "java")
    monkeypatch.setattr(languagetool, "_server_port", lambda: 18001)
    monkeypatch.setattr(languagetool, "_popen_kwargs", lambda _engine: {})
    monkeypatch.setattr(languagetool, "_wait_for_server", lambda *_args: None)
    monkeypatch.setattr(languagetool.subprocess, "Popen", fake_popen)

    with ThreadPoolExecutor(max_workers=8) as executor:
        urls = list(executor.map(lambda _index: languagetool._ensure_local_server(), range(8)))

    assert len(processes) == 1
    assert urls == ["http://127.0.0.1:18001"] * 8
    languagetool.close_tool()
    assert processes[0].terminated


def test_unload_allows_a_clean_restart(monkeypatch, tmp_path):
    engine_dir = tmp_path / "LanguageTool-6.8"
    engine_dir.mkdir()
    (engine_dir / "languagetool-server.jar").write_bytes(b"jar")
    processes = []

    monkeypatch.setenv("LEXICON_LT_DIR", str(engine_dir))
    monkeypatch.setattr(languagetool, "_resolve_java", lambda: "java")
    monkeypatch.setattr(languagetool, "_server_port", lambda: 18002)
    monkeypatch.setattr(languagetool, "_popen_kwargs", lambda _engine: {})
    monkeypatch.setattr(languagetool, "_wait_for_server", lambda *_args: None)
    monkeypatch.setattr(
        languagetool.subprocess,
        "Popen",
        lambda *_args, **_kwargs: processes.append(FakeProcess()) or processes[-1],
    )

    languagetool._ensure_local_server()
    first = processes[0]
    languagetool.close_tool()
    languagetool._ensure_local_server()

    assert first.terminated
    assert len(processes) == 2


def test_readiness_failure_cleans_up_process(monkeypatch, tmp_path):
    engine_dir = tmp_path / "LanguageTool-6.8"
    engine_dir.mkdir()
    (engine_dir / "languagetool-server.jar").write_bytes(b"jar")
    process = FakeProcess()

    monkeypatch.setenv("LEXICON_LT_DIR", str(engine_dir))
    monkeypatch.setattr(languagetool, "_resolve_java", lambda: "java")
    monkeypatch.setattr(languagetool, "_server_port", lambda: 18005)
    monkeypatch.setattr(languagetool, "_popen_kwargs", lambda _engine: {})

    def fail_wait(*_args):
        raise RuntimeError("not ready")

    monkeypatch.setattr(languagetool, "_wait_for_server", fail_wait)
    monkeypatch.setattr(languagetool.subprocess, "Popen", lambda *_args, **_kwargs: process)

    with pytest.raises(RuntimeError, match="not ready"):
        languagetool._ensure_local_server()

    assert process.terminated
    assert languagetool._server_process is None
    assert languagetool._server_url is None


def test_dead_server_is_restarted_once(monkeypatch, tmp_path):
    engine_dir = tmp_path / "LanguageTool-6.8"
    engine_dir.mkdir()
    (engine_dir / "languagetool-server.jar").write_bytes(b"jar")
    processes = []
    calls = []

    monkeypatch.setenv("LEXICON_LT_DIR", str(engine_dir))
    monkeypatch.setattr(languagetool, "_resolve_java", lambda: "java")
    monkeypatch.setattr(languagetool, "_server_port", lambda: 18003)
    monkeypatch.setattr(languagetool, "_popen_kwargs", lambda _engine: {})
    monkeypatch.setattr(languagetool, "_wait_for_server", lambda *_args: None)

    def fake_popen(*_args, **_kwargs):
        process = FakeProcess()
        processes.append(process)
        return process

    def fake_post(*_args, **_kwargs):
        calls.append(True)
        if len(calls) == 1:
            processes[0].running = False
            raise requests.ConnectionError("server stopped")
        return []

    monkeypatch.setattr(languagetool.subprocess, "Popen", fake_popen)
    monkeypatch.setattr(languagetool, "_post_check", fake_post)

    assert languagetool._check_local("text", "en-US") == []
    assert len(processes) == 2
    assert len(calls) == 2


def test_close_does_not_manage_external_server(monkeypatch):
    monkeypatch.setattr(languagetool, "CHECK_URL", "http://127.0.0.1:8081/v2/check")
    monkeypatch.setattr(languagetool, "_server_process", None)
    terminated = []
    monkeypatch.setattr(
        languagetool,
        "_terminate_process",
        lambda process: terminated.append(process),
    )

    languagetool.close_tool()

    assert terminated == []


def test_java_command_uses_the_language_tool_http_server(tmp_path):
    command = languagetool._build_server_command(
        "java",
        tmp_path,
        18004,
    )

    assert command[:2] == ["java", "-Xms64M"]
    assert "org.languagetool.server.HTTPServer" in command
    assert command[-2:] == ["--port", "18004"]


def test_engine_directory_discovers_nested_language_tool_folder(
    monkeypatch, tmp_path
):
    engine_dir = tmp_path / "lt" / "LanguageTool-6.8"
    engine_dir.mkdir(parents=True)
    (engine_dir / "languagetool-server.jar").write_bytes(b"jar")
    monkeypatch.setenv("LEXICON_LT_DIR", str(engine_dir.parent))

    assert languagetool._language_tool_dir() == engine_dir


def test_missing_engine_error_includes_source_setup_command(monkeypatch, tmp_path):
    backend_dir = tmp_path / "backend"
    backend_dir.mkdir()
    monkeypatch.setattr(
        languagetool,
        "__file__",
        str(backend_dir / "languagetool.py"),
    )
    monkeypatch.setenv("LEXICON_LT_DIR", str(tmp_path / "missing"))

    with pytest.raises(RuntimeError, match="install_languagetool.py"):
        languagetool._language_tool_dir()
