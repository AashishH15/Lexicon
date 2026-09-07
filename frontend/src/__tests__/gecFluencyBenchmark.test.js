import { describe, expect, it } from "vitest";
import benchmarkCases from "./fixtures/gecFluencyBenchmark.json";
import {
  computeGecMetrics,
  createPrng,
  scoreItemMatches,
  selectBenchmarkCases,
  shuffleArray,
} from "../../scripts/gecFluencyBenchmark.mjs";

describe("English GEC & Fluency Benchmark Suite", () => {
  describe("Dataset Integrity & Balance", () => {
    it("loads valid array of cases with authentic domains", () => {
      expect(Array.isArray(benchmarkCases)).toBe(true);
      expect(benchmarkCases.length).toBeGreaterThanOrEqual(100);

      const domains = new Set(benchmarkCases.map((c) => c.domain));
      expect(domains.has("jfleg")).toBe(true);
      expect(domains.has("bea2019")).toBe(true);
      expect(domains.has("locness")).toBe(true);
    });

    it("maintains an immutable stagnant baseline set of exactly 25 items", () => {
      const baselineCases = benchmarkCases.filter((c) => c.is_baseline === true);
      expect(baselineCases.length).toBe(25);

      const jflegBase = baselineCases.filter((c) => c.domain === "jfleg");
      const beaBase = baselineCases.filter((c) => c.domain === "bea2019");
      const locnessBase = baselineCases.filter((c) => c.domain === "locness");

      // Verify balanced representation in stagnant baseline
      expect(jflegBase.length).toBeGreaterThanOrEqual(6);
      expect(beaBase.length).toBeGreaterThanOrEqual(6);
      expect(locnessBase.length).toBeGreaterThanOrEqual(6);
      expect(jflegBase.length + beaBase.length + locnessBase.length).toBe(25);
    });

    it("verifies clean items have empty expectations and error/fluency items have anchors", () => {
      for (const item of benchmarkCases) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.text).toBe("string");
        expect(item.text.length).toBeGreaterThan(10);

        if (item.kind === "clean") {
          expect(item.expected).toEqual([]);
        } else {
          expect(Array.isArray(item.expected)).toBe(true);
          expect(item.expected.length).toBeGreaterThan(0);
          for (const exp of item.expected) {
            expect(typeof exp.anchor).toBe("string");
            expect(Array.isArray(exp.accepted_replacements)).toBe(true);
            expect(exp.accepted_replacements.length).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe("Sampling Engine & Anti-Overfitting Mechanism", () => {
    it("returns the stagnant baseline set deterministically when setType is 'baseline'", () => {
      const run1 = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "baseline",
      });
      const run2 = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "baseline",
      });

      expect(run1.length).toBe(25);
      expect(run2.length).toBe(25);

      const ids1 = run1.map((c) => c.id);
      const ids2 = run2.map((c) => c.id);
      expect(ids1).toEqual(ids2);
      expect(ids1.every((id) => id.startsWith("base-"))).toBe(true);
    });

    it("draws random sample of requested size (e.g. 25) when setType is 'random'", () => {
      const randomSet = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
      });

      expect(randomSet.length).toBe(25);
    });

    it("prevents overfitting by generating distinct subsets on repeated unseeded calls", () => {
      const runA = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
        seed: null, // unseeded
      });

      const runB = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
        seed: null, // unseeded
      });

      const idsA = new Set(runA.map((c) => c.id));
      const idsB = new Set(runB.map((c) => c.id));

      // With ~100 dynamic cases and sampling 25, the chance of two identical 25-item subsets is negligible
      const identical = [...idsA].filter((id) => idsB.has(id)).length;
      expect(identical).toBeLessThan(25);
    });

    it("provides exact reproducibility when a seed is specified", () => {
      const seed = 42891;
      const run1 = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
        seed,
      });

      const run2 = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
        seed,
      });

      expect(run1.map((c) => c.id)).toEqual(run2.map((c) => c.id));

      // A different seed should yield different items
      const run3 = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 25,
        seed: 99999,
      });
      expect(run1.map((c) => c.id)).not.toEqual(run3.map((c) => c.id));
    });

    it("respects domain filtering across modes", () => {
      const jflegOnly = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "random",
        sampleSize: 15,
        domain: "jfleg",
      });
      expect(jflegOnly.length).toBe(15);
      expect(jflegOnly.every((c) => c.domain === "jfleg")).toBe(true);

      const beaOnly = selectBenchmarkCases({
        cases: benchmarkCases,
        setType: "baseline",
        domain: "bea2019",
      });
      expect(beaOnly.every((c) => c.domain === "bea2019")).toBe(true);
    });
  });

  describe("PRNG & Shuffle Utilities", () => {
    it("Mulberry32 PRNG produces values strictly in [0, 1)", () => {
      const prng = createPrng(12345);
      for (let i = 0; i < 50; i += 1) {
        const val = prng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it("shuffleArray preserves all elements without mutation", () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = shuffleArray(original, createPrng(77));

      expect(shuffled.length).toBe(original.length);
      expect(shuffled.sort((a, b) => a - b)).toEqual(original);
      expect(original).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // immutable
    });
  });

  describe("Item Match Scoring Logic", () => {
    const errorItem = {
      id: "test-err-01",
      domain: "bea2019",
      kind: "error",
      text: "The group of researchers were presenting findings.",
      expected: [
        {
          anchor: "were presenting",
          accepted_replacements: ["was presenting"],
        },
      ],
    };

    const cleanItem = {
      id: "test-clean-01",
      domain: "locness",
      kind: "clean",
      text: "The economic implications of globalization have been studied extensively.",
      expected: [],
    };

    it("correctly identifies true positive match on error sentence", () => {
      const score = scoreItemMatches(errorItem, [
        {
          original: "were presenting",
          replacements: ["was presenting"],
        },
      ]);

      expect(score).toMatchObject({
        expected: 1,
        detected: 1,
        correct: 1,
        falsePositives: 0,
        wrongReplacements: 0,
        cleanSentenceHasEdit: false,
      });
    });

    it("identifies detected issue with incorrect replacement", () => {
      const score = scoreItemMatches(errorItem, [
        {
          original: "were presenting",
          replacements: ["are presenting"],
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

    it("verifies clean sentences with 0 edits have cleanSentenceHasEdit = false", () => {
      const score = scoreItemMatches(cleanItem, []);
      expect(score).toMatchObject({
        expected: 0,
        detected: 0,
        correct: 0,
        falsePositives: 0,
        cleanSentenceHasEdit: false,
      });
    });

    it("flags clean sentences with unwanted edits as false alarms", () => {
      const score = scoreItemMatches(cleanItem, [
        {
          original: "economic implications",
          replacements: ["financial impacts"],
        },
      ]);

      expect(score).toMatchObject({
        expected: 0,
        detected: 0,
        correct: 0,
        falsePositives: 1,
        cleanSentenceHasEdit: true,
      });
    });
  });

  describe("Aggregate GEC Metrics Computation", () => {
    it("accurately computes standard GEC metrics: Precision, Recall, and F_0.5", () => {
      // Synthetic batch:
      // 10 error cases (10 expected issues):
      // - 8 True Positives (correctly fixed)
      // - 2 False Negatives (missed)
      // - 2 False Positives (extraneous changes)
      // 10 clean cases:
      // - 0 False Alarms (100% clean)
      const mockResults = [
        // 8 TP cases
        ...Array.from({ length: 8 }, (_, i) => ({
          case: { id: `err-tp-${i}`, domain: "bea2019", kind: "error" },
          deep: {
            durationMs: 120,
            metrics: { unparsable: 0 },
            score: { expected: 1, detected: 1, correct: 1, falsePositives: 0 },
          },
        })),
        // 2 FN cases
        ...Array.from({ length: 2 }, (_, i) => ({
          case: { id: `err-fn-${i}`, domain: "jfleg", kind: "fluency" },
          deep: {
            durationMs: 140,
            metrics: { unparsable: 0 },
            score: { expected: 1, detected: 0, correct: 0, falsePositives: 0 },
          },
        })),
        // 2 extra FP edits on one case
        {
          case: { id: "err-fp-1", domain: "bea2019", kind: "error" },
          deep: {
            durationMs: 110,
            metrics: { unparsable: 0 },
            score: { expected: 0, detected: 0, correct: 0, falsePositives: 2 },
          },
        },
        // 10 clean cases
        ...Array.from({ length: 10 }, (_, i) => ({
          case: { id: `clean-${i}`, domain: "locness", kind: "clean" },
          deep: {
            durationMs: 95,
            metrics: { unparsable: 0 },
            score: {
              expected: 0,
              detected: 0,
              correct: 0,
              falsePositives: 0,
              cleanSentenceHasEdit: false,
            },
          },
        })),
      ];

      const metrics = computeGecMetrics(mockResults);

      expect(metrics.casesEvaluated).toBe(21);
      expect(metrics.totalExpected).toBe(10);
      expect(metrics.totalCorrect).toBe(8); // TP = 8
      expect(metrics.totalFalsePositives).toBe(2); // FP = 2

      // Precision = 8 / (8 + 2) = 0.80 -> 80%
      expect(metrics.precision).toBe(80.0);

      // Recall = 8 / 10 = 0.80 -> 80%
      expect(metrics.recall).toBe(80.0);

      // F_0.5 = 1.25 * (0.8 * 0.8) / (0.25 * 0.8 + 0.8) = 1.25 * 0.64 / (0.2 + 0.8) = 0.80 -> 80%
      expect(metrics.f05).toBe(80.0);

      // Clean FPR: 0/10 -> 0.0%
      expect(metrics.cleanSentences).toBe(10);
      expect(metrics.cleanCasesWithEdits).toBe(0);
      expect(metrics.cleanFpr).toBe(0.0);

      // JSON format compliance: 21/21 -> 100%
      expect(metrics.jsonCompliance).toBe(100.0);

      // Latency profiling
      expect(metrics.latencyMs.p50).toBeGreaterThan(0);
      expect(metrics.latencyMs.p95).toBeGreaterThanOrEqual(metrics.latencyMs.p50);
    });

    it("correctly penalizes clean text false alarms in Clean FPR", () => {
      const mockResults = [
        {
          case: { id: "clean-1", domain: "locness", kind: "clean" },
          deep: {
            durationMs: 100,
            metrics: {},
            score: { expected: 0, detected: 0, correct: 0, falsePositives: 1, cleanSentenceHasEdit: true },
          },
        },
        {
          case: { id: "clean-2", domain: "locness", kind: "clean" },
          deep: {
            durationMs: 100,
            metrics: {},
            score: { expected: 0, detected: 0, correct: 0, falsePositives: 0, cleanSentenceHasEdit: false },
          },
        },
      ];

      const metrics = computeGecMetrics(mockResults);
      expect(metrics.cleanSentences).toBe(2);
      expect(metrics.cleanCasesWithEdits).toBe(1);
      expect(metrics.cleanFpr).toBe(50.0);
    });
  });
});
