function findMatches(re, text) {
  const results = [];
  const regex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ offset: match.index, length: match[0].length, original: match[0] });
  }
  return results;
}

const AUXILIARY = "am|is|are|was|were|be|been|being";

const IRREGULAR_PARTICIPLES = [
  "built", "made", "written", "taken", "broken", "given", "driven", "known",
  "shown", "spoken", "bought", "caught", "taught", "thought", "brought",
  "kept", "left", "sent", "lost", "met", "run", "said", "seen", "told",
  "understood", "won", "begun", "bitten", "blown", "chosen", "drawn",
  "drunk", "eaten", "fallen", "flown", "forgotten", "frozen", "grown",
  "hidden", "held", "led", "lent", "meant", "overcome", "ridden", "risen",
  "shaken", "shut", "slept", "slid", "stolen", "struck", "swum", "torn",
  "wept", "worn", "found", "dealt", "spent", "sold", "shot", "stuck",
  "woken", "woven", "withdrawn", "undertaken", "spread", "set",
];

const PASSIVE_REGEX = new RegExp(
  "\\b(" + AUXILIARY + ")\\s+(\\w+ed)\\b|\\b(" + AUXILIARY + ")\\s+(" + IRREGULAR_PARTICIPLES.join("|") + ")\\b",
  "gi"
);

function detectPassiveVoice(text) {
  const matches = findMatches(PASSIVE_REGEX, text);
  return matches.map((m) => ({
    offset: m.offset,
    length: m.length,
    message: "Passive voice: consider using active voice for clearer, more direct writing.",
    replacements: [],
    category: "Prose Style",
  }));
}

const CLICHE_PHRASES = [
  { pattern: /\bat the end of the day\b/gi, replacement: "ultimately, finally" },
  { pattern: /\bin order to\b/gi, replacement: "to" },
  { pattern: /\bdue to the fact that\b/gi, replacement: "because" },
  { pattern: /\ba lot of\b/gi, replacement: "many, several" },
  { pattern: /\blots of\b/gi, replacement: "many, numerous" },
  { pattern: /\bin the event that\b/gi, replacement: "if" },
  { pattern: /\bin spite of the fact that\b/gi, replacement: "although, despite" },
  { pattern: /\bthe reason why is that\b/gi, replacement: "because" },
  { pattern: /\bon a daily basis\b/gi, replacement: "daily" },
  { pattern: /\bon a weekly basis\b/gi, replacement: "weekly" },
  { pattern: /\bon a monthly basis\b/gi, replacement: "monthly" },
  { pattern: /\bby means of\b/gi, replacement: "by, via" },
  { pattern: /\bin the vicinity of\b/gi, replacement: "near, about" },
  { pattern: /\buntil such time as\b/gi, replacement: "until" },
  { pattern: /\bin the meantime\b/gi, replacement: "meanwhile" },
  { pattern: /\ball things considered\b/gi, replacement: "overall, considering" },
  { pattern: /\bthe bottom line is that\b/gi, replacement: "essentially" },
  { pattern: /\bthink outside the box\b/gi, replacement: "innovate, think creatively" },
  { pattern: /\blet's circle back\b/gi, replacement: "let's revisit" },
  { pattern: /\bdrill down\b/gi, replacement: "examine, explore" },
  { pattern: /\bpain point\b/gi, replacement: "problem, challenge" },
  { pattern: /\bbest practice\b/gi, replacement: "standard practice" },
  { pattern: /\bhit the ground running\b/gi, replacement: "start efficiently" },
  { pattern: /\bdeep dive\b/gi, replacement: "examination, analysis" },
  { pattern: /\bgame changer\b/gi, replacement: "transformative" },
  { pattern: /\btake it to the next level\b/gi, replacement: "advance, improve" },
  { pattern: /\bbandwidth\b/gi, replacement: "capacity" },
  { pattern: /\btouch base\b/gi, replacement: "check in, reconnect" },
  { pattern: /\bwin-win\b/gi, replacement: "mutually beneficial" },
  { pattern: /\bvalue add\b/gi, replacement: "benefit" },
  { pattern: /\bin a nutshell\b/gi, replacement: "briefly, in short" },
  { pattern: /\bas a matter of fact\b/gi, replacement: "in fact" },
  { pattern: /\bthe fact of the matter is\b/gi, replacement: "the truth is" },
  { pattern: /\bit goes without saying\b/gi, replacement: "clearly, obviously" },
  { pattern: /\blast but not least\b/gi, replacement: "finally" },
  { pattern: /\bfew and far between\b/gi, replacement: "rare" },
  { pattern: /\bbut at the same time\b/gi, replacement: "however, yet" },
  { pattern: /\beach and every\b/gi, replacement: "each, every" },
  { pattern: /\bfirst and foremost\b/gi, replacement: "first, primarily" },
];

function detectClichés(text) {
  const matches = [];
  for (const phrase of CLICHE_PHRASES) {
    const found = findMatches(phrase.pattern, text);
    const replacements = phrase.replacement.split(", ").map((s) => s.trim());
    for (const m of found) {
      matches.push({
        offset: m.offset,
        length: m.length,
        message: 'Wordy phrase: consider simplifying to "' + replacements[0] + '"',
        replacements,
        category: "Prose Style",
      });
    }
  }
  return matches;
}

const OPENER_STREAK_MIN = 3;

function detectRepetitiveOpeners(text) {
  const matches = [];
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const sentenceList = [];
  let m;
  while ((m = sentenceRegex.exec(text)) !== null) {
    sentenceList.push({ text: m[0], offset: m.index });
  }

  if (sentenceList.length < OPENER_STREAK_MIN) {
    return matches;
  }

  for (let i = 0; i <= sentenceList.length - OPENER_STREAK_MIN; i++) {
    const openers = [];
    for (let j = 0; j < OPENER_STREAK_MIN; j++) {
      const words = sentenceList[i + j].text.trim().match(/\S+/g);
      if (!words || words.length === 0) break;
      const firstWord = words[0].replace(/[^a-zA-Z]/g, "").toLowerCase();
      openers.push(firstWord);
    }
    if (openers.length === OPENER_STREAK_MIN && openers.every((w) => w === openers[0])) {
      const fullFirstWord = sentenceList[i].text.trim().match(/\S+/g)[0];
      matches.push({
        offset: sentenceList[i].offset,
        length: sentenceList[i].text.length,
        message: 'Repetitive sentence openers: ' + OPENER_STREAK_MIN + ' consecutive sentences start with "' + fullFirstWord + '". Vary your sentence beginnings.',
        replacements: [],
        category: "Prose Style",
      });
    }
  }

  return matches;
}

export function checkProseQuality(text) {
  if (!text || !text.trim()) return [];
  return [
    ...detectPassiveVoice(text),
    ...detectClichés(text),
    ...detectRepetitiveOpeners(text),
  ];
}
