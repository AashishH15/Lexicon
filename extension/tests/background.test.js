import test from "node:test";
import assert from "node:assert/strict";

globalThis.fetch = async () => {
  throw new Error("test backend unavailable");
};

const frameResponses = new Map([
  [0, { ok: true, fields: [] }],
  [2, { ok: true, fields: [{ id: "field-1" }], activeId: null }],
]);
const sentMessages = [];
let storedSettings = {};
let messageHandler;

globalThis.browser = {
  runtime: {
    id: "test-extension",
    getManifest: () => ({ version: "test" }),
    onInstalled: { addListener() {} },
    onMessage: {
      addListener(handler) {
        messageHandler = handler;
      },
    },
  },
  commands: {
    onCommand: { addListener() {} },
  },
  storage: {
    local: {
      async get(key) {
        return key
          ? { [key]: storedSettings }
          : { lexiconSettings: storedSettings };
      },
      async set(value) {
        if (value?.lexiconSettings) storedSettings = value.lexiconSettings;
      },
    },
  },
  tabs: {
    onRemoved: { addListener() {} },
    async query() {
      return [{ id: 7, url: "https://forms.example.test" }];
    },
    async get() {
      return { id: 7, url: "https://forms.example.test" };
    },
    async sendMessage(tabId, message, options) {
      sentMessages.push({ tabId, message, options });
      if (message.type === "lexicon:list-fields") {
        return frameResponses.get(options?.frameId);
      }
      return { ok: true, selected: options?.frameId };
    },
  },
};
globalThis.chrome = { runtime: { id: "test-extension" } };

await import("../shared/background.js?background-test");

test("routes field listing to a frame that contains visible fields", async () => {
  assert.ok(messageHandler);
  await messageHandler(
    { type: "lexicon:frame-ready" },
    { tab: { id: 7 }, frameId: 0 },
  );
  await messageHandler(
    { type: "lexicon:frame-fields", hasFields: true },
    { tab: { id: 7 }, frameId: 2 },
  );

  const response = await messageHandler(
    {
      type: "lexicon:content-command",
      tabId: 7,
      message: { type: "lexicon:list-fields" },
    },
    {},
  );

  assert.equal(response.ok, true);
  assert.equal(response.frameId, 2);
  assert.equal(response.fields[0].id, "field-1");
});

test("routes later field commands to the selected frame", async () => {
  sentMessages.length = 0;
  const response = await messageHandler(
    {
      type: "lexicon:content-command",
      tabId: 7,
      frameId: 2,
      message: { type: "lexicon:select-field", fieldId: "field-1" },
    },
    {},
  );

  assert.deepEqual(response, { ok: true, selected: 2 });
  assert.equal(sentMessages.at(-1).options.frameId, 2);
});

test("adds dictionary words and ignores case-insensitive duplicates", async () => {
  storedSettings = {};
  const sender = { tab: { id: 7 }, frameId: 2 };
  const added = await messageHandler(
    { type: "lexicon:add-to-dictionary", word: "  Lexicon  " },
    sender,
  );
  assert.deepEqual(added, {
    ok: true,
    queued: true,
    added: true,
    word: "Lexicon",
    words: ["Lexicon"],
    userDictionary: ["Lexicon"],
    dictionaryRevision: 0,
    pendingDictionaryOps: [{ op: "add", word: "Lexicon" }],
  });
  assert.deepEqual(
    sentMessages
      .filter(({ message }) => message.type === "lexicon:settings-changed")
      .map(({ options }) => options.frameId)
      .sort((a, b) => a - b),
    [0, 2],
  );

  const duplicate = await messageHandler(
    { type: "lexicon:add-to-dictionary", word: "lexicon" },
    sender,
  );
  assert.deepEqual(duplicate, {
    ok: true,
    queued: true,
    added: false,
    word: "Lexicon",
    words: ["Lexicon"],
    userDictionary: ["Lexicon"],
    dictionaryRevision: 0,
    pendingDictionaryOps: [{ op: "add", word: "Lexicon" }],
  });
  assert.deepEqual(storedSettings.userDictionary, ["Lexicon"]);
});

test("passes the saved dictionary to grammar checks", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  storedSettings = {
    paused: false,
    disabledSites: [],
    userDictionary: ["Lexicon"],
  };
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith("/extension/ping")) {
      return {
        ok: true,
        async json() {
          return { ok: true, app: "lexicon" };
        },
      };
    }
    if (url.endsWith("/grammar/check")) {
      requests.push(JSON.parse(options.body));
      return {
        ok: true,
        async json() {
          return { matches: [] };
        },
      };
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    const response = await messageHandler(
      { type: "lexicon:check-text", text: "Lexicon is ready." },
      { tab: { id: 7 }, frameId: 2, url: "https://forms.example.test" },
    );
    assert.deepEqual(response, { ok: true, matches: [] });
    assert.deepEqual(requests[0], {
      text: "Lexicon is ready.",
      language: "en-US",
      ignore: ["Lexicon"],
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("merges the extension cache and replays offline dictionary deltas", async () => {
  const previousFetch = globalThis.fetch;
  let remoteWords = ["DesktopWord"];
  let remoteRevision = 4;

  const response = (body) => ({
    ok: true,
    async json() {
      return body;
    },
  });
  const onlineFetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/extension/ping") {
      return response({ ok: true, app: "lexicon" });
    }
    if (path === "/dictionary" && !options.method) {
      return response({
        ok: true,
        words: remoteWords,
        revision: remoteRevision,
      });
    }
    if (path === "/dictionary/add") {
      const { word } = JSON.parse(options.body);
      const existing = remoteWords.find(
        (item) => item.toLowerCase() === word.toLowerCase(),
      );
      if (!existing) {
        remoteWords = [...remoteWords, word];
        remoteRevision += 1;
      }
      return response({
        ok: true,
        words: remoteWords,
        revision: remoteRevision,
        word: existing || word,
        added: !existing,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  storedSettings = {
    paused: false,
    disabledSites: [],
    userDictionary: ["ExtensionWord"],
  };
  globalThis.fetch = onlineFetch;
  try {
    const merged = await messageHandler(
      { type: "lexicon:get-settings", site: "forms.example.test" },
      { tab: { id: 7 }, frameId: 2, url: "https://forms.example.test" },
    );
    assert.deepEqual(merged.userDictionary, [
      "DesktopWord",
      "ExtensionWord",
    ]);
    assert.equal(merged.dictionaryMigrated, true);
    assert.equal(merged.dictionaryRevision, 5);
    assert.deepEqual(remoteWords, ["DesktopWord", "ExtensionWord"]);

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const queued = await messageHandler(
      { type: "lexicon:add-to-dictionary", word: "OfflineWord" },
      { tab: { id: 7 }, frameId: 2 },
    );
    assert.equal(queued.queued, true);
    assert.deepEqual(queued.userDictionary, [
      "DesktopWord",
      "ExtensionWord",
      "OfflineWord",
    ]);
    assert.deepEqual(queued.pendingDictionaryOps, [
      { op: "add", word: "OfflineWord" },
    ]);

    globalThis.fetch = onlineFetch;
    const replayed = await messageHandler(
      { type: "lexicon:add-to-dictionary", word: "OnlineWord" },
      { tab: { id: 7 }, frameId: 2 },
    );
    assert.equal(replayed.queued, false);
    assert.deepEqual(replayed.pendingDictionaryOps, []);
    assert.deepEqual(remoteWords, [
      "DesktopWord",
      "ExtensionWord",
      "OfflineWord",
      "OnlineWord",
    ]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("serializes concurrent extension dictionary mutations without lost words", async () => {
  const previousFetch = globalThis.fetch;
  let remoteWords = [];
  let remoteRevision = 0;
  const response = (body) => ({
    ok: true,
    async json() {
      return body;
    },
  });
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/extension/ping") return response({ ok: true, app: "lexicon" });
    if (path === "/dictionary" && !options.method) {
      return response({ ok: true, words: remoteWords, revision: remoteRevision });
    }
    if (path === "/dictionary/add") {
      const { word } = JSON.parse(options.body);
      const existing = remoteWords.find(
        (item) => item.toLowerCase() === word.toLowerCase(),
      );
      if (!existing) {
        remoteWords = [...remoteWords, word];
        remoteRevision += 1;
      }
      return response({
        ok: true,
        words: remoteWords,
        revision: remoteRevision,
        word: existing || word,
        added: !existing,
      });
    }
    throw new Error(`unexpected request: ${url}`);
  };
  storedSettings = {
    paused: false,
    disabledSites: [],
    userDictionary: [],
    dictionaryRevision: 0,
    pendingDictionaryOps: [],
    dictionaryMigrated: true,
  };

  try {
    const results = await Promise.all([
      messageHandler(
        { type: "lexicon:add-to-dictionary", word: "First" },
        { tab: { id: 7 }, frameId: 0 },
      ),
      messageHandler(
        { type: "lexicon:add-to-dictionary", word: "Second" },
        { tab: { id: 7 }, frameId: 2 },
      ),
    ]);
    assert.equal(results.every((result) => result.ok), true);
    assert.deepEqual(remoteWords, ["First", "Second"]);
    assert.deepEqual(storedSettings.userDictionary, ["First", "Second"]);
    assert.deepEqual(storedSettings.pendingDictionaryOps, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("does not replace a newer extension cache with a stale revision", async () => {
  const previousFetch = globalThis.fetch;
  storedSettings = {
    paused: false,
    disabledSites: [],
    userDictionary: ["CachedWord"],
    dictionaryRevision: 5,
    pendingDictionaryOps: [],
    dictionaryMigrated: true,
  };
  const response = (body) => ({
    ok: true,
    async json() {
      return body;
    },
  });
  globalThis.fetch = async (url) => {
    if (new URL(url).pathname === "/extension/ping") {
      return response({ ok: true, app: "lexicon" });
    }
    return response({ ok: true, words: ["StaleWord"], revision: 4 });
  };
  try {
    const result = await messageHandler({ type: "lexicon:sync-dictionary" }, {});
    assert.equal(result.ok, true);
    assert.deepEqual(result.userDictionary, ["CachedWord"]);
    assert.equal(result.dictionaryRevision, 5);
    assert.deepEqual(storedSettings.userDictionary, ["CachedWord"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
