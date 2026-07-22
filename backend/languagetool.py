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


def _get_tool(language="en-US"):
    global _tool
    if _tool is None:
        import subprocess

        import language_tool_python
        import language_tool_python.server as language_tool_server

        orig_popen = subprocess.Popen

        def tuned_popen(*args, **kwargs):
            cmd = list(args[0]) if args else kwargs.get("args", [])
            if cmd and isinstance(cmd, (list, tuple)) and len(cmd) > 0:
                first_arg = str(cmd[0]).lower()
                if "java" in first_arg or first_arg.endswith(".exe"):
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
        if os.name == "nt":
            try:
                import subprocess

                subprocess.run(
                    ["taskkill", "/F", "/IM", "java.exe"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
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
