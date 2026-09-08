// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import Toolbar from "../Toolbar.jsx";
import { EXPRESS_TOOL_NAME } from "../useExpress.js";
import {
  getDefaultShortcutBindings,
  SHORTCUT_IDS,
} from "../shortcuts.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function baseProps(overrides = {}) {
  return {
    editor: null,
    activeTool: "",
    onToolClick: vi.fn(),
    onAiSetup: vi.fn(),
    aiConfigured: true,
    panelWidth: 256,
    isMac: false,
    proofreadShortcut:
      getDefaultShortcutBindings()[SHORTCUT_IDS.TRIGGER_PROOFREAD],
    isWarming: false,
    transformRunning: false,
    ...overrides,
  };
}

async function renderToolbar(props) {
  await act(async () => {
    root.render(<Toolbar {...props} />);
  });
}

function expressButton() {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent.trim() === EXPRESS_TOOL_NAME,
  );
}

describe("Toolbar Express entry", () => {
  it("names the tool Express in English", () => {
    expect(EXPRESS_TOOL_NAME).toBe("Express in English");
  });

  it("lists Express in English under Refinement", async () => {
    await renderToolbar(baseProps());
    const button = expressButton();
    expect(button).not.toBe(undefined);
    const group = button.closest("div");
    expect(group.textContent).toContain("Refinement");
  });

  it("fires onToolClick with the Express tool name", async () => {
    const props = baseProps();
    await renderToolbar(props);
    await act(async () => {
      expressButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onToolClick).toHaveBeenCalledWith(EXPRESS_TOOL_NAME);
  });

  it("locks Express when AI is not configured", async () => {
    const props = baseProps({ aiConfigured: false });
    await renderToolbar(props);
    const button = expressButton();
    expect(button.disabled).toBe(true);
    expect(button.title).toContain("Set up");
  });
});
