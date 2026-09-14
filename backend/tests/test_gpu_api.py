import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_ai_gpu_packages_get(client):
    mock_diag = {
        "accelerators": {"dedicated": [], "integrated": [], "npu": []},
        "gpu": {
            "name": "NVIDIA GeForce RTX 4070 SUPER",
            "vendor": "NVIDIA",
            "backend": "CUDA",
            "cuda_available": False,
            "engine_supported": False,
            "offload_supported": False,
        },
    }
    with patch("main.get_hardware_diagnostics", return_value=mock_diag):
        with patch("gpu_manager.get_available_packages") as mock_pkgs:
            mock_pkgs.return_value = [
                {"id": "cuda", "name": "CUDA Pack", "installed": False, "recommended": True}
            ]
            resp = client.get("/ai/gpu/packages")
            assert resp.status_code == 200
            data = resp.json()
            assert "packages" in data
            assert len(data["packages"]) == 1
            assert data["packages"][0]["id"] == "cuda"
            assert data["engine_supported"] is False


def test_ai_gpu_packages_install(client):
    with patch("gpu_manager.start_package_download_async") as mock_start:
        mock_start.return_value = {
            "package": "cuda",
            "state": "downloading",
            "bytes_done": 0,
            "bytes_total": 500000000,
            "progress_pct": 0.0,
        }
        resp = client.post("/ai/gpu/packages/install", json={"package": "cuda"})
        assert resp.status_code == 200
        assert resp.json()["state"] == "downloading"
        mock_start.assert_called_once_with("cuda")


def test_ai_gpu_packages_cancel(client):
    with patch("gpu_manager.cancel_package_download") as mock_cancel:
        mock_cancel.return_value = {"package": "cuda", "state": "cancelled"}
        resp = client.post("/ai/gpu/packages/cancel", json={"package": "cuda"})
        assert resp.status_code == 200
        assert resp.json()["state"] == "cancelled"
        mock_cancel.assert_called_once_with("cuda")


def test_ai_gpu_packages_uninstall(client):
    with patch("gpu_manager.uninstall_package", return_value=True) as mock_uninst:
        with patch("main.reload_bundled_engine") as mock_reload:
            resp = client.post("/ai/gpu/packages/uninstall", json={"package": "cuda"})
            assert resp.status_code == 200
            assert resp.json()["success"] is True
            mock_uninst.assert_called_once_with("cuda")
            mock_reload.assert_called_once()


def test_ai_gpu_packages_activate(client):
    with patch("gpu_manager.set_preferred_backend") as mock_pref:
        with patch("gpu_manager.configure_engine_library_path") as mock_conf:
            with patch("main.reload_bundled_engine") as mock_reload:
                resp = client.post("/ai/gpu/packages/activate", json={"package": "vulkan"})
                assert resp.status_code == 200
                assert resp.json()["active_package"] == "vulkan"
                mock_pref.assert_called_once_with("vulkan")
                mock_conf.assert_called_once()
                mock_reload.assert_called_once()

