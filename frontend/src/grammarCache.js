import { fnv1a64 } from "./hashUtils.js";

/**
 * LRU Grammar Cache with Context-Aware Predecessor Keys.
 * Key formula: XXH64(prev_suffix_64 + "::" + paragraph_text + "::" + locale + "::" + dict_str)
 */
export class GrammarCache {
  constructor(maxSize = 250) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  computeKey(text, prevSuffix = "", locale = "en-US", userDictionary = []) {
    const dictStr = Array.isArray(userDictionary) ? userDictionary.join(",") : "";
    const suffixSlice = (prevSuffix || "").slice(-64);
    const payload = `${suffixSlice}::${text}::${locale}::${dictStr}`;
    return fnv1a64(payload);
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
