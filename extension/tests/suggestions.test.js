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
const statusSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "lexStatus.js"),
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
  vm.runInContext(statusSource, sandbox);
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
  vm.runInContext(statusSource, sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.__lexiconSuggestions;

  const field = {
    getBoundingClientRect: () => ({ top: 100, bottom: 200, left: 50, right: 400 }),
  };

  api.show(field, [], { offline: true });
  const state = api.state();
  const badgeEl = state.badgeEl;
  assert.equal(badgeEl.classList.contains("no-connection"), true);
  assert.equal(badgeEl.classList.contains("clean"), false);
  assert.equal(badgeEl.children[0].src, "icons/lex-no-connection.svg");
  assert.equal(badgeEl.title, "I can’t reach the local engine.");
});

test("shows an operation error instead of an all-clear state", () => {
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
  vm.runInContext(statusSource, sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.__lexiconSuggestions;

  const field = {
    getBoundingClientRect: () => ({ top: 100, bottom: 200, left: 50, right: 400 }),
  };

  api.show(field, [], { error: "Request failed: 500" });
  const state = api.state();
  assert.equal(state.badgeEl.classList.contains("error"), true);
  assert.equal(state.badgeEl.title, "Something went wrong.");
});

test(
  "keeps independent badges for multiple fields and exposes dictionary action",
  async () => {
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
      contains(name) {
        return this.classes.has(name);
      },
    },
    style: {},
    children: [],
    hidden: false,
    textContent: "",
    title: "",
    listeners: {},
    offsetHeight: 100,
    scrollCalls: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    removeEventListener() {},
    setAttribute() {},
    scrollIntoView(options) {
      this.scrollCalls.push(options);
    },
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
  vm.runInContext(statusSource, sandbox);
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

  let addedMatch = null;
  let focusedMatchIndex = null;
  api.showField(field1, [match], {
    onFocusMatch: (index) => {
      focusedMatchIndex = index;
    },
    onAddToDictionary: async (selected) => {
      addedMatch = selected;
      return true;
    },
  });
  api.showField(field2, []);

  assert.equal(api.fieldStates().length, 2);
  assert.equal(api.fieldState(field1).badgeEl.children[1].textContent, "1");
  assert.equal(api.fieldState(field1).badgeEl.children[0].src, "icons/lex-issues.svg");
  assert.equal(api.fieldState(field2).badgeEl.children[0].src, "icons/lex-all-clear.svg");
  assert.ok(rootEl.children.length >= 7);
  const actions =
    api.fieldState(field1).panelEl.children[1].children[0].children[1];
  const row = api.fieldState(field1).panelEl.children[1].children[0];
  api.fieldState(field1).badgeEl.listeners.click({
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(api.fieldState(field1).panelOpen, true);
  api.scrollFieldMatchIntoView(field1, 0);
  assert.equal(row.classList.contains("active"), true);
  assert.equal(row.scrollCalls.length, 1);
  assert.equal(row.scrollCalls[0].block, "nearest");
  row.listeners.click({ target: row });
  assert.equal(focusedMatchIndex, 0);
  const dictionary = actions.children[actions.children.length - 1];
  assert.equal(dictionary.className, "dictionary");
  assert.equal(dictionary.textContent, "Add to Dictionary");
  await dictionary.listeners.click();
  assert.equal(addedMatch, match);
  api.showFieldMatchTooltip(
    field1,
    match,
    { top: 100, bottom: 180, left: 50, right: 400 },
    {
      onAddToDictionary: async (selected) => {
        addedMatch = selected;
        return true;
      },
    },
  );
  const tooltipActions = api.fieldState(field1).tooltipEl.children[2];
  const tooltipDictionary =
    tooltipActions.children[tooltipActions.children.length - 1];
  assert.equal(tooltipDictionary.textContent, "Add to Dictionary");
  await tooltipDictionary.listeners.click({
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(addedMatch, match);
  api.setCheckingField(field1);
  assert.equal(
    api.fieldState(field1).badgeEl.children[0].src,
    "icons/lex-checking.svg",
  );
  api.updateField(field1, []);
  assert.equal(
    api.fieldState(field1).badgeEl.children[0].src,
    "icons/lex-all-clear.svg",
  );
  api.showField(field1, [], { aiError: "model failed" });
  assert.equal(
    api.fieldState(field1).badgeEl.children[0].src,
    "icons/lex-error.svg",
  );
  api.hideField(field1);
  assert.equal(api.fieldStates().length, 1);
  },
);

test("tooltip stays open briefly after squiggle deactivation so the pointer can reach it", async () => {
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
    listeners: {},
    offsetHeight: 100,
    onmouseenter: null,
    onmouseleave: null,
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
      setTimeout,
      clearTimeout,
    },
    setTimeout,
    clearTimeout,
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  const api = sandbox.__lexiconSuggestions;
  const field = {
    tagName: "TEXTAREA",
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 180,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener() {},
    removeEventListener() {},
  };
  const match = {
    offset: 0,
    length: 3,
    message: "Spelling issue",
    replacements: ["The"],
  };

  api.showField(field, [match]);
  api.showFieldMatchTooltip(
    field,
    match,
    { top: 100, bottom: 120, left: 50, right: 120 },
  );
  const tooltip = api.fieldState(field).tooltipEl;
  assert.equal(tooltip.hidden, false);

  api.scheduleHideFieldMatchTooltip(field);
  assert.equal(tooltip.hidden, false);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(tooltip.hidden, true);

  api.showFieldMatchTooltip(
    field,
    match,
    { top: 100, bottom: 120, left: 50, right: 120 },
  );
  api.scheduleHideFieldMatchTooltip(field);
  tooltip.onmouseenter();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(tooltip.hidden, false);
});

test("Tone uses a dedicated badge popover and keeps the proofread panel clear", async () => {
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
    listeners: {},
    offsetHeight: 100,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
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
  const field = {
    tagName: "TEXTAREA",
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 180,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener() {},
    removeEventListener() {},
  };
  let selectedTool = "";
  let replacement = null;
  api.showField(field, [], {
    onTransform: async (tool) => {
      selectedTool = tool;
      return { ok: true, text: "Improved text", sourceText: "Original text" };
    },
    onApplyTransform: async (text, sourceText) => {
      replacement = { text, sourceText };
      return { ok: true };
    },
  });

  const state = api.fieldState(field);
  assert.equal(
    state.panelEl.children.some((child) => child.className === "ai"),
    false,
  );
  state.aiTriggerEl.listeners.click({
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(state.aiTriggerEl.children[1].textContent, "Tone");
  assert.match(state.aiTriggerEl.children[0].innerHTML, /M252,152/);
  const ai = state.aiPanelEl.children.find((child) => child.className === "ai");
  assert.ok(ai);
  const controls = ai.children[0];
  const select = controls.children[0];
  select.value = "Friendly";
  const run = controls.children[1];
  run.listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(selectedTool, "Friendly");
  const resultAi = state.aiPanelEl.children.find(
    (child) => child.className === "ai",
  );
  assert.equal(resultAi.children[1].textContent, "Improved text");
  const replace = resultAi.children[2];
  replace.listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(replacement, {
    text: "Improved text",
    sourceText: "Original text",
  });
});

function makePanelHarness() {
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
    value: "",
    listeners: {},
    offsetHeight: 100,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
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
  vm.runInContext(statusSource, sandbox);
  return sandbox.__lexiconSuggestions;
}

const EXPRESS_TONES_FIXTURE = {
  auto: "Auto text.",
  professional: "Professional text.",
  casual: "Casual text.",
  friendly: "Friendly text.",
  formal: "Formal text.",
  concise: "Concise text.",
};

test("expressToneModel shapes picker data with a language badge", async () => {
  const api = makePanelHarness();
  const model = api.expressToneModel(
    { detectedLanguage: "Spanish", tones: EXPRESS_TONES_FIXTURE },
    "casual",
  );
  assert.equal(model.usable, true);
  assert.equal(model.badge, "Spanish -> English");
  assert.equal(model.activeTone, "casual");
  assert.equal(model.preview, "Casual text.");
  // Compare serialized: values cross the vm sandbox realm boundary.
  assert.equal(
    JSON.stringify(model.tones.map((tone) => tone.key)),
    JSON.stringify(["auto", "professional", "casual", "friendly", "formal", "concise"]),
  );
  assert.equal(
    JSON.stringify(model.tones.map((tone) => tone.label)),
    JSON.stringify(["Auto", "Professional", "Casual", "Friendly", "Formal", "Concise"]),
  );
});

test("expressToneModel falls back without a badge for unknown input", async () => {
  const api = makePanelHarness();
  const unknown = api.expressToneModel(
    { detectedLanguage: "Unknown", tones: EXPRESS_TONES_FIXTURE },
    "pirate",
  );
  assert.equal(unknown.badge, "");
  assert.equal(unknown.activeTone, "auto");
  assert.equal(unknown.preview, "Auto text.");
  const broken = api.expressToneModel(null, null);
  assert.equal(broken.usable, false);
  assert.equal(broken.badge, "");
});

test("Express in English runs in the badge panel with a tone picker", async () => {
  const api = makePanelHarness();
  const field = {
    tagName: "TEXTAREA",
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 180,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener() {},
    removeEventListener() {},
  };
  let pickedTool = "";
  let replacement = null;
  api.showField(field, [], {
    onTransform: async (tool) => {
      pickedTool = tool;
      if (tool === "Express in English") {
        return {
          ok: true,
          express: true,
          detectedLanguage: "Spanish",
          tones: EXPRESS_TONES_FIXTURE,
          sourceText: "Hola.",
          selectedText: "Hola.",
          selection: { start: 0, end: 5 },
        };
      }
      return { ok: true, text: "Improved text", sourceText: "Hola." };
    },
    onApplyTransform: async (text, sourceText) => {
      replacement = { text, sourceText };
      return { ok: true };
    },
  });

  const state = api.fieldState(field);
  state.aiTriggerEl.listeners.click({
    preventDefault() {},
    stopPropagation() {},
  });
  const ai = state.aiPanelEl.children.find((child) => child.className === "ai");
  assert.ok(ai);
  const controls = ai.children[0];
  const select = controls.children[0];
  assert.ok(
    select.children.map((option) => option.value).includes("Express in English"),
  );
  assert.equal(select.children[0].value, "Express in English");
  select.value = "Express in English";
  const run = controls.children[1];
  run.listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(pickedTool, "Express in English");
  const resultAi = state.aiPanelEl.children.find(
    (child) => child.className === "ai",
  );
  const badge = resultAi.children.find((child) => child.className === "ai-lang");
  assert.equal(badge.textContent, "Spanish -> English");
  const tonesRow = resultAi.children.find(
    (child) => child.className === "ai-tones",
  );
  assert.equal(tonesRow.children.length, 6);
  const preview = resultAi.children.find(
    (child) => child.className === "ai-result",
  );
  assert.equal(preview.textContent, "Auto text.");
  const casualChip = tonesRow.children[2];
  casualChip.listeners.click();
  const updatedAi = state.aiPanelEl.children.find(
    (child) => child.className === "ai",
  );
  const updatedPreview = updatedAi.children.find(
    (child) => child.className === "ai-result",
  );
  assert.equal(updatedPreview.textContent, "Casual text.");
  const replace = updatedAi.children.find(
    (child) => child.className === "ai-replace",
  );
  replace.listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(replacement, {
    text: "Casual text.",
    sourceText: "Hola.",
  });
});

function loadPanelHarness({ resize } = {}) {
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
      contains(name) {
        return this.classes.has(name);
      },
    },
    style: {},
    children: [],
    hidden: false,
    textContent: "",
    title: "",
    value: "",
    disabled: false,
    listeners: {},
    offsetHeight: 100,
    scrollCalls: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    removeEventListener() {},
    setAttribute() {},
    scrollIntoView(options) {
      this.scrollCalls.push(options);
    },
    remove() {},
    attachShadow() {
      return {
        children: [],
        appendChild(child) {
          this.children.push(child);
          return child;
        },
      };
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
      ...(resize === undefined
        ? {}
        : { getComputedStyle: () => ({ resize }) }),
    },
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(statusSource, sandbox);
  vm.runInContext(source, sandbox);
  const field = {
    tagName: "TEXTAREA",
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 180,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener() {},
    removeEventListener() {},
  };
  return { api: sandbox.__lexiconSuggestions, field };
}

test("marks deep clarity rows with a distinct class", () => {
  const { api, field } = loadPanelHarness();
  api.showField(
    field,
    [
      {
        offset: 0,
        length: 3,
        message: "Possible typo",
        replacements: ["The"],
      },
      {
        offset: 10,
        length: 17,
        message: "Deep proofread suggestion.",
        replacements: ["capable of handling"],
        deep: true,
      },
    ],
    {},
  );
  const rows = api.fieldState(field).panelEl.children[1].children;
  assert.equal(rows.length, 2);
  assert.ok(!rows[0].className.includes("deep"));
  assert.ok(rows[1].className.includes("deep"));
});

test("invites a deeper check after suggestion activity empties the list", () => {
  const { api, field } = loadPanelHarness();
  let deepRuns = 0;
  api.showField(field, [], {
    deepOffer: "invite",
    onDeepProofread: () => {
      deepRuns += 1;
    },
  });
  const list = api.fieldState(field).panelEl.children[1];
  const invite = list.children.find((child) =>
    String(child.className || "").includes("deep-invite"),
  );
  assert.ok(invite);
  const run = invite.children.find((child) =>
    String(child.className || "").includes("deep-run"),
  );
  assert.equal(run.textContent, "Run Deep Proofread");
  run.listeners.click();
  assert.equal(deepRuns, 1);
});

test("shows no invite for a quiet field", () => {
  const { api, field } = loadPanelHarness();
  api.showField(field, [], {});
  const list = api.fieldState(field).panelEl.children[1];
  assert.ok(
    !list.children.some((child) =>
      String(child.className || "").includes("deep-invite"),
    ),
  );
});

test("names the deeper run while it checks", () => {
  const { api, field } = loadPanelHarness();
  api.showField(field, [], { checking: true, deepRunning: true });
  const list = api.fieldState(field).panelEl.children[1];
  assert.equal(
    list.children[0].textContent,
    "Running a deeper clarity check…",
  );
});

test("names a deep run that found nothing more", () => {
  const { api, field } = loadPanelHarness();
  api.showField(field, [], { deepEmptyNote: true });
  const list = api.fieldState(field).panelEl.children[1];
  assert.equal(
    list.children[0].textContent,
    "Deep proofread found nothing more.",
  );
});

const dragMatch = {
  offset: 0,
  length: 3,
  message: "Possible typo",
  replacements: ["The"],
};

function openPanel(api, field) {
  api.showField(field, [dragMatch], {});
  api.fieldState(field).badgeEl.listeners.click({
    preventDefault() {},
    stopPropagation() {},
  });
  return api.fieldState(field).panelEl;
}

function panelHeadHandle(panel) {
  const head = panel.children[0];
  return head.children.find((child) =>
    String(child.className || "").includes("drag-handle"),
  );
}

test("panel drag handle uses the Phosphor dots icon", () => {
  const { api, field } = loadPanelHarness();
  const panel = openPanel(api, field);
  const handle = panelHeadHandle(panel);
  const icon = handle.children.find((child) =>
    String(child.className || "").includes("drag-icon"),
  );
  assert.ok(icon);
  assert.ok(String(icon.innerHTML || "").includes("<svg"));
  assert.ok(String(icon.innerHTML || "").includes("M76,92"));
});

test("panel header offers a drag handle that moves the panel", () => {
  const { api, field } = loadPanelHarness();
  const panel = openPanel(api, field);
  const handle = panelHeadHandle(panel);
  assert.ok(handle);
  const beforeLeft = Number.parseFloat(panel.style.left);
  const beforeTop = Number.parseFloat(panel.style.top);

  handle.listeners.pointerdown({
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    preventDefault() {},
    stopPropagation() {},
  });
  handle.listeners.pointermove({ clientX: 130, clientY: 85, preventDefault() {} });
  handle.listeners.pointerup({});

  assert.equal(api.fieldState(field).dragOffset.x, 30);
  assert.equal(api.fieldState(field).dragOffset.y, -15);
  assert.equal(panel.style.left, `${beforeLeft + 30}px`);
  assert.equal(panel.style.top, `${beforeTop - 15}px`);
});

test("panel drag ignores non-primary buttons", () => {
  const { api, field } = loadPanelHarness();
  const panel = openPanel(api, field);
  const handle = panelHeadHandle(panel);
  handle.listeners.pointerdown({
    button: 2,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(handle.listeners.pointermove, undefined);
  assert.equal(api.fieldState(field).dragOffset, null);
});

test("panel drag clamps to the viewport", () => {
  const { api, field } = loadPanelHarness();
  const panel = openPanel(api, field);
  const handle = panelHeadHandle(panel);
  handle.listeners.pointerdown({
    button: 0,
    clientX: 500,
    clientY: 400,
    pointerId: 1,
    preventDefault() {},
    stopPropagation() {},
  });
  handle.listeners.pointermove({ clientX: -5000, clientY: 5000, preventDefault() {} });
  handle.listeners.pointerup({});
  assert.equal(panel.style.left, "8px");
  assert.ok(Number.parseFloat(panel.style.top) <= 800 - 48);
});

test("panel drag offset survives re-renders", () => {
  const { api, field } = loadPanelHarness();
  const panel = openPanel(api, field);
  const handle = panelHeadHandle(panel);
  handle.listeners.pointerdown({
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    preventDefault() {},
    stopPropagation() {},
  });
  handle.listeners.pointermove({ clientX: 120, clientY: 110, preventDefault() {} });
  handle.listeners.pointerup({});
  api.showField(field, [dragMatch], {});
  assert.equal(api.fieldState(field).dragOffset.x, 20);
  assert.equal(api.fieldState(field).dragOffset.y, 10);
});

test("badge leaves room for the native resize grip on resizable fields", () => {
  const { api, field } = loadPanelHarness({ resize: "both" });
  const pos = api.badgePosition(field);
  // Badge edge stops 20px short of the field corner grip zone.
  assert.equal(pos.left, 400 - 26 - 20);
  assert.equal(pos.top, 180 - 26);
});

test("badge treats textareas with automatic resize as resizable", () => {
  const { api, field } = loadPanelHarness({ resize: "auto" });
  const pos = api.badgePosition(field);
  assert.equal(pos.left, 400 - 26 - 20);
});

test("badge stays corner-flush on fixed fields", () => {
  const { api, field } = loadPanelHarness({ resize: "none" });
  const pos = api.badgePosition(field);
  assert.equal(pos.left, 400 - 26);
  assert.equal(pos.top, 180 - 26);
});

