import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildDeepChunks,
  executeDeepScan,
  mergeHybridDeepMatches,
} from "../src/deepProofread.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const BENCHMARK_FIXTURE_PATH = path.resolve(
  SCRIPT_DIR,
  "../src/__tests__/fixtures/gecFluencyBenchmark.json"
);

export const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
export const DEFAULT_MODEL = "2b";
export const DEFAULT_SET = "random";
export const DEFAULT_SAMPLE_SIZE = 25;
export const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 * If a seed is passed, PRNG is reproducible; if seed is omitted, Math.random is used.
 */
export function createPrng(seed) {
  if (seed == null || Number.isNaN(seed)) {
    return Math.random;
  }
  let s = Math.floor(Math.abs(seed)) >>> 0;
  return function mulberry32() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles an array immutably using Fisher-Yates and the provided random function.
 */
export function shuffleArray(array, randomFn = Math.random) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Selects benchmark cases according to set type (baseline vs. random vs. all)
 * and optional domain filtering.
 */
export function selectBenchmarkCases({
  cases,
  setType = "random",
  sampleSize = DEFAULT_SAMPLE_SIZE,
  seed = null,
  domain = "all",
  ids = null,
}) {
  if (!Array.isArray(cases)) {
    throw new Error("Cases must be an array.");
  }

  // If specific IDs were requested, filter strictly by those IDs
  if (ids && ids.size > 0) {
    const selected = cases.filter((c) => ids.has(c.id));
    if (selected.length === 0) {
      throw new Error(`No benchmark cases matched requested --ids: ${[...ids].join(", ")}`);
    }
    return selected;
  }

  // 1. Filter by domain if specified
  const filtered = domain === "all"
    ? cases
    : cases.filter((c) => c.domain?.toLowerCase() === domain.toLowerCase());

  if (filtered.length === 0) {
    throw new Error(`No benchmark cases matched domain '${domain}'.`);
  }

  // 2. Baseline mode: pull the stagnant, unmoving baseline set
  if (setType === "baseline") {
    const baselineCases = filtered.filter((c) => c.is_baseline === true);
    if (baselineCases.length === 0) {
      throw new Error("No stagnant baseline cases found for the selected criteria.");
    }
    return baselineCases;
  }

  // 3. All mode: run everything matching the domain filter
  if (setType === "all") {
    return filtered;
  }

  // 4. Random mode: pull random N items from the pool
  if (setType === "random") {
    const randomFn = createPrng(seed);
    // Prefer drawing from the non-baseline pool to keep baseline unexposed,
    // but fall back to the full set if pool is smaller than sampleSize.
    const pool = filtered.filter((c) => !c.is_baseline);
    const candidatePool = pool.length >= sampleSize ? pool : filtered;

    // If candidatePool has distinct domains, stratify slightly to ensure
    // fair representation across JFLEG, BEA, and LOCNESS if domain === "all".
    if (domain === "all") {
      const jflegPool = shuffleArray(candidatePool.filter((c) => c.domain === "jfleg"), randomFn);
      const beaPool = shuffleArray(candidatePool.filter((c) => c.domain === "bea2019"), randomFn);
      const locnessPool = shuffleArray(candidatePool.filter((c) => c.domain === "locness"), randomFn);

      const targetPerDomain = Math.floor(sampleSize / 3);
      const remainder = sampleSize % 3;

      const sampled = [
        ...jflegPool.slice(0, targetPerDomain + (remainder > 0 ? 1 : 0)),
        ...beaPool.slice(0, targetPerDomain + (remainder > 1 ? 1 : 0)),
        ...locnessPool.slice(0, targetPerDomain),
      ];

      // If any domain was short, top up from the remaining candidates
      if (sampled.length < sampleSize) {
        const sampledIds = new Set(sampled.map((s) => s.id));
        const remaining = shuffleArray(
          candidatePool.filter((c) => !sampledIds.has(c.id)),
          randomFn
        );
        sampled.push(...remaining.slice(0, sampleSize - sampled.length));
      }

      return shuffleArray(sampled, randomFn);
    }

    // Single domain random sample
    const shuffled = shuffleArray(candidatePool, randomFn);
    return shuffled.slice(0, Math.min(sampleSize, shuffled.length));
  }

  throw new Error(`Unknown setType '${setType}'. Valid values: baseline, random, all.`);
}

export function printHelp() {
  console.log(`Lexicon GEC & Fluency Benchmark Suite (JFLEG / BEA-2019 / LOCNESS)

Evaluates the local LLM grammar & fluency engine on authentic benchmark datasets.
Supports an immutable stagnant baseline set (25 items) and randomized anti-overfitting
sampling (25 random items per run).

Options:
  --set SET            'baseline' (25 fixed control items),
                       'random' (25 random items, default), or 'all'
  --sample N           Number of random items to sample (default: ${DEFAULT_SAMPLE_SIZE})
  --seed SEED          Integer seed for pseudo-random reproducibility (default: unseeded)
  --domain DOMAIN      'all' (default), 'jfleg', 'bea2019', or 'locness'
  --model MODEL        Bundled model tier: '0.8b' (Light), '2b' (Standard), or 'quality' (Quality)
  --base-url URL       Backend URL (default: ${DEFAULT_BASE_URL})
  --timeout-ms MS      Timeout per request in ms (default: ${DEFAULT_TIMEOUT_MS})
  --summary-only       Print clean tabular summary without per-sentence itemization
  --help               Show this help message

Examples:
  # Run the stagnant 25-sentence baseline control (never changes):
  npm run benchmark:gec -- --set=baseline --summary-only

  # Run a fresh random 25-sentence sample (different every time to prevent overfitting):
  npm run benchmark:gec -- --set=random --sample=25 --summary-only

  # Run a reproducible random batch with a fixed seed:
  npm run benchmark:gec -- --set=random --sample=25 --seed=42 --summary-only

  # Benchmark against the Quality tier (Ling 3.0 Tiny):
  npm run benchmark:gec -- --model=quality --set=baseline --summary-only
`);
}

export function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    setType: DEFAULT_SET,
    sampleSize: DEFAULT_SAMPLE_SIZE,
    seed: null,
    domain: "all",
    ids: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    summaryOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--summary-only") {
      options.summaryOnly = true;
      continue;
    }
    const [name, inlineVal] = arg.split("=", 2);
    const value = inlineVal ?? (i + 1 < argv.length ? argv[++i] : undefined);
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }

    if (name === "--base-url") {
      options.baseUrl = value.replace(/\/+$/, "");
    } else if (name === "--model") {
      options.model = value;
    } else if (name === "--set") {
      options.setType = value.toLowerCase();
    } else if (name === "--sample") {
      options.sampleSize = Number.parseInt(value, 10);
    } else if (name === "--seed") {
      options.seed = Number.parseInt(value, 10);
    } else if (name === "--ids") {
      options.ids = new Set(value.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (name === "--domain") {
      options.domain = value.toLowerCase();
    } else if (name === "--timeout-ms") {
      options.timeoutMs = Number.parseInt(value, 10);
    } else {
      throw new Error(`Unknown option: ${name}.`);
    }
  }

  if (!Number.isInteger(options.sampleSize) || options.sampleSize < 1) {
    throw new Error("--sample must be a positive integer.");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer.");
  }
  return options;
}

export async function loadBenchmarkDataset(filePath = BENCHMARK_FIXTURE_PATH) {
  const content = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(content);
  if (!Array.isArray(data)) {
    throw new Error("Benchmark dataset must be a JSON array.");
  }
  return data;
}

function identityMap(text) {
  return Array.from({ length: text.length }, (_, index) => index);
}

function sourceMatches(match, expectation, itemText = "") {
  const original = String(match.original ?? "");
  const anchor = String(expectation.anchor ?? "");
  if (
    original === anchor ||
    original.includes(anchor) ||
    anchor.includes(original)
  ) {
    return true;
  }
  if (itemText && match.offset != null && match.length != null) {
    const anchorIdx = itemText.indexOf(anchor);
    if (anchorIdx >= 0) {
      const matchEnd = match.offset + match.length;
      const anchorEnd = anchorIdx + anchor.length;
      if (match.offset < anchorEnd && anchorIdx < matchEnd) {
        return true;
      }
    }
  }
  const origWords = original.toLowerCase().match(/\b[\w']+\b/g) || [];
  const anchorWords = anchor.toLowerCase().match(/\b[\w']+\b/g) || [];
  const shared = origWords.filter((w) => anchorWords.includes(w));
  return shared.length >= 2 || (shared.length === 1 && anchorWords.length <= 2);
}

function replacementMatches(match, expectation, itemText = "") {
  const replacement = String(match.replacements?.[0] ?? "");
  const directMatch = (expectation.accepted_replacements || []).some((accepted) =>
    replacement.includes(accepted) || accepted.includes(replacement)
  );
  if (directMatch) {
    return true;
  }
  if (itemText && match.offset != null && match.length != null) {
    const patched =
      itemText.slice(0, match.offset) +
      replacement +
      itemText.slice(match.offset + match.length);
    const patchedNorm = patched.replace(/\s+/g, " ").toLowerCase();
    return (expectation.accepted_replacements || []).some((accepted) => {
      const acceptedNorm = String(accepted).replace(/\s+/g, " ").toLowerCase();
      return patchedNorm.includes(acceptedNorm);
    });
  }
  return false;
}

/**
 * Evaluates match proposals against gold expectations for a single item.
 */
export function scoreItemMatches(item, matches) {
  const expectations = Array.isArray(item.expected) ? item.expected : [];
  const isClean = item.kind === "clean" || expectations.length === 0;

  if (isClean) {
    return {
      expected: 0,
      detected: 0,
      correct: 0,
      falsePositives: matches.length,
      wrongReplacements: 0,
      cleanSentenceHasEdit: matches.length > 0,
      expectedResults: [],
    };
  }

  const expectedResults = expectations.map((expectation) => {
    const detected = matches.some((match) => sourceMatches(match, expectation, item.text));
    const correct = matches.some(
      (match) =>
        sourceMatches(match, expectation, item.text) &&
        replacementMatches(match, expectation, item.text)
    );
    return {
      anchor: expectation.anchor,
      detected,
      correct,
    };
  });

  const matchedExpectations = matches.filter((match) =>
    expectations.some((exp) => sourceMatches(match, exp, item.text))
  );

  return {
    expected: expectations.length,
    detected: expectedResults.filter((r) => r.detected).length,
    correct: expectedResults.filter((r) => r.correct).length,
    falsePositives: matches.length - matchedExpectations.length,
    wrongReplacements: expectedResults.filter((r) => r.detected && !r.correct).length,
    cleanSentenceHasEdit: false,
    expectedResults,
  };
}

/**
 * Computes standard GEC metrics including Precision, Recall, F0.5, and Clean FPR.
 */
export function computeGecMetrics(results) {
  let totalExpected = 0;
  let totalDetected = 0;
  let totalCorrect = 0;
  let totalFalsePositives = 0;
  let totalCleanCases = 0;
  let cleanCasesWithEdits = 0;
  let jsonParseFailures = 0;
  let totalExecutions = 0;

  const latencies = [];
  const domainStats = {
    jfleg: { expected: 0, detected: 0, correct: 0, falsePositives: 0, cases: 0 },
    bea2019: { expected: 0, detected: 0, correct: 0, falsePositives: 0, cases: 0 },
    locness: { cases: 0, falsePositives: 0, cleanWithEdits: 0 },
  };

  for (const res of results) {
    totalExecutions += 1;
    if (res.deep?.metrics?.unparsable > 0 || res.deep?.status === "malformed") {
      jsonParseFailures += 1;
    }
    if (Number.isFinite(res.deep?.durationMs)) {
      latencies.push(res.deep.durationMs);
    }

    const score = res.deep?.score || {
      expected: 0,
      detected: 0,
      correct: 0,
      falsePositives: 0,
      cleanSentenceHasEdit: false,
    };

    totalExpected += score.expected;
    totalDetected += score.detected;
    totalCorrect += score.correct;
    totalFalsePositives += score.falsePositives;

    const domain = res.case.domain?.toLowerCase() || "other";
    if (domainStats[domain]) {
      domainStats[domain].cases += 1;
      if (domain === "locness") {
        domainStats[domain].falsePositives += score.falsePositives;
        if (score.cleanSentenceHasEdit) {
          domainStats[domain].cleanWithEdits += 1;
        }
      } else {
        domainStats[domain].expected += score.expected;
        domainStats[domain].detected += score.detected;
        domainStats[domain].correct += score.correct;
        domainStats[domain].falsePositives += score.falsePositives;
      }
    }

    if (res.case.kind === "clean") {
      totalCleanCases += 1;
      if (score.cleanSentenceHasEdit) {
        cleanCasesWithEdits += 1;
      }
    }
  }

  // GEC Precision & Recall
  const truePositives = totalCorrect;
  const precision = truePositives + totalFalsePositives > 0
    ? truePositives / (truePositives + totalFalsePositives)
    : 0;

  const recall = totalExpected > 0
    ? truePositives / totalExpected
    : 0;

  // F_0.5 = (1 + 0.5^2) * (P * R) / (0.5^2 * P + R) = 1.25 * P * R / (0.25 * P + R)
  const betaSq = 0.25;
  const f05Denominator = betaSq * precision + recall;
  const f05 = f05Denominator > 0
    ? ((1 + betaSq) * precision * recall) / f05Denominator
    : 0;

  // Detection rate (pure detection regardless of exact string match)
  const detectionRate = totalExpected > 0 ? totalDetected / totalExpected : 0;

  // Clean sentence false positive rate (target: 0.0%)
  const cleanFpr = totalCleanCases > 0
    ? (cleanCasesWithEdits / totalCleanCases) * 100
    : 0;

  // JSON format compliance rate (target: 100%)
  const jsonCompliance = totalExecutions > 0
    ? ((totalExecutions - jsonParseFailures) / totalExecutions) * 100
    : 100;

  latencies.sort((a, b) => a - b);
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const avgLatency = latencies.length > 0
    ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length
    : 0;

  return {
    casesEvaluated: totalExecutions,
    totalExpected,
    totalDetected,
    totalCorrect,
    totalFalsePositives,
    precision: Number((precision * 100).toFixed(2)),
    recall: Number((recall * 100).toFixed(2)),
    detectionRate: Number((detectionRate * 100).toFixed(2)),
    f05: Number((f05 * 100).toFixed(2)),
    cleanSentences: totalCleanCases,
    cleanCasesWithEdits,
    cleanFpr: Number(cleanFpr.toFixed(2)),
    jsonCompliance: Number(jsonCompliance.toFixed(2)),
    latencyMs: {
      p50: Number(p50.toFixed(1)),
      p95: Number(p95.toFixed(1)),
      avg: Number(avgLatency.toFixed(1)),
    },
    domainStats,
  };
}

async function requestJson(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.error || data.detail || `HTTP ${response.status}`;
      throw new Error(`${url} failed: ${detail}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function runCaseEvaluation(baseUrl, model, item, timeoutMs, requestId) {
  const snapshot = {
    text: item.text,
    map: identityMap(item.text),
  };
  const chunks = buildDeepChunks(snapshot);

  const start = performance.now();
  let status = "complete";
  let matches = [];
  let metrics = {};
  let error = null;

  try {
    const data = await requestJson(
      `${baseUrl}/grammar/check`,
      { text: item.text, language: "en-US", ignore: [] },
      timeoutMs
    );
    const baselineMatches = (data.matches || []).map((m, i) => ({
      id: i,
      offset: m.offset,
      length: m.length,
      original: item.text.slice(m.offset, m.offset + m.length),
      replacements: (m.replacements || []).map((r) =>
        typeof r === "string" ? r : r.value || ""
      ),
      category: m.rule?.category?.name || "Grammar",
      engine: "proofread",
    }));

    if (model === "none" || model === "lt") {
      matches = baselineMatches;
      status = "complete";
    } else {
      const result = await executeDeepScan({
        snapshot,
        chunks,
        modelKey: model,
        callModel: async ({ prompt, text, requestId: subId }) => {
          const transData = await requestJson(
            `${baseUrl}/transform`,
            {
              prompt,
              text,
              backend: "bundled",
              model_key: model,
              request_id: `${requestId}-${subId}`,
              max_tokens: 256,
              temperature: 0.0,
            },
            timeoutMs
          );
          return transData.text;
        },
        isCancelled: () => false,
        readCurrentText: () => snapshot.text,
        onProgress: () => {},
        noteActivity: async () => {},
      });

      // Deep Proofread is a hybrid scan: LanguageTool deterministic baseline matches
      // are merged with AI augmentation scan (matching App.jsx architecture)
      matches = mergeHybridDeepMatches({
        baselineMatches,
        deepMatches: result.matches || [],
      });
      status = result.status;
      metrics = result.metrics || {};
    }
  } catch (err) {
    status = "failed";
    error = err.message || String(err);
  }
  const durationMs = Number((performance.now() - start).toFixed(1));

  // Normalization
  const cleanMatches = matches.map((m) => ({
    offset: m.offset,
    length: m.length,
    original: item.text.slice(m.offset, m.offset + m.length),
    replacements: m.replacements || [],
    category: m.category || "Clarity",
  }));

  const score = scoreItemMatches(item, cleanMatches);

  return {
    case: item,
    deep: {
      status,
      durationMs,
      score,
      matches: cleanMatches,
      metrics,
      error,
    },
  };
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fullDataset = await loadBenchmarkDataset();
  const selectedCases = selectBenchmarkCases({
    cases: fullDataset,
    setType: options.setType,
    sampleSize: options.sampleSize,
    seed: options.seed,
    domain: options.domain,
    ids: options.ids,
  });

  const modeDescription = options.ids
    ? `Targeted IDs (${selectedCases.length} items: ${[...options.ids].join(", ")})`
    : options.setType === "baseline"
      ? "Stagnant Baseline Control (Frozen 25 items)"
      : options.setType === "random"
        ? `Random Anti-Overfitting Sample (${selectedCases.length} items${options.seed != null ? `, seed: ${options.seed}` : ", unseeded dynamic"}` + ")"
        : `All Matching Items (${selectedCases.length} items)`;

  console.log("===============================================================================");
  console.log(`LEXICON GEC & FLUENCY BENCHMARK: ${modeDescription.toUpperCase()}`);
  console.log(`Target Model: ${options.model} | Domain: ${options.domain} | Backend: ${options.baseUrl}`);
  console.log("===============================================================================\n");

  const results = [];
  let index = 0;
  for (const item of selectedCases) {
    index += 1;
    const prefix = `[${index}/${selectedCases.length}]`;
    if (!options.summaryOnly) {
      console.log(`${prefix} Testing [${item.domain.toUpperCase()}] ${item.id}...`);
    }
    const res = await runCaseEvaluation(
      options.baseUrl,
      options.model,
      item,
      options.timeoutMs,
      `gec-bench-${item.id}`
    );
    results.push(res);
    if (!options.summaryOnly) {
      const matchCount = res.deep.matches.length;
      const statusIcon = res.case.kind === "clean"
        ? (matchCount === 0 ? "✓ clean" : `⚠ ${matchCount} false edits`)
        : (`${res.deep.score.correct}/${res.deep.score.expected} correct`);
      console.log(`   -> ${statusIcon} (${res.deep.durationMs} ms)\n`);
    }
  }

  const metrics = computeGecMetrics(results);

  console.log("\n===============================================================================");
  console.log("                           BENCHMARK RESULTS SUMMARY                            ");
  console.log("===============================================================================");
  console.log(`Cases Evaluated:             ${metrics.casesEvaluated}`);
  console.log(`GEC Precision:               ${metrics.precision}%`);
  console.log(`GEC Recall (Detection):      ${metrics.recall}% (Raw Detection: ${metrics.detectionRate}%)`);
  console.log(`F_0.5 Score (Standard GEC):  ${metrics.f05}`);
  console.log(`Clean Sentence False Alarm:  ${metrics.cleanFpr}% (${metrics.cleanCasesWithEdits}/${metrics.cleanSentences} clean sentences flagged)`);
  console.log(`JSON Schema Compliance:      ${metrics.jsonCompliance}%`);
  console.log(`Latency Profile:             p50: ${metrics.latencyMs.p50} ms | p95: ${metrics.latencyMs.p95} ms | avg: ${metrics.latencyMs.avg} ms`);
  console.log("-------------------------------------------------------------------------------");
  console.log("DOMAIN BREAKDOWN:");
  console.log(`- JFLEG (Fluency & Flow):    ${metrics.domainStats.jfleg.cases} cases | ${metrics.domainStats.jfleg.correct}/${metrics.domainStats.jfleg.expected} correct | ${metrics.domainStats.jfleg.falsePositives} false edits`);
  console.log(`- BEA-2019 (Grammar Rules):  ${metrics.domainStats.bea2019.cases} cases | ${metrics.domainStats.bea2019.correct}/${metrics.domainStats.bea2019.expected} correct | ${metrics.domainStats.bea2019.falsePositives} false edits`);
  console.log(`- LOCNESS (Clean Controls):  ${metrics.domainStats.locness.cases} clean cases | ${metrics.domainStats.locness.cleanWithEdits} false alarms`);
  console.log("===============================================================================\n");

  return { options, metrics, results };
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((err) => {
    console.error(`gecFluencyBenchmark: ${err.message}`);
    process.exitCode = 1;
  });
}
