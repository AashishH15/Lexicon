import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(SCRIPT_DIR, "../src/__tests__/fixtures/gecFluencyBenchmark.json");

/**
 * Normalizes text for comparison (whitespace, quotes, apostrophes).
 */
function cleanText(str) {
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function scoreExternalCorrectedSentences(
  correctedLines,
  toolName = "External Tool",
  { setType = "baseline", seed = null, targetCases = null } = {}
) {
  let testCases = targetCases;
  if (!testCases) {
    const fixtureData = JSON.parse(await fs.readFile(FIXTURE_PATH, "utf8"));
    if (setType === "baseline") {
      testCases = fixtureData.filter((c) => c.is_baseline);
    } else {
      const { selectBenchmarkCases } = await import("./gecFluencyBenchmark.mjs");
      testCases = selectBenchmarkCases({
        cases: fixtureData,
        setType,
        sampleSize: 25,
        seed,
      });
    }
  }

  if (correctedLines.length !== testCases.length) {
    console.warn(`Warning: Provided ${correctedLines.length} lines, but test set has ${testCases.length} sentences.`);
  }

  let totalExpected = 0;
  let totalDetected = 0;
  let totalCorrect = 0;
  let totalFalsePositives = 0;
  let totalCleanCases = 0;
  let cleanCasesWithEdits = 0;

  let jflegExpected = 0;
  let jflegCorrect = 0;
  let beaExpected = 0;
  let beaCorrect = 0;

  const itemReports = [];

  for (let i = 0; i < testCases.length; i += 1) {
    const item = testCases[i];
    const original = cleanText(item.text);
    const corrected = cleanText(correctedLines[i] ?? original);
    const isClean = item.kind === "clean" || !item.expected || item.expected.length === 0;

    const expectations = item.expected || [];
    let itemDetected = 0;
    let itemCorrect = 0;

    if (isClean) {
      totalCleanCases += 1;
      const hasChanged = original !== corrected;
      if (hasChanged) {
        cleanCasesWithEdits += 1;
        totalFalsePositives += 1;
      }
      itemReports.push({
        id: item.id,
        domain: item.domain,
        isClean: true,
        original,
        corrected,
        hasChanged,
        passed: !hasChanged,
      });
      continue;
    }

    // Error sentence
    totalExpected += expectations.length;
    if (item.domain === "jfleg") jflegExpected += expectations.length;
    if (item.domain === "bea2019") beaExpected += expectations.length;

    const expectationResults = [];

    for (const exp of expectations) {
      const anchor = cleanText(exp.anchor);
      // Word-boundary check for anchor
      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const anchorRegex = new RegExp(`\\b${escapedAnchor}\\b`, "i");
      const anchorInOriginal = anchorRegex.test(original);
      const anchorInCorrected = anchorRegex.test(corrected);

      // Check if accepted replacement is present in corrected text
      const fixedWithAccepted = exp.accepted_replacements.some((rep) => {
        const escapedRep = cleanText(rep).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const repRegex = new RegExp(`\\b${escapedRep}\\b`, "i");
        const inCorrected = repRegex.test(corrected);
        const inOriginal = repRegex.test(original);

        // Either the replacement was introduced where it wasn't before (e.g. "the internet has"),
        // or the anchor was completely removed and replacement remains (e.g. "has arrived" -> "arrived")
        if (inCorrected && !inOriginal) return true;
        if (inCorrected && inOriginal && !anchorInCorrected) return true;
        return false;
      });

      const detected = !anchorInCorrected || fixedWithAccepted;
      const correct = fixedWithAccepted;

      if (detected) itemDetected += 1;
      if (correct) {
        itemCorrect += 1;
        if (item.domain === "jfleg") jflegCorrect += 1;
        if (item.domain === "bea2019") beaCorrect += 1;
      }

      expectationResults.push({
        anchor,
        detected,
        correct,
        accepted: exp.accepted_replacements,
      });
    }

    totalDetected += itemDetected;
    totalCorrect += itemCorrect;

    itemReports.push({
      id: item.id,
      domain: item.domain,
      isClean: false,
      original,
      corrected,
      expectedCount: expectations.length,
      itemCorrect,
      expectationResults,
    });
  }

  const precision = totalCorrect + totalFalsePositives > 0
    ? (totalCorrect / (totalCorrect + totalFalsePositives)) * 100
    : 0;
  const recall = totalExpected > 0 ? (totalCorrect / totalExpected) * 100 : 0;
  const beta = 0.5;
  const betaSq = beta * beta;
  const f05 = precision + recall > 0
    ? ((1 + betaSq) * precision * recall) / (betaSq * precision + recall)
    : 0;
  const cleanFpr = totalCleanCases > 0 ? (cleanCasesWithEdits / totalCleanCases) * 100 : 0;

  const summary = {
    toolName,
    sentences: testCases.length,
    expectedErrors: totalExpected,
    correctFixes: totalCorrect,
    detectedErrors: totalDetected,
    falsePositives: totalFalsePositives,
    precision: Number(precision.toFixed(2)),
    recall: Number(recall.toFixed(2)),
    f05: Number(f05.toFixed(2)),
    cleanFpr: Number(cleanFpr.toFixed(1)),
    cleanFprCount: `${cleanCasesWithEdits}/${totalCleanCases}`,
    jfleg: `${jflegCorrect} / ${jflegExpected} (${((jflegCorrect / jflegExpected) * 100).toFixed(1)}%)`,
    bea: `${beaCorrect} / ${beaExpected} (${((beaCorrect / beaExpected) * 100).toFixed(1)}%)`,
  };

  console.log("\n=======================================================");
  console.log(`BENCHMARK REPORT: ${toolName}`);
  console.log("=======================================================");
  console.log(`Total Sentences:      ${summary.sentences} (8 JFLEG + 9 BEA + 8 LOCNESS Clean)`);
  console.log(`Expected Errors:      ${summary.expectedErrors}`);
  console.log(`Correct Fixes:        ${summary.correctFixes}`);
  console.log(`False Positives:      ${summary.falsePositives}`);
  console.log(`Precision:            ${summary.precision}%`);
  console.log(`Recall:               ${summary.recall}%`);
  console.log(`F_0.5 Score:          ${summary.f05}`);
  console.log(`Clean FPR:            ${summary.cleanFpr}% (${summary.cleanFprCount} clean sentences edited)`);
  console.log(`JFLEG Fluency Score:  ${summary.jfleg}`);
  console.log(`BEA-2019 Grammar:     ${summary.bea}`);
  console.log("=======================================================\n");

  return { summary, itemReports };
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith("scoreExternalTool.mjs")) {
  const inputFile = process.argv[2];
  const toolName = process.argv[3] || "QuillBot Free";
  const setType = process.argv[4] || "baseline";
  const seed = process.argv[5] ? Number.parseInt(process.argv[5], 10) : null;

  if (!inputFile) {
    console.error("Usage: node scoreExternalTool.mjs <corrected_sentences_file.txt> [ToolName] [setType] [seed]");
    process.exit(1);
  }
  const content = await fs.readFile(inputFile, "utf8");
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  await scoreExternalCorrectedSentences(lines, toolName, { setType, seed });
}
