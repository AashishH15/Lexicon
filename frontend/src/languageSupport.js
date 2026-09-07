/**
 * Multilingual helpers for Deep Proofread.
 *
 * LanguageTool covers all 49 locales in `languages.js`.
 * AI Deep Proofread runs for every locale. Non-English drafts show a notice
 * that the AI path has not been thoroughly evaluated for that language.
 */
import { LANGUAGES } from "./languages.js";

const LABEL_BY_CODE = Object.fromEntries(
  LANGUAGES.map((entry) => [entry.code, entry.label || entry.name]),
);

export function normalizeLanguageTag(code) {
  return String(code || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/** Collapse LanguageTool locale tags to a guard family key (en-US → en). */
export function languageFamily(code) {
  const normalized = normalizeLanguageTag(code);
  if (!normalized) return "und";
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("ca")) return "ca";
  return normalized.split("-")[0] || "und";
}

export function isEnglishLocale(code) {
  return languageFamily(code) === "en";
}

export function getLanguageLabel(code) {
  const exact = String(code || "").trim();
  return LABEL_BY_CODE[exact] || exact || "this language";
}

/** Notice shown for non-English Deep Proofread runs. Empty string for English. */
export function getNonEnglishDeepProofreadNotice(code) {
  if (isEnglishLocale(code)) return "";
  return (
    `Deep Proofread AI has not been thoroughly tested for ${getLanguageLabel(code)} ` +
    "and may produce incorrect suggestions. Review AI clarity edits carefully."
  );
}
