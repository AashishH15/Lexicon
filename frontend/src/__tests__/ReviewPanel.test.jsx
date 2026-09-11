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
    activeTool: "Deep Proofread",
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

describe("ReviewPanel deep empty state", () => {
  it("offers Check again and calls the retry handler", async () => {
    const onRetryDeep = vi.fn();
    await renderPanel({ onRetryDeep });
    const button = container.querySelector(
      "button[aria-label='Check draft again']",
    );
    expect(button).not.toBe(null);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetryDeep).toHaveBeenCalledTimes(1);
  });

  it("hides Check again without a retry handler", async () => {
    await renderPanel({ onRetryDeep: null });
    expect(
      container.querySelector("button[aria-label='Check draft again']"),
    ).toBe(null);
  });
});

describe("ReviewPanel auto re-check toggle", () => {
  it("flips the toggle through its callback", async () => {
    const onToggleAutoRecheck = vi.fn();
    await renderPanel({ onToggleAutoRecheck });
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).not.toBe(null);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleAutoRecheck).toHaveBeenCalledWith(true);
  });

  it("reflects an enabled toggle", async () => {
    const onToggleAutoRecheck = vi.fn();
    await renderPanel({ autoRecheck: true, onToggleAutoRecheck });
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleAutoRecheck).toHaveBeenCalledWith(false);
  });

  it("shows the toggle in proofread mode as well", async () => {
    const onToggleProofreadAutoRecheck = vi.fn();
    await renderPanel({
      activeTool: "Proofread",
      onToggleProofreadAutoRecheck,
    });
    const toggle = container.querySelector('[role="switch"]');
    expect(toggle).not.toBe(null);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleProofreadAutoRecheck).toHaveBeenCalledWith(false);
  });

  it("explains both toggles with info tips", async () => {
    await renderPanel({ activeTool: "Proofread" });
    expect(container.textContent).toContain("re-scans the draft as you type");
    await renderPanel({ activeTool: "Deep Proofread" });
    expect(container.textContent).toContain("runs again by itself");
  });

  it("anchors the info tip to the panel edge instead of spilling sideways", async () => {
    await renderPanel({ activeTool: "Proofread" });
    const tip = container.querySelector('[data-testid="auto-recheck-tip"]');
    expect(tip).not.toBe(null);
    expect(tip.classList.contains("right-0")).toBe(true);
    expect(tip.classList.contains("left-0")).toBe(false);
    const row = tip.closest(".relative");
    expect(row).not.toBe(null);
    expect(row.classList.contains("group")).toBe(true);
  });

  it("offers Check again in the empty proofread state", async () => {
    const onRetry = vi.fn();
    await renderPanel({ activeTool: "Proofread", onRetry });
    const button = container.querySelector(
      "button[aria-label='Check draft again']",
    );
    expect(button).not.toBe(null);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("ReviewPanel Expand diff", () => {
  it("highlights added sentences in Expand results", async () => {
    await renderPanel({
      activeTool: "Expand",
      transformResults: [
        {
          tool: "Expand",
          text: "The road was dusty. Birds sang.",
          sourceText: "The road was dusty.",
          from: 0,
          to: 20,
          part: 1,
          total: 1,
        },
      ],
    });
    const added = container.querySelector(".expand-added");
    expect(added).not.toBe(null);
    expect(added.textContent).toContain("Birds sang.");
  });

  it("renders other tools without diff marks", async () => {
    await renderPanel({
      activeTool: "Rewrite",
      transformResults: [
        {
          tool: "Rewrite",
          text: "The road was dusty.",
          sourceText: "The road was dusty.",
          from: 0,
          to: 20,
          part: 1,
          total: 1,
        },
      ],
    });
    expect(container.querySelector(".expand-added")).toBe(null);
    expect(container.textContent).toContain("The road was dusty.");
  });
});
