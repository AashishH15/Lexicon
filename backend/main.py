import os
import subprocess

if os.name == "nt":
    _CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    _OrigPopen = subprocess.Popen

    class _NoWindowPopen(_OrigPopen):
        def __init__(self, *args, **kwargs):
            kwargs["creationflags"] = kwargs.get("creationflags", 0) | _CREATE_NO_WINDOW
            startupinfo = kwargs.get("startupinfo") or subprocess.STARTUPINFO()
            startupinfo.dwFlags |= getattr(subprocess, "STARTF_USESHOWWINDOW", 0)
            startupinfo.wShowWindow = getattr(subprocess, "SW_HIDE", 0)
            kwargs["startupinfo"] = startupinfo
            super().__init__(*args, **kwargs)

    subprocess.Popen = _NoWindowPopen

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai_prefs import load_prefs, save_prefs
from inference import (
    BundledBackend,
    InferenceUnavailable,
    OllamaBackend,
    get_backend,
    unload_active_backend,
)
from languagetool import check_text, close_tool
from model_manager import (
    cancel_download,
    delete_model,
    download_model,
    model_state,
    models_ready,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # LanguageTool starts lazily on the first proofreading request so the
    # desktop window does not remain blank while the JVM warms up.
    # Inference backends also resolve lazily. Do not probe Ollama here: a
    # stopped local server can take several seconds to time out, and Tauri
    # waits for this sidecar before showing the first window.
    try:
        yield
    finally:
        close_tool()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Tauri's bundled WebView origin, so the desktop app can call the
        # sidecar API on localhost without a CORS block.
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "http://localhost",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:18000",
        "http://127.0.0.1:18000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GrammarRequest(BaseModel):
    text: str
    language: str = "en-US"
    ignore: list[str] = []


class ModelDownloadRequest(BaseModel):
    model_key: str = "2b"


class TransformRequest(BaseModel):
    prompt: str
    text: str
    model_key: str | None = None
    backend: str | None = None  # "bundled" | "ollama" | None (auto)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/shutdown")
def shutdown():
    """Gracefully stop the sidecar and its LanguageTool JVM."""
    close_tool()
    server = getattr(app.state, "server", None)
    if server is not None:
        server.should_exit = True
    return {"shutting_down": server is not None}


@app.post("/ai/unload")
def ai_unload():
    """Tier 1 offload: free LLM model weights from RAM."""
    unload_active_backend()
    return {"unloaded": "llm"}


@app.post("/languagetool/unload")
def languagetool_unload():
    """Tier 2 offload: stop LanguageTool JVM."""
    close_tool()
    return {"unloaded": "languagetool"}


@app.post("/grammar/check")
def grammar_check(request: GrammarRequest):
    matches = check_text(request.text, request.language, request.ignore)
    return {"matches": matches}


@app.get("/model/status")
def model_status(key: str = "2b"):
    """Download/ready state for a specific model key (per-key, so switching
    models doesn't make the progress bar flicker between sizes)."""
    return model_state(key)


@app.get("/ai/status")
def ai_status():
    """Single probe the frontend calls on load: which backend is active, is
    Ollama reachable, which bundled models are ready, and the user's saved
    preference. Drives the first-run setup flow and the settings
    surface."""
    prefs = load_prefs()
    # Only probe Ollama when it could actually be the active backend. Probing
    # unconditionally forced a ~2.5s network timeout on every call even for
    # users who chose the bundled model (Ollama not running) — making the
    # frontend show "Checking AI status…" for seconds on every load.
    probe_ollama = prefs.get("backend") in ("ollama", "auto")
    ollama_available = OllamaBackend().available() if probe_ollama else False
    active = get_backend()
    return {
        "ollama_available": ollama_available,
        "models_ready": models_ready(),
        "model_key": prefs["model_key"],
        "preference": prefs,
        "active_backend": active.name,
    }


@app.get("/ai/preference")
def ai_preference_get():
    """Current persisted backend choice."""
    return load_prefs()


class AiPreferenceRequest(BaseModel):
    backend: str  # "auto" | "ollama" | "bundled"
    model_key: str = "2b"  # "2b" | "0.8b"


@app.post("/ai/preference")
def ai_preference_set(request: AiPreferenceRequest):
    """Persist the user's backend choice so it survives restarts and drives
    get_backend(). The editor's AI tools read this via get_backend()."""
    prefs = save_prefs(request.backend, request.model_key)
    # Force the cached backend to re-resolve against the new preference.
    get_backend(force_refresh=True)
    return prefs


@app.post("/model/cancel")
def model_cancel():
    """Signal an in-flight download to abort at the next chunk."""
    cancel_download()
    return {"cancelled": True}


@app.post("/model/delete")
def model_delete(request: ModelDownloadRequest):
    """Remove a downloaded GGUF (user switched models / freed space)."""
    try:
        delete_model(request.model_key)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    return {"deleted": request.model_key}


@app.post("/model/download")
def model_download(request: ModelDownloadRequest):
    """Download and activate the requested bundled model tier.

    The frontend labels this action "Download & enable", so persist the
    bundled preference only after the file is ready. This keeps onboarding and
    Settings consistent, including when the user chooses the Light tier.
    """
    try:
        status = download_model(request.model_key)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except RuntimeError as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    if status.get("state") == "ready":
        save_prefs("bundled", request.model_key)
        get_backend(force_refresh=True)
    return status


@app.post("/transform")
def transform(request: TransformRequest):
    """Generic transform endpoint: prompt in, text out, routed through
    whichever backend is active (Ollama preferred, else bundled). The request
    may force a backend or pick a bundled model size."""
    if request.backend == "bundled":
        backend = BundledBackend(model_key=request.model_key or "2b")
    elif request.backend == "ollama":
        backend = OllamaBackend()
    else:
        backend = get_backend()
    try:
        result = backend.complete(request.prompt, request.text)
    except InferenceUnavailable as exc:
        return JSONResponse(status_code=503, content={"error": str(exc)})
    return {"text": result}
