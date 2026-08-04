// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { createLowlight, common } from "lowlight";
import {
  InlineMathWithDollar,
  BlockMath,
} from "../mathematicsWithInputRules.js";
import { TEMPLATES } from "../templates.js";

// Mirror the app's content extensions (App.jsx) so template markup is tested
// against the exact schema the editor parses with.
const lowlight = createLowlight();
for (const [name, lang] of Object.entries(common)) {
  lowlight.register(name, lang);
}

let editor;

beforeAll(() => {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Strike,
      Highlight.configure({ multicolor: false }),
      Superscript,
      Subscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      CodeBlockLowlight.configure({ lowlight }),
      InlineMathWithDollar.configure({ katexOptions: { throwOnError: false } }),
      BlockMath.configure({ katexOptions: { throwOnError: false } }),
      Image.configure({ inline: false, allowBase64: true }),
    ],
  });
});

afterAll(() => {
  editor?.destroy();
});

function loadTemplate(id) {
  const template = TEMPLATES.find((t) => t.id === id);
  expect(template, `template "${id}" exists`).toBeTruthy();
  editor.commands.setContent(template.html, { emitUpdate: false });
  return template;
}

function countNodes(typeName) {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === typeName) count += 1;
  });
  return count;
}

function firstNode(typeName) {
  let found = null;
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === typeName) found = node;
  });
  return found;
}

describe("template catalog", () => {
  it("exports four templates with unique ids and complete metadata", () => {
    expect(TEMPLATES.length).toBe(4);
    const ids = new Set(TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(Array.isArray(t.tags) && t.tags.length > 0).toBe(true);
      expect(t.html.trim().length).toBeGreaterThan(0);
      expect(t.preview.trim().length).toBeGreaterThan(0);
    }
  });

  it("loads every template cleanly into the editor", () => {
    for (const template of TEMPLATES) {
      expect(() =>
        editor.commands.setContent(template.html, { emitUpdate: false })
      ).not.toThrow();
      expect(editor.isEmpty).toBe(false);
      expect(editor.state.doc.textContent.length).toBeGreaterThan(0);
      const html = editor.getHTML();
      expect(html).toContain("<p>");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("NaN");
    }
  });

  it("renders previews as well-formed HTML snippets", () => {
    for (const t of TEMPLATES) {
      const doc = new DOMParser().parseFromString(t.preview, "text/html");
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(
        doc.querySelector("h1"),
        `${t.id} preview has a heading`
      ).toBeTruthy();
    }
  });
});

describe("academic-paper template", () => {
  it("contains headings, a table, math nodes, and references", () => {
    loadTemplate("academic-paper");
    expect(countNodes("heading")).toBeGreaterThanOrEqual(6);
    expect(countNodes("table")).toBe(1);
    expect(countNodes("tableHeader")).toBeGreaterThan(0);
    expect(countNodes("orderedList")).toBe(1);

    let correlationMath = null;
    editor.state.doc.descendants((node) => {
      if (
        !correlationMath &&
        node.type.name === "blockMath" &&
        node.attrs.latex.includes("r = ")
      ) {
        correlationMath = node;
      }
    });
    expect(
      correlationMath,
      "correlation coefficient block math present"
    ).toBeTruthy();
    expect(correlationMath.attrs.latex).toContain("\\bar{x}");

    const blockMath = firstNode("blockMath");
    expect(blockMath).toBeTruthy();
    expect(blockMath.attrs.latex).toContain("\\text");

    const serialized = editor.getHTML();
    expect(serialized).toContain('data-type="inline-math"');
    expect(serialized).toContain('data-type="block-math"');
    expect(serialized).toContain("References");
  });
});

describe("novel-manuscript template", () => {
  it("contains a title block, chapter headers, and scene breaks", () => {
    loadTemplate("novel-manuscript");
    expect(countNodes("heading")).toBeGreaterThanOrEqual(3);
    expect(countNodes("horizontalRule")).toBeGreaterThanOrEqual(2);
    expect(editor.state.doc.textContent).toContain("Chapter One");
    expect(editor.state.doc.textContent).toContain(
      "\u201cYou didn\u2019t sleep,\u201d she said."
    );
  });
});

describe("minimalist-blog template", () => {
  it("contains a lead paragraph, pull quote, and syntax-highlighted code block", () => {
    loadTemplate("minimalist-blog");
    expect(countNodes("heading")).toBe(4);
    expect(countNodes("blockquote")).toBe(1);
    expect(countNodes("codeBlock")).toBe(1);
    const codeBlock = firstNode("codeBlock");
    expect(codeBlock.attrs.language).toBe("javascript");
    expect(codeBlock.textContent).toContain("saveLocally");
    expect(editor.getHTML()).toContain("language-javascript");
  });
});

describe("executive-summary template", () => {
  it("contains header info, a callout, a metrics table, and a task list", () => {
    loadTemplate("executive-summary");
    expect(countNodes("table")).toBe(1);
    expect(countNodes("blockquote")).toBe(1);
    expect(countNodes("taskList")).toBe(1);
    expect(countNodes("taskItem")).toBe(3);

    const checked = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "taskItem") checked.push(node.attrs.checked);
    });
    expect(checked[0]).toBe(true);
    expect(checked[1]).toBe(false);
    expect(checked[2]).toBe(false);

    const serialized = editor.getHTML();
    expect(serialized).toContain('data-type="taskList"');
    expect(serialized).toContain('data-checked="true"');
  });
});
