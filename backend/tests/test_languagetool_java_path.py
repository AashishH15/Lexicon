"""Regression tests for the bundled JRE wiring used by LanguageTool."""

import json
import os
import shutil
import sys
from pathlib import Path

import pytest

# Allow importing backend modules when tests run from repo root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import launcher  # noqa: E402
from languagetool import (  # noqa: E402
    _ensure_bundled_java_on_path,
    _java_executable,
    _should_inject_jvm_flags,
    _strip_extended_path,
)

JAVA_NAME = "java.exe" if os.name == "nt" else "java"


def _make_jre(root: Path) -> Path:
    bin_dir = root / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    java = bin_dir / JAVA_NAME
    java.write_text("", encoding="utf-8")
    if os.name != "nt":
        java.chmod(0o755)
    return java


@pytest.fixture
def fake_jre(tmp_path, monkeypatch):
    home = tmp_path / "jre"
    java = _make_jre(home)
    monkeypatch.setenv("LEXICON_JAVA_HOME", str(home))
    monkeypatch.delenv("JAVA_HOME", raising=False)
    # Simulate a machine with no system Java on PATH.
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    return home, home / "bin", java


def test_java_executable_resolves_bin(fake_jre):
    home, _bin_dir, java = fake_jre
    assert _java_executable(str(home)) == str(java)
    assert _java_executable(str(home / "missing")) is None
    assert _java_executable("") is None


def test_which_java_fails_before_fix(fake_jre):
    """The original bug: JAVA_HOME set, but nothing resolvable on PATH."""
    assert shutil.which("java") is None


def test_ensure_bundled_java_puts_jre_on_path(fake_jre):
    _home, bin_dir, java = fake_jre
    _ensure_bundled_java_on_path()

    parts = os.environ["PATH"].split(os.pathsep)
    assert os.path.normcase(parts[0]) == os.path.normcase(str(bin_dir))
    assert os.environ.get("JAVA_HOME")

    resolved = shutil.which("java")
    assert resolved is not None
    assert os.path.samefile(resolved, java)


def test_ensure_bundled_java_is_idempotent(fake_jre):
    _home, bin_dir, _java = fake_jre
    for _ in range(3):
        _ensure_bundled_java_on_path()

    duplicates = [
        p
        for p in os.environ["PATH"].split(os.pathsep)
        if os.path.normcase(p) == os.path.normcase(str(bin_dir))
    ]
    assert len(duplicates) == 1


def test_resolve_jre_dir_finds_sibling_resource(tmp_path):
    """tauri.conf.json ships `jre` beside `lexicon-backend`, not inside it."""
    resources = tmp_path / "resources"
    sidecar_dir = resources / "lexicon-backend"
    sidecar_dir.mkdir(parents=True)
    shipped_jre = resources / "jre"
    _make_jre(shipped_jre)

    assert not (sidecar_dir / "jre").is_dir()
    resolved = launcher._resolve_jre_dir(str(sidecar_dir))
    assert resolved is not None
    assert os.path.samefile(resolved, shipped_jre)


def test_resolve_jre_dir_prefers_child_when_present(tmp_path):
    sidecar_dir = tmp_path / "lexicon-backend"
    child_jre = sidecar_dir / "jre"
    _make_jre(child_jre)
    _make_jre(tmp_path / "jre")

    assert os.path.samefile(launcher._resolve_jre_dir(str(sidecar_dir)), child_jre)


def test_resolve_jre_dir_returns_none_without_java(tmp_path):
    sidecar_dir = tmp_path / "lexicon-backend"
    (sidecar_dir / "jre" / "bin").mkdir(parents=True)  # present but no java binary
    assert launcher._resolve_jre_dir(str(sidecar_dir)) is None


def test_grammar_check_reports_engine_failure_as_503(monkeypatch):
    """The user saw a bare HTTP 500; the endpoint must explain itself instead."""
    import main

    def boom(*_args, **_kwargs):
        raise Exception("can't find Java")

    monkeypatch.setattr(main, "check_text", boom)
    response = main.grammar_check(main.GrammarRequest(text="teh cat"))
    body = json.loads(response.body.decode())

    assert response.status_code == 503
    assert body["error"] == "grammar_engine_unavailable"
    assert "java" in body["detail"].lower()


def test_strip_extended_path_removes_win32_prefix():
    assert (
        _strip_extended_path(r"\\?\C:\Program Files\Lexicon\jre\bin\java.EXE")
        == r"C:\Program Files\Lexicon\jre\bin\java.EXE"
    )
    assert _strip_extended_path(r"C:\plain\java.exe") == r"C:\plain\java.exe"
    assert _strip_extended_path("") == ""


def test_jvm_flags_only_for_languagetool_server():
    assert _should_inject_jvm_flags(["java", "-version"]) is False
    assert (
        _should_inject_jvm_flags(
            ["java", "-cp", "languagetool.jar", "org.languagetool.server.HTTPServer"]
        )
        is True
    )


def test_java_executable_strips_extended_home(tmp_path):
    home = tmp_path / "jre"
    java = _make_jre(home)
    extended = "\\\\?\\" + str(home)
    assert _java_executable(extended) == str(java)
