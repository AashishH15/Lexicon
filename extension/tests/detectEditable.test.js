// Tests for detectEditable.js. The file runs as a classic script, so it
// loads via node:vm. Run: node --test extension/tests/

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
sandbox.Event = class {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
  }
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const {
  siteForHost,
  selectorsForHost,
  normalizeText,
  normalizeSegments,
  extractEditableText,
  replaceEditableText,
  matchRanges,
} = sandbox.__lexiconEditable;

// JSON round-trip avoids cross-realm prototype mismatches.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("siteForHost matches the allowlist", () => {
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
  // "teh" + synthetic newline + "algoritm" (offset 0, length 12)
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

// Minimal fake DOM for the replace helpers.
function makeElement(tag) {
  return {
    tagName: tag,
    children: [],
    textContent: "",
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function makeField({ tag = "DIV", children = [], ownerDocument = null } = {}) {
  return {
    tagName: tag,
    children,
    firstElementChild: children[0] ?? null,
    value: "",
    ownerDocument,
    events: [],
    replaceChildren(...kids) {
      this.children = kids;
      this.firstElementChild = kids[0] ?? null;
    },
    dispatchEvent(event) {
      this.events.push(event);
    },
  };
}

const fakeDoc = { createElement: (tag) => makeElement(tag) };

test("replaceEditableText sets a textarea value and fires input", () => {
  const field = makeField({ ownerDocument: { defaultView: null } });
  replaceEditableText(field, "textarea", "Hello world.");
  assert.equal(field.value, "Hello world.");
  assert.equal(field.events.length, 1);
  assert.equal(field.events[0].type, "input");
  assert.equal(field.events[0].bubbles, true);
});

test("replaceEditableText uses the native setter when the view provides one", () => {
  const proto = {};
  Object.defineProperty(proto, "value", {
    set(value) {
      this._value = value;
    },
  });
  const field = makeField({
    ownerDocument: {
      defaultView: { HTMLTextAreaElement: { prototype: proto } },
    },
  });
  replaceEditableText(field, "textarea", "Native setter.");
  assert.equal(field._value, "Native setter.");
});

test("replaceEditableText normalizes CRLF before writing", () => {
  const field = makeField({ ownerDocument: { defaultView: null } });
  replaceEditableText(field, "textarea", "a\r\nb");
  assert.equal(field.value, "a\nb");
});

test("replaceEditableText rebuilds a contenteditable as block elements", () => {
  const field = makeField({ children: [makeElement("DIV")], ownerDocument: fakeDoc });
  replaceEditableText(field, "contenteditable", "Line one\n\nLine three");
  assert.equal(field.children.length, 3);
  assert.equal(field.children[0].tagName, "DIV");
  assert.equal(field.children[0].textContent, "Line one");
  assert.equal(field.children[1].children[0].tagName, "BR");
  assert.equal(field.children[2].textContent, "Line three");
  assert.equal(field.events.length, 1);
});

test("replaceEditableText matches the block tag on Slack-style editors", () => {
  const field = makeField({ children: [makeElement("P")], ownerDocument: fakeDoc });
  replaceEditableText(field, "contenteditable", "A\nB");
  assert.equal(field.children[0].tagName, "P");
  assert.equal(field.children[1].tagName, "P");
});

test("extractEditableText reads a textarea value", () => {
  const field = makeField({ tag: "TEXTAREA", ownerDocument: fakeDoc });
  field.value = "Teh cat.";
  const result = extractEditableText(field);
  assert.equal(result.kind, "textarea");
  assert.equal(result.text, "Teh cat.");
  assert.equal(result.segments, null);
});
