from contextlib import asynccontextmanager

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fastapi.responses import JSONResponse

from inference import get_backend, InferenceUnavailable, BundledBackend, OllamaBackend
from languagetool import check_text, warm_up
from model_manager import (
    download_model,
    model_state,
    model_path,
    models_ready,
    cancel_download,
    delete_model,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-launch the LanguageTool JVM on boot so the first user request
    # doesn't pay the multi-second cold-start cost. A failure here (e.g. the
    # JVM isn't installed) shouldn't crash the server; the first real request
    # will attempt to warm up again.
    warm_up()
    # Probe for a local inference backend: prefer a detected Ollama
    # server, else fall back to the bundled backend. Swallowed so a missing
    # backend never blocks startup; it re-resolves lazily on first use.
    try:
        get_backend()
    except Exception:
        pass
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    Ollama reachable, and which bundled models are ready. Drives the first-run
    setup flow (C19.1) and the settings surface (C19.2)."""
    ollama = OllamaBackend()
    active = get_backend()
    return {
        "ollama_available": ollama.available(),
        "models_ready": models_ready(),
        "model_key": "2b",  # default selection
        "active_backend": active.name,
    }


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
    """Trigger a bundled-model download. Runs synchronously; the frontend will
    poll /model/status for progress and the backend will load the file once 'ready'."""
    try:
        status = download_model(request.model_key)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except RuntimeError as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
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
