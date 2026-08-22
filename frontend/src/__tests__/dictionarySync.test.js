import { describe, expect, it } from "vitest";
import {
  applyDictionaryOperation,
  dictionariesEqual,
  isDictionaryRevisionStale,
  loadDictionaryCache,
  loadDictionaryMigrationState,
  loadDictionaryQueue,
  loadDictionaryRevision,
  normalizeDictionary,
  persistDictionaryCache,
  persistDictionaryMigrationState,
  persistDictionaryQueue,
  queueDictionaryOperation,
} from "../dictionarySync.js";

describe("dictionary sync helpers", () => {
  it("normalizes words and keeps the first spelling", () => {
    expect(normalizeDictionary([" Lexicon ", "lexicon", "", null, "Term"])).toEqual([
      "Lexicon",
      "Term",
    ]);
  });

  it("coalesces queued deltas for one case-insensitive word", () => {
    const queue = queueDictionaryOperation(
      queueDictionaryOperation([], "add", "Lexicon"),
      "remove",
      " lexicon ",
    );
    expect(queue).toEqual([{ op: "remove", word: "lexicon" }]);
  });

  it("applies pending deltas on top of a canonical snapshot", () => {
    let words = ["Canonical"];
    words = applyDictionaryOperation(words, { op: "add", word: "Local" });
    words = applyDictionaryOperation(words, { op: "remove", word: "canonical" });
    expect(words).toEqual(["Local"]);
  });

  it("compares normalized dictionaries", () => {
    expect(dictionariesEqual([" Lexicon "], ["Lexicon"])).toBe(true);
    expect(dictionariesEqual(["Lexicon"], ["Other"])).toBe(false);
  });

  it("rejects a snapshot older than the cached revision", () => {
    expect(isDictionaryRevisionStale(4, 5)).toBe(true);
    expect(isDictionaryRevisionStale(5, 5)).toBe(false);
    expect(isDictionaryRevisionStale("6", 5)).toBe(false);
  });

  it("round-trips the local cache, revision, migration marker, and queue", () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    persistDictionaryCache([" Lexicon ", "lexicon"], 12, storage);
    persistDictionaryQueue([{ op: "add", word: "Offline" }], storage);
    persistDictionaryMigrationState(true, storage);

    expect(loadDictionaryCache(storage)).toEqual(["Lexicon"]);
    expect(loadDictionaryRevision(storage)).toBe(12);
    expect(loadDictionaryQueue(storage)).toEqual([
      { op: "add", word: "Offline" },
    ]);
    expect(loadDictionaryMigrationState(storage)).toBe(true);
  });
});
