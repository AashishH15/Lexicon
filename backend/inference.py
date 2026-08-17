"""Provide one interface for local AI backends.

The app can use:

- Ollama with an existing local Ollama server.
- LM Studio with its local OpenAI-compatible server.
- A bundled GGUF model loaded by llama-cpp-python.

The bundled engine is optional. The code imports it only when the app needs it.
Backend selection is also delayed until the app needs a backend.
The HTTP endpoint is defined in ``main.py``.
"""

import json
import os
import re
import sys
from collections.abc import Callable
from threading import Event

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

# Reasoning adds time without improving short transforms. Ollama disables it
# with `think: false`, and LM Studio disables it with `reasoning_effort: "none"`.
# llama.cpp 0.3.x has no equivalent setting. The prompt asks the model not to
# expose reasoning, and the cleanup removes any reasoning block that it returns.
THINK_TAG_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)


def strip_think(text: str) -> str:
    """Remove any leaked reasoning block from a model output."""
    return THINK_TAG_RE.sub("", text).strip()


class InferenceUnavailable(RuntimeError):
    """Raised when an inference backend is asked to run but can't."""


class InferenceCancelled(InferenceUnavailable):
    """Raise this exception when the caller cancels a transform."""


def _take_cancellation_opts(opts: dict) -> tuple[Event | None, Callable | None]:
    """Remove the internal cancellation hooks before sending model options."""
    return opts.pop("cancel_event", None), opts.pop("on_response", None)


def _raise_if_cancelled(cancel_event: Event | None) -> None:
    if cancel_event is not None and cancel_event.is_set():
        raise InferenceCancelled("Transform cancelled.")


def _clean_completion(text: str, backend_name: str) -> str:
    if not isinstance(text, str):
        raise InferenceUnavailable(f"{backend_name} returned non-text content.")
    cleaned = strip_think(text)
    if cleaned:
        return cleaned
    raise InferenceUnavailable(
        f"{backend_name} returned no final text. The model may have spent "
        "the output budget on reasoning; thinking is disabled for transforms."
    )


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
        cancel_event, on_response = _take_cancellation_opts(opts)
        _raise_if_cancelled(cancel_event)
        model = opts.pop("model", None) or self._resolve_model()
        # Disable thinking for transform workloads. Pin max_tokens so Ollama
        # output isn't silently capped by the server default (often 128/2048
        # per-model), which previously truncated long rewrites/tables.
        payload = {
            "model": model,
            "system": SYSTEM_PROMPT,
            "prompt": f"{prompt}\n\n{text}",
            "stream": True,
            "think": False,
            "max_tokens": int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS)),
            **opts,
        }
        response = None
        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                stream=True,
                timeout=GENERATE_TIMEOUT,
            )
            if on_response:
                on_response(response)
            _raise_if_cancelled(cancel_event)
            response.raise_for_status()
            parts = []
            for line in response.iter_lines(decode_unicode=True):
                _raise_if_cancelled(cancel_event)
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except (TypeError, ValueError) as exc:
                    raise InferenceUnavailable(
                        f"Ollama at {self.base_url} returned invalid stream data."
                    ) from exc
                part = data.get("response", "")
                if isinstance(part, str):
                    parts.append(part)
                if data.get("done"):
                    break
            _raise_if_cancelled(cancel_event)
        except InferenceCancelled:
            raise
        except requests.RequestException as exc:
            if cancel_event is not None and cancel_event.is_set():
                raise InferenceCancelled("Transform cancelled.") from exc
            raise InferenceUnavailable(
                f"Ollama request to {self.base_url} failed: {exc}"
            ) from exc
        finally:
            if response is not None:
                response.close()
            if on_response:
                on_response(None)
        return _clean_completion("".join(parts), "Ollama")


class LMStudioBackend(InferenceBackend):
    """Use the LM Studio local server."""

    name = "lmstudio"

    def __init__(
        self,
        base_url: str = LM_STUDIO_SERVER,
        model: str | None = None,
        models: list[str] | None = None,
        loaded_models: list[str] | None = None,
        api_key: str | None = None,
    ):
        base_url = base_url.rstrip("/")
        if base_url.endswith("/api/v1"):
            base_url = base_url[:-7]
        elif base_url.endswith("/v1"):
            base_url = base_url[:-3]
        self.base_url = base_url
        self.api_url = f"{self.base_url}/v1"
        self.native_api_url = f"{self.base_url}/api/v1"
        self._model = model.strip() if isinstance(model, str) and model.strip() else None
        self._cached_models = models
        self._cached_loaded_models = (
            loaded_models
            if loaded_models is not None
            else models
        )
        self._detected_loaded_models = []
        self._models_probed = models is not None
        self.api_key = api_key.strip() if isinstance(api_key, str) else ""
        self._server_reachable = models is not None
        self._auth_required = False

    def _request_kwargs(self, **kwargs):
        if self.api_key:
            kwargs["headers"] = {"Authorization": f"Bearer {self.api_key}"}
        return kwargs

    @staticmethod
    def _status_code(exc: requests.HTTPError) -> int | None:
        response = getattr(exc, "response", None)
        return getattr(response, "status_code", None)

    @staticmethod
    def _native_model_ids(data: dict) -> tuple[list[str], list[str]]:
        items = data.get("models")
        if not isinstance(items, list):
            return [], []
        model_ids = []
        loaded_model_ids = []
        for item in items:
            if not isinstance(item, dict) or item.get("type") != "llm":
                continue
            model_id = item.get("key")
            if isinstance(model_id, str):
                model_ids.append(model_id)
            loaded_instances = item.get("loaded_instances")
            if not isinstance(loaded_instances, list):
                continue
            loaded_ids = [
                instance["id"]
                for instance in loaded_instances
                if isinstance(instance, dict) and isinstance(instance.get("id"), str)
            ]
            if not isinstance(model_id, str):
                model_ids.extend(loaded_ids)
            loaded_model_ids.extend(loaded_ids)
            if isinstance(model_id, str) and loaded_ids:
                loaded_model_ids.append(model_id)
        return list(dict.fromkeys(model_ids)), list(dict.fromkeys(loaded_model_ids))

    def _models(self) -> list[str]:
        if self._cached_models is not None:
            return list(self._cached_models)
        self._auth_required = False
        self._detected_loaded_models = []
        self._models_probed = True
        try:
            response = requests.get(
                f"{self.native_api_url}/models",
                **self._request_kwargs(timeout=PROBE_TIMEOUT),
            )
            response.raise_for_status()
            data = response.json()
        except requests.HTTPError as exc:
            status_code = self._status_code(exc)
            if status_code in (401, 403):
                self._server_reachable = True
                self._auth_required = True
                return []
            if status_code not in (404, 405):
                self._server_reachable = False
                return []
        except ValueError:
            self._server_reachable = False
            return []
        except requests.RequestException:
            self._server_reachable = False
            return []
        else:
            if isinstance(data, dict) and isinstance(data.get("models"), list):
                self._server_reachable = True
                model_ids, loaded_model_ids = self._native_model_ids(data)
                self._detected_loaded_models = loaded_model_ids
                return model_ids

        try:
            response = requests.get(
                f"{self.api_url}/models",
                **self._request_kwargs(timeout=PROBE_TIMEOUT),
            )
            response.raise_for_status()
            data = response.json()
        except requests.HTTPError as exc:
            status_code = self._status_code(exc)
            self._server_reachable = status_code in (401, 403)
            self._auth_required = self._server_reachable
            return []
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
        model_ids = list(
            dict.fromkeys(
                item["id"]
                for item in items
                if isinstance(item, dict) and isinstance(item.get("id"), str)
            )
        )
        self._detected_loaded_models = model_ids
        return model_ids

    def server_reachable(self) -> bool:
        """Return whether the last models probe reached LM Studio."""
        return self._server_reachable

    def authentication_required(self) -> bool:
        """Return whether LM Studio rejected the last probe as unauthorized."""
        return self._auth_required

    def loaded_models(self) -> list[str]:
        """Return the loaded LM Studio models from the last probe."""
        if self._cached_loaded_models is not None:
            return list(self._cached_loaded_models)
        if not self._models_probed:
            self._models()
        return list(self._detected_loaded_models)

    def available(self) -> bool:
        """Return true if LM Studio has an available LLM."""
        return bool(self._models())

    def _resolve_model(self) -> str:
        if self._model:
            return self._model
        models = self._models()
        if not models:
            raise InferenceUnavailable(
                f"LM Studio at {self.base_url} has no available LLM."
            )
        return models[0]

    def complete(self, prompt: str, text: str, **opts) -> str:
        cancel_event, on_response = _take_cancellation_opts(opts)
        _raise_if_cancelled(cancel_event)
        model = opts.pop("model", None) or self._resolve_model()
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{prompt}\n\n{text}"},
            ],
            "stream": True,
            # Disable reasoning so it cannot use the complete output budget.
            "reasoning_effort": "none",
            "max_tokens": int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS)),
            "temperature": 0.3,
            **opts,
        }
        response = None
        try:
            response = requests.post(
                f"{self.api_url}/chat/completions",
                **self._request_kwargs(
                    json=payload,
                    stream=True,
                    timeout=GENERATE_TIMEOUT,
                ),
            )
            if on_response:
                on_response(response)
            _raise_if_cancelled(cancel_event)
            response.raise_for_status()
            parts = []
            for raw_line in response.iter_lines(decode_unicode=True):
                _raise_if_cancelled(cancel_event)
                if not raw_line:
                    continue
                if isinstance(raw_line, bytes):
                    raw_line = raw_line.decode("utf-8", errors="replace")
                line = raw_line.strip()
                if line.startswith("data:"):
                    line = line[5:].strip()
                if line == "[DONE]":
                    break
                try:
                    data = json.loads(line)
                except (TypeError, ValueError) as exc:
                    raise InferenceUnavailable(
                        f"LM Studio at {self.base_url} returned invalid stream data."
                    ) from exc
                choices = data.get("choices")
                if not isinstance(choices, list) or not choices:
                    continue
                choice = choices[0]
                if not isinstance(choice, dict):
                    continue
                delta = choice.get("delta") or {}
                if not isinstance(delta, dict):
                    continue
                content = delta.get("content")
                if isinstance(content, str):
                    parts.append(content)
            _raise_if_cancelled(cancel_event)
        except InferenceCancelled:
            raise
        except requests.RequestException as exc:
            if cancel_event is not None and cancel_event.is_set():
                raise InferenceCancelled("Transform cancelled.") from exc
            raise InferenceUnavailable(
                f"LM Studio request to {self.base_url} failed: {exc}"
            ) from exc
        finally:
            if response is not None:
                response.close()
            if on_response:
                on_response(None)
        return _clean_completion("".join(parts), "LM Studio")


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
        cancel_event, _ = _take_cancellation_opts(opts)
        _raise_if_cancelled(cancel_event)
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
        return _clean_completion(content, "The bundled model")


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

    prefs = load_prefs()
    if FORCE_BACKEND in ("ollama", "lmstudio", "bundled"):
        if FORCE_BACKEND == "ollama":
            _backend = OllamaBackend()
        elif FORCE_BACKEND == "lmstudio":
            _backend = LMStudioBackend(
                base_url=prefs.get("lmstudio_url") or LM_STUDIO_SERVER,
                model=prefs.get("lmstudio_model") or None,
                api_key=prefs.get("lmstudio_api_key") or None,
            )
        else:
            _backend = BundledBackend()
        return _backend

    choice = prefs["backend"]
    key = prefs["model_key"]
    ollama_model = prefs.get("ollama_model", "")
    lmstudio_model = prefs.get("lmstudio_model", "")
    lmstudio_url = prefs.get("lmstudio_url") or LM_STUDIO_SERVER
    cached_ollama_models = (probe_results or {}).get("ollama")
    cached_lmstudio_models = (probe_results or {}).get("lmstudio")
    cached_lmstudio_loaded_models = (probe_results or {}).get("lmstudio_loaded")

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
            loaded_models=cached_lmstudio_loaded_models,
            api_key=prefs.get("lmstudio_api_key") or None,
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
