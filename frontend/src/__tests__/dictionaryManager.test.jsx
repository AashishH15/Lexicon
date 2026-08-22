// @vitest-environment jsdom
import { act } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import Settings from "../Settings.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeProps(overrides = {}) {
  return {
    open: true,
    language: "en-US",
    onLanguageChange: vi.fn(),
    fontSize: 16,
    onFontSizeChange: vi.fn(),
    lineSpacing: 1.6,
    onLineSpacingChange: vi.fn(),
    focusMode: false,
    onFocusModeChange: vi.fn(),
    proseScanEnabled: false,
    onProseScanChange: vi.fn(),
    betaOptIn: false,
    onBetaOptInChange: vi.fn(),
    docxAuthor: "",
    onDocxAuthorChange: vi.fn(),
    typographyPreset: "current",
    onTypographyPresetChange: vi.fn(),
    paperTexture: "plain-white",
    onPaperTextureChange: vi.fn(),
    readingMode: "off",
    onReadingModeChange: vi.fn(),
    onResetDefaults: vi.fn(),
    onCheckForUpdates: vi.fn(),
    updateState: {
      status: "idle",
      update: null,
      message: "",
      progress: null,
      dismissed: false,
    },
    onClose: vi.fn(),
    focusSettingKey: null,
    onFocusSettingConsumed: vi.fn(),
    userDictionary: ["DesktopWord"],
    onAddWord: vi.fn(() => "added"),
    onRemoveWord: vi.fn(),
    documentHistory: [],
    transformHistory: [],
    autoDraftMode: true,
    onAutoDraftModeChange: vi.fn(),
    onManualSave: vi.fn(),
    onRestoreDraft: vi.fn(),
    onReapplyTransform: vi.fn(),
    onToggleDraftLock: vi.fn(),
    onToggleTransformLock: vi.fn(),
    onClearDrafts: vi.fn(),
    onClearTransforms: vi.fn(),
    ...overrides,
  };
}

describe("desktop dictionary manager", () => {
  it("shows canonical words and sends add/remove actions", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const props = makeProps();

    await act(async () => {
      root.render(<Settings {...props} />);
    });
    const dictionaryTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.includes("Your Dictionary"),
    );
    await act(async () => {
      dictionaryTab.click();
    });

    expect(container.textContent).toContain("DesktopWord");
    const remove = container.querySelector(
      '[aria-label="Remove DesktopWord from dictionary"]',
    );
    await act(async () => {
      remove.click();
    });
    expect(props.onRemoveWord).toHaveBeenCalledWith("DesktopWord");

    const input = container.querySelector(
      '[aria-label="Add a word to the dictionary"]',
    );
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setInputValue.call(input, "NewWord");
    await act(async () => {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector('[aria-label="Add word to dictionary"]')
        .click();
    });
    expect(props.onAddWord).toHaveBeenCalledWith("NewWord");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
