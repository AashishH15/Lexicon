const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function checkGrammar(
  text,
  language = "en-US",
  ignore = [],
  signal,
) {
  const response = await fetch(`${API_URL}/grammar/check`, {
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
  const response = await fetch(`${API_URL}/ai/status`);
  if (!response.ok) {
    throw new Error(`AI status failed: ${response.status}`);
  }
  return response.json();
}

// Trigger the bundled-model download (runs synchronously server-side).
export async function downloadModel(modelKey = "2b") {
  const response = await fetch(`${API_URL}/model/download`, {
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
  const response = await fetch(`${API_URL}/model/status?key=${modelKey}`);
  if (!response.ok) {
    throw new Error(`Model status failed: ${response.status}`);
  }
  return response.json();
}

// Abort an in-flight download.
export async function cancelModelDownload() {
  const response = await fetch(`${API_URL}/model/cancel`, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Model cancel failed: ${response.status}`);
  }
  return response.json();
}

// Remove a downloaded model from disk.
export async function deleteModel(modelKey = "2b") {
  const response = await fetch(`${API_URL}/model/delete`, {
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
