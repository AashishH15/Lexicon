// @vitest-environment jsdom
import { act } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingModal from "../OnboardingModal.jsx";
import * as api from "../api.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGpuPackages: vi.fn(),
    installGpuPackage: vi.fn(),
    getAiStatus: vi.fn().mockResolvedValue({
      models_ready: { "2b": false },
      preference: { backend: "auto", model_key: "2b" },
      active_backend: "bundled",
    }),
  };
});

describe("OnboardingModal Dynamic GPU Acceleration Step", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("shows 5 steps and skips GPU step when no GPU packages are available", async () => {
    api.getGpuPackages.mockResolvedValue({ packages: [] });

    await act(async () => {
      root.render(<OnboardingModal onClose={vi.fn()} onFinish={vi.fn()} />);
    });

    expect(container.textContent).toContain("Step 1 of 5");
  });

  it("shows 5 steps and skips GPU step when GPU packages are already installed", async () => {
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          installed: true,
          recommended: true,
        },
      ],
    });

    await act(async () => {
      root.render(<OnboardingModal onClose={vi.fn()} onFinish={vi.fn()} />);
    });

    expect(container.textContent).toContain("Step 1 of 5");
  });

  it("shows 6 steps and includes GPU step when an uninstalled GPU package is detected", async () => {
    api.getGpuPackages.mockResolvedValue({
      packages: [
        {
          id: "cuda",
          name: "NVIDIA CUDA 12.4 Acceleration Pack",
          backend: "CUDA",
          vendor: "NVIDIA",
          download_size_bytes: 536551897,
          installed: false,
          recommended: true,
          description: "Enables Tensor Core and fast VRAM offload on NVIDIA GeForce / RTX GPUs.",
        },
      ],
    });

    await act(async () => {
      root.render(<OnboardingModal onClose={vi.fn()} onFinish={vi.fn()} />);
    });

    expect(container.textContent).toContain("Step 1 of 6");
  });

  it("navigates to Step 5, displays GPU package info, and starts download", async () => {
    const pkg = {
      id: "cuda",
      name: "NVIDIA CUDA 12.4 Acceleration Pack",
      backend: "CUDA",
      vendor: "NVIDIA",
      download_size_bytes: 536551897,
      installed: false,
      recommended: true,
      description: "Enables Tensor Core and fast VRAM offload on NVIDIA GeForce / RTX GPUs.",
    };
    api.getGpuPackages.mockResolvedValue({ packages: [pkg] });
    api.installGpuPackage.mockResolvedValue({ package: "cuda", state: "downloading" });

    const eventListener = vi.fn();
    window.addEventListener("lexicon:gpu-download-start", eventListener);

    await act(async () => {
      root.render(<OnboardingModal onClose={vi.fn()} onFinish={vi.fn()} />);
    });

    // Advance from Step 1 -> 2 -> 3 -> 4
    for (let i = 1; i <= 3; i++) {
      const continueBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Continue")
      );
      expect(continueBtn).toBeTruthy();
      await act(async () => {
        continueBtn.click();
      });
    }

    // Step 4 is ModelManager: click "Skip AI Setup" or "Continue" to go to Step 5
    const skipAiBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Skip AI Setup")
    );
    expect(skipAiBtn).toBeTruthy();
    await act(async () => {
      skipAiBtn.click();
    });

    expect(container.textContent).toContain("Step 5 of 6");
    expect(container.textContent).toContain("GPU Hardware Acceleration");
    expect(container.textContent).toContain("NVIDIA CUDA 12.4 Acceleration Pack");

    // Click "Download & Enable GPU Acceleration"
    const dlBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Download & Enable GPU Acceleration")
    );
    expect(dlBtn).toBeTruthy();
    await act(async () => {
      dlBtn.click();
    });

    expect(api.installGpuPackage).toHaveBeenCalledWith("cuda");
    expect(eventListener).toHaveBeenCalled();

    // Click "Continue" to advance to Step 6
    const continueBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Continue")
    );
    expect(continueBtn).toBeTruthy();
    await act(async () => {
      continueBtn.click();
    });

    expect(container.textContent).toContain("Step 6 of 6");
    expect(container.textContent).toContain("You're Ready to Write!");

    window.removeEventListener("lexicon:gpu-download-start", eventListener);
  });
});
