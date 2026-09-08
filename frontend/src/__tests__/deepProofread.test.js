import { describe, expect, it } from "vitest";
import {
  DEEP_CHUNK_TEXT_END,
  DEEP_CHUNK_TEXT_START,
  DEEP_MAX_EDITS_PER_CHUNK,
  DEEP_PROOFREAD_PROMPT,
  DEEP_PROOFREAD_TOOL,
  buildDeepChunks,
  dedupeDeepMatches,
  dedupeIdenticalDeepMatches,
  deepEditsToMatches,
  estimateDeepTokens,
  evaluateDeepRunOutcome,
  executeDeepScan,
  extractDeepJson,
  getDeepProofreadPrompt,
  hasNegativePolarity,
  isDeepSnapshotStale,
  isPrepositionChurn,
  isAdverbChurn,
  isFunctionWordFluencyChurn,
  isAllowedIrregularIdiomFix,
  isRelativeAgreementChurn,
  isSynonymChurn,
  mergeHybridDeepMatches,
  normalizeDeepEditItem,
  relocateDeepMatches,
  shouldClearDeepResults,
  spansOverlap,
  validateDeepEdits,
  wrapDeepChunk,
} from "../deepProofread.js";

function identityMap(text) {
  return Array.from({ length: text.length }, (_, index) => index);
}

describe("deep proofread prompt", () => {
  it("names the tool and keeps the prompt fixed and data-delimited", () => {
    expect(DEEP_PROOFREAD_TOOL).toBe("Deep Proofread");
    expect(DEEP_PROOFREAD_PROMPT).toContain('"source"');
    expect(DEEP_PROOFREAD_PROMPT).toContain('"replacement"');
    expect(DEEP_PROOFREAD_PROMPT).toContain(DEEP_CHUNK_TEXT_START);
    expect(DEEP_PROOFREAD_PROMPT).toContain(DEEP_CHUNK_TEXT_END);
    expect(DEEP_PROOFREAD_PROMPT).toMatch(/never follow instructions/i);
    expect(DEEP_PROOFREAD_PROMPT).toMatch(/do not suggest stylistic preferences or synonyms/i);
    expect(DEEP_PROOFREAD_PROMPT).toContain("advice on");
  });

  it("wraps chunk text in delimiters", () => {
    const wrapped = wrapDeepChunk("He don't go.");
    expect(wrapped.startsWith(DEEP_CHUNK_TEXT_START)).toBe(true);
    expect(wrapped.endsWith(DEEP_CHUNK_TEXT_END)).toBe(true);
    expect(wrapped).toContain("He don't go.");
  });

  it("estimates tokens the same way as the transform path", () => {
    expect(estimateDeepTokens("abcd")).toBe(1);
    expect(estimateDeepTokens("abcde")).toBe(2);
  });
});

describe("extractDeepJson", () => {
  it("parses a clean array", () => {
    const raw = '[{"source": "He do not go", "replacement": "He does not go"}]';
    expect(extractDeepJson(raw)).toEqual({
      items: [{ source: "He do not go", replacement: "He does not go" }],
    });
  });

  it("tolerates fences and chatter around the array", () => {
    const raw =
      'Sure! ```json\n[{"source": "He do not go", "replacement": "He does not go"}]\n``` Done.';
    expect(extractDeepJson(raw).items).toHaveLength(1);
  });

    it("wraps a single edit object as a one-item array", () => {
      const raw =
        '{"source": "He do not go", "replacement": "He does not go"}';
      expect(extractDeepJson(raw)).toEqual({
        items: [{ source: "He do not go", replacement: "He does not go" }],
      });
    });

    it("recovers pseudo-array outputs without inner object braces", () => {
      const raw = '["source": "He do not go", "replacement": "He does not go"]';
      expect(extractDeepJson(raw)).toEqual({
        items: [{ source: "He do not go", replacement: "He does not go" }],
      });
    });

    it("rejects garbage without an array", () => {
    expect(extractDeepJson("All clean!").error).toBe("unparsable");
    expect(extractDeepJson("").error).toBe("unparsable");
  });
});

describe("validateDeepEdits", () => {
  const chunk = "He don't have no money because he never went nowhere today.";

  it("accepts a unique verbatim span", () => {
    const result = validateDeepEdits(chunk, [
      { source: "He don't have no money", replacement: "He doesn't have any money" },
    ]);
    expect(result.rejectedWhole).toBeNull();
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]).toMatchObject({
      source: "He don't have no money",
      replacement: "He doesn't have any money",
    });
    expect(result.edits[0].index).toBe(0);
  });

  it("rejects a missing span", () => {
    const result = validateDeepEdits(chunk, [
      { source: " totally invented phrase here", replacement: "x" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.missing).toBe(1);
  });

  it("rejects an ambiguous repeated span", () => {
    const text = "say the magic words now, say the magic words now please.";
    const result = validateDeepEdits(text, [
      { source: "say the magic words now", replacement: "x" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.ambiguous).toBe(1);
  });

  it("rejects no-op replacements", () => {
    const result = validateDeepEdits(chunk, [
      { source: "he never went nowhere today", replacement: "he never went nowhere today" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.noop).toBe(1);
  });

  it("rejects empty replacements", () => {
    const result = validateDeepEdits(chunk, [
      { source: "he never went nowhere today", replacement: "" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.empty).toBe(1);
  });

  it("rejects wrong keys and missing source/replacement", () => {
    const result = validateDeepEdits(chunk, [
      { source: "he never went nowhere today" },
      "nope",
      null,
      { replacement: "x" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.malformed).toBe(4);
  });

  it("Phase 5.1: accepts optional category/explanation metadata and strips them", () => {
    const text = "He don't have no money because he never went nowhere today ok.";
    const result = validateDeepEdits(text, [
      {
        source: "He don't have no money",
        replacement: "He doesn't have any money",
        category: "grammar",
        explanation: "Double negative",
      },
    ]);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]).toMatchObject({
      source: "He don't have no money",
      replacement: "He doesn't have any money",
    });
    expect(result.edits[0].category).toBeUndefined();
    expect(result.edits[0].explanation).toBeUndefined();
    expect(result.rejected.malformed).toBe(0);
  });

  it("Phase 5.1: accepts unexpected auxiliary keys without malformed rejection", () => {
    const text = "He don't have no money because he never went nowhere today ok.";
    const result = validateDeepEdits(text, [
      {
        source: "He don't have no money",
        replacement: "He doesn't have any money",
        confidence: 0.92,
        extra: { nested: true },
      },
    ]);
    expect(result.edits).toHaveLength(1);
    expect(result.rejected.malformed).toBe(0);
  });

  it("rejects sources outside the 3-12 word span", () => {
    const result = validateDeepEdits(chunk, [
      { source: "money", replacement: "cash" },
      {
        source: "He don't have no money because he never went nowhere today ok yes",
        replacement: "x",
      },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.badSpan).toBe(2);
  });

  it("rejects spans with newlines or control characters", () => {
    const text = "First line here now.\nSecond line here now today.";
    const result = validateDeepEdits(text, [
      { source: "here now.\nSecond line here", replacement: "x" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.badSpan).toBe(1);
  });

  it("rejects absurd replacement growth", () => {
    const result = validateDeepEdits(chunk, [
      { source: "he never went nowhere today", replacement: `fixed ${"y".repeat(200)}` },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.absurd).toBe(1);
  });

  it("detects negative polarity tokens and contractions correctly", () => {
    expect(hasNegativePolarity("She didn't know")).toBe(true);
    expect(hasNegativePolarity("He never came")).toBe(true);
    expect(hasNegativePolarity("There is nothing here")).toBe(true);
    expect(hasNegativePolarity("I have no doubts")).toBe(true);
    expect(hasNegativePolarity("She cannot proceed")).toBe(true);
    expect(hasNegativePolarity("They barely survived")).toBe(true);
    expect(hasNegativePolarity("She knew the answer")).toBe(false);
    expect(hasNegativePolarity("Now is the time")).toBe(false);
  });

  it("rejects edits that invert semantic polarity (negative to affirmative)", () => {
    const text = "He don't have no money because he never went nowhere today ok.";
    const result = validateDeepEdits(text, [
      { source: "He don't have no money", replacement: "He has plenty of money" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.unsafePolarity).toBe(1);
  });

  it("rejects edits that invert semantic polarity (affirmative to negative)", () => {
    const text = "The application restarted promptly after the update finished.";
    const result = validateDeepEdits(text, [
      { source: "restarted promptly after the update", replacement: "did not restart after the update" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.unsafePolarity).toBe(1);
  });

  it("accepts valid grammar corrections that preserve negative polarity", () => {
    const text = "He don't have no money because he never went nowhere today ok.";
    const result = validateDeepEdits(text, [
      { source: "He don't have no money", replacement: "He doesn't have any money" },
    ]);
    expect(result.edits).toHaveLength(1);
    expect(result.rejected.unsafePolarity).toBe(0);
  });

  it("detects preposition churn on synonymous function words", () => {
    expect(
      isPrepositionChurn("She gave me good advice on hiring", "She gave me good advice about hiring"),
    ).toBe(true);
    expect(
      isPrepositionChurn("participate in the program", "participate at the program"),
    ).toBe(true);
    expect(
      isPrepositionChurn("The dog what was barking", "The dog that was barking"),
    ).toBe(false);
    expect(
      isPrepositionChurn("No sooner had he arrived when", "No sooner had he arrived than"),
    ).toBe(false);
  });

  it("detects adverb / function-word fluency churn", () => {
    expect(isAdverbChurn("worked really hard today", "worked very hard today")).toBe(true);
    expect(isAdverbChurn("She almost finished", "She nearly finished")).toBe(true);
    expect(isFunctionWordFluencyChurn("depend to others", "depend on others")).toBe(true);
    expect(isFunctionWordFluencyChurn("published in the", "published at the")).toBe(true);
    expect(isFunctionWordFluencyChurn("catch cold yesterday", "caught a cold")).toBe(false);
    expect(
      isAllowedIrregularIdiomFix("prevent him to leave", "prevent him from leaving"),
    ).toBe(true);
    expect(
      isAllowedIrregularIdiomFix("published in the", "published at the"),
    ).toBe(false);
  });

  it("on clean sentences, rejects prep/adverb fluency swaps unless idiom-allowlisted", () => {
    const text = "The results were published in the journal last week.";
    // in|on is NOT in the classic synonym-pair set — only the clean-sentence gate catches it.
    const rejected = validateDeepEdits(
      text,
      [{ source: "published in the", replacement: "published on the" }],
      { baselineMatches: [] },
    );
    expect(rejected.edits).toHaveLength(0);
    expect(rejected.rejected.synonymChurn).toBe(1);

    const idiomText = "Please prevent him to leave early today.";
    const idiom = validateDeepEdits(
      idiomText,
      [{ source: "prevent him to leave", replacement: "prevent him from leaving" }],
      { baselineMatches: [] },
    );
    expect(idiom.edits).toHaveLength(1);

    // Without baselineMatches, only the classic synonym-pair gate applies.
    const classic = validateDeepEdits(text, [
      { source: "published in the", replacement: "published on the" },
    ]);
    expect(classic.edits).toHaveLength(1);
  });

  it("includes contrastive negative exemplars in the Standard few-shot prompt", () => {
    const prompt = getDeepProofreadPrompt("2b", "en-US");
    expect(prompt).toContain("Which room are you sleeping in?");
    expect(prompt).toContain("The organisation prioritized colour harmony.");
    expect(prompt).toContain("The experiment was conducted over three days.");
    expect(prompt).toContain("capable to handle");
    // three new negatives should map to empty output
    const negatives = [
      "Which room are you sleeping in?",
      "The organisation prioritized colour harmony.",
      "The experiment was conducted over three days.",
    ];
    for (const sentence of negatives) {
      const idx = prompt.indexOf(`Input: ${sentence}`);
      expect(idx).toBeGreaterThan(-1);
      const window = prompt.slice(idx, idx + sentence.length + 40);
      expect(window).toMatch(/Output:\s*\[\]/);
    }
  });

  it("rejects candidate edits that merely churn prepositions on clean phrases", () => {
    const text = "She gave me good advice on hiring for the role.";
    const result = validateDeepEdits(text, [
      { source: "good advice on hiring", replacement: "good advice about hiring" },
    ]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.synonymChurn).toBe(1);
  });

  it("rejects common phrase-level synonym churn on clean text", () => {
    const source = "The network bandwidth supports ten video calls at once.";
    const replacement =
      "The network bandwidth supports ten video calls simultaneously.";
    expect(isSynonymChurn(source, replacement)).toBe(true);
    const result = validateDeepEdits(source, [{ source, replacement }]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.synonymChurn).toBe(1);
  });

  it("rejects singular agreement churn after a plural relative antecedent", () => {
    const source = "She is one of those people who always complain.";
    const replacement = "She is one of those people who always complains.";
    expect(isRelativeAgreementChurn(source, replacement)).toBe(true);
    expect(
      isRelativeAgreementChurn(
        "The person who always complains is helpful.",
        "The person who always complain is helpful.",
      ),
    ).toBe(false);
    const result = validateDeepEdits(source, [{ source, replacement }]);
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.relativeAgreement).toBe(1);
  });

  it("drops later overlapping edits", () => {
    const result = validateDeepEdits(chunk, [
      { source: "He don't have no money", replacement: "He doesn't have any money" },
      { source: "don't have no money because", replacement: "doesn't have any money since" },
    ]);
    expect(result.edits).toHaveLength(1);
    expect(result.rejected.overlapped).toBe(1);
  });

  it("accepts a whole-sentence fix in a short chunk", () => {
    const short = "He don't go home now please.";
    const result = validateDeepEdits(short, [
      { source: "He don't go home now please", replacement: "He doesn't go home now please" },
    ]);
    expect(result.rejectedWhole).toBeNull();
    expect(result.edits).toHaveLength(1);
  });

  it("rejects the whole chunk when the model rewrites instead of proofreading", () => {
    const longText = [
      "He should go home now please today.",
      "She will like apples at all today.",
      "They always want big trouble here now.",
      "We will get some help here today.",
      "He already knows stories about it now.",
      "I always said greetings to them today.",
      "Dogs in the yard barks loudly today.",
      "The file on the servers are corrupt.",
    ].join(" ");
    const result = validateDeepEdits(longText, [
      { source: "He should go home now please today", replacement: "He goes home" },
      { source: "She will like apples at all today", replacement: "She likes apples" },
      { source: "They always want big trouble here now", replacement: "They want peace" },
      { source: "We will get some help here today", replacement: "We get help" },
      { source: "He already knows stories about it now", replacement: "He knows things" },
      { source: "I always said greetings to them today", replacement: "I said things" },
      { source: "Dogs in the yard barks loudly today", replacement: "Dogs bark" },
      { source: "The file on the servers are corrupt", replacement: "The file is fine" },
    ]);
    expect(result.rejectedWhole).toBe("over-rewritten");
    expect(result.edits).toHaveLength(0);
  });

  it("caps edits per chunk and counts the rest", () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const items = Array.from({ length: DEEP_MAX_EDITS_PER_CHUNK + 5 }, (_, i) => ({
      source: `word${i * 3} word${i * 3 + 1} word${i * 3 + 2}`,
      replacement: `word${i * 3} word${i * 3 + 1} word${i * 3 + 2}!`,
    }));
    const result = validateDeepEdits(words, items);
    expect(result.edits.length).toBeLessThanOrEqual(DEEP_MAX_EDITS_PER_CHUNK);
    expect(result.rejected.capped).toBe(5);
  });

  it("rejects a non-list payload as a whole", () => {
    const result = validateDeepEdits(chunk, { source: "x" });
    expect(result.rejectedWhole).toBe("not-a-list");
    expect(result.edits).toHaveLength(0);
  });
});

describe("buildDeepChunks", () => {
  it("returns no chunks for empty text", () => {
    expect(buildDeepChunks({ text: "", map: [] })).toEqual([]);
  });

  it("packs whole sentences under the token target", () => {
    const text = "First sentence here now. Second sentence here now today.";
    const chunks = buildDeepChunks(
      { text, map: identityMap(text) },
      { targetTokens: 10, maxTokens: 12 },
    );
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(text.slice(chunk.textStart, chunk.textEnd)).toBe(chunk.text);
      expect(chunk.docFrom).toBe(chunk.textStart);
      expect(chunk.docTo).toBe(chunk.textEnd);
    }
    const joined = chunks.map((c) => c.text).join(" ");
    expect(joined).toContain("First sentence here now.");
  });

  it("maps text offsets through a gappy editor map", () => {
    const text = "Hi there now. Bye there now today.";
    const map = identityMap(text);
    map[0] = null;
    const chunks = buildDeepChunks({ text, map }, { targetTokens: 500 });
    expect(chunks.length).toBe(1);
    expect(chunks[0].docFrom).not.toBeNull();
  });

  it("splits an oversized sentence with overlap instead of dropping it", () => {
    const sentence = `${"word ".repeat(400)}end.`;
    const chunks = buildDeepChunks(
      { text: sentence, map: identityMap(sentence) },
      { targetTokens: 50, maxTokens: 60, overlapChars: 200 },
    );
    expect(chunks.length).toBeGreaterThan(1);
    // A short span straddling the cut survives in the overlapping window.
    const cut = chunks[0].textEnd;
    const probeStart = Math.max(0, cut - 10);
    const probe = sentence.slice(probeStart, probeStart + 30);
    const found = chunks.some((c) => c.text.includes(probe));
    expect(found).toBe(true);
  });

  it("skips code-like spans", () => {
    const text = "```\nconst x = 1;\n```\nPlain words here now today.";
    const chunks = buildDeepChunks({ text, map: identityMap(text) });
    expect(chunks.map((c) => c.text).join(" ")).not.toContain("const x");
  });
});

describe("deep match conversion and dedup", () => {
  const text = "He don't have no money today here.";
  const snapshot = { text, map: identityMap(text) };

  it("converts edits to review matches with editor offsets", () => {
    const { matches } = deepEditsToMatches({
      edits: [{ index: 0, end: 22, source: "He don't have no money", replacement: "He is rich" }],
      chunk: { textStart: 0 },
      snapshot,
      startId: 0,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: "deep-0",
      offset: 0,
      length: 22,
      original: "He don't have no money",
      replacements: ["He is rich"],
      category: "Clarity",
      engine: "ai",
    });
    expect(matches[0].sentence.length).toBeGreaterThan(0);
  });

  it("drops edits whose span no longer matches the snapshot", () => {
    const { matches, dropped } = deepEditsToMatches({
      edits: [{ index: 0, end: 5, source: "CHANGED", replacement: "x" }],
      chunk: { textStart: 0 },
      snapshot,
      startId: 0,
    });
    expect(matches).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("removes deep matches that overlap deterministic matches", () => {
    const deep = [{ offset: 3, length: 5, replacements: ["x"] }];
    const base = [{ offset: 0, length: 10 }];
    expect(dedupeDeepMatches(deep, base)).toHaveLength(0);
    expect(dedupeDeepMatches(deep, [{ offset: 20, length: 2 }])).toHaveLength(1);
  });

  it("removes identical duplicates from overlapping chunks", () => {
    const match = { offset: 3, length: 5, replacements: ["x"] };
    expect(dedupeIdenticalDeepMatches([match, { ...match }])).toHaveLength(1);
  });

  it("detects stale snapshots and span overlap", () => {
    expect(isDeepSnapshotStale("a", "a")).toBe(false);
    expect(isDeepSnapshotStale("a", "b")).toBe(true);
    expect(spansOverlap(0, 5, 3, 5)).toBe(true);
    expect(spansOverlap(0, 5, 5, 5)).toBe(false);
  });
});

describe("relocateDeepMatches", () => {
  it("keeps repeated phrases distinct in order", () => {
    const text = "Dogs bark loudly today. Dogs bark loudly today.";
    const matches = [
      { id: "deep-0", offset: 0, length: 4, original: "Dogs" },
      { id: "deep-1", offset: 24, length: 4, original: "Dogs" },
    ];
    const next = relocateDeepMatches(text, matches);
    expect(next.map((match) => match.offset)).toEqual([0, 24]);
  });

  it("shifts offsets after an applied fix and drops vanished spans", () => {
    const matches = [
      { id: "deep-0", offset: 0, length: 4, original: "Dogs" },
      { id: "deep-1", offset: 5, length: 4, original: "bark" },
      { id: "deep-2", offset: 30, length: 4, original: "Gone" },
    ];
    const next = relocateDeepMatches("Dogs! bark loudly today.", matches);
    expect(next.map((match) => match.offset)).toEqual([0, 6]);
  });
});

describe("shouldClearDeepResults", () => {
  const base = {
    running: false,
    matchCount: 2,
    snapshotText: "same text",
    currentText: "same text",
    ownApply: false,
  };
  it("clears only finished results invalidated by an edit", () => {
    expect(shouldClearDeepResults(base)).toBe(false);
    expect(shouldClearDeepResults({ ...base, running: true })).toBe(false);
    expect(shouldClearDeepResults({ ...base, matchCount: 0 })).toBe(false);
    expect(
      shouldClearDeepResults({ ...base, matchCount: 0, currentText: "changed text" }),
    ).toBe(true);
    expect(
      shouldClearDeepResults({ ...base, currentText: "changed text" }),
    ).toBe(true);
    expect(
      shouldClearDeepResults({ ...base, currentText: "changed text", ownApply: true }),
    ).toBe(false);
    expect(shouldClearDeepResults({ ...base, snapshotText: null })).toBe(false);
  });
});

describe("executeDeepScan", () => {
  const snapshot = { text: "She don't like apples. They is happy today.", map: [] };
  const jsonFix = JSON.stringify([
    { source: "She don't like apples", replacement: "She doesn't like apples" },
  ]);
  const jsonFixTwo = JSON.stringify([
    { source: "They is happy today", replacement: "They are happy today" },
  ]);

  function harness({ model, currentText, cancelledAfter = -1 } = {}) {
    const calls = [];
    let callCount = 0;
    return {
      calls,
      run: () =>
        executeDeepScan({
          snapshot,
          chunks: [
            { text: "She don't like apples.", textStart: 0 },
            { text: "They is happy today.", textStart: 23 },
          ],
          callModel: async ({ text }) => {
            calls.push(text);
            callCount += 1;
            if (cancelledAfter >= 0 && callCount > cancelledAfter) {
              const error = new Error("aborted");
              error.name = "AbortError";
              throw error;
            }
            return model(callCount, text);
          },
          isCancelled: () => false,
          readCurrentText: () => currentText ?? snapshot.text,
          onProgress: () => {},
          noteActivity: async () => {},
        }),
    };
  }

  it("completes with converted matches across chunks", async () => {
    const { run, calls } = harness({ model: (n) => (n === 1 ? jsonFix : jsonFixTwo) });
    const result = await run();
    expect(result.status).toBe("complete");
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]).toMatchObject({
      offset: 0,
      original: "She don't like apples",
    });
    expect(calls).toHaveLength(2);
  });

  it("discards validated partials when cancelled mid-run", async () => {
    const { run } = harness({ model: () => jsonFix, cancelledAfter: 1 });
    const result = await run();
    expect(result.status).toBe("cancelled");
    expect(result.matches).toEqual([]);
  });

  it("cancels when the snapshot goes stale mid-run", async () => {
    const { run } = harness({ model: () => jsonFix, currentText: "edited text" });
    const result = await run();
    expect(result.status).toBe("cancelled");
    expect(result.matches).toEqual([]);
  });

  it("reports failure with the model error message", async () => {
    const { run } = harness({
      model: () => {
        throw new Error("engine exploded");
      },
    });
    const result = await run();
    expect(result.status).toBe("failed");
    expect(result.error).toBe("engine exploded");
    expect(result.matches).toEqual([]);
  });

  it("reports incomplete when every chunk is unusable", async () => {
    const { run } = harness({ model: () => "not json at all" });
    const result = await run();
    expect(result.status).toBe("incomplete");
    expect(result.matches).toEqual([]);
    expect(result.metrics.unparsable).toBe(2);
  });

  it("completes cleanly when the model finds nothing", async () => {
    const { run } = harness({ model: () => "[]" });
    const result = await run();
    expect(result.status).toBe("complete");
    expect(result.matches).toEqual([]);
  });

  it("completes cleanly when safe-guarded style edits are rejected", async () => {
    const text = "The network bandwidth supports ten video calls at once.";
    const snapshot = { text, map: identityMap(text) };
    const result = await executeDeepScan({
      snapshot,
      chunks: [{ text, textStart: 0 }],
      callModel: async () =>
        JSON.stringify([
          {
            source: text,
            replacement:
              "The network bandwidth supports ten video calls simultaneously.",
          },
        ]),
      isCancelled: () => false,
      readCurrentText: () => text,
      onProgress: () => {},
      noteActivity: async () => {},
    });
    expect(result.status).toBe("complete");
    expect(result.matches).toEqual([]);
    expect(result.metrics.rejected.synonymChurn).toBe(1);
  });

  it("reports partial when only some chunks are unusable", async () => {
    let calls = 0;
    const { run } = harness({
      model: () => {
        calls += 1;
        return calls === 1 ? jsonFix : "garbage[[[";
      },
    });
    const result = await run();
    expect(result.status).toBe("partial");
    expect(result.matches).toHaveLength(1);
    expect(result.metrics.unparsable).toBe(1);
  });

  it("reports incomplete when candidate items fail validation", async () => {
    const invalidCandidate = JSON.stringify([
      { source: "apples", replacement: "oranges" },
    ]);
    const { run } = harness({ model: () => invalidCandidate });
    const result = await run();
    expect(result.status).toBe("incomplete");
    expect(result.matches).toEqual([]);
    expect(result.metrics.rejected.badSpan).toBeGreaterThan(0);
  });

  it("retries once on unparsable output", async () => {
    const seen = [];
    const result = await executeDeepScan({
      snapshot,
      chunks: [{ text: "She don't like apples.", textStart: 0 }],
      callModel: async ({ text }) => {
        seen.push(text);
        return seen.length === 1 ? "garbage[[[" : jsonFix;
      },
      isCancelled: () => false,
      readCurrentText: () => snapshot.text,
      onProgress: () => {},
      noteActivity: async () => {},
    });
    expect(result.status).toBe("complete");
    expect(result.matches).toHaveLength(1);
    expect(result.metrics.retried).toBe(1);
  });

  it("reports progress and activity per chunk", async () => {
    const progress = [];
    let activity = 0;
    await executeDeepScan({
      snapshot,
      chunks: [
        { text: "She don't like apples.", textStart: 0 },
        { text: "They is happy today.", textStart: 23 },
      ],
      callModel: async () => "[]",
      isCancelled: () => false,
      readCurrentText: () => snapshot.text,
      onProgress: (update) => progress.push(update),
      noteActivity: async () => {
        activity += 1;
      },
    });
    expect(progress).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ]);
    expect(activity).toBe(2);
  });
});

describe("mergeHybridDeepMatches", () => {
  it("preserves baseline matches and adds unique AI suggestions", () => {
    const baselineMatches = [
      { offset: 0, length: 5, message: "Grammar issue", replacements: ["There"] },
      { offset: 30, length: 4, message: "Spelling issue", replacements: ["cats"] },
    ];
    const deepMatches = [
      { offset: 12, length: 10, message: "Awkward phrasing", replacements: ["smooth phrasing"] },
    ];
    const merged = mergeHybridDeepMatches({ baselineMatches, deepMatches });
    expect(merged).toHaveLength(3);
    expect(merged[0].offset).toBe(0);
    expect(merged[0].engine).toBe("proofread");
    expect(merged[1].offset).toBe(12);
    expect(merged[1].engine).toBe("ai");
    expect(merged[1].category).toBe("Clarity");
    expect(merged[2].offset).toBe(30);
    expect(merged.map((m) => m.id)).toEqual([0, 1, 2]);
  });

  it("discards AI matches that collide with baseline spans", () => {
    const baselineMatches = [
      { offset: 10, length: 5, message: "Deterministic rule", replacements: ["lose"] },
    ];
    const deepMatches = [
      { offset: 8, length: 10, message: "AI phrasing", replacements: ["different"] },
      { offset: 40, length: 6, message: "AI unique", replacements: ["better"] },
    ];
    const merged = mergeHybridDeepMatches({ baselineMatches, deepMatches });
    expect(merged).toHaveLength(2);
    expect(merged[0].offset).toBe(10);
    expect(merged[0].engine).toBe("proofread");
    expect(merged[1].offset).toBe(40);
    expect(merged[1].engine).toBe("ai");
  });

  it("keeps only one deterministic AI proposal across overlapping chunks", () => {
    const merged = mergeHybridDeepMatches({
      baselineMatches: [],
      deepMatches: [
        { offset: 20, length: 12, message: "Later chunk", replacements: ["later"] },
        { offset: 18, length: 18, message: "Earlier chunk", replacements: ["earlier"] },
        { offset: 60, length: 4, message: "Unique", replacements: ["unique"] },
      ],
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      offset: 18,
      length: 18,
      engine: "ai",
      category: "Clarity",
    });
    expect(merged[1].offset).toBe(60);
  });

  it("handles empty arrays gracefully", () => {
    expect(mergeHybridDeepMatches({ baselineMatches: [], deepMatches: [] })).toEqual([]);
    const baseline = [{ offset: 5, length: 3, message: "test" }];
    expect(mergeHybridDeepMatches({ baselineMatches: baseline, deepMatches: [] })).toHaveLength(1);
    const deep = [{ offset: 5, length: 3, message: "test" }];
    expect(mergeHybridDeepMatches({ baselineMatches: [], deepMatches: deep })).toHaveLength(1);
  });
});

describe("evaluateDeepRunOutcome baseline error guard", () => {
  it("prevents false clean when baseline grammar engine fails and AI finds no errors", () => {
    const res = evaluateDeepRunOutcome({
      baselineError: "Failed to fetch",
      baselineMatches: [],
      deepMatches: [],
      scanStatus: "complete",
      language: "en-US",
    });
    expect(res.outcome).toBe("warning");
    expect(res.matches).toEqual([]);
    expect(res.warning).toMatch(/grammar engine was unreachable/i);
  });

  it("warns user if baseline engine failed but AI found clarity suggestions", () => {
    const res = evaluateDeepRunOutcome({
      baselineError: "Connection refused",
      baselineMatches: [],
      deepMatches: [{ offset: 10, length: 5, message: "AI suggest", replacements: ["test"] }],
      scanStatus: "complete",
    });
    expect(res.outcome).toBe("warning");
    expect(res.matches).toHaveLength(1);
    expect(res.warning).toMatch(/grammar engine was unreachable/i);
  });

  it("soft-warns when both baseline and AI fail, with non-English notice", () => {
    const res = evaluateDeepRunOutcome({
      baselineError: "Connection refused",
      baselineMatches: [],
      deepMatches: [],
      scanStatus: "failed",
      scanError: "Model offline",
      language: "pt-BR",
    });
    expect(res.outcome).toBe("warning");
    expect(res.matches).toEqual([]);
    expect(res.warning).toMatch(/grammar engine was unreachable/i);
    expect(res.warning).toMatch(/not been thoroughly tested/i);
  });

  it("merges baseline and AI matches cleanly when both succeed", () => {
    const res = evaluateDeepRunOutcome({
      baselineError: null,
      baselineMatches: [{ offset: 0, length: 2, message: "Grammar rule" }],
      deepMatches: [{ offset: 10, length: 4, message: "Clarity rule" }],
      scanStatus: "complete",
    });
    expect(res.outcome).toBe("complete");
    expect(res.matches).toHaveLength(2);
    expect(res.warning).toBe("");
  });

  it("adds a non-English AI caution notice on successful deep runs", () => {
    const english = evaluateDeepRunOutcome({
      baselineError: null,
      baselineMatches: [{ offset: 0, length: 2, message: "Grammar rule" }],
      deepMatches: [],
      scanStatus: "complete",
      language: "en-US",
    });
    expect(english.outcome).toBe("complete");
    expect(english.warning).toBe("");

    const french = evaluateDeepRunOutcome({
      baselineError: null,
      baselineMatches: [{ offset: 0, length: 2, message: "Grammar rule" }],
      deepMatches: [],
      scanStatus: "complete",
      language: "fr",
    });
    expect(french.outcome).toBe("complete");
    expect(french.warning).toMatch(/not been thoroughly tested/i);
    expect(french.warning).toMatch(/French/i);
  });

  it("soft-fails when AI output is unusable and LanguageTool found nothing", () => {
    const tamil = evaluateDeepRunOutcome({
      baselineError: null,
      baselineMatches: [],
      deepMatches: [],
      scanStatus: "incomplete",
      language: "ta",
    });
    expect(tamil.outcome).toBe("warning");
    expect(tamil.matches).toEqual([]);
    expect(tamil.error).toBeUndefined();
    expect(tamil.warning).toMatch(/could not produce usable suggestions/i);
    expect(tamil.warning).toMatch(/LanguageTool found no grammar issues/i);
    expect(tamil.warning).toMatch(/not been thoroughly tested/i);
    expect(tamil.warning).toMatch(/Tamil/i);

    const romanianFailed = evaluateDeepRunOutcome({
      baselineError: null,
      baselineMatches: [],
      deepMatches: [],
      scanStatus: "failed",
      scanError: "Deep proofread failed.",
      language: "ro",
    });
    expect(romanianFailed.outcome).toBe("warning");
    expect(romanianFailed.matches).toEqual([]);
    expect(romanianFailed.warning).toMatch(/LanguageTool found no grammar issues/i);
    expect(romanianFailed.warning).toMatch(/Romanian/i);
  });
});

describe("multilingual deep proofread guardrails", () => {
  it("detects French, German, and Spanish negative polarity markers", () => {
    expect(hasNegativePolarity("Il n'est pas prêt", "fr")).toBe(true);
    expect(hasNegativePolarity("Il est prêt", "fr")).toBe(false);
    expect(hasNegativePolarity("Er ist nicht gekommen", "de-DE")).toBe(true);
    expect(hasNegativePolarity("Er ist gekommen", "de-DE")).toBe(false);
    expect(hasNegativePolarity("Ella no tiene nada", "es")).toBe(true);
    expect(hasNegativePolarity("Ella tiene algo", "es")).toBe(false);
  });

  it("rejects French polarity inversion while allowing grammar-preserving negation", () => {
    const text = "Il n'est pas capable de gerer le projet aujourd'hui.";
    const inverted = validateDeepEdits(
      text,
      [{ source: "Il n'est pas capable", replacement: "Il est capable" }],
      { language: "fr" },
    );
    expect(inverted.edits).toHaveLength(0);
    expect(inverted.rejected.unsafePolarity).toBe(1);

    const preserved = validateDeepEdits(
      text,
      [{ source: "pas capable de gerer", replacement: "pas capable de gérer" }],
      { language: "fr" },
    );
    expect(preserved.edits).toHaveLength(1);
    expect(preserved.rejected.unsafePolarity).toBe(0);
  });

  it("rejects German polarity inversion", () => {
    const text = "Er ist nicht gekommen, weil der Zug Verspätung hatte.";
    const result = validateDeepEdits(
      text,
      [{ source: "Er ist nicht gekommen", replacement: "Er ist gekommen" }],
      { language: "de-DE" },
    );
    expect(result.edits).toHaveLength(0);
    expect(result.rejected.unsafePolarity).toBe(1);
  });

  it("detects Romance/Germanic preposition churn pairs", () => {
    expect(isPrepositionChurn("penser à toi", "penser de toi", "fr")).toBe(true);
    expect(isPrepositionChurn("warten auf dich", "warten an dich", "de-DE")).toBe(true);
    expect(isPrepositionChurn("confiar en ella", "confiar a ella", "es")).toBe(true);
    expect(isPrepositionChurn("pensar em isso", "pensar a isso", "pt-BR")).toBe(true);
  });

  it("appends a keep-language instruction for non-English deep prompts", () => {
    const english = getDeepProofreadPrompt("2b", "en-US");
    const french = getDeepProofreadPrompt("2b", "fr");
    expect(english).not.toMatch(/do not translate/i);
    expect(french).toMatch(/same language as the draft/i);
    expect(french).toMatch(/French/i);
    expect(french).toMatch(/do not translate/i);
  });

  it("still calls the model for locales without family-specific guards", async () => {
    let calls = 0;
    const snapshot = { text: "Me a gar net.", map: identityMap("Me a gar net.") };
    const result = await executeDeepScan({
      snapshot,
      chunks: [{ text: snapshot.text, start: 0, end: snapshot.text.length }],
      language: "br",
      callModel: async () => {
        calls += 1;
        return "[]";
      },
      isCancelled: () => false,
      readCurrentText: () => snapshot.text,
      onProgress: () => {},
      onChunkMatches: () => {},
      noteActivity: async () => {},
    });
    expect(calls).toBe(1);
    expect(result.status).toBe("complete");
    expect(result.aiSkipped).toBeFalsy();
  });
});

describe("Phase 5.1 permissive schema", () => {
  it("normalizeDeepEditItem strips auxiliary fields", () => {
    expect(
      normalizeDeepEditItem({
        source: "a b",
        replacement: "c d",
        category: "fluency",
        explanation: "x",
      }),
    ).toEqual({ source: "a b", replacement: "c d" });
  });

  it("Quality single-pass still accepts metadata-bearing edits without a second model call", async () => {
    const text = "She don't like apples.";
    const snapshot = { text, map: identityMap(text) };
    let calls = 0;
    const result = await executeDeepScan({
      snapshot,
      chunks: [{ text, textStart: 0 }],
      modelKey: "quality",
      callModel: async () => {
        calls += 1;
        return JSON.stringify([
          {
            source: "She don't like apples",
            replacement: "She doesn't like apples",
            category: "grammar",
            explanation: "subject-verb agreement",
          },
        ]);
      },
      isCancelled: () => false,
      readCurrentText: () => text,
      onProgress: () => {},
      noteActivity: async () => {},
    });
    expect(calls).toBe(1);
    expect(result.status).toBe("complete");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].original).toBe("She don't like apples");
  });
});

