import os
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

import requests

from grammar_enhancements import enhance_matches

REQUEST_TIMEOUT = 30
READINESS_TIMEOUT = 20
READINESS_POLL = 0.1
LANGUAGETOOL_SERVER_CLASS = "org.languagetool.server.HTTPServer"
LANGUAGETOOL_SERVER_JAR = "languagetool-server.jar"
LOCAL_SERVER_HOST = "127.0.0.1"

SERVER_URL = os.environ.get("LANGUAGETOOL_SERVER", "").strip().rstrip("/")
CHECK_URL = (
    SERVER_URL
    if SERVER_URL.endswith("/v2/check")
    else f"{SERVER_URL}/check"
    if SERVER_URL.endswith("/v2")
    else f"{SERVER_URL}/v2/check"
    if SERVER_URL
    else None
)

_server_lock = threading.RLock()
_server_process = None
_server_url = None
_warm = False


JVM_MEMORY_FLAGS = [
    "-Xms64M",
    "-Xmx384M",
    "-XX:+UseG1GC",
    "-XX:MinHeapFreeRatio=10",
    "-XX:MaxHeapFreeRatio=20",
    "-XX:+UseStringDeduplication",
]


def _java_executable(home: str) -> str | None:
    if not home:
        return None
    name = "java.exe" if os.name == "nt" else "java"
    candidate = os.path.join(_strip_extended_path(home), "bin", name)
    return candidate if os.path.isfile(candidate) else None


def _strip_extended_path(path: str) -> str:
    """Remove Windows extended-length path prefixes."""
    if not path:
        return path
    if path.startswith("\\\\?\\"):
        return path[4:]
    if path.startswith("//?/"):
        return path[4:]
    return path


def _should_inject_jvm_flags(cmd: list) -> bool:
    """Return true when a command starts the LanguageTool HTTP server."""
    return any(str(part) == LANGUAGETOOL_SERVER_CLASS for part in cmd)


def _ensure_bundled_java_on_path() -> None:
    """Put the configured Java runtime at the front of PATH."""
    for key in ("LEXICON_JAVA_HOME", "JAVA_HOME"):
        home = _strip_extended_path(os.environ.get(key, "").strip())
        java_exe = _java_executable(home)
        if not java_exe:
            continue
        java_bin = os.path.dirname(java_exe)
        current = os.environ.get("PATH", "")
        parts = [_strip_extended_path(p) for p in current.split(os.pathsep) if p]
        parts = [p for p in parts if os.path.normcase(p) != os.path.normcase(java_bin)]
        os.environ["PATH"] = os.pathsep.join([java_bin, *parts])
        os.environ["JAVA_HOME"] = home
        os.environ["LEXICON_JAVA_HOME"] = home
        return


def _resolve_java() -> str:
    _ensure_bundled_java_on_path()
    for key in ("LEXICON_JAVA_HOME", "JAVA_HOME"):
        java_exe = _java_executable(os.environ.get(key, "").strip())
        if java_exe:
            return java_exe
    java_exe = shutil.which("java")
    if java_exe:
        return java_exe
    raise RuntimeError(
        "LanguageTool requires Java 17 or later. "
        "Install Java or configure LEXICON_JAVA_HOME."
    )


def _engine_dir_from(root: Path) -> Path | None:
    if (root / LANGUAGETOOL_SERVER_JAR).is_file():
        return root
    if not root.is_dir():
        return None
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / LANGUAGETOOL_SERVER_JAR).is_file():
            return child
    return None


def _language_tool_dir() -> Path:
    configured = os.environ.get("LEXICON_LT_DIR", "").strip()
    candidates = []
    if configured:
        candidates.append(Path(_strip_extended_path(configured)))

    backend_dir = Path(__file__).resolve().parent
    candidates.extend(
        [
            backend_dir / "lt" / "LanguageTool-6.8",
            backend_dir / "lt",
        ]
    )
    for candidate in candidates:
        engine_dir = _engine_dir_from(candidate)
        if engine_dir is not None:
            return engine_dir
    raise RuntimeError(
        "LanguageTool engine not found. From a source checkout, run "
        "`python backend/install_languagetool.py`, or set LEXICON_LT_DIR to "
        "the directory that contains languagetool-server.jar."
    )


def _configured_server_port() -> int:
    value = os.environ.get("LEXICON_LT_PORT", "").strip()
    if not value:
        return 0
    try:
        port = int(value)
    except ValueError as exc:
        raise RuntimeError("LEXICON_LT_PORT must be a valid TCP port.") from exc
    if not 0 <= port <= 65535:
        raise RuntimeError("LEXICON_LT_PORT must be between 0 and 65535.")
    return port


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind((LOCAL_SERVER_HOST, 0))
        return int(probe.getsockname()[1])


def _server_port() -> int:
    return _configured_server_port() or _find_free_port()


def _build_server_command(java_executable: str, engine_dir: Path, port: int) -> list[str]:
    return [
        java_executable,
        *JVM_MEMORY_FLAGS,
        "-cp",
        str(engine_dir / LANGUAGETOOL_SERVER_JAR),
        LANGUAGETOOL_SERVER_CLASS,
        "--port",
        str(port),
    ]


def _popen_kwargs(engine_dir: Path) -> dict:
    options = {
        "cwd": str(engine_dir),
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if os.name == "nt":
        options["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
        startupinfo.wShowWindow = getattr(subprocess, "SW_HIDE", 0)
        options["startupinfo"] = startupinfo
    return options


def _process_running(process) -> bool:
    try:
        return process is not None and process.poll() is None
    except Exception:
        return False


def _wait_for_server(process, base_url: str) -> None:
    deadline = time.monotonic() + READINESS_TIMEOUT
    probe_url = f"{base_url}/v2/languages"
    while time.monotonic() < deadline:
        if not _process_running(process):
            raise RuntimeError("LanguageTool server exited before becoming ready.")
        try:
            response = requests.get(probe_url, timeout=1)
            if response.status_code == 200:
                return
        except requests.RequestException:
            pass
        time.sleep(READINESS_POLL)
    raise RuntimeError("LanguageTool server did not become ready in time.")


def _terminate_process(process) -> None:
    if not _process_running(process):
        return
    try:
        process.terminate()
    except (OSError, AttributeError):
        pass
    try:
        process.wait(timeout=3)
    except (subprocess.TimeoutExpired, AttributeError):
        try:
            process.kill()
            process.wait(timeout=3)
        except (subprocess.TimeoutExpired, AttributeError):
            pass


def _start_local_server() -> str:
    global _server_process, _server_url, _warm
    engine_dir = _language_tool_dir()
    java_executable = _resolve_java()
    port = _server_port()
    base_url = f"http://{LOCAL_SERVER_HOST}:{port}"
    command = _build_server_command(java_executable, engine_dir, port)
    process = subprocess.Popen(command, **_popen_kwargs(engine_dir))
    _server_process = process
    _server_url = base_url
    try:
        _wait_for_server(process, base_url)
    except Exception:
        _server_process = None
        _server_url = None
        _terminate_process(process)
        raise
    _warm = True
    return base_url


def _ensure_local_server() -> str:
    global _server_process, _server_url, _warm
    with _server_lock:
        if _process_running(_server_process):
            return _server_url
        if _server_process is not None:
            _terminate_process(_server_process)
            _server_process = None
            _server_url = None
            _warm = False
        return _start_local_server()


def _local_server_failed() -> bool:
    with _server_lock:
        return _server_process is not None and not _process_running(_server_process)


def _reset_failed_server() -> None:
    global _server_process, _server_url, _warm
    with _server_lock:
        if _server_process is not None and not _process_running(_server_process):
            _server_process = None
            _server_url = None
            _warm = False


def warm_up(language="en-US"):
    """Start the local LanguageTool server without checking text."""
    del language
    global _warm
    if _warm and _process_running(_server_process):
        return
    try:
        if CHECK_URL is None:
            _ensure_local_server()
        _warm = True
    except Exception:
        _warm = False


def close_tool():
    """Stop the local LanguageTool server owned by this backend."""
    global _server_process, _server_url, _warm
    with _server_lock:
        process = _server_process
        _server_process = None
        _server_url = None
        _warm = False
        if process is not None:
            _terminate_process(process)


def _filter_ignored(matches, text, ignore):
    """Drop matches whose flagged word is in the user's dictionary."""
    if not ignore:
        return matches
    ignored = {word.lower() for word in ignore}
    kept = []
    for match in matches:
        words = _match_text_variants(text, match["offset"], match["length"])
        if not any(word.strip().lower() in ignored for word in words):
            kept.append(match)
    return kept


def _match_text_variants(text, offset, length):
    """Return Python and UTF-16 slices for a match."""
    words = [text[offset : offset + length]]
    encoded = text.encode("utf-16-le")
    start = offset * 2
    end = (offset + length) * 2
    try:
        utf16_word = encoded[start:end].decode("utf-16-le")
    except UnicodeDecodeError:
        utf16_word = ""
    if utf16_word not in words:
        words.append(utf16_word)
    return words


def check_text(text, language="en-US", ignore=None):
    ignore = ignore or []
    if CHECK_URL:
        matches = _check_remote(text, language)
    else:
        matches = _check_local(text, language)
    matches = enhance_matches(text, matches, language)
    return _filter_ignored(matches, text, ignore)


def _check_remote(text, language):
    return _post_check(CHECK_URL, text, language)


def _check_local(text, language):
    base_url = _ensure_local_server()
    try:
        return _post_check(f"{base_url}/v2/check", text, language)
    except requests.RequestException:
        if not _local_server_failed():
            raise
        _reset_failed_server()
        base_url = _ensure_local_server()
        return _post_check(f"{base_url}/v2/check", text, language)


def _post_check(url, text, language):
    if not url:
        raise RuntimeError("LanguageTool check URL is not configured.")
    response = requests.post(
        url,
        data={"text": text, "language": language, "level": "picky"},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError("LanguageTool returned invalid JSON.") from exc
    return _normalize(result)


def _normalize(result):
    if not isinstance(result, dict):
        raise RuntimeError("LanguageTool returned an invalid response.")
    matches = []
    raw_matches = result.get("matches", [])
    if not isinstance(raw_matches, list):
        raise RuntimeError("LanguageTool returned invalid matches.")
    for match in raw_matches:
        if not isinstance(match, dict):
            raise RuntimeError("LanguageTool returned an invalid match.")
        rule = match.get("rule") or {}
        if not isinstance(rule, dict):
            raise RuntimeError("LanguageTool returned an invalid rule.")
        replacements = match.get("replacements") or []
        if not isinstance(replacements, list):
            raise RuntimeError("LanguageTool returned invalid replacements.")
        try:
            offset = int(match["offset"])
            length = int(match["length"])
            message = str(match["message"])
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError("LanguageTool returned an invalid match.") from exc
        if offset < 0 or length < 0:
            raise RuntimeError("LanguageTool returned invalid match offsets.")
        matches.append(
            {
                "offset": offset,
                "length": length,
                "message": message,
                "replacements": [
                    replacement["value"]
                    for replacement in replacements
                    if isinstance(replacement, dict) and "value" in replacement
                ],
                "rule": {
                    "id": rule.get("id", ""),
                    "description": rule.get("description", ""),
                },
            }
        )
    return matches
