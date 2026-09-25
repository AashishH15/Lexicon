// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ReviewPanel from "../ReviewPanel.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  openExternalUrl: vi.fn(),
}));

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function panelProps(overrides = {}) {
  const noop = () => {};
  return {
    editor: null,
    activeTool: "Summary",
    grammarMatches: [],
    checking: false,
    backendOffline: false,
    backendError: "",
    lexStatus: "idle",
    lexStatusLabel: "",
    onRetry: noop,
    userResolvedAll: false,
    activeErrorId: null,
    aboutToCollapse: false,
    onApply: noop,
    onDismiss: noop,
    onAcceptAll: noop,
    onDismissAll: noop,
    onAddToDictionary: noop,
    onLocate: noop,
    onCollapse: null,
    onAiRewrite: null,
    onClear: noop,
    transformResults: [],
    transformProgress: null,
    transformRunning: false,
    transformStatus: "idle",
    transformError: "",
    onApplyTransform: noop,
    onDismissTransform: noop,
    onReviewTransform: noop,
    deepMatches: [],
    deepRunning: false,
    deepProgress: null,
    deepError: "",
    deepWarning: "",
    onCancelDeep: null,
    onRetryDeep: noop,
    autoRecheck: false,
    onToggleAutoRecheck: noop,
    proofreadAutoRecheck: true,
    onToggleProofreadAutoRecheck: noop,
    ...overrides,
  };
}

async function renderPanel(props) {
  await act(async () => {
    root.render(<ReviewPanel {...panelProps(props)} />);
  });
}

describe("TransformCard structure actions", () => {
  it("renders whole-draft actions and confirms draft replacement", async () => {
    const onApplyTransform = vi.fn();
    const card = {
      tool: "Summary",
      text: "Brief executive summary.",
      from: 0,
      to: 100,
      part: 1,
      total: 1,
      isSelection: false,
    };
    await renderPanel({
      activeTool: "Summary",
      transformResults: [card],
      onApplyTransform,
    });

    expect(container.textContent).toContain("Entire draft");
    const insertTop = container.querySelector(
      "button[aria-label='Insert at top of draft']",
    );
    expect(insertTop).not.toBe(null);

    await act(async () => {
      insertTop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onApplyTransform).toHaveBeenCalledWith(card, "top");

    const replaceBtn = container.querySelector(
      "button[aria-label='Replace entire draft']",
    );
    expect(replaceBtn).not.toBe(null);
    expect(replaceBtn.textContent).toContain("Replace entire draft");

    // First click: prompts for confirmation, does not apply yet
    await act(async () => {
      replaceBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onApplyTransform).toHaveBeenCalledTimes(1); // from insertTop only
    expect(container.textContent).toContain("Overwrite entire draft?");

    const cancelBtn = container.querySelector(
      "button[aria-label='Cancel replacement']",
    );
    expect(cancelBtn).not.toBe(null);

    const confirmBtn = container.querySelector(
      "button[aria-label='Confirm replace entire draft']",
    );
    expect(confirmBtn).not.toBe(null);
    expect(confirmBtn.textContent).toContain("Yes, replace all");

    // Second click: confirms replacement
    await act(async () => {
      confirmBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onApplyTransform).toHaveBeenCalledTimes(2);
    expect(onApplyTransform).toHaveBeenLastCalledWith(card, "replace");
  });

  it("renders selection actions for targeted highlights", async () => {
    const onApplyTransform = vi.fn();
    const card = {
      tool: "Table",
      text: "| Col | Val |\n| --- | --- |\n| 1 | A |",
      from: 10,
      to: 50,
      part: 1,
      total: 1,
      isSelection: true,
    };
    await renderPanel({
      activeTool: "Table",
      transformResults: [card],
      onApplyTransform,
    });

    expect(container.textContent).toContain("Selected text");
    const replaceBtn = container.querySelector(
      "button[aria-label='Replace selection']",
    );
    const insertBelow = container.querySelector(
      "button[aria-label='Insert below selection']",
    );
    expect(replaceBtn).not.toBe(null);
    expect(insertBelow).not.toBe(null);

    await act(async () => {
      replaceBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onApplyTransform).toHaveBeenCalledWith(card, "replace");

    await act(async () => {
      insertBelow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onApplyTransform).toHaveBeenCalledWith(card, "below");
  });

  it("copies text to clipboard with feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    const card = {
      tool: "Key Points",
      text: "- Point 1\n- Point 2",
      from: 0,
      to: 80,
      part: 1,
      total: 1,
    };
    await renderPanel({
      activeTool: "Key Points",
      transformResults: [card],
    });

    const copyBtn = container.querySelector(
      "button[aria-label='Copy to clipboard']",
    );
    expect(copyBtn).not.toBe(null);

    await act(async () => {
      copyBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(writeText).toHaveBeenCalledWith(card.text);
    expect(copyBtn.textContent).toContain("Copied");
  });
});
