import { describe, expect, it } from "vitest";
import { alignWords } from "../wordDiff.js";

describe("alignWords", () => {
  it("marks identical runs kept", () => {
    expect(alignWords("The road was dusty.", "The road was dusty.")).toEqual([
      { text: "The road was dusty.", kind: "kept" },
    ]);
  });

  it("marks pure additions added", () => {
    expect(alignWords("The road.", "The road. Birds sang.")).toEqual([
      { text: "The road.", kind: "kept" },
      { text: "Birds sang.", kind: "added" },
    ]);
  });

  it("marks removals removed", () => {
    expect(alignWords("The road was dusty.", "The road.")).toEqual([
      { text: "The road", kind: "kept" },
      { text: "was dusty.", kind: "removed" },
    ]);
  });

  it("aligns reworded spans as removed plus added", () => {
    const parts = alignWords("The colour is nice", "The color is nice");
    expect(parts).toEqual([
      { text: "The", kind: "kept" },
      { text: "colour", kind: "removed" },
      { text: "color", kind: "added" },
      { text: "is nice", kind: "kept" },
    ]);
  });

  it("returns empty for blank inputs", () => {
    expect(alignWords("", "")).toEqual([]);
    expect(alignWords("Hello.", "")).toEqual([{ text: "Hello.", kind: "removed" }]);
    expect(alignWords("", "Hello.")).toEqual([{ text: "Hello.", kind: "added" }]);
  });
});
