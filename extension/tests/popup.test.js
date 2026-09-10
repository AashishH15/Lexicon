// Source checks for popup UI details that have no DOM harness.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "popup.js"),
  "utf-8",
);

test("dictionary remove uses the Phosphor trash icon", () => {
  assert.ok(source.includes("M216,48H40"));
  assert.ok(!source.includes('remove.textContent = "Remove"'));
});

test("dictionary remove keeps its accessible name", () => {
  assert.ok(source.includes("from dictionary"));
});
