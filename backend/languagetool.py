import os
import re
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

import requests

from grammar_enhancements import _slice_utf16, enhance_matches

REQUEST_TIMEOUT = 30
READINESS_TIMEOUT = 20
READINESS_POLL = 0.1
LANGUAGETOOL_SERVER_CLASS = "org.languagetool.server.HTTPServer"
LANGUAGETOOL_SERVER_JAR = "languagetool-server.jar"
LOCAL_SERVER_HOST = "127.0.0.1"

# Blocked LanguageTool rule IDs. Empty until clean-set data needs a block.
# Add an ID only with a clean-set sentence that shows the false flag.
DISABLED_RULES: tuple[str, ...] = ()

# Compact high-frequency English list for TitleCase typo rescue (edit distance <= 1).
_COMMON_ENGLISH_WORDS = frozenset(
    """
    a about after again all also am an and another any are as at back be because
    been before being between both but by can come could day did do does down each
    even every first for from get go good great had has have he her here him his
    how i if in into is it its just know last life like little long look made make
    man many may me might more most much must my need new no not now of off old on
    once one only or other our out over own part people place put right said same
    see she should so some still such take than that the their them then there
    these they thing think this those three through time to too two under up us
    use very want was way we well were what when where which while who will with
    work would year you your receive received weird
    """.split()
)

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
    """Drop matches whose flagged word is in the user dictionary.

    All offsets use UTF-16 units. Convert only to read match text.
    """
    if not ignore:
        return matches
    ignored = {word.lower() for word in ignore}
    kept = []
    for match in matches:
        word = _match_text(text, match["offset"], match["length"])
        if word.strip().lower() not in ignored:
            kept.append(match)
    return kept


def _match_text(text, offset, length):
    """Return match text for UTF-16 offset and length."""
    return _slice_utf16(text, offset, length)


def _is_spelling_rule(rule_id: str) -> bool:
    rid = (rule_id or "").upper()
    return (
        "MORFOLOGIK" in rid
        or "HUNSPELL" in rid
        or "SPELLING" in rid
        or rid.startswith("SPELL")
    )


def _levenshtein(left: str, right: str) -> int:
    """Damerau-Levenshtein distance (substitutions, inserts, deletes, transpositions)."""
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)

    previous_previous = list(range(len(right) + 1))
    previous = [1] + [0] * len(right)
    for j, right_ch in enumerate(right, start=1):
        previous[j] = min(
            previous[j - 1] + 1,
            previous_previous[j] + 1,
            previous_previous[j - 1] + (left[0] != right_ch),
        )

    for i, left_ch in enumerate(left[1:], start=2):
        current = [i] + [0] * len(right)
        for j, right_ch in enumerate(right, start=1):
            cost = left_ch != right_ch
            current[j] = min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost,
            )
            if (
                j > 1
                and left_ch == right[j - 2]
                and left[i - 2] == right_ch
            ):
                current[j] = min(current[j], previous_previous[j - 2] + 1)
        previous_previous, previous = previous, current
    return previous[-1]


def _is_sentence_start_offset(text: str, char_offset: int) -> bool:
    if char_offset <= 0:
        return True
    before = text[:char_offset]
    stripped = before.rstrip()
    if not stripped:
        return True
    return stripped[-1] in ".?!"


def _utf16_to_py_index(text: str, utf16_offset: int) -> int:
    encoded = text.encode("utf-16-le")
    byte_offset = max(0, utf16_offset) * 2
    if byte_offset >= len(encoded):
        return len(text)
    return len(encoded[:byte_offset].decode("utf-16-le"))


def _is_title_case_token(token: str) -> bool:
    if not token or not token[0].isalpha():
        return False
    if token.isupper() and len(token) > 1:
        return False
    return token[0].isupper() and token[1:].islower()


def _near_common_word(token: str) -> bool:
    lowered = token.lower()
    if lowered in _COMMON_ENGLISH_WORDS:
        return True
    return any(
        _levenshtein(lowered, word) <= 1
        for word in _COMMON_ENGLISH_WORDS
        if abs(len(word) - len(lowered)) <= 1
    )


def _title_case_token_stats(text: str) -> tuple[dict[str, int], dict[str, int]]:
    """Return occurrence counts and first character offsets for TitleCase tokens."""
    counts: dict[str, int] = {}
    first_offsets: dict[str, int] = {}
    for found in re.finditer(r"\b[A-Z][a-z]+\b", text):
        token = found.group(0)
        counts[token] = counts.get(token, 0) + 1
        first_offsets.setdefault(token, found.start())
    return counts, first_offsets


def filter_proper_noun_spelling_matches(text: str, matches: list[dict]) -> list[dict]:
    """Suppress mid-sentence TitleCase spelling FPs while keeping real typos.

    - Suppress LanguageTool spelling suggestions on mid-sentence TitleCase tokens.
    - Keep sentence-initial flags.
    - Keep flags when the token is within edit distance 1 of a common word.
    - If a TitleCase token repeats in the document, suppress later spelling flags.
    """
    if not matches:
        return matches

    title_counts, first_offsets = _title_case_token_stats(text)
    kept: list[dict] = []
    for match in matches:
        rule_id = ((match.get("rule") or {}).get("id")) or ""
        if not _is_spelling_rule(rule_id):
            kept.append(match)
            continue

        token = _match_text(text, match["offset"], match["length"]).strip()
        if not _is_title_case_token(token):
            kept.append(match)
            continue

        char_offset = _utf16_to_py_index(text, match["offset"])
        if _is_sentence_start_offset(text, char_offset):
            kept.append(match)
            continue

        if _near_common_word(token):
            kept.append(match)
            continue

        # Subsequent occurrences of a repeated TitleCase entity → suppress.
        if title_counts.get(token, 0) >= 2 and char_offset > first_offsets.get(
            token, char_offset
        ):
            continue

        # Unique mid-sentence TitleCase spelling suggestion → suppress.
        if title_counts.get(token, 0) == 1:
            continue

        # First occurrence of a repeated entity that is mid-sentence: suppress
        # as a likely proper noun unless earlier guards already kept it.
        continue

    return kept


def check_text(text, language="en-US", ignore=None):
    ignore = ignore or []
    if CHECK_URL:
        matches = _check_remote(text, language)
    else:
        matches = _check_local(text, language)
    matches = enhance_matches(text, matches, language)
    matches = filter_proper_noun_spelling_matches(text, matches)
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
    data = {"text": text, "language": language, "level": "picky"}
    if DISABLED_RULES:
        data["disabledRules"] = ",".join(DISABLED_RULES)
    response = requests.post(
        url,
        data=data,
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
