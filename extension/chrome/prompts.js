// Rewrite prompt for the popup — must stay byte-identical in structure to the
// desktop app's frontend/src/prompts.js: base instruction + OUTPUT_RULES, so
// the same small local model behaves the same in both surfaces. Small models
// drift toward preamble unless told exactly what to do and not do.

const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

export const REWRITE_PROMPT =
  "Rewrite the text below to improve clarity and flow. Preserve its meaning, " +
  "facts, names, and tone — change only the wording and sentence structure, " +
  "not the content. Keep the same language and the same paragraph breaks." +
  OUTPUT_RULES;
