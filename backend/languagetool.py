import os

import requests

SERVER_URL = os.environ.get("LANGUAGETOOL_SERVER")
CHECK_URL = f"{SERVER_URL}/v2/check" if SERVER_URL else None
REQUEST_TIMEOUT = 30

_tool = None
_warm = False


def _get_tool():
    global _tool
    if _tool is None:
        import language_tool_python

        if os.name == "nt":
            # language_tool_python already redirects the JVM's output, but
            # explicitly request a hidden Windows window as well. Without
            # SW_HIDE, java.exe can briefly flash a console during startup.
            import subprocess

            import language_tool_python.server as language_tool_server

            startupinfo_cls = getattr(subprocess, "STARTUPINFO", None)
            if startupinfo_cls is not None:
                startupinfo = startupinfo_cls()
                startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
                startupinfo.wShowWindow = getattr(subprocess, "SW_HIDE", 0)
                language_tool_server.startupinfo = startupinfo

        _tool = language_tool_python.LanguageTool("en-US")
    return _tool


def warm_up():
    """Launch the LanguageTool JVM up front so the first check is fast.

    Safe to call repeatedly; only the first successful launch does work. A
    failure (missing JVM, etc.) is swallowed so it doesn't crash startup, and
    the next check will retry lazily.
    """
    global _warm
    if _warm:
        return
    try:
        _get_tool()
        _warm = True
    except Exception:
        _warm = False


def close_tool():
    """Stop the LanguageTool JVM owned by this backend process."""
    global _tool, _warm
    if _tool is not None:
        try:
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
    tool = _get_tool()
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
