// Builds the Chrome extension.
// 1. Validate the manifest.
// 2. Stage dist/ with only the ship files.
// 3. Pack dist/ into extension/dist/lexicon-chrome-<version>.zip.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packArchive, readManifest, stageDist } from "../tools/build.mjs";

const CHROME_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(CHROME_DIR, "..", "shared");
const REPO_ROOT = join(CHROME_DIR, "..", "..");
const DIST_DIR = join(CHROME_DIR, "dist");
const OUT_DIR = join(CHROME_DIR, "..", "dist");

// Only these files ship. Resolve from the platform dir first, then shared/.
const SHIP_FILES = [
  "manifest.json",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
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
  additionalDirs: [REPO_ROOT],
});

const archivePath = packArchive(
  DIST_DIR,
  join(OUT_DIR, `lexicon-chrome-${manifest.version}.zip`),
);
console.log(
  `Packed ${SHIP_FILES.length} files -> ${archivePath} (${manifest.name} ${manifest.version}, manifest v${manifest.manifest_version})`,
);
