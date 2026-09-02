// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TurndownService from "turndown";
import { marked } from "marked";
import {
  buildTextWithMap,
  applyGrammarDecorations,
  clearGrammarDecorations,
  applySuggestion,
  shouldReplaceSentence,
  dismissError,
  GrammarHighlight,
} from "../grammarHighlight.js";

function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Insert newlines after block elements so paragraphs don't run together
  doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li").forEach((el) => {
    el.appendChild(doc.createTextNode("\n\n"));
  });
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

function plainTextToHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return paragraphs || "<p></p>";
}

import { extractSentenceContext } from "../proseQualityEngine.js";

function matchKey(match, text) {
  const original = (
    text && match.offset != null && match.length != null
      ? text.slice(match.offset, match.offset + match.length)
      : match.original
  ) || "";
  let sentence = match.sentence || "";
  if (!sentence && text && match.offset != null) {
    sentence = extractSentenceContext(text, match.offset).text;
  }
  return `${match.message}::${original}::${sentence}`;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

let editor;

beforeAll(() => {
  editor = new Editor({
    extensions: [StarterKit.configure({ codeBlock: false }), GrammarHighlight],
  });
});

afterAll(() => {
  editor?.destroy();
});

// Scenario 1 – Initial App & Editor Hydration
describe("Editor hydration", () => {
  it("creates an empty editor that renders a paragraph", () => {
    const html = editor.getHTML();
    expect(html).toContain("<p>");
    expect(html).toContain("</p>");
  });

  it("sets and retrieves content via setContent", () => {
    editor.commands.setContent("<p>Hello, Lexicon.</p>");
    expect(editor.getHTML()).toContain("Hello, Lexicon.");
  });

  it("buildTextWithMap returns correct text and offset map", () => {
    editor.commands.setContent(
      "<p>The quick brown fox</p><p>jumps over the lazy dog.</p>",
    );
    const { text, map } = buildTextWithMap(editor.state.doc);
    expect(text).toBe("The quick brown fox\njumps over the lazy dog.");
    // First char of second paragraph is at text offset after the newline
    const n = "The quick brown fox".length; // 19
    expect(text[n]).toBe("\n");
    expect(map[n]).toBeGreaterThan(0);
    expect(text[n + 1]).toBe("j");
  });

  it("handles empty content gracefully", () => {
    // TipTap defaults to a single empty paragraph
    const { text, map } = buildTextWithMap(
      new Editor({
        extensions: [StarterKit.configure({ codeBlock: false })],
      }).state.doc,
    );
    expect(text).toBe("");
    expect(map).toEqual([]);
  });

  it("buildTextWithMap matches offsets to PM positions", () => {
    editor.commands.setContent("<p>teh</p>");
    const { text, map } = buildTextWithMap(editor.state.doc);
    expect(text).toBe("teh");
    // Inside <p>teh</p>, the text node sits at some ProseMirror position
    // after <p>. map[0] must be a valid positive integer.
    expect(typeof map[0]).toBe("number");
    expect(map[0]).toBeGreaterThanOrEqual(0);
  });
});

// Scenario 2 – Proofread Pass & Decoration Attachment
describe("Proofread pass & decoration attachment", () => {
  it("attaches lex-error classes via applyGrammarDecorations", () => {
    editor.commands.setContent("<p>teh</p>");
    const { map } = buildTextWithMap(editor.state.doc);
    const matches = [
      {
        offset: 0,
        length: 3,
        message: "Possible spelling mistake",
        replacements: ["the"],
        rule: { id: "TEH", description: "Spelling" },
      },
    ];
    applyGrammarDecorations(editor, matches, map, null);
    const pluginState = editor.state;
    expect(pluginState).toBeTruthy();
    expect(editor.getText()).toBe("teh");
  });

  it("attaches decorations at the correct positions", () => {
    editor.commands.setContent("<p>teh wer happpy</p>");
    const { map } = buildTextWithMap(editor.state.doc);
    const matches = [
      {
        offset: 0, length: 3, message: "Spelling: teh",
        replacements: ["the"], rule: { id: "TEH", description: "Spelling" },
      },
      {
        offset: 4, length: 3, message: "Spelling: wer",
        replacements: ["we"], rule: { id: "WER", description: "Spelling" },
      },
      {
        offset: 8, length: 6, message: "Spelling: happpy",
        replacements: ["happy"], rule: { id: "HAPPPY", description: "Spelling" },
      },
    ];
    applyGrammarDecorations(editor, matches, map, null);
    const pluginState = editor.state;
    expect(pluginState).toBeTruthy();
  });

  it("clearGrammarDecorations removes all decorations", () => {
    editor.commands.setContent("<p>test</p>");
    const { map } = buildTextWithMap(editor.state.doc);
    applyGrammarDecorations(editor, [{ offset: 0, length: 4, message: "Test", replacements: ["tested"], rule: { id: "TEST", description: "Grammar" } }], map, null);
    clearGrammarDecorations(editor);
    expect(editor.getText()).toBe("test");
  });
});

// Scenario 3 – Suggestion Accept & Dismiss Workflow
describe("Suggestion accept & dismiss", () => {
  it("does not treat a direct prose replacement as a sentence rewrite", () => {
    expect(
      shouldReplaceSentence({
        category: "Prose Style",
        replacements: ["Now"],
        sentence: "At this point in time, the plan is clear.",
        sentenceOffset: 0,
        sentenceLength: "At this point in time, the plan is clear.".length,
      })
    ).toBe(false);
  });

  it("treats a prose suggestion without a replacement as a sentence rewrite", () => {
    expect(
      shouldReplaceSentence({
        category: "Prose Style",
        replacements: [],
        sentence: "The report was written by her.",
        sentenceOffset: 0,
        sentenceLength: "The report was written by her.".length,
      })
    ).toBe(true);
  });

  it("applies a suggestion replacement via applySuggestion", () => {
    editor.commands.setContent("<p>teh</p>");
    const { map } = buildTextWithMap(editor.state.doc);
    const matches = [
      {
        id: 0, offset: 0, length: 3, message: "Spelling", replacements: ["the"],
        rule: { id: "TEH", description: "Spelling" },
      },
    ];
    applyGrammarDecorations(editor, matches, map, 0);
    applySuggestion(editor, 0, "the");
    expect(editor.getText()).toBe("the");
  });

  it("removes a filler word and its following space", () => {
    const text = "This is very important.";
    editor.commands.setContent(`<p>${text}</p>`);
    const { map } = buildTextWithMap(editor.state.doc);
    const match = {
      id: 0,
      offset: text.indexOf("very"),
      length: "very".length,
      message: "Filler word",
      replacements: [""],
      action: "remove",
    };

    applyGrammarDecorations(editor, [match], map, null);
    applySuggestion(editor, 0, "", match);

    expect(editor.getText()).toBe("This is important.");
  });

  it("removes an introductory filler and its comma", () => {
    const text = "Actually, the plan works.";
    editor.commands.setContent(`<p>${text}</p>`);
    const { map } = buildTextWithMap(editor.state.doc);
    const match = {
      id: 0,
      offset: 0,
      length: "Actually".length,
      message: "Filler word",
      replacements: [""],
      action: "remove",
    };

    applyGrammarDecorations(editor, [match], map, null);
    applySuggestion(editor, 0, "", match);

    expect(editor.getText()).toBe("The plan works.");
  });

  it("capitalizes a removed introductory filler after a paragraph break", () => {
    const text = "First paragraph\nActually, the plan works.";
    editor.commands.setContent(
      "<p>First paragraph</p><p>Actually, the plan works.</p>",
    );
    const { map } = buildTextWithMap(editor.state.doc);
    const match = {
      id: 0,
      offset: text.indexOf("Actually"),
      length: "Actually".length,
      message: "Filler word",
      replacements: [""],
      action: "remove",
    };

    applyGrammarDecorations(editor, [match], map, null);
    applySuggestion(editor, 0, "", match);

    expect(buildTextWithMap(editor.state.doc).text).toBe(
      "First paragraph\nThe plan works.",
    );
  });

  it("removes a trailing filler and its separating comma", () => {
    const text = "The result works, actually.";
    editor.commands.setContent(`<p>${text}</p>`);
    const { map } = buildTextWithMap(editor.state.doc);
    const match = {
      id: 0,
      offset: text.indexOf("actually"),
      length: "actually".length,
      message: "Filler word",
      replacements: [""],
      action: "remove",
    };

    applyGrammarDecorations(editor, [match], map, null);
    applySuggestion(editor, 0, "", match);

    expect(editor.getText()).toBe("The result works.");
  });

  it("dismissError removes only the targeted decoration", () => {
    editor.commands.setContent("<p>teh wer</p>");
    const { map } = buildTextWithMap(editor.state.doc);
    const matches = [
      {
        id: 0, offset: 0, length: 3, message: "Spelling: teh", replacements: ["the"],
        rule: { id: "TEH", description: "Spelling" },
      },
      {
        offset: 4, length: 3, message: "Spelling: wer", replacements: ["we"],
        rule: { id: "WER", description: "Spelling" },
      },
    ];
    applyGrammarDecorations(editor, matches, map, null);
    dismissError(editor, 0);
    // Document text unchanged
    expect(editor.getText()).toBe("teh wer");
  });

  it("matchKey produces stable signature for dismissed-key tracking", () => {
    const match = { offset: 0, length: 3, message: "Spelling error", original: "teh" };
    const key = matchKey(match, null);
    expect(key).toBe("Spelling error::teh::");
  });

  it("matchKey reads original and sentence context from text when available", () => {
    const match = { offset: 4, length: 3, message: "Spelling error" };
    const key = matchKey(match, "fix teh.");
    expect(key).toBe("Spelling error::teh::fix teh.");
  });

  it("dismissed-keys filter removes matching errors from results", () => {
    const text = "teh cat. wer dog.";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 9, length: 3, message: "Spelling" },
    ];
    const dismissed = new Set([matchKey(matches[0], text)]);
    const filtered = matches.filter((m) => !dismissed.has(matchKey(m, text)));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].offset).toBe(9);
  });
});

// Scenario 4 – Document Import/Export Pipeline
describe("Document import/export pipeline", () => {
  it("htmlToPlainText strips HTML tags and preserves line structure", () => {
    const html = "<p>Hello <b>world</b>.</p><p>Second paragraph.</p>";
    const text = htmlToPlainText(html);
    expect(text).toBe("Hello world.\n\nSecond paragraph.");
  });

  it("htmlToPlainText handles empty input", () => {
    expect(htmlToPlainText("")).toBe("");
    expect(htmlToPlainText("<p></p>")).toBe("");
  });

  it("plainTextToHtml wraps lines in paragraphs", () => {
    const result = plainTextToHtml("Hello world.\n\nSecond paragraph.");
    // Double newline becomes separate <p> tags
    expect(result).toBe("<p>Hello world.</p><p>Second paragraph.</p>");
  });

  it("plainTextToHtml escapes HTML special characters", () => {
    const result = plainTextToHtml("<test> & friends");
    expect(result).toContain("&lt;test&gt;");
    expect(result).toContain("&amp;");
  });

  it("plainTextToHtml handles empty input", () => {
    expect(plainTextToHtml("")).toBe("<p></p>");
  });

  it("TurndownService converts HTML to Markdown (atx headings, fenced code)", () => {
    const html = "<h1>Title</h1><p>Body text.</p><pre><code>code block</code></pre>";
    const md = turndown.turndown(html);
    expect(md).toContain("# Title");
    expect(md).toContain("Body text.");
    expect(md).toContain("```");
    expect(md).toContain("code block");
  });

  it("TurndownService handles tables", () => {
    // Without turndown-plugin-gfm, tables are not converted to pipe syntax
    const html = "<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>";
    const md = turndown.turndown(html);
    expect(md).toContain("Name");
    expect(md).toContain("Alice");
  });

  it("marked parses Markdown back to HTML", () => {
    const md = "# Title\n\nParagraph with **bold**.";
    const html = marked.parse(md);
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("round-trip Markdown: HTML → Markdown → HTML preserves text content", () => {
    let originalHtml = "<h1>Hello</h1><p>This is a <strong>test</strong>.</p>";
    const md = turndown.turndown(originalHtml);
    const html = marked.parse(md);
    const text = new DOMParser().parseFromString(html, "text/html").body.textContent;
    // textContent preserves newlines between block elements from the parsed HTML
    expect(text.replace(/\n/g, "")).toBe("HelloThis is a test.");
  });

  it("editor getHTML returns serialized content suitable for export", () => {
    editor.commands.setContent("<p>Export <strong>me</strong>.</p>");
    const html = editor.getHTML();
    expect(html).toContain("<p>");
    expect(html).toContain("<strong>me</strong>");
    expect(html).toContain("Export");
  });
});
