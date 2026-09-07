import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  loadBenchmarkDataset,
  selectBenchmarkCases,
  runCaseEvaluation,
  computeGecMetrics,
} from "./gecFluencyBenchmark.mjs";

const BASE_URL = "http://127.0.0.1:8000";
const TIMEOUT_MS = 180_000;
const ARTIFACT_OUT = "C:/Users/aashi/.gemini/antigravity-ide/brain/2a3653ee-141b-4886-9860-6414c746427f/scratch/post_level1_benchmark_results.json";

const TIERS = [
  { id: "normal", name: "Normal Proofread", model: "lt" },
  { id: "light", name: "Light Tier (1B)", model: "0.8b" },
  { id: "standard", name: "Standard Tier (4B)", model: "2b" },
  { id: "quality", name: "Quality Tier (27B)", model: "quality" },
];

const RUN_SETS = [
  { key: "baseline", label: "Baseline Control (Frozen 25)", type: "baseline" },
  { key: "random_run1", label: "Random Run 1 (Seed 101)", type: "random", seed: 101 },
  { key: "random_run2", label: "Random Run 2 (Seed 202)", type: "random", seed: 202 },
  { key: "random_run3", label: "Random Run 3 (Seed 303)", type: "random", seed: 303 },
];

async function runMatrix() {
  console.log("================================================================================");
  console.log("Starting Scaled 325-Sentence 4x4 Benchmark Matrix Evaluation");
  console.log("Corpus: 325 Sentences (108 JFLEG + 109 BEA + 108 LOCNESS)");
  console.log("Tiers: Normal (Rules), Light (1B), Standard (4B), Quality (27B)");
  console.log("Runs: 1 Baseline + 3 Independent Random Runs (25 sentences each, total 16 evaluations)");
  console.log("================================================================================\n");

  const allCases = await loadBenchmarkDataset();
  console.log(`Loaded dataset pool with ${allCases.length} authentic sentences.\n`);

  // Pre-select the exact 4 sets so every tier is evaluated on the exact same sentences
  const testSets = {};
  for (const setCfg of RUN_SETS) {
    testSets[setCfg.key] = selectBenchmarkCases({
      cases: allCases,
      setType: setCfg.type,
      sampleSize: 25,
      seed: setCfg.seed,
    });
    console.log(`Prepared ${setCfg.label}: ${testSets[setCfg.key].length} sentences.`);
  }
  console.log("");

  const matrixResults = {};

  for (const tier of TIERS) {
    matrixResults[tier.id] = {
      name: tier.name,
      model: tier.model,
      runs: {},
    };

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`Evaluating Tier: ${tier.name} (model: ${tier.model})`);
    console.log(`--------------------------------------------------------------------------------`);

    for (const setCfg of RUN_SETS) {
      const items = testSets[setCfg.key];
      console.log(`\n>>> [${tier.name}] - ${setCfg.label} (25 cases)...`);
      const t0 = performance.now();
      const caseResults = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        process.stdout.write(`  [${i + 1}/25] ${item.id} (${item.domain})... `);
        const caseRes = await runCaseEvaluation(
          BASE_URL,
          tier.model,
          item,
          TIMEOUT_MS,
          `bench-${tier.id}-${setCfg.key}-${i}`
        );
        caseResults.push(caseRes);
        const correct = caseRes.deep?.score?.correct ?? 0;
        const expected = caseRes.deep?.score?.expected ?? 0;
        const fp = caseRes.deep?.score?.falsePositives ?? 0;
        const ms = caseRes.deep?.durationMs ?? 0;
        console.log(`corr: ${correct}/${expected}, fp: ${fp} (${ms}ms)`);
      }

      const totalTime = ((performance.now() - t0) / 1000).toFixed(1);
      const metrics = computeGecMetrics(caseResults);
      matrixResults[tier.id].runs[setCfg.key] = {
        label: setCfg.label,
        metrics,
        totalTimeSec: Number(totalTime),
      };

      console.log(`=== Results for [${tier.name}] ${setCfg.label} in ${totalTime}s ===`);
      console.log(`  Precision: ${metrics.precision}% | Recall: ${metrics.recall}% | F_0.5: ${metrics.f05}`);
      console.log(`  Clean FPR: ${metrics.cleanFpr}% (${metrics.cleanCasesWithEdits}/${metrics.cleanSentences})`);
      console.log(`  Avg Latency: ${metrics.latencyMs.avg} ms`);
      console.log(`  JFLEG: ${metrics.domainStats.jfleg.correct}/${metrics.domainStats.jfleg.expected}`);
      console.log(`  BEA: ${metrics.domainStats.bea2019.correct}/${metrics.domainStats.bea2019.expected}`);
    }

    // Compute aggregated 3-run Random Average for this tier
    const r1 = matrixResults[tier.id].runs.random_run1.metrics;
    const r2 = matrixResults[tier.id].runs.random_run2.metrics;
    const r3 = matrixResults[tier.id].runs.random_run3.metrics;

    const avg = (fn) => Number(((fn(r1) + fn(r2) + fn(r3)) / 3).toFixed(2));

    matrixResults[tier.id].random_aggregate = {
      label: "3-Run Random Average (75 sentences total)",
      precision: avg((m) => m.precision),
      recall: avg((m) => m.recall),
      f05: avg((m) => m.f05),
      cleanFpr: avg((m) => m.cleanFpr),
      avgLatency: avg((m) => m.latencyMs.avg),
      jflegRate: `${avg((m) => m.domainStats.jfleg.correct)} / ${avg((m) => m.domainStats.jfleg.expected)}`,
      beaRate: `${avg((m) => m.domainStats.bea2019.correct)} / ${avg((m) => m.domainStats.bea2019.expected)}`,
      raw: { r1, r2, r3 },
    };

    console.log(`\n*** [${tier.name}] 3-RUN RANDOM MEAN ***`);
    console.log(`  Mean F_0.5: ${matrixResults[tier.id].random_aggregate.f05}`);
    console.log(`  Mean Precision: ${matrixResults[tier.id].random_aggregate.precision}%`);
    console.log(`  Mean Recall: ${matrixResults[tier.id].random_aggregate.recall}%`);
    console.log(`  Mean Clean FPR: ${matrixResults[tier.id].random_aggregate.cleanFpr}%`);
    console.log(`  Mean Latency: ${matrixResults[tier.id].random_aggregate.avgLatency} ms`);
  }

  // Save to JSON
  await fs.mkdir(path.dirname(ARTIFACT_OUT), { recursive: true });
  await fs.writeFile(ARTIFACT_OUT, JSON.stringify(matrixResults, null, 2), "utf8");
  console.log(`\n================================================================================`);
  console.log(`Benchmark Complete! All results written to: ${ARTIFACT_OUT}`);
  console.log(`================================================================================\n`);
}

runMatrix().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exitCode = 1;
});
