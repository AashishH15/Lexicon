import { describe, expect, it } from "vitest";
import cases from "./fixtures/deepProofreadStress.json";
import {
  scoreMatches,
  summarizeRuns,
} from "../../scripts/deepProofreadBenchmark.mjs";

describe("Deep Proofread benchmark scoring", () => {
  it("scores a correct production match against its anchor", () => {
    const item = cases.find((entry) => entry.id === "relative-what");
    const score = scoreMatches(item, [
      {
        original: "what",
        replacements: ["that"],
      },
    ]);

    expect(score).toMatchObject({
      expected: 1,
      detected: 1,
      correct: 1,
      falsePositives: 0,
      wrongReplacements: 0,
    });
  });

  it("separates detection from an incomplete replacement", () => {
    const item = cases.find((entry) => entry.id === "information-plural");
    const score = scoreMatches(item, [
      {
        original: "informations",
        replacements: ["information"],
      },
    ]);

    expect(score).toMatchObject({
      expected: 1,
      detected: 1,
      correct: 0,
      falsePositives: 0,
      wrongReplacements: 1,
    });
  });

  it("counts a clean proposal as a clean-text false positive", () => {
    const item = cases.find((entry) => entry.id === "clean-advice");
    const score = scoreMatches(item, [
      {
        original: "good advice",
        replacements: ["excellent advice"],
      },
    ]);

    expect(score).toMatchObject({
      expected: 0,
      detected: 0,
      correct: 0,
      falsePositives: 1,
    });
  });

  it("summarizes normal, deep, and hybrid results independently", () => {
    const item = cases.find((entry) => entry.id === "relative-what");
    const normalScore = scoreMatches(item, []);
    const deepScore = scoreMatches(item, [
      { original: "what", replacements: ["that"] },
    ]);
    const summary = summarizeRuns([
      {
        iteration: 1,
        results: [
          {
            case: item,
            normal: { score: normalScore },
            deep: {
              score: deepScore,
              status: "complete",
              metrics: { chunks: 1, rejected: {} },
            },
            hybrid: { score: deepScore },
          },
        ],
      },
    ]);

    expect(summary.deepOnlyCorrect).toBe(1);
    expect(summary.hybridOnlyCorrect).toBe(1);
    expect(summary.deepCorrectSuppressedByBaseline).toBe(0);
    expect(summary.hybridRegressions).toBe(0);
    expect(summary.normalOnlyCorrect).toBe(0);
    expect(summary.aggregate.normal.correct).toBe(0);
    expect(summary.aggregate.deep.correct).toBe(1);
    expect(summary.aggregate.hybrid.correct).toBe(1);
    expect(summary.byConfidence.high.deep.correct).toBe(1);
    expect(summary.latencyMs.normal.samples).toBe(0);
    expect(summary.latencyMs.deep.samples).toBe(0);
  });
});
