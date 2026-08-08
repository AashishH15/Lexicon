// Minimal client for Lexicon's local backend — the same request shapes the
// desktop app's frontend/src/api.js uses, so the extension and the app speak
// one contract (C48.2).
//
// Port discovery (C48.1): the packaged desktop app pins the sidecar to
// 18000, the standalone dev launcher to 8000. discoverBackend() probes both
// in order and remembers the working port for the session.

export const BACKEND_PORTS = [18000, 8000];

const PING_PATH = "/extension/ping";
const GRAMMAR_PATH = "/grammar/check";
const TRANSFORM_PATH = "/transform";

let baseUrl = null;

export function getBackendBaseUrl() {
  return baseUrl;
}

// The ping must prove this is Lexicon's backend, not something else that
// happens to answer on the port.
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
  // Matches the desktop app: model_key/backend are omitted so the backend
  // routes through whichever AI backend is active.
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

// Probes 18000 then 8000; the first reachable Lexicon backend wins for the
// session. Returns the base URL, or null when the desktop app isn't running.
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
      // Port not listening (or answered with garbage) — try the next one.
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
