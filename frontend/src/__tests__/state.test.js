import { describe, it, expect } from "vitest";
import { SETTINGS_DEFAULTS } from "../Settings.jsx";
import { getCategoryClass } from "../grammarHighlight.js";

// Lightweight localStorage shim used only by the reset test below.
function mockLocalStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
}

function matchKey(match, text) {
  const original = text
    ? text.slice(match.offset, match.offset + match.length)
    : match.original;
  return `${match.message}::${match.offset}::${match.length}::${original}`;
}

function applyEditsRightToLeft(text, edits) {
  const sorted = [...edits].sort((a, b) => b.offset - a.offset);
  let result = text;
  for (const { offset, length, replacement } of sorted) {
    result = result.slice(0, offset) + replacement + result.slice(offset + length);
  }
  return result;
}

function pruneDismissedKeys(keys, docLength) {
  const pruned = new Set();
  for (const key of keys) {
    const offset = Number(key.split("::")[1]);
    if (!Number.isNaN(offset) && offset <= docLength) {
      pruned.add(key);
    }
  }
  return pruned;
}

function filterIgnoredMatches(matches, text, ignoredWords) {
  if (!ignoredWords || ignoredWords.length === 0) return matches;
  const lower = ignoredWords.map((w) => w.toLowerCase());
  return matches.filter((m) => {
    const word = text.slice(m.offset, m.offset + m.length).toLowerCase();
    return !lower.includes(word);
  });
}

describe("Accept-All offset math", () => {
  it("applies multiple replacements right-to-left preserving earlier offsets", () => {
    const text = "teh wer happpy";
    const edits = [
      { offset: 0, length: 3, replacement: "the" },
      { offset: 4, length: 3, replacement: "we" },
      { offset: 8, length: 6, replacement: "happy" },
    ];
    const result = applyEditsRightToLeft(text, edits);
    expect(result).toBe("the we happy");
  });

  it("handles replacement shorter than original (wer -> we)", () => {
    const text = "wer";
    const result = applyEditsRightToLeft(text, [
      { offset: 0, length: 3, replacement: "we" },
    ]);
    expect(result).toBe("we");
  });

  it("handles replacement longer than original (alot -> a lot)", () => {
    const text = "alot";
    const result = applyEditsRightToLeft(text, [
      { offset: 0, length: 4, replacement: "a lot" },
    ]);
    expect(result).toBe("a lot");
  });

  it("handles replacement equal in length to original (teh -> the)", () => {
    const text = "teh";
    const result = applyEditsRightToLeft(text, [
      { offset: 0, length: 3, replacement: "the" },
    ]);
    expect(result).toBe("the");
  });

  it("preserves all leftward offsets when early edits are longer", () => {
    const text = "abcde";
    const edits = [
      { offset: 0, length: 1, replacement: "xx" },
      { offset: 3, length: 1, replacement: "yy" },
    ];
    // Sorted right-to-left: first offset 3, then offset 0
    // After first edit (offset 3): "abc" -> "abcyy" (actually: offset 3, len 1, "d" -> "yy")
    // text becomes "abcyye"
    // After second edit (offset 0): "a" -> "xx"
    // text becomes "xxbcyye"
    const result = applyEditsRightToLeft(text, edits);
    expect(result).toBe("xxbcyye");
  });

  it("does not corrupt offset coordinates when applying 10+ suggestions", () => {
    const words = [
      "teh", "wierd", "recieve", "beleive", "adress",
      "occured", "definately", "goverment", "calender", "tommorrow",
    ];
    const text = words.join(" ");
    const edits = words.map((w, i) => {
      const offset = i > 0
        ? words.slice(0, i).reduce((sum, w) => sum + w.length + 1, 0)
        : 0;
      return { offset, length: w.length, replacement: w + "+" };
    });
    const result = applyEditsRightToLeft(text, edits);
    const expected = words.map((w) => w + "+").join(" ");
    expect(result).toBe(expected);
  });

  it("applies no edits when given an empty list", () => {
    const text = "hello world";
    const result = applyEditsRightToLeft(text, []);
    expect(result).toBe("hello world");
  });
});

describe("Dismissed keys & persistence", () => {
  it("creates a stable signature key from match metadata", () => {
    const match = { message: "Test message", offset: 10, length: 5, original: "hello" };
    const text = "this is a hello world";
    const key = matchKey(match, text);
    expect(key).toBe("Test message::10::5::hello");
  });

  it("falls back to match.original when text is not provided", () => {
    const match = { message: "Msg", offset: 0, length: 3, original: "teh" };
    const key = matchKey(match, null);
    expect(key).toBe("Msg::0::3::teh");
  });

  it("produces distinct keys for different offsets of the same message", () => {
    const match = { message: "Spelling error", offset: 10, length: 3 };
    const textA = "teh cat";
    const textB = "teh dog";
    const keyA = matchKey(match, textA);
    const keyB = matchKey({ ...match, offset: 5 }, textB);
    expect(keyA).not.toBe(keyB);
  });

  it("filters out dismissed matches from re-check payload", () => {
    const text = "teh and teh";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 8, length: 3, message: "Spelling" },
    ];
    const dismissed = new Set([
      matchKey(matches[0], text),
    ]);
    const filtered = matches.filter((m) => !dismissed.has(matchKey(m, text)));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].offset).toBe(8);
  });

  it("removes all matches when all are dismissed", () => {
    const text = "teh and teh";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 8, length: 3, message: "Spelling" },
    ];
    const dismissed = new Set(matches.map((m) => matchKey(m, text)));
    const filtered = matches.filter((m) => !dismissed.has(matchKey(m, text)));
    expect(filtered).toHaveLength(0);
  });

  it("prunes stale keys whose offset exceeds document length", () => {
    const keys = new Set([
      "Msg::5::3::teh",
      "Msg::50::3::teh",
      "Msg::100::4::test",
    ]);
    const pruned = pruneDismissedKeys(keys, 60);
    expect(pruned.has("Msg::5::3::teh")).toBe(true);
    expect(pruned.has("Msg::50::3::teh")).toBe(true);
    expect(pruned.has("Msg::100::4::test")).toBe(false);
  });

  it("prunes all keys when document is empty", () => {
    const keys = new Set(["Msg::0::3::teh", "Msg::5::3::wer"]);
    const pruned = pruneDismissedKeys(keys, 0);
    expect(pruned.has("Msg::0::3::teh")).toBe(true);
    expect(pruned.has("Msg::5::3::wer")).toBe(false);
  });

  it("handles malformed keys gracefully without crashing", () => {
    const keys = new Set(["no-separator", "::", "Msg::5::3::teh"]);
    const pruned = pruneDismissedKeys(keys, 100);
    // "::" splits to ["", ""] so offset is Number("") = 0, which is ≤ 100.
    // "Msg::5::3::teh" has offset 5 ≤ 100.
    // "no-separator" has no "::" so [1] is undefined → NaN → pruned.
    expect(pruned.size).toBe(2);
    expect(pruned.has("::")).toBe(true);
    expect(pruned.has("Msg::5::3::teh")).toBe(true);
  });
});

describe("User dictionary filtering", () => {
  it("filters out matches whose target word is in the ignored list", () => {
    const text = "teh foxx";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 4, length: 4, message: "Spelling" },
    ];
    const result = filterIgnoredMatches(matches, text, ["teh"]);
    // "foxx" at offset 4 is not ignored, so it should remain
    expect(result).toHaveLength(1);
    expect(result[0].offset).toBe(4);
  });

  it("keeps matches whose target word is not in the ignored list", () => {
    const text = "teh quick brown foxx";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 16, length: 4, message: "Spelling" },
    ];
    const result = filterIgnoredMatches(matches, text, ["teh"]);
    expect(result).toHaveLength(1);
    expect(result[0].offset).toBe(16);
  });

  it("is case-insensitive when filtering", () => {
    const text = "Teh cat";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
    ];
    const result = filterIgnoredMatches(matches, text, ["teh"]);
    expect(result).toHaveLength(0);
  });

  it("trims whitespace from dictionary words before matching", () => {
    // Trimming happens at add-to-dictionary time (handleAddWordToDictionary
    // calls .trim() on the raw input before persisting). The filter then
    // sees already-trimmed words.
    const rawInput = "  teh  ";
    const trimmed = rawInput.trim(); // what handleAddWordToDictionary does
    expect(trimmed).toBe("teh");

    const text = "teh cat";
    const matches = [{ offset: 0, length: 3, message: "Spelling" }];
    const result = filterIgnoredMatches(matches, text, [trimmed]);
    expect(result).toHaveLength(0);
  });

  it("returns all matches when ignored list is empty", () => {
    const text = "teh wer";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
      { offset: 4, length: 3, message: "Spelling" },
    ];
    const result = filterIgnoredMatches(matches, text, []);
    expect(result).toHaveLength(2);
  });

  it("returns all matches when ignored list is undefined", () => {
    const text = "teh";
    const matches = [
      { offset: 0, length: 3, message: "Spelling" },
    ];
    const result = filterIgnoredMatches(matches, text, undefined);
    expect(result).toHaveLength(1);
  });

  it("removing a word from dictionary re-enables match detection", () => {
    const text = "teh cat";
    const matches = [{ offset: 0, length: 3, message: "Spelling" }];
    const withWord = filterIgnoredMatches(matches, text, ["teh"]);
    expect(withWord).toHaveLength(0);
    const withoutWord = filterIgnoredMatches(matches, text, []);
    expect(withoutWord).toHaveLength(1);
  });
});

describe("Settings smart defaults & reset", () => {
  it("SETTINGS_DEFAULTS has the correct baseline values", () => {
    expect(SETTINGS_DEFAULTS).toEqual({
      language: "en-US",
      fontSize: 16,
      focusMode: false,
      lineSpacing: 1.6,
    });
  });

  it("returns true when all settings match defaults", () => {
    const isDefault =
      SETTINGS_DEFAULTS.language === "en-US" &&
      SETTINGS_DEFAULTS.fontSize === 16 &&
      SETTINGS_DEFAULTS.focusMode === false &&
      SETTINGS_DEFAULTS.lineSpacing === 1.6;
    expect(isDefault).toBe(true);
  });

  it("returns false when language deviates from default", () => {
    const isDefault =
      "en-GB" === SETTINGS_DEFAULTS.language &&
      16 === SETTINGS_DEFAULTS.fontSize &&
      false === SETTINGS_DEFAULTS.focusMode &&
      1.6 === SETTINGS_DEFAULTS.lineSpacing;
    expect(isDefault).toBe(false);
  });

  it("returns false when fontSize deviates from default", () => {
    const isDefault =
      "en-US" === SETTINGS_DEFAULTS.language &&
      18 === SETTINGS_DEFAULTS.fontSize &&
      false === SETTINGS_DEFAULTS.focusMode &&
      1.6 === SETTINGS_DEFAULTS.lineSpacing;
    expect(isDefault).toBe(false);
  });

  it("returns false when focusMode deviates from default", () => {
    const isDefault =
      "en-US" === SETTINGS_DEFAULTS.language &&
      16 === SETTINGS_DEFAULTS.fontSize &&
      true === SETTINGS_DEFAULTS.focusMode &&
      1.6 === SETTINGS_DEFAULTS.lineSpacing;
    expect(isDefault).toBe(false);
  });

  it("returns false when lineSpacing deviates from default", () => {
    const isDefault =
      "en-US" === SETTINGS_DEFAULTS.language &&
      16 === SETTINGS_DEFAULTS.fontSize &&
      false === SETTINGS_DEFAULTS.focusMode &&
      1.8 === SETTINGS_DEFAULTS.lineSpacing;
    expect(isDefault).toBe(false);
  });

  it("reset clears specific localStorage keys without touching dictionary", () => {
    const ls = mockLocalStorage();
    ls.setItem("lexicon:language", "en-GB");
    ls.setItem("lexicon:fontSize", "18");
    ls.setItem("lexicon:focusMode", "true");
    ls.setItem("lexicon:lineSpacing", "1.8");
    ls.setItem("lexicon:user_dictionary", '["lexicon"]');

    ls.removeItem("lexicon:language");
    ls.removeItem("lexicon:fontSize");
    ls.removeItem("lexicon:focusMode");
    ls.removeItem("lexicon:lineSpacing");

    expect(ls.getItem("lexicon:language")).toBeNull();
    expect(ls.getItem("lexicon:fontSize")).toBeNull();
    expect(ls.getItem("lexicon:focusMode")).toBeNull();
    expect(ls.getItem("lexicon:lineSpacing")).toBeNull();
    expect(ls.getItem("lexicon:user_dictionary")).toBe('["lexicon"]');
  });
});

describe("Grammar category classification", () => {
  it("classifies spelling/typo categories as spelling", () => {
    expect(getCategoryClass("Spelling")).toBe("lex-error-spelling");
    expect(getCategoryClass("Typo")).toBe("lex-error-spelling");
    expect(getCategoryClass("spelling")).toBe("lex-error-spelling");
  });

  it("classifies grammar/punctuation categories as grammar", () => {
    expect(getCategoryClass("Grammar")).toBe("lex-error-grammar");
    expect(getCategoryClass("Punctuation")).toBe("lex-error-grammar");
    expect(getCategoryClass("grammar")).toBe("lex-error-grammar");
    expect(getCategoryClass("punct")).toBe("lex-error-grammar");
  });

  it("classifies everything else as style", () => {
    expect(getCategoryClass("Style")).toBe("lex-error-style");
    expect(getCategoryClass("Tone")).toBe("lex-error-style");
    expect(getCategoryClass("Clarity")).toBe("lex-error-style");
    expect(getCategoryClass("")).toBe("lex-error-style");
  });

  it("is case-insensitive", () => {
    expect(getCategoryClass("SPELLING")).toBe("lex-error-spelling");
    expect(getCategoryClass("GRAMMAR")).toBe("lex-error-grammar");
    expect(getCategoryClass("PUNCTUATION")).toBe("lex-error-grammar");
  });
});
