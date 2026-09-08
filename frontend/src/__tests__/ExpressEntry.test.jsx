// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  EXPRESS_MAX_CHARS,
  EXPRESS_TOOL_NAME,
  resolveExpressEntry,
} from "../useExpress.js";
import ReviewPanel from "../ReviewPanel.jsx";
import { SelectionBubbleMenu } from "../Editor.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lacks layout APIs on ranges. The bubble menu reads them
// to place itself. Stub them so positioning never throws in tests.
if (typeof window !== "undefined" && window.Range) {
  if (!window.Range.prototype.getClientRects) {
    window.Range.prototype.getClientRects = function () {
      return [];
    };
  }
  if (!window.Range.prototype.getBoundingClientRect) {
    window.Range.prototype.getBoundingClientRect = function () {
      return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    };
  }
}

vi.mock("../api.js", () => ({
  openExternalUrl: vi.fn(),
}));

function testTones() {
  return {
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
  };
}

describe("resolveExpressEntry", () => {
  it("caps the selection at 600 characters", () => {
    expect(EXPRESS_MAX_CHARS).toBe(600);
  });

  it("runs with a short selection on an allowed model", () => {
    expect(
      resolveExpressEntry({ text: "Hola.", isModelAllowed: true }),
    ).toBe("run");
  });

  it("runs at exactly 600 characters", () => {
    expect(
      resolveExpressEntry({ text: "a".repeat(600), isModelAllowed: true }),
    ).toBe("run");
  });

  it("opens paste mode with no selection", () => {
    expect(resolveExpressEntry({ text: "", isModelAllowed: true })).toBe(
      "paste",
    );
    expect(resolveExpressEntry({ text: "   ", isModelAllowed: true })).toBe(
      "paste",
    );
  });

  it("flags an over-limit selection with no model call", () => {
    expect(
      resolveExpressEntry({ text: "a".repeat(601), isModelAllowed: true }),
    ).toBe("over-limit");
  });

  it("blocks Light before any other check", () => {
    expect(resolveExpressEntry({ text: "Hola.", isModelAllowed: false })).toBe(
      "blocked",
    );
    expect(
      resolveExpressEntry({ text: "a".repeat(601), isModelAllowed: false }),
    ).toBe("blocked");
    expect(resolveExpressEntry({ text: "", isModelAllowed: false })).toBe(
      "blocked",
    );
  });
});

describe("ReviewPanel Express branch", () => {
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

  function panelProps(overrides = {}) {
    return {
      editor: null,
      activeTool: EXPRESS_TOOL_NAME,
      grammarMatches: [],
      checking: false,
      backendOffline: false,
      backendError: "",
      lexStatus: "idle",
      lexStatusLabel: "",
      onRetry: vi.fn(),
      userResolvedAll: false,
      activeErrorId: null,
      aboutToCollapse: false,
      onApply: vi.fn(),
      onDismiss: vi.fn(),
      onAcceptAll: vi.fn(),
      onDismissAll: vi.fn(),
      onAddToDictionary: vi.fn(),
      onLocate: vi.fn(),
      onCollapse: vi.fn(),
      onAiRewrite: null,
      onClear: vi.fn(),
      transformResults: [],
      transformProgress: null,
      transformRunning: false,
      transformStatus: "idle",
      transformError: "",
      onApplyTransform: vi.fn(),
      onDismissTransform: vi.fn(),
      deepMatches: [],
      deepRunning: false,
      deepProgress: null,
      deepError: "",
      deepWarning: "",
      onCancelDeep: null,
      onRetryDeep: null,
      expressResult: {
        detectedLanguage: "Spanish",
        tones: testTones(),
      },
      expressActiveTone: "professional",
      expressStatus: "idle",
      expressError: "",
      expressHasSelection: true,
      expressIsOverLimit: false,
      expressIsModelAllowed: true,
      onExpressToneChange: vi.fn(),
      onExpressReplace: vi.fn(),
      onExpressRun: vi.fn(),
      onExpressDismiss: vi.fn(),
      ...overrides,
    };
  }

  it("docks the Express card in the right panel", async () => {
    await act(async () => {
      root.render(<ReviewPanel {...panelProps()} />);
    });
    expect(container.textContent).toContain("Express in English");
    expect(container.textContent).toContain("Spanish -> English");
  });

  it("forwards tone picks and Replace to the parent", async () => {
    const props = panelProps({ expressActiveTone: "concise" });
    await act(async () => {
      root.render(<ReviewPanel {...props} />);
    });
    await act(async () => {
      container
        .querySelector("button[aria-label='Casual tone']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(props.onExpressToneChange).toHaveBeenCalledWith("casual");
    await act(async () => {
      container
        .querySelector("button[aria-label='Replace selection']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Replace uses the tone just picked, even before the parent re-renders.
    expect(props.onExpressReplace).toHaveBeenCalledWith("Casual text.");
  });

  it("opens paste mode when there is no selection", async () => {
    await act(async () => {
      root.render(
        <ReviewPanel
          {...panelProps({
            expressResult: null,
            expressHasSelection: false,
          })}
        />,
      );
    });
    expect(
      container.querySelector(
        "textarea[aria-label='Text to express in English']",
      ),
    ).not.toBe(null);
  });

  it("asks for a tone pick when a selection is waiting", async () => {
    await act(async () => {
      root.render(
        <ReviewPanel
          {...panelProps({
            expressResult: null,
            expressHasSelection: true,
          })}
        />,
      );
    });
    expect(container.textContent).toContain("Pick a tone to phrase this selection.");
    expect(container.querySelector("button[aria-label='Replace selection']")).toBe(
      null,
    );
    expect(
      container.querySelectorAll("button[role='tab'][aria-selected='true']").length,
    ).toBe(0);
  });
});

describe("SelectionBubbleMenu Express action", () => {
  let container;
  let root;
  const editorRef = { current: null };
  const onExpress = vi.fn();

  function Harness() {
    const editor = useEditor({
      extensions: [StarterKit],
      content: "<p>Hola mundo</p>",
    });
    editorRef.current = editor;
    if (!editor) {
      return null;
    }
    return (
      <>
        <EditorContent editor={editor} />
        <SelectionBubbleMenu editor={editor} onExpress={onExpress} />
      </>
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    editorRef.current = null;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("offers one-click Express on highlighted text", async () => {
    await act(async () => {
      root.render(<Harness />);
    });
    expect(editorRef.current).not.toBe(null);
    await act(async () => {
      editorRef.current.commands.setTextSelection({ from: 1, to: 5 });
      // The bubble menu debounces updates. Wait past the delay.
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    const button = container.querySelector(
      "button[aria-label='Express in English']",
    );
    expect(button).not.toBe(null);
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onExpress).toHaveBeenCalledTimes(1);
  });
});
