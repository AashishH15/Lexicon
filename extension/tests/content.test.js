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
  let focusedMatch = null;
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
  let replacedOnce = false;
  let deepRequest = null;
  let deepRequestCount = 0;
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
              ...(options.settings || {}),
            };
          }
          if (message.type === "lexicon:add-to-dictionary") {
            addedWords.push(message.word);
            return { ok: true, word: message.word };
          }
          if (message.type === "lexicon:transform-text") {
            transformRequest = message;
            if (
              options.transformResult &&
              typeof options.transformResult === "object"
            ) {
              return { ok: true, ...options.transformResult };
            }
            return {
              ok: true,
              text: options.transformResult || "THE",
            };
          }
          if (message.type === "lexicon:deep-proofread") {
            deepRequest = message;
            deepRequestCount += 1;
            if (options.deepResult !== undefined) return options.deepResult;
            return { ok: true, matches: options.deepMatches || [] };
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
      extractEditableText: (target) => {
        // Gmail-like editors restructure blocks on edit. Model that by
        // reporting a trailing break once a replace has landed.
        let text = target.value;
        if (options.trailingBreak && replacedOnce) text += "\n";
        return { kind: "textarea", text, segments: null };
      },
      normalizeText: (text) => String(text).replace(/\r\n?/g, "\n"),
      getSelection: () => options.selection || null,
      isNotionEditor: () => false,
      isYoutubeEditor: () => false,
      isFrameworkEditor: () => false,
      replaceEditableRange: (target, _kind, start, end, text) => {
        target.value =
          target.value.slice(0, start) + text + target.value.slice(end);
        replacedOnce = true;
        return true;
      },
      replaceEditableText: (target, _kind, text) => {
        target.value = text;
        replacedOnce = true;
        return true;
      },
      editableFromNode: () => field,
    },
    __lexiconSquiggle: {
      applyFieldSquiggles() {},
      clearFieldSquiggles() {},
      scrollToMatch(target, index, options) {
        focusedMatch = { target, index, options };
        return true;
      },
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
    get deepRequest() {
      return deepRequest;
    },
    get deepRequestCount() {
      return deepRequestCount;
    },
    get focusedMatch() {
      return focusedMatch;
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

test("error navigation delegates to the matching squiggle", async () => {
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
      {
        offset: 4,
        length: 3,
        message: "Another typo",
        replacements: ["the"],
      },
    ],
  });

  harness.renderedOptions.onFocusMatch(1);
  assert.equal(harness.focusedMatch.target, harness.field);
  assert.equal(harness.focusedMatch.index, 1);
  assert.equal(harness.focusedMatch.options.flash, true);
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

test("AI replace succeeds when the editor normalizes nearby breaks", async () => {
  const harness = createHarness({
    selection: { start: 4, end: 7, text: "teh" },
    transformResult: "the",
    trailingBreak: true,
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({
    type: "lexicon:highlight",
    matches: [],
  });

  const result = await harness.renderedOptions.onTransform("Friendly");
  const applied = await harness.renderedOptions.onApplyTransform(
    result.text,
    result.sourceText,
    result.selection,
    result.selectedText,
  );
  assert.deepEqual(plain(applied), { ok: true });
  assert.equal(harness.field.value, "teh the");
});

test("AI express passes tones through for the tone picker", async () => {
  const tones = {
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
  };
  const harness = createHarness({
    selection: { start: 4, end: 7, text: "teh" },
    transformResult: {
      express: true,
      detectedLanguage: "Spanish",
      tones,
    },
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({
    type: "lexicon:highlight",
    matches: [],
  });

  const result = await harness.renderedOptions.onTransform(
    "Express in English",
  );
  assert.equal(harness.transformRequest.tool, "Express in English");
  assert.equal(result.express, true);
  assert.equal(result.detectedLanguage, "Spanish");
  assert.deepEqual(result.tones, tones);
  assert.deepEqual(plain(result.selection), { start: 4, end: 7 });
});

test("ignores synchronous runtime errors from an invalidated extension context", () => {
  assert.doesNotThrow(() => createHarness({ throwOnNotification: true }));
});

const typoMatch = () => ({
  offset: 0,
  length: 3,
  message: "Possible typo",
  replacements: ["the"],
});

async function flushDeep() {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("empty result after an apply invites a deeper check", async () => {
  const harness = createHarness();
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [typoMatch()] });
  harness.renderedOptions.onApply(0);
  assert.equal(harness.renderedOptions.deepOffer, "invite");
  assert.equal(typeof harness.renderedOptions.onDeepProofread, "function");

  // The invite survives the post-apply verification recheck instead of
  // vanishing a second later.
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  assert.equal(harness.renderedOptions.deepOffer, "invite");
  assert.equal(harness.deepRequest, null);

  // Fresh grammar work supersedes the invite. Afterwards the field is
  // quiet again with no new activity.
  await harness.messageHandler({ type: "lexicon:highlight", matches: [typoMatch()] });
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  assert.equal(harness.renderedOptions.deepOffer, "none");
});

test("auto-runs deep after an apply when the toggle is on", async () => {
  const deep = {
    offset: 0,
    length: 3,
    message: "Deep proofread suggestion.",
    replacements: ["THE"],
    deep: true,
  };
  const harness = createHarness({
    settings: { deepAutoRun: true },
    deepMatches: [deep],
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [typoMatch()] });
  harness.renderedOptions.onApply(0);
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();

  assert.ok(harness.deepRequest);
  assert.equal(harness.deepRequest.type, "lexicon:deep-proofread");
  assert.equal(harness.deepRequest.text, "the teh");
  assert.equal(harness.renderedMatches.length, 1);
  assert.equal(harness.renderedMatches[0].deep, true);

  // A later empty check does not fire a second deep run.
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();
  assert.equal(harness.deepRequestCount, 1);
});

test("dismiss-only emptying invites but never auto-runs", async () => {
  const harness = createHarness({ settings: { deepAutoRun: true } });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [typoMatch()] });
  harness.renderedOptions.onDismiss(0);
  assert.equal(harness.renderedOptions.deepOffer, "invite");

  // The invite survives later empty rechecks without ever auto-running.
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();
  assert.equal(harness.renderedOptions.deepOffer, "invite");
  assert.equal(harness.deepRequest, null);
});

test("quiet field with no activity stays quiet", async () => {
  const harness = createHarness({ settings: { deepAutoRun: true } });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();

  assert.equal(harness.renderedOptions.deepOffer, "none");
  assert.equal(harness.deepRequest, null);
});

test("deep suggestion activity does not re-arm another deep run", async () => {
  const deep = {
    offset: 0,
    length: 3,
    message: "Deep proofread suggestion.",
    replacements: ["THE"],
    deep: true,
  };
  const harness = createHarness({
    settings: { deepAutoRun: true },
    deepMatches: [],
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [deep] });
  harness.renderedOptions.onApply(0);
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();

  assert.equal(harness.renderedOptions.deepOffer, "none");
  assert.equal(harness.deepRequest, null);
});

test("a deep run that finds nothing leaves a visible note", async () => {
  const harness = createHarness({
    settings: { deepAutoRun: true },
    deepMatches: [],
  });
  await new Promise((resolve) => setImmediate(resolve));

  await harness.messageHandler({ type: "lexicon:highlight", matches: [typoMatch()] });
  harness.renderedOptions.onApply(0);
  await harness.messageHandler({ type: "lexicon:highlight", matches: [] });
  await flushDeep();

  assert.equal(harness.deepRequestCount, 1);
  assert.equal(harness.renderedOptions.deepEmptyNote, true);
});
