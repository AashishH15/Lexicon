import { describe, expect, it } from "vitest";
import { GrammarCache } from "../grammarCache.js";

describe("GrammarCache structured fingerprints", () => {
  it("separates request context and core geometry", () => {
    const cache = new GrammarCache();
    const base = {
      requestText: "before\ncore\nafter",
      coreOffset: 7,
      coreLength: 4,
      language: "en-US",
      userDictionary: [],
      scanMode: "window",
    };

    const same = cache.computeKey(base);
    expect(cache.computeKey(base)).toBe(same);
    expect(
      cache.computeKey({ ...base, requestText: "changed\ncore\nafter" }),
    ).not.toBe(same);
    expect(cache.computeKey({ ...base, coreOffset: 6 })).not.toBe(same);
    expect(cache.computeKey({ ...base, coreLength: 5 })).not.toBe(same);
  });

  it("separates languages, dictionaries, and scan contracts", () => {
    const cache = new GrammarCache();
    const base = {
      requestText: "core",
      coreOffset: 0,
      coreLength: 4,
      language: "en-US",
      userDictionary: ["Lexicon"],
      scanMode: "window",
    };
    const key = cache.computeKey(base);

    expect(cache.computeKey({ ...base, language: "en-GB" })).not.toBe(key);
    expect(
      cache.computeKey({ ...base, userDictionary: ["Lexicon", "Tiptap"] }),
    ).not.toBe(key);
    expect(cache.computeKey({ ...base, scanMode: "full" })).not.toBe(key);
    expect(
      cache.computeKey({ ...base, scanVersion: "context-window-v2" }),
    ).not.toBe(key);
  });

  it("canonicalizes dictionary order and safely handles delimiters and Unicode", () => {
    const cache = new GrammarCache();
    const base = {
      requestText: "😀::core",
      coreOffset: 0,
      coreLength: "😀::core".length,
      language: "en-US",
      scanMode: "window",
    };

    expect(
      cache.computeKey({ ...base, userDictionary: ["one", "two"] }),
    ).toBe(cache.computeKey({ ...base, userDictionary: ["two", "one"] }));
    expect(
      cache.computeKey({
        ...base,
        requestText: "😀::core::en-US",
        userDictionary: ["one", "two"],
      }),
    ).not.toBe(
      cache.computeKey({
        ...base,
        requestText: "😀::core",
        userDictionary: ["en-US", "one", "two"],
      }),
    );
  });

  it("keeps LRU behavior for structured keys", () => {
    const cache = new GrammarCache(2);
    const key = (requestText) =>
      cache.computeKey({
        requestText,
        coreOffset: 0,
        coreLength: requestText.length,
        language: "en-US",
        scanMode: "window",
      });

    const first = key("first");
    const second = key("second");
    const third = key("third");
    cache.set(first, ["first"]);
    cache.set(second, ["second"]);
    expect(cache.get(first)).toEqual(["first"]);
    cache.set(third, ["third"]);

    expect(cache.get(first)).toEqual(["first"]);
    expect(cache.get(second)).toBeNull();
  });
});
