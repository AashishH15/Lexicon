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
  getSelection,
  replaceEditableText,
  replaceEditableRange,
  replaceRangeDirect,
  replaceContentDirect,
  matchRanges,
  detectEditableFields,
  isNotionEditor,
  isYoutubeEditor,
} = sandbox.__lexiconEditable;

// JSON round-trip avoids cross-realm prototype mismatches.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("siteForHost matches known reliability fallbacks", () => {
  assert.equal(siteForHost("mail.google.com"), "mail.google.com");
  assert.equal(siteForHost("sub.slack.com"), "*.slack.com");
  assert.equal(siteForHost("slack.com"), "*.slack.com");
  assert.equal(siteForHost("discord.com"), "discord.com");
  assert.equal(siteForHost("canary.discord.com"), null);
  assert.equal(siteForHost("www.reddit.com"), null);
  assert.equal(siteForHost("example.com"), null);
  assert.equal(siteForHost("gmail.com"), null);
  assert.equal(siteForHost("docs.google.com"), null);
  assert.equal(siteForHost("github.com"), null);
});

test("selectorsForHost includes generic editors on unknown hosts", () => {
  const selectors = selectorsForHost("www.quora.com");
  assert.ok(selectors.some((s) => s.includes("role='textbox'")));
  assert.ok(selectors.some((s) => s.includes("DraftEditor")));
  assert.ok(selectors.some((s) => s.includes("lexical-editor")));
  assert.ok(selectors.includes("textarea"));
  assert.ok(selectors.includes("[contenteditable='true']"));
});

test("selectorsForHost keeps Gmail selectors and adds generics", () => {
  const selectors = selectorsForHost("mail.google.com");
  assert.ok(selectors.some((s) => s.includes("Message Body")));
  assert.ok(selectors.some((s) => s.includes("role='textbox'")));
});

test("selectorsForHost returns site selectors plus generics", () => {
  const gmail = plain(selectorsForHost("mail.google.com"));
  assert.ok(gmail.includes("div[aria-label='Message Body'][contenteditable='true']"));
  assert.ok(gmail.includes(".Am.Al.editable"));
  assert.ok(gmail.includes("div[role='textbox'][contenteditable='true']"));
  assert.ok(plain(selectorsForHost("sub.slack.com")).length > 0);
  // Unknown hosts still get the generic editor selectors.
  assert.ok(plain(selectorsForHost("example.com")).length > 0);
  assert.ok(plain(selectorsForHost("github.com")).includes("textarea"));
});

test("detectEditableFields returns every visible field and keeps focus first", () => {
  const box1 = {
    nodeType: 1,
    tagName: "TEXTAREA",
    getClientRects: () => [{}],
  };
  const box2 = {
    nodeType: 1,
    tagName: "TEXTAREA",
    getClientRects: () => [{}],
  };
  const hidden = {
    nodeType: 1,
    tagName: "TEXTAREA",
    getClientRects: () => [],
  };
  const doc = {
    activeElement: null,
    body: {},
    location: { hostname: "example.com" },
    querySelectorAll: (selector) =>
      selector === "textarea" ? [box1, box2, hidden] : [],
  };

  let fields = detectEditableFields(doc);
  assert.equal(fields.length, 2);
  assert.equal(fields[0], box1);
  assert.equal(fields[1], box2);
  doc.activeElement = box2;
  fields = detectEditableFields(doc);
  assert.equal(fields.length, 2);
  assert.equal(fields[0], box2);
  assert.equal(fields[1], box1);
  fields = detectEditableFields(doc, { visibleOnly: false });
  assert.equal(fields.length, 3);
  assert.equal(fields[2], hidden);
});

test("recognizes Notion and YouTube managed editors", () => {
  const notion = {
    nodeType: 1,
    isContentEditable: true,
    getAttribute: (name) =>
      name === "data-content-editable-leaf" ? "true" : null,
    closest: () => notion,
  };
  const youtube = {
    nodeType: 1,
    isContentEditable: true,
    id: "contenteditable-root",
    getAttribute: () => null,
  };
  assert.equal(isNotionEditor(notion), true);
  assert.equal(isYoutubeEditor(youtube), true);
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

test("getSelection returns only the selected textarea text", () => {
  const field = makeField({ tag: "TEXTAREA", ownerDocument: fakeDoc });
  field.value = "Rewrite only this sentence.";
  field.selectionStart = 8;
  field.selectionEnd = 24;
  assert.deepEqual(plain(getSelection(field)), {
    start: 8,
    end: 24,
    text: "only this senten",
  });
});

test("replaceEditableRange preserves unselected textarea text", () => {
  const field = makeField({
    tag: "TEXTAREA",
    ownerDocument: { defaultView: null },
  });
  field.value = "Keep this. Rewrite this. Keep that.";
  assert.equal(
    replaceEditableRange(field, "textarea", 11, 24, "Update this."),
    true,
  );
  assert.equal(field.value, "Keep this. Update this. Keep that.");
  assert.equal(field.events.length, 1);
});

test("replaceRangeDirect replaces a mapped range and fires input", () => {
  const node = { nodeType: 3, data: "Teh algoritm works." };
  const field = makeField({
    children: [makeElement("DIV")],
    ownerDocument: {
      defaultView: null,
      createTextNode: (data) => ({ nodeType: 3, data }),
      createRange() {
        return {
          startOffset: 0,
          setStart(node, offset) {
            this.startNode = node;
            this.startOffset = offset;
          },
          setEnd(node, offset) {
            this.endNode = node;
            this.endOffset = offset;
          },
          deleteContents() {
            this.startNode.data =
              this.startNode.data.slice(0, this.startOffset) +
              this.endNode.data.slice(this.endOffset);
          },
          insertNode(textNode) {
            const pos = this.startOffset;
            this.startNode.data =
              this.startNode.data.slice(0, pos) +
              textNode.data +
              this.startNode.data.slice(pos);
          },
        };
      },
    },
  });
  const mapped = {
    startNode: node,
    startOffset: 0,
    endNode: node,
    endOffset: 3,
  };
  assert.equal(replaceRangeDirect(field, mapped, "The"), true);
  assert.equal(node.data, "The algoritm works.");
  assert.equal(field.events.length, 1);
  assert.equal(field.events[0].type, "input");
  assert.equal(field.events[0].bubbles, true);
});

test("replaceRangeDirect fails safely on a missing mapping", () => {
  const field = makeField({ ownerDocument: { defaultView: null } });
  assert.equal(replaceRangeDirect(field, null, "The"), false);
  assert.equal(field.events.length, 0);
});

test("replaceRangeDirect fails safely without an owner document", () => {
  const field = makeField();
  assert.equal(
    replaceRangeDirect(
      field,
      { startNode: { nodeType: 3 }, startOffset: 0 },
      "The",
    ),
    false,
  );
});

test("replaceContentDirect sets a textarea value and fires input", () => {
  const field = makeField({ ownerDocument: { defaultView: null } });
  assert.equal(replaceContentDirect(field, "textarea", "Hello world."), true);
  assert.equal(field.value, "Hello world.");
  assert.equal(field.events.length, 1);
  assert.equal(field.events[0].type, "input");
});

test("replaceContentDirect rebuilds a contenteditable without execCommand", () => {
  const field = makeField({ children: [makeElement("DIV")], ownerDocument: fakeDoc });
  assert.equal(replaceContentDirect(field, "contenteditable", "Line one\nLine two"), true);
  assert.equal(field.children.length, 2);
  assert.equal(field.children[0].tagName, "DIV");
  assert.equal(field.children[0].textContent, "Line one");
  assert.equal(field.children[1].textContent, "Line two");
  assert.equal(field.events.length, 1);
});

test("replaceContentDirect refuses Slate editors", () => {
  const field = makeField({ children: [makeElement("DIV")], ownerDocument: fakeDoc });
  field.nodeType = 1;
  field.getAttribute = () => "true";
  assert.equal(replaceContentDirect(field, "contenteditable", "Ignored."), false);
  assert.equal(field.children.length, 1);
  assert.equal(field.events.length, 0);
});

test("replaceContentDirect refuses Draft.js editors", () => {
  const field = makeField({ children: [makeElement("DIV")], ownerDocument: fakeDoc });
  field.nodeType = 1;
  field.getAttribute = () => null;
  field.classList = { contains: (name) => name === "public-DraftEditor-content" };
  field.closest = () => null;
  assert.equal(replaceContentDirect(field, "contenteditable", "Ignored."), false);
  assert.equal(field.events.length, 0);
});

test("replaceRangeDirect and replaceContentDirect are exported", () => {
  assert.equal(typeof sandbox.__lexiconEditable.replaceRangeDirect, "function");
  assert.equal(typeof sandbox.__lexiconEditable.replaceContentDirect, "function");
  assert.equal(typeof sandbox.__lexiconEditable.isFrameworkEditor, "function");
});
