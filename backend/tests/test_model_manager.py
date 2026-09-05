import os
import sys
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from model_manager import (  # noqa: E402
    MODELS,
    _already_installed,
    is_legacy_installed,
    is_primary_installed,
    model_path,
    models_ready,
)


def create_model_file(path, model_key):
    with open(path, "wb") as handle:
        handle.write(b"GGUF")
        handle.truncate(int(MODELS[model_key]["size"] * 0.95))


def test_light_model_spec_points_to_minicpm5_1b():
    spec = MODELS["0.8b"]
    assert spec["repo_id"] == "openbmb/MiniCPM5-1B-GGUF"
    assert spec["filename"] == "MiniCPM5-1B-Q8_0.gguf"
    assert spec["size"] > 1_000_000_000


def test_legacy_0_8b_spec_retained_for_backward_compatibility():
    spec = MODELS["legacy-0.8b"]
    assert spec["repo_id"] == "bartowski/Qwen_Qwen3.5-0.8B-GGUF"
    assert spec["filename"] == "Qwen_Qwen3.5-0.8B-Q8_0.gguf"


def test_model_path_returns_primary_when_no_legacy_exists(tmp_path):
    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("0.8b")
        assert os.path.basename(path) == "MiniCPM5-1B-Q8_0.gguf"


def test_model_path_falls_back_to_legacy_when_legacy_file_exists(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-0.8B-Q8_0.gguf"
    create_model_file(legacy_file, "legacy-0.8b")

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("0.8b")
        assert os.path.basename(path) == "Qwen_Qwen3.5-0.8B-Q8_0.gguf"


def test_model_path_prefers_primary_when_both_exist(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-0.8B-Q8_0.gguf"
    create_model_file(legacy_file, "legacy-0.8b")
    primary_file = tmp_path / "MiniCPM5-1B-Q8_0.gguf"
    create_model_file(primary_file, "0.8b")

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("0.8b")
        assert os.path.basename(path) == "MiniCPM5-1B-Q8_0.gguf"


def test_standard_model_spec_points_to_qwen3_5_4b():
    spec = MODELS["2b"]
    assert spec["repo_id"] == "bartowski/Qwen_Qwen3.5-4B-GGUF"
    assert spec["filename"] == "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    assert spec["size"] > 2_500_000_000


def test_legacy_2b_spec_retained_for_backward_compatibility():
    spec = MODELS["legacy-2b"]
    assert spec["repo_id"] == "bartowski/Qwen_Qwen3.5-2B-GGUF"
    assert spec["filename"] == "Qwen_Qwen3.5-2B-Q4_K_M.gguf"


def test_standard_model_path_falls_back_to_legacy_when_legacy_file_exists(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_model_file(legacy_file, "legacy-2b")

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("2b")
        assert os.path.basename(path) == "Qwen_Qwen3.5-2B-Q4_K_M.gguf"


def test_quality_model_spec_points_to_ling_3_0_tiny():
    assert "quality" in MODELS
    spec = MODELS["quality"]
    assert spec["repo_id"] == "bartowski/Ling-3.0-tiny-GGUF"
    assert spec["filename"] == "Ling-3.0-tiny-Q4_K_M.gguf"
    assert spec["size"] > 4_000_000_000


def test_quality_model_path_returns_primary(tmp_path):
    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("quality")
        assert os.path.basename(path) == "Ling-3.0-tiny-Q4_K_M.gguf"


def test_invalid_primary_does_not_shadow_valid_legacy_model(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_model_file(legacy_file, "legacy-2b")
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    with open(primary_file, "wb") as handle:
        handle.write(b"BAD!")
        handle.truncate(int(MODELS["2b"]["size"] * 0.95))

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        assert is_primary_installed("2b") is False
        assert is_legacy_installed("2b") is True
        assert _already_installed("2b") is True
        assert model_path("2b") == str(legacy_file)


def test_partial_primary_does_not_shadow_valid_legacy_model(tmp_path):
    legacy_file = tmp_path / "Qwen_Qwen3.5-2B-Q4_K_M.gguf"
    create_model_file(legacy_file, "legacy-2b")
    primary_file = tmp_path / "Qwen_Qwen3.5-4B-Q4_K_M.gguf"
    primary_file.write_bytes(b"GGUF-partial")

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        assert model_path("2b") == str(legacy_file)
        assert models_ready()["2b"] is True


def test_models_ready_includes_quality_tier():
    ready = models_ready()
    assert "quality" in ready
    assert isinstance(ready["quality"], bool)
