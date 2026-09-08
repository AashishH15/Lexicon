// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Settings, { SETTINGS_DEFAULTS } from "../Settings.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  getAiStatus: vi.fn(),
  downloadModel: vi.fn(),
  getModelStatus: vi.fn(),
  cancelModelDownload: vi.fn(),
  deleteModel: vi.fn(),
  cleanupLegacyModel: vi.fn(),
  setAiPreference: vi.fn(),
  getHardwareProfile: vi.fn(),
  setHardwareSettings: vi.fn(),
  openExternalUrl: vi.fn(),
}));

import * as api from "../api.js";

let container;
let root;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api.getAiStatus.mockResolvedValue({
    ollama_available: false,
    lmstudio_available: false,
    lmstudio_server_available: false,
    lmstudio_auth_required: false,
    lmstudio_models: [],
    lmstudio_loaded_models: [],
    models_ready: { "2b": true },
    model_key: "2b",
    active_backend: "bundled",
    preference: { backend: "bundled", model_key: "2b" },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function settingsProps(overrides = {}) {
  const noop = () => {};
  return {
    open: true,
    language: SETTINGS_DEFAULTS.language,
    onLanguageChange: noop,
    fontSize: SETTINGS_DEFAULTS.fontSize,
    onFontSizeChange: noop,
    lineSpacing: SETTINGS_DEFAULTS.lineSpacing,
    onLineSpacingChange: noop,
    focusMode: false,
    onFocusModeChange: noop,
    proseScanEnabled: true,
    onProseScanChange: noop,
    betaOptIn: false,
    onBetaOptInChange: noop,
    docxAuthor: "",
    onDocxAuthorChange: noop,
    typographyPreset: SETTINGS_DEFAULTS.typographyPreset,
    onTypographyPresetChange: noop,
    paperTexture: SETTINGS_DEFAULTS.paperTexture,
    onPaperTextureChange: noop,
    readingMode: SETTINGS_DEFAULTS.readingMode,
    onReadingModeChange: noop,
    onShortcutChange: noop,
    onResetShortcut: noop,
    onResetAllShortcuts: noop,
    onResetDefaults: noop,
    onCheckForUpdates: noop,
    updateState: { status: "idle", update: null, message: "", progress: null, dismissed: false },
    onClose: noop,
    focusSettingKey: null,
    onFocusSettingConsumed: noop,
    userDictionary: [],
    onAddWord: noop,
    onRemoveWord: noop,
    documentHistory: [],
    transformHistory: [],
    autoDraftMode: true,
    onAutoDraftModeChange: noop,
    onManualSave: noop,
    onReapplyTransform: noop,
    onToggleDraftLock: noop,
    onToggleTransformLock: noop,
    onClearDrafts: noop,
    onClearTransforms: noop,
    ...overrides,
  };
}

describe("Settings engine deep link", () => {
  it("opens Lex's Engine for the lex-engine-section key", async () => {
    const onFocusSettingConsumed = vi.fn();
    await act(async () => {
      root.render(
        <Settings
          {...settingsProps({
            focusSettingKey: "lex-engine-section",
            onFocusSettingConsumed,
          })}
        />,
      );
    });
    expect(container.textContent).toContain("Lex's Engine");
    expect(container.textContent).toContain(
      "Finest phrasing precision and prose polish.",
    );
    expect(onFocusSettingConsumed).toHaveBeenCalled();
  });

  it("stays on General without a focus key", async () => {
    await act(async () => {
      root.render(<Settings {...settingsProps()} />);
    });
    expect(container.textContent).not.toContain(
      "Finest phrasing precision and prose polish.",
    );
  });
});
