import os
import sys
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from model_manager import (  # noqa: E402
    MODEL_STATUS,
    MODELS,
    _already_installed,
    active_model_download,
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


def test_quality_model_spec_points_to_qwen3_8_27b():
    assert "quality" in MODELS
    spec = MODELS["quality"]
    assert spec["repo_id"] == "unsloth/Qwen3.8-27B-GGUF"
    assert spec["filename"] == "Qwen3.8-27B-UD-Q4_K_M.gguf"
    assert spec["size"] > 16_000_000_000


def test_quality_model_path_returns_primary(tmp_path):
    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        path = model_path("quality")
        assert os.path.basename(path) == "Qwen3.8-27B-UD-Q4_K_M.gguf"


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


def test_active_model_download_none_when_idle():
    MODEL_STATUS.clear()
    assert active_model_download() is None


def test_active_model_download_returns_active_tier_when_downloading():
    MODEL_STATUS.clear()
    MODEL_STATUS["2b"] = {
        "state": "downloading",
        "bytes_done": 500_000_000,
        "bytes_total": 2_500_000_000,
        "error": None,
    }
    active = active_model_download()
    assert active is not None
    assert active["model_key"] == "2b"
    assert active["state"] == "downloading"
    assert active["bytes_done"] == 500_000_000
    assert active["bytes_total"] == 2_500_000_000
    MODEL_STATUS.clear()


def test_num_download_workers_is_four():
    from model_manager import NUM_DOWNLOAD_WORKERS
    assert NUM_DOWNLOAD_WORKERS == 4


def test_parallel_chunk_download_assembles_parts_correctly(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model.gguf")
    payload = b"GGUF" + b"x" * 4092  # 4096 bytes total
    total_size = len(payload)

    class MockRangeResponse:
        def __init__(self, slice_data, status_code=206):
            self.slice_data = slice_data
            self.status_code = status_code
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.slice_data), chunk_size):
                yield self.slice_data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return MockRangeResponse(payload[0:1], status_code=206)
        if rng.startswith("bytes="):
            parts = rng[len("bytes=") :].split("-")
            start = int(parts[0])
            end = int(parts[1]) if parts[1] else len(payload) - 1
            return MockRangeResponse(payload[start : end + 1], status_code=206)
        return MockRangeResponse(payload, status_code=200)

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-model",
            num_workers=4,
        )

    assert result_path == dest
    assert os.path.exists(dest)
    with open(dest, "rb") as fh:
        assert fh.read() == payload

    # Ensure no lingering .part_* or .tmp files
    for i in range(4):
        assert not os.path.exists(f"{dest}.part_{i}")
    assert not os.path.exists(f"{dest}.tmp")


def test_parallel_chunk_download_resumes_existing_parts(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_resume.gguf")
    payload = b"GGUF" + b"r" * 4092  # 4096 bytes total, 1024 bytes per part
    total_size = len(payload)

    # Pre-populate part_0 completely and part_1 partially (512 bytes)
    part_0 = f"{dest}.part_0"
    with open(part_0, "wb") as f:
        f.write(payload[0:1024])

    part_1 = f"{dest}.part_1"
    with open(part_1, "wb") as f:
        f.write(payload[1024:1536])  # First 512 bytes of part 1

    requested_ranges = []

    class MockRangeResponse:
        def __init__(self, slice_data, status_code=206):
            self.slice_data = slice_data
            self.status_code = status_code
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=512):
            for i in range(0, len(self.slice_data), chunk_size):
                yield self.slice_data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        requested_ranges.append(rng)
        if rng == "bytes=0-0":
            return MockRangeResponse(payload[0:1], status_code=206)
        if rng.startswith("bytes="):
            parts = rng[len("bytes=") :].split("-")
            start = int(parts[0])
            end = int(parts[1]) if parts[1] else len(payload) - 1
            return MockRangeResponse(payload[start : end + 1], status_code=206)
        return MockRangeResponse(payload, status_code=200)

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-resume",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload

    # Verify part 0 was NOT re-requested because it was already complete
    assert "bytes=0-1023" not in requested_ranges
    # Verify part 1 resumed from 1536 to 2047
    assert "bytes=1536-2047" in requested_ranges


def test_parallel_chunk_download_cancels_cleanly(tmp_path):
    import pytest

    from model_manager import _parallel_chunk_download, cancel_download

    dest = str(tmp_path / "model_cancel.gguf")
    payload = b"GGUF" + b"c" * 4092
    total_size = len(payload)

    class SlowRangeResponse:
        def __init__(self, slice_data):
            self.slice_data = slice_data
            self.status_code = 206
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=256):
            # Cancel immediately upon reading the first chunk
            cancel_download("test-cancel")
            yield self.slice_data[:chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return SlowRangeResponse(payload[0:1])
        return SlowRangeResponse(payload[0:1024])

    with patch("requests.get", side_effect=fake_get):
        with pytest.raises(RuntimeError, match="cancelled by user"):
            _parallel_chunk_download(
                url="http://fake/model.gguf",
                dest=dest,
                total_size=total_size,
                model_key="test-cancel",
                num_workers=4,
            )


def test_parallel_chunk_download_falls_back_when_server_lacks_range(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_fallback.gguf")
    payload = b"GGUF" + b"f" * 4092
    total_size = len(payload)

    class MockSingleResponse:
        def __init__(self, data, status_code=200):
            self.data = data
            self.status_code = status_code
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        # Server always returns 200 OK (no 206 range support)
        return MockSingleResponse(payload, status_code=200)

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-fallback",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload


def test_parallel_chunk_download_rejects_full_body_and_falls_back(tmp_path):
    """A 206 probe followed by a 200 body must not be written into part files."""
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_full_body.gguf")
    payload = b"GGUF" + b"z" * 4092
    total_size = len(payload)

    class MockResponse:
        def __init__(self, data, status_code, ranged=False):
            self.data = data
            self.status_code = status_code
            self.ranged = ranged
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            if self.status_code == 200 and self.ranged:
                raise AssertionError("ranged response body was read")
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return MockResponse(payload[0:1], status_code=206)
        if rng.startswith("bytes="):
            return MockResponse(payload, status_code=200, ranged=True)
        return MockResponse(payload, status_code=200)

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-full-body",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload
    for i in range(4):
        part_path = f"{dest}.part_{i}"
        assert not os.path.exists(part_path) or os.path.getsize(part_path) == 0


def test_parallel_chunk_download_retries_short_part_body(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_short.gguf")
    payload = b"GGUF" + b"s" * 4092
    total_size = len(payload)
    shortened = set()

    class MockResponse:
        def __init__(self, data):
            self.data = data
            self.status_code = 206
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return MockResponse(payload[0:1])
        parts = rng[len("bytes=") :].split("-")
        start = int(parts[0])
        end = int(parts[1])
        data = payload[start : end + 1]
        part_id = start // 1024
        if part_id not in shortened and len(data) > 1:
            shortened.add(part_id)
            data = data[: len(data) // 2]
        return MockResponse(data)

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-short",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload


def test_parallel_chunk_download_trims_overlong_part_body(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_overlong.gguf")
    payload = b"GGUF" + b"o" * 4092
    total_size = len(payload)

    class MockResponse:
        def __init__(self, data):
            self.data = data
            self.status_code = 206
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return MockResponse(payload[0:1])
        parts = rng[len("bytes=") :].split("-")
        start = int(parts[0])
        end = int(parts[1])
        return MockResponse(payload[start : end + 1] + b"EXTRA")

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-overlong",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload


def test_parallel_chunk_download_uses_single_stream_when_disk_is_tight(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_disk.gguf")
    payload = b"GGUF" + b"d" * 4092
    total_size = len(payload)
    requested = []

    class MockResponse:
        def __init__(self, data, status_code=206):
            self.data = data
            self.status_code = status_code
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        requested.append(rng)
        if rng == "bytes=0-0":
            return MockResponse(payload[0:1], status_code=206)
        if rng.startswith("bytes="):
            parts = rng[len("bytes=") :].split("-")
            start = int(parts[0])
            end = int(parts[1]) if parts[1] else len(payload) - 1
            return MockResponse(payload[start : end + 1], status_code=206)
        return MockResponse(payload, status_code=200)

    with patch("requests.get", side_effect=fake_get), patch(
        "model_manager._free_space", return_value=total_size
    ):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-disk",
            num_workers=4,
        )

    assert result_path == dest
    with open(dest, "rb") as fh:
        assert fh.read() == payload
    assert "bytes=0-1023" not in requested
    for i in range(4):
        assert not os.path.exists(f"{dest}.part_{i}")


def test_parallel_chunk_download_assembles_uneven_final_part(tmp_path):
    from model_manager import _parallel_chunk_download

    dest = str(tmp_path / "model_uneven.gguf")
    payload = b"GGUF" + b"u" * 4093
    total_size = len(payload)

    class MockResponse:
        def __init__(self, data):
            self.data = data
            self.status_code = 206
            self.headers = {}

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def raise_for_status(self):
            pass

        def iter_content(self, chunk_size=1024):
            for i in range(0, len(self.data), chunk_size):
                yield self.data[i : i + chunk_size]

    def fake_get(url, headers=None, **kwargs):
        headers = headers or {}
        rng = headers.get("Range", "")
        if rng == "bytes=0-0":
            return MockResponse(payload[0:1])
        parts = rng[len("bytes=") :].split("-")
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else len(payload) - 1
        return MockResponse(payload[start : end + 1])

    with patch("requests.get", side_effect=fake_get):
        result_path = _parallel_chunk_download(
            url="http://fake/model.gguf",
            dest=dest,
            total_size=total_size,
            model_key="test-uneven",
            num_workers=4,
        )

    assert os.path.getsize(dest) == total_size
    with open(dest, "rb") as fh:
        assert fh.read() == payload
    assert result_path == dest


def test_delete_model_removes_part_and_temp_files(tmp_path):
    from model_manager import delete_model

    primary_name = MODELS["0.8b"]["filename"]
    legacy_name = MODELS["legacy-0.8b"]["filename"]
    primary = tmp_path / primary_name
    primary.write_bytes(b"GGUF")
    legacy = tmp_path / legacy_name
    legacy.write_bytes(b"old")
    temp = tmp_path / f"{primary_name}.tmp"
    temp.write_bytes(b"tmp")
    parts = []
    for i in range(4):
        part = tmp_path / f"{primary_name}.part_{i}"
        part.write_bytes(b"part")
        parts.append(part)

    with patch("model_manager.models_dir", return_value=str(tmp_path)):
        delete_model("0.8b")

    assert not primary.exists()
    assert not legacy.exists()
    assert not temp.exists()
    for part in parts:
        assert not part.exists()


def test_stream_download_raises_when_partial_dest_cannot_be_removed(tmp_path, monkeypatch):
    import pytest

    from model_manager import _stream_download

    dest = tmp_path / MODELS["0.8b"]["filename"]
    dest.write_bytes(b"GGUF" + b"x" * 64)
    monkeypatch.setattr("model_manager.models_dir", lambda: str(tmp_path))
    real_remove = os.remove

    def guarded_remove(path):
        if os.path.abspath(path) == os.path.abspath(dest):
            raise OSError("file is locked")
        real_remove(path)

    monkeypatch.setattr("model_manager.os.remove", guarded_remove)
    with patch("requests.get", side_effect=AssertionError("should not download")):
        with pytest.raises(RuntimeError, match="Could not replace partial model file"):
            _stream_download("0.8b")

