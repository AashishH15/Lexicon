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
  getAuthToken,
  getBackendBaseUrl,
  getDictionary,
  isValidPing,
  removeDictionaryWord,
  setAuthToken,
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
    assert.equal(getAuthToken(), null);
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
    if (url.endsWith("/auth/handshake")) {
      return {
        ok: true,
        async json() {
          return { ok: true, token: "handshake-token-123" };
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
    assert.equal(getAuthToken(), "handshake-token-123");
    assert.deepEqual(await getDictionary(), {
      ok: true,
      words: ["Lexicon"],
      revision: 2,
    });
    await addDictionaryWord("New");
    await removeDictionaryWord("Old");
    assert.deepEqual(
      calls.slice(2).map(({ url, options }) => ({
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
    for (const call of calls.slice(2)) {
      assert.equal(call.options.headers?.Authorization, "Bearer handshake-token-123");
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("jsonRequest re-handshakes and retries on 401 response", async () => {
  const previousFetch = globalThis.fetch;
  let handshakeCount = 0;
  let dictionaryAttempts = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith("/extension/ping")) {
      return {
        ok: true,
        async json() {
          return { ok: true, app: "lexicon" };
        },
      };
    }
    if (url.endsWith("/auth/handshake")) {
      handshakeCount += 1;
      return {
        ok: true,
        async json() {
          return { ok: true, token: `token-v${handshakeCount}` };
        },
      };
    }
    if (url.endsWith("/dictionary")) {
      dictionaryAttempts += 1;
      if (dictionaryAttempts === 1) {
        return {
          status: 401,
          ok: false,
          async json() {
            return { detail: "Missing or invalid bearer token" };
          },
        };
      }
      return {
        status: 200,
        ok: true,
        async json() {
          return { ok: true, words: ["Recovered"], revision: 1 };
        },
      };
    }
    throw new Error(`Unexpected url: ${url}`);
  };

  try {
    await discoverBackend();
    assert.equal(getAuthToken(), "token-v1");

    const result = await getDictionary();
    assert.deepEqual(result, { ok: true, words: ["Recovered"], revision: 1 });
    assert.equal(dictionaryAttempts, 2);
    assert.equal(getAuthToken(), "token-v2");
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
