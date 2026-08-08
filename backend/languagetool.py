import os

import requests

SERVER_URL = os.environ.get("LANGUAGETOOL_SERVER")
CHECK_URL = f"{SERVER_URL}/v2/check" if SERVER_URL else None
REQUEST_TIMEOUT = 30

_tool = None
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
    """Remove Windows ``\\\\?\\`` prefixes that crash OpenJDK/Temurin.

    Frozen/PyInstaller paths and ``GetFinalPathNameByHandle`` often yield
    ``\\\\?\\C:\\...``. Passing that as argv[0] makes ``java -version`` exit 1
    with ``guarantee(name != nullptr) failed: jimage file name is null``.
    """
    if not path:
        return path
    if path.startswith("\\\\?\\"):
        return path[4:]
    if path.startswith("//?/"):
        return path[4:]
    return path


def _should_inject_jvm_flags(cmd: list) -> bool:
    """Only tune heap flags for the LanguageTool HTTP server process.

    Injecting ``-Xmx…`` into ``java -version`` (used for compatibility checks)
    is unnecessary and has caused opaque failures when combined with bad paths.
    """
    return any(str(part) == "org.languagetool.server.HTTPServer" for part in cmd)


def _ensure_bundled_java_on_path() -> None:
    """Make the bundled JRE visible to language_tool_python.

    That package resolves Java with ``shutil.which("java")`` (PATH lookup).
    Setting JAVA_HOME alone is not enough on a machine with no system Java.
    """
    for key in ("LEXICON_JAVA_HOME", "JAVA_HOME"):
        home = _strip_extended_path(os.environ.get(key, "").strip())
        java_exe = _java_executable(home)
        if not java_exe:
            continue
        java_bin = os.path.dirname(java_exe)
        current = os.environ.get("PATH", "")
        parts = [_strip_extended_path(p) for p in current.split(os.pathsep) if p]
        if parts and os.path.normcase(parts[0]) == os.path.normcase(java_bin):
            os.environ["PATH"] = os.pathsep.join(parts)
            os.environ.setdefault("JAVA_HOME", home)
            os.environ.setdefault("LEXICON_JAVA_HOME", home)
            return
        parts = [p for p in parts if os.path.normcase(p) != os.path.normcase(java_bin)]
        os.environ["PATH"] = os.pathsep.join([java_bin, *parts])
        os.environ["JAVA_HOME"] = home
        os.environ["LEXICON_JAVA_HOME"] = home
        return


def _get_tool(language="en-US"):
    global _tool
    if _tool is None:
        import subprocess

        import language_tool_python
        import language_tool_python.server as language_tool_server

        _ensure_bundled_java_on_path()

        orig_popen = subprocess.Popen

        def _is_java_executable(cmd0):
            if not cmd0:
                return False
            name = os.path.basename(_strip_extended_path(str(cmd0))).lower()
            return name in ("java", "java.exe", "javaw", "javaw.exe")

        def tuned_popen(*args, **kwargs):
            cmd = list(args[0]) if args else kwargs.get("args", [])
            if cmd and isinstance(cmd, (list, tuple)) and len(cmd) > 0:
                cmd = list(cmd)
                cmd[0] = _strip_extended_path(str(cmd[0]))
                if _is_java_executable(cmd[0]) and _should_inject_jvm_flags(cmd):
                    if "-Xmx384M" not in cmd:
                        cmd = [cmd[0]] + JVM_MEMORY_FLAGS + list(cmd[1:])
                if args:
                    args = (cmd,) + args[1:]
                else:
                    kwargs["args"] = cmd

            if os.name == "nt":
                create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
                kwargs["creationflags"] = kwargs.get("creationflags", 0) | create_no_window
                startupinfo = kwargs.get("startupinfo") or subprocess.STARTUPINFO()
                startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
                startupinfo.wShowWindow = getattr(subprocess, "SW_HIDE", 0)
                kwargs["startupinfo"] = startupinfo

            return orig_popen(*args, **kwargs)

        tuned_popen.__class_getitem__ = classmethod(lambda cls, item: orig_popen)

        if hasattr(language_tool_server, "subprocess"):
            language_tool_server.subprocess.Popen = tuned_popen

        startupinfo_cls = getattr(subprocess, "STARTUPINFO", None)
        if startupinfo_cls is not None and os.name == "nt":
            startupinfo = startupinfo_cls()
            startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
            startupinfo.wShowWindow = getattr(subprocess, "SW_HIDE", 0)
            language_tool_server.startupinfo = startupinfo

        _tool = language_tool_python.LanguageTool(language)
    return _tool


def warm_up(language="en-US"):
    """Launch the LanguageTool JVM up front so the first check is fast.

    Safe to call repeatedly; only the first successful launch does work. A
    failure (missing JVM, etc.) is swallowed so it doesn't crash startup, and
    the next check will retry lazily.
    """
    global _warm
    if _warm:
        return
    try:
        _get_tool(language)
        _warm = True
    except Exception:
        _warm = False


def close_tool():
    """Stop the LanguageTool JVM owned by this backend process."""
    global _tool, _warm
    if _tool is not None:
        try:
            if hasattr(_tool, "_server") and _tool._server:
                server_proc = getattr(_tool._server, "_process", None)
                if server_proc and hasattr(server_proc, "pid") and os.name == "nt":
                    import subprocess

                    subprocess.run(
                        ["taskkill", "/PID", str(server_proc.pid), "/T", "/F"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
            _tool.close()
        except Exception:
            pass
    _tool = None
    _warm = False


def _filter_ignored(matches, text, ignore):
    """Drop matches whose flagged word is in the user's dictionary."""
    if not ignore:
        return matches
    ignored = {word.lower() for word in ignore}
    kept = []
    for match in matches:
        word = text[match["offset"] : match["offset"] + match["length"]].strip()
        if word.lower() not in ignored:
            kept.append(match)
    return kept


def check_text(text, language="en-US", ignore=None):
    ignore = ignore or []
    if CHECK_URL:
        matches = _check_remote(text, language)
    else:
        matches = _check_local(text, language)
    return _filter_ignored(matches, text, ignore)


def _check_remote(text, language):
    response = requests.post(
        CHECK_URL,
        data={"text": text, "language": language},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return _normalize(response.json())


def _check_local(text, language):
    tool = _get_tool(language)
    if language != tool.language:
        tool.language = language
    matches = tool.check(text)
    return [
        {
            "offset": m.offset,
            "length": m.error_length,
            "message": m.message,
            "replacements": list(m.replacements),
            "rule": {
                "id": m.rule_id,
                "description": m.category or "",
            },
        }
        for m in matches
    ]


def _normalize(result):
    matches = []
    for match in result.get("matches", []):
        matches.append(
            {
                "offset": match["offset"],
                "length": match["length"],
                "message": match["message"],
                "replacements": [r["value"] for r in match.get("replacements", [])],
                "rule": {
                    "id": match["rule"]["id"],
                    "description": match["rule"].get("description", ""),
                },
            }
        )
    return matches
