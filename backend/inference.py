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
import platform
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from threading import Event, Lock

import requests

from ai_prefs import load_prefs
from model_manager import MODELS, is_model_file_available, model_path


def _init_cuda_dll_directory():
    """Ensure NVIDIA CUDA runtime and cuBLAS DLLs are discoverable on Windows."""
    if sys.platform != "win32":
        return
    import site

    try:
        sp_list = site.getsitepackages()
    except Exception:
        sp_list = []
    for sp in sp_list:
        nvidia_dir = os.path.join(sp, "nvidia")
        if os.path.isdir(nvidia_dir):
            for sub in ("cuda_runtime", "cublas", "cuda_nvrtc"):
                bin_dir = os.path.join(nvidia_dir, sub, "bin")
                if os.path.isdir(bin_dir):
                    try:
                        os.add_dll_directory(bin_dir)
                    except (OSError, AttributeError):
                        pass


_init_cuda_dll_directory()

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

# One bundled generation at a time. Backend instances are per request,
# so the lock must be global. Concurrent calls share one model session
# and can wedge or crash it.
_BUNDLED_GENERATION_LOCK = Lock()
_CACHED_BUNDLED_LLM: dict[str, object] = {
    "key": None,
    "path": None,
    "device": None,
    "limit_vram": None,
    "llm": None,
}

SYSTEM_PROMPT = (
    "You are a writing assistant. Follow the user's "
    "instruction and rewrite only what is asked. Do not "
    "explain. Do not think aloud."
)

# Reasoning adds time without improving short transforms. Ollama uses
# `think: false`. LM Studio and llama.cpp Qwen templates use
# `enable_thinking: false` (not reasoning_effort off/none — Qwen3.8 rejects
# those values). Any leaked block is still stripped from the output.
THINK_TAG_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)

# Approximate transformer layer counts for VRAM-limited GPU offload.
_MODEL_LAYER_COUNTS = {
    "0.8b": 24,
    "2b": 36,
    "quality": 64,
    "legacy-0.8b": 28,
    "legacy-2b": 28,
}
_VRAM_HEADROOM_BYTES = int(1.25 * 1024**3)


def strip_think(text: str) -> str:
    """Remove any leaked reasoning block from a model output."""
    cleaned = THINK_TAG_RE.sub("", text).strip()
    if cleaned.startswith("Thinking Process:") and ("[" in cleaned or "{" in cleaned):
        bracket_indices = [cleaned.find(c) for c in ("[", "{") if cleaned.find(c) != -1]
        if bracket_indices:
            cleaned = cleaned[min(bracket_indices):].strip()
    return cleaned


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


def _normalize_arch(machine: str | None = None) -> str:
    raw = (machine or platform.machine() or "").lower()
    if raw in ("amd64", "x86_64"):
        return "x86_64"
    if raw in ("aarch64", "arm64"):
        return "arm64"
    return raw or "unknown"


def _is_arm_arch(arch: str) -> bool:
    lowered = (arch or "").lower()
    return "arm" in lowered or "aarch64" in lowered


def detect_cpu_instruction_features() -> tuple[list[str], bool]:
    """Detect CPU SIMD flags. Returns (labels, probe_succeeded)."""
    flags: list[str] = []
    probed = False
    try:
        if sys.platform == "win32":
            try:
                import ctypes

                kernel32 = ctypes.windll.kernel32
                probed = True
                if kernel32.IsProcessorFeaturePresent(39):
                    flags.append("AVX")
                if kernel32.IsProcessorFeaturePresent(40):
                    flags.append("AVX2")
                if kernel32.IsProcessorFeaturePresent(41):
                    flags.append("AVX512")
            except Exception:
                probed = False
        elif sys.platform == "darwin":
            probed = True
            for flag, cmd in (
                ("AVX", ["sysctl", "-n", "hw.optional.avx1_0"]),
                ("AVX2", ["sysctl", "-n", "hw.optional.avx2_0"]),
                ("NEON", ["sysctl", "-n", "hw.optional.neon"]),
            ):
                try:
                    res = subprocess.run(
                        cmd, capture_output=True, text=True, timeout=2
                    )
                    if res.returncode == 0 and res.stdout.strip() in ("1", "true"):
                        flags.append(flag)
                except Exception:
                    pass
        else:
            cpuinfo_path = "/proc/cpuinfo"
            if os.path.isfile(cpuinfo_path):
                with open(cpuinfo_path, encoding="utf-8", errors="replace") as fh:
                    text = fh.read().lower()
                probed = True
                if re.search(r"\bavx2\b", text):
                    flags.append("AVX2")
                if re.search(r"\bavx\b", text):
                    flags.append("AVX")
                if re.search(r"\b(neon|asimd)\b", text):
                    flags.append("NEON")
    except Exception:
        return flags, False
    return flags, probed


def cpu_is_compatible(arch: str, features: list[str], probed: bool) -> bool:
    """ARM is always compatible. x86 needs AVX when the probe succeeded."""
    if _is_arm_arch(arch):
        return True
    if not probed:
        return True
    return "AVX" in features or "AVX2" in features


def _cpu_name() -> str:
    name = platform.processor() or "Unknown CPU"
    if sys.platform == "win32":
        try:
            res = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-Command",
                    "(Get-CimInstance -ClassName Win32_Processor).Name",
                ],
                capture_output=True,
                text=True,
                timeout=3,
            )
            if res.returncode == 0 and res.stdout.strip():
                name = res.stdout.strip().splitlines()[0].strip()
        except Exception:
            pass
    elif sys.platform == "darwin":
        try:
            res = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            if res.returncode == 0 and res.stdout.strip():
                name = res.stdout.strip()
        except Exception:
            pass
    else:
        try:
            with open("/proc/cpuinfo", encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    if line.lower().startswith("model name"):
                        name = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass
    return name


def _query_nvidia_gpu() -> dict:
    """Read NVIDIA GPU name and dedicated VRAM via nvidia-smi only."""
    info = {
        "count": 0,
        "name": None,
        "vram_gb": 0.0,
        "backend": "None",
        "device_id": 0,
        "cuda_available": False,
    }
    if not shutil.which("nvidia-smi"):
        return info
    try:
        res = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,memory.total,index",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if res.returncode != 0 or not res.stdout.strip():
            return info
        lines = [line for line in res.stdout.strip().splitlines() if line.strip()]
        first = [cell.strip() for cell in lines[0].split(",")]
        if len(first) < 2:
            return info
        info["count"] = len(lines)
        info["name"] = first[0]
        try:
            info["vram_gb"] = round(float(first[1]) / 1024, 2)
        except ValueError:
            info["vram_gb"] = 0.0
        info["backend"] = "CUDA"
        info["device_id"] = (
            int(first[2]) if len(first) > 2 and first[2].isdigit() else 0
        )
        info["cuda_available"] = True
    except Exception:
        return info
    return info


def _detect_windows_accelerators(results: dict, nv_info: dict) -> None:
    ps_gpu = (
        "Get-CimInstance Win32_VideoController | "
        "Select-Object Name, AdapterRAM, PNPDeviceID, DriverVersion | "
        "ConvertTo-Json -Compress"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_gpu],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            raw = json.loads(proc.stdout)
            if isinstance(raw, dict):
                raw = [raw]
            for item in raw:
                name = (item.get("Name") or "").strip()
                if not name:
                    continue
                lower = name.lower()
                # Software and remote display adapters do not give hardware acceleration.
                if any(v in lower for v in ("virtual", "basic display", "remote", "citrix", "rdp", "vnc")):
                    continue
                pnp_id = item.get("PNPDeviceID") or ""
                vendor = "Unknown"
                if "VEN_10DE" in pnp_id or "nvidia" in lower:
                    vendor = "NVIDIA"
                elif "VEN_1002" in pnp_id or "amd" in lower or "radeon" in lower:
                    vendor = "AMD"
                elif "VEN_8086" in pnp_id or "intel" in lower:
                    vendor = "Intel"

                is_integrated = False
                if vendor == "NVIDIA":
                    is_integrated = False
                elif vendor == "AMD":
                    if any(k in lower for k in ("radeon rx", "radeon pro", "firepro")):
                        is_integrated = False
                    else:
                        is_integrated = True
                elif vendor == "Intel":
                    if re.search(r"arc.*[ab]\d{3}", lower) or "arc pro" in lower:
                        is_integrated = False
                    else:
                        is_integrated = True

                # WMI AdapterRAM is limited to 4GB. Use nvidia-smi memory values when available.
                vram_gb = None
                if vendor == "NVIDIA" and nv_info.get("cuda_available") and nv_info.get("vram_gb"):
                    vram_gb = nv_info["vram_gb"]
                else:
                    ram_bytes = item.get("AdapterRAM")
                    if ram_bytes and float(ram_bytes) > 0:
                        vram_gb = round(float(ram_bytes) / (1024**3), 2)

                supported = bool(vendor == "NVIDIA" and nv_info.get("cuda_available"))
                entry = {
                    "name": name,
                    "vendor": vendor,
                    "type": "integrated" if is_integrated else "dedicated",
                    "vram_gb": vram_gb,
                    "supported": supported,
                }
                target = results["integrated"] if is_integrated else results["dedicated"]
                if not any(d["name"] == name for d in target):
                    target.append(entry)
    except Exception:
        pass

    ps_npu = (
        "Get-CimInstance Win32_PnPEntity | "
        "Where-Object { "
        "$_.PNPClass -eq 'ComputeAccelerator' -or "
        "$_.Name -match '(?i)\\b(AI Boost|NPU|IPU|Neural Processor|Hexagon)\\b' "
        "} | "
        "Select-Object Name, PNPClass, DeviceID, Manufacturer | "
        "ConvertTo-Json -Compress"
    )
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_npu],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            raw = json.loads(proc.stdout)
            if isinstance(raw, dict):
                raw = [raw]
            for item in raw:
                name = (item.get("Name") or "").strip()
                if not name:
                    continue
                lower = name.lower()
                # Word boundaries stop false matches such as USB Input Device.
                if not re.search(r"\b(ai boost|npu|ipu|neural processor|hexagon)\b", lower):
                    if item.get("PNPClass") != "ComputeAccelerator":
                        continue
                vendor = "Unknown"
                mfg = (item.get("Manufacturer") or "").lower()
                if "intel" in lower or "intel" in mfg:
                    vendor = "Intel"
                elif "amd" in lower or "amd" in mfg:
                    vendor = "AMD"
                elif "qualcomm" in lower or "hexagon" in lower or "snapdragon" in lower:
                    vendor = "Qualcomm"

                entry = {
                    "name": name,
                    "vendor": vendor,
                    "type": "npu",
                    "device_id": item.get("DeviceID"),
                    "supported": False,
                }
                if not any(n["name"] == name for n in results["npu"]):
                    results["npu"].append(entry)
    except Exception:
        pass


def _detect_macos_accelerators(results: dict, nv_info: dict) -> None:
    if platform.machine() in ("arm64", "aarch64"):
        # Apple Silicon SoC combines GPU and Neural Engine.
        results["integrated"].append({
            "name": "Apple M-Series GPU",
            "vendor": "Apple",
            "type": "integrated",
            "supported": True,
        })
        results["npu"].append({
            "name": "Apple Neural Engine (ANE)",
            "vendor": "Apple",
            "type": "npu",
            "supported": False,
        })


def _detect_linux_accelerators(results: dict, nv_info: dict) -> None:
    if not shutil.which("lspci"):
        return
    try:
        proc = subprocess.run(["lspci"], capture_output=True, text=True, timeout=3)
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                lower = line.lower()
                if any(k in lower for k in ("vga compatible controller", "3d controller", "display controller")):
                    vendor = "Unknown"
                    if "nvidia" in lower:
                        vendor = "NVIDIA"
                    elif "amd" in lower or "ati" in lower or "radeon" in lower:
                        vendor = "AMD"
                    elif "intel" in lower:
                        vendor = "Intel"
                    is_int = "integrated" in lower or (vendor == "Intel" and "arc" not in lower)
                    name = line.split(":", 2)[-1].strip() if ":" in line else line.strip()
                    target = results["integrated"] if is_int else results["dedicated"]
                    target.append({
                        "name": name,
                        "vendor": vendor,
                        "type": "integrated" if is_int else "dedicated",
                        "supported": vendor == "NVIDIA" and nv_info.get("cuda_available", False),
                    })
    except Exception:
        pass


def detect_all_accelerators() -> dict:
    """Find dedicated GPUs, integrated GPUs, and NPUs across platforms."""
    results = {
        "dedicated": [],
        "integrated": [],
        "npu": [],
    }

    nv_info = _query_nvidia_gpu()

    if sys.platform == "win32":
        _detect_windows_accelerators(results, nv_info)
    elif sys.platform == "darwin":
        _detect_macos_accelerators(results, nv_info)
    else:
        _detect_linux_accelerators(results, nv_info)

    # nvidia-smi gives verified CUDA state when platform query data is incomplete.
    if nv_info.get("cuda_available") and nv_info.get("name"):
        existing = any(
            d.get("vendor") == "NVIDIA" and d.get("name") == nv_info["name"]
            for d in results["dedicated"]
        )
        if not existing:
            results["dedicated"].append({
                "name": nv_info["name"],
                "vendor": "NVIDIA",
                "type": "dedicated",
                "vram_gb": nv_info["vram_gb"],
                "supported": True,
                "active": True,
            })

    return results


def resolve_n_gpu_layers(
    model_key: str,
    device: str,
    limit_vram_offload: bool,
    vram_gb: float | None = None,
    model_bytes: int | None = None,
) -> int:
    """Pick llama.cpp GPU layers. Limited mode stays in dedicated VRAM."""
    if device != "gpu":
        return 0
    if vram_gb is None:
        vram_gb = float(_query_nvidia_gpu().get("vram_gb") or 0.0)
    if vram_gb <= 0.0:
        return 0
    if not limit_vram_offload:
        return -1
    usable = int(float(vram_gb or 0.0) * (1024**3)) - _VRAM_HEADROOM_BYTES
    if usable <= 0:
        return 0
    size = model_bytes
    if size is None:
        spec = MODELS.get(model_key) or {}
        size = int(spec.get("size") or 0)
    if size <= 0 or size <= usable:
        return -1
    layers = _MODEL_LAYER_COUNTS.get(model_key, 32)
    fitted = int(layers * (usable / size))
    return max(1, min(layers - 1, fitted))


def _recommended_tier(vram_gb: float, ram_gb: float, gpu_count: int, device_pref: str) -> dict:
    if gpu_count > 0 and device_pref == "gpu":
        if vram_gb >= 18.0:
            return {
                "key": "quality",
                "label": "Quality",
                "badge": "Recommended for your hardware",
                "reason": (
                    f"Your GPU has {vram_gb} GB VRAM, enough for Quality in "
                    "dedicated memory."
                ),
                "quality_supported": True,
            }
        if vram_gb >= 6.0:
            return {
                "key": "2b",
                "label": "Standard",
                "badge": "Recommended for your hardware",
                "reason": (
                    f"Your GPU has {vram_gb} GB VRAM. Standard fits in dedicated "
                    "VRAM. Quality can run with CPU offload for leftover layers."
                ),
                "quality_supported": True,
            }
        return {
            "key": "0.8b",
            "label": "Light",
            "badge": "Recommended for your hardware",
            "reason": "Light is the best fit for GPUs under 6 GB VRAM.",
            "quality_supported": False,
        }
    if ram_gb >= 16.0:
        return {
            "key": "2b",
            "label": "Standard",
            "badge": "Recommended for your hardware",
            "reason": (
                f"Standard is the best CPU balance with your {ram_gb} GB RAM."
            ),
            "quality_supported": ram_gb >= 30.0,
        }
    return {
        "key": "0.8b",
        "label": "Light",
        "badge": "Recommended for your hardware",
        "reason": f"Light is the most responsive CPU option with {ram_gb} GB RAM.",
        "quality_supported": False,
    }


def get_hardware_diagnostics() -> dict:
    """Return CPU, RAM, and NVIDIA GPU info for the Hardware tab."""
    arch = _normalize_arch()
    simd, probed = detect_cpu_instruction_features()
    features = [arch, *simd]
    gpu_info = _query_nvidia_gpu()
    if not gpu_info["cuda_available"]:
        try:
            import llama_cpp

            gpu_info["cuda_available"] = bool(llama_cpp.llama_supports_gpu_offload())
        except Exception:
            pass

    try:
        import psutil

        ram_gb = round(psutil.virtual_memory().total / (1024**3), 2)
    except Exception:
        ram_gb = 16.0

    prefs = load_prefs()
    device_pref = prefs.get("device", "gpu")
    if not gpu_info.get("cuda_available"):
        device_pref = "cpu"
    limit_vram = bool(prefs.get("limit_vram_offload", True))
    recommended = _recommended_tier(
        gpu_info["vram_gb"] or 0.0,
        ram_gb,
        gpu_info["count"],
        device_pref,
    )
    accelerators = detect_all_accelerators()
    return {
        "cpu": {
            "name": _cpu_name(),
            "arch": arch,
            "features": features,
            "compatible": cpu_is_compatible(arch, features, probed),
        },
        "memory": {
            "ram_gb": ram_gb,
            "vram_gb": gpu_info["vram_gb"],
        },
        "gpu": gpu_info,
        "accelerators": accelerators,
        "device": device_pref,
        "limit_vram_offload": limit_vram,
        "recommended_tier": recommended,
    }


def detect_gpu_hardware() -> dict:
    """Backward-compatible helper returning basic GPU status."""
    diag = get_hardware_diagnostics()
    gpu = diag["gpu"]
    return {
        "has_gpu": gpu["count"] > 0,
        "gpu_name": gpu["name"],
        "vram_gb": gpu["vram_gb"],
        "gpu_offload_supported": gpu["cuda_available"],
        "device": diag["device"],
        "recommended_tier": diag["recommended_tier"],
        "accelerators": diag.get("accelerators"),
    }


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
            # Qwen3.8 rejects reasoning_effort off/none. Disable thinking
            # the same way LM Studio's "Enable thinking" toggle does.
            "enable_thinking": False,
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
        # Availability must reject partial/corrupt files and may fall back to
        # a verified legacy file for this same tier.
        return is_model_file_available(self.model_key)

    def _ensure_loaded(self):
        global _CACHED_BUNDLED_LLM
        if self._llm is not None:
            return
        target_path = self._path()
        prefs = load_prefs()
        device = prefs.get("device", "gpu")
        limit_vram = bool(prefs.get("limit_vram_offload", True))
        if (
            _CACHED_BUNDLED_LLM["key"] == self.model_key
            and _CACHED_BUNDLED_LLM["path"] == target_path
            and _CACHED_BUNDLED_LLM["device"] == device
            and _CACHED_BUNDLED_LLM.get("limit_vram") == limit_vram
            and _CACHED_BUNDLED_LLM["llm"] is not None
        ):
            self._llm = _CACHED_BUNDLED_LLM["llm"]
            return

        if _CACHED_BUNDLED_LLM["llm"] is not None:
            _CACHED_BUNDLED_LLM["key"] = None
            _CACHED_BUNDLED_LLM["path"] = None
            _CACHED_BUNDLED_LLM["device"] = None
            _CACHED_BUNDLED_LLM["limit_vram"] = None
            _CACHED_BUNDLED_LLM["llm"] = None
            import gc

            gc.collect()

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
        n_gpu_layers = resolve_n_gpu_layers(self.model_key, device, limit_vram)
        try:
            self._llm = Llama(
                model_path=target_path,
                n_ctx=self.n_ctx,
                n_gpu_layers=n_gpu_layers,
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
                        model_path=target_path,
                        n_ctx=self.n_ctx,
                        n_gpu_layers=n_gpu_layers,
                        use_mmap=False,
                        verbose=False,
                    )
                except Exception as retry_exc:
                    load_exc = retry_exc
                    self._llm = None
            else:
                self._llm = None

            if self._llm is None:
                import gc

                gc.collect()
                raise InferenceUnavailable(
                    f"Engine failed to load model: {load_exc}"
                ) from load_exc

        if self._llm is not None and not hasattr(self._llm, "_lexicon_no_think_installed"):
            orig_handler = (
                self._llm.chat_handler
                or self._llm._chat_handlers.get(self._llm.chat_format)
            )
            if orig_handler is not None:
                def _no_think_handler(*args, **kwargs):
                    kwargs["enable_thinking"] = False
                    return orig_handler(*args, **kwargs)

                self._llm.chat_handler = _no_think_handler
            self._llm._lexicon_no_think_installed = True

        _CACHED_BUNDLED_LLM["key"] = self.model_key
        _CACHED_BUNDLED_LLM["path"] = target_path
        _CACHED_BUNDLED_LLM["device"] = device
        _CACHED_BUNDLED_LLM["limit_vram"] = limit_vram
        _CACHED_BUNDLED_LLM["llm"] = self._llm

    def unload(self):
        """Free GGUF model memory and force garbage collection."""
        global _CACHED_BUNDLED_LLM
        _CACHED_BUNDLED_LLM["key"] = None
        _CACHED_BUNDLED_LLM["path"] = None
        _CACHED_BUNDLED_LLM["device"] = None
        _CACHED_BUNDLED_LLM["limit_vram"] = None
        _CACHED_BUNDLED_LLM["llm"] = None
        if self._llm is not None:
            self._llm = None
            import gc

            gc.collect()

    def complete(self, prompt: str, text: str, **opts) -> str:
        cancel_event, _ = _take_cancellation_opts(opts)
        _raise_if_cancelled(cancel_event)
        with _BUNDLED_GENERATION_LOCK:
            _raise_if_cancelled(cancel_event)
            self._ensure_loaded()
            max_tokens = int(opts.pop("max_tokens", TRANSFORM_MAX_TOKENS))
            temperature = float(opts.pop("temperature", 0.3))
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"{prompt}\n\n{text}"},
            ]

            # Register native C++ abort callback so cancellation halts llama_decode
            # in < 1ms rather than running for thousands of tokens on the CPU.
            has_abort = False
            _noop_abort = None
            try:
                import llama_cpp

                if (
                    hasattr(llama_cpp, "ggml_abort_callback")
                    and hasattr(llama_cpp, "llama_set_abort_callback")
                    and hasattr(self._llm, "ctx")
                    and self._llm.ctx is not None
                ):
                    @llama_cpp.ggml_abort_callback
                    def _active_abort(_data):
                        return 1 if (cancel_event is not None and cancel_event.is_set()) else 0

                    @llama_cpp.ggml_abort_callback
                    def _noop_abort_fn(_data):
                        return 0

                    _noop_abort = _noop_abort_fn
                    llama_cpp.llama_set_abort_callback(self._llm.ctx, _active_abort, None)
                    has_abort = True
            except Exception:
                has_abort = False

            def _consume_completion(session_llm, call_opts) -> str:
                result = session_llm.create_chat_completion(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    stream=True,
                    **call_opts,
                )
                if isinstance(result, dict):
                    return result["choices"][0]["message"]["content"]
                chunks = []
                for chunk in result:
                    _raise_if_cancelled(cancel_event)
                    choices = chunk.get("choices") or []
                    if choices:
                        delta = choices[0].get("delta") or {}
                        text_part = delta.get("content") or ""
                        if text_part:
                            chunks.append(text_part)
                return "".join(chunks)

            try:
                content = _consume_completion(self._llm, opts)
            except (InferenceCancelled, RuntimeError) as exc:
                self._llm = None
                if cancel_event is not None and cancel_event.is_set():
                    raise InferenceCancelled("Transform cancelled.") from exc
                if isinstance(exc, RuntimeError) and "llama_decode returned 2" in str(exc):
                    raise InferenceCancelled("Transform cancelled.") from exc
                raise
            except Exception:  # noqa: BLE001 - surface engine errors clearly
                # Reset the session to remove wedged state.
                self._llm = None
                # Do not retry if cancelled.
                _raise_if_cancelled(cancel_event)
                try:
                    self._ensure_loaded()
                    _raise_if_cancelled(cancel_event)
                    content = _consume_completion(self._llm, opts)
                except (InferenceCancelled, RuntimeError) as exc2:
                    self._llm = None
                    if cancel_event is not None and cancel_event.is_set():
                        raise InferenceCancelled("Transform cancelled.") from exc2
                    if isinstance(exc2, RuntimeError) and "llama_decode returned 2" in str(exc2):
                        raise InferenceCancelled("Transform cancelled.") from exc2
                    raise
                except Exception as exc3:
                    raise InferenceUnavailable(f"Bundled model failed: {exc3}") from exc3
            finally:
                can_clear_abort = (
                    has_abort
                    and _noop_abort is not None
                    and hasattr(self._llm, "ctx")
                    and self._llm.ctx is not None
                )
                if can_clear_abort:
                    try:
                        import llama_cpp
                        llama_cpp.llama_set_abort_callback(self._llm.ctx, _noop_abort, None)
                    except Exception:
                        pass
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
            _backend = BundledBackend(model_key=prefs.get("model_key") or "2b")
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
        # Chosen tier missing — try other available bundled tiers, then Ollama as last resort.
        fallback_keys = [k for k in ("2b", "quality", "0.8b") if k != key]
        for alt_key in fallback_keys:
            alt = BundledBackend(model_key=alt_key)
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
    global _backend, _CACHED_BUNDLED_LLM
    with _BUNDLED_GENERATION_LOCK:
        _CACHED_BUNDLED_LLM["key"] = None
        _CACHED_BUNDLED_LLM["path"] = None
        _CACHED_BUNDLED_LLM["device"] = None
        _CACHED_BUNDLED_LLM["limit_vram"] = None
        _CACHED_BUNDLED_LLM["llm"] = None
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
