import os
import subprocess
import threading
import uuid

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

from ai_prefs import load_prefs, public_prefs, save_prefs
from inference import (
    LM_STUDIO_SERVER,
    BundledBackend,
    InferenceCancelled,
    InferenceUnavailable,
    LMStudioBackend,
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

# Pinned extension origins. The local API is not open to arbitrary
# extensions.
# Chrome: the ID derives from the `key` field in
# extension/chrome/manifest.json and is stable across machines. If the Web
# Store ID differs, add it here or via LEXICON_EXTENSION_ORIGINS.
# Firefox: moz-extension origins are random per profile. The regex admits
# only well-formed moz-extension UUID origins.
EXTENSION_ORIGINS = [
    "chrome-extension://egcfmlgpcidpanppnampkkdknogccpjg",
]
EXTENSION_ORIGIN_REGEX = (
    r"^moz-extension://[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
)


def _cors_origins() -> list[str]:
    """Fixed dev/Tauri origins plus pinned extension origins.

    LEXICON_EXTENSION_ORIGINS (comma-separated full origins) appends extra
    origins without editing this file — e.g. a second Chrome ID the day the
    Web Store build publishes with a different one.
    """
    override = os.environ.get("LEXICON_EXTENSION_ORIGINS", "")
    extra = [origin.strip() for origin in override.split(",") if origin.strip()]
    return list(
        dict.fromkeys(
            [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                # Tauri's bundled WebView origin, so the desktop app can call
                # the sidecar API on localhost without a CORS block.
                "tauri://localhost",
                "http://tauri.localhost",
                "https://tauri.localhost",
                "http://localhost",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
                "http://localhost:18000",
                "http://127.0.0.1:18000",
                *EXTENSION_ORIGINS,
                *extra,
            ]
        )
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=EXTENSION_ORIGIN_REGEX,
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
    backend: str | None = None  # Backend name, or None for automatic selection.
    request_id: str | None = None


class TransformCancelRequest(BaseModel):
    request_id: str


class _TransformJob:
    """Manage the cancellation signal and active model response for one run."""

    def __init__(self):
        self.cancel_event = threading.Event()
        self._response = None
        self._lock = threading.Lock()

    def set_response(self, response):
        close_now = False
        with self._lock:
            if response is None:
                self._response = None
            elif self.cancel_event.is_set():
                close_now = True
            else:
                self._response = response
        if close_now:
            response.close()

    def cancel(self):
        self.cancel_event.set()
        with self._lock:
            response = self._response
            self._response = None
        if response is not None:
            response.close()


_transform_jobs = {}
_transform_jobs_lock = threading.Lock()


def _start_transform_job(request_id: str | None) -> tuple[str, _TransformJob]:
    job_id = request_id or uuid.uuid4().hex
    job = _TransformJob()
    with _transform_jobs_lock:
        previous = _transform_jobs.get(job_id)
        _transform_jobs[job_id] = job
    if previous is not None:
        previous.cancel()
    return job_id, job


def _remove_transform_job(job_id: str, job: _TransformJob) -> None:
    with _transform_jobs_lock:
        if _transform_jobs.get(job_id) is job:
            _transform_jobs.pop(job_id, None)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/extension/ping")
def extension_ping():
    """Health probe for the browser extension.

    It has no LanguageTool or model dependencies. It proves the caller is
    talking to Lexicon's backend and not another process on the port.
    """
    return {"ok": True, "app": "lexicon"}


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
    try:
        matches = check_text(request.text, request.language, request.ignore)
        return {"matches": matches}
    except Exception as exc:
        # Surface a clear message (e.g. "can't find Java") instead of a bare
        # unhandled 500 so Review can show a useful diagnostic.
        return JSONResponse(
            status_code=503,
            content={
                "error": "grammar_engine_unavailable",
                "detail": str(exc) or exc.__class__.__name__,
            },
        )


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
    # Probe both local servers at the same time.
    from concurrent.futures import ThreadPoolExecutor

    ollama = OllamaBackend()
    lmstudio = LMStudioBackend(
        base_url=prefs.get("lmstudio_url") or LM_STUDIO_SERVER,
        model=prefs.get("lmstudio_model") or None,
        api_key=prefs.get("lmstudio_api_key") or None,
    )
    with ThreadPoolExecutor(max_workers=2) as executor:
        ollama_probe = executor.submit(ollama._chat_models)
        lmstudio_probe = executor.submit(lmstudio._models)
        ollama_models = ollama_probe.result()
        lmstudio_models = lmstudio_probe.result()
        lmstudio_loaded_models = lmstudio.loaded_models()
    ollama_available = bool(ollama_models)
    lmstudio_available = bool(lmstudio_models)
    active = get_backend(
        probe_results={
            "ollama": ollama_models,
            "lmstudio": lmstudio_models,
            "lmstudio_loaded": lmstudio_loaded_models,
        }
    )
    return {
        "ollama_available": ollama_available,
        "ollama_models": ollama_models,
        "lmstudio_available": lmstudio_available,
        "lmstudio_models": lmstudio_models,
        "lmstudio_loaded_models": lmstudio_loaded_models,
        "lmstudio_server_available": lmstudio.server_reachable(),
        "lmstudio_auth_required": lmstudio.authentication_required(),
        "models_ready": models_ready(),
        "model_key": prefs["model_key"],
        "preference": public_prefs(prefs),
        "active_backend": active.name,
    }


@app.get("/ai/preference")
def ai_preference_get():
    """Current persisted backend choice."""
    return public_prefs()


class AiPreferenceRequest(BaseModel):
    backend: str  # Backend name: auto, ollama, lmstudio, or bundled.
    model_key: str = "2b"  # Bundled model tier: 2b or 0.8b.
    ollama_model: str = ""  # Selected Ollama model name.
    lmstudio_model: str = ""  # Selected LM Studio model name.
    lmstudio_url: str = ""  # LM Studio server URL.
    lmstudio_api_key: str | None = None  # Optional LM Studio API token.


@app.post("/ai/preference")
def ai_preference_set(request: AiPreferenceRequest):
    """Persist the user's backend choice so it survives restarts and drives
    get_backend(). The editor's AI tools read this via get_backend()."""
    prefs = save_prefs(
        request.backend,
        request.model_key,
        request.ollama_model,
        request.lmstudio_model,
        request.lmstudio_url,
        request.lmstudio_api_key,
    )
    # Force the cached backend to re-resolve against the new preference.
    get_backend(force_refresh=True)
    return public_prefs(prefs)


@app.post("/model/cancel")
def model_cancel(request: ModelDownloadRequest | None = None):
    """Signal an in-flight download to abort at the next chunk."""
    model_key = request.model_key if request else None
    cancel_download(model_key)
    return {"cancelled": True, "model_key": model_key}


@app.post("/transform/cancel")
def transform_cancel(request: TransformCancelRequest):
    """Cancel an active transform and close its active model response."""
    with _transform_jobs_lock:
        job = _transform_jobs.get(request.request_id)
    if job is None:
        return {"cancelled": False, "request_id": request.request_id}
    job.cancel()
    return {"cancelled": True, "request_id": request.request_id}


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
        if "cancelled" in str(exc).lower():
            return {"state": "cancelled", "error": None}
        return JSONResponse(status_code=500, content={"error": str(exc)})
    if status.get("state") == "ready":
        current = load_prefs()
        save_prefs(
            "bundled",
            request.model_key,
            current.get("ollama_model", ""),
            current.get("lmstudio_model", ""),
            current.get("lmstudio_url", ""),
        )
        get_backend(force_refresh=True)
    return status


@app.post("/transform")
def transform(request: TransformRequest):
    """Run a text transform with the active backend.

    The request can select a backend or a bundled model tier.
    """
    job_id, job = _start_transform_job(request.request_id)
    try:
        if request.backend == "bundled":
            backend = BundledBackend(model_key=request.model_key or "2b")
        elif request.backend == "ollama":
            backend = OllamaBackend()
        elif request.backend == "lmstudio":
            prefs = load_prefs()
            backend = LMStudioBackend(
                base_url=prefs.get("lmstudio_url") or LM_STUDIO_SERVER,
                model=prefs.get("lmstudio_model") or None,
                api_key=prefs.get("lmstudio_api_key") or None,
            )
        else:
            backend = get_backend()
        result = backend.complete(
            request.prompt,
            request.text,
            cancel_event=job.cancel_event,
            on_response=job.set_response,
        )
    except InferenceCancelled as exc:
        return JSONResponse(
            status_code=499,
            content={"error": str(exc), "detail": str(exc)},
        )
    except InferenceUnavailable as exc:
        return JSONResponse(
            status_code=503,
            content={"error": str(exc), "detail": str(exc)},
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"error": str(exc), "detail": str(exc)},
        )
    finally:
        _remove_transform_job(job_id, job)
    return {"text": result}
