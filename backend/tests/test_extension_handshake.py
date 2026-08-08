"""Extension CORS handshake and /extension/ping.

The extension uses the same FastAPI sidecar as the desktop app.
- Chrome: a pinned extension origin derived from the manifest `key`.
- Firefox: a strict regex for per-profile moz-extension UUID origins.
- The /extension/ping endpoint proves the caller is Lexicon.
"""

import re
import sys
from pathlib import Path

import pytest

# Allow importing backend modules when tests run from repo root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# extension_id.py must not live in extension/chrome/: Chrome refuses to
# load unpacked extensions from folders with _-prefixed entries.
EXTENSION_TOOLS_DIR = BACKEND_DIR.parent / "extension" / "tools"
if str(EXTENSION_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(EXTENSION_TOOLS_DIR))

from extension_id import extension_id_from_key, manifest_key  # noqa: E402

import main  # noqa: E402

CHROME_MANIFEST = EXTENSION_TOOLS_DIR.parent / "chrome" / "manifest.json"
CHROME_ORIGIN_PREFIX = "chrome-extension://"


def test_cors_origins_pin_chrome_id_derived_from_manifest_key():
    """The pinned origin must be exactly the ID the manifest's key produces —
    if one changes without the other, the dev-loaded build stops working."""
    expected = f"{CHROME_ORIGIN_PREFIX}{extension_id_from_key(manifest_key(CHROME_MANIFEST))}"
    pinned = [o for o in main._cors_origins() if o.startswith(CHROME_ORIGIN_PREFIX)]
    assert pinned == [expected]


def test_cors_origins_keep_desktop_and_dev_origins():
    origins = set(main._cors_origins())
    assert "tauri://localhost" in origins
    assert "http://localhost:5173" in origins
    assert "http://127.0.0.1:18000" in origins


def test_cors_origins_have_no_wildcards():
    for origin in main._cors_origins():
        assert "*" not in origin


def test_cors_origins_env_override_appends_and_dedupes(monkeypatch):
    monkeypatch.setenv(
        "LEXICON_EXTENSION_ORIGINS",
        "chrome-extension://aaaa, moz-extension://bbbb ,chrome-extension://aaaa",
    )
    origins = main._cors_origins()
    assert origins[-2:] == ["chrome-extension://aaaa", "moz-extension://bbbb"]
    assert len(origins) == len(set(origins))


def test_cors_origins_ignore_blank_env_override(monkeypatch):
    baseline = main._cors_origins()
    monkeypatch.setenv("LEXICON_EXTENSION_ORIGINS", " ,  ")
    assert main._cors_origins() == baseline


def test_extension_origin_regex_matches_firefox_uuid_only():
    uuid = "9a08d798-af1b-4572-95ab-9d6866517ade"
    assert re.fullmatch(main.EXTENSION_ORIGIN_REGEX, f"moz-extension://{uuid}")

    # Not a UUID shape, not hex, and not a Chrome origin.
    assert re.fullmatch(main.EXTENSION_ORIGIN_REGEX, "moz-extension://" + "0" * 36) is None
    assert (
        re.fullmatch(
            main.EXTENSION_ORIGIN_REGEX,
            "moz-extension://zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
        )
        is None
    )
    assert re.fullmatch(main.EXTENSION_ORIGIN_REGEX, "chrome-extension://anything") is None


def test_extension_ping_reports_lexicon():
    assert main.extension_ping() == {"ok": True, "app": "lexicon"}


def test_extension_id_shape_and_stability():
    """The manifest key must keep producing the same well-formed 32-char ID."""
    first = extension_id_from_key(manifest_key(CHROME_MANIFEST))
    second = extension_id_from_key(manifest_key(CHROME_MANIFEST))
    assert first == second
    assert len(first) == 32
    assert set(first) <= set("abcdefghijklmnop")


def test_extension_id_rejects_garbage_keys():
    with pytest.raises(ValueError):
        extension_id_from_key("not base64!!!")
    with pytest.raises(ValueError):
        extension_id_from_key("")
