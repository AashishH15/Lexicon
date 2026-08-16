// Tests for the backend client. Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import {
  BACKEND_PORTS,
  buildGrammarRequest,
  buildTransformRequest,
  discoverBackend,
  formatMatches,
  getBackendBaseUrl,
  isValidPing,
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
  assert.deepEqual(buildGrammarRequest("teh cat", "en-US", []), {
    text: "teh cat",
    language: "en-US",
    ignore: [],
  });
  assert.deepEqual(buildGrammarRequest("teh cat"), {
    text: "teh cat",
    language: "en-US",
    ignore: [],
  });
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
