import { fnv1a64 } from "./hashUtils.js";

const CACHE_VERSION = "grammar-cache-v2";

function normalizeDictionary(userDictionary) {
  if (!Array.isArray(userDictionary)) {
    return [];
  }
  return [...new Set(userDictionary.map((word) => String(word)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

/**
 * LRU Grammar Cache with structured context-window fingerprints.
 *
 * A cache entry is tied to the exact request text and the portion of that
 * request owned by the entry. This prevents full-document and windowed
 * results from sharing a key while avoiding delimiter-based collisions.
 */
export class GrammarCache {
  constructor(maxSize = 250) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  computeKey(
    fingerprint,
    previousSuffix = "",
    locale = "en-US",
    userDictionary = [],
  ) {
    if (
      fingerprint &&
      typeof fingerprint === "object" &&
      !Array.isArray(fingerprint)
    ) {
      const requestText = String(
        fingerprint.requestText ?? fingerprint.text ?? "",
      );
      const payload = {
        version: String(fingerprint.scanVersion || CACHE_VERSION),
        mode: String(fingerprint.scanMode || "window"),
        requestText,
        coreOffset: nonNegativeInteger(fingerprint.coreOffset),
        coreLength: nonNegativeInteger(
          fingerprint.coreLength,
          requestText.length,
        ),
        contextBefore: String(fingerprint.contextBefore || ""),
        contextAfter: String(fingerprint.contextAfter || ""),
        language: String(
          fingerprint.language ?? fingerprint.locale ?? "en-US",
        ),
        userDictionary: normalizeDictionary(fingerprint.userDictionary),
      };
      return fnv1a64(JSON.stringify(payload));
    }

    // Keep the old call shape usable for callers outside the current app
    // while still giving it a collision-safe structured fingerprint.
    const text = String(fingerprint ?? "");
    return this.computeKey({
      requestText: text,
      coreOffset: 0,
      coreLength: text.length,
      language: locale,
      userDictionary,
      scanVersion: CACHE_VERSION,
      scanMode: "legacy",
      contextBefore: String(previousSuffix || "").slice(-64),
    });
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    const val = this.cache.get(key);
    // Refresh position for LRU eviction
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key, matches) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, matches);
  }

  clear() {
    this.cache.clear();
  }
}

export const globalGrammarCache = new GrammarCache();
