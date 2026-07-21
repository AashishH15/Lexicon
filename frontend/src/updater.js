import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function updaterIsAvailable() {
  return isTauriRuntime() && !import.meta.env.DEV;
}

export async function checkForUpdate() {
  if (!updaterIsAvailable()) {
    return null;
  }
  return check({ timeout: 8000 });
}

export async function installUpdate(update, onProgress = () => {}) {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength || 0;
      onProgress({ downloaded: 0, total });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ downloaded, total });
    } else if (event.event === "Finished") {
      onProgress({ downloaded: total || downloaded, total });
    }
  });

  await relaunch();
}
