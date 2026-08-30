import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "content.js"),
  "utf-8",
);

const plain = (value) => JSON.parse(JSON.stringify(value));

function createHarness(options = {}) {
  let messageHandler = null;
  let renderedMatches = [];
  let renderedOptions = null;
  let transformRequest = null;
  const addedWords = [];
  const field = {
    tagName: "TEXTAREA",
    isConnected: true,
    value: "teh teh",
    listeners: new Map(),
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 180,
      left: 50,
      right: 400,
      height: 80,
    }),
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    },
    removeEventListener(type) {
      this.listeners.delete(type);
    },
  };
  const suggestions = {
    fieldInViewport: () => true,
    isSuggestionUiFocus: () => false,
    showField(_field, matches, options) {
      renderedMatches = matches;
      renderedOptions = options;
    },
    hideField() {},
    hideFieldMatchTooltip() {},
    showFieldMatchTooltip() {},
  };
  let timerId = 0;
  const sandbox = {
    document: {
      documentElement: {},
      contains: (node) => node === field,
      addEventListener() {},
    },
    window: {
      innerWidth: 1000,
      innerHeight: 800,
      addEventListener() {},
      removeEventListener() {},
    },
    location: { hostname: "example.test" },
    setTimeout(callback, delay) {
      const id = ++timerId;
      if (delay === 0) callback();
      return id;
    },
    clearTimeout() {},
    browser: {
      runtime: {
        sendMessage: (message) => {
          if (
            options.throwOnNotification &&
            [
              "lexicon:active-field",
              "lexicon:frame-fields",
              "lexicon:frame-ready",
            ].includes(message.type)
          ) {
            throw new Error("Extension context invalidated.");
          }
          if (message.type === "lexicon:get-settings") {
            return {
              paused: false,
              disabledSites: [],
              userDictionary: [],
            };
          }
          if (message.type === "lexicon:add-to-dictionary") {
            addedWords.push(message.word);
            return { ok: true, word: message.word };
          }
          if (message.type === "lexicon:transform-text") {
            transformRequest = message;
            return {
              ok: true,
              text: options.transformResult || "THE",
            };
          }
          return { ok: true };
        },
        onMessage: {
          addListener(handler) {
            messageHandler = handler;
          },
        },
      },
    },
    __lexiconEditable: {
      detectEditableFields: () => [field],
      detectEditableField: () => field,
      isVisible: () => true,
      extractEditableText: (target) => ({
        kind: "textarea",
        text: target.value,
        segments: null,
      }),
      normalizeText: (text) => String(text).replace(/\r\n?/g, "\n"),
      getSelection: () => options.selection || null,
      replaceEditableRange: (target, _kind, start, end, text) => {
        target.value =
          target.value.slice(0, start) + text + target.value.slice(end);
        return true;
      },
      editableFromNode: () => field,
    },
    __lexiconSquiggle: {
      applyFieldSquiggles() {},
      clearFieldSquiggles() {},
    },
    __lexiconSuggestions: suggestions,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return {
    field,
    addedWords,
    get renderedMatches() {
      return renderedMatches;
    },
    get renderedOptions() {
      return renderedOptions;
    },
    get messageHandler() {
      return messageHandler;
    },
    get transformRequest() {
      return transformRequest;
    },
  };
}

test("adding a dictionary word removes every matching visible squiggle", async () => {
  const harness = createHarness();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof harness.messageHandler, "function");

  const first = {
    offset: 0,
    length: 3,
    message: "Possible typo",
    replacements: ["the"],
  };
  const second = {
    offset: 4,
    length: 3,
    message: "Possible typo",
    replacements: ["the"],
  };
  const response = await harness.messageHandler({
    type: "lexicon:highlight",
    matches: [first, second],
  });

  assert.equal(response.ok, true);
  assert.equal(response.count, 2);
  assert.equal(typeof harness.renderedOptions.onAddToDictionary, "function");

  const added = await harness.renderedOptions.onAddToDictionary(first);

  assert.equal(added, true);
  assert.deepEqual(harness.addedWords, ["teh"]);
  assert.equal(harness.renderedMatches.length, 0);
});

test("canonical dictionary broadcasts remove matching field highlights", async () => {
  const harness = createHarness();
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({
    type: "lexicon:highlight",
    matches: [
      {
        offset: 0,
        length: 3,
        message: "Possible typo",
        replacements: ["the"],
      },
    ],
  });
  assert.equal(harness.renderedMatches.length, 1);

  const response = harness.messageHandler({
    type: "lexicon:settings-changed",
    settings: {
      paused: false,
      disabledSites: [],
      userDictionary: ["teh"],
    },
  });

  assert.equal(response.ok, true);
  assert.equal(harness.renderedMatches.length, 0);
});

test("AI transforms only the selected text and preserves the rest of the field", async () => {
  const harness = createHarness({
    selection: { start: 4, end: 7, text: "teh" },
    transformResult: "the",
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({
    type: "lexicon:highlight",
    matches: [],
  });
  assert.equal(typeof harness.renderedOptions.onTransform, "function");

  const result = await harness.renderedOptions.onTransform("Friendly");
  assert.equal(harness.transformRequest.text, "teh");
  assert.deepEqual(plain(result.selection), { start: 4, end: 7 });
  assert.equal(result.sourceText, "teh teh");

  const applied = await harness.renderedOptions.onApplyTransform(
    result.text,
    result.sourceText,
    result.selection,
    result.selectedText,
  );
  assert.deepEqual(plain(applied), { ok: true });
  assert.equal(harness.field.value, "teh the");
});

test("ignores synchronous runtime errors from an invalidated extension context", () => {
  assert.doesNotThrow(() => createHarness({ throwOnNotification: true }));
});
