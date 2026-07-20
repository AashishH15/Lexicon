"""Sidecar entry point for the packaged Lexicon build (runs inside Tauri).

Tauri launches this frozen executable as a sidecar. It boots the FastAPI/
uvicorn server on localhost:8000, points LanguageTool at the bundled JRE via
LEXICON_JAVA_HOME, and keeps running until the Tauri app exits (which kills
the sidecar). Unlike the standalone desktop launcher, this does NOT open a
browser — the Tauri WebView is the UI and loads the built frontend directly.
"""

import os
import signal

HOST = os.environ.get("LEXICON_HOST", "127.0.0.1")
PORT = int(os.environ.get("LEXICON_PORT", "8000"))

if getattr(os.sys, "frozen", False):
    BASE_DIR = os.path.dirname(os.sys.executable)
    jre_dir = os.path.join(BASE_DIR, "jre")
    if os.path.isdir(jre_dir):
        os.environ.setdefault("LEXICON_JAVA_HOME", jre_dir)
        os.environ.setdefault("JAVA_HOME", jre_dir)


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
