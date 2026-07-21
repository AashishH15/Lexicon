import { invoke } from "@tauri-apps/api/core";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : "http://127.0.0.1:18000");

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

async function ensureBackend() {
  if (isTauriRuntime()) {
    await invoke("ensure_backend");
  }
}

async function request(path, options) {
  await ensureBackend();
  try {
    return await fetch(`${API_URL}${path}`, options);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    // The idle monitor may have stopped the sidecar between the first
    // lifecycle check and the HTTP request. Start it once and retry.
    await ensureBackend();
    return fetch(`${API_URL}${path}`, options);
  }
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
    throw new Error(`Grammar check failed: ${response.status}`);
  }
  const data = await response.json();
  return data.matches;
}

// Probe which AI backend is active and what's available.
export async function getAiStatus() {
  const response = await request("/ai/status");
  if (!response.ok) {
    throw new Error(`AI status failed: ${response.status}`);
  }
  return response.json();
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
export async function setAiPreference(backend, modelKey = "2b") {
  const response = await request("/ai/preference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backend, model_key: modelKey }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Set AI preference failed: ${response.status}`);
  }
  return response.json();
}

// Trigger the bundled-model download (runs synchronously server-side).
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
  return response.json();
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
export async function cancelModelDownload() {
  const response = await request("/model/cancel", { method: "POST" });
  if (!response.ok) {
    throw new Error(`Model cancel failed: ${response.status}`);
  }
  return response.json();
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
  return response.json();
}

// Run an AI transform (Rewrite, Tone, Summary, …) via the backend.
export async function transformText({ prompt, text, modelKey, backend, signal }) {
  const response = await request("/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, text, model_key: modelKey, backend }),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Transform failed: ${response.status}`);
  }
  return response.json();
}
