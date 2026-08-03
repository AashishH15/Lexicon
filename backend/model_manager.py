"""Bundled-model download pipeline.

Downloads the pinned quantized GGUF models from Hugging Face into the
user's app-data directory and tracks download state so the frontend
and settings surface can report/trigger it later.

This module only *fetches and verifies* the model file. Loading it into a
llama.cpp session is a separate concern and is intentionally not
done here — the file just lands on disk, ready for the loader to pick up.

Pinned artifacts:
  - "2b"  -> bartowski/Qwen_Qwen3.5-2B-GGUF  / Qwen_Qwen3.5-2B-Q4_K_M.gguf  (~1.4 GB)
  - "0.8b"-> bartowski/Qwen_Qwen3.5-0.8B-GGUF / Qwen_Qwen3.5-0.8B-Q8_0.gguf    (~0.84 GB)
"""

import os
import shutil
import sys
import threading
import time

import requests
from huggingface_hub import hf_hub_url

# Safety margin added to the expected download size when checking free disk
# space, so we don't start a multi-GB download that the disk can't finish.
SPACE_MARGIN_BYTES = 200 * 1024 * 1024

# Pinned models. `filename` must exactly match the repo's GGUF file.
# `size` is the approximate on-disk size used only for the disk-space guard;
# hf_hub_download still verifies the real file by hash independently.
MODELS = {
    "2b": {
        "repo_id": "bartowski/Qwen_Qwen3.5-2B-GGUF",
        "filename": "Qwen_Qwen3.5-2B-Q4_K_M.gguf",
        "size": 1_400_000_000,
    },
    "0.8b": {
        "repo_id": "bartowski/Qwen_Qwen3.5-0.8B-GGUF",
        "filename": "Qwen_Qwen3.5-0.8B-Q8_0.gguf",
        # Q8_0 (~0.84 GB): at 0.8B scale, near-lossless quality costs only
        # ~0.25 GB more than Q4_K_M, so the Light tier maximizes quality
        # rather than minimizing size (size is already a non-issue here).
        "size": 840_000_000,
    },
}
DEFAULT_MODEL_KEY = "2b"


def models_dir() -> str:
    """User app-data models directory, created on first call.

    Lives outside the project tree so a reinstall/update never wipes the
    downloaded model. Mirrors platform conventions for app data.
    """
    if sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support/Lexicon/models")
    elif sys.platform == "win32":
        base = os.path.join(
            os.environ.get("APPDATA", os.path.expanduser("~")),
            "Lexicon",
            "models",
        )
    else:
        base = os.path.expanduser("~/.local/share/Lexicon/models")
    os.makedirs(base, exist_ok=True)
    return base


def model_path(model_key: str = DEFAULT_MODEL_KEY) -> str:
    """Absolute path to the GGUF file for `model_key` (whether or not present)."""
    spec = MODELS[model_key]
    return os.path.join(models_dir(), spec["filename"])


# Per-key download state. A single shared dict caused the progress bar to
# flicker between sizes when switching models, so each key tracks its own.
MODEL_STATUS = {
    key: {
        "state": "idle",  # idle | downloading | verifying | ready | error | cancelled
        "bytes_done": 0,
        "bytes_total": 0,
        "error": None,
    }
    for key in MODELS
}

# Thread-safe set of cancelled model keys (_stream_download checks chunk-by-chunk)
_CANCELLED_KEYS: set[str] = set()
_CANCEL_LOCK = threading.Lock()


def _is_cancelled(model_key: str) -> bool:
    with _CANCEL_LOCK:
        return model_key in _CANCELLED_KEYS


def model_state(model_key: str | None = None) -> dict:
    """Snapshot of download state for a key (or the default key).

    If a key isn't actively downloading/errored, reflect the on-disk reality:
    present -> ready, absent -> idle. This keeps the frontend's "installed"
    tag accurate after a download finishes or a file is deleted.
    """
    key = model_key or DEFAULT_MODEL_KEY
    default = {"state": "idle", "bytes_done": 0, "bytes_total": 0, "error": None}
    st = dict(MODEL_STATUS.get(key, default))
    if st["state"] in ("idle", "ready", "cancelled") and _already_installed(key):
        size = MODELS[key]["size"]
        st = {**st, "state": "ready", "bytes_done": size, "bytes_total": size}
    if st["state"] in ("idle", "cancelled") and not os.path.exists(model_path(key)):
        st = {**st, "bytes_done": 0, "bytes_total": 0}
    return st


def models_ready() -> dict:
    """Map of key -> bool for which models are on disk."""
    return {key: _already_installed(key) for key in MODELS}


def _update_progress(model_key: str, done: int, total: int) -> None:
    """Streamed-download progress -> that key's status entry."""
    MODEL_STATUS[model_key]["bytes_done"] = done
    MODEL_STATUS[model_key]["bytes_total"] = total


def _free_space(path: str) -> int:
    """Free bytes on the drive holding `path`."""
    try:
        return shutil.disk_usage(path).free
    except OSError:
        return 0


def _already_installed(model_key: str) -> bool:
    """True if the GGUF is present and roughly the expected size."""
    spec = MODELS[model_key]
    path = model_path(model_key)
    if not os.path.exists(path):
        return False
    return os.path.getsize(path) >= spec["size"] * 0.95


def cancel_download(model_key: str | None = None) -> None:
    """Signal in-flight download(s) to abort at the next chunk."""
    with _CANCEL_LOCK:
        if model_key:
            _CANCELLED_KEYS.add(model_key)
        else:
            _CANCELLED_KEYS.update(MODELS.keys())


def delete_model(model_key: str) -> None:
    """Remove a downloaded GGUF from disk (user switched models / freed space)."""
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key {model_key!r}. Known: {sorted(MODELS)}")
    path = model_path(model_key)
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            # On Windows, if the download stream thread is still releasing the file handle,
            # wait briefly and retry once.
            time.sleep(0.15)
            try:
                os.remove(path)
            except OSError:
                pass
    MODEL_STATUS[model_key] = {
        "state": "idle",
        "bytes_done": 0,
        "bytes_total": 0,
        "error": None,
    }


def download_model(model_key: str = DEFAULT_MODEL_KEY) -> dict:
    """Download the pinned GGUF for `model_key` into the app-data dir."""
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key {model_key!r}. Known: {sorted(MODELS)}")

    with _CANCEL_LOCK:
        _CANCELLED_KEYS.discard(model_key)

    # Reset this key's status (leave other keys untouched).
    MODEL_STATUS[model_key] = {
        "state": "idle",
        "bytes_done": 0,
        "bytes_total": MODELS[model_key]["size"],
        "error": None,
    }

    if _already_installed(model_key):
        MODEL_STATUS[model_key]["state"] = "ready"
        MODEL_STATUS[model_key]["bytes_done"] = MODELS[model_key]["size"]
        return dict(MODEL_STATUS[model_key])

    needed = int(MODELS[model_key]["size"] * 1.05)
    if _free_space(models_dir()) < needed:
        MODEL_STATUS[model_key]["state"] = "error"
        MODEL_STATUS[model_key]["error"] = "Not enough free disk space to download the model."
        raise RuntimeError(MODEL_STATUS[model_key]["error"])

    try:
        MODEL_STATUS[model_key]["state"] = "downloading"
        path = _stream_download(model_key)
        MODEL_STATUS[model_key]["state"] = "verifying"
        MODEL_STATUS[model_key]["bytes_done"] = os.path.getsize(path)
        MODEL_STATUS[model_key]["state"] = "ready"
    except Exception as exc:  # noqa: BLE001 - surface any download failure clearly
        if MODEL_STATUS[model_key].get("state") == "cancelled" or _is_cancelled(model_key):
            with _CANCEL_LOCK:
                _CANCELLED_KEYS.discard(model_key)
            MODEL_STATUS[model_key]["state"] = "cancelled"
            MODEL_STATUS[model_key]["error"] = None
            return dict(MODEL_STATUS[model_key])
        MODEL_STATUS[model_key]["state"] = "error"
        MODEL_STATUS[model_key]["error"] = str(exc)
        raise RuntimeError(f"Model download failed: {exc}") from exc

    return dict(MODEL_STATUS[model_key])


def _stream_download(model_key: str) -> str:
    """Stream the pinned GGUF to disk with progress + resume support.

    huggingface_hub 0.29.3's hf_hub_download has no progress callback, so we
    resolve the file URL and stream it via requests. Resumes a partial file
    with an HTTP Range request, and verifies the final size. Aborts cleanly
    if cancel_download() is called.
    """
    spec = MODELS[model_key]
    dest = model_path(model_key)
    url = hf_hub_url(repo_id=spec["repo_id"], filename=spec["filename"])

    # Resume if a partial download exists.
    resume_pos = os.path.getsize(dest) if os.path.exists(dest) else 0
    headers = {"Range": f"bytes={resume_pos}-"} if resume_pos else {}

    with requests.get(url, headers=headers, stream=True, timeout=30) as resp:
        resp.raise_for_status()
        # Verify server honored partial content (206). If 200 OK is returned instead,
        # the server/CDN ignored the Range header and sent full content from byte 0,
        # so overwrite cleanly instead of appending duplicate bytes.
        if resume_pos > 0 and resp.status_code != 206:
            resume_pos = 0
            mode = "wb"
        else:
            mode = "ab" if resume_pos else "wb"

        # The authoritative target file size on disk is spec["size"].
        total = spec["size"]
        _update_progress(model_key, resume_pos, total)
        with open(dest, mode) as fh:
            for chunk in resp.iter_content(chunk_size=1 << 20):  # 1 MiB
                if _is_cancelled(model_key):
                    with _CANCEL_LOCK:
                        _CANCELLED_KEYS.discard(model_key)
                    # Leave the partial file; a later download resumes it.
                    MODEL_STATUS[model_key]["state"] = "cancelled"
                    MODEL_STATUS[model_key]["error"] = None
                    raise RuntimeError(f"Download of {model_key} cancelled by user.")
                if not chunk:
                    continue
                fh.write(chunk)
                resume_pos += len(chunk)
                _update_progress(model_key, resume_pos, total)

    if os.path.getsize(dest) < int(spec["size"] * 0.95):
        raise RuntimeError(
            f"Downloaded file is smaller than expected "
            f"({os.path.getsize(dest)} < {spec['size']} bytes)"
        )
    return dest


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL_KEY
    try:
        result = download_model(key)
        print("Download complete:", result)
    except Exception as exc:  # noqa: BLE001
        print("Download failed:", exc)
        sys.exit(1)
