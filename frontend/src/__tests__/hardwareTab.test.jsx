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
});
