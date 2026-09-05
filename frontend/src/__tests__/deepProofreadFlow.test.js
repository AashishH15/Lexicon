// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  buildTextWithMap,
  applyGrammarDecorations,
  applySuggestion,
  dismissError,
  findErrorAt,
  GrammarHighlight,
} from "../grammarHighlight.js";
import {
  buildDeepChunks,
  deepEditsToMatches,
  executeDeepScan,
  extractDeepJson,
  relocateDeepMatches,
  shouldClearDeepResults,
  validateDeepEdits,
} from "../deepProofread.js";

let editor;

beforeAll(() => {
  editor = new Editor({
    extensions: [StarterKit.configure({ codeBlock: false }), GrammarHighlight],
  });
});

afterAll(() => {
  editor?.destroy();
});

function deepMatchesFor(text) {
  editor.commands.setContent(`<p>${text}</p>`);
  const snapshot = buildTextWithMap(editor.state.doc);
  const chunks = buildDeepChunks(snapshot);
  const raw = JSON.stringify([
    { source: text, replacement: `${text}!` },
  ]);
  const outcome = extractDeepJson(raw);
  const validated = validateDeepEdits(chunks[0].text, outcome.items);
  const converted = deepEditsToMatches({
    edits: validated.edits,
    chunk: chunks[0],
    snapshot,
    startId: 0,
  });
  return { snapshot, matches: converted.matches };
}

describe("deep suggestions through the editor layer", () => {
  it("draws, locates, and applies a string-id suggestion exactly", () => {
    const text = "She don't like apples today here.";
    const { snapshot, matches } = deepMatchesFor(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("deep-0");

    applyGrammarDecorations(editor, matches, snapshot.map, null);
    const pos = snapshot.map[matches[0].offset];
    expect(findErrorAt(editor, pos)).toBe("deep-0");

    applySuggestion(editor, "deep-0", `${text}!`, matches[0]);
    expect(editor.getText()).toBe(`${text}!`);
    expect(findErrorAt(editor, pos)).toBeNull();
  });

  it("dismisses a string-id suggestion without touching text", () => {
    const text = "She don't like apples today here.";
    const { snapshot, matches } = deepMatchesFor(text);
    applyGrammarDecorations(editor, matches, snapshot.map, null);
    dismissError(editor, "deep-0");
    expect(editor.getText()).toBe(text);
  });

  it("relocates surviving fixes against the live document after an apply", () => {
    const before = "Dogs bark loudly today. Cats sleep soundly today.";
    editor.commands.setContent(`<p>${before}</p>`);
    const snapshot = buildTextWithMap(editor.state.doc);
    const matches = [
      { id: "deep-0", offset: 0, length: 4, original: "Dogs" },
      { id: "deep-1", offset: before.indexOf("Cats"), length: 4, original: "Cats" },
    ];
    applyGrammarDecorations(editor, matches, snapshot.map, null);
    applySuggestion(editor, "deep-0", "Dogs!", matches[0]);
    const after = buildTextWithMap(editor.state.doc);
    const next = relocateDeepMatches(after.text, [matches[1]]);
    expect(next).toHaveLength(1);
    expect(next[0].offset).toBe(after.text.indexOf("Cats"));
    expect(after.text.slice(next[0].offset, next[0].offset + 4)).toBe("Cats");
  });

  it("clears finished deep results when the live document diverges", () => {
    editor.commands.setContent("<p>She don't like apples.</p>");
    const snapshot = buildTextWithMap(editor.state.doc);
    expect(
      shouldClearDeepResults({
        running: false,
        matchCount: 1,
        snapshotText: snapshot.text,
        currentText: snapshot.text,
        ownApply: false,
      }),
    ).toBe(false);
    editor.commands.insertContent(" More words here.");
    const current = buildTextWithMap(editor.state.doc).text;
    expect(
      shouldClearDeepResults({
        running: false,
        matchCount: 1,
        snapshotText: snapshot.text,
        currentText: current,
        ownApply: false,
      }),
    ).toBe(true);
  });

  it("clears clean deep results when the live document diverges", () => {
    editor.commands.setContent("<p>The meeting starts at noon.</p>");
    const snapshot = buildTextWithMap(editor.state.doc);
    expect(
      shouldClearDeepResults({
        running: false,
        matchCount: 0,
        snapshotText: snapshot.text,
        currentText: snapshot.text,
        ownApply: false,
      }),
    ).toBe(false);
    editor.commands.insertContent(" Extra text added.");
    const current = buildTextWithMap(editor.state.doc).text;
    expect(
      shouldClearDeepResults({
        running: false,
        matchCount: 0,
        snapshotText: snapshot.text,
        currentText: current,
        ownApply: false,
      }),
    ).toBe(true);
  });
});

describe("executeDeepScan orchestration", () => {
  const snapshot = { text: "She don't like apples.", map: [] };
  const chunks = [{ text: "She don't like apples.", textStart: 0 }];
  const fix = JSON.stringify([
    { source: "She don't like apples", replacement: "She doesn't like apples" },
  ]);
  const baseOptions = {
    snapshot,
    chunks,
    isCancelled: () => false,
    readCurrentText: () => snapshot.text,
    onProgress: () => {},
    noteActivity: async () => {},
  };

  it("maps an incomplete run to an error instead of a clean state", async () => {
    const result = await executeDeepScan({
      ...baseOptions,
      callModel: async () => "garbage[[[",
    });
    expect(result.status).toBe("incomplete");
    expect(result.matches).toEqual([]);
  });

  it("reports partial when one chunk succeeds and another fails", async () => {
    let callIndex = 0;
    const result = await executeDeepScan({
      ...baseOptions,
      chunks: [
        { text: "She don't like apples.", textStart: 0 },
        { text: "They is happy today.", textStart: 23 },
      ],
      callModel: async () => {
        callIndex += 1;
        return callIndex === 1 ? fix : "garbage[[[";
      },
    });
    expect(result.status).toBe("partial");
    expect(result.matches).toHaveLength(1);
  });

  it("aborts everything when the snapshot changes mid-run", async () => {
    let reads = 0;
    const result = await executeDeepScan({
      ...baseOptions,
      chunks: [
        { text: "She don't like apples.", textStart: 0 },
        { text: "They is happy today.", textStart: 23 },
      ],
      callModel: async () => fix,
      readCurrentText: () => {
        reads += 1;
        return reads > 1 ? "edited meanwhile" : snapshot.text;
      },
    });
    expect(result.status).toBe("cancelled");
    expect(result.matches).toEqual([]);
  });

  it("yields chunk matches progressively as chunks finish", async () => {
    const chunkMatchesLog = [];
    const text = "She don't like apples. They is happy today here.";
    const chunks = [
      { text: "She don't like apples.", textStart: 0 },
      { text: "They is happy today here.", textStart: text.indexOf("They") },
    ];
    const fix1 = JSON.stringify([{ source: "She don't like apples", replacement: "She doesn't like apples" }]);
    const fix2 = JSON.stringify([{ source: "They is happy today", replacement: "They are happy today" }]);
    let callIdx = 0;
    const result = await executeDeepScan({
      ...baseOptions,
      snapshot: { text, map: [] },
      readCurrentText: () => text,
      chunks,
      callModel: async () => {
        callIdx += 1;
        return callIdx === 1 ? fix1 : fix2;
      },
      onChunkMatches: (matches) => {
        chunkMatchesLog.push([...matches]);
      },
    });
    expect(result.status).toBe("complete");
    expect(chunkMatchesLog).toHaveLength(2);
    expect(chunkMatchesLog[0]).toHaveLength(1);
    expect(chunkMatchesLog[1]).toHaveLength(2);
  });
});
