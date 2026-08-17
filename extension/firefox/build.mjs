// Builds the Firefox extension.
// 1. Validate the manifest.
// 2. Stage dist/ with only the ship files.
// 3. Pack dist/ into extension/dist/lexicon-firefox-<version>.xpi.
// The xpi is unsigned. AMO signs it on submission.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packArchive, readManifest, stageDist } from "../tools/build.mjs";

const FIREFOX_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(FIREFOX_DIR, "..", "shared");
const REPO_ROOT = join(FIREFOX_DIR, "..", "..");
const DIST_DIR = join(FIREFOX_DIR, "dist");
const OUT_DIR = join(FIREFOX_DIR, "..", "dist");

const SHIP_FILES = [
  "manifest.json",
  "vendor/browser-polyfill.min.js",
  "background.js",
  "detectEditable.js",
  "squiggle.js",
  "suggestions.js",
  "content.js",
  "api.js",
  "backendStatus.js",
  "prompts.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "vendor/LICENSE-MPL-2.0.txt",
];

const manifest = readManifest(FIREFOX_DIR, [
  "manifest_version",
  "name",
  "version",
  "browser_specific_settings",
  "action",
  "background",
  "content_scripts",
]);

const geckoId = manifest.browser_specific_settings?.gecko?.id;
if (!geckoId) {
  throw new Error("browser_specific_settings.gecko.id is required for AMO");
}
if ("key" in manifest) {
  throw new Error("the Chrome-only `key` field must not ship to AMO");
}

stageDist({
  platformDir: FIREFOX_DIR,
  sharedDir: SHARED_DIR,
  distDir: DIST_DIR,
  files: SHIP_FILES,
  additionalDirs: [REPO_ROOT],
});

const archivePath = packArchive(
  DIST_DIR,
  join(OUT_DIR, `lexicon-firefox-${manifest.version}.xpi`),
);
console.log(
  `Packed ${SHIP_FILES.length} files -> ${archivePath} (${manifest.name} ${manifest.version}, manifest v${manifest.manifest_version})`,
);
