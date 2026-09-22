import io
import os
import shutil
import sys
import zipfile
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import gpu_manager  # noqa: E402


def create_dummy_whl_bytes(files: dict[str, bytes]) -> bytes:
    """Helper to create an in-memory zip/whl archive for testing."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for arcname, content in files.items():
            zf.writestr(arcname, content)
    return buf.getvalue()


def test_get_backends_dir_respects_env_override(tmp_path):
    custom = tmp_path / "custom_backends"
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(custom)}):
        resolved = gpu_manager.get_backends_dir()
        assert resolved == custom
        assert resolved.is_dir()


def test_package_installed_detection(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        assert gpu_manager.is_package_installed("cuda") is False

        cuda_dir = tmp_path / "cuda"
        cuda_dir.mkdir(parents=True, exist_ok=True)
        # Missing required DLLs
        assert gpu_manager.is_package_installed("cuda") is False

        # Create expected DLLs for Windows
        ext = ".dll" if sys.platform == "win32" else ".so"
        (cuda_dir / f"llama{ext}").write_bytes(b"dummy")
        (cuda_dir / f"ggml-cuda{ext}").write_bytes(b"dummy")
        assert gpu_manager.is_package_installed("cuda") is True


def test_resolve_best_backend_path(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        # No packages installed
        assert gpu_manager.resolve_best_backend_path(has_nvidia=True) is None

        ext = ".dll" if sys.platform == "win32" else ".so"

        # Install vulkan
        vulkan_dir = tmp_path / "vulkan"
        vulkan_dir.mkdir(parents=True, exist_ok=True)
        (vulkan_dir / f"llama{ext}").write_bytes(b"dummy")
        (vulkan_dir / f"ggml-vulkan{ext}").write_bytes(b"dummy")

        # For non-NVIDIA or when CUDA not present, Vulkan is best
        assert gpu_manager.resolve_best_backend_path(has_nvidia=False) == vulkan_dir

        # Install CUDA
        cuda_dir = tmp_path / "cuda"
        cuda_dir.mkdir(parents=True, exist_ok=True)
        (cuda_dir / f"llama{ext}").write_bytes(b"dummy")
        (cuda_dir / f"ggml-cuda{ext}").write_bytes(b"dummy")

        # When NVIDIA is present, CUDA takes priority over Vulkan
        assert gpu_manager.resolve_best_backend_path(has_nvidia=True) == cuda_dir
        # For non-NVIDIA, Vulkan is chosen even if CUDA folder exists
        assert gpu_manager.resolve_best_backend_path(has_nvidia=False) == vulkan_dir


def test_configure_engine_library_path(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        ext = ".dll" if sys.platform == "win32" else ".so"
        cuda_dir = tmp_path / "cuda"
        cuda_dir.mkdir(parents=True, exist_ok=True)
        (cuda_dir / f"llama{ext}").write_bytes(b"dummy")
        (cuda_dir / f"ggml-cuda{ext}").write_bytes(b"dummy")

        with patch.dict(os.environ, {}, clear=False):
            configured = gpu_manager.configure_engine_library_path(has_nvidia=True)
            assert configured == cuda_dir
            assert os.environ.get("LLAMA_CPP_LIB_PATH") == str(cuda_dir)


def test_get_available_packages_for_hardware():
    # macOS Apple Silicon
    with patch("sys.platform", "darwin"), patch("platform.machine", return_value="arm64"):
        pkgs = gpu_manager.get_available_packages(
            accelerators={"dedicated": [], "integrated": [], "npu": []},
            nv_info={"cuda_available": False, "name": None},
        )
        # Metal is native, no extra package download required
        assert pkgs == []

    # Windows with NVIDIA GPU
    with patch("sys.platform", "win32"), patch("platform.machine", return_value="AMD64"):
        pkgs = gpu_manager.get_available_packages(
            accelerators={
                "dedicated": [{"name": "NVIDIA GeForce RTX 4070", "vendor": "NVIDIA"}],
                "integrated": [],
                "npu": [],
            },
            nv_info={"cuda_available": True, "name": "NVIDIA GeForce RTX 4070"},
        )
        pkg_ids = [p["id"] for p in pkgs]
        assert "cuda" in pkg_ids
        assert "vulkan" in pkg_ids
        cuda_pkg = next(p for p in pkgs if p["id"] == "cuda")
        assert cuda_pkg["recommended"] is True

    # Windows with AMD GPU only
    with patch("sys.platform", "win32"), patch("platform.machine", return_value="AMD64"):
        pkgs = gpu_manager.get_available_packages(
            accelerators={
                "dedicated": [{"name": "AMD Radeon RX 7800 XT", "vendor": "AMD"}],
                "integrated": [],
                "npu": [],
            },
            nv_info={"cuda_available": False, "name": None},
        )
        pkg_ids = [p["id"] for p in pkgs]
        assert "vulkan" in pkg_ids
        assert "cuda" not in pkg_ids
        vulkan_pkg = next(p for p in pkgs if p["id"] == "vulkan")
        assert vulkan_pkg["recommended"] is True


def test_extract_whl_libraries(tmp_path):
    dest = tmp_path / "extracted"
    dest.mkdir()

    whl_content = create_dummy_whl_bytes({
        "llama_cpp/lib/llama.dll": b"llama binary",
        "llama_cpp/lib/ggml-cuda.dll": b"cuda binary",
        "llama_cpp/lib/cublas64_12.dll": b"cublas binary",
        "llama_cpp/__init__.py": b"# init",
        "llama_cpp-0.3.34.dist-info/METADATA": b"metadata",
    })

    archive_path = tmp_path / "test.whl"
    archive_path.write_bytes(whl_content)

    extracted_count = gpu_manager._extract_whl_libraries(archive_path, dest)
    assert extracted_count == 3
    assert (dest / "llama.dll").read_bytes() == b"llama binary"
    assert (dest / "ggml-cuda.dll").read_bytes() == b"cuda binary"
    assert (dest / "cublas64_12.dll").read_bytes() == b"cublas binary"
    assert not (dest / "__init__.py").exists()


def test_download_package_cancellation(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        gpu_manager.cancel_package_download("cuda")
        # Trigger cancelled state
        gpu_manager._CANCELLED_PACKAGES.add("cuda")
        assert gpu_manager._is_cancelled("cuda") is True

        gpu_manager.reset_cancellation("cuda")
        assert gpu_manager._is_cancelled("cuda") is False


def test_uninstall_package(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        target = tmp_path / "cuda"
        target.mkdir(parents=True, exist_ok=True)
        ext = ".dll" if sys.platform == "win32" else ".so"
        (target / f"llama{ext}").write_bytes(b"dummy")
        (target / f"ggml-cuda{ext}").write_bytes(b"dummy")

        assert gpu_manager.is_package_installed("cuda") is True
        result = gpu_manager.uninstall_package("cuda")
        assert result is True
        assert not target.exists()
        assert gpu_manager.is_package_installed("cuda") is False


def test_preferred_backend_activation(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        ext = ".dll" if sys.platform == "win32" else ".so"
        cuda_dir = tmp_path / "cuda"
        cuda_dir.mkdir(parents=True, exist_ok=True)
        (cuda_dir / f"llama{ext}").write_bytes(b"dummy")
        (cuda_dir / f"ggml-cuda{ext}").write_bytes(b"dummy")

        vulkan_dir = tmp_path / "vulkan"
        vulkan_dir.mkdir(parents=True, exist_ok=True)
        (vulkan_dir / f"llama{ext}").write_bytes(b"dummy")
        (vulkan_dir / f"ggml-vulkan{ext}").write_bytes(b"dummy")

        # Default on NVIDIA is CUDA
        assert gpu_manager.resolve_best_backend_path(has_nvidia=True) == cuda_dir

        # Switch preferred to Vulkan
        gpu_manager.set_preferred_backend("vulkan")
        assert gpu_manager.resolve_best_backend_path(has_nvidia=True) == vulkan_dir

        # Switch preferred back to CUDA
        gpu_manager.set_preferred_backend("cuda")
        assert gpu_manager.resolve_best_backend_path(has_nvidia=True) == cuda_dir

        # Reset
        gpu_manager.set_preferred_backend(None)


def test_uninstall_package_locked_file_fallback(tmp_path):
    with patch.dict(os.environ, {"LEXICON_BACKENDS_DIR": str(tmp_path)}):
        target = tmp_path / "cuda"
        target.mkdir(parents=True, exist_ok=True)
        ext = ".dll" if sys.platform == "win32" else ".so"
        (target / f"llama{ext}").write_bytes(b"dummy")
        (target / f"ggml-cuda{ext}").write_bytes(b"dummy")

        orig_rmtree = shutil.rmtree
        attempts = 0

        def failing_rmtree(path, *args, **kwargs):
            nonlocal attempts
            attempts += 1
            if str(path) == str(target):
                raise PermissionError("Locked by process")
            return orig_rmtree(path, *args, **kwargs)

        with patch("shutil.rmtree", side_effect=failing_rmtree):
            result = gpu_manager.uninstall_package("cuda")

        assert result is True
        assert not target.exists()
        assert gpu_manager.is_package_installed("cuda") is False


