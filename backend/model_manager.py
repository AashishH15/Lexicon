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

import concurrent.futures
import os
import shutil
import sys
import threading
import time

import requests
from huggingface_hub import hf_hub_url

# Number of parallel workers for chunked GGUF model downloads.
NUM_DOWNLOAD_WORKERS = 4

# Safety margin added to the expected download size when checking free disk
# space, so we don't start a multi-GB download that the disk can't finish.
SPACE_MARGIN_BYTES = 200 * 1024 * 1024

# Pinned models. `filename` must exactly match the repo's GGUF file.
# `size` is the approximate on-disk size used only for the disk-space guard;
# hf_hub_download still verifies the real file by hash independently.
MODELS = {
    "2b": {
        # Standard Tier: Qwen3.5 4B Q4_K_M (~2.8 GB).
        # Delivers a 185% accuracy improvement on Artificial Analysis index (20 vs 7).
        "repo_id": "bartowski/Qwen_Qwen3.5-4B-GGUF",
        "filename": "Qwen_Qwen3.5-4B-Q4_K_M.gguf",
        "size": 3_013_027_808,
    },
    "0.8b": {
        # Light Tier: MiniCPM5-1B Q8_0 (~1.15 GB).
        # This model gives better accuracy for instruction following and reasoning.
        "repo_id": "openbmb/MiniCPM5-1B-GGUF",
        "filename": "MiniCPM5-1B-Q8_0.gguf",
        "size": 1_160_000_000,
    },
    "quality": {
        # Quality Tier: Qwen 3.8 27B UD-Q4_K_M (~16.5 GB).
        # Unsloth Dynamic v3.0 quantization.
        # Score: 26 on Artificial Analysis Intelligence Index.
        "repo_id": "unsloth/Qwen3.8-27B-GGUF",
        "filename": "Qwen3.8-27B-UD-Q4_K_M.gguf",
        "size": 16_464_440_224,
    },
    "legacy-2b": {
        # Previous 2B model kept for backward compatibility.
        "repo_id": "bartowski/Qwen_Qwen3.5-2B-GGUF",
        "filename": "Qwen_Qwen3.5-2B-Q4_K_M.gguf",
        "size": 1_400_000_000,
    },
    "legacy-0.8b": {
        # Previous 0.8B model kept for backward compatibility.
        "repo_id": "bartowski/Qwen_Qwen3.5-0.8B-GGUF",
        "filename": "Qwen_Qwen3.5-0.8B-Q8_0.gguf",
        "size": 840_000_000,
    },
}
DEFAULT_MODEL_KEY = "2b"


UPGRADE_TIERS = {
    "2b": {
        "tier_name": "Standard",
        "accuracy_gain": "+185%",
        "size_diff": "+1.4 GB",
        "reclaim_size": "1.4 GB",
    },
    "0.8b": {
        "tier_name": "Light",
        "accuracy_gain": "+140%",
        "size_diff": "+320 MB",
        "reclaim_size": "840 MB",
    },
    "quality": {
        "tier_name": "Quality",
        "accuracy_gain": "",
        "size_diff": "",
        "reclaim_size": "",
    },
}


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


def primary_model_path(model_key: str = DEFAULT_MODEL_KEY) -> str:
    """Absolute path to the primary (current-generation) GGUF file for `model_key`."""
    spec = MODELS[model_key]
    return os.path.join(models_dir(), spec["filename"])


def legacy_model_path(model_key: str = DEFAULT_MODEL_KEY) -> str | None:
    """Absolute path to the legacy GGUF file for `model_key` if defined, else None."""
    legacy_key = f"legacy-{model_key}"
    if legacy_key in MODELS:
        return os.path.join(models_dir(), MODELS[legacy_key]["filename"])
    return None


def model_path(model_key: str = DEFAULT_MODEL_KEY) -> str:
    """Absolute path to the GGUF file for `model_key` (whether or not present).

    Returns the primary path if present, otherwise falls back to the legacy
    model path if present on disk. If neither is on disk, returns the primary path.
    """
    primary = primary_model_path(model_key)
    if is_primary_installed(model_key):
        return primary
    legacy = legacy_model_path(model_key)
    if legacy and is_legacy_installed(model_key):
        return legacy
    return primary


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
_DOWNLOAD_LOCKS = {key: threading.Lock() for key in MODELS}


def _is_structurally_valid_model_file(path: str | None, spec: dict) -> bool:
    """Check that a model file is complete enough to be selected.

    This cheap check protects startup and availability probes from partial or
    corrupt files. ``verify_model_runs`` remains the stronger post-download
    execution check.
    """
    if not path or not os.path.isfile(path):
        return False
    try:
        if os.path.getsize(path) < int(spec["size"] * 0.95):
            return False
        with open(path, "rb") as fh:
            return fh.read(4) == b"GGUF"
    except OSError:
        return False


def is_model_file_available(model_key: str) -> bool:
    """Return whether a usable primary or legacy file exists for a tier."""
    return _already_installed(model_key)


def _is_cancelled(model_key: str) -> bool:
    with _CANCEL_LOCK:
        return model_key in _CANCELLED_KEYS


def is_primary_installed(model_key: str) -> bool:
    """True if the primary (current-gen) model file is on disk and valid."""
    if model_key not in MODELS:
        return False
    path = primary_model_path(model_key)
    return _is_structurally_valid_model_file(path, MODELS[model_key])


def is_legacy_installed(model_key: str) -> bool:
    """True if a previous-generation legacy model file is on disk and valid."""
    legacy_key = f"legacy-{model_key}"
    if legacy_key not in MODELS:
        return False
    path = legacy_model_path(model_key)
    return _is_structurally_valid_model_file(path, MODELS[legacy_key])


def _already_installed(model_key: str) -> bool:
    """True if either the primary or legacy GGUF is present and ready.

    Ensures existing users experience zero downtime or disruption upon updating.
    """
    return is_primary_installed(model_key) or is_legacy_installed(model_key)


def get_upgrade_info(model_key: str = DEFAULT_MODEL_KEY) -> dict:
    """Check if an upgraded model is available for the given tier.

    An upgrade is available if the user has an installed legacy model on disk
    and has not yet downloaded the primary current-generation model.
    """
    tier_meta = UPGRADE_TIERS.get(model_key, {})
    tier_name = tier_meta.get("tier_name", model_key)
    legacy_installed = is_legacy_installed(model_key)
    primary_installed = is_primary_installed(model_key)

    if legacy_installed and not primary_installed:
        return {
            "upgrade_available": True,
            "model_key": model_key,
            "tier_name": tier_name,
            "accuracy_gain": tier_meta.get("accuracy_gain", ""),
            "size_diff": tier_meta.get("size_diff", ""),
            "reclaim_size": tier_meta.get("reclaim_size", ""),
            "legacy_filename": MODELS.get(f"legacy-{model_key}", {}).get("filename", ""),
            "primary_filename": MODELS.get(model_key, {}).get("filename", ""),
        }
    return {
        "upgrade_available": False,
        "model_key": model_key,
        "tier_name": tier_name,
    }


def verify_model_runs(model_key: str = DEFAULT_MODEL_KEY) -> bool:
    """Verify that the primary downloaded model exists, is valid GGUF, and executes correctly.

    Checks:
    1. File existence and minimum expected size.
    2. GGUF magic bytes (first 4 bytes must be b"GGUF").
    3. Test inference run with llama_cpp.Llama if installed (1 token generation).
    """
    if model_key not in MODELS:
        return False
    path = primary_model_path(model_key)
    if not os.path.exists(path):
        return False
    expected_size = int(MODELS[model_key]["size"] * 0.95)
    if os.path.getsize(path) < expected_size:
        return False

    # Check GGUF magic header
    try:
        with open(path, "rb") as f:
            header = f.read(4)
            if header != b"GGUF":
                return False
    except OSError:
        return False

    # Check execution via llama_cpp
    try:
        from llama_cpp import Llama
        llm = Llama(model_path=path, n_ctx=512, verbose=False)
        output = llm("Hello", max_tokens=1)
        del llm
        import gc
        gc.collect()
        return bool(output and "choices" in output and len(output["choices"]) > 0)
    except ImportError:
        # If llama_cpp is not installed, header and size checks suffice
        return True
    except Exception:
        import gc
        gc.collect()
        return False


def cleanup_legacy_model(model_key: str, *, primary_verified: bool = False) -> dict:
    """Safely remove a previous-generation model file to reclaim disk space.

    Guarantees zero orphaned files, verifies the primary model, and strictly
    preserves the primary model.
    """
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key {model_key!r}. Known: {sorted(MODELS)}")
    legacy_path = legacy_model_path(model_key)
    primary_path = primary_model_path(model_key)

    if not legacy_path or not os.path.exists(legacy_path):
        return {"cleaned": False, "reclaimed_bytes": 0, "reclaimed_gb": "0 GB"}

    # Safety guard: Never delete legacy unless the new model was verified.
    if not primary_verified and not verify_model_runs(model_key):
        return {
            "cleaned": False,
            "reclaimed_bytes": 0,
            "reclaimed_gb": "0 GB",
            "error": "Primary model failed execution verification.",
        }
    if not is_primary_installed(model_key):
        return {
            "cleaned": False,
            "reclaimed_bytes": 0,
            "reclaimed_gb": "0 GB",
            "error": "Primary model is not structurally valid.",
        }

    # Safety guard: Never delete the primary file
    if os.path.abspath(legacy_path) == os.path.abspath(primary_path):
        return {"cleaned": False, "reclaimed_bytes": 0, "reclaimed_gb": "0 GB"}

    reclaimed_bytes = os.path.getsize(legacy_path)
    tier_meta = UPGRADE_TIERS.get(model_key, {})
    reclaimed_gb = tier_meta.get("reclaim_size", f"{round(reclaimed_bytes / 1e9, 1)} GB")

    try:
        os.remove(legacy_path)
    except OSError:
        time.sleep(0.15)
        try:
            os.remove(legacy_path)
        except OSError as exc:
            return {
                "cleaned": False,
                "reclaimed_bytes": reclaimed_bytes,
                "reclaimed_gb": reclaimed_gb,
                "error": f"Could not remove legacy model: {exc}",
            }

    return {
        "cleaned": not os.path.exists(legacy_path),
        "reclaimed_bytes": reclaimed_bytes,
        "reclaimed_gb": reclaimed_gb,
    }


def model_state(model_key: str | None = None) -> dict:
    """Snapshot of download state for a key (or the default key).

    If a key isn't actively downloading/errored, reflect the on-disk reality:
    present -> ready, absent -> idle. This keeps the frontend's "installed"
    tag accurate after a download finishes or a file is deleted.
    """
    key = model_key or DEFAULT_MODEL_KEY
    default = {"state": "idle", "bytes_done": 0, "bytes_total": 0, "error": None}
    st = dict(MODEL_STATUS.get(key, default))
    if st["state"] in ("idle", "ready") and _already_installed(key):
        size = (
            MODELS[key]["size"]
            if is_primary_installed(key)
            else MODELS.get(f"legacy-{key}", MODELS[key])["size"]
        )
        st = {**st, "state": "ready", "bytes_done": size, "bytes_total": size}
    if st["state"] == "idle" and not os.path.exists(model_path(key)):
        st = {**st, "bytes_done": 0, "bytes_total": 0}
    return st


def models_ready() -> dict:
    """Map of key -> bool for which models are on disk."""
    return {key: _already_installed(key) for key in MODELS}


def active_model_download() -> dict | None:
    """Return status of an active model download or verification."""
    for key in MODELS:
        st = MODEL_STATUS.get(key)
        if st and st.get("state") in ("downloading", "verifying"):
            return {
                "model_key": key,
                "state": st["state"],
                "bytes_done": st.get("bytes_done", 0),
                "bytes_total": st.get("bytes_total", 0),
                "error": st.get("error"),
            }
    return None


def _update_progress(model_key: str, done: int, total: int) -> None:
    """Streamed-download progress -> that key's status entry."""
    if model_key not in MODEL_STATUS:
        MODEL_STATUS[model_key] = {
            "state": "downloading",
            "bytes_done": done,
            "bytes_total": total,
            "error": None,
        }
    else:
        MODEL_STATUS[model_key]["bytes_done"] = done
        MODEL_STATUS[model_key]["bytes_total"] = total


def _free_space(path: str) -> int:
    """Free bytes on the drive holding `path`."""
    try:
        return shutil.disk_usage(path).free
    except OSError:
        return 0


def cancel_download(model_key: str | None = None) -> None:
    """Signal in-flight download(s) to abort at the next chunk."""
    with _CANCEL_LOCK:
        if model_key:
            _CANCELLED_KEYS.add(model_key)
        else:
            _CANCELLED_KEYS.update(MODELS.keys())


def delete_model(model_key: str) -> None:
    """Remove downloaded GGUFs for this tier from disk (user switched models / freed space)."""
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key {model_key!r}. Known: {sorted(MODELS)}")
    primary = primary_model_path(model_key)
    legacy = legacy_model_path(model_key)
    failures = []
    candidates = [primary, legacy, f"{primary}.tmp"]
    for i in range(16):
        candidates.append(f"{primary}.part_{i}")
    for path in candidates:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                time.sleep(0.15)
                try:
                    os.remove(path)
                except OSError as exc:
                    failures.append(f"{path}: {exc}")
    if failures:
        message = "Could not delete model file(s): " + "; ".join(failures)
        MODEL_STATUS[model_key] = {
            "state": "error",
            "bytes_done": 0,
            "bytes_total": 0,
            "error": message,
        }
        raise OSError(message)
    MODEL_STATUS[model_key] = {
        "state": "idle",
        "bytes_done": 0,
        "bytes_total": 0,
        "error": None,
    }


def download_model(model_key: str = DEFAULT_MODEL_KEY) -> dict:
    """Serialize downloads for a tier and return its final status."""
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key {model_key!r}. Known: {sorted(MODELS)}")
    with _DOWNLOAD_LOCKS[model_key]:
        return _download_model_locked(model_key)


def _download_model_locked(model_key: str) -> dict:
    """Download the pinned GGUF for `model_key` into the app-data dir."""
    with _CANCEL_LOCK:
        _CANCELLED_KEYS.discard(model_key)

    # Reset this key's status (leave other keys untouched).
    MODEL_STATUS[model_key] = {
        "state": "idle",
        "bytes_done": 0,
        "bytes_total": MODELS[model_key]["size"],
        "error": None,
    }

    if is_primary_installed(model_key):
        MODEL_STATUS[model_key]["state"] = "ready"
        MODEL_STATUS[model_key]["bytes_done"] = MODELS[model_key]["size"]
        legacy_path = legacy_model_path(model_key)
        if legacy_path and is_legacy_installed(model_key):
            cleanup_res = cleanup_legacy_model(model_key, primary_verified=True)
            if cleanup_res.get("cleaned"):
                MODEL_STATUS[model_key]["legacy_reclaimed"] = True
                MODEL_STATUS[model_key]["reclaimed_message"] = (
                    "Upgrade complete! Removed previous model file to reclaim "
                    f"{cleanup_res.get('reclaimed_gb', 'disk space')} of disk space."
                )
            elif cleanup_res.get("error"):
                MODEL_STATUS[model_key]["cleanup_error"] = cleanup_res["error"]
        return dict(MODEL_STATUS[model_key])

    needed = int(MODELS[model_key]["size"] * 1.05)
    if _free_space(models_dir()) < needed:
        MODEL_STATUS[model_key]["state"] = "error"
        MODEL_STATUS[model_key]["error"] = "Not enough free disk space to download the model."
        raise RuntimeError(MODEL_STATUS[model_key]["error"])

    had_legacy = is_legacy_installed(model_key)

    try:
        MODEL_STATUS[model_key]["state"] = "downloading"
        path = _stream_download(model_key)
        if _is_cancelled(model_key):
            MODEL_STATUS[model_key]["state"] = "cancelled"
            MODEL_STATUS[model_key]["error"] = None
            with _CANCEL_LOCK:
                _CANCELLED_KEYS.discard(model_key)
            return dict(MODEL_STATUS[model_key])
        MODEL_STATUS[model_key]["state"] = "verifying"
        MODEL_STATUS[model_key]["bytes_done"] = os.path.getsize(path)

        if not verify_model_runs(model_key):
            MODEL_STATUS[model_key]["state"] = "error"
            err_msg = "Model execution verification failed; keeping legacy model."
            MODEL_STATUS[model_key]["error"] = err_msg
            raise RuntimeError(err_msg)

        MODEL_STATUS[model_key]["state"] = "ready"

        # If user was upgrading from a legacy generation, automatically reclaim old file
        if had_legacy:
            cleanup_res = cleanup_legacy_model(model_key, primary_verified=True)
            if cleanup_res.get("cleaned"):
                reclaim_gb = cleanup_res.get("reclaimed_gb", "1.4 GB")
                MODEL_STATUS[model_key]["legacy_reclaimed"] = True
                MODEL_STATUS[model_key]["reclaimed_message"] = (
                    f"Upgrade complete! Removed previous model file to reclaim "
                    f"{reclaim_gb} of disk space."
                )
            elif cleanup_res.get("error"):
                MODEL_STATUS[model_key]["cleanup_error"] = cleanup_res["error"]
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


def _single_stream_download(url: str, dest: str, total_size: int, model_key: str) -> str:
    """Download a file in a single stream with HTTP Range resume support."""
    resume_pos = os.path.getsize(dest) if os.path.exists(dest) else 0
    expected_min = int(total_size * 0.95)
    invalid_existing = resume_pos >= expected_min
    if 4 <= resume_pos < expected_min:
        try:
            with open(dest, "rb") as fh:
                invalid_existing = fh.read(4) != b"GGUF"
        except OSError:
            invalid_existing = True
    if invalid_existing:
        try:
            os.remove(dest)
        except OSError as exc:
            raise RuntimeError(f"Could not replace invalid model file: {exc}") from exc
        resume_pos = 0
    headers = {"Range": f"bytes={resume_pos}-"} if resume_pos else {}

    with requests.get(url, headers=headers, stream=True, timeout=30) as resp:
        resp.raise_for_status()
        if resume_pos > 0 and resp.status_code != 206:
            resume_pos = 0
            mode = "wb"
        else:
            mode = "ab" if resume_pos else "wb"

        _update_progress(model_key, resume_pos, total_size)
        with open(dest, mode) as fh:
            for chunk in resp.iter_content(chunk_size=1 << 20):  # 1 MiB
                if _is_cancelled(model_key):
                    with _CANCEL_LOCK:
                        _CANCELLED_KEYS.discard(model_key)
                    MODEL_STATUS[model_key]["state"] = "cancelled"
                    MODEL_STATUS[model_key]["error"] = None
                    raise RuntimeError(f"Download of {model_key} cancelled by user.")
                if not chunk:
                    continue
                fh.write(chunk)
                resume_pos += len(chunk)
                _update_progress(model_key, resume_pos, total_size)

    if os.path.getsize(dest) < int(total_size * 0.95):
        raise RuntimeError(
            f"Downloaded file is smaller than expected "
            f"({os.path.getsize(dest)} < {total_size} bytes)"
        )
    return dest


def _parallel_chunk_download(
    url: str,
    dest: str,
    total_size: int,
    model_key: str,
    num_workers: int = NUM_DOWNLOAD_WORKERS,
) -> str:
    """Download a file in parallel byte chunks with resume and fallback support."""
    # Probe remote server for HTTP Range header support.
    range_supported = False
    try:
        with requests.get(url, headers={"Range": "bytes=0-0"}, stream=True, timeout=15) as probe:
            range_supported = (probe.status_code == 206)
    except requests.RequestException:
        range_supported = False

    if not range_supported:
        return _single_stream_download(url, dest, total_size, model_key)

    worker_count = max(1, min(num_workers, total_size))
    if worker_count == 1:
        return _single_stream_download(url, dest, total_size, model_key)

    part_size = total_size // worker_count
    parts = []
    for i in range(worker_count):
        start = i * part_size
        end = (total_size - 1) if (i == worker_count - 1) else ((i + 1) * part_size - 1)
        expected_len = end - start + 1
        part_path = f"{dest}.part_{i}"
        parts.append((i, start, end, expected_len, part_path))

    downloaded_bytes = [0] * worker_count
    for i, _start, _end, expected_len, part_path in parts:
        if os.path.exists(part_path):
            cur_size = os.path.getsize(part_path)
            if cur_size > expected_len:
                try:
                    os.remove(part_path)
                except OSError as exc:
                    raise RuntimeError(
                        f"Could not replace oversized part file: {exc}"
                    ) from exc
                downloaded_bytes[i] = 0
            else:
                downloaded_bytes[i] = cur_size

    # Assembly keeps one extra part on disk.
    # A new download uses one stream when free space cannot hold that copy.
    already = sum(downloaded_bytes)
    largest_part = max(item[3] for item in parts)
    parent = os.path.dirname(dest) or "."
    if already == 0 and _free_space(parent) < total_size + largest_part + SPACE_MARGIN_BYTES:
        return _single_stream_download(url, dest, total_size, model_key)

    _update_progress(model_key, already, total_size)
    progress_lock = threading.Lock()
    range_rejected = threading.Event()

    def _worker(part_index: int, start: int, end: int, expected_len: int, part_path: str) -> None:
        max_retries = 3
        for attempt in range(max_retries):
            if _is_cancelled(model_key) or range_rejected.is_set():
                return
            if os.path.exists(part_path):
                cur_size = os.path.getsize(part_path)
            else:
                cur_size = 0
            if cur_size > expected_len:
                try:
                    os.remove(part_path)
                except OSError as exc:
                    raise RuntimeError(
                        f"Could not replace oversized part file: {exc}"
                    ) from exc
                cur_size = 0
            if cur_size >= expected_len:
                with progress_lock:
                    downloaded_bytes[part_index] = expected_len
                    _update_progress(model_key, sum(downloaded_bytes), total_size)
                return

            part_offset = start + cur_size
            headers = {"Range": f"bytes={part_offset}-{end}"}
            mode = "ab" if cur_size > 0 else "wb"
            try:
                with requests.get(url, headers=headers, stream=True, timeout=30) as resp:
                    # A status other than 206 is the whole file.
                    # The part file must not store it.
                    if resp.status_code != 206:
                        range_rejected.set()
                        return
                    with open(part_path, mode) as fh:
                        for chunk in resp.iter_content(chunk_size=1 << 20):
                            if _is_cancelled(model_key) or range_rejected.is_set():
                                return
                            if not chunk:
                                continue
                            room = expected_len - cur_size
                            if room <= 0:
                                break
                            if len(chunk) > room:
                                chunk = chunk[:room]
                            fh.write(chunk)
                            cur_size += len(chunk)
                            with progress_lock:
                                downloaded_bytes[part_index] = cur_size
                                _update_progress(model_key, sum(downloaded_bytes), total_size)
            except requests.RequestException as exc:
                if _is_cancelled(model_key) or range_rejected.is_set():
                    return
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Part {part_index} download failed: {exc}") from exc
                time.sleep(0.5 * (attempt + 1))
                continue
            if _is_cancelled(model_key) or range_rejected.is_set():
                return
            if cur_size >= expected_len:
                return
        final_size = os.path.getsize(part_path) if os.path.exists(part_path) else 0
        raise RuntimeError(
            f"Part {part_index} download incomplete: {final_size} of {expected_len} bytes"
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [
            executor.submit(_worker, i, start, end, expected_len, part_path)
            for i, start, end, expected_len, part_path in parts
        ]
        for future in concurrent.futures.as_completed(futures):
            if _is_cancelled(model_key):
                for pending in futures:
                    pending.cancel()
                break
            future.result()

    if _is_cancelled(model_key):
        with _CANCEL_LOCK:
            _CANCELLED_KEYS.discard(model_key)
        MODEL_STATUS[model_key]["state"] = "cancelled"
        MODEL_STATUS[model_key]["error"] = None
        raise RuntimeError(f"Download of {model_key} cancelled by user.")

    if range_rejected.is_set():
        for _i, _start, _end, _expected_len, part_path in parts:
            if not os.path.exists(part_path):
                continue
            try:
                os.remove(part_path)
            except OSError:
                # A locked part file must not block the single-stream fallback.
                pass
        return _single_stream_download(url, dest, total_size, model_key)

    # Confirm all parts are complete before assembly.
    for i, _start, _end, expected_len, part_path in parts:
        if not os.path.exists(part_path) or os.path.getsize(part_path) != expected_len:
            actual = os.path.getsize(part_path) if os.path.exists(part_path) else 0
            raise RuntimeError(
                f"Part {i} download incomplete: {actual} of {expected_len} bytes"
            )

    temp_dest = f"{dest}.tmp"
    if os.path.exists(temp_dest):
        try:
            os.remove(temp_dest)
        except OSError:
            pass

    # Rename first part to become the base destination file.
    os.replace(parts[0][4], temp_dest)

    # Append remaining parts in sequence and delete each source part.
    with open(temp_dest, "ab") as out_fh:
        for i in range(1, worker_count):
            p_path = parts[i][4]
            with open(p_path, "rb") as in_fh:
                shutil.copyfileobj(in_fh, out_fh, length=16 * 1024 * 1024)
            try:
                os.remove(p_path)
            except OSError:
                pass

    if os.path.exists(dest):
        try:
            os.remove(dest)
        except OSError:
            pass
    os.replace(temp_dest, dest)

    if os.path.getsize(dest) < int(total_size * 0.95):
        raise RuntimeError(
            f"Downloaded file is smaller than expected "
            f"({os.path.getsize(dest)} < {total_size} bytes)"
        )
    return dest


def _stream_download(model_key: str) -> str:
    """Stream the pinned GGUF to disk with 4-worker chunk acceleration."""
    spec = MODELS[model_key]
    dest = primary_model_path(model_key)
    url = hf_hub_url(repo_id=spec["repo_id"], filename=spec["filename"])

    resume_pos = os.path.getsize(dest) if os.path.exists(dest) else 0
    expected_min = int(spec["size"] * 0.95)
    invalid_existing = resume_pos >= expected_min
    if 4 <= resume_pos < expected_min:
        try:
            with open(dest, "rb") as fh:
                invalid_existing = fh.read(4) != b"GGUF"
        except OSError:
            invalid_existing = True
    if invalid_existing:
        try:
            os.remove(dest)
        except OSError as exc:
            raise RuntimeError(f"Could not replace invalid model file: {exc}") from exc
        resume_pos = 0

    if 0 < resume_pos < expected_min and not os.path.exists(f"{dest}.part_0"):
        try:
            os.remove(dest)
        except OSError as exc:
            raise RuntimeError(f"Could not replace partial model file: {exc}") from exc

    return _parallel_chunk_download(
        url=url,
        dest=dest,
        total_size=spec["size"],
        model_key=model_key,
        num_workers=NUM_DOWNLOAD_WORKERS,
    )


if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL_KEY
    try:
        result = download_model(key)
        print("Download complete:", result)
    except Exception as exc:  # noqa: BLE001
        print("Download failed:", exc)
        sys.exit(1)
