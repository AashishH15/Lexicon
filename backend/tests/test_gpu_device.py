import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import ai_prefs  # noqa: E402
import inference  # noqa: E402


def test_detect_gpu_hardware_with_nvidia_smi():
    mock_run = MagicMock()
    mock_run.returncode = 0
    mock_run.stdout = "NVIDIA GeForce RTX 4070 SUPER, 12282\n"

    with patch("shutil.which", return_value="C:\\Windows\\System32\\nvidia-smi.exe"):
        with patch("subprocess.run", return_value=mock_run):
            info = inference.detect_gpu_hardware()
            assert info["has_gpu"] is True
            assert info["gpu_name"] == "NVIDIA GeForce RTX 4070 SUPER"
            assert round(info["vram_gb"], 1) == 12.0


def test_detect_gpu_hardware_without_gpu():
    with patch("shutil.which", return_value=None):
        info = inference.detect_gpu_hardware()
        assert info["has_gpu"] is False
        assert info["gpu_name"] is None
        assert info["vram_gb"] in (None, 0.0)


def test_get_hardware_diagnostics():
    diag = inference.get_hardware_diagnostics()
    assert "cpu" in diag
    assert "memory" in diag
    assert "gpu" in diag
    assert "accelerators" in diag
    assert "dedicated" in diag["accelerators"]
    assert "integrated" in diag["accelerators"]
    assert "npu" in diag["accelerators"]
    assert isinstance(diag["accelerators"]["dedicated"], list)
    assert isinstance(diag["accelerators"]["integrated"], list)
    assert isinstance(diag["accelerators"]["npu"], list)
    assert "recommended_tier" in diag
    assert isinstance(diag["cpu"]["compatible"], bool)
    assert isinstance(diag["cpu"]["features"], list)
    assert diag["cpu"]["arch"]
    assert diag["memory"]["ram_gb"] > 0


def test_detect_all_accelerators_windows_mock():
    mock_gpus_json = """[
        {"Name": "Parsec Virtual Display Adapter", "AdapterRAM": null, "PNPDeviceID": "ROOT\\\\DISPLAY\\\\0000"},
        {"Name": "NVIDIA GeForce RTX 4070 SUPER", "AdapterRAM": 4293918720, "PNPDeviceID": "PCI\\\\VEN_10DE&DEV_2783"},
        {"Name": "AMD Radeon(TM) Graphics", "AdapterRAM": 536870912, "PNPDeviceID": "PCI\\\\VEN_1002&DEV_13C0"},
        {"Name": "Intel(R) Arc(TM) A770 Graphics", "AdapterRAM": 4293918720, "PNPDeviceID": "PCI\\\\VEN_8086&DEV_5690"}
    ]"""

    mock_npus_json = """[
        {"Name": "Intel(R) AI Boost", "PNPClass": "ComputeAccelerator", "DeviceID": "PCI\\\\VEN_8086&DEV_7D1D", "Manufacturer": "Intel Corporation"},
        {"Name": "USB Input Device", "PNPClass": "HIDClass", "DeviceID": "USB\\\\VID_048D", "Manufacturer": "Generic"}
    ]"""

    def mock_subprocess_run(cmd, *args, **kwargs):
        cmd_str = " ".join(cmd) if isinstance(cmd, list) else str(cmd)
        result = MagicMock()
        result.returncode = 0
        if "Win32_VideoController" in cmd_str:
            result.stdout = mock_gpus_json
        elif "Win32_PnPEntity" in cmd_str:
            result.stdout = mock_npus_json
        else:
            result.stdout = ""
        return result

    with patch("sys.platform", "win32"):
        with patch("subprocess.run", side_effect=mock_subprocess_run):
            with patch.object(
                inference,
                "_query_nvidia_gpu",
                return_value={
                    "count": 1,
                    "name": "NVIDIA GeForce RTX 4070 SUPER",
                    "vram_gb": 12.0,
                    "backend": "CUDA",
                    "cuda_available": True,
                },
            ):
                res = inference.detect_all_accelerators()
                assert len(res["dedicated"]) == 2  # NVIDIA and Intel Arc dGPU
                assert len(res["integrated"]) == 1  # AMD Radeon(TM) Graphics
                assert len(res["npu"]) == 1  # Intel(R) AI Boost (USB Input filtered out)

                nvidia = next(d for d in res["dedicated"] if d["vendor"] == "NVIDIA")
                assert nvidia["name"] == "NVIDIA GeForce RTX 4070 SUPER"
                assert nvidia["vram_gb"] == 12.0  # High-precision VRAM from nvidia-smi
                assert nvidia["supported"] is True

                amd = res["integrated"][0]
                assert amd["name"] == "AMD Radeon(TM) Graphics"
                assert amd["vendor"] == "AMD"

                npu = res["npu"][0]
                assert npu["name"] == "Intel(R) AI Boost"
                assert npu["vendor"] == "Intel"


def test_ai_prefs_device_default_and_validation(tmp_path):
    prefs_file = tmp_path / "ai_prefs.json"
    with patch("ai_prefs.PREFS_PATH", str(prefs_file)):
        prefs = ai_prefs.load_prefs()
        assert prefs["device"] == "gpu"
        assert prefs["limit_vram_offload"] is True

        saved = ai_prefs.save_prefs("bundled", "2b", device="cpu")
        assert saved["device"] == "cpu"

        loaded = ai_prefs.load_prefs()
        assert loaded["device"] == "cpu"
        assert loaded["limit_vram_offload"] is True

        saved_invalid = ai_prefs.save_prefs("bundled", "2b", device="tpu")
        assert saved_invalid["device"] == "gpu"


def test_cpu_compatibility_uses_detected_flags():
    assert inference.cpu_is_compatible("arm64", ["arm64", "NEON"], True) is True
    assert inference.cpu_is_compatible("x86_64", ["x86_64", "AVX", "AVX2"], True) is True
    assert inference.cpu_is_compatible("x86_64", ["x86_64"], True) is False
    assert inference.cpu_is_compatible("x86_64", ["x86_64"], False) is True


def test_resolve_n_gpu_layers_caps_to_dedicated_vram():
    assert inference.resolve_n_gpu_layers("2b", "cpu", True, vram_gb=12.0) == 0
    assert inference.resolve_n_gpu_layers("2b", "gpu", False, vram_gb=12.0) == -1
    assert inference.resolve_n_gpu_layers("2b", "gpu", True, vram_gb=12.0) == -1
    limited = inference.resolve_n_gpu_layers("quality", "gpu", True, vram_gb=12.0)
    assert 1 <= limited <= 63
    assert inference.resolve_n_gpu_layers("quality", "gpu", True, vram_gb=0) == 0


def test_bundled_backend_loads_with_device_layers(tmp_path):
    backend = inference.BundledBackend(model_key="2b")
    backend._path = lambda: str(tmp_path / "fake.gguf")
    backend.available = lambda: True

    captured_kwargs = {}

    def mock_llama(*args, **kwargs):
        captured_kwargs.update(kwargs)
        mock_instance = MagicMock()
        mock_instance.chat_handler = None
        mock_instance._chat_handlers = {}
        mock_instance.chat_format = "qwen"
        return mock_instance

    with patch.dict("sys.modules", {"llama_cpp": MagicMock(Llama=mock_llama)}):
        with patch(
            "inference.load_prefs",
            return_value={"device": "gpu", "limit_vram_offload": False},
        ):
            backend._ensure_loaded()
            assert captured_kwargs.get("n_gpu_layers") == -1

        backend.unload()
        captured_kwargs.clear()

        with patch(
            "inference.load_prefs",
            return_value={"device": "cpu", "limit_vram_offload": True},
        ):
            backend._ensure_loaded()
            assert captured_kwargs.get("n_gpu_layers") == 0

        backend.unload()
        captured_kwargs.clear()

        with patch(
            "inference.load_prefs",
            return_value={"device": "gpu", "limit_vram_offload": True},
        ):
            with patch(
                "inference.resolve_n_gpu_layers",
                return_value=40,
            ) as resolve:
                backend.model_key = "quality"
                backend._ensure_loaded()
                assert captured_kwargs.get("n_gpu_layers") == 40
                resolve.assert_called_once()
