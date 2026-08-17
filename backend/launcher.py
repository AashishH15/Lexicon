"""Sidecar entry point for the packaged Lexicon build (runs inside Tauri).

Tauri launches this frozen executable as a sidecar. It boots the FastAPI/
uvicorn server on localhost:8000, points LanguageTool at the bundled JRE via
LEXICON_JAVA_HOME, and keeps running until the Tauri app exits (which kills the
sidecar). Unlike the standalone desktop launcher, this does NOT open a browser
— the Tauri WebView is the UI and loads the built frontend directly.
"""

import os
import signal

HOST = os.environ.get("LEXICON_HOST", "127.0.0.1")
PORT = int(os.environ.get("LEXICON_PORT", "8000"))


def _resolve_jre_dir(base_dir: str) -> str | None:
    """Locate the bundled JRE relative to the frozen sidecar.

    tauri.conf.json ships ``jre`` and ``lexicon-backend`` as sibling resources,
    so the JRE normally sits one level *above* this executable, not beside it.
    """
    if base_dir.startswith("\\\\?\\"):
        base_dir = base_dir[4:]
    elif base_dir.startswith("//?/"):
        base_dir = base_dir[4:]
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
    lt_dir = os.path.join(BASE_DIR, "lt")
    engine_candidates = [lt_dir]
    if os.path.isdir(lt_dir):
        engine_candidates.extend(
            os.path.join(lt_dir, name)
            for name in sorted(os.listdir(lt_dir))
            if name.startswith("LanguageTool-")
        )
    for candidate in engine_candidates:
        if os.path.isfile(os.path.join(candidate, "languagetool-server.jar")):
            os.environ.setdefault("LEXICON_LT_DIR", candidate)
            break


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
