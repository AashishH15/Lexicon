// Tests for the backend client. Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import {
  addDictionaryWord,
  BACKEND_PORTS,
  buildDictionaryWordRequest,
  buildGrammarRequest,
  buildTransformRequest,
  discoverBackend,
  formatMatches,
  getBackendBaseUrl,
  getDictionary,
  isValidPing,
  removeDictionaryWord,
} from "../shared/api.js";

test("backend ports probe 18000 (packaged) before 8000 (dev launcher)", () => {
  assert.deepEqual(BACKEND_PORTS, [18000, 8000]);
});

test("isValidPing only accepts Lexicon's own ping payload", () => {
  assert.equal(isValidPing({ ok: true, app: "lexicon" }), true);
  assert.equal(isValidPing({ ok: false, app: "lexicon" }), false);
  assert.equal(isValidPing({ ok: true, app: "other" }), false);
  assert.equal(isValidPing({ status: "ok" }), false);
  assert.equal(isValidPing(null), false);
  assert.equal(isValidPing("ok"), false);
});

test("discoverBackend clears a stale connection after both probes fail", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("connection refused");
  };
  try {
    assert.equal(await discoverBackend(), null);
    assert.equal(getBackendBaseUrl(), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("grammar request matches the desktop app shape", () => {
  assert.deepEqual(buildGrammarRequest("teh cat", "en-US", ["teh"]), {
    text: "teh cat",
    language: "en-US",
    ignore: ["teh"],
  });
  assert.deepEqual(buildGrammarRequest("teh cat"), {
    text: "teh cat",
    language: "en-US",
    ignore: [],
  });
});

test("dictionary requests use the shared word payload", () => {
  assert.deepEqual(buildDictionaryWordRequest(" Lexicon "), {
    word: " Lexicon ",
  });
});

test("dictionary client reads and mutates canonical snapshots", async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/extension/ping")) {
      return {
        ok: true,
        async json() {
          return { ok: true, app: "lexicon" };
        },
      };
    }
    return {
      ok: true,
      async json() {
        return { ok: true, words: ["Lexicon"], revision: 2 };
      },
    };
  };
  try {
    await discoverBackend();
    assert.deepEqual(await getDictionary(), {
      ok: true,
      words: ["Lexicon"],
      revision: 2,
    });
    await addDictionaryWord("New");
    await removeDictionaryWord("Old");
    assert.deepEqual(
      calls.slice(1).map(({ url, options }) => ({
        path: new URL(url).pathname,
        method: options.method || "GET",
        body: options.body ? JSON.parse(options.body) : null,
      })),
      [
        { path: "/dictionary", method: "GET", body: null },
        { path: "/dictionary/add", method: "POST", body: { word: "New" } },
        { path: "/dictionary/remove", method: "POST", body: { word: "Old" } },
      ],
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("transform request matches the desktop app shape (no model_key/backend keys)", () => {
  const body = buildTransformRequest("Rewrite this", "teh cat");
  assert.deepEqual(body, { prompt: "Rewrite this", text: "teh cat" });
  assert.equal("model_key" in body, false);
  assert.equal("backend" in body, false);
});

test("formatMatches preserves offsets and defaults missing fields", () => {
  assert.deepEqual(
    formatMatches([
      { offset: 0, length: 3, message: "Possible typo", replacements: ["the"] },
      { offset: 4, length: 3 },
    ]),
    [
      {
        offset: 0,
        length: 3,
        message: "Possible typo",
        replacements: ["the"],
        category: "",
      },
      {
        offset: 4,
        length: 3,
        message: undefined,
        replacements: [],
        category: "",
      },
    ],
  );
  assert.deepEqual(formatMatches(null), []);
  assert.deepEqual(formatMatches(undefined), []);
});
