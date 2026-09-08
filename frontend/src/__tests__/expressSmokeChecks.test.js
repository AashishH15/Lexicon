import { describe, expect, it } from "vitest";
import {
  casualUsesContractions,
  conciseIsClearlyShorter,
  languageLooksValid,
  preservesTokens,
  tonesFeelDistinct,
} from "../expressSmokeChecks.js";

describe("expressSmokeChecks", () => {
  const sampleTones = {
    professional: "I am pleased with the results for Maria in 2024.",
    casual: "I'm really happy with Maria's results in 2024.",
    friendly: "So glad Maria did well in 2024.",
    formal: "I am satisfied with Maria's results in 2024.",
    concise: "Maria did well in 2024.",
  };

  it("flags tones that share the same wording", () => {
    expect(tonesFeelDistinct(sampleTones)).toBe(true);
    expect(
      tonesFeelDistinct({
        professional: "Same line.",
        casual: "Same line.",
        friendly: "Same line.",
        formal: "Same line.",
        concise: "Same line.",
      }),
    ).toBe(false);
  });

  it("requires Concise to be shorter than the other tones", () => {
    expect(conciseIsClearlyShorter(sampleTones)).toBe(true);
    expect(
      conciseIsClearlyShorter({
        ...sampleTones,
        concise: "I am extremely satisfied with everything Maria achieved during 2024.",
      }),
    ).toBe(false);
  });

  it("detects casual contractions", () => {
    expect(casualUsesContractions(sampleTones)).toBe(true);
    expect(
      casualUsesContractions({
        ...sampleTones,
        casual: "I am really happy with the results.",
      }),
    ).toBe(false);
  });

  it("requires names and numbers in every tone", () => {
    expect(preservesTokens(sampleTones, ["Maria", "2024"])).toBe(true);
    expect(preservesTokens(sampleTones, ["Maria", "1999"])).toBe(false);
    expect(
      preservesTokens(
        {
          ...sampleTones,
          concise: "Great results.",
        },
        ["Maria", "2024"],
        4,
      ),
    ).toBe(true);
  });

  it("checks detected language labels", () => {
    expect(languageLooksValid("Spanish", "Spanish")).toBe(true);
    expect(languageLooksValid("Unknown", "Spanish")).toBe(false);
    expect(languageLooksValid("", "German")).toBe(false);
  });
});
