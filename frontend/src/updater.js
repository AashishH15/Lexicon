import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

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

export async function installUpdate(update, onProgress = () => { }) {
  let downloaded = 0;
  let total = 0;

  await update.download((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength || 0;
      onProgress({ phase: "downloading", downloaded: 0, total });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ phase: "downloading", downloaded, total });
    } else if (event.event === "Finished") {
      onProgress({ phase: "downloading", downloaded: total || downloaded, total });
    }
  });

  // The Windows installer replaces bundled backend/JRE files. Stop the
  // backend explicitly before installing so its DLLs are no longer locked.
  onProgress({ phase: "preparing", downloaded: total, total });
  await invoke("prepare_for_update");

  onProgress({ phase: "installing", downloaded: total, total });
  await update.install();
  await relaunch();
}
