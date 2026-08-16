"""Provide one interface for local AI backends.

The app can use:

- Ollama with an existing local Ollama server.
- LM Studio with its local OpenAI-compatible server.
- A bundled GGUF model loaded by llama-cpp-python.

The bundled engine is optional. The code imports it only when the app needs it.
Backend selection is also delayed until the app needs a backend.
The HTTP endpoint is defined in ``main.py``.
"""

import os
import re
import sys

import requests

from ai_prefs import load_prefs
from model_manager import model_path

OLLAMA_SERVER = os.environ.get("OLLAMA_SERVER", "http://localhost:11434")
LM_STUDIO_SERVER = os.environ.get("LM_STUDIO_SERVER", "http://localhost:1234")
# Override automatic selection with "ollama", "lmstudio", or "bundled".
FORCE_BACKEND = os.environ.get("LEXICON_INFERENCE", "").strip().lower()

# Probe timeout: a warm local Ollama answers near-instantly, but a cold server
# can take a beat on its first request, so 1s risks misclassifying a real
# Ollama as absent. 3s tolerates a cold first hit without meaningfully
# stalling startup (and startup swallows failures and re-probes lazily anyway).
PROBE_TIMEOUT = 3.0
GENERATE_TIMEOUT = 120

# Cap on generated tokens per transform. n_ctx is 4096, so input + max_tokens
# must stay under it. The frontend chunks input to ~1800 tokens, leaving headroom
# for ~2048 output. Overridable per-call via opts["max_tokens"].
TRANSFORM_MAX_TOKENS = 2048

SYSTEM_PROMPT = (
    "You are a writing assistant. Follow the user's "
    "instruction and rewrite only what is asked. Do not "
    "explain. Do not think aloud."
)

# Qwen3.5 is a reasoning-capable model. For short text transforms, chain-of-
# thought is pure overhead (~10x slower, no quality gain). We disable
# thinking on both backends. Ollama honors a `think: false` flag; llama.cpp
# has no equivalent API in 0.3.x, so we both instruct it off in the prompt and
# strip any leaked think block as a safety net.
THINK_TAG_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)


def strip_think(text: str) -> str:
    """Remove any leaked reasoning block from a model output."""
    return THINK_TAG_RE.sub("", text).strip()


class InferenceUnavailable(RuntimeError):
    """Raised when an inference backend is asked to run but can't."""


class InferenceBackend:
    """The single interface the rest of the app calls."""

    name = "base"

    def available(self) -> bool:
        raise NotImplementedError

    def complete(self, prompt: str, text: str, **opts) -> str:
        """Run a transform: `prompt` is the instruction, `text` the input.
        Returns the generated text."""
        raise NotImplementedError


class OllamaBackend(InferenceBackend):
    """Uses a user's existing Ollama server."""

    name = "ollama"

    # Embedding-only models can't do chat/transform; skip them when auto-
    # picking a model from the tags list.
    _EMBED_ONLY = ("nomic-embed-text", "mxbai-embed-large", "all-minilm")

    def __init__(
        self,
        base_url: str = OLLAMA_SERVER,
        model: str | None = None,
        chat_models: list[str] | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self._model = model
        self._cached_chat_models = chat_models

    def _tags(self) -> list[str]:
        try:
            resp = requests.get(
                f"{self.base_url}/api/tags", timeout=PROBE_TIMEOUT
            )
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]
        except requests.RequestException:
            return []

    def _chat_models(self) -> list[str]:
        if self._cached_chat_models is not None:
            return list(self._cached_chat_models)
        return [
            m for m in self._tags()
            if not any(e in m for e in self._EMBED_ONLY)
        ]

    def available(self) -> bool:
        """True only if Ollama is up AND has a chat-capable model to use.

        A server can answer /api/tags yet have no usable model (e.g. only an
        embedder pulled), in which case transforms would 404 — so we require a
        real chat model before claiming availability.
        """
        return bool(self._chat_models())

    def _resolve_model(self) -> str:
        if self._model:
            return self._model
        models = self._chat_models()
        if not models:
            raise InferenceUnavailable(
                f"Ollama at {self.base_url} has no chat-capable model pulled."
            )
        # Prefer a qwen model (matches our bundled default) else the first.
        for m in models:
            if "qwen" in m.lower():
                return m
        return models[0]

    def complete(self, prompt: str, text: str, **opts) -> str:
        model = opts.pop("model", None) or self._resolve_model()
        # Disable thinking for transform workloads. Pin max_tokens so Ollama
        # output isn't silently capped by the server default (often 128/2048
        # per-model), which previously truncated long rewrites/tables.
        payload = {
            "model": model,
            "system": SYSTEM_PROMPT,
            "prompt": f"{prompt}\n\n{text}",
            "stream": False,
            "think": False,
            "max_tokens": int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS)),
            **opts,
        }
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=GENERATE_TIMEOUT,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise InferenceUnavailable(
                f"Ollama request to {self.base_url} failed: {exc}"
            ) from exc
        return strip_think(response.json().get("response", ""))


class LMStudioBackend(InferenceBackend):
    """Use the LM Studio local server."""

    name = "lmstudio"

    def __init__(
        self,
        base_url: str = LM_STUDIO_SERVER,
        model: str | None = None,
        models: list[str] | None = None,
    ):
        base_url = base_url.rstrip("/")
        self.base_url = base_url[:-3] if base_url.endswith("/v1") else base_url
        self.api_url = f"{self.base_url}/v1"
        self._model = model
        self._cached_models = models
        self._server_reachable = models is not None

    def _models(self) -> list[str]:
        if self._cached_models is not None:
            return list(self._cached_models)
        try:
            response = requests.get(
                f"{self.api_url}/models",
                timeout=PROBE_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
        except (requests.RequestException, ValueError):
            self._server_reachable = False
            return []
        if not isinstance(data, dict):
            self._server_reachable = False
            return []
        self._server_reachable = True
        items = data.get("data", [])
        if not isinstance(items, list):
            return []
        return [
            item["id"]
            for item in items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]

    def server_reachable(self) -> bool:
        """Return whether the last models probe reached LM Studio."""
        return self._server_reachable

    def available(self) -> bool:
        """Return true if LM Studio has a loaded model."""
        return bool(self._models())

    def _resolve_model(self) -> str:
        if self._model:
            return self._model
        models = self._models()
        if not models:
            raise InferenceUnavailable(
                f"LM Studio at {self.base_url} has no loaded model."
            )
        return models[0]

    def complete(self, prompt: str, text: str, **opts) -> str:
        model = opts.pop("model", None) or self._resolve_model()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{prompt}\n\n{text}"},
            ],
            "stream": False,
            "max_tokens": int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS)),
            "temperature": 0.3,
            **opts,
        }
        try:
            response = requests.post(
                f"{self.api_url}/chat/completions",
                json=payload,
                timeout=GENERATE_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except requests.RequestException as exc:
            raise InferenceUnavailable(
                f"LM Studio request to {self.base_url} failed: {exc}"
            ) from exc
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise InferenceUnavailable(
                f"LM Studio at {self.base_url} returned an invalid response."
            ) from exc
        if not isinstance(content, str):
            raise InferenceUnavailable(
                f"LM Studio at {self.base_url} returned non-text content."
            )
        return strip_think(content)


class BundledBackend(InferenceBackend):
    """Bundled llama.cpp model loaded from the downloaded GGUF.

    llama-cpp-python is a heavy native build and is not a hard dependency, so
    it is imported lazily and guarded. The session is created on the first
    complete() call (lazy load) rather than at import/startup, so we
    never pay the multi-GB load cost unless AI is actually used.
    """

    name = "bundled"

    def __init__(self, model_key: str = "2b", n_ctx: int = 4096):
        self.model_key = model_key
        self.n_ctx = n_ctx
        self._llm = None

    def _path(self) -> str:
        return model_path(self.model_key)

    def available(self) -> bool:
        # Available iff the downloaded GGUF for this key exists on disk.
        return os.path.exists(self._path())

    def _ensure_loaded(self):
        if self._llm is not None:
            return
        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise InferenceUnavailable(
                "The bundled model engine (llama-cpp-python) isn't installed. "
                "Install it or use a running Ollama server."
            ) from exc
        if not self.available():
            raise InferenceUnavailable(
                "The bundled model isn't downloaded yet. Run the model "
                "download before using the local backend."
            )
        try:
            self._llm = Llama(
                model_path=self._path(),
                n_ctx=self.n_ctx,
                use_mmap=True,
                verbose=False,
            )
        except Exception as load_exc:
            # If the error is an mmap error or a permission error, load the
            # model again with mmap off.
            # On macOS, load the model again if the error is a load failure.
            # The Python error does not always include the word mmap.
            err_str = str(load_exc).lower()
            mmap_markers = ("mmap", "permission", "not permitted", "map view")
            is_mmap_issue = any(k in err_str for k in mmap_markers)
            is_macos_load_fail = (
                sys.platform == "darwin" and "failed to load" in err_str
            )
            if is_mmap_issue or is_macos_load_fail:
                try:
                    self._llm = Llama(
                        model_path=self._path(),
                        n_ctx=self.n_ctx,
                        use_mmap=False,
                        verbose=False,
                    )
                    return
                except Exception as retry_exc:
                    load_exc = retry_exc
            self._llm = None
            import gc

            gc.collect()
            raise InferenceUnavailable(
                f"Engine failed to load model: {load_exc}"
            ) from load_exc

    def unload(self):
        """Free GGUF model memory and force garbage collection."""
        if self._llm is not None:
            self._llm = None
            import gc

            gc.collect()

    def complete(self, prompt: str, text: str, **opts) -> str:
        self._ensure_loaded()
        max_tokens = int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS))
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{prompt}\n\n{text}"},
        ]
        try:
            out = self._llm.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.3,
                **opts,
            )
        except Exception:  # noqa: BLE001 - surface engine errors clearly
            # A decode can wedge the session if the client aborts mid-generation
            # (e.g. cancelling a run). Rebuild the session once and retry so the
            # next request self-heals instead of persisting a -1 failure.
            self._llm = None
            try:
                self._ensure_loaded()
                out = self._llm.create_chat_completion(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.3,
                    **opts,
                )
            except Exception as exc2:
                raise InferenceUnavailable(f"Bundled model failed: {exc2}") from exc2
        content = out["choices"][0]["message"]["content"]
        return strip_think(content)


_backend = None


def get_backend(
    force_refresh: bool = False,
    probe_results: dict[str, list[str]] | None = None,
) -> InferenceBackend:
    """Select and cache an inference backend.

    The environment variable has priority over the saved preference.
    Automatic selection tries Ollama, LM Studio, and then the bundled model.
    If the selected backend is not available, the function uses a fallback.
    """
    global _backend
    if _backend is not None and not force_refresh:
        return _backend

    if FORCE_BACKEND in ("ollama", "lmstudio", "bundled"):
        if FORCE_BACKEND == "ollama":
            _backend = OllamaBackend()
        elif FORCE_BACKEND == "lmstudio":
            _backend = LMStudioBackend()
        else:
            _backend = BundledBackend()
        return _backend

    prefs = load_prefs()
    choice = prefs["backend"]
    key = prefs["model_key"]
    ollama_model = prefs.get("ollama_model", "")
    lmstudio_model = prefs.get("lmstudio_model", "")
    lmstudio_url = prefs.get("lmstudio_url") or LM_STUDIO_SERVER
    cached_ollama_models = (probe_results or {}).get("ollama")
    cached_lmstudio_models = (probe_results or {}).get("lmstudio")

    def make_ollama(model: str | None = None) -> OllamaBackend:
        return OllamaBackend(
            model=model,
            chat_models=cached_ollama_models,
        )

    def make_lmstudio(model: str | None = None) -> LMStudioBackend:
        return LMStudioBackend(
            base_url=lmstudio_url,
            model=model,
            models=cached_lmstudio_models,
        )

    if choice == "ollama":
        ollama = make_ollama(ollama_model or None)
        if ollama.available():
            _backend = ollama
            return _backend
        # If Ollama is not available, try the bundled model and then LM Studio.
        bundled = BundledBackend(model_key=key)
        if bundled.available():
            _backend = bundled
            return _backend
        lmstudio = make_lmstudio(lmstudio_model or None)
        _backend = lmstudio if lmstudio.available() else ollama
        return _backend

    if choice == "lmstudio":
        lmstudio = make_lmstudio(lmstudio_model or None)
        if lmstudio.available():
            _backend = lmstudio
            return _backend
        # If LM Studio is not available, try the bundled model and then Ollama.
        bundled = BundledBackend(model_key=key)
        if bundled.available():
            _backend = bundled
            return _backend
        ollama = make_ollama(ollama_model or None)
        _backend = ollama if ollama.available() else lmstudio
        return _backend

    if choice == "bundled":
        bundled = BundledBackend(model_key=key)
        if bundled.available():
            _backend = bundled
            return _backend
        # Chosen tier missing — try the other tier, then Ollama as last resort.
        other = "0.8b" if key == "2b" else "2b"
        alt = BundledBackend(model_key=other)
        if alt.available():
            _backend = alt
            return _backend
        ollama = make_ollama()
        if ollama.available():
            _backend = ollama
            return _backend
        lmstudio = make_lmstudio(lmstudio_model or None)
        _backend = lmstudio if lmstudio.available() else bundled
        return _backend

    # In auto mode, try Ollama, then LM Studio, then the bundled model.
    ollama = make_ollama()
    if ollama.available():
        _backend = ollama
        return _backend
    lmstudio = make_lmstudio(lmstudio_model or None)
    if lmstudio.available():
        _backend = lmstudio
        return _backend
    _backend = BundledBackend(model_key=key)
    return _backend


def unload_active_backend():
    """Unload cached backend model weights from memory."""
    global _backend
    if _backend is not None:
        if hasattr(_backend, "unload"):
            _backend.unload()
        _backend = None
    import gc

    gc.collect()


if __name__ == "__main__":
    # Quick manual check: which backend gets selected and is it usable?
    backend = get_backend()
    print(f"Selected backend: {backend.name}")
    print(f"Available: {backend.available()}")
