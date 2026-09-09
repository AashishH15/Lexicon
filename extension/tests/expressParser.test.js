// Checks for the extension Express parser and tier gate.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import {
  EXPRESS_MAX_CHARS,
  EXPRESS_TONES,
  isExpressTool,
  parseExpressJson,
  resolveExpressGate,
} from "../shared/expressParser.js";

function fullTones(overrides = {}) {
  return {
    auto: "Auto text.",
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
    ...overrides,
  };
}

function rawJson(detectedLanguage = "Spanish", tones = fullTones()) {
  return JSON.stringify({ detectedLanguage, tones });
}

function bundledStatus(modelKey, ready = true) {
  return {
    preference: { backend: "bundled", model_key: modelKey },
    models_ready: { [modelKey]: ready },
    model_key: modelKey,
  };
}

test("lists six tones with auto first and a 600 char cap", () => {
  assert.deepEqual(EXPRESS_TONES, [
    "auto",
    "professional",
    "casual",
    "friendly",
    "formal",
    "concise",
  ]);
  assert.equal(EXPRESS_MAX_CHARS, 600);
  assert.equal(isExpressTool("Express in English"), true);
  assert.equal(isExpressTool("Rewrite"), false);
});

test("parses pure JSON", () => {
  const result = parseExpressJson(rawJson());
  assert.equal(result.detectedLanguage, "Spanish");
  assert.equal(result.tones.auto, "Auto text.");
  assert.equal(result.tones.professional, "Professional text.");
  assert.equal(result.tones.concise, "Concise text.");
});

test("strips markdown fences and chatter", () => {
  const fenced = parseExpressJson("```json\n" + rawJson("German") + "\n```");
  assert.equal(fenced.detectedLanguage, "German");
  const chatter = parseExpressJson(
    "Sure! Here is the result:\n" + rawJson("French") + "\nHope this helps.",
  );
  assert.equal(chatter.detectedLanguage, "French");
  assert.equal(chatter.tones.casual, "Casual text.");
});

test("fills a missing tone from the closest available tone", () => {
  const tones = fullTones();
  delete tones.formal;
  const result = parseExpressJson(rawJson("Spanish", tones));
  for (const tone of EXPRESS_TONES) {
    assert.equal(typeof result.tones[tone], "string");
    assert.ok(result.tones[tone].length > 0);
  }
});

test("uses Unknown when the language is missing", () => {
  const result = parseExpressJson(JSON.stringify({ tones: fullTones() }));
  assert.equal(result.detectedLanguage, "Unknown");
});

test("falls back to professional for a missing auto tone", () => {
  const tones = fullTones();
  delete tones.auto;
  const result = parseExpressJson(rawJson("Spanish", tones));
  assert.equal(result.tones.auto, "Professional text.");
});

test("fills every tone from auto when it is the only tone", () => {
  const result = parseExpressJson(
    JSON.stringify({ detectedLanguage: "Spanish", tones: { auto: "Only auto." } }),
  );
  for (const tone of EXPRESS_TONES) {
    assert.equal(result.tones[tone], "Only auto.");
  }
});

test("treats truncated JSON and plain text as one tone", () => {
  const truncated = parseExpressJson(
    '{"detectedLanguage": "Spanish", "tones": {"professional": "Hola',
  );
  for (const tone of EXPRESS_TONES) {
    assert.ok(truncated.tones[tone].length > 0);
  }
  const plain = parseExpressJson("I am happy with the results.");
  assert.ok(plain.tones.professional.includes("happy"));
});

test("replaces em and en dashes in tone text", () => {
  const em = String.fromCharCode(8212);
  const en = String.fromCharCode(8211);
  const result = parseExpressJson(
    JSON.stringify({
      detectedLanguage: "German",
      tones: fullTones({
        casual: `Hans crushed it in 2024${em}I'm glad.`,
        friendly: `Nice work${en}well done.`,
      }),
    }),
  );
  assert.equal(result.tones.casual, "Hans crushed it in 2024, I'm glad.");
  assert.equal(result.tones.friendly, "Nice work, well done.");
});

test("never throws for empty or wrong types", () => {
  for (const bad of ["", "   ", null, undefined, 42, {}, []]) {
    const result = parseExpressJson(bad);
    assert.equal(typeof result.detectedLanguage, "string");
    for (const tone of EXPRESS_TONES) {
      assert.equal(typeof result.tones[tone], "string");
    }
  }
});

test("runs Standard and Quality", () => {
  assert.equal(resolveExpressGate(bundledStatus("2b")), "run");
  assert.equal(resolveExpressGate(bundledStatus("quality")), "run");
});

test("blocks Light", () => {
  assert.equal(resolveExpressGate(bundledStatus("0.8b")), "light");
});

test("asks for setup when nothing is ready", () => {
  assert.equal(resolveExpressGate(bundledStatus("2b", false)), "setup");
  assert.equal(resolveExpressGate(null), "setup");
  assert.equal(resolveExpressGate({}), "setup");
  assert.equal(resolveExpressGate("bundled"), "setup");
});

test("allows external servers", () => {
  assert.equal(
    resolveExpressGate({
      preference: { backend: "ollama" },
      ollama_available: true,
    }),
    "run",
  );
  assert.equal(
    resolveExpressGate({
      preference: { backend: "auto" },
      active_backend: "lmstudio",
      lmstudio_available: true,
    }),
    "run",
  );
  assert.equal(
    resolveExpressGate({
      preference: { backend: "ollama" },
      ollama_available: false,
    }),
    "setup",
  );
});
