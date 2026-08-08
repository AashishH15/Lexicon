// Firefox manifest invariants (C48.3): genuinely different from Chrome —
// event-page background (not a service worker), gecko id for AMO, no
// Chrome-only `key` field — while content-script scope and permissions stay
// in lockstep with the Chrome build. Runs the build first and validates the
// staged dist.
//
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const EXTENSION_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIREFOX_DIR = join(EXTENSION_DIR, "firefox");
const DIST_DIR = join(FIREFOX_DIR, "dist");

const build = spawnSync("node", ["build.mjs"], { cwd: FIREFOX_DIR });
assert.equal(build.status, 0, "firefox build.mjs failed:\n" + build.stderr);

const firefox = JSON.parse(
  readFileSync(join(FIREFOX_DIR, "manifest.json"), "utf-8"),
);
const chrome = JSON.parse(
  readFileSync(join(EXTENSION_DIR, "chrome", "manifest.json"), "utf-8"),
);

test("firefox manifest is MV3 with semver version", () => {
  assert.equal(firefox.manifest_version, 3);
  assert.match(firefox.version, /^\d+\.\d+\.\d+$/);
  assert.equal(firefox.version, chrome.version, "versions must stay in sync");
});

test("gecko id present for AMO; Chrome-only `key` never ships", () => {
  assert.equal(firefox.browser_specific_settings.gecko.id, "lexicon@lexicon.app");
  // web-ext lint requires >= 142 (Android) for data_collection_permissions.
  assert.ok(
    Number(firefox.browser_specific_settings.gecko.strict_min_version) >= 142,
  );
  assert.deepEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] },
  );
  assert.equal("key" in firefox, false);
});

test("background is an event page, not a service worker", () => {
  assert.ok(Array.isArray(firefox.background.scripts), "background.scripts required");
  assert.equal("service_worker" in firefox.background, false);
});

test("shared background guards importScripts (event pages lack it)", () => {
  const background = readFileSync(
    join(EXTENSION_DIR, "shared", "background.js"),
    "utf-8",
  );
  assert.ok(
    /typeof importScripts === "function"/.test(background),
    "background.js must guard importScripts for Firefox event pages",
  );
});

test("polyfill loads before every script that uses browser.*", () => {
  for (const script of firefox.background.scripts.slice(1)) {
    assert.ok(script.endsWith(".js"));
  }
  assert.equal(firefox.background.scripts[0], "vendor/browser-polyfill.min.js");
  for (const cs of firefox.content_scripts) {
    assert.equal(cs.js[0], "vendor/browser-polyfill.min.js");
  }
  const popup = readFileSync(join(EXTENSION_DIR, "shared", "popup.html"), "utf-8");
  const polyfillIndex = popup.indexOf("vendor/browser-polyfill.min.js");
  const popupIndex = popup.indexOf("popup.js");
  assert.ok(polyfillIndex !== -1 && polyfillIndex < popupIndex);
});

test("content-script allowlist and permissions match the Chrome build", () => {
  const chromeMatches = chrome.content_scripts.flatMap((cs) => cs.matches);
  const firefoxMatches = firefox.content_scripts.flatMap((cs) => cs.matches);
  assert.deepEqual(firefoxMatches.sort(), chromeMatches.sort());
  assert.deepEqual(firefox.permissions.sort(), chrome.permissions.sort());
  assert.deepEqual(firefox.optional_host_permissions, chrome.optional_host_permissions);
});

test("every referenced file exists in the staged dist", () => {
  const referenced = [
    firefox.action.default_popup,
    ...firefox.background.scripts,
    ...firefox.content_scripts.flatMap((cs) => cs.js),
  ];
  for (const file of referenced) {
    assert.ok(existsSync(join(DIST_DIR, file)), `missing dist file: ${file}`);
  }
});

test("xpi exists for AMO submission", () => {
  const xpiPath = join(EXTENSION_DIR, "dist", `lexicon-firefox-${firefox.version}.xpi`);
  assert.ok(existsSync(xpiPath), "firefox xpi was not produced");
});
