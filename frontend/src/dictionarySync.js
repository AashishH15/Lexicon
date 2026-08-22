export const DICTIONARY_CACHE_KEY = "lexicon:user_dictionary";
export const DICTIONARY_REVISION_KEY = "lexicon:user_dictionary_revision";
export const DICTIONARY_QUEUE_KEY = "lexicon:user_dictionary_queue";
export const DICTIONARY_MIGRATED_KEY = "lexicon:user_dictionary_migrated";

export function normalizeDictionaryWord(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDictionary(value) {
  const values = Array.isArray(value) ? value : [];
  const seen = new Set();
  const words = [];
  for (const value of values) {
    const word = normalizeDictionaryWord(value);
    const key = word.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

export function normalizeDictionaryRevision(value) {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

export function isDictionaryRevisionStale(candidate, current) {
  return (
    normalizeDictionaryRevision(candidate) <
    normalizeDictionaryRevision(current)
  );
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadDictionaryCache(storage = globalThis.localStorage) {
  return normalizeDictionary(readJson(storage, DICTIONARY_CACHE_KEY, []));
}

export function loadDictionaryRevision(storage = globalThis.localStorage) {
  try {
    return normalizeDictionaryRevision(
      storage.getItem(DICTIONARY_REVISION_KEY),
    );
  } catch {
    return 0;
  }
}

export function loadDictionaryQueue(storage = globalThis.localStorage) {
  const raw = readJson(storage, DICTIONARY_QUEUE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
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

export function loadDictionaryMigrationState(
  storage = globalThis.localStorage,
) {
  try {
    return storage.getItem(DICTIONARY_MIGRATED_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistDictionaryCache(
  words,
  revision,
  storage = globalThis.localStorage,
) {
  const normalizedWords = normalizeDictionary(words);
  try {
    storage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify(normalizedWords));
    storage.setItem(
      DICTIONARY_REVISION_KEY,
      String(normalizeDictionaryRevision(revision)),
    );
  } catch {
    // Keep the in-memory cache if browser storage is unavailable.
  }
  return normalizedWords;
}

export function persistDictionaryQueue(
  queue,
  storage = globalThis.localStorage,
) {
  try {
    storage.setItem(DICTIONARY_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // The operation remains in memory and can be retried in this session.
  }
}

export function persistDictionaryMigrationState(
  migrated,
  storage = globalThis.localStorage,
) {
  try {
    storage.setItem(DICTIONARY_MIGRATED_KEY, String(Boolean(migrated)));
  } catch {
    // The next successful sync will repeat the safe idempotent migration.
  }
}

export function queueDictionaryOperation(queue, op, word) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord || !["add", "remove"].includes(op)) return queue;
  const key = normalizedWord.toLowerCase();
  const pending = Array.isArray(queue) ? queue : [];
  return [
    ...pending.filter(
      (operation) =>
        normalizeDictionaryWord(operation?.word).toLowerCase() !== key,
    ),
    { op, word: normalizedWord },
  ];
}

export function applyDictionaryOperation(words, operation) {
  const current = normalizeDictionary(words);
  const word = normalizeDictionaryWord(operation?.word);
  if (!word) return current;
  const key = word.toLowerCase();
  if (operation?.op === "remove") {
    return current.filter((item) => item.toLowerCase() !== key);
  }
  if (operation?.op === "add" && !current.some((item) => item.toLowerCase() === key)) {
    return [...current, word];
  }
  return current;
}

export function dictionariesEqual(left, right) {
  const a = normalizeDictionary(left);
  const b = normalizeDictionary(right);
  return a.length === b.length && a.every((word, index) => word === b[index]);
}
