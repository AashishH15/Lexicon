// Firefox manifest invariants. Runs the build and checks the staged dist.
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

test("manifest uses the Lexicon logo for extension and toolbar icons", () => {
  const expected = {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  };
  assert.deepEqual(firefox.icons, expected);
  assert.deepEqual(firefox.action.default_icon, expected);
  for (const file of Object.values(expected)) {
    assert.ok(existsSync(join(DIST_DIR, file)), `missing icon: ${file}`);
  }
});

test("gecko id present for AMO; Chrome-only `key` never ships", () => {
  assert.equal(firefox.browser_specific_settings.gecko.id, "lexicon@lexicon.app");
  // web-ext lint requires version 142 or higher.
  assert.ok(
    Number(firefox.browser_specific_settings.gecko.strict_min_version) >= 142,
  );
  assert.deepEqual(
    firefox.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] },
  );
  assert.equal("key" in firefox, false);
});

test("background is a module event page, not a service worker", () => {
  assert.ok(Array.isArray(firefox.background.scripts), "background.scripts required");
  assert.equal("service_worker" in firefox.background, false);
  assert.equal(firefox.background.type, "module");
});

test("shared background imports the polyfill (no importScripts in Firefox)", () => {
  const background = readFileSync(
    join(EXTENSION_DIR, "shared", "background.js"),
    "utf-8",
  );
  assert.ok(
    background.includes('import "./vendor/browser-polyfill.min.js"'),
    "background.js must import the polyfill as a module (Firefox event pages have no importScripts)",
  );
  assert.ok(
    !/importScripts\(/.test(background),
    "background.js must not use importScripts",
  );
});

test("polyfill loads before every script that uses browser.*", () => {
  // Content scripts load the polyfill first.
  // The background imports it as a module.
  for (const cs of firefox.content_scripts) {
    assert.equal(cs.js[0], "vendor/browser-polyfill.min.js");
  }
  const popup = readFileSync(join(EXTENSION_DIR, "shared", "popup.html"), "utf-8");
  const polyfillIndex = popup.indexOf("vendor/browser-polyfill.min.js");
  const popupIndex = popup.indexOf("popup.js");
  assert.ok(polyfillIndex !== -1 && polyfillIndex < popupIndex);
});

test("content-script scope, order, permissions, and commands match the Chrome build", () => {
  const chromeMatches = chrome.content_scripts.flatMap((cs) => cs.matches);
  const firefoxMatches = firefox.content_scripts.flatMap((cs) => cs.matches);
  assert.deepEqual(firefoxMatches.sort(), chromeMatches.sort());
  assert.deepEqual(
    firefox.content_scripts.flatMap((cs) => cs.js),
    chrome.content_scripts.flatMap((cs) => cs.js),
  );
  assert.deepEqual(firefox.permissions.sort(), chrome.permissions.sort());
  assert.deepEqual(firefox.optional_host_permissions, chrome.optional_host_permissions);
  assert.deepEqual(firefox.commands, chrome.commands);
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

test("store package carries Lexicon and third-party license notices", () => {
  for (const file of [
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "vendor/LICENSE-MPL-2.0.txt",
  ]) {
    assert.ok(existsSync(join(DIST_DIR, file)), `missing license notice: ${file}`);
  }
});
