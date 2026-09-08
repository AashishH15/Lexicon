// Checks prompt parity with the desktop app.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXPRESS_TOOL,
  REWRITE_PROMPT,
  getExpressPrompt,
  getTransformPrompt,
  TRANSFORM_TOOLS,
} from "../shared/prompts.js";

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
  // Compare whitespace-normalized text so only wording drift fails.
  const block = DESKTOP_PROMPTS.match(/Rewrite:\s*([\s\S]*?)Concise:/)?.[1];
  assert.ok(block, "desktop Rewrite prompt not found");
  // Drop the trailing ", JS separator by cutting at the last closing quote.
  const literals = block.slice(0, block.lastIndexOf('"'));
  const desktopRewrite = normalize(literals.replace(/["+]/g, " "));
  assert.equal(base, desktopRewrite);
});

test("every plain-text tool appends the same OUTPUT_RULES", () => {
  // Express answers in JSON with its own output rules. Skip it here.
  const plainTools = TRANSFORM_TOOLS.filter((tool) => tool !== EXPRESS_TOOL);
  assert.ok(plainTools.length > 0);
  for (const tool of plainTools) {
    const prompt = getTransformPrompt(tool);
    assert.ok(prompt.endsWith(OUTPUT_RULES), `missing OUTPUT_RULES for ${tool}`);
  }
});

test("Concise base instruction matches the desktop Concise tool", () => {
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  const base = normalize(
    getTransformPrompt("Concise").slice(0, -OUTPUT_RULES.length),
  );
  const block = DESKTOP_PROMPTS.match(/Concise:\s*([\s\S]*?)\n\s*\};/)?.[1];
  assert.ok(block, "desktop Concise prompt not found");
  const literals = block.slice(0, block.lastIndexOf('"'));
  assert.equal(base, normalize(literals.replace(/["+]/g, " ")));
});

// Extract the raw TONE_DESCRIPTORS block from a prompts.js source file.
function toneBlock(source) {
  return source.match(/const TONE_DESCRIPTORS = \{([\s\S]*?)\n\};/)?.[1];
}

// Desktop sources use CRLF on Windows; compare normalized text.
const normalizeEol = (s) => s.replace(/\r/g, "");

test("tone descriptors match the desktop source verbatim", () => {
  const extSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "prompts.js"),
    "utf-8",
  );
  const desktopBlock = toneBlock(DESKTOP_PROMPTS);
  assert.ok(desktopBlock, "desktop TONE_DESCRIPTORS block not found");
  assert.ok(
    normalizeEol(extSource).includes(normalizeEol(desktopBlock)),
    "extension tone descriptors drifted",
  );
});

test("tone prompts follow the desktop tone instruction template", () => {
  const normalize = (s) => s.replace(/\s+/g, " ").trim();
  const extSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "prompts.js"),
    "utf-8",
  );
  const template = (descriptor) =>
    `Rewrite the text below so it reads ${descriptor}. Preserve the ` +
    "original meaning, facts, and any names. Keep the same language and " +
    "the same paragraph breaks.";
  const toneNames = TRANSFORM_TOOLS.filter(
    (t) => t !== "Rewrite" && t !== "Concise" && t !== EXPRESS_TOOL,
  );
  for (const tone of toneNames) {
    const block = extSource.match(
      new RegExp(`^\\s*${tone}:\\s*([\\s\\S]*?)(?=\\n\\s*[A-Z]\\w*:|\\n\\s*\\};)`, "m"),
    )?.[1];
    assert.ok(block, `descriptor block not found for ${tone}`);
    const descriptor = (block.match(/"([^"]*)"/g) ?? [])
      .map((q) => q.slice(1, -1))
      .join("");
    const base = normalize(
      getTransformPrompt(tone).slice(0, -OUTPUT_RULES.length),
    );
    assert.equal(base, normalize(template(descriptor)), `${tone} template drifted`);
  }
});

test("Express in English is a transform tool with its own prompt", () => {
  assert.equal(EXPRESS_TOOL, "Express in English");
  assert.ok(TRANSFORM_TOOLS.includes(EXPRESS_TOOL));
  assert.equal(getTransformPrompt(EXPRESS_TOOL), getExpressPrompt());
});

test("Express prompt carries the exact JSON keys", () => {
  const prompt = getExpressPrompt();
  for (const key of [
    '"detectedLanguage"',
    '"tones"',
    '"professional"',
    '"casual"',
    '"friendly"',
    '"formal"',
    '"concise"',
  ]) {
    assert.ok(prompt.includes(key), `missing key ${key}`);
  }
  assert.ok(prompt.includes("Return ONLY one JSON object"));
  assert.ok(prompt.includes("Do not use em dashes or en dashes"));
  assert.ok(prompt.includes("idiomatic"));
});

test("Express prompt keys match the desktop template", () => {
  assert.ok(DESKTOP_PROMPTS.includes("getExpressPrompt"));
  assert.ok(DESKTOP_PROMPTS.includes('"detectedLanguage"'));
  for (const tone of ["professional", "casual", "friendly", "formal", "concise"]) {
    assert.ok(
      DESKTOP_PROMPTS.includes(`"${tone}"`),
      `desktop template missing ${tone}`,
    );
  }
});
