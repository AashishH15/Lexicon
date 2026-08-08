// Builds the Chrome extension (C48.2):
//   1. validates the manifest (required MV3 fields, semver version)
//   2. stages a clean dist/ containing only shipable files — the same
//      whitelist the Web Store zip needs, so nothing stray ever ships
//   3. packs dist/ into extension/dist/lexicon-chrome-<version>.zip
//
// Dev loop: run this once, then Load unpacked points at extension/chrome/dist.
// The manifest and the vendored polyfill ship from this dir and shared/.
//
// Usage: node build.mjs

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packArchive, readManifest, stageDist } from "../tools/build.mjs";

const CHROME_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(CHROME_DIR, "..", "shared");
const DIST_DIR = join(CHROME_DIR, "dist");
const OUT_DIR = join(CHROME_DIR, "..", "dist");

// Files that ship. Anything else (build.mjs, etc.) is dev tooling and must
// never end up in the zip. Resolved platform-first, then from shared/.
const SHIP_FILES = [
  "manifest.json",
  "vendor/browser-polyfill.min.js",
  "background.js",
  "detectEditable.js",
  "squiggle.js",
  "content.js",
  "api.js",
  "prompts.js",
  "popup.html",
  "popup.css",
  "popup.js",
];

const manifest = readManifest(CHROME_DIR, [
  "manifest_version",
  "name",
  "version",
  "key",
  "action",
  "background",
  "content_scripts",
]);

stageDist({
  platformDir: CHROME_DIR,
  sharedDir: SHARED_DIR,
  distDir: DIST_DIR,
  files: SHIP_FILES,
});

const archivePath = packArchive(
  DIST_DIR,
  join(OUT_DIR, `lexicon-chrome-${manifest.version}.zip`),
);
console.log(
  `Packed ${SHIP_FILES.length} files -> ${archivePath} (${manifest.name} ${manifest.version}, manifest v${manifest.manifest_version})`,
);
