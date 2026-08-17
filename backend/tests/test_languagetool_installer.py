"""Tests for the source-checkout LanguageTool installer."""

import hashlib
import io
import sys
import zipfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import install_languagetool  # noqa: E402


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def _language_tool_archive() -> bytes:
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr(
            "LanguageTool-6.8/languagetool-server.jar",
            b"official engine",
        )
        archive.writestr("LanguageTool-6.8/COPYING.txt", "LGPL")
    return stream.getvalue()


def test_install_downloads_verifies_and_extracts_engine(monkeypatch, tmp_path):
    archive = _language_tool_archive()
    checksum = hashlib.sha256(archive).hexdigest()
    seen = []

    def fake_urlopen(request, timeout):
        seen.append((request.full_url, timeout))
        return FakeResponse(archive)

    monkeypatch.setattr(install_languagetool.urllib.request, "urlopen", fake_urlopen)

    engine_dir = install_languagetool.install(
        tmp_path / "lt",
        url="https://example.test/languagetool.zip",
        expected_sha256=checksum,
    )

    assert engine_dir.name == "LanguageTool-6.8"
    assert (engine_dir / "languagetool-server.jar").read_bytes() == b"official engine"
    assert (engine_dir / "COPYING.txt").read_text(encoding="utf-8") == "LGPL"
    assert seen == [("https://example.test/languagetool.zip", 120)]


def test_install_skips_download_when_engine_is_ready(monkeypatch, tmp_path):
    destination = tmp_path / "lt"
    engine_dir = destination / "LanguageTool-6.8"
    engine_dir.mkdir(parents=True)
    (engine_dir / "languagetool-server.jar").write_bytes(b"existing")

    def unexpected_download(*_args, **_kwargs):
        raise AssertionError("a ready engine should not be downloaded again")

    monkeypatch.setattr(
        install_languagetool.urllib.request,
        "urlopen",
        unexpected_download,
    )

    assert install_languagetool.install(destination) == engine_dir


def test_install_rejects_bad_checksum_and_leaves_no_engine(monkeypatch, tmp_path):
    archive = _language_tool_archive()
    monkeypatch.setattr(
        install_languagetool.urllib.request,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse(archive),
    )

    with pytest.raises(RuntimeError, match="checksum did not match"):
        install_languagetool.install(
            tmp_path / "lt",
            expected_sha256="0" * 64,
        )

    assert not (tmp_path / "lt" / "LanguageTool-6.8").exists()


def test_install_rejects_unsafe_archive_member(monkeypatch, tmp_path):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        archive.writestr("../outside.txt", "unsafe")
    archive_bytes = stream.getvalue()
    checksum = hashlib.sha256(archive_bytes).hexdigest()
    monkeypatch.setattr(
        install_languagetool.urllib.request,
        "urlopen",
        lambda *_args, **_kwargs: FakeResponse(archive_bytes),
    )

    with pytest.raises(RuntimeError, match="unsafe path"):
        install_languagetool.install(
            tmp_path / "lt",
            expected_sha256=checksum,
        )
