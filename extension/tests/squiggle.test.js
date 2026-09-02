// Tests for squiggle navigation.

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "squiggle.js"),
  "utf-8",
);

function loadSquiggle({ spanRect = null } = {}) {
  let layer = null;
  const makeElement = (tagName) => ({
    tagName: tagName.toUpperCase(),
    style: {},
    offsetWidth: 0,
    classList: {
      classes: new Set(),
      add(...names) {
        names.forEach((name) => this.classes.add(name));
      },
      remove(...names) {
        names.forEach((name) => this.classes.delete(name));
      },
      contains(name) {
        return this.classes.has(name);
      },
    },
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...children) {
      this.children = children;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect() {
      return (
        spanRect || {
          top: 0,
          bottom: 12,
          left: 0,
          right: 20,
          width: 20,
          height: 12,
        }
      );
    },
  });

  const sandbox = {
    document: {
      documentElement: {
        appendChild(element) {
          if (element.id === "lexicon-squiggle-layer") layer = element;
        },
      },
      getElementById() {
        return null;
      },
      createElement: makeElement,
      createTextNode(text) {
        return { textContent: text };
      },
      createRange() {
        return {
          setStart() {},
          setEnd() {},
          getClientRects() {
            return [
              {
                top: 0,
                bottom: 12,
                left: 0,
                right: 20,
                width: 20,
                height: 12,
              },
            ];
          },
        };
      },
      addEventListener() {},
      removeEventListener() {},
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
    },
    getComputedStyle() {
      return {
        fontSize: "16px",
        fontFamily: "sans-serif",
        fontStyle: "normal",
        fontWeight: "400",
        letterSpacing: "normal",
        lineHeight: "20px",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
        wordBreak: "normal",
        paddingTop: "0px",
        paddingRight: "0px",
        paddingBottom: "0px",
        paddingLeft: "0px",
        borderTopWidth: "0px",
        borderRightWidth: "0px",
        borderBottomWidth: "0px",
        borderLeftWidth: "0px",
      };
    },
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout,
    clearTimeout,
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.__lexiconSquiggle.__testLayer = () => layer;
  return sandbox.__lexiconSquiggle;
}

test("scrollToMatch scrolls a contenteditable issue into view", () => {
  const api = loadSquiggle();
  const scrollCalls = [];
  const issueElement = {
    nodeType: 1,
    scrollIntoView(options) {
      scrollCalls.push(options);
    },
  };
  const textNode = {
    nodeType: 3,
    parentElement: issueElement,
  };
  const field = {
    tagName: "DIV",
    scrollIntoView() {
      throw new Error("the issue element should be the scroll target");
    },
  };

  api.applyFieldSquiggles(
    field,
    [
      {
        startNode: textNode,
        startOffset: 0,
        endNode: textNode,
        endOffset: 3,
      },
    ],
    "teh",
  );

  assert.equal(api.scrollToMatch(field, 0), true);
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].block, "center");
  assert.equal(scrollCalls[0].inline, "nearest");
});

test("scrollToMatch adjusts a textarea's internal scroll position", () => {
  const api = loadSquiggle({
    spanRect: {
      top: 180,
      bottom: 196,
      left: 0,
      right: 20,
      width: 20,
      height: 16,
    },
  });
  const field = {
    tagName: "TEXTAREA",
    value: "first line\nsecond line",
    offsetWidth: 240,
    clientWidth: 240,
    clientHeight: 60,
    scrollTop: 0,
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 160,
      left: 20,
      right: 260,
      width: 240,
      height: 60,
    }),
    addEventListener() {},
    removeEventListener() {},
  };

  api.applyFieldSquiggles(
    field,
    [{ start: 11, end: 15 }],
    field.value,
  );

  assert.equal(api.scrollToMatch(field, 0), true);
  assert.equal(field.scrollTop, 40);
});

test("scrollToMatch can briefly flash the matching squiggle", () => {
  const api = loadSquiggle();
  const issueElement = {
    nodeType: 1,
    scrollIntoView() {},
  };
  const textNode = {
    nodeType: 3,
    parentElement: issueElement,
  };
  const field = {
    tagName: "DIV",
  };

  api.applyFieldSquiggles(
    field,
    [
      {
        startNode: textNode,
        startOffset: 0,
        endNode: textNode,
        endOffset: 3,
      },
    ],
    "teh",
  );

  assert.equal(api.scrollToMatch(field, 0, { flash: true }), true);
  assert.equal(
    api.__testLayer().children[0].classList.contains(
      "lexicon-squiggle-flash",
    ),
    true,
  );
});
