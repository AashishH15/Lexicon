import test from "node:test";
import assert from "node:assert/strict";

import {
  isSiteDisabled,
  normalizeDictionary,
  normalizeDictionaryOperations,
  normalizeSettings,
  normalizeSite,
  queueDictionaryOperation,
} from "../shared/settings.js";

test("normalizeSite stores host names without protocol or trailing dot", () => {
  assert.equal(normalizeSite("https://Example.com/path"), "example.com");
  assert.equal(normalizeSite("Example.com."), "example.com");
  assert.equal(normalizeSite("chrome://extensions"), "");
  assert.equal(normalizeSite(""), "");
});

test("normalizeSettings removes invalid and duplicate disabled sites", () => {
  assert.deepEqual(
    normalizeSettings({
      paused: 1,
      disabledSites: ["Example.com", "https://example.com/path", "", null],
    }),
    {
      paused: true,
      disabledSites: ["example.com"],
      userDictionary: [],
      dictionaryRevision: 0,
      pendingDictionaryOps: [],
      dictionaryMigrated: false,
    },
  );
});

test("normalizeDictionary trims words and removes case-insensitive duplicates", () => {
  assert.deepEqual(
    normalizeDictionary([" Lexicon ", "lexicon", "", null, "Custom Term"]),
    ["Lexicon", "Custom Term"],
  );
});

test("normalizeSettings preserves a normalized user dictionary", () => {
  assert.deepEqual(
    normalizeSettings({
      userDictionary: [" Teh ", "teh", "Lex"],
    }).userDictionary,
    ["Teh", "Lex"],
  );
});

test("normalizes dictionary revisions and pending operations", () => {
  const settings = normalizeSettings({
    dictionaryRevision: "7",
    pendingDictionaryOps: [
      { op: "add", word: " Lexicon " },
      { op: "remove", word: "" },
      { op: "other", word: "ignored" },
    ],
    dictionaryMigrated: true,
  });
  assert.equal(settings.dictionaryRevision, 7);
  assert.deepEqual(settings.pendingDictionaryOps, [
    { op: "add", word: "Lexicon" },
  ]);
  assert.equal(settings.dictionaryMigrated, true);
  assert.deepEqual(
    normalizeDictionaryOperations(settings.pendingDictionaryOps),
    settings.pendingDictionaryOps,
  );
});

test("queueDictionaryOperation keeps only the latest delta per word", () => {
  assert.deepEqual(
    queueDictionaryOperation(
      [{ op: "add", word: "Lexicon" }],
      "remove",
      " lexicon ",
    ),
    [{ op: "remove", word: "lexicon" }],
  );
});

test("isSiteDisabled matches the normalized host name", () => {
  const settings = normalizeSettings({
    disabledSites: ["example.com"],
  });
  assert.equal(isSiteDisabled(settings, "https://EXAMPLE.com/form"), true);
  assert.equal(isSiteDisabled(settings, "other.example.com"), false);
});
