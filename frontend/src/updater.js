import { invoke, Channel } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function updaterIsAvailable() {
  return isTauriRuntime() && !import.meta.env.DEV;
}

export async function checkForUpdate({ beta = false } = {}) {
  if (!updaterIsAvailable()) {
    return null;
  }
  return invoke("fetch_update", { beta });
}

export async function installUpdate(update, onProgress = () => {}) {
  let downloaded = 0;
  let total = 0;

  const channel = new Channel();
  channel.onmessage = (event) => {
    switch (event.event) {
      case "Started":
        total = event.data.contentLength || 0;
        onProgress({ phase: "downloading", downloaded: 0, total });
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        onProgress({ phase: "downloading", downloaded, total });
        break;
      case "Preparing":
        onProgress({ phase: "preparing", downloaded: total, total });
        break;
      case "Installing":
        onProgress({ phase: "installing", downloaded: total, total });
        break;
      default:
        break;
    }
  };

  // The Rust command downloads the update, stops the backend so its DLLs are
  // no longer locked, installs, and streams progress back through the channel.
  await invoke("install_update", { onEvent: channel });
  await relaunch();
}
