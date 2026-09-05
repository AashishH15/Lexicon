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
const FIXTURE_PATH = path.resolve(
  SCRIPT_DIR,
  "../src/__tests__/fixtures/deepProofreadStress.json"
);
const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_MODEL = "0.8b";
const DEFAULT_ITERATIONS = 1;
const DEFAULT_TIMEOUT_MS = 180_000;

function printHelp() {
  console.log(`Deep Proofread benchmark

Compares the live grammar endpoint with the production Deep Proofread
validator and hybrid merger. The backend must already be running.
Scores are anchor-based and intentionally conservative; semantic alternatives
still require manual review in the per-case output and fixture notes.

Options:
  --base-url URL       Backend URL (default: ${DEFAULT_BASE_URL})
  --model MODEL        Bundled model tier, such as 0.8b or 2b
  --iterations N       Number of passes over the fixture (default: ${DEFAULT_ITERATIONS})
  --timeout-ms N       Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --ids ID1,ID2        Run only selected fixture IDs
  --summary-only       Print aggregate results without per-case output
  --help               Show this help

Examples:
  node scripts/deepProofreadBenchmark.mjs --model=2b
  node scripts/deepProofreadBenchmark.mjs --model=2b --iterations=3 --summary-only
  npm.cmd run benchmark:deep -- --model=2b
`);
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    iterations: DEFAULT_ITERATIONS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ids: null,
    summaryOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      printHelp();
      process.exit(0);
    }
    if (argument === "--summary-only") {
      options.summaryOnly = true;
      continue;
    }
    const [name, inlineValue] = argument.split("=", 2);
    const value =
      inlineValue ?? (index + 1 < argv.length ? argv[++index] : undefined);
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}.`);
    }
    if (name === "--base-url") {
      options.baseUrl = value.replace(/\/+$/, "");
    } else if (name === "--model") {
      options.model = value;
    } else if (name === "--iterations") {
      options.iterations = Number.parseInt(value, 10);
    } else if (name === "--timeout-ms") {
      options.timeoutMs = Number.parseInt(value, 10);
    } else if (name === "--ids") {
      options.ids = new Set(value.split(",").filter(Boolean));
    } else {
      throw new Error(`Unknown option: ${name}.`);
    }
  }

  if (!Number.isInteger(options.iterations) || options.iterations < 1) {
    throw new Error("--iterations must be a positive integer.");
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error("--timeout-ms must be a positive integer.");
  }
  return options;
}

async function loadCases(ids) {
  const cases = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
  if (!Array.isArray(cases)) {
    throw new Error("The Deep Proofread fixture must contain an array.");
  }
  const selected = ids ? cases.filter((item) => ids.has(item.id)) : cases;
  if (selected.length === 0) {
    throw new Error("No fixture cases matched --ids.");
  }
  const foundIds = new Set(selected.map((item) => item.id));
  if (ids) {
    const missing = [...ids].filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new Error(`Unknown fixture IDs: ${missing.join(", ")}.`);
    }
  }
  return selected;
}

function identityMap(text) {
  return Array.from({ length: text.length }, (_, index) => index);
}

function createTimeoutError(url, timeoutMs) {
  const error = new Error(`Request to ${url} timed out after ${timeoutMs} ms.`);
  error.name = "BenchmarkTimeoutError";
  return error;
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
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeMatches(text, matches) {
  if (!Array.isArray(matches)) {
    return [];
  }
  return matches.map((match) => {
    const offset = Number(match.offset);
    const length = Number(match.length);
    return {
      ...match,
      offset,
      length,
      original:
        Number.isInteger(offset) && Number.isInteger(length)
          ? text.slice(offset, offset + length)
          : "",
      replacements: Array.isArray(match.replacements) ? match.replacements : [],
    };
  });
}

function sourceMatches(match, expectation) {
  const original = String(match.original ?? "");
  const anchor = String(expectation.anchor ?? "");
  return (
    original === anchor ||
    original.includes(anchor) ||
    anchor.includes(original)
  );
}

function replacementMatches(match, expectation) {
  const replacement = String(match.replacements?.[0] ?? "");
  return (expectation.accepted_replacements || []).some((accepted) =>
    replacement.includes(accepted)
  );
}

export function scoreMatches(item, matches) {
  const expectations = Array.isArray(item.expected) ? item.expected : [];
  const expectedResults = expectations.map((expectation) => {
    const detected = matches.some((match) => sourceMatches(match, expectation));
    const correct = matches.some(
      (match) =>
        sourceMatches(match, expectation) &&
        replacementMatches(match, expectation)
    );
    return {
      anchor: expectation.anchor,
      detected,
      correct,
    };
  });
  const expectedMatches = matches.filter((match) =>
    expectations.some((expectation) => sourceMatches(match, expectation))
  );
  return {
    expected: expectations.length,
    detected: expectedResults.filter((result) => result.detected).length,
    correct: expectedResults.filter((result) => result.correct).length,
    falsePositives: matches.length - expectedMatches.length,
    wrongReplacements: expectedResults.filter(
      (result) => result.detected && !result.correct
    ).length,
    expectedResults,
  };
}

function addAggregate(target, score, item) {
  target.expected += score.expected;
  target.detected += score.detected;
  target.correct += score.correct;
  target.falsePositives += score.falsePositives;
  target.wrongReplacements += score.wrongReplacements;
  if (item.kind === "clean") {
    target.cleanCases += 1;
    target.cleanFalsePositives += score.falsePositives;
  } else {
    target.errorCases += 1;
  }
}

function emptyAggregate() {
  return {
    errorCases: 0,
    cleanCases: 0,
    expected: 0,
    detected: 0,
    correct: 0,
    falsePositives: 0,
    cleanFalsePositives: 0,
    wrongReplacements: 0,
  };
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1)
  );
  return Number(sorted[index].toFixed(2));
}

export function summarizeRuns(runs) {
  const aggregate = {
    normal: emptyAggregate(),
    deep: emptyAggregate(),
    hybrid: emptyAggregate(),
  };
  const byConfidence = {};
  const deepStatuses = {};
  const deepMetrics = {
    chunks: 0,
    unparsable: 0,
    retried: 0,
    overRewritten: 0,
    rejected: {},
  };
  let deepOnlyCorrect = 0;
  let hybridOnlyCorrect = 0;
  let deepCorrectSuppressedByBaseline = 0;
  let hybridRegressions = 0;
  let normalOnlyCorrect = 0;
  const latencyMs = {
    normal: [],
    deep: [],
  };

  for (const run of runs) {
    for (const result of run.results) {
      addAggregate(aggregate.normal, result.normal.score, result.case);
      addAggregate(aggregate.deep, result.deep.score, result.case);
      addAggregate(aggregate.hybrid, result.hybrid.score, result.case);
      const confidence = result.case.confidence || "unknown";
      byConfidence[confidence] ||= {
        normal: emptyAggregate(),
        deep: emptyAggregate(),
        hybrid: emptyAggregate(),
      };
      addAggregate(
        byConfidence[confidence].normal,
        result.normal.score,
        result.case
      );
      addAggregate(
        byConfidence[confidence].deep,
        result.deep.score,
        result.case
      );
      addAggregate(
        byConfidence[confidence].hybrid,
        result.hybrid.score,
        result.case
      );
      if (Number.isFinite(result.normal.durationMs)) {
        latencyMs.normal.push(result.normal.durationMs);
      }
      if (Number.isFinite(result.deep.durationMs)) {
        latencyMs.deep.push(result.deep.durationMs);
      }
      deepStatuses[result.deep.status] =
        (deepStatuses[result.deep.status] || 0) + 1;
      for (const key of ["chunks", "unparsable", "retried", "overRewritten"]) {
        deepMetrics[key] += result.deep.metrics?.[key] || 0;
      }
      for (const [key, value] of Object.entries(
        result.deep.metrics?.rejected || {}
      )) {
        deepMetrics.rejected[key] =
          (deepMetrics.rejected[key] || 0) + (value || 0);
      }
      if (
        result.deep.score.correct > result.normal.score.correct &&
        result.hybrid.score.correct > result.normal.score.correct
      ) {
        deepOnlyCorrect += 1;
      }
      if (result.hybrid.score.correct > result.normal.score.correct) {
        hybridOnlyCorrect += 1;
      }
      if (result.deep.score.correct > result.hybrid.score.correct) {
        deepCorrectSuppressedByBaseline += 1;
      }
      if (result.hybrid.score.correct < result.normal.score.correct) {
        hybridRegressions += 1;
      }
      if (
        result.normal.score.correct > result.deep.score.correct &&
        result.hybrid.score.correct === result.normal.score.correct
      ) {
        normalOnlyCorrect += 1;
      }
    }
  }

  return {
    aggregate,
    byConfidence,
    deepStatuses,
    deepMetrics,
    latencyMs: {
      normal: {
        p50: percentile(latencyMs.normal, 0.5),
        p95: percentile(latencyMs.normal, 0.95),
        samples: latencyMs.normal.length,
      },
      deep: {
        p50: percentile(latencyMs.deep, 0.5),
        p95: percentile(latencyMs.deep, 0.95),
        samples: latencyMs.deep.length,
      },
    },
    deepOnlyCorrect,
    hybridOnlyCorrect,
    deepCorrectSuppressedByBaseline,
    hybridRegressions,
    normalOnlyCorrect,
  };
}

async function runNormal(baseUrl, item, timeoutMs) {
  const data = await requestJson(
    `${baseUrl}/grammar/check`,
    {
      text: item.text,
      language: item.language || "en-US",
      ignore: [],
    },
    timeoutMs
  );
  const matches = normalizeMatches(item.text, data.matches);
  return {
    status: "complete",
    score: scoreMatches(item, matches),
    matches,
  };
}

async function runDeep(baseUrl, model, item, timeoutMs, requestPrefix) {
  const snapshot = {
    text: item.text,
    map: identityMap(item.text),
  };
  const chunks = buildDeepChunks(snapshot);
  const result = await executeDeepScan({
    snapshot,
    chunks,
    callModel: async ({ prompt, text, requestId }) => {
      const data = await requestJson(
        `${baseUrl}/transform`,
        {
          prompt,
          text,
          backend: "bundled",
          model_key: model,
          request_id: `${requestPrefix}-${requestId}`,
        },
        timeoutMs
      );
      return data.text;
    },
    isCancelled: () => false,
    readCurrentText: () => snapshot.text,
    onProgress: () => {},
    noteActivity: async () => {},
  });
  return {
    status: result.status,
    score: scoreMatches(item, result.matches),
    matches: result.matches,
    metrics: result.metrics,
    error: result.error,
  };
}

function summarizeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
  };
}

async function runCase(baseUrl, model, item, timeoutMs, requestPrefix) {
  const normalStarted = performance.now();
  let normal;
  try {
    normal = await runNormal(baseUrl, item, timeoutMs);
  } catch (error) {
    normal = {
      status: "failed",
      score: {
        expected: Array.isArray(item.expected) ? item.expected.length : 0,
        detected: 0,
        correct: 0,
        falsePositives: 0,
        wrongReplacements: 0,
        expectedResults: [],
      },
      matches: [],
      error: summarizeError(error),
    };
  }
  normal.durationMs = Number((performance.now() - normalStarted).toFixed(2));

  const deepStarted = performance.now();
  let deep;
  try {
    deep = await runDeep(baseUrl, model, item, timeoutMs, requestPrefix);
  } catch (error) {
    deep = {
      status: "failed",
      score: {
        expected: Array.isArray(item.expected) ? item.expected.length : 0,
        detected: 0,
        correct: 0,
        falsePositives: 0,
        wrongReplacements: 0,
        expectedResults: [],
      },
      matches: [],
      metrics: {
        chunks: 0,
        unparsable: 0,
        retried: 0,
        overRewritten: 0,
        rejected: {},
      },
      error: summarizeError(error),
    };
  }
  deep.durationMs = Number((performance.now() - deepStarted).toFixed(2));

  const baselineMatches = normal.matches.map((match) => ({
    ...match,
    engine: "proofread",
  }));
  const hybridMatches = mergeHybridDeepMatches({
    baselineMatches,
    deepMatches: deep.matches,
  });
  const hybrid = {
    status: deep.status,
    score: scoreMatches(item, hybridMatches),
    matches: hybridMatches,
  };

  return { case: item, normal, deep, hybrid };
}

function compactMatch(match) {
  return {
    original: match.original,
    replacement: match.replacements?.[0] || "",
    offset: match.offset,
    length: match.length,
    message: match.message,
    engine: match.engine,
    category: match.category,
  };
}

function compactResult(result) {
  return {
    id: result.case.id,
    kind: result.case.kind,
    category: result.case.category,
    normal: {
      status: result.normal.status,
      durationMs: result.normal.durationMs,
      score: result.normal.score,
      matches: result.normal.matches.map(compactMatch),
      error: result.normal.error,
    },
    deep: {
      status: result.deep.status,
      durationMs: result.deep.durationMs,
      score: result.deep.score,
      matches: result.deep.matches.map(compactMatch),
      metrics: result.deep.metrics,
      error: result.deep.error,
    },
    hybrid: {
      status: result.hybrid.status,
      score: result.hybrid.score,
      matches: result.hybrid.matches.map(compactMatch),
    },
  };
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cases = await loadCases(options.ids);
  const runs = [];

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const results = [];
    for (const item of cases) {
      results.push(
        await runCase(
          options.baseUrl,
          options.model,
          item,
          options.timeoutMs,
          `deep-benchmark-${iteration}-${item.id}`
        )
      );
    }
    runs.push({ iteration, results });
  }

  const summary = summarizeRuns(runs);
  const output = {
    fixture: path.relative(process.cwd(), FIXTURE_PATH),
    baseUrl: options.baseUrl,
    model: options.model,
    iterations: options.iterations,
    cases: cases.length,
    summary,
  };
  if (!options.summaryOnly) {
    output.runs = runs.map((run) => ({
      iteration: run.iteration,
      results: run.results.map(compactResult),
    }));
  }
  console.log(JSON.stringify(output, null, 2));
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    console.error(`deepProofreadBenchmark: ${error.message}`);
    process.exitCode = 1;
  });
}
