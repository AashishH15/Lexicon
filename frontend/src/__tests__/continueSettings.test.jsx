// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Settings from "../Settings.jsx";
import CustomToolsSettings from "../CustomToolsSettings.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeProps(overrides = {}) {
  const noop = () => {};
  return {
    open: true,
    language: "en-US",
    onLanguageChange: noop,
    fontSize: 16,
    onFontSizeChange: noop,
    lineSpacing: 1.6,
    onLineSpacingChange: noop,
    focusMode: false,
    onFocusModeChange: noop,
    proseScanEnabled: true,
    onProseScanChange: noop,
    betaOptIn: false,
    onBetaOptInChange: noop,
    docxAuthor: "Lex",
    onDocxAuthorChange: noop,
    typographyPreset: "default",
    onTypographyPresetChange: noop,
    paperTexture: "plain-white",
    onPaperTextureChange: noop,
    readingMode: "off",
    onReadingModeChange: noop,
    shortcuts: {},
    onShortcutChange: noop,
    onResetShortcut: noop,
    onResetAllShortcuts: noop,
    onResetDefaults: noop,
    onCheckForUpdates: noop,
    updateState: { status: "idle" },
    onClose: noop,
    focusSettingKey: null,
    onFocusSettingConsumed: noop,
    initialAiStatus: null,
    userDictionary: [],
    onAddWord: noop,
    onRemoveWord: noop,
    documentHistory: [],
    transformHistory: [],
    autoDraftMode: false,
    onAutoDraftModeChange: noop,
    onManualSave: noop,
    onRestoreDraft: noop,
    onReapplyTransform: noop,
    onToggleDraftLock: noop,
    onToggleTransformLock: noop,
    onClearDrafts: noop,
    onClearTransforms: noop,
    continueLength: "auto",
    onContinueLengthChange: noop,
    continueAuto: false,
    onContinueAutoChange: noop,
    continueIdleSeconds: 8,
    onContinueIdleSecondsChange: noop,
    ...overrides,
  };
}

describe("Settings Continue tab", () => {
  it("changes length and auto through callbacks", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const props = makeProps({
      onContinueLengthChange: vi.fn(),
      onContinueAutoChange: vi.fn(),
    });

    await act(async () => {
      root.render(<Settings {...props} />);
    });
    const tab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Continue",
    );
    expect(tab).not.toBe(null);
    await act(async () => {
      tab.click();
    });

    const sentence = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Sentence",
    );
    expect(sentence).not.toBe(null);
    await act(async () => {
      sentence.click();
    });
    expect(props.onContinueLengthChange).toHaveBeenCalledWith("sentence");

    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).not.toBe(null);
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onContinueAutoChange).toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("changes the auto delay through its callback", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const props = makeProps({ onContinueIdleSecondsChange: vi.fn() });

    await act(async () => {
      root.render(<Settings {...props} />);
    });
    const tab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Continue",
    );
    await act(async () => {
      tab.click();
    });

    const slider = container.querySelector(
      'input[aria-label="Auto Continue delay in seconds"]',
    );
    expect(slider).not.toBe(null);
    expect(slider.getAttribute("min")).toBe("5");
    expect(slider.getAttribute("max")).toBe("60");
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    await act(async () => {
      setValue.call(slider, "17");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(props.onContinueIdleSecondsChange).toHaveBeenCalledWith(17);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("edits Continue and Expand base prompts in place", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Settings {...makeProps()} />);
    });
    const tab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Continue",
    );
    await act(async () => {
      tab.click();
    });

    for (const name of ["Continue", "Expand"]) {
      const toggle = container.querySelector(
        `button[aria-label='Edit prompt for ${name}']`,
      );
      expect(toggle).not.toBe(null);
    }

    const toggle = container.querySelector(
      "button[aria-label='Edit prompt for Continue']",
    );
    await act(async () => {
      toggle.click();
    });
    const area = container.querySelector(
      "textarea[aria-label='Edit prompt for Continue']",
    );
    expect(area).not.toBe(null);
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set;
    await act(async () => {
      setValue.call(area, "Custom continue instruction.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Save Prompt",
    );
    await act(async () => {
      save.click();
    });
    const stored = JSON.parse(
      localStorage.getItem("lexicon:prompt_overrides") || "{}",
    );
    expect(stored.Continue).toBe("Custom continue instruction.");
    localStorage.removeItem("lexicon:prompt_overrides");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps Continue and Expand out of Custom Actions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CustomToolsSettings />);
    });
    const builtinTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.includes("Built-in"),
    );
    expect(builtinTab).not.toBe(null);
    await act(async () => {
      builtinTab.click();
    });

    expect(container.textContent).toContain("Rewrite");
    expect(
      container.querySelector("button[aria-label='Edit prompt for Continue']"),
    ).toBe(null);
    expect(
      container.querySelector("button[aria-label='Edit prompt for Expand']"),
    ).toBe(null);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
