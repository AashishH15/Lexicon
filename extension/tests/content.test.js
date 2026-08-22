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

function createHarness() {
  let messageHandler = null;
  let renderedMatches = [];
  let renderedOptions = null;
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
        sendMessage: async (message) => {
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
