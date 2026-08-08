// Unit tests for detectEditable.js pure helpers (C48.4). The file is a
// classic script (content scripts can't be ES modules), so it's loaded via
// node:vm and the exported namespace is read from the sandbox. DOM-dependent
// parts (textSegments, detectEditableField) are exercised manually per C48.7.
//
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "detectEditable.js"),
  "utf-8",
);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const {
  siteForHost,
  selectorsForHost,
  normalizeText,
  normalizeSegments,
  matchRanges,
} = sandbox.__lexiconEditable;

// vm runs the file in a separate realm, so objects it creates carry a foreign
// prototype and fail deepStrictEqual's prototype check. Round-trip through
// JSON to compare plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("siteForHost matches the C48.4 allowlist", () => {
  assert.equal(siteForHost("mail.google.com"), "mail.google.com");
  assert.equal(siteForHost("sub.slack.com"), "*.slack.com");
  assert.equal(siteForHost("slack.com"), "*.slack.com");
  assert.equal(siteForHost("discord.com"), "discord.com");
  assert.equal(siteForHost("canary.discord.com"), null);
  assert.equal(siteForHost("example.com"), null);
  assert.equal(siteForHost("gmail.com"), null);
  assert.equal(siteForHost("docs.google.com"), null);
});

test("selectorsForHost returns site selectors only for allowlisted hosts", () => {
  assert.deepEqual(plain(selectorsForHost("mail.google.com")), [
    "div[aria-label='Message Body'][contenteditable='true']",
    ".Am.Al.editable",
  ]);
  assert.ok(plain(selectorsForHost("sub.slack.com")).length > 0);
  assert.deepEqual(plain(selectorsForHost("example.com")), []);
});

test("normalizeText collapses \\r\\n and lone \\r to \\n", () => {
  assert.equal(normalizeText("teh\r\ncat"), "teh\ncat");
  assert.equal(normalizeText("a\rb\r\nc"), "a\nb\nc");
  assert.equal(normalizeText("a\nb\nc"), "a\nb\nc");
  assert.equal(normalizeText(""), "");
  assert.equal(normalizeText("no breaks"), "no breaks");
});

test("normalizeSegments rebuilds offsets over normalized text", () => {
  const segments = [
    { node: "n1", start: 0, end: 5 }, // "teh\r\n"
    { node: "n2", start: 5, end: 8 }, // "cat"
  ];
  const { text, segments: out } = normalizeSegments("teh\r\ncat", segments);
  assert.equal(text, "teh\ncat");
  assert.deepEqual(plain(out), [
    { node: "n1", start: 0, end: 4 },
    { node: "n2", start: 4, end: 7 },
  ]);
});

const BASIC_SEGMENTS = [
  { node: "n1", start: 0, end: 3 }, // "teh"
  { node: null, start: 3, end: 4 }, // synthetic "\n"
  { node: "n2", start: 4, end: 14 }, // "algoritm"
  { node: null, start: 14, end: 15 }, // synthetic "\n"
  { node: "n3", start: 15, end: 22 }, // "works."
];

test("matchRanges maps a simple match to one node range", () => {
  const ranges = matchRanges([{ offset: 0, length: 3 }], BASIC_SEGMENTS);
  assert.deepEqual(plain(ranges), [
    { startNode: "n1", startOffset: 0, endNode: "n1", endOffset: 3 },
  ]);
});

test("matchRanges bridges a match across a synthetic line break", () => {
  // "teh\nalgoritm" (offset 0, length 12): "teh" + synthetic \n + "algoritm"
  const ranges = matchRanges([{ offset: 0, length: 12 }], BASIC_SEGMENTS);
  assert.deepEqual(plain(ranges), [
    { startNode: "n1", startOffset: 0, endNode: "n2", endOffset: 8 },
  ]);
});

test("matchRanges snaps a match that starts inside a synthetic break", () => {
  // match "\nalgoritm" (offset 3, length 9)
  const ranges = matchRanges([{ offset: 3, length: 9 }], BASIC_SEGMENTS);
  assert.deepEqual(plain(ranges), [
    { startNode: "n2", startOffset: 0, endNode: "n2", endOffset: 8 },
  ]);
});

test("matchRanges drops invalid and unmappable matches", () => {
  assert.deepEqual(plain(matchRanges([{ offset: 0, length: 0 }], BASIC_SEGMENTS)), []);
  assert.deepEqual(plain(matchRanges([{ offset: -1, length: 3 }], BASIC_SEGMENTS)), []);
  assert.deepEqual(plain(matchRanges([{ offset: 0.5, length: 3 }], BASIC_SEGMENTS)), []);
  assert.deepEqual(plain(matchRanges([{ offset: 3, length: 1 }], BASIC_SEGMENTS)), []);
  assert.deepEqual(plain(matchRanges([{ offset: 100, length: 3 }], BASIC_SEGMENTS)), []);
  assert.deepEqual(plain(matchRanges([null, undefined], BASIC_SEGMENTS)), []);
});

test("matchRanges handles a match ending exactly at a segment boundary", () => {
  const ranges = matchRanges([{ offset: 15, length: 7 }], BASIC_SEGMENTS);
  assert.deepEqual(plain(ranges), [
    { startNode: "n3", startOffset: 0, endNode: "n3", endOffset: 7 },
  ]);
});

test("matchRanges maps multiple matches independently", () => {
  const ranges = matchRanges(
    [
      { offset: 0, length: 3 },
      { offset: 4, length: 8 },
    ],
    BASIC_SEGMENTS,
  );
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].startNode, "n1");
  assert.equal(ranges[1].startNode, "n2");
});
