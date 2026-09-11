// Instruction prompts for the AI action tools. Every prompt targets a small
// (0.8B-2B) local model with reasoning disabled, so instructions are kept
// short, concrete, and explicit about output format — small models drift
// toward adding preamble/commentary and blur vague adjectives together
// unless told exactly what to do and not do.
import { getLanguageLabel, languageFamily } from "./languageSupport.js";

const OUTPUT_RULES =
  " Output only the result and nothing else. No preamble, no headings, no explanation, and do not wrap it in quotation marks.";

const SINGLE_SHOT_BASE = {
  Rewrite:
    "Rewrite the text below to improve clarity and flow. Preserve its meaning, " +
    "facts, names, and tone — change only the wording and sentence structure, " +
    "not the content. Keep the same language and the same paragraph breaks.",
  Concise:
    "Rewrite the text below to be more concise. Cut redundancy, filler words, " +
    "and repeated ideas. Keep every fact, name, and the original meaning and " +
    "tone. Keep the same language and the same paragraph breaks.",
};

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
    "the same paragraph breaks."
  );
}

const STRUCTURE_BASE = {
  Summary:
    "Summarize the text below in 2-4 sentences that capture its key message " +
    "and most important points. Do not add opinions or information that " +
    "isn't in the text.",
  "Key Points":
    "Extract the most important points from the text below as a Markdown " +
    'bulleted list. One point per line, each line starting with "- ". Keep ' +
    "each point short — a phrase or one sentence. Do not nest lists or add " +
    "sub-bullets.",
  List:
    "Reformat the text below as a Markdown bulleted list, one natural item " +
    'or step per line, each line starting with "- ". Keep the original ' +
    "wording where possible — only restructure it into list form.",
  Table:
    "Convert the text below into a Markdown table. Choose clear column " +
    "headers based on the content. Use this exact format:\n\n" +
    "| Header 1 | Header 2 |\n" +
    "| --- | --- |\n" +
    "| value | value |\n\n" +
    'Include the header row and the "| --- |" separator row exactly as ' +
    'shown, with one "---" per column. Do not add any text before or ' +
    "after the table.",
};

export const CONTINUE_TOOL_NAME = "Continue";
export const EXPAND_TOOL_NAME = "Expand";

const CONTINUE_EXPAND_BASE = {
  Continue:
    "Continue the draft below with the next 1 to 3 sentences in the same " +
    "voice and style. Begin with words that do not appear at the end of the " +
    "draft. Do not repeat any of the input text. Output only the " +
    "new sentences and nothing else. No preamble, no explanation, no quotation marks.",
  Expand:
    "Expand the text below with more detail and one concrete example or " +
    "reason. Preserve its meaning, facts, and names. Keep the same voice. " +
    "Output only the expanded text and nothing else. No preamble, no explanation, " +
    "no quotation marks.",
};

export const DEFAULT_INSTRUCTIONS = {
  ...SINGLE_SHOT_BASE,
  ...STRUCTURE_BASE,
  ...CONTINUE_EXPAND_BASE,
};

for (const [tone, descriptor] of Object.entries(TONE_DESCRIPTORS)) {
  DEFAULT_INSTRUCTIONS[tone] = toneInstruction(descriptor);
}

export const AI_TOOL_NAMES = [
  CONTINUE_TOOL_NAME,
  EXPAND_TOOL_NAME,
  "Rewrite",
  "Concise",
  ...Object.keys(TONE_DESCRIPTORS),
  "Summary",
  "Key Points",
  "List",
  "Table",
];

// Tools whose output revises the source in place. Results render in
// the side-by-side diff popover. Summary-class tools generate new
// text instead and keep their result cards.
export const REWRITE_CLASS_TOOLS = [
  "Rewrite",
  "Concise",
  ...Object.keys(TONE_DESCRIPTORS),
  EXPAND_TOOL_NAME,
];

const OVERRIDES_STORAGE_KEY = "lexicon:prompt_overrides";
const CUSTOM_TOOLS_STORAGE_KEY = "lexicon:custom_tools";
export const MAX_CUSTOM_TOOLS = 5;

export function getPromptOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function savePromptOverride(name, instruction) {
  const overrides = getPromptOverrides();
  if (!instruction || instruction.trim() === DEFAULT_INSTRUCTIONS[name]) {
    delete overrides[name];
  } else {
    overrides[name] = instruction.trim();
  }
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  notifyToolsChanged();
}

export function resetPromptOverride(name) {
  const overrides = getPromptOverrides();
  delete overrides[name];
  localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
  notifyToolsChanged();
}

export function getCustomTools() {
  try {
    const raw = localStorage.getItem(CUSTOM_TOOLS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveCustomTool(tool) {
  const tools = getCustomTools();
  const existingIndex = tools.findIndex((t) => t.id === tool.id);
  if (existingIndex >= 0) {
    tools[existingIndex] = { ...tools[existingIndex], ...tool };
  } else {
    if (tools.length >= MAX_CUSTOM_TOOLS) {
      throw new Error(`Maximum of ${MAX_CUSTOM_TOOLS} custom tools allowed.`);
    }
    const newTool = {
      id: "ct_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      name: tool.name.trim(),
      prompt: tool.prompt.trim(),
      icon: tool.icon || "Sparkle",
    };
    tools.push(newTool);
  }
  localStorage.setItem(CUSTOM_TOOLS_STORAGE_KEY, JSON.stringify(tools));
  notifyToolsChanged();
  return tools;
}

export function deleteCustomTool(id) {
  const tools = getCustomTools().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_TOOLS_STORAGE_KEY, JSON.stringify(tools));
  notifyToolsChanged();
  return tools;
}

function notifyToolsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lexicon:tools-changed"));
  }
}

export function isAiTool(name) {
  if (AI_TOOL_NAMES.includes(name)) {
    return true;
  }
  const customTools = getCustomTools();
  return customTools.some((t) => t.name === name || t.id === name);
}

// Returns the instruction prompt for a tool (built-in or custom), or null if
// the tool isn't an AI transform (e.g. Proofread).
export const ACTIVE_VOICE_PROMPT =
  "Rewrite the following sentence in the active voice. Make the subject perform the action directly. " +
  "Output only the rewritten sentence and nothing else. No preamble, no quotation marks.";

export const PROSE_CLARITY_PROMPT =
  "Rewrite the following sentence to be clearer, more direct, and more concise. Remove unnecessary filler and hedging, " +
  "but preserve the original meaning and any uncertainty that is factually important. Output only the rewritten sentence " +
  "and nothing else. No preamble, no quotation marks.";

// Express prompt: fixed instruction for one-call transcreation.
// The backend sends the user text after this prompt, so keep this static.
// Use short sentences. Use simple words. Avoid em dashes in this text.
// Input text stays out of the prompt. The call sends it in the text field.
export const EXPRESS_TONE_KEYS = [
  "auto",
  "professional",
  "casual",
  "friendly",
  "formal",
  "concise",
];

export const EXPRESS_JSON_TEMPLATE =
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

export function getExpressPrompt(text) {
  void text;
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

// Small models translate non-English drafts unless the target language
// is named outright. Mirror the Deep Proofread keep-language appendix.
function keepLanguageAppendix(language) {
  const code = String(language || "").trim();
  if (!code || languageFamily(code) === "en") {
    return "";
  }
  return (
    ` Keep the text in ${getLanguageLabel(code)}.` +
    " Do not translate it into English or any other language."
  );
}

export function promptForTool(name, language = "") {
  // Check custom tools first
  const customTools = getCustomTools();
  const customTool = customTools.find((t) => t.name === name || t.id === name);
  if (customTool) {
    return customTool.prompt.trim() + OUTPUT_RULES + keepLanguageAppendix(language);
  }

  // Check built-in prompt overrides
  if (DEFAULT_INSTRUCTIONS[name]) {
    const overrides = getPromptOverrides();
    const base = overrides[name] || DEFAULT_INSTRUCTIONS[name];
    return base.trim() + OUTPUT_RULES + keepLanguageAppendix(language);
  }

  return null;
}