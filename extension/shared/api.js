// Lexicon backend client. Ports: 18000 (app), 8000 (dev).

export const BACKEND_PORTS = [18000, 8000];

const PING_PATH = "/extension/ping";
const GRAMMAR_PATH = "/grammar/check";
const DICTIONARY_PATH = "/dictionary";
const DICTIONARY_ADD_PATH = "/dictionary/add";
const DICTIONARY_REMOVE_PATH = "/dictionary/remove";
const TRANSFORM_PATH = "/transform";
const PROBE_TIMEOUT_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;

let baseUrl = null;

export function getBackendBaseUrl() {
  return baseUrl;
}

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

export function buildDictionaryWordRequest(word) {
  return { word };
}

export function buildTransformRequest(prompt, text) {
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

async function fetchWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;
  const abort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abort, { once: true });
    }
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}

async function jsonRequest(path, options) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || data.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function discoverBackend() {
  for (const port of BACKEND_PORTS) {
    try {
      const response = await fetchWithTimeout(
        `http://127.0.0.1:${port}${PING_PATH}`,
        { cache: "no-store" },
        PROBE_TIMEOUT_MS,
      );
      if (!response.ok) continue;
      const body = await response.json();
      if (!isValidPing(body)) continue;
      baseUrl = `http://127.0.0.1:${port}`;
      return baseUrl;
    } catch {
      // Port not available.
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

export async function getDictionary() {
  if (!baseUrl) throw new Error("backend_unreachable");
  return jsonRequest(DICTIONARY_PATH, { cache: "no-store" });
}

export async function addDictionaryWord(word) {
  if (!baseUrl) throw new Error("backend_unreachable");
  return jsonRequest(DICTIONARY_ADD_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildDictionaryWordRequest(word)),
  });
}

export async function removeDictionaryWord(word) {
  if (!baseUrl) throw new Error("backend_unreachable");
  return jsonRequest(DICTIONARY_REMOVE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildDictionaryWordRequest(word)),
  });
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
