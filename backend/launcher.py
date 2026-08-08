"""Sidecar entry point for the packaged Lexicon build (runs inside Tauri).

Tauri launches this frozen executable as a sidecar. It boots the FastAPI/
uvicorn server on localhost:8000, points LanguageTool at the bundled JRE via
LEXICON_JAVA_HOME / PATH, and keeps running until the Tauri app exits (which
kills the sidecar). Unlike the standalone desktop launcher, this does NOT open a
browser — the Tauri WebView is the UI and loads the built frontend directly.
"""

import os
import signal

HOST = os.environ.get("LEXICON_HOST", "127.0.0.1")
PORT = int(os.environ.get("LEXICON_PORT", "8000"))


def _prepend_path(entry: str) -> None:
    """Put ``entry`` at the front of PATH if it exists and is not already first."""
    if not entry or not os.path.isdir(entry):
        return
    current = os.environ.get("PATH", "")
    parts = [p for p in current.split(os.pathsep) if p]
    if parts and os.path.normcase(parts[0]) == os.path.normcase(entry):
        return
    parts = [p for p in parts if os.path.normcase(p) != os.path.normcase(entry)]
    os.environ["PATH"] = os.pathsep.join([entry, *parts])


def _resolve_jre_dir(base_dir: str) -> str | None:
    """Locate the bundled JRE relative to the frozen sidecar.

    tauri.conf.json ships ``jre`` and ``lexicon-backend`` as sibling resources,
    so the JRE normally sits one level *above* this executable, not beside it.
    """
    java_name = "java.exe" if os.name == "nt" else "java"
    candidates = (
        os.path.join(base_dir, "jre"),
        os.path.join(os.path.dirname(base_dir), "jre"),
    )
    for candidate in candidates:
        if os.path.isfile(os.path.join(candidate, "bin", java_name)):
            return candidate
    return None


if getattr(os.sys, "frozen", False):
    BASE_DIR = os.path.dirname(os.sys.executable)
    jre_dir = _resolve_jre_dir(BASE_DIR)
    if jre_dir:
        os.environ.setdefault("LEXICON_JAVA_HOME", jre_dir)
        os.environ.setdefault("JAVA_HOME", jre_dir)
        # language_tool_python resolves Java via shutil.which("java") — PATH,
        # not JAVA_HOME. Without jre/bin on PATH, clean Windows installs never
        # spawn a JVM even though the bundled JRE is present.
        _prepend_path(os.path.join(jre_dir, "bin"))
    lt_dir = os.path.join(BASE_DIR, "lt")
    if os.path.isdir(lt_dir) and any(
        name.startswith("LanguageTool-") for name in os.listdir(lt_dir)
    ):
        os.environ.setdefault("LTP_PATH", lt_dir)


def main():
    import uvicorn

    from main import app

    config = uvicorn.Config(
        app,
        host=HOST,
        port=PORT,
        log_level="info",
        log_config=None,
    )
    server = uvicorn.Server(config)
    app.state.server = server

    # Exit cleanly on SIGTERM (Tauri sends this when the window closes).
    def _handle_term(*_):
        server.should_exit = True

    signal.signal(signal.SIGTERM, _handle_term)

    try:
        server.run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
