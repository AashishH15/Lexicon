"""Local inference abstraction layer.

A single interface the rest of the app calls, with two implementations behind
it:

- OllamaBackend: talks to a user's already-running Ollama server,
  auto-detected on startup and preferred when present.
- BundledBackend: runs one packaged quantized GGUF via llama-cpp-python when
  no Ollama server is found. The model is downloaded by the pipeline and
  loaded lazily on first use. llama-cpp-python is intentionally NOT a
  hard dependency yet, so it is imported lazily and guarded here.

Mirrors the "optional remote, local by default" shape of the LanguageTool
client (languagetool.py): env-overridable server URL, lazy resolution, and a
failure that never crashes the app.

No HTTP endpoint is exposed here; that arrives with /transform.
"""

import os
import re

import requests

from ai_prefs import load_prefs
from model_manager import model_path

OLLAMA_SERVER = os.environ.get("OLLAMA_SERVER", "http://localhost:11434")
# Optional hard override of auto-detection: "ollama" or "bundled".
FORCE_BACKEND = os.environ.get("LEXICON_INFERENCE", "").strip().lower()

# Probe timeout: a warm local Ollama answers near-instantly, but a cold server
# can take a beat on its first request, so 1s risks misclassifying a real
# Ollama as absent. 2.5s tolerates a cold first hit without meaningfully
# stalling startup (and startup swallows failures and re-probes lazily anyway).
PROBE_TIMEOUT = 2.5
GENERATE_TIMEOUT = 120

# Max tokens the model may generate for a single transform. The previous 512
# cap truncated real writing output (e.g. a 700-word rewrite died mid-sentence,
# and Markdown tables/list often arrived incomplete and failed to render). Both
# the 2b and 0.8b GGUFs advertise a 262,144-token context window, so 512 was
# far below what the models can produce. Long user documents (multi-thousand-word
# papers) need several thousand output tokens, so we cap at 7000 — well within
# n_ctx (8192) alongside the prompt. Overridable per-call via opts["max_tokens"].
TRANSFORM_MAX_TOKENS = 7000

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

    def __init__(self, base_url: str = OLLAMA_SERVER, model: str | None = None):
        self.base_url = base_url.rstrip("/")
        self._model = model

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


class BundledBackend(InferenceBackend):
    """Bundled llama.cpp model loaded from the downloaded GGUF.

    llama-cpp-python is a heavy native build and is not a hard dependency, so
    it is imported lazily and guarded. The session is created on the first
    complete() call (lazy load) rather than at import/startup, so we
    never pay the multi-GB load cost unless AI is actually used.
    """

    name = "bundled"

    def __init__(self, model_key: str = "2b", n_ctx: int = 8192):
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
        self._llm = Llama(
            model_path=self._path(),
            n_ctx=self.n_ctx,
            verbose=False,
        )

    def complete(self, prompt: str, text: str, **opts) -> str:
        self._ensure_loaded()
        max_tokens = int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS))
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a writing assistant. Follow the user's "
                    "instruction and rewrite only what is asked. Do not "
                    "explain. Do not think aloud."
                ),
            },
            {"role": "user", "content": f"{prompt}\n\n{text}"},
        ]
        try:
            out = self._llm.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.3,
                **opts,
            )
        except Exception as exc:  # noqa: BLE001 - surface engine errors clearly
            raise InferenceUnavailable(f"Bundled model failed: {exc}") from exc
        content = out["choices"][0]["message"]["content"]
        return strip_think(content)


_backend = None


def get_backend(force_refresh: bool = False) -> InferenceBackend:
    """Pick a backend once and cache it.

    Resolution order:
      1. `LEXICON_INFERENCE` env override (highest priority, dev/CI use).
      2. The user's persisted preference (ai_prefs.json): "ollama" or
         "bundled" (with a model_key). "auto" means prefer Ollama if present.
      3. Fallback: Ollama when reachable, else the bundled backend.

    When the preferred backend isn't actually usable (Ollama down, or the
    chosen bundled tier isn't downloaded), we fall back gracefully so a saved
    preference can never wedge the app into a broken state.
    """
    global _backend
    if _backend is not None and not force_refresh:
        return _backend

    if FORCE_BACKEND in ("ollama", "bundled"):
        _backend = OllamaBackend() if FORCE_BACKEND == "ollama" else BundledBackend()
        return _backend

    prefs = load_prefs()
    choice = prefs["backend"]
    key = prefs["model_key"]

    if choice == "ollama":
        ollama = OllamaBackend()
        if ollama.available():
            _backend = ollama
            return _backend
        # Ollama preferred but unavailable — fall back to bundled if we can.
        bundled = BundledBackend(model_key=key)
        _backend = bundled if bundled.available() else ollama
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
        ollama = OllamaBackend()
        _backend = ollama if ollama.available() else bundled
        return _backend

    # "auto": prefer Ollama when reachable, else bundled.
    ollama = OllamaBackend()
    _backend = ollama if ollama.available() else BundledBackend(model_key=key)
    return _backend


if __name__ == "__main__":
    # Quick manual check: which backend gets selected and is it usable?
    backend = get_backend()
    print(f"Selected backend: {backend.name}")
    print(f"Available: {backend.available()}")
