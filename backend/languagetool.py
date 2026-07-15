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


def check_text(text, language="en-US"):
    if CHECK_URL:
        return _check_remote(text, language)
    return _check_local(text, language)


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
