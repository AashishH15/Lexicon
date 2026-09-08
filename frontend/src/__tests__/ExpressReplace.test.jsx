// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { replaceExpressRange } from "../Editor.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  openExternalUrl: vi.fn(),
}));

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

let container;
let root;
const editorRef = { current: null };

function Harness({ content }) {
  const editor = useEditor({
    extensions: [StarterKit],
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
  expect(typeof editorRef.current.commands.undo).toBe("function");
  return editorRef.current;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("replaceExpressRange", () => {
  it("replaces a Spanish selection and restores it with one undo", async () => {
    const editor = await mountEditor("<p>Hola mundo cruel</p>");
    expect(editor.getText()).toBe("Hola mundo cruel");
    let ok;
    await act(async () => {
      ok = replaceExpressRange(editor, { from: 6, to: 11 }, "world");
    });
    expect(ok).toBe(true);
    expect(editor.getText()).toBe("Hola world cruel");
    await act(async () => {
      editor.commands.undo();
    });
    expect(editor.getText()).toBe("Hola mundo cruel");
  });

  it("keeps surrounding whitespace intact", async () => {
    const editor = await mountEditor("<p>Say Hola mundo please</p>");
    await act(async () => {
      replaceExpressRange(editor, { from: 10, to: 15 }, "world");
    });
    expect(editor.getText()).toBe("Say Hola world please");
    await act(async () => {
      editor.commands.undo();
    });
    expect(editor.getText()).toBe("Say Hola mundo please");
  });

  it("keeps bold marks on the new text", async () => {
    const editor = await mountEditor("<p>Hola <strong>mundo</strong> cruel</p>");
    await act(async () => {
      replaceExpressRange(editor, { from: 6, to: 11 }, "world");
    });
    expect(editor.getHTML()).toContain("<strong>world</strong>");
    await act(async () => {
      editor.commands.undo();
    });
    expect(editor.getHTML()).toContain("<strong>mundo</strong>");
  });

  it("leaves the cursor after the new text with no jump", async () => {
    const editor = await mountEditor("<p>Hola mundo cruel</p>");
    await act(async () => {
      replaceExpressRange(editor, { from: 6, to: 11 }, "world");
    });
    const { selection } = editor.state;
    expect(selection.empty).toBe(true);
    expect(selection.from).toBe(11);
  });

  it("rejects bad input and leaves the doc alone", async () => {
    const editor = await mountEditor("<p>Hola mundo cruel</p>");
    let out;
    await act(async () => {
      out = [
        replaceExpressRange(null, { from: 6, to: 11 }, "world"),
        replaceExpressRange(editor, null, "world"),
        replaceExpressRange(editor, { from: 6, to: 11 }, ""),
        replaceExpressRange(editor, { from: 6, to: 11 }, null),
      ];
    });
    expect(out).toEqual([false, false, false, false]);
    expect(editor.getText()).toBe("Hola mundo cruel");
  });

  it("clamps an out of date range instead of throwing", async () => {
    const editor = await mountEditor("<p>Hola</p>");
    let ok;
    await act(async () => {
      ok = replaceExpressRange(editor, { from: 1, to: 999 }, "Hi");
    });
    expect(ok).toBe(true);
    expect(editor.getText()).toBe("Hi");
  });
});
