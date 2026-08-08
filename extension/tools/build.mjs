// Shared build helpers for both platform build scripts.
// Files resolve from the platform dir first, then from shared/.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

export function readManifest(platformDir, requiredFields) {
  const manifest = JSON.parse(
    readFileSync(join(platformDir, "manifest.json"), "utf-8"),
  );
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      throw new Error(`manifest.json is missing required field: ${field}`);
    }
  }
  if (manifest.manifest_version !== 3) {
    throw new Error(
      `manifest_version must be 3, got ${manifest.manifest_version}`,
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(
      `version must be semver like 0.1.0, got "${manifest.version}"`,
    );
  }
  return manifest;
}

export function stageDist({ platformDir, sharedDir, distDir, files }) {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });
  for (const file of files) {
    const candidates = [join(platformDir, file), join(sharedDir, file)];
    const src = candidates.find((c) => existsSync(c));
    if (!src) {
      throw new Error(
        `ship file not found in ${platformDir} or ${sharedDir}: ${file}`,
      );
    }
    const dest = join(distDir, file);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
}

export function packArchive(distDir, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  rmSync(outPath, { force: true });

  // Prefer the zip CLI. Fall back to .NET ZipFile on Windows.
  const zip = spawnSync("zip", ["-r", "-q", outPath, "."], {
    cwd: distDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (zip.status === 0) return outPath;

  const pwsh = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${distDir}', '${outPath}')`,
    ],
    { stdio: "inherit" },
  );
  if (pwsh.status === 0) return outPath;

  throw new Error(
    "Failed to create the archive: neither `zip` nor ZipFile worked",
  );
}
