// Builds the Chrome extension (C48.2):
//   1. validates the manifest (required MV3 fields, semver version)
//   2. stages a clean dist/ containing only shipable files — the same
//      whitelist the Web Store zip needs, so nothing stray ever ships
//   3. packs dist/ into extension/dist/lexicon-chrome-<version>.zip
//
// The dev loop never needs this: Load unpacked points at extension/chrome
// directly. This exists for store packaging and CI.
//
// Usage: node build.mjs

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME_DIR = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(CHROME_DIR, "dist");
const OUT_DIR = join(CHROME_DIR, "..", "dist");

// Files that ship. Anything else in extension/chrome/ (build.mjs, etc.) is
// dev tooling and must never end up in the zip.
const SHIP_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "api.js",
  "prompts.js",
  "popup.html",
  "popup.css",
  "popup.js",
];

const REQUIRED_MANIFEST_FIELDS = [
  "manifest_version",
  "name",
  "version",
  "key",
  "action",
  "background",
  "content_scripts",
];

function readManifest() {
  const raw = readFileSync(join(CHROME_DIR, "manifest.json"), "utf-8");
  const manifest = JSON.parse(raw);
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in manifest)) {
      throw new Error(`manifest.json is missing required field: ${field}`);
    }
  }
  if (manifest.manifest_version !== 3) {
    throw new Error(`manifest_version must be 3, got ${manifest.manifest_version}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`version must be semver like 0.1.0, got "${manifest.version}"`);
  }
  return manifest;
}

function stageDist(manifest) {
  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(DIST_DIR, { recursive: true });
  for (const file of SHIP_FILES) {
    const src = join(CHROME_DIR, file);
    cpSync(src, join(DIST_DIR, file));
  }
}

function zipDist(version) {
  const zipPath = join(OUT_DIR, `lexicon-chrome-${version}.zip`);
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(zipPath, { force: true });

  // Prefer the `zip` CLI (preinstalled on GitHub Actions runners), fall back
  // to PowerShell's Compress-Archive for local Windows dev.
  const zip = spawnSync("zip", ["-r", "-q", zipPath, "."], {
    cwd: DIST_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (zip.status === 0) return zipPath;

  const pwsh = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${join(DIST_DIR, "*")}' -DestinationPath '${zipPath}' -Force`,
    ],
    { stdio: "inherit" },
  );
  if (pwsh.status === 0) return zipPath;

  throw new Error("Failed to create the zip: neither `zip` nor Compress-Archive worked");
}

const manifest = readManifest();
stageDist(manifest);
const zipPath = zipDist(manifest.version);
console.log(
  `Packed ${SHIP_FILES.length} files -> ${zipPath} (${manifest.name} ${manifest.version}, manifest v${manifest.manifest_version})`,
);
