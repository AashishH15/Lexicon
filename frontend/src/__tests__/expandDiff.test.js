import { describe, expect, it } from "vitest";
import { markAddedSentences } from "../expandDiff.js";

describe("markAddedSentences", () => {
  it("marks new sentences while keeping source ones plain", () => {
    const parts = markAddedSentences("The road was dusty.", "The road was dusty. Birds sang.");
    expect(parts).toEqual([
      { text: "The road was dusty.", added: false },
      { text: "Birds sang.", added: true },
    ]);
  });

  it("matches through case and spacing differences", () => {
    const parts = markAddedSentences("  The ROAD was dusty. ", "the road was dusty. Birds sang.");
    expect(parts[0].added).toBe(false);
    expect(parts[1].added).toBe(true);
  });

  it("keeps everything plain without a source", () => {
    const parts = markAddedSentences("", "Birds sang. Rain fell.");
    expect(parts.every((part) => !part.added)).toBe(true);
  });

  it("treats a trailing fragment as its own chunk", () => {
    const parts = markAddedSentences("The road was dusty.", "The road was dusty. And more");
    expect(parts).toEqual([
      { text: "The road was dusty.", added: false },
      { text: "And more", added: true },
    ]);
  });

  it("keeps paraphrased source sentences plain", () => {
    const parts = markAddedSentences(
      "The road was dusty.",
      "The dusty road stretched on. Birds sang.",
    );
    expect(parts).toEqual([
      { text: "The dusty road stretched on.", added: false },
      { text: "Birds sang.", added: true },
    ]);
  });
});
