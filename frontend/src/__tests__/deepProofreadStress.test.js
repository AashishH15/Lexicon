import { describe, expect, it } from "vitest";
import cases from "./fixtures/deepProofreadStress.json";
import { mergeHybridDeepMatches } from "../deepProofread.js";

describe("Deep Proofread stress fixture", () => {
  it("has the expected balanced corpus shape", () => {
    expect(cases).toHaveLength(31);
    expect(cases.filter((item) => item.kind === "error")).toHaveLength(24);
    expect(cases.filter((item) => item.kind === "clean")).toHaveLength(7);
  });

  it("uses unique ids and unique texts", () => {
    const ids = cases.map((item) => item.id);
    const texts = cases.map((item) => item.text);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("keeps every expected anchor inside its source text", () => {
    for (const item of cases) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.text).toBe("string");
      expect(["clean", "error"]).toContain(item.kind);
      expect(["high", "variant"]).toContain(item.confidence);
      expect(Array.isArray(item.expected)).toBe(true);

      for (const expectation of item.expected) {
        expect(typeof expectation.anchor).toBe("string");
        expect(expectation.anchor.length).toBeGreaterThan(0);
        expect(item.text).toContain(expectation.anchor);
        expect(Array.isArray(expectation.accepted_replacements)).toBe(true);
        expect(expectation.accepted_replacements.length).toBeGreaterThan(0);
        for (const replacement of expectation.accepted_replacements) {
          expect(typeof replacement).toBe("string");
          expect(replacement.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has expected findings only for error cases", () => {
    for (const item of cases) {
      if (item.kind === "clean") {
        expect(item.expected).toEqual([]);
      } else {
        expect(item.expected.length).toBeGreaterThan(0);
      }
    }
  });

  it("preserves 100% of baseline matches across a multi-paragraph long document", () => {
    // Simulate a 20-paragraph document with baseline grammar matches spread throughout
    const baselineMatches = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      offset: i * 200,
      length: 6,
      engine: "proofread",
      message: `Grammar issue in paragraph ${i + 1}`,
      original: "mistak",
    }));
    // AI adds clarity suggestions at non-colliding offsets
    const deepMatches = [
      { offset: 50, length: 15, engine: "ai", message: "Clarity rewrite 1" },
      { offset: 1250, length: 20, engine: "ai", message: "Clarity rewrite 2" },
      { offset: 3500, length: 18, engine: "ai", message: "Clarity rewrite 3" },
    ];
    const merged = mergeHybridDeepMatches({ baselineMatches, deepMatches });
    const preservedBaseline = merged.filter((m) => m.engine === "proofread");
    expect(preservedBaseline).toHaveLength(20);
    expect(merged).toHaveLength(23);
    // Ensure all 20 baseline IDs are maintained sequentially
    for (let i = 0; i < 20; i++) {
      expect(preservedBaseline[i].offset).toBe(i * 200);
    }
  });
});
