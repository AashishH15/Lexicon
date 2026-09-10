// Rewrite and tone prompts for extension actions.
// The Express prompt must match the desktop text in
// frontend/src/prompts.js so small models behave the same.

const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

export const REWRITE_PROMPT =
  "Rewrite the text below to improve clarity and flow. Preserve its meaning, " +
  "facts, names, and tone — change only the wording and sentence structure, " +
  "not the content. Keep the same language and the same paragraph breaks." +
  OUTPUT_RULES;

export const EXPRESS_TOOL = "Express in English";

export const TRANSFORM_TOOLS = [
  "Rewrite",
  "Concise",
  "Friendly",
  "Professional",
  "Academic",
  "Formal",
  "Casual",
  "Playful",
  "Empathetic",
  "Persuasive",
  "Humorous",
  EXPRESS_TOOL,
];

const TONE_DESCRIPTORS = {
  Friendly:
    "warm and approachable, like talking to someone you like — use " +
    "contractions and simple, direct language, but stay clear and easy to read",
  Professional:
    "polished and workplace-appropriate — clear, neutral, and confident, " +
    "without slang or casual contractions",
  Academic:
    "formal and precise, the way a research paper or academic essay reads — " +
    "exact terminology, no contractions, no casual phrasing",
  Formal:
    "correct and reserved, suitable for an official letter or announcement — " +
    "no contractions, no slang, no casual asides",
  Casual:
    "relaxed and conversational, like a text to a friend — contractions, " +
    "everyday words, short sentences",
  Playful:
    "light and upbeat, with a bit of personality and fun word choice — " +
    "energetic but still clear and easy to follow",
  Empathetic:
    "gentle and understanding — acknowledge the feelings or difficulty " +
    "involved, and avoid blame or harsh language",
  Persuasive:
    "confident and compelling — active verbs, a clear reason or benefit to " +
    "act on, no hedging or wishy-washy language",
  Humorous:
    "genuinely funny — include a light joke, witty turn of phrase, or " +
    "playful exaggeration, without losing the original point",
};

const CONCISE_PROMPT =
  "Rewrite the text below to be more concise. Cut redundancy, filler words, " +
  "and repeated ideas. Keep every fact, name, and the original meaning and " +
  "tone. Keep the same language and the same paragraph breaks." +
  OUTPUT_RULES;

function tonePrompt(descriptor) {
  return (
    `Rewrite the text below so it reads ${descriptor}. Preserve the ` +
    "original meaning, facts, and any names. Keep the same language and " +
    "the same paragraph breaks." +
    OUTPUT_RULES
  );
}

const EXPRESS_JSON_TEMPLATE =
  '{\n' +
  '  "detectedLanguage": "...",\n' +
  '  "tones": {\n' +
  '    "auto": "...",\n' +
  '    "professional": "...",\n' +
  '    "casual": "...",\n' +
  '    "friendly": "...",\n' +
  '    "formal": "...",\n' +
  '    "concise": "..."\n' +
  "  }\n" +
  "}";

export function getExpressPrompt() {
  return (
    "You are a phrasing specialist for English. " +
    "Express the input thought in natural, idiomatic English. " +
    "Do not translate word for word. Do not stay literal. " +
    "Detect the source language and report it as detectedLanguage. " +
    "Do not ask the user to pick a source language. " +
    "If the input is already English, refine the wording for each tone and treat the task as a style set. " +
    "Keep names, numbers, and intent. Do not add facts. Do not invent details. " +
    "Keep each version short and fit for one short paragraph. " +
    "Make the tones clearly different. " +
    "For auto, translate faithfully and match the source register and intent without added flair. " +
    "Use natural contractions in casual. " +
    "Keep professional polished and safe for the workplace. " +
    "Keep friendly warm and kind. " +
    "Keep formal correct and reserved. " +
    "Make concise clearly shorter than the other versions. " +
    "Do not use em dashes or en dashes. Use commas or periods instead. " +
    "Return ONLY one JSON object and nothing else. " +
    "Use this exact shape with these exact keys:\n" +
    EXPRESS_JSON_TEMPLATE +
    "\nNo preamble. No postscript. No explanation. No markdown. No code fence."
  );
}

export function getTransformPrompt(tool, language = "en-US") {
  const base =
    tool === EXPRESS_TOOL
      ? getExpressPrompt()
      : tool === "Rewrite"
        ? REWRITE_PROMPT
        : tool === "Concise"
          ? CONCISE_PROMPT
          : tonePrompt(TONE_DESCRIPTORS[tool]);
  if (tool === EXPRESS_TOOL) {
    return base;
  }
  return base + keepLanguageAppendix(language);
}

// Compact label table for the keep-language appendix. The desktop app
// owns the full 49-locale catalog; unknown codes fall back to the raw
// tag, which still guides the model.
const PROMPT_LANGUAGE_LABELS = {
  ar: "Arabic",
  ca: "Catalan",
  da: "Danish",
  de: "German",
  el: "Greek",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fr: "French",
  he: "Hebrew",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  nl: "Dutch",
  no: "Norwegian",
  pl: "Polish",
  pt: "Portuguese",
  ru: "Russian",
  sv: "Swedish",
  tr: "Turkish",
  uk: "Ukrainian",
  zh: "Chinese",
};

// Name a BCP 47 tag for prompts. Returns "" for English and blank input.
export function promptLanguageLabel(code) {
  const tag = String(code ?? "").trim();
  if (!tag) {
    return "";
  }
  const family = tag.split("-")[0].toLowerCase();
  if (!family || family === "en") {
    return "";
  }
  return PROMPT_LANGUAGE_LABELS[family] || tag;
}

// Small models translate non-English drafts unless the target language
// is named outright. Mirrors the desktop promptForTool appendix.
export function keepLanguageAppendix(language) {
  const label = promptLanguageLabel(language);
  if (!label) {
    return "";
  }
  return (
    ` Keep the text in ${label}.` +
    " Do not translate it into English or any other language."
  );
}
