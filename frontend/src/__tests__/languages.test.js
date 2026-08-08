import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../languages.js";

// All 49 LanguageTool 6.8 grammar locales exposed in Lexicon
// (excludes generic en/de/pt, LibreOffice aliases, and spellcheck-only Norwegian)
const EXPECTED_LANG_CODES = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-CA",
  "en-NZ",
  "en-ZA",
  "ar",
  "ast",
  "be",
  "br",
  "ca-ES-balear",
  "ca",
  "ca-ES-valencia",
  "zh-CN",
  "crh",
  "da",
  "nl-BE",
  "nl",
  "eo",
  "fr-BE",
  "fr-CA",
  "fr",
  "fr-CH",
  "gl",
  "de-AT",
  "de-DE",
  "de-CH",
  "el",
  "ga",
  "it",
  "ja",
  "km",
  "fa",
  "pl",
  "pt-AO",
  "pt-BR",
  "pt-MZ",
  "pt-PT",
  "ro",
  "ru",
  "de-DE-x-simple-language",
  "sk",
  "sl",
  "es-AR",
  "es",
  "sv",
  "tl",
  "ta",
  "uk",
];

describe("Languages Catalog & LanguageTool Compatibility", () => {
  it("exports exactly 49 supported language and dialect entries", () => {
    expect(Array.isArray(LANGUAGES)).toBe(true);
    expect(LANGUAGES.length).toBe(49);
  });

  it("ensures every language entry has valid code, name, and label string fields", () => {
    LANGUAGES.forEach((entry) => {
      expect(entry).toHaveProperty("code");
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("label");
      expect(typeof entry.code).toBe("string");
      expect(entry.code.trim().length).toBeGreaterThan(0);
      expect(typeof entry.name).toBe("string");
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.trim().length).toBeGreaterThan(0);
    });
  });

  it("ensures all language codes are strictly unique", () => {
    const codes = LANGUAGES.map((l) => l.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("pins English variants at the top of the catalog", () => {
    const englishCodes = LANGUAGES.slice(0, 6).map((l) => l.code);
    expect(englishCodes).toEqual([
      "en-US",
      "en-GB",
      "en-AU",
      "en-CA",
      "en-NZ",
      "en-ZA",
    ]);
  });

  it("sorts all non-English global languages alphabetically by display label", () => {
    const globalLanguages = LANGUAGES.slice(6);
    const labels = globalLanguages.map((l) => l.label);
    const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sortedLabels);
  });

  it("explicitly verifies all 49 LanguageTool 6.8 language codes exist in the catalog", () => {
    const codeSet = new Set(LANGUAGES.map((l) => l.code));
    EXPECTED_LANG_CODES.forEach((code) => {
      expect(codeSet.has(code)).toBe(true);
    });
  });

  it("excludes LibreOffice aliases and spellcheck-only languages from the catalog", () => {
    const codeSet = new Set(LANGUAGES.map((l) => l.code));
    // Aliases that map onto base languages — catalog uses the real engine codes instead
    expect(codeSet.has("de-LU")).toBe(false);
    expect(codeSet.has("fr-FR")).toBe(false);
    expect(codeSet.has("es-ES")).toBe(false);
    expect(codeSet.has("nl-NL")).toBe(false);
    // Spellcheck-only (no grammar rules in LanguageTool)
    expect(codeSet.has("nb")).toBe(false);
    expect(codeSet.has("no")).toBe(false);
  });

  it("uses LanguageTool official names for voseo, preAO, Swiss German, and Simple German", () => {
    const byCode = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));
    expect(byCode["es-AR"].label).toBe("Spanish (voseo)");
    expect(byCode["pt-AO"].label).toBe("Portuguese (Angola preAO)");
    expect(byCode["pt-MZ"].label).toBe("Portuguese (Moçambique preAO)");
    expect(byCode["de-CH"].label).toBe("German (Swiss)");
    expect(byCode["de-DE-x-simple-language"].label).toBe("Simple German");
  });

  it("forms valid proofread API payloads for all catalog languages", () => {
    LANGUAGES.forEach((l) => {
      const payload = {
        text: "Testing sample draft text",
        language: l.code,
      };
      expect(payload.language).toMatch(/^[a-z]{2,3}(-[A-Za-z0-9-]+)*$/);
    });
  });
});
