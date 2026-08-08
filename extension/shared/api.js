// Client for the Lexicon backend.
// Ports: 18000 (packaged app), 8000 (dev launcher).
// The request shapes match the desktop app.

export const BACKEND_PORTS = [18000, 8000];

const PING_PATH = "/extension/ping";
const GRAMMAR_PATH = "/grammar/check";
const TRANSFORM_PATH = "/transform";

let baseUrl = null;

export function getBackendBaseUrl() {
  return baseUrl;
}

// Confirm that the backend is Lexicon's.
export function isValidPing(body) {
  return (
    body !== null &&
    typeof body === "object" &&
    body.ok === true &&
    body.app === "lexicon"
  );
}

export function buildGrammarRequest(text, language = "en-US", ignore = []) {
  return { text, language, ignore };
}

export function buildTransformRequest(prompt, text) {
  // The backend selects the model itself.
  return { prompt, text };
}

export function formatMatches(matches) {
  return (matches ?? []).map((m) => ({
    offset: m.offset,
    length: m.length,
    message: m.message,
    replacements: m.replacements ?? [],
    category: m.category ?? "",
  }));
}

async function jsonRequest(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

// Probe both ports. Return the first live backend, or null.
export async function discoverBackend() {
  for (const port of BACKEND_PORTS) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${PING_PATH}`, {
        cache: "no-store",
      });
      if (!response.ok) continue;
      const body = await response.json();
      if (!isValidPing(body)) continue;
      baseUrl = `http://127.0.0.1:${port}`;
      return baseUrl;
    } catch {
      // The port is closed. Try the next port.
    }
  }
  baseUrl = null;
  return null;
}

export async function checkGrammar(text, language = "en-US", ignore = []) {
  if (!baseUrl) throw new Error("backend_unreachable");
  const data = await jsonRequest(GRAMMAR_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGrammarRequest(text, language, ignore)),
  });
  return formatMatches(data.matches);
}

export async function transformText(prompt, text) {
  if (!baseUrl) throw new Error("backend_unreachable");
  const data = await jsonRequest(TRANSFORM_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildTransformRequest(prompt, text)),
  });
  return data.text;
}
