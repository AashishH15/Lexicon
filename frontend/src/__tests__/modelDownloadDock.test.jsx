// @vitest-environment jsdom
import { act } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ModelDownloadDock from "../ModelDownloadDock.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ModelDownloadDock", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const defaultState = {
    isDownloading: true,
    modelKey: "2b",
    tierLabel: "Standard",
    state: "downloading",
    bytesDone: 1500000000,
    bytesTotal: 3000000000,
    progressPct: 50,
    error: null,
    isComplete: false,
  };

  it("renders progress bar, tier label, and percentage when downloading", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={defaultState}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Downloading Lexicon Model");
    expect(container.textContent).toContain("Standard");
    expect(container.textContent).toContain("50%");
    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar).not.toBeNull();
    expect(progressbar.getAttribute("aria-valuenow")).toBe("50");
  });

  it("calls onOpenSettings when clicking the card", async () => {
    const onOpen = vi.fn();
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={defaultState}
          onOpenSettings={onOpen}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    const card = container.querySelector('[data-testid="model-download-dock"]');
    expect(card).not.toBeNull();
    await act(async () => {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when clicking the Cancel button without triggering onOpenSettings", async () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={defaultState}
          onOpenSettings={onOpen}
          onCancel={onCancel}
          onDismiss={vi.fn()}
        />
      );
    });

    const cancelBtn = container.querySelector('button[aria-label="Cancel download"]');
    expect(cancelBtn).not.toBeNull();
    await act(async () => {
      cancelBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders verifying state", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={{
            ...defaultState,
            state: "verifying",
            progressPct: 100,
          }}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Verifying Model");
  });

  it("renders completion state with ready message", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={{
            ...defaultState,
            isDownloading: false,
            isComplete: true,
            state: "ready",
          }}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Model Ready");
    expect(container.textContent).toContain("AI tools are enabled");
  });

  it("renders error state with dismiss action", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={{
            ...defaultState,
            isDownloading: false,
            error: "Connection reset by peer",
          }}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={onDismiss}
        />
      );
    });

    expect(container.textContent).toContain("Download Failed");
    expect(container.textContent).toContain("Connection reset by peer");
    const dismissBtn = container.querySelector('button[aria-label="Dismiss message"]');
    expect(dismissBtn).not.toBeNull();
    await act(async () => {
      dismissBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders GPU package downloading state with hardware link", async () => {
    const onOpen = vi.fn();
    const gpuState = {
      type: "gpu",
      isDownloading: true,
      packageName: "NVIDIA CUDA 12.4 Acceleration Pack",
      backend: "CUDA",
      state: "downloading",
      bytesDone: 200000000,
      bytesTotal: 536000000,
      progressPct: 37,
      error: null,
      isComplete: false,
    };

    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={gpuState}
          onOpenSettings={onOpen}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Downloading GPU Pack");
    expect(container.textContent).toContain("CUDA");
    expect(container.textContent).toContain("37%");
    expect(container.textContent).toContain("View in Hardware Settings");

    const card = container.querySelector('[data-testid="model-download-dock"]');
    await act(async () => {
      card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledWith("hardware");
  });

  it("renders GPU package extracting and ready states", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={{
            type: "gpu",
            isDownloading: true,
            backend: "Vulkan",
            state: "extracting",
            bytesDone: 42000000,
            bytesTotal: 42000000,
            progressPct: 99,
          }}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("Extracting GPU Pack");

    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={{
            type: "gpu",
            isDownloading: false,
            backend: "Vulkan",
            state: "ready",
            isComplete: true,
          }}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain("GPU Acceleration Ready");
    expect(container.textContent).toContain("GPU acceleration is active");
  });

  it("includes lex-download-dock class for paper texture styling without rogue dark mode", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={defaultState}
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    const card = container.querySelector('[data-testid="model-download-dock"]');
    expect(card.classList.contains("lex-download-dock")).toBe(true);
    expect(card.className).not.toContain("dark:bg-zinc-900");
  });

  it("supports custom className for stacked dock layouts", async () => {
    await act(async () => {
      root.render(
        <ModelDownloadDock
          downloadState={defaultState}
          className="custom-stack-item"
          onOpenSettings={vi.fn()}
          onCancel={vi.fn()}
          onDismiss={vi.fn()}
        />
      );
    });

    const card = container.querySelector('[data-testid="model-download-dock"]');
    expect(card.classList.contains("custom-stack-item")).toBe(true);
  });
});

