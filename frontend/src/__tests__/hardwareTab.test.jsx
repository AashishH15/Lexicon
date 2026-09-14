// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import HardwareTab from "../HardwareTab.jsx";
import * as api from "../api.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  getHardwareProfile: vi.fn(),
  setHardwareSettings: vi.fn(),
  getGpuPackages: vi.fn(),
  installGpuPackage: vi.fn(),
  cancelGpuPackageInstall: vi.fn(),
  uninstallGpuPackage: vi.fn(),
  activateGpuPackage: vi.fn(),
}));

describe("HardwareTab Component", () => {
  let container;
  let root;

  const mockHardwareData = {
    cpu: {
      name: "AMD Ryzen 7 9700X 8-Core Processor",
      arch: "x86_64",
      features: ["x86_64", "AVX", "AVX2"],
      compatible: true,
    },
    memory: {
      ram_gb: 31.11,
      vram_gb: 11.99,
    },
    gpu: {
      count: 1,
      name: "NVIDIA GeForce RTX 4070 SUPER",
      vram_gb: 11.99,
      backend: "CUDA",
      device_id: 0,
      cuda_available: true,
    },
    device: "gpu",
    limit_vram_offload: true,
    recommended_tier: {
      key: "2b",
      label: "Standard",
      badge: "Recommended for your hardware",
      reason: "Standard (4B) fits 100% in dedicated VRAM with blazing ~47 tok/s speed.",
      quality_supported: true,
    },
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    api.getGpuPackages.mockResolvedValue({
      packages: [],
      engine_supported: true,
      offload_supported: true,
      active_backend: "CUDA",
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders CPU, Memory, and GPU details matching hardware diagnostics", async () => {
    api.getHardwareProfile.mockResolvedValue(mockHardwareData);

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("AMD Ryzen 7 9700X 8-Core Processor");
    const badge = [...container.querySelectorAll("span")].find(
      (el) => el.textContent === "Compatible",
    );
    expect(badge).not.toBe(null);
    expect(badge.querySelector("svg")).not.toBe(null);
    expect(container.textContent).not.toContain("✓");
    expect(container.textContent).toContain("AVX2");
    expect(container.textContent).toContain("31.11 GB");
    expect(container.textContent).toContain("11.99 GB");
    expect(container.textContent).toContain("1 NVIDIA GPU · CUDA");
    expect(container.textContent).toContain("NVIDIA GeForce RTX 4070 SUPER");
    expect(container.textContent).toContain("Limit Model Offload");
  });

  it("allows toggling between GPU and CPU compute device", async () => {
    api.getHardwareProfile.mockResolvedValue(mockHardwareData);
    api.setHardwareSettings.mockResolvedValue({
      ...mockHardwareData,
      device: "cpu",
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    const offBtn = container.querySelector('[data-testid="gpu-toggle-off"]');
    expect(offBtn).not.toBeNull();

    await act(async () => {
      offBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(api.setHardwareSettings).toHaveBeenCalledWith({
      device: "cpu",
      limitVramOffload: true,
    });
  });

  it("allows toggling Limit Model Offload switch", async () => {
    api.getHardwareProfile.mockResolvedValue(mockHardwareData);
    api.setHardwareSettings.mockResolvedValue({
      ...mockHardwareData,
      limit_vram_offload: false,
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    const offloadToggle = container.querySelector('[data-testid="toggle-limit-vram-offload"]');
    expect(offloadToggle).not.toBeNull();

    await act(async () => {
      offloadToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(api.setHardwareSettings).toHaveBeenCalledWith({
      device: "gpu",
      limitVramOffload: false,
    });
  });

  it("allows resetting settings to default", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      device: "cpu",
      limit_vram_offload: false,
    });
    api.setHardwareSettings.mockResolvedValue(mockHardwareData);

    await act(async () => {
      root.render(<HardwareTab />);
    });

    const resetBtn = container.querySelector('[data-testid="hardware-reset-default-btn"]');
    expect(resetBtn).not.toBeNull();

    await act(async () => {
      resetBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(api.setHardwareSettings).toHaveBeenCalledWith({
      device: "gpu",
      limitVramOffload: true,
    });
  });

  it("does not show a recommended-tier card or copy button", async () => {
    api.getHardwareProfile.mockResolvedValue(mockHardwareData);

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.querySelector('[data-testid="hardware-copy-info-btn"]')).toBeNull();
    expect(container.querySelector('[data-testid="tier-recommendation-card"]')).toBeNull();
    expect(container.textContent).not.toContain("Recommended Tier For Your Hardware");
    expect(container.textContent).toContain("Limit Model Offload");
  });

  it("shows a red X badge when the CPU is not compatible", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      cpu: { ...mockHardwareData.cpu, compatible: false },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    const badge = [...container.querySelectorAll("span")].find(
      (el) => el.textContent === "Not Compatible",
    );
    expect(badge).not.toBe(null);
    expect(badge.querySelector("svg")).not.toBe(null);
    expect(container.textContent).not.toContain("✓");
  });

  it("renders all detected accelerators (dedicated, integrated, and NPU)", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      accelerators: {
        dedicated: [
          {
            name: "NVIDIA GeForce RTX 4070 SUPER",
            vendor: "NVIDIA",
            type: "dedicated",
            vram_gb: 11.99,
            supported: true,
            active: true,
          },
        ],
        integrated: [
          {
            name: "AMD Radeon(TM) Graphics",
            vendor: "AMD",
            type: "integrated",
            vram_gb: 0.5,
          },
        ],
        npu: [
          {
            name: "Intel(R) AI Boost",
            vendor: "Intel",
            type: "npu",
          },
        ],
      },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("AMD Radeon(TM) Graphics");
    expect(container.textContent).toContain("Integrated GPU");
    expect(container.textContent).toContain("Intel(R) AI Boost");
    expect(container.textContent).toContain("Neural Processing Unit");
  });

  it("does not render NPU section when no NPU is detected", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      accelerators: {
        dedicated: [
          {
            name: "NVIDIA GeForce RTX 4070 SUPER",
            vendor: "NVIDIA",
            type: "dedicated",
            vram_gb: 11.99,
            supported: true,
            active: true,
          },
        ],
        integrated: [
          {
            name: "AMD Radeon(TM) Graphics",
            vendor: "AMD",
            type: "integrated",
            vram_gb: 0.5,
          },
        ],
        npu: [],
      },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).not.toContain("Neural Processing Unit");
    expect(container.textContent).not.toContain("No NPU detected");
    expect(container.textContent).toContain("AMD Radeon(TM) Graphics");
    expect(container.textContent).toContain("Integrated GPU");
  });

  it("renders AMD GPU with Vulkan backend in the primary compute card", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "AMD Radeon RX 7800 XT",
        vendor: "AMD",
        vram_gb: 16.0,
        backend: "Vulkan",
        offload_supported: true,
      },
      accelerators: {
        dedicated: [
          {
            name: "AMD Radeon RX 7800 XT",
            vendor: "AMD",
            type: "dedicated",
            vram_gb: 16.0,
            supported: true,
          },
        ],
        integrated: [],
        npu: [],
      },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("1 AMD GPU · Vulkan");
    expect(container.textContent).toContain("AMD Radeon RX 7800 XT");
    expect(container.textContent).toContain("16 GB VRAM · Vulkan");
    expect(container.querySelector('[data-testid="gpu-toggle-off"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="gpu-toggle-on"]')).not.toBeNull();
  });

  it("renders Intel Arc GPU with Vulkan backend in the primary compute card", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "Intel(R) Arc(TM) A770 Graphics",
        vendor: "Intel",
        vram_gb: 16.0,
        backend: "Vulkan",
        offload_supported: true,
      },
      accelerators: {
        dedicated: [
          {
            name: "Intel(R) Arc(TM) A770 Graphics",
            vendor: "Intel",
            type: "dedicated",
            vram_gb: 16.0,
            supported: true,
          },
        ],
        integrated: [],
        npu: [],
      },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("1 Intel GPU · Vulkan");
    expect(container.textContent).toContain("Intel(R) Arc(TM) A770 Graphics");
    expect(container.textContent).toContain("16 GB VRAM · Vulkan");
  });

  it("renders Apple Silicon GPU with Metal backend in the primary compute card", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "Apple M-Series GPU",
        vendor: "Apple",
        vram_gb: 32.0,
        backend: "Metal",
        offload_supported: true,
      },
      accelerators: {
        dedicated: [],
        integrated: [
          {
            name: "Apple M-Series GPU",
            vendor: "Apple",
            type: "integrated",
            vram_gb: 32.0,
            supported: true,
          },
        ],
        npu: [],
      },
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("Apple Silicon · Metal");
    expect(container.textContent).toContain("Apple M-Series GPU");
    expect(container.textContent).toContain("32 GB VRAM · Metal");
  });

  it("renders modular CUDA download card when NVIDIA GPU is detected but offload is unsupported", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "NVIDIA GeForce RTX 4070 SUPER",
        vendor: "NVIDIA",
        vram_gb: 12.0,
        backend: "CUDA",
        offload_supported: false,
        engine_supported: false,
        package_required: "cuda",
        cuda_available: false,
      },
    });
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          vendor: "NVIDIA",
          download_size_bytes: 536551897,
          installed: false,
          recommended: true,
          status: { state: "idle", progress_pct: 0 },
        },
      ],
      engine_supported: false,
      offload_supported: false,
      active_backend: "CUDA",
    });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("Pack Required");
    expect(container.textContent).toContain("NVIDIA CUDA 12.4 Acceleration Pack");
    expect(container.querySelector('[data-testid="install-gpu-pack-btn"]')).not.toBeNull();
  });

  it("triggers installGpuPackage when download button is clicked", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "NVIDIA GeForce RTX 4070 SUPER",
        vendor: "NVIDIA",
        vram_gb: 12.0,
        backend: "CUDA",
        offload_supported: false,
        engine_supported: false,
        package_required: "cuda",
        cuda_available: false,
      },
    });
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          vendor: "NVIDIA",
          download_size_bytes: 536551897,
          installed: false,
          recommended: true,
          status: { state: "idle", progress_pct: 0 },
        },
      ],
      engine_supported: false,
      offload_supported: false,
      active_backend: "CUDA",
    });
    api.installGpuPackage.mockResolvedValue({ package: "cuda", state: "downloading" });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    const installBtn = container.querySelector('[data-testid="install-gpu-pack-btn"]');
    await act(async () => {
      installBtn.click();
    });

    expect(api.installGpuPackage).toHaveBeenCalledWith("cuda");
  });

  it("renders progress indicator when acceleration pack is downloading", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "NVIDIA GeForce RTX 4070 SUPER",
        vendor: "NVIDIA",
        vram_gb: 12.0,
        backend: "CUDA",
        offload_supported: false,
        engine_supported: false,
        package_required: "cuda",
        cuda_available: false,
      },
    });
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          vendor: "NVIDIA",
          download_size_bytes: 536551897,
          installed: false,
          recommended: true,
          status: { state: "downloading", progress_pct: 45.5, bytes_done: 244131113, bytes_total: 536551897, speed_mbps: 32.4 },
        },
      ],
      engine_supported: false,
      offload_supported: false,
      active_backend: "CUDA",
    });
    api.cancelGpuPackageInstall.mockResolvedValue({ package: "cuda", state: "cancelled" });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("Downloading");
    expect(container.textContent).toContain("45.5%");
    const cancelBtn = container.querySelector('[data-testid="cancel-gpu-pack-btn"]');
    expect(cancelBtn).not.toBeNull();

    await act(async () => {
      cancelBtn.click();
    });

    expect(api.cancelGpuPackageInstall).toHaveBeenCalledWith("cuda");
  });

  it("renders permanent Compute Acceleration section when GPU is active with Reinstall and Switch actions", async () => {
    api.getHardwareProfile.mockResolvedValue({
      ...mockHardwareData,
      gpu: {
        count: 1,
        name: "NVIDIA GeForce RTX 4070 SUPER",
        vendor: "NVIDIA",
        vram_gb: 12.0,
        backend: "CUDA",
        offload_supported: true,
        engine_supported: true,
        cuda_available: true,
      },
    });
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          backend: "CUDA",
          vendor: "NVIDIA",
          download_size_bytes: 536551897,
          installed: true,
          recommended: true,
          status: { state: "ready", progress_pct: 100 },
        },
        {
          id: "vulkan",
          name: "Vulkan GPU Acceleration Pack",
          backend: "Vulkan",
          vendor: "AMD/Intel",
          download_size_bytes: 42323234,
          installed: true,
          recommended: false,
          status: { state: "ready", progress_pct: 100 },
        },
      ],
      engine_supported: true,
      offload_supported: true,
      active_backend: "CUDA",
    });
    api.activateGpuPackage.mockResolvedValue({ success: true, active_package: "vulkan" });

    await act(async () => {
      root.render(<HardwareTab />);
    });

    expect(container.textContent).toContain("Compute Acceleration & Runtimes");
    expect(container.textContent).toContain("llama.cpp v0.3.34");
    expect(container.textContent).toContain("Downloaded");
    expect(container.textContent).toContain("Switch to Vulkan");

    const switchBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.includes("Switch to Vulkan")
    );
    expect(switchBtn).toBeDefined();

    // Verify in-flight switching indicator
    let resolveActivate;
    const activatePromise = new Promise((res) => { resolveActivate = res; });
    api.activateGpuPackage.mockReturnValueOnce(activatePromise);

    await act(async () => {
      switchBtn.click();
    });

    expect(container.textContent).toContain("Switching to Vulkan");
    expect(api.activateGpuPackage).toHaveBeenCalledWith("vulkan");

    await act(async () => {
      resolveActivate({ success: true, active_package: "vulkan" });
    });

    expect(container.textContent).toContain("Switched compute runtime to Vulkan");

    // Verify DotsThreeVertical menu contains Reinstall and Delete actions
    const menuBtn = container.querySelector('[data-testid="gpu-pack-menu-btn-cuda"]');
    expect(menuBtn).not.toBeNull();

    await act(async () => {
      menuBtn.click();
    });

    const reinstallBtn = container.querySelector('[data-testid="reinstall-gpu-pack-btn"]');
    expect(reinstallBtn).not.toBeNull();
    const uninstallBtn = container.querySelector('[data-testid="uninstall-gpu-pack-btn"]');
    expect(uninstallBtn).not.toBeNull();

    api.installGpuPackage.mockResolvedValue({ package: "cuda", state: "downloading" });
    await act(async () => {
      reinstallBtn.click();
    });
    expect(api.installGpuPackage).toHaveBeenCalledWith("cuda");

    // Test Delete (uninstall) with in-flight deleting indicator
    const vulkanMenuBtn = container.querySelector('[data-testid="gpu-pack-menu-btn-vulkan"]');
    expect(vulkanMenuBtn).not.toBeNull();

    await act(async () => {
      vulkanMenuBtn.click();
    });
    const deleteBtn = container.querySelector('[data-testid="uninstall-gpu-pack-btn"]');
    expect(deleteBtn).not.toBeNull();

    let resolveUninstall;
    const uninstallPromise = new Promise((res) => { resolveUninstall = res; });
    api.uninstallGpuPackage.mockReturnValueOnce(uninstallPromise);

    await act(async () => {
      deleteBtn.click();
    });

    expect(container.textContent).toContain("Deleting…");
    expect(api.uninstallGpuPackage).toHaveBeenCalledWith("vulkan");

    await act(async () => {
      resolveUninstall({ success: true });
    });

    expect(container.textContent).toContain("Vulkan runtime files removed");
  });
});
