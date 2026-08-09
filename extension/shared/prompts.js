// Rewrite and tone prompts for the popup.
// Keep their structure identical to the desktop app prompts.

const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

export const REWRITE_PROMPT =
  "Rewrite the text below to improve clarity and flow. Preserve its meaning, " +
  "facts, names, and tone — change only the wording and sentence structure, " +
  "not the content. Keep the same language and the same paragraph breaks." +
  OUTPUT_RULES;

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

export function getTransformPrompt(tool) {
  if (tool === "Rewrite") return REWRITE_PROMPT;
  if (tool === "Concise") return CONCISE_PROMPT;
  return tonePrompt(TONE_DESCRIPTORS[tool]);
}
