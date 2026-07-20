// Instruction prompts for the AI action tools. Every prompt targets a small
// (0.8B-2B) local model with reasoning disabled, so instructions are kept
// short, concrete, and explicit about output format — small models drift
// toward adding preamble/commentary and blur vague adjectives together
// unless told exactly what to do and not do.

// Appended to every prompt. Small local models reliably wrap output in
// commentary ("Here's the rewritten version:") or quotation marks unless
// told directly not to — this is the single biggest quality lever for a
// model this size, more than wording the actual instruction.
const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

const SINGLE_SHOT = {
  Rewrite:
    "Rewrite the text below to improve clarity and flow. Preserve its meaning, " +
    "facts, names, and tone — change only the wording and sentence structure, " +
    "not the content. Keep the same language and the same paragraph breaks." +
    OUTPUT_RULES,
  Concise:
    "Rewrite the text below to be more concise. Cut redundancy, filler words, " +
    "and repeated ideas. Keep every fact, name, and the original meaning and " +
    "tone. Keep the same language and the same paragraph breaks." + OUTPUT_RULES,
};

// Each tone gets its own concrete descriptor rather than sharing one
// templated sentence with just the adjective swapped — a bare adjective
// ("sound professional") is a weak signal for a small model, and tones like
// Academic/Formal/Professional collapse into each other without something
// more specific to hold onto (contractions or not, sentence length,
// register, etc).
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

function toneInstruction(descriptor) {
  return (
    `Rewrite the text below so it reads ${descriptor}. Preserve the ` +
    "original meaning, facts, and any names. Keep the same language and " +
    "the same paragraph breaks." +
    OUTPUT_RULES
  );
}

const STRUCTURE = {
  Summary:
    "Summarize the text below in 2-4 sentences that capture its key message " +
    "and most important points. Do not add opinions or information that " +
    "isn't in the text." + OUTPUT_RULES,
  "Key Points":
    "Extract the most important points from the text below as a Markdown " +
    'bulleted list. One point per line, each line starting with "- ". Keep ' +
    "each point short — a phrase or one sentence. Do not nest lists or add " +
    "sub-bullets." + OUTPUT_RULES,
  List:
    "Reformat the text below as a Markdown bulleted list, one natural item " +
    'or step per line, each line starting with "- ". Keep the original ' +
    "wording where possible — only restructure it into list form." +
    OUTPUT_RULES,
  Table:
    "Convert the text below into a Markdown table. Choose clear column " +
    "headers based on the content. Use this exact format:\n\n" +
    "| Header 1 | Header 2 |\n" +
    "| --- | --- |\n" +
    "| value | value |\n\n" +
    'Include the header row and the "| --- |" separator row exactly as ' +
    "shown, with one \"---\" per column. Do not add any text before or " +
    "after the table." + OUTPUT_RULES,
};

const PROMPTS = { ...SINGLE_SHOT, ...STRUCTURE };

for (const [tone, descriptor] of Object.entries(TONE_DESCRIPTORS)) {
  PROMPTS[tone] = toneInstruction(descriptor);
}

export const AI_TOOL_NAMES = [
  "Rewrite",
  "Concise",
  ...Object.keys(TONE_DESCRIPTORS),
  "Summary",
  "Key Points",
  "List",
  "Table",
];

export function isAiTool(name) {
  return AI_TOOL_NAMES.includes(name);
}

// Returns the instruction prompt for a tool, or null if the tool isn't an
// AI transform (e.g. Proofread, which stays on LanguageTool).
export function promptForTool(name) {
  return PROMPTS[name] ?? null;
}