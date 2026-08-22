export const SETTINGS_STORAGE_KEY = "lexiconSettings";

export const DEFAULT_SETTINGS = Object.freeze({
  paused: false,
  disabledSites: [],
  userDictionary: [],
  dictionaryRevision: 0,
  pendingDictionaryOps: [],
  dictionaryMigrated: false,
});

export function normalizeSite(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(`https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function normalizeDictionaryWord(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDictionary(value) {
  const words = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const value of words) {
    const word = normalizeDictionaryWord(value);
    const key = word.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(word);
  }
  return normalized;
}

export function normalizeDictionaryRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

export function normalizeDictionaryOperations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (operation) =>
        (operation?.op === "add" || operation?.op === "remove") &&
        normalizeDictionaryWord(operation.word),
    )
    .map((operation) => ({
      op: operation.op,
      word: normalizeDictionaryWord(operation.word),
    }));
}

export function queueDictionaryOperation(queue, op, word) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord || !["add", "remove"].includes(op)) return queue;
  const key = normalizedWord.toLowerCase();
  return [
    ...normalizeDictionaryOperations(queue).filter(
      (operation) => operation.word.toLowerCase() !== key,
    ),
    { op, word: normalizedWord },
  ];
}

export function normalizeSettings(value) {
  const sites = Array.isArray(value?.disabledSites)
    ? value.disabledSites.map(normalizeSite).filter(Boolean)
    : [];
  return {
    paused: Boolean(value?.paused),
    disabledSites: [...new Set(sites)],
    userDictionary: normalizeDictionary(value?.userDictionary),
    dictionaryRevision: normalizeDictionaryRevision(value?.dictionaryRevision),
    pendingDictionaryOps: normalizeDictionaryOperations(
      value?.pendingDictionaryOps,
    ),
    dictionaryMigrated: value?.dictionaryMigrated === true,
  };
}

export function isSiteDisabled(settings, site) {
  const normalizedSite = normalizeSite(site);
  return (
    Boolean(normalizedSite) &&
    normalizeSettings(settings).disabledSites.includes(normalizedSite)
  );
}
