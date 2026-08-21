import test from "node:test";
import assert from "node:assert/strict";

const frameResponses = new Map([
  [0, { ok: true, fields: [] }],
  [2, { ok: true, fields: [{ id: "field-1" }], activeId: null }],
]);
const sentMessages = [];
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
      async get() {
        return {};
      },
      async set() {},
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
