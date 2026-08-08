// Manifest invariants for the Chrome build (C48.2): MV3 shape, pinned ID,
// allowlist-scoped permissions, and no dangling file references.
//
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "chrome");
const manifest = JSON.parse(
  readFileSync(join(CHROME_DIR, "manifest.json"), "utf-8"),
);

// Mirrors extension/tools/extension_id.py: first 128 bits of SHA-256 over the
// key's SPKI DER, each nibble rendered a-p.
function extensionIdFromKey(spkiB64) {
  const digest = createHash("sha256").update(Buffer.from(spkiB64, "base64")).digest();
  const alphabet = "abcdefghijklmnop";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += alphabet[(digest[i] >> 4) & 0xf] + alphabet[digest[i] & 0xf];
  }
  return id;
}

const ALLOWLIST_PATTERNS = [
  "https://mail.google.com/*",
  "https://*.slack.com/*",
  "https://discord.com/*",
];

test("manifest is MV3 with semver version and pinned key", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof manifest.key, "string");
  assert.ok(manifest.key.length > 0);
});

test("pinned extension ID still matches the key in the manifest", () => {
  // C48.1 pins this ID in backend/main.py — if this test fails, the CORS
  // allowlist and the loaded extension are out of sync.
  assert.equal(
    extensionIdFromKey(manifest.key),
    "egcfmlgpcidpanppnampkkdknogccpjg",
  );
});

test("popup and background are wired", () => {
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.background.service_worker, "background.js");
});

test("content scripts are scoped to the C48.4 allowlist only", () => {
  const matches = manifest.content_scripts.flatMap((cs) => cs.matches);
  assert.deepEqual(matches, ALLOWLIST_PATTERNS);
  for (const pattern of matches) {
    assert.ok(pattern.startsWith("https://"), `non-https match pattern: ${pattern}`);
    assert.ok(!pattern.includes("all_urls"), "all_urls must never ship");
  }
});

test("required permissions stay minimal; everything else is optional", () => {
  assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting"]);
  assert.equal("host_permissions" in manifest, false, "no required host permissions");
  assert.deepEqual(manifest.optional_host_permissions, ["http://*/*", "https://*/*"]);
});

test("every referenced file exists (no dangling refs)", () => {
  const referenced = [
    manifest.action.default_popup,
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((cs) => cs.js),
  ];
  for (const file of referenced) {
    assert.ok(existsSync(join(CHROME_DIR, file)), `missing referenced file: ${file}`);
  }
  // The popup's module imports api.js and popup.js — the build whitelist
  // must include every one of them or the store zip breaks.
  const popupSource = readFileSync(join(CHROME_DIR, "popup.html"), "utf-8");
  const imports = [...popupSource.matchAll(/src="([^"]+)"/g)].map((m) => m[1]);
  // Static imports of the popup module itself (e.g. prompts.js) ship too.
  const popupModule = readFileSync(join(CHROME_DIR, "popup.js"), "utf-8");
  for (const m of popupModule.matchAll(/from "\.\/([^"]+)"/g)) {
    imports.push(m[1]);
  }
  for (const src of imports) {
    assert.ok(existsSync(join(CHROME_DIR, src)), `missing popup asset: ${src}`);
  }
  const shipList = readFileSync(join(CHROME_DIR, "build.mjs"), "utf-8");
  for (const src of imports) {
    assert.ok(shipList.includes(`"${src}"`), `build.mjs whitelist misses popup asset: ${src}`);
  }
});
