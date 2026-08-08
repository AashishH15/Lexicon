// Prompt parity with the desktop app (C48.2): the popup's Rewrite prompt must
// end with the same OUTPUT_RULES the desktop appends in frontend/src/prompts.js
// (promptForTool), so small local models don't drift toward preamble.
//
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { REWRITE_PROMPT } from "../shared/prompts.js";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DESKTOP_PROMPTS = readFileSync(
  join(REPO_ROOT, "frontend", "src", "prompts.js"),
  "utf-8",
);

const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

test("popup rewrite prompt appends the same OUTPUT_RULES as the desktop app", () => {
  assert.ok(REWRITE_PROMPT.endsWith(OUTPUT_RULES), "missing OUTPUT_RULES suffix");
  assert.ok(DESKTOP_PROMPTS.includes(OUTPUT_RULES), "desktop source changed its rules");
});

test("popup rewrite base instruction matches the desktop Rewrite tool", () => {
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  const base = normalize(REWRITE_PROMPT.slice(0, -OUTPUT_RULES.length));
  // Desktop builds the prompt from concatenated string literals between the
  // "Rewrite:" and "Concise:" keys — strip quotes/plus signs and compare
  // whitespace-normalized text so only real wording drift fails.
  const block = DESKTOP_PROMPTS.match(/Rewrite:\s*([\s\S]*?)Concise:/)?.[1];
  assert.ok(block, "desktop Rewrite prompt not found");
  // Drop the trailing ", JS separator by cutting at the last closing quote.
  const literals = block.slice(0, block.lastIndexOf('"'));
  const desktopRewrite = normalize(literals.replace(/["+]/g, " "));
  assert.equal(base, desktopRewrite);
});
