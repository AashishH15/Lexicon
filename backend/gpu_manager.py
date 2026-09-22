import os
import platform
import shutil
import sys
import threading
import time
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

# Pinned releases from abetlen/llama-cpp-python matching the bundled engine version.
PACKAGE_REGISTRY = {
    "cuda": {
        "id": "cuda",
        "name": "NVIDIA CUDA 12.4 Acceleration Pack",
        "backend": "CUDA",
        "vendor": "NVIDIA",
        "version": "0.3.34-cu124",
        "download_size_bytes": 536551897,
        "extracted_size_bytes": 1717986918,  # ~1.6 GB uncompressed
        "url": (
            "https://github.com/abetlen/llama-cpp-python/releases/download/"
            "v0.3.34-cu124/llama_cpp_python-0.3.34-py3-none-win_amd64.whl"
        ),
        "required_dlls": [
            "llama.dll" if sys.platform == "win32" else "libllama.so",
            "ggml-cuda.dll" if sys.platform == "win32" else "libggml-cuda.so",
        ],
        "description": "Enables Tensor Core and fast VRAM offload on NVIDIA GeForce / RTX GPUs.",
    },
    "vulkan": {
        "id": "vulkan",
        "name": "Vulkan GPU Acceleration Pack",
        "backend": "Vulkan",
        "vendor": "AMD/Intel",
        "version": "0.3.34-vulkan",
        "download_size_bytes": 42323234,
        "extracted_size_bytes": 104857600,  # ~100 MB uncompressed
        "url": (
            "https://github.com/abetlen/llama-cpp-python/releases/download/"
            "v0.3.34-vulkan/llama_cpp_python-0.3.34-py3-none-win_amd64.whl"
        ),
        "required_dlls": [
            "llama.dll" if sys.platform == "win32" else "libllama.so",
            "ggml-vulkan.dll" if sys.platform == "win32" else "libggml-vulkan.so",
        ],
        "description": (
            "Enables cross-vendor GPU acceleration (Vulkan 1.3+) on AMD Radeon, "
            "Intel Arc, and integrated GPUs."
        ),
    },
}

_DOWNLOAD_LOCKS = defaultdict(threading.Lock)
_CANCEL_LOCK = threading.Lock()
_CANCELLED_PACKAGES: set[str] = set()

PACKAGE_STATUS: dict[str, dict] = {}


def get_backends_dir() -> Path:
    """Return the base path where downloaded accelerator packages reside."""
    override = os.environ.get("LEXICON_BACKENDS_DIR")
    if override:
        path = Path(override)
        path.mkdir(parents=True, exist_ok=True)
        return path

    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA")
        base = Path(local_app_data) if local_app_data else (Path.home() / "AppData" / "Local")
        path = base / "Lexicon" / "backends"
    elif sys.platform == "darwin":
        path = Path.home() / "Library" / "Application Support" / "Lexicon" / "backends"
    else:
        path = Path.home() / ".local" / "share" / "Lexicon" / "backends"

    path.mkdir(parents=True, exist_ok=True)
    return path


def is_package_installed(package_id: str) -> bool:
    """Verify all required binaries exist inside the package target directory."""
    spec = PACKAGE_REGISTRY.get(package_id)
    if not spec:
        return False

    pkg_dir = get_backends_dir() / package_id
    if not pkg_dir.is_dir():
        return False

    required = spec.get("required_dlls", [])
    for dll in required:
        if not (pkg_dir / dll).exists():
            return False
    return True


_PREFERRED_BACKEND: str | None = None


def get_preferred_backend() -> str | None:
    """Return user-selected runtime override, if configured."""
    return _PREFERRED_BACKEND


def set_preferred_backend(backend: str | None) -> None:
    """Set user-selected runtime override."""
    global _PREFERRED_BACKEND
    if backend:
        backend = backend.lower()
        if backend not in ("cuda", "vulkan", "cpu"):
            raise ValueError(f"Invalid backend {backend!r}")
    _PREFERRED_BACKEND = backend


def resolve_best_backend_path(has_nvidia: bool = False) -> Path | None:
    """Select the highest priority installed accelerator package.

    If the user explicitly selected a runtime, that choice takes priority.
    Otherwise, CUDA has precedence on NVIDIA hardware because cuBLAS yields
    higher throughput than generic Vulkan compute pipelines.
    """
    pref = get_preferred_backend()
    if pref == "cpu":
        return None
    if pref == "cuda" and is_package_installed("cuda"):
        return get_backends_dir() / "cuda"
    if pref == "vulkan" and is_package_installed("vulkan"):
        return get_backends_dir() / "vulkan"

    if has_nvidia and is_package_installed("cuda"):
        return get_backends_dir() / "cuda"

    if is_package_installed("vulkan"):
        return get_backends_dir() / "vulkan"

    return None


def configure_engine_library_path(has_nvidia: bool = False) -> Path | None:
    """Point llama_cpp to the chosen modular backend folder before import."""
    best_path = resolve_best_backend_path(has_nvidia=has_nvidia)
    if best_path:
        os.environ["LLAMA_CPP_LIB_PATH"] = str(best_path)
        if sys.platform == "win32":
            try:
                os.add_dll_directory(str(best_path))
            except Exception:
                pass
            os.environ["PATH"] = str(best_path) + os.pathsep + os.environ.get("PATH", "")
    return best_path


def get_available_packages(accelerators: dict, nv_info: dict) -> list[dict]:
    """List accelerator packs that can be installed on current machine."""
    # macOS Apple Silicon uses system-level Metal with zero external downloads.
    if sys.platform == "darwin" and platform.machine().lower() in ("arm64", "aarch64"):
        return []

    results = []
    has_nvidia = bool(nv_info.get("cuda_available") and nv_info.get("name"))
    if not has_nvidia:
        for d in accelerators.get("dedicated", []):
            if d.get("vendor") == "NVIDIA":
                has_nvidia = True
                break

    has_amd_or_intel = False
    for group in ("dedicated", "integrated"):
        for dev in accelerators.get(group, []):
            if dev.get("vendor") in ("AMD", "Intel"):
                has_amd_or_intel = True
                break

    if has_nvidia:
        cuda_status = get_package_status("cuda")
        results.append({
            **PACKAGE_REGISTRY["cuda"],
            "installed": is_package_installed("cuda"),
            "recommended": True,
            "status": cuda_status,
        })
        vulkan_status = get_package_status("vulkan")
        results.append({
            **PACKAGE_REGISTRY["vulkan"],
            "installed": is_package_installed("vulkan"),
            "recommended": False,
            "status": vulkan_status,
        })
    elif has_amd_or_intel:
        vulkan_status = get_package_status("vulkan")
        results.append({
            **PACKAGE_REGISTRY["vulkan"],
            "installed": is_package_installed("vulkan"),
            "recommended": True,
            "status": vulkan_status,
        })

    return results


def get_package_status(package_id: str) -> dict:
    """Return progress and operational state of a given package."""
    spec = PACKAGE_REGISTRY.get(package_id, {})
    total_bytes = spec.get("download_size_bytes", 0)

    if package_id not in PACKAGE_STATUS:
        installed = is_package_installed(package_id)
        PACKAGE_STATUS[package_id] = {
            "package": package_id,
            "state": "ready" if installed else "idle",
            "bytes_done": total_bytes if installed else 0,
            "bytes_total": total_bytes,
            "progress_pct": 100.0 if installed else 0.0,
            "speed_mbps": 0.0,
            "error": None,
        }
    return dict(PACKAGE_STATUS[package_id])


def _is_cancelled(package_id: str) -> bool:
    with _CANCEL_LOCK:
        return package_id in _CANCELLED_PACKAGES


def reset_cancellation(package_id: str) -> None:
    with _CANCEL_LOCK:
        _CANCELLED_PACKAGES.discard(package_id)


def cancel_package_download(package_id: str) -> dict:
    with _CANCEL_LOCK:
        _CANCELLED_PACKAGES.add(package_id)
    status = get_package_status(package_id)
    status["state"] = "cancelled"
    PACKAGE_STATUS[package_id] = status
    return status


def _extract_whl_libraries(archive_path: Path, destination_dir: Path) -> int:
    """Extract only library files under llama_cpp/lib/ into destination folder.

    We discard unrelated Python bytecode and metadata to prevent polluting
    the runtime directory and save disk space.
    """
    destination_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    with zipfile.ZipFile(archive_path, "r") as zf:
        for item in zf.infolist():
            if item.is_dir():
                continue
            name = item.filename.replace("\\", "/")
            if "llama_cpp/lib/" in name:
                leaf_name = Path(name).name
                target_file = destination_dir / leaf_name
                with zf.open(item) as src, open(target_file, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                count += 1
    return count


def _free_disk_bytes(target_dir: Path) -> int:
    try:
        usage = shutil.disk_usage(target_dir)
        return usage.free
    except Exception:
        return 10 * 1024 * 1024 * 1024


def download_and_install_package(package_id: str) -> dict:
    """Stream download wheel archive and extract shared libraries synchronously."""
    spec = PACKAGE_REGISTRY.get(package_id)
    if not spec:
        raise ValueError(f"Unknown package {package_id!r}")

    with _DOWNLOAD_LOCKS[package_id]:
        reset_cancellation(package_id)
        pkg_dir = get_backends_dir() / package_id
        temp_dir = get_backends_dir() / f".tmp_{package_id}"

        total_bytes = spec["download_size_bytes"]
        extracted_needed = spec.get("extracted_size_bytes", total_bytes * 2)

        if _free_disk_bytes(get_backends_dir()) < (total_bytes + extracted_needed):
            PACKAGE_STATUS[package_id] = {
                "package": package_id,
                "state": "error",
                "bytes_done": 0,
                "bytes_total": total_bytes,
                "progress_pct": 0.0,
                "speed_mbps": 0.0,
                "error": "Insufficient disk space for GPU acceleration package.",
            }
            return dict(PACKAGE_STATUS[package_id])

        PACKAGE_STATUS[package_id] = {
            "package": package_id,
            "state": "downloading",
            "bytes_done": 0,
            "bytes_total": total_bytes,
            "progress_pct": 0.0,
            "speed_mbps": 0.0,
            "error": None,
        }

        temp_dir.mkdir(parents=True, exist_ok=True)
        part_archive = temp_dir / f"{package_id}.whl"

        try:
            req = urllib.request.Request(spec["url"], headers={"User-Agent": "Lexicon/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                actual_total = int(resp.headers.get("Content-Length", total_bytes))
                PACKAGE_STATUS[package_id]["bytes_total"] = actual_total

                downloaded = 0
                chunk_size = 512 * 1024
                start_time = time.time()
                last_time = start_time
                bytes_since_last = 0

                with open(part_archive, "wb") as out_f:
                    while True:
                        if _is_cancelled(package_id):
                            PACKAGE_STATUS[package_id]["state"] = "cancelled"
                            break

                        chunk = resp.read(chunk_size)
                        if not chunk:
                            break

                        out_f.write(chunk)
                        downloaded += len(chunk)
                        bytes_since_last += len(chunk)

                        now = time.time()
                        time_delta = now - last_time
                        if time_delta >= 0.2:
                            speed = (bytes_since_last / (1024 * 1024)) / time_delta
                            pct = round((downloaded / actual_total) * 100, 1)
                            PACKAGE_STATUS[package_id]["bytes_done"] = downloaded
                            PACKAGE_STATUS[package_id]["progress_pct"] = min(99.0, pct)
                            PACKAGE_STATUS[package_id]["speed_mbps"] = round(speed * 8, 2)
                            last_time = now
                            bytes_since_last = 0

            if _is_cancelled(package_id):
                shutil.rmtree(temp_dir, ignore_errors=True)
                PACKAGE_STATUS[package_id]["state"] = "cancelled"
                return dict(PACKAGE_STATUS[package_id])

            PACKAGE_STATUS[package_id]["state"] = "extracting"
            PACKAGE_STATUS[package_id]["progress_pct"] = 99.0

            # Extract library files directly into package target directory
            pkg_dir.mkdir(parents=True, exist_ok=True)
            _extract_whl_libraries(part_archive, pkg_dir)
            shutil.rmtree(temp_dir, ignore_errors=True)

            set_preferred_backend(package_id)

            PACKAGE_STATUS[package_id]["state"] = "ready"
            PACKAGE_STATUS[package_id]["bytes_done"] = actual_total
            PACKAGE_STATUS[package_id]["progress_pct"] = 100.0
            PACKAGE_STATUS[package_id]["speed_mbps"] = 0.0

            # Update environment to prioritize the newly installed package
            configure_engine_library_path(has_nvidia=(package_id == "cuda"))

        except Exception as exc:
            shutil.rmtree(temp_dir, ignore_errors=True)
            if _is_cancelled(package_id):
                PACKAGE_STATUS[package_id]["state"] = "cancelled"
                return dict(PACKAGE_STATUS[package_id])
            PACKAGE_STATUS[package_id]["state"] = "error"
            PACKAGE_STATUS[package_id]["error"] = str(exc)

        return dict(PACKAGE_STATUS[package_id])


def start_package_download_async(package_id: str) -> dict:
    """Initiate package installation in a background thread."""
    status = get_package_status(package_id)
    if status.get("state") in ("downloading", "extracting"):
        return status

    total_bytes = PACKAGE_REGISTRY.get(package_id, {}).get("download_size_bytes", 0)
    PACKAGE_STATUS[package_id] = {
        "package": package_id,
        "state": "downloading",
        "bytes_done": 0,
        "bytes_total": total_bytes,
        "progress_pct": 1.0,
        "speed_mbps": 0.0,
        "error": None,
    }

    thread = threading.Thread(
        target=download_and_install_package,
        args=(package_id,),
        daemon=True,
        name=f"GpuPackageWorker-{package_id}",
    )
    thread.start()
    return dict(PACKAGE_STATUS[package_id])


def _cleanup_trash_directories(base_dir: Path) -> None:
    """Remove lingering trash directories after file locks clear."""
    try:
        for item in base_dir.glob(".trash_*"):
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
    except Exception:
        pass


def uninstall_package(package_id: str) -> bool:
    """Delete package directory and reset active path."""
    pkg_dir = get_backends_dir() / package_id
    if pkg_dir.exists():
        try:
            shutil.rmtree(pkg_dir)
        except Exception:
            # On Windows, locked binaries cannot be deleted while loaded.
            # We rename the directory to a hidden trash folder so detection
            # immediately reports False, then attempt background removal.
            trash_dir = get_backends_dir() / f".trash_{package_id}_{int(time.time())}"
            try:
                if trash_dir.exists():
                    shutil.rmtree(trash_dir, ignore_errors=True)
                pkg_dir.rename(trash_dir)
                shutil.rmtree(trash_dir, ignore_errors=True)
            except Exception:
                shutil.rmtree(pkg_dir, ignore_errors=True)

    _cleanup_trash_directories(get_backends_dir())

    curr_pref = get_preferred_backend()
    if curr_pref == package_id:
        set_preferred_backend(None)

    PACKAGE_STATUS[package_id] = {
        "package": package_id,
        "state": "idle",
        "bytes_done": 0,
        "bytes_total": PACKAGE_REGISTRY.get(package_id, {}).get("download_size_bytes", 0),
        "progress_pct": 0.0,
        "speed_mbps": 0.0,
        "error": None,
    }
    return not pkg_dir.exists()
