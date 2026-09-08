import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

// Tauri always talks to the sidecar on 18000 (dev and packaged). Browser Vite
// dev expects a separate uvicorn on 8000 — do not put other servers on that port.
function getApiUrl() {
  return (
    import.meta.env.VITE_API_URL ||
    (isTauriRuntime() || !import.meta.env.DEV
      ? "http://127.0.0.1:18000"
      : "http://127.0.0.1:8000")
  );
}

export async function ensureBackend() {
  if (isTauriRuntime()) {
    await invoke("ensure_backend");
  }
}

async function request(path, options) {
  await ensureBackend();
  const apiUrl = getApiUrl();
  try {
    return await fetch(`${apiUrl}${path}`, options);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    // The idle monitor may have stopped the sidecar between the first
    // lifecycle check and the HTTP request. Start it once and retry.
    await ensureBackend();
    return fetch(`${apiUrl}${path}`, options);
  }
}

async function dictionaryRequest(path, options) {
  const response = await request(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.detail || data.error || `Dictionary request failed: ${response.status}`,
    );
  }
  return response.json();
}

export async function getDictionary() {
  return dictionaryRequest("/dictionary", { cache: "no-store" });
}

export async function addDictionaryWord(word) {
  return dictionaryRequest("/dictionary/add", {
    method: "POST",
    body: JSON.stringify({ word }),
  });
}

export async function removeDictionaryWord(word) {
  return dictionaryRequest("/dictionary/remove", {
    method: "POST",
    body: JSON.stringify({ word }),
  });
}

export async function checkGrammar(
  text,
  language = "en-US",
  ignore = [],
  signal,
) {
  const response = await request("/grammar/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, ignore }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.detail || data.error || `Grammar check failed: ${response.status}`,
    );
  }
  const data = await response.json();
  return data.matches;
}

// Cache window for AI status probes. Probes hit local servers and
// hardware checks, so reuse fresh answers across quick callers.
// A minute covers reopen bursts. Mutations still clear it at once.
const AI_STATUS_TTL_MS = 60000;
let aiStatusCache = null; // { at, data } | null
let aiStatusInflight = null; // shared request | null

// Drop the cached AI status. Call it after a change that moves status.
export function invalidateAiStatus() {
  aiStatusCache = null;
}

// Probe which AI backend is active and what's available.
// Reuse a fresh answer. Share one request between quick callers.
// Pass { force: true } to skip the cache. Never keep a failed probe.
export async function getAiStatus({ force = false } = {}) {
  const now = Date.now();
  if (!force && aiStatusCache && now - aiStatusCache.at < AI_STATUS_TTL_MS) {
    return aiStatusCache.data;
  }
  if (!force && aiStatusInflight) {
    return aiStatusInflight;
  }
  const task = (async () => {
    const response = await request("/ai/status");
    if (!response.ok) {
      throw new Error(`AI status failed: ${response.status}`);
    }
    const data = await response.json();
    aiStatusCache = { at: Date.now(), data };
    return data;
  })();
  if (!force) {
    aiStatusInflight = task;
  }
  try {
    return await task;
  } finally {
    if (aiStatusInflight === task) {
      aiStatusInflight = null;
    }
  }
}

// Read the user's persisted backend preference.
export async function getAiPreference() {
  const response = await request("/ai/preference");
  if (!response.ok) {
    throw new Error(`AI preference failed: ${response.status}`);
  }
  return response.json();
}

// Persist the user's backend choice (survives restart, drives get_backend).
export async function setAiPreference(
  backend,
  modelKey = "2b",
  ollamaModel = "",
  lmstudioModel = "",
  lmstudioUrl = "",
  lmstudioApiKey = null,
  device = undefined,
) {
  const response = await request("/ai/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      backend,
      model_key: modelKey,
      ollama_model: ollamaModel,
      lmstudio_model: lmstudioModel,
      lmstudio_url: lmstudioUrl,
      lmstudio_api_key: lmstudioApiKey,
      device: device !== undefined ? device : undefined,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Set AI preference failed: ${response.status}`);
  }
  const saved = await response.json();
  invalidateAiStatus();
  return saved;
}

// Fetch detailed hardware profile (CPU, Memory, GPU, tier recommendations).
export async function getHardwareProfile() {
  const response = await request("/ai/hardware");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Get hardware profile failed: ${response.status}`);
  }
  return response.json();
}

// Persist GPU/CPU compute device and memory offload settings.
export async function setHardwareSettings({ device, limitVramOffload }) {
  const response = await request("/ai/hardware/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device,
      limit_vram_offload: limitVramOffload !== undefined ? limitVramOffload : undefined,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Set hardware settings failed: ${response.status}`);
  }
  const hardware = await response.json();
  invalidateAiStatus();
  return hardware;
}

// Trigger the local-model download (runs synchronously server-side).
export async function downloadModel(modelKey = "2b") {
  const response = await request("/model/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_key: modelKey }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Model download failed: ${response.status}`);
  }
  const started = await response.json();
  invalidateAiStatus();
  return started;
}

// Poll download progress for a specific model key.
export async function getModelStatus(modelKey = "2b") {
  const response = await request(`/model/status?key=${modelKey}`);
  if (!response.ok) {
    throw new Error(`Model status failed: ${response.status}`);
  }
  return response.json();
}

// Abort an in-flight download.
export async function cancelModelDownload(modelKey) {
  const body = modelKey ? JSON.stringify({ model_key: modelKey }) : undefined;
  const headers = modelKey ? { "Content-Type": "application/json" } : {};
  const response = await request("/model/cancel", {
    method: "POST",
    headers,
    body,
  });
  if (!response.ok) {
    throw new Error(`Model cancel failed: ${response.status}`);
  }
  const cancelled = await response.json();
  invalidateAiStatus();
  return cancelled;
}

// Remove a downloaded model from disk.
export async function deleteModel(modelKey = "2b") {
  const response = await request("/model/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_key: modelKey }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Model delete failed: ${response.status}`);
  }
  const deleted = await response.json();
  invalidateAiStatus();
  return deleted;
}

// Remove an obsolete previous-generation model file to reclaim disk space.
export async function cleanupLegacyModel(modelKey = "2b") {
  const response = await request("/model/cleanup-legacy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_key: modelKey }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Legacy cleanup failed: ${response.status}`);
  }
  const cleaned = await response.json();
  invalidateAiStatus();
  return cleaned;
}

// Open a URL in the default OS browser (Tauri) or a new tab (web fallback).
export async function openExternalUrl(url) {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    try {
      await openUrl(url);
      return;
    } catch {
      // plugin-opener not registered in Rust — fall through to web fallback
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

// Run an AI transform (Rewrite, Tone, Summary, …) via the backend.
export async function transformText({
  prompt,
  text,
  modelKey,
  backend,
  requestId,
  temperature,
  maxTokens,
  signal,
}) {
  const response = await request("/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      text,
      model_key: modelKey,
      backend,
      request_id: requestId || null,
      temperature: temperature != null ? temperature : undefined,
      max_tokens: maxTokens != null ? maxTokens : undefined,
    }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || data.detail || `Transform failed: ${response.status}`,
    );
  }
  return response.json();
}

// Ask the backend to close the active model request.
export async function cancelTransform(requestId) {
  if (!requestId) return { cancelled: false };
  const response = await request("/transform/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request_id: requestId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.error || data.detail || `Transform cancel failed: ${response.status}`,
    );
  }
  return response.json();
}
