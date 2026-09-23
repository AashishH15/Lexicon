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

test("settings controls are not blocked by backend connection state", () => {
  assert.ok(!source.includes('monitorState === "connected" && aiStatusSettled'));
  assert.ok(source.includes("const controlsReady = settingsLoaded;"));
});

test("popup.js imported modules provide all requested named exports", async () => {
  const sharedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "shared");
  const importRegex = /import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/g;
  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const rawImports = match[1];
    const specifier = match[2];
    const targetModule = await import(new URL(specifier, `file://${join(sharedDir, "popup.js").replace(/\\/g, "/")}`).href);
    const importedNames = rawImports
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    for (const name of importedNames) {
      assert.ok(
        name in targetModule,
        `popup.js imports '${name}' from '${specifier}', but '${specifier}' does not export it`,
      );
    }
  }
});

