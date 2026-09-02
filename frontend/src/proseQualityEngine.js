function findMatches(re, text) {
  const results = [];
  const regex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ offset: match.index, length: match[0].length, original: match[0] });
  }
  return results;
}

function findCapturedMatches(re, text, captureIndex = 1) {
  const results = [];
  const regex = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    const original = match[captureIndex];
    if (!original) continue;
    const relativeOffset = match[0].indexOf(original);
    results.push({
      offset: match.index + relativeOffset,
      length: original.length,
      original,
    });
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

const STATIVE_PREPOSITIONS = /^\s+(about|in|with|at|of|for|to)\b/i;

function detectPassiveVoice(text) {
  const rawMatches = findMatches(PASSIVE_REGEX, text);
  const results = [];

  for (const m of rawMatches) {
    const afterText = text.slice(m.offset + m.length);
    const beforeText = text.slice(Math.max(0, m.offset - 15), m.offset);

    // 1. Compound passive auxiliary (e.g. "is being reviewed", "has been built")
    const isCompoundPassive = /\b(being|been)\s+$/i.test(beforeText);

    // 2. Explicit agent passive (e.g. "was written by her")
    const isAgentPassive = /^\s+by\s+[a-z]+/i.test(afterText);

    // 3. Stative prepositional complement (e.g. "is excited about", "was interested in")
    const isStativePreposition = STATIVE_PREPOSITIONS.test(afterText);

    // Filter out stative predicate adjectives (e.g. "excited about", "interested in")
    // unless explicitly formed with a compound passive or "by <agent>" phrase.
    if (isStativePreposition && !isCompoundPassive && !isAgentPassive) {
      continue;
    }

    results.push({
      offset: m.offset,
      length: m.length,
      message: "Passive voice: consider using active voice for clearer, more direct writing.",
      replacements: [],
      category: "Prose Style",
    });
  }

  return results;
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

const FILLER_PATTERNS = [
  {
    pattern: /\b(very)\b(?=\s+(?:good|bad|important|big|small|large|difficult|hard|easy|clear|obvious|interesting|useful|helpful|simple|complex|likely|unlikely|necessary|possible|impossible|different|same|sure|true|certain|ready|happy|sad|tired|busy|nice|new|old)\b)/gi,
    message: "Filler intensifier: consider using a stronger, more precise word.",
    action: "remove",
  },
  {
    pattern: /\b(really)\b(?=\s+(?:good|bad|important|interesting|useful|helpful|simple|complex|likely|unlikely|clear|obvious|like|love|want|need|think|believe|feel|know|understand|enjoy|hate|hope|wish|prefer|seem|matter|work|help)\b)/gi,
    message: "Filler intensifier: consider using a stronger, more precise word.",
    action: "remove",
  },
  {
    pattern: /\b(just)\b(?=\s+(?:need|want|try|hope|think|feel|have|seem|mean|say|ask|wonder|look|use|make|start|started)\b)/gi,
    message: "Possible filler word: remove it if it does not add meaning.",
    action: "remove",
  },
  {
    pattern: /(?:^|[.!?]\s+|,\s+|\n+\s*|^\W+)(actually)\b/gi,
    message: "Possible filler word: remove it if it does not add meaning.",
    action: "remove",
  },
];

function detectFillerWords(text) {
  const matches = [];
  for (const filler of FILLER_PATTERNS) {
    for (const match of findCapturedMatches(filler.pattern, text)) {
      matches.push({
        offset: match.offset,
        length: match.length,
        message: filler.message,
        replacements: filler.action === "remove" ? [""] : [],
        category: "Prose Style",
        ...(filler.action ? { action: filler.action } : {}),
      });
    }
  }
  return matches;
}

const HEDGE_PATTERNS = [
  { pattern: /\b(I\s+(?:think|believe))\b/gi },
  { pattern: /\b(It\s+(?:seems?|appears?))\b/gi },
  {
    pattern: /(?:^|[.!?]\s+|,\s+|\n+\s*|^\W+)(perhaps|maybe)\b/gi,
    action: "remove",
  },
  { pattern: /\b((?:might|may|could)\s+be)\b/gi },
  {
    pattern: /\b(probably|possibly|somewhat)\b/gi,
    action: "remove",
  },
];

function detectHedging(text) {
  const matches = [];
  for (const hedge of HEDGE_PATTERNS) {
    for (const match of findCapturedMatches(hedge.pattern, text)) {
      matches.push({
        offset: match.offset,
        length: match.length,
        message: "Hedging language: state this more directly when you can.",
        replacements: hedge.action === "remove" ? [""] : [],
        category: "Prose Style",
        ...(hedge.action ? { action: hedge.action } : {}),
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
    ...detectFillerWords(text),
    ...detectHedging(text),
    ...detectRepetitiveOpeners(text),
  ];
}

export function extractSentenceContext(text, offset) {
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const sentStart = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("! "),
    before.lastIndexOf("? "),
    before.lastIndexOf("\n"),
  ) + 1;
  let sentEnd = after.search(/[.!?](?:\s|$)/);
  if (sentEnd === -1) sentEnd = after.length;
  else sentEnd += 1;
  const raw = text.slice(sentStart, offset + sentEnd);
  const trimmed = raw.trim();
  const leadingWS = raw.indexOf(trimmed[0]);
  return { text: trimmed, offset: sentStart + leadingWS, length: trimmed.length };
}
