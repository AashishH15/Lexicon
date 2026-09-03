import { describe, expect, it } from "vitest";
import { checkProseQuality } from "../proseQualityEngine.js";
import cleanCases from "./fixtures/proseHeldoutClean.json";
import errorCases from "./fixtures/proseHeldoutErrors.json";
import knownCleanFlags from "./fixtures/proseKnownCleanFlags.json";

const DOMAINS = ["technical", "academic", "business", "casual"];

function proseFlags(text) {
  return checkProseQuality(text).map((match) => ({
    original: text.slice(match.offset, match.offset + match.length),
    message: match.message,
  }));
}

describe("prose held-out corpora", () => {
  it("uses unique ids and well-formed cases", () => {
    const ids = new Set();
    for (const cases of [cleanCases, errorCases]) {
      for (const item of cases) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.text).toBe("string");
        expect(Array.isArray(item.expected)).toBe(true);
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
      }
    }
  });

  it("keeps clean and error texts disjoint", () => {
    const cleanTexts = new Set(cleanCases.map((item) => item.text));
    for (const item of errorCases) {
      expect(cleanTexts.has(item.text)).toBe(false);
    }
  });

  it("covers four writing domains in the clean set", () => {
    for (const domain of DOMAINS) {
      expect(cleanCases.some((item) => item.domain === domain)).toBe(true);
    }
  });
});

describe("prose held-out errors", () => {
  it("finds every expected flag and nothing extra", () => {
    const missing = [];
    const extra = [];
    for (const item of errorCases) {
      const flags = proseFlags(item.text);
      for (const expected of item.expected) {
        const hit = flags.some(
          (flag) =>
            flag.original === expected.original &&
            flag.message.includes(expected.messageContains),
        );
        if (!hit) {
          missing.push(`${item.id}: ${expected.original}`);
        }
      }
      if (flags.length !== item.expected.length) {
        extra.push(`${item.id}: found ${flags.length}, want ${item.expected.length}`);
      }
    }
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });
});

describe("prose held-out clean inventory", () => {
  it("matches the checked-in flag inventory exactly", () => {
    const actual = [];
    for (const item of cleanCases) {
      for (const match of checkProseQuality(item.text)) {
        actual.push({
          id: item.id,
          original: item.text.slice(match.offset, match.offset + match.length),
          message: match.message,
        });
      }
    }
    // Step 4 work must shrink this list. Update the JSON by hand
    // after a rule change, never to hide a new flag.
    expect(actual).toEqual(knownCleanFlags);
  });
});
