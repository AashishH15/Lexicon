// Checks for extension Deep Proofread helpers.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEEP_MAX_CHUNKS,
  DEEP_PROOFREAD_TOOL,
  DEEP_RULE_ID,
  dedupeDeepMatches,
  deepEditsToMatches,
  getDeepProofreadPrompt,
  parseDeepEdits,
  shouldOfferDeep,
  splitDeepChunks,
  validateDeepEdits,
} from "../shared/deepProofread.js";

test("names the tool and rule like the desktop app", () => {
  assert.equal(DEEP_PROOFREAD_TOOL, "Deep Proofread");
  assert.equal(DEEP_RULE_ID, "LEXICON_DEEP");
});

test("selects the few-shot prompt for small tiers", () => {
  const small = getDeepProofreadPrompt("2b");
  assert.match(small, /capable to handle/);
  const large = getDeepProofreadPrompt("quality");
  assert.doesNotMatch(large, /Examples:/);
});

test("parses a JSON array and strips fences", () => {
  const edits = parseDeepEdits(
    '```json\n[{"source": "capable to handle", "replacement": "capable of handling"}]\n```',
  );
  assert.deepEqual(edits, [
    { source: "capable to handle", replacement: "capable of handling" },
  ]);
});

test("rejects unusable model output", () => {
  assert.throws(() => parseDeepEdits("not json"), /deep-proofread-unusable/);
  assert.throws(() => parseDeepEdits('{"source": "x"}'), /deep-proofread-unusable/);
});

test("splits long text into bounded sentence chunks", () => {
  const sentence = "The results confirmed our initial hypothesis. ";
  const text = sentence.repeat(200);
  const chunks = splitDeepChunks(text);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.length <= DEEP_MAX_CHUNKS);
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= 2400);
    assert.equal(text.slice(chunk.start, chunk.end), chunk.text);
  }
  assert.equal(chunks[0].start, 0);
});

test("keeps short text in one chunk", () => {
  const chunks = splitDeepChunks("She is capable to handle the project.");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].start, 0);
});

test("validates edits against the chunk text", () => {
  const text = "She is capable to handle the project today.";
  const { edits, rejectedWhole } = validateDeepEdits(text, [
    { source: "capable to handle", replacement: "capable of handling" },
    { source: "missing phrase here", replacement: "other words here" },
    { source: "capable to handle", replacement: "capable to handle" },
  ]);
  assert.equal(rejectedWhole, null);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].source, "capable to handle");
});

test("rejects an over-rewritten chunk", () => {
  const first = "Alfa bravo charlie delta echo foxtrot golf hotel india juliet kilo lima";
  const second = "Mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray";
  const text = `${first}. ${second}. Yankee zulu one two.`;
  const { edits, rejectedWhole } = validateDeepEdits(text, [
    { source: first, replacement: `${first} rewritten again here` },
    { source: second, replacement: `${second} rewritten again here` },
  ]);
  assert.equal(rejectedWhole, "over-rewritten");
  assert.deepEqual(edits, []);
});

test("converts edits to clarity matches with absolute offsets", () => {
  const { matches, nextId } = deepEditsToMatches({
    edits: [{ index: 7, end: 24, source: "capable to handle", replacement: "capable of handling" }],
    chunkStart: 100,
    startId: 3,
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].offset, 107);
  assert.equal(matches[0].length, 17);
  assert.deepEqual(matches[0].replacements, ["capable of handling"]);
  assert.equal(matches[0].rule.id, DEEP_RULE_ID);
  assert.equal(matches[0].deep, true);
  assert.equal(nextId, 4);
});

test("drops deep matches covered by grammar matches", () => {
  const deep = [
    { offset: 10, length: 5, message: "Deep proofread suggestion." },
    { offset: 40, length: 5, message: "Deep proofread suggestion." },
  ];
  const base = [{ offset: 8, length: 10 }];
  const kept = dedupeDeepMatches(deep, base);
  assert.deepEqual(kept.map((match) => match.offset), [40]);
});

test("offers deep on every empty result, auto only after an apply", () => {
  assert.equal(
    shouldOfferDeep({ empty: false, hadApply: true, hadDismiss: false, autoEnabled: true }),
    "none",
  );
  assert.equal(
    shouldOfferDeep({ empty: true, hadApply: true, hadDismiss: false, autoEnabled: true }),
    "auto",
  );
  assert.equal(
    shouldOfferDeep({ empty: true, hadApply: true, hadDismiss: false, autoEnabled: false }),
    "invite",
  );
  assert.equal(
    shouldOfferDeep({ empty: true, hadApply: false, hadDismiss: true, autoEnabled: true }),
    "invite",
  );
  assert.equal(
    shouldOfferDeep({ empty: true, hadApply: false, hadDismiss: false, autoEnabled: false }),
    "invite",
  );
});
