// Tests for suggestion overlay helpers.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "suggestions.js"),
  "utf-8",
);

function loadSuggestions(windowStub) {
  const sandbox = {
    document: {
      documentElement: { appendChild() {} },
      createElement() {
        return {
          style: {},
          attachShadow() {
            return {
              appendChild() {},
            };
          },
        };
      },
    },
    window: windowStub,
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__lexiconSuggestions;
}

test("fieldInViewport is true when the field intersects the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 200,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), true);
});

test("fieldInViewport is false when the field is fully below the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 900,
      bottom: 1100,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), false);
});

test("fieldInViewport is false when the field is fully above the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: -200,
      bottom: -40,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), false);
});

test("badgePosition clamps to the visible part of a tall field", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 2000,
      left: 50,
      right: 500,
    }),
  };
  const pos = api.badgePosition(field);
  assert.ok(pos.top <= 800 - 8);
  assert.ok(pos.top >= 100);
  assert.ok(pos.left <= 1000 - 8 - 26 || pos.left <= 500);
});

test("panelPosition opens above the badge and right-aligns to it", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const badge = { left: 700, top: 500 };
  const panel = api.panelPosition(badge, 200);
  assert.equal(panel.left, 700 + 26 - 320);
  assert.equal(panel.top, 500 - 8 - 200);
});

test("panelPosition flips below the badge when there is no room above", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const badge = { left: 700, top: 40 };
  const panel = api.panelPosition(badge, 200);
  assert.equal(panel.top, 40 + 26 + 8);
});

test("panelPosition lifts above a short editor instead of covering it", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const badge = { left: 700, top: 534 };
  const field = { left: 200, right: 700, top: 500, bottom: 560, height: 60 };
  const panel = api.panelPosition(badge, 200, field);
  assert.ok(panel.top + 200 <= field.top - 8);
});

test("shows offline badge and messaging when backend is offline", () => {
  let rootEl = null;
  const sandbox = {
    document: {
      documentElement: { appendChild() {} },
      createElement(tag) {
        const el = {
          tagName: tag.toUpperCase(),
          className: "",
          classList: {
            classes: new Set(),
            add(...cls) { cls.forEach((c) => this.classes.add(c)); },
            remove(...cls) { cls.forEach((c) => this.classes.delete(c)); },
            toggle(cls, val) { if (val) this.classes.add(cls); else this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); },
          },
          style: {},
          children: [],
          textContent: "",
          title: "",
          hidden: false,
          appendChild(child) { this.children.push(child); return child; },
          replaceChildren(...nodes) { this.children = nodes; },
          addEventListener() {},
          removeEventListener() {},
          setAttribute() {},
          attachShadow() {
            rootEl = {
              children: [],
              appendChild(c) { this.children.push(c); return c; },
            };
            return rootEl;
          },
        };
        return el;
      },
    },
    window: {
      innerWidth: 1000,
      innerHeight: 800,
      addEventListener() {},
      removeEventListener() {},
    },
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.__lexiconSuggestions;

  const field = {
    getBoundingClientRect: () => ({ top: 100, bottom: 200, left: 50, right: 400 }),
  };

  api.show(field, [], { offline: true });
  const state = api.state();
  const badgeEl = state.badgeEl;
  assert.equal(badgeEl.textContent, "!");
  assert.equal(badgeEl.classList.contains("offline"), true);
  assert.equal(badgeEl.classList.contains("clean"), false);
  assert.equal(badgeEl.title, "Lexicon isn't running — open Lexicon to check");
});

test("keeps independent badges for multiple fields", () => {
  let rootEl = null;
  const makeElement = (tag) => ({
    tagName: tag.toUpperCase(),
    className: "",
    classList: {
      classes: new Set(),
      add(...classes) {
        classes.forEach((name) => this.classes.add(name));
      },
      remove(...classes) {
        classes.forEach((name) => this.classes.delete(name));
      },
      toggle(name, value) {
        if (value) this.classes.add(name);
        else this.classes.delete(name);
      },
    },
    style: {},
    children: [],
    hidden: false,
    textContent: "",
    title: "",
    offsetHeight: 100,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    remove() {},
    attachShadow() {
      rootEl = {
        children: [],
        appendChild(child) {
          this.children.push(child);
          return child;
        },
      };
      return rootEl;
    },
  });
  const sandbox = {
    document: {
      documentElement: { appendChild() {} },
      createElement: makeElement,
    },
    window: {
      innerWidth: 1000,
      innerHeight: 800,
      addEventListener() {},
      removeEventListener() {},
    },
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.__lexiconSuggestions;
  const makeField = (top) => ({
    tagName: "TEXTAREA",
    getBoundingClientRect: () => ({
      top,
      bottom: top + 80,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener() {},
    removeEventListener() {},
  });
  const field1 = makeField(100);
  const field2 = makeField(300);
  const match = {
    offset: 0,
    length: 3,
    message: "Spelling issue",
    replacements: ["The"],
  };

  api.showField(field1, [match]);
  api.showField(field2, []);

  assert.equal(api.fieldStates().length, 2);
  assert.equal(api.fieldState(field1).badgeEl.textContent, "1");
  assert.equal(api.fieldState(field2).badgeEl.textContent, "✓");
  assert.ok(rootEl.children.length >= 7);
  api.hideField(field1);
  assert.equal(api.fieldStates().length, 1);
});

