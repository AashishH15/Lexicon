// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ContinueGhost, shouldAcceptGhostTab } from "../continueGhost.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const editorRef = { current: null };

function Harness({ content }) {
  const editor = useEditor({
    extensions: [StarterKit, ContinueGhost],
    content,
  });
  editorRef.current = editor;
  if (!editor) {
    return null;
  }
  return <EditorContent editor={editor} />;
}

async function mountEditor(content) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  editorRef.current = null;
  await act(async () => {
    root.render(<Harness content={content} />);
  });
  expect(editorRef.current).not.toBe(null);
  return editorRef.current;
}

function endPos(editor) {
  return editor.state.doc.content.size - 1;
}

function ghostEl(editor) {
  return editor.view.dom.querySelector(".lex-continue-ghost");
}

function pressKey(editor, key) {
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
}

beforeEach(() => {});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("ContinueGhost suggestion", () => {
  it("shows ghost text at the cursor", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    const ghost = ghostEl(editor);
    expect(ghost?.querySelector(".lex-continue-text")?.textContent).toBe(
      " world",
    );
    expect(editor.getText()).toBe("Hello");
  });

  it("labels the hint with an arrow icon", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    const hint = ghostEl(editor)?.querySelector(".lex-continue-hint");
    expect(hint).not.toBe(null);
    expect(hint.querySelector("svg")).not.toBe(null);
    expect(hint.textContent).toContain("Tab to accept");
  });

  it("accepts the suggestion on Tab as one edit", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    await act(async () => {
      pressKey(editor, "Tab");
    });
    expect(editor.getText()).toBe("Hello world");
    expect(ghostEl(editor)).toBe(null);
  });

  it("clears without inserting on Escape", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    await act(async () => {
      pressKey(editor, "Escape");
    });
    expect(editor.getText()).toBe("Hello");
    expect(ghostEl(editor)).toBe(null);
  });

  it("clears when the user types instead", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    await act(async () => {
      editor.commands.insertContent("!");
    });
    expect(ghostEl(editor)).toBe(null);
  });

  it("clears on demand", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    expect(ghostEl(editor)).not.toBe(null);
    await act(async () => {
      editor.commands.clearContinueSuggestion();
    });
    expect(ghostEl(editor)).toBe(null);
  });
});

describe("shouldAcceptGhostTab", () => {
  function tabEvent(overrides = {}) {
    return {
      key: "Tab",
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      ...overrides,
    };
  }

  it("takes bare Tab only while a ghost is shown", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    expect(shouldAcceptGhostTab(editor.view, tabEvent())).toBe(false);
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    expect(shouldAcceptGhostTab(editor.view, tabEvent())).toBe(true);
  });

  it("leaves modified Tab alone", async () => {
    const editor = await mountEditor("<p>Hello</p>");
    await act(async () => {
      editor.commands.setContinueSuggestion({ pos: endPos(editor), text: " world" });
    });
    expect(
      shouldAcceptGhostTab(editor.view, tabEvent({ shiftKey: true })),
    ).toBe(false);
    expect(
      shouldAcceptGhostTab(editor.view, tabEvent({ ctrlKey: true })),
    ).toBe(false);
    expect(shouldAcceptGhostTab(editor.view, tabEvent({ key: "a" }))).toBe(
      false,
    );
  });
});
