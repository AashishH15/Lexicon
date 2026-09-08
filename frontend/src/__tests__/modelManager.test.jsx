// @vitest-environment jsdom
import { act } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock the API module
vi.mock("../api.js", () => ({
  getAiStatus: vi.fn(),
  downloadModel: vi.fn(),
  getModelStatus: vi.fn(),
  cancelModelDownload: vi.fn(),
  deleteModel: vi.fn(),
  cleanupLegacyModel: vi.fn(),
  setAiPreference: vi.fn(),
}));

import * as api from "../api.js";
import ModelManager from "../ModelManager.jsx";

describe("ModelManager Upgrade Popover & Storage Migration", () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("shows an arrows-clockwise Phosphor icon button (not literal text Upgrade) next to Delete", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      accuracy_gain: "+185%",
      size_diff: "+1.4 GB",
      upgrade_model_key: "2b",
      upgrade_tier_name: "Standard",
      models_ready: { "2b": true, "0.8b": false },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
          reclaim_size: "1.4 GB",
        },
        "0.8b": { upgrade_available: false },
      },
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    // Find the Standard tier card
    const standardCard = Array.from(container.querySelectorAll('[role="button"]')).find((el) =>
      el.textContent.includes("Standard")
    );
    expect(standardCard).toBeDefined();

    // Verify Delete button exists as Phosphor trash-simple icon button
    const deleteBtn = standardCard.querySelector('[data-testid="delete-button-2b"]');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn.querySelector("svg")).not.toBeNull();
    expect(deleteBtn.textContent.trim()).toBe("");
    expect(deleteBtn.getAttribute("aria-label")).toContain("Delete");

    // Verify Upgrade icon button exists next to Delete button
    const upgradeBtn = standardCard.querySelector('[data-testid="upgrade-button-2b"]');
    expect(upgradeBtn).not.toBeNull();
    // It should have an SVG icon (Phosphor arrows-clockwise)
    expect(upgradeBtn.querySelector("svg")).not.toBeNull();
    // It must NOT have the literal word "Upgrade" inside the button's visible text content
    expect(upgradeBtn.textContent.trim()).toBe("");
    expect(upgradeBtn.getAttribute("aria-label")).toContain("Upgrade");
  });

  it("shows upgrade icon button on BOTH Standard and Light cards when both legacy models are installed", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      accuracy_gain: "+185%",
      size_diff: "+1.4 GB",
      upgrade_model_key: "2b",
      upgrade_tier_name: "Standard",
      models_ready: { "2b": true, "0.8b": true },
      model_key: "2b", // Standard is selected
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
          reclaim_size: "1.4 GB",
        },
        "0.8b": {
          upgrade_available: true,
          accuracy_gain: "+140%",
          size_diff: "+320 MB",
          tier_name: "Light",
          reclaim_size: "840 MB",
        },
      },
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    // Verify Standard card has upgrade button
    const standardUpgradeBtn = container.querySelector('[data-testid="upgrade-button-2b"]');
    expect(standardUpgradeBtn).not.toBeNull();

    // Verify Light card ALSO has upgrade button even though Standard is selected!
    const lightUpgradeBtn = container.querySelector('[data-testid="upgrade-button-0.8b"]');
    expect(lightUpgradeBtn).not.toBeNull();
  });

  it("opens popover when Upgrade icon is clicked and closes on Keep Current", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      accuracy_gain: "+185%",
      size_diff: "+1.4 GB",
      upgrade_model_key: "2b",
      upgrade_tier_name: "Standard",
      models_ready: { "2b": true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
        },
      },
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    // Popover should not be visible initially
    expect(container.querySelector('[data-testid="upgrade-popover"]')).toBeNull();

    // Click Upgrade icon button on the Standard tier card
    const cardUpgradeBtn = container.querySelector('[data-testid="upgrade-button-2b"]');
    expect(cardUpgradeBtn).not.toBeNull();

    await act(async () => {
      cardUpgradeBtn.click();
    });

    // Popover is now visible!
    const popover = container.querySelector('[data-testid="upgrade-popover"]');
    expect(popover).not.toBeNull();
    expect(popover.textContent).toContain("Improved AI Model Available");
    expect(popover.textContent).toContain("+185% higher grammar accuracy");
    expect(popover.textContent).toContain("+1.4 GB storage difference");
    // Ensure no raw model filenames
    expect(popover.textContent).not.toContain("Qwen");
    expect(popover.textContent).not.toContain("GGUF");

    // Click Keep Current in the popover
    const keepBtn = Array.from(popover.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Keep Current")
    );
    expect(keepBtn).toBeDefined();

    await act(async () => {
      keepBtn.click();
    });

    // Popover goes away!
    expect(container.querySelector('[data-testid="upgrade-popover"]')).toBeNull();
  });

  it("exposes the upgrade prompt as a dialog and closes it with Escape", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      models_ready: { "2b": true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
        },
      },
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });
    await act(async () => {
      container.querySelector('[data-testid="upgrade-button-2b"]').click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("upgrade-popover-title");
    expect(dialog.querySelector("#upgrade-popover-title")).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(container.querySelector('[data-testid="upgrade-popover"]')).toBeNull();
  });

  it("cleans the upgrade polling interval when unmounted", async () => {
    vi.useFakeTimers();
    try {
      api.getAiStatus.mockResolvedValue({
        upgrade_available: true,
        models_ready: { "2b": true },
        model_key: "2b",
        preference: { backend: "bundled", model_key: "2b" },
        tier_upgrades: {
          "2b": {
            upgrade_available: true,
            accuracy_gain: "+185%",
            size_diff: "+1.4 GB",
            tier_name: "Standard",
          },
        },
      });
      api.downloadModel.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        root.render(<ModelManager mode="settings" />);
      });
      await act(async () => {
        container.querySelector('[data-testid="upgrade-button-2b"]').click();
      });
      await act(async () => {
        const upgradeButton = Array.from(container.querySelectorAll("button")).find(
          (button) => button.textContent.includes("Upgrade Model"),
        );
        upgradeButton.click();
      });

      api.getModelStatus.mockClear();
      root.unmount();
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      expect(api.getModelStatus).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("allows cancelling the upgrade while download is in-flight", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      accuracy_gain: "+185%",
      size_diff: "+1.4 GB",
      upgrade_model_key: "2b",
      upgrade_tier_name: "Standard",
      models_ready: { "2b": true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
          reclaim_size: "1.4 GB",
        },
      },
    });

    let resolveDownload;
    api.downloadModel.mockImplementation(() => new Promise((resolve) => {
      resolveDownload = resolve;
    }));
    api.cancelModelDownload.mockResolvedValue({ cancelled: true });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    // Open popover
    const cardUpgradeBtn = container.querySelector('[data-testid="upgrade-button-2b"]');
    await act(async () => {
      cardUpgradeBtn.click();
    });

    const popover = container.querySelector('[data-testid="upgrade-popover"]');
    const modalUpgradeBtn = Array.from(popover.querySelectorAll("button")).find(
      (b) => b.textContent.includes("Upgrade Model")
    );

    // Start upgrade download
    await act(async () => {
      modalUpgradeBtn.click();
    });

    // Cancel button should be visible during download
    const cancelUpgradeBtn = popover.querySelector('[data-testid="cancel-upgrade-button"]');
    expect(cancelUpgradeBtn).not.toBeNull();
    expect(cancelUpgradeBtn.textContent).toContain("Cancel");

    // Click Cancel
    await act(async () => {
      cancelUpgradeBtn.click();
    });

    expect(api.cancelModelDownload).toHaveBeenCalledWith("2b");

    // Clean up unresolved promise
    if (resolveDownload) {
      await act(async () => {
        resolveDownload({ state: "cancelled" });
      });
    }
  });

  it("downloads new model, verifies it, deletes old model, and displays completion inside popover", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: true,
      accuracy_gain: "+185%",
      size_diff: "+1.4 GB",
      upgrade_model_key: "2b",
      upgrade_tier_name: "Standard",
      models_ready: { "2b": true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {
        "2b": {
          upgrade_available: true,
          accuracy_gain: "+185%",
          size_diff: "+1.4 GB",
          tier_name: "Standard",
          reclaim_size: "1.4 GB",
        },
      },
    });

    api.downloadModel.mockResolvedValue({
      state: "ready",
      bytes_done: 3013027808,
      bytes_total: 3013027808,
      legacy_reclaimed: true,
      reclaimed_message: "Upgrade complete! Removed previous model file to reclaim 1.4 GB of disk space.",
    });

    api.getModelStatus.mockResolvedValue({
      state: "ready",
      bytes_done: 3013027808,
      bytes_total: 3013027808,
    });

    const onPreferenceChange = vi.fn();

    await act(async () => {
      root.render(<ModelManager mode="settings" onPreferenceChange={onPreferenceChange} />);
    });

    // Open popover from tier card
    const cardUpgradeBtn = container.querySelector('[data-testid="upgrade-button-2b"]');
    await act(async () => {
      cardUpgradeBtn.click();
    });

    const popover = container.querySelector('[data-testid="upgrade-popover"]');
    const modalUpgradeBtn = Array.from(popover.querySelectorAll("button")).find(
      (b) => b.textContent.includes("Upgrade Model") || b.textContent.trim() === "Upgrade"
    );

    await act(async () => {
      modalUpgradeBtn.click();
    });

    expect(api.downloadModel).toHaveBeenCalledWith("2b");

    // Inside the popover, shows Upgrade complete message!
    expect(popover.textContent).toContain(
      "Upgrade complete! Removed previous model file to reclaim 1.4 GB of disk space."
    );

    // Done button closes the popover
    const doneBtn = Array.from(popover.querySelectorAll("button")).find((b) =>
      b.textContent.includes("Done") || b.textContent.includes("Close")
    );
    expect(doneBtn).toBeDefined();

    await act(async () => {
      doneBtn.click();
    });

    expect(container.querySelector('[data-testid="upgrade-popover"]')).toBeNull();
  });

  it("renders all 3 model tiers (Light, Standard, Quality) with accurate sizes", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: false,
      models_ready: { "2b": false, "0.8b": false, quality: false },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b" },
      tier_upgrades: {},
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    const tierCards = Array.from(container.querySelectorAll('[role="button"]'));
    const standardCard = tierCards.find((el) => el.textContent.includes("Standard"));
    const lightCard = tierCards.find((el) => el.textContent.includes("Light"));
    const qualityCard = tierCards.find((el) => el.textContent.includes("Quality"));

    expect(standardCard).toBeDefined();
    expect(lightCard).toBeDefined();
    expect(qualityCard).toBeDefined();

    // Verify sizes and VRAM recommendations in copy
    expect(standardCard.textContent).toContain("~3.0 GB");
    expect(standardCard.textContent).toContain("Fits ~6 GB VRAM");
    expect(lightCard.textContent).toContain("~1.15 GB");
    expect(lightCard.textContent).toContain("Fits ~2 GB VRAM");
    expect(qualityCard.textContent).toContain("~16.5 GB");
    expect(qualityCard.textContent).toContain("Needs ~18 GB VRAM");
  });

  it("allows selecting Quality tier and triggers preference change when installed", async () => {
    api.getAiStatus.mockResolvedValue({
      upgrade_available: false,
      models_ready: { "2b": true, "0.8b": false, quality: true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b", device: "gpu" },
      tier_upgrades: {},
    });

    const onPreferenceChange = vi.fn();

    await act(async () => {
      root.render(<ModelManager mode="settings" onPreferenceChange={onPreferenceChange} />);
    });

    const tierCards = Array.from(container.querySelectorAll('[role="button"]'));
    const qualityCard = tierCards.find((el) => el.textContent.includes("Quality"));

    await act(async () => {
      qualityCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onPreferenceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: "bundled",
        model_key: "quality",
      })
    );
  });

  it("renders recommended tier badge on the recommended tier card based on hardware", async () => {    api.getAiStatus.mockResolvedValue({
      upgrade_available: false,
      models_ready: { "2b": true },
      model_key: "2b",
      preference: { backend: "bundled", model_key: "2b", device: "gpu" },
      hardware: {
        recommended_tier: {
          key: "2b",
          label: "Standard",
          badge: "Recommended for your hardware",
          reason: "Fits 100% in VRAM",
        },
      },
      gpu_info: {
        has_gpu: true,
        gpu_name: "NVIDIA GeForce RTX 4070 SUPER",
        vram_gb: 11.99,
        recommended_tier: { key: "2b" },
      },
    });

    await act(async () => {
      root.render(<ModelManager mode="settings" />);
    });

    const badge = container.querySelector('[data-testid="recommended-tier-2b"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain("Recommended");
  });
});

describe("ModelManager tier switching feedback", () => {
  let container;
  let root;

  function statusWith(prefKey) {
    return {
      ollama_available: false,
      lmstudio_available: false,
      lmstudio_server_available: false,
      lmstudio_auth_required: false,
      lmstudio_models: [],
      lmstudio_loaded_models: [],
      models_ready: { "2b": true, quality: true, "0.8b": true },
      model_key: prefKey,
      active_backend: "bundled",
      preference: { backend: "bundled", model_key: prefKey },
    };
  }

  function tierCard(name) {
    return Array.from(container.querySelectorAll('[role="button"]')).find(
      (el) => el.textContent.includes(name),
    );
  }

  async function mountManager(onPreferenceChange) {
    api.getAiStatus.mockResolvedValue(statusWith("2b"));
    await act(async () => {
      root.render(
        <ModelManager
          mode="settings"
          onPreferenceChange={onPreferenceChange}
          onConfigured={vi.fn()}
        />,
      );
    });
    expect(api.getAiStatus).toHaveBeenCalledTimes(1);
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows Switching to Quality while the save is in flight", async () => {
    let resolveSave;
    const gate = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const onPreferenceChange = vi.fn(() => gate);
    await mountManager(onPreferenceChange);

    await act(async () => {
      tierCard("Quality").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(onPreferenceChange).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: "bundled",
        model_key: "quality",
        device: "gpu",
      }),
    );
    expect(container.textContent).toContain("Switching to Quality");
    expect(api.getAiStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave({});
    });
  });

  it("refreshes only after the save resolves, then shows the new tier", async () => {
    let resolveSave;
    const gate = new Promise((resolve) => {
      resolveSave = resolve;
    });
    await mountManager(vi.fn(() => gate));

    await act(async () => {
      tierCard("Quality").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(api.getAiStatus).toHaveBeenCalledTimes(1);

    api.getAiStatus.mockResolvedValueOnce(statusWith("quality"));
    await act(async () => {
      resolveSave({});
    });

    expect(api.getAiStatus).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Using local model · Quality");
    expect(container.textContent).not.toContain("Switching to");
  });

  it("labels the active tier from saved preference, not the local pick", async () => {
    let resolveSave;
    const gate = new Promise((resolve) => {
      resolveSave = resolve;
    });
    await mountManager(vi.fn(() => gate));

    expect(container.textContent).toContain("Standard is installed and active.");

    await act(async () => {
      tierCard("Quality").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(container.textContent).toContain("Standard is installed and active.");
    expect(container.textContent).not.toContain("Quality is installed and active.");

    api.getAiStatus.mockResolvedValueOnce(statusWith("quality"));
    await act(async () => {
      resolveSave({});
    });
    expect(container.textContent).toContain("Quality is installed and active.");
  });

  it("clears the switching flag when the save fails", async () => {
    await mountManager(vi.fn(() => Promise.reject(new Error("nope"))));

    await act(async () => {
      tierCard("Quality").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.textContent).not.toContain("Switching to");
    expect(api.getAiStatus).toHaveBeenCalledTimes(2);
  });
});

describe("ModelManager seeded status", () => {
  let container;
  let root;

  function seedWith(prefKey) {
    return {
      ollama_available: false,
      lmstudio_available: false,
      lmstudio_server_available: false,
      lmstudio_auth_required: false,
      lmstudio_models: [],
      lmstudio_loaded_models: [],
      models_ready: { "2b": true, quality: true, "0.8b": true },
      model_key: prefKey,
      active_backend: "bundled",
      preference: { backend: "bundled", model_key: prefKey },
    };
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("paints the known answer at once with no checking row", async () => {
    let resolveRefresh;
    api.getAiStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () => resolve(seedWith("quality"));
        }),
    );
    await act(async () => {
      root.render(
        <ModelManager
          mode="settings"
          initialStatus={seedWith("quality")}
          onPreferenceChange={vi.fn()}
          onConfigured={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain("Using local model · Quality");
    expect(container.textContent).not.toContain("Checking AI status");
    expect(api.getAiStatus).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRefresh();
    });
    expect(container.textContent).toContain("Using local model · Quality");
  });

  it("refreshes quietly when the seed is stale", async () => {
    api.getAiStatus.mockResolvedValue(seedWith("quality"));
    await act(async () => {
      root.render(
        <ModelManager
          mode="settings"
          initialStatus={seedWith("2b")}
          onPreferenceChange={vi.fn()}
          onConfigured={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain("Using local model · Quality");
    expect(container.textContent).not.toContain("Checking AI status");
  });

  it("keeps the seed when the background refresh fails", async () => {
    api.getAiStatus.mockRejectedValue(new Error("offline"));
    await act(async () => {
      root.render(
        <ModelManager
          mode="settings"
          initialStatus={seedWith("2b")}
          onPreferenceChange={vi.fn()}
          onConfigured={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain("Using local model · Standard");
  });
});
