import os
import sys
import threading
import time
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import model_manager  # noqa: E402
from main import app  # noqa: E402
from model_manager import (  # noqa: E402
    MODELS,
    _already_installed,
    cleanup_legacy_model,
    download_model,
    get_upgrade_info,
    is_legacy_installed,
    is_primary_installed,
    legacy_model_path,
    models_ready,
    primary_model_path,
    verify_model_runs,
)


def create_sized_file(path, size):
    with open(path, "wb") as f:
        f.write(b"GGUF")
        f.truncate(size)


def test_primary_and_legacy_paths(tmp_path):
    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        p_path = primary_model_path("2b")
        l_path = legacy_model_path("2b")
        assert os.path.basename(p_path) == "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
        assert os.path.basename(l_path) == "Qwen_Qwen3.5-2B-Q4_K_M.gguf"


def test_legacy_files_recognized_for_backward_compatibility(tmp_path):
    # Simulate an existing user with legacy 2B model on disk
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_sized_file(legacy_file, int(MODELS["legacy-2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        assert is_legacy_installed("2b") is True
        assert is_primary_installed("2b") is False
        # Crucial for zero disruption: models_ready and _already_installed must be True!
        assert _already_installed("2b") is True
        assert models_ready()["2b"] is True


def test_upgrade_info_detects_available_upgrade(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_sized_file(legacy_file, int(MODELS["legacy-2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        info = get_upgrade_info("2b")
        assert info["upgrade_available"] is True
        assert info["model_key"] == "2b"
        assert info["tier_name"] == "Standard"
        assert info["accuracy_gain"] == "+185%"
        assert info["size_diff"] == "+1.4 GB"
        assert info["reclaim_size"] == "1.4 GB"


def test_upgrade_info_false_when_primary_already_installed(tmp_path):
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    create_sized_file(primary_file, int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        assert is_primary_installed("2b") is True
        info = get_upgrade_info("2b")
        assert info["upgrade_available"] is False


def test_cleanup_legacy_model_removes_only_legacy_file(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    legacy_file.write_bytes(b"dummy-legacy-data")
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    create_sized_file(primary_file, int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)), \
         patch("model_manager.verify_model_runs", return_value=True):
        res = cleanup_legacy_model("2b")
        assert res["cleaned"] is True
        assert res["reclaimed_bytes"] == len(b"dummy-legacy-data")
        assert not os.path.exists(legacy_file)
        assert os.path.exists(primary_file)  # Primary file must NOT be deleted


def test_ai_status_endpoint_exposes_upgrade_metadata(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_sized_file(legacy_file, int(MODELS["legacy-2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        client = TestClient(app)
        resp = client.get("/ai/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["upgrade_available"] is True
        assert data["accuracy_gain"] == "+185%"
        assert data["size_diff"] == "+1.4 GB"
        assert data["upgrade_tier_name"] == "Standard"
        assert data["models_ready"]["2b"] is True  # Zero downtime
        assert "2b" in data["tier_upgrades"]
        assert data["tier_upgrades"]["2b"]["upgrade_available"] is True


def test_ai_preference_endpoint_preserves_quality_tier():
    saved = {
        "backend": "bundled",
        "model_key": "quality",
        "ollama_model": "",
        "lmstudio_model": "",
        "lmstudio_url": "",
        "lmstudio_api_key": "",
    }
    with patch("main.save_prefs", return_value=saved), \
         patch("main.get_backend"):
        client = TestClient(app)
        response = client.post(
            "/ai/preference",
            json={"backend": "bundled", "model_key": "quality"},
        )

    assert response.status_code == 200
    assert response.json()["model_key"] == "quality"


def test_model_cleanup_legacy_endpoint(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    legacy_file.write_bytes(b"data-to-cleanup")
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    with open(primary_file, "wb") as f:
        f.write(b"GGUF")
        f.truncate(int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)), \
         patch("main.verify_model_runs", return_value=True):
        client = TestClient(app)
        resp = client.post("/model/cleanup-legacy", json={"model_key": "2b"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["cleaned"] is True
        assert not os.path.exists(legacy_file)


def test_verify_model_runs_validates_gguf_header(tmp_path):
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    # Create file with GGUF magic header
    with open(primary_file, "wb") as f:
        f.write(b"GGUF")
        f.truncate(int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        # When mocked or if llama_cpp fails to load dummy truncate, test with mock Llama
        with patch("llama_cpp.Llama") as mock_llama:
            instance = mock_llama.return_value
            instance.return_value = {"choices": [{"text": "Hello"}]}
            assert verify_model_runs("2b") is True


def test_verify_model_runs_fails_on_corrupted_header(tmp_path):
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    # Not GGUF magic header
    with open(primary_file, "wb") as f:
        f.write(b"BAD!")
        f.truncate(int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        assert verify_model_runs("2b") is False


def test_download_preserves_legacy_if_verification_fails(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_sized_file(legacy_file, int(MODELS["legacy-2b"]["size"] * 0.95))
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"

    def _fake_stream(key):
        primary_file.write_bytes(b"corrupt")
        return str(primary_file)

    with patch("model_manager.models_dir", return_value=str(tmp_path)), \
         patch("model_manager._stream_download", side_effect=_fake_stream), \
         patch("model_manager.verify_model_runs", return_value=False):
        import pytest
        with pytest.raises(RuntimeError, match="verification failed"):
            download_model("2b")

        # Crucial requirement: legacy model MUST still exist because new model did not verify!
        assert os.path.exists(legacy_file)


def test_cleanup_legacy_requires_primary_verification(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    legacy_file.write_bytes(b"legacy")
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    create_sized_file(primary_file, int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)), \
         patch("model_manager.verify_model_runs", return_value=False):
        result = cleanup_legacy_model("2b")

    assert result["cleaned"] is False
    assert "verification" in result["error"]
    assert legacy_file.exists()


def test_cancelled_model_state_does_not_promote_legacy_to_ready(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_sized_file(legacy_file, int(MODELS["legacy-2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        model_manager.MODEL_STATUS["2b"] = {
            "state": "cancelled",
            "bytes_done": 123,
            "bytes_total": MODELS["2b"]["size"],
            "error": None,
        }
        status = model_manager.model_state("2b")

    assert status["state"] == "cancelled"


def test_downloads_for_one_tier_are_serialized(monkeypatch):
    active = 0
    peak = 0
    guard = threading.Lock()

    def fake_download(key):
        nonlocal active, peak
        with guard:
            active += 1
            peak = max(peak, active)
        time.sleep(0.03)
        with guard:
            active -= 1
        return {"state": "ready", "model_key": key}

    monkeypatch.setattr(model_manager, "_download_model_locked", fake_download)
    results = []

    def run():
        results.append(model_manager.download_model("2b"))

    threads = [threading.Thread(target=run) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=2)

    assert peak == 1
    assert len(results) == 4


def test_delete_model_surfaces_file_removal_failure(tmp_path):
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    primary_file.write_bytes(b"model")

    with patch("model_manager.models_dir", return_value=str(tmp_path)), \
         patch("model_manager.os.remove", side_effect=PermissionError("locked")):
        import pytest

        with pytest.raises(OSError, match="Could not delete"):
            model_manager.delete_model("2b")


def test_model_delete_endpoint_surfaces_file_removal_failure():
    with patch("main.delete_model", side_effect=OSError("locked")):
        client = TestClient(app)
        response = client.post("/model/delete", json={"model_key": "2b"})

    assert response.status_code == 500
    assert response.json()["error"] == "locked"


def test_model_verify_endpoint(tmp_path):
    with patch("main.verify_model_runs", return_value=True):
        client = TestClient(app)
        resp = client.post("/model/verify", json={"model_key": "2b"})
        assert resp.status_code == 200
        assert resp.json() == {"verified": True, "model_key": "2b"}
