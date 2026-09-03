function findMatches(re, text) {
  const results = [];
  const regex = new RegExp(
    re.source,
    re.flags.includes("g") ? re.flags : re.flags + "g"
  );
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({
      offset: match.index,
      length: match[0].length,
      original: match[0],
    });
  }
  return results;
}

function findCapturedMatches(re, text, captureIndex = 1) {
  const results = [];
  const regex = new RegExp(
    re.source,
    re.flags.includes("g") ? re.flags : re.flags + "g"
  );
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

function preserveCase(original, replacement) {
  if (!original || !replacement) return replacement;
  if (
    original === original.toUpperCase() &&
    original !== original.toLowerCase()
  ) {
    return replacement.toUpperCase();
  }
  if (/^[A-Z]/.test(original)) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const AUXILIARY = "am|is|are|was|were|be|been|being";

const IRREGULAR_PARTICIPLES = [
  "built",
  "made",
  "written",
  "taken",
  "broken",
  "given",
  "driven",
  "known",
  "shown",
  "spoken",
  "bought",
  "caught",
  "taught",
  "thought",
  "brought",
  "kept",
  "left",
  "sent",
  "lost",
  "met",
  "run",
  "said",
  "seen",
  "told",
  "understood",
  "won",
  "begun",
  "bitten",
  "blown",
  "chosen",
  "drawn",
  "drunk",
  "eaten",
  "fallen",
  "flown",
  "forgotten",
  "frozen",
  "grown",
  "hidden",
  "held",
  "led",
  "lent",
  "meant",
  "overcome",
  "ridden",
  "risen",
  "shaken",
  "shut",
  "slept",
  "slid",
  "stolen",
  "struck",
  "swum",
  "torn",
  "wept",
  "worn",
  "found",
  "dealt",
  "spent",
  "sold",
  "shot",
  "stuck",
  "woken",
  "woven",
  "withdrawn",
  "undertaken",
  "spread",
  "set",
];

const PASSIVE_REGEX = new RegExp(
  "\\b(" +
    AUXILIARY +
    ")\\s+(\\w+ed)\\b|\\b(" +
    AUXILIARY +
    ")\\s+(" +
    IRREGULAR_PARTICIPLES.join("|") +
    ")\\b",
  "gi"
);

const STATIVE_PREPOSITIONS = /^\s+(about|in|with|at|of|for|to)\b/i;
const PASSIVE_IDIOM_PATTERNS = [/\bwhen all is said and done\b/gi];

function detectPassiveVoice(text) {
  const rawMatches = findMatches(PASSIVE_REGEX, text);
  const idiomMatches = PASSIVE_IDIOM_PATTERNS.flatMap((pattern) =>
    findMatches(pattern, text)
  );
  const results = [];

  for (const m of rawMatches) {
    const isInsideIdiom = idiomMatches.some(
      (idiom) =>
        m.offset >= idiom.offset &&
        m.offset + m.length <= idiom.offset + idiom.length
    );
    if (isInsideIdiom) continue;

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
      message:
        "Passive voice: consider using active voice for clearer, more direct writing.",
      replacements: [],
      category: "Prose Style",
    });
  }

  return results;
}

function cliche(pattern, replacement = null) {
  return {
    pattern,
    replacement,
    message: replacement
      ? `Cliché phrase: consider using "${replacement.split(",")[0].trim()}".`
      : "Cliché phrase: consider rewriting this in your own words.",
  };
}

const CLICHE_PHRASES = [
  {
    pattern: /\bat the end of the day\b/gi,
    replacement: "ultimately, finally",
  },
  { pattern: /\bin order to\b/gi, replacement: "to" },
  { pattern: /\bdue to the fact that\b/gi, replacement: "because" },
  { pattern: /\ba lot of\b/gi, replacement: "many, several" },
  { pattern: /\blots of\b/gi, replacement: "many, numerous" },
  { pattern: /\bin the event that\b/gi, replacement: "if" },
  {
    pattern: /\bin spite of the fact that\b/gi,
    replacement: "although, despite",
  },
  { pattern: /\bthe reason why is that\b/gi, replacement: "because" },
  { pattern: /\bon a daily basis\b/gi, replacement: "daily" },
  { pattern: /\bon a weekly basis\b/gi, replacement: "weekly" },
  { pattern: /\bon a monthly basis\b/gi, replacement: "monthly" },
  { pattern: /\bby means of\b/gi, replacement: "by, via" },
  { pattern: /\bin the vicinity of\b/gi, replacement: "near, about" },
  { pattern: /\buntil such time as\b/gi, replacement: "until" },
  { pattern: /\bin the meantime\b/gi, replacement: "meanwhile" },
  {
    pattern: /\ball things considered\b/gi,
    replacement: "overall, considering",
  },
  { pattern: /\bthe bottom line is that\b/gi, replacement: "essentially" },
  {
    pattern: /\bthink outside the box\b/gi,
    replacement: "innovate, think creatively",
  },
  { pattern: /\blet's circle back\b/gi, replacement: "let's revisit" },
  { pattern: /\bdrill down\b/gi, replacement: "examine, explore" },
  { pattern: /\bpain point\b/gi, replacement: "problem, challenge" },
  { pattern: /\bbest practice\b/gi, replacement: "standard practice" },
  { pattern: /\bhit the ground running\b/gi, replacement: "start efficiently" },
  { pattern: /\bdeep dive\b/gi, replacement: "examination, analysis" },
  { pattern: /\bgame changer\b/gi, replacement: "transformative" },
  {
    pattern: /\btake it to the next level\b/gi,
    replacement: "advance, improve",
  },
  { pattern: /\bbandwidth\b/gi, replacement: "capacity" },
  { pattern: /\btouch base\b/gi, replacement: "check in, reconnect" },
  { pattern: /\bwin-win\b/gi, replacement: "mutually beneficial" },
  { pattern: /\bvalue add\b/gi, replacement: "benefit" },
  { pattern: /\bin a nutshell\b/gi, replacement: "briefly, in short" },
  { pattern: /\bas a matter of fact\b/gi, replacement: "in fact" },
  { pattern: /\bthe fact of the matter is\b/gi, replacement: "the truth is" },
  {
    pattern: /\bit goes without saying\b/gi,
    replacement: "clearly, obviously",
  },
  { pattern: /\blast but not least\b/gi, replacement: "finally" },
  { pattern: /\bfew and far between\b/gi, replacement: "rare" },
  { pattern: /\bbut at the same time\b/gi, replacement: "however, yet" },
  { pattern: /\beach and every\b/gi, replacement: "each, every" },
  { pattern: /\bfirst and foremost\b/gi, replacement: "first, primarily" },
  // High-confidence additions. Phrases with context-dependent verb forms
  // intentionally have no fixed replacement and use the Lex rewrite action.
  cliche(/\bat this point in time\b/gi, "now"),
  cliche(/\bat the present time\b/gi, "now"),
  cliche(/\bin the near future\b/gi, "soon"),
  cliche(/\bin the not too distant future\b/gi, "soon"),
  cliche(/\bwhen all is said and done\b/gi, "ultimately"),
  cliche(/\bin this day and age\b/gi, "today"),
  cliche(/\bin today's world\b/gi, "today"),
  cliche(/\bin the grand scheme of things\b/gi, "overall"),
  cliche(/\bin the long run\b/gi, "ultimately"),
  cliche(/\btime and time again\b/gi, "repeatedly"),
  cliche(/\bby leaps and bounds\b/gi, "rapidly"),
  cliche(/\blow-hanging fruit\b/gi, "easy opportunities"),
  cliche(/\bsecret sauce\b/gi, "key advantage"),
  cliche(/\bsilver bullet\b/gi, "simple solution"),
  cliche(/\bmagic bullet\b/gi, "simple solution"),
  cliche(/\bparadigm shift\b/gi, "major change"),
  cliche(/\bbest of both worlds\b/gi, "advantages of both"),
  cliche(/\bthe tip of the iceberg\b/gi, "a small part"),
  cliche(/\bthe elephant in the room\b/gi, "an obvious issue"),
  cliche(/\ba light at the end of the tunnel\b/gi, "hope"),
  cliche(/\ba breath of fresh air\b/gi, "a refreshing change"),
  cliche(/\ba blessing in disguise\b/gi, "an unexpected benefit"),
  cliche(/\ba dime a dozen\b/gi, "common"),
  cliche(/\ba piece of cake\b/gi, "easy"),
  cliche(/\bunder the weather\b/gi, "ill"),
  cliche(/\bpar for the course\b/gi, "expected"),
  cliche(/\bgo the extra mile\b/gi),
  cliche(/\bmove the needle\b/gi),
  cliche(/\bpush the envelope\b/gi),
  cliche(/\braise the bar\b/gi),
  cliche(/\b(?:move|moves|moved|moving) the goalposts\b/gi),
  cliche(/\blevel the playing field\b/gi),
  cliche(/\bon the same page\b/gi),
  cliche(/\bin the driver's seat\b/gi),
  cliche(/\ball hands on deck\b/gi),
  cliche(/\bread between the lines\b/gi),
  cliche(/\bcut to the chase\b/gi),
  cliche(/\bbite the bullet\b/gi),
  cliche(/\bback to square one\b/gi),
  cliche(/\bburn the midnight oil\b/gi),
  cliche(/\bpull out all the stops\b/gi),
  cliche(/\bneedle in a haystack\b/gi),
  cliche(/\bwhen push comes to shove\b/gi),
  cliche(/\bon thin ice\b/gi),
];

function detectClichés(text) {
  const matches = [];
  for (const phrase of CLICHE_PHRASES) {
    const found = findMatches(phrase.pattern, text);
    const baseReplacements = phrase.replacement
      ? phrase.replacement.split(",").map((s) => s.trim())
      : [];
    for (const m of found) {
      const replacements = baseReplacements.map((replacement) =>
        preserveCase(m.original, replacement)
      );
      matches.push({
        offset: m.offset,
        length: m.length,
        message:
          phrase.message ||
          'Wordy phrase: consider simplifying to "' + replacements[0] + '"',
        replacements,
        category: "Prose Style",
      });
    }
  }
  return matches;
}

const WEAK_VERB_PHRASES = [
  // make use of
  { pattern: /\bmake use of\b/gi, replacement: "use" },
  { pattern: /\bmakes use of\b/gi, replacement: "uses" },
  { pattern: /\bmade use of\b/gi, replacement: "used" },
  { pattern: /\bmaking use of\b/gi, replacement: "using" },
  // make a decision to
  { pattern: /\bmake a decision to\b/gi, replacement: "decide to" },
  { pattern: /\bmakes a decision to\b/gi, replacement: "decides to" },
  { pattern: /\bmade a decision to\b/gi, replacement: "decided to" },
  { pattern: /\bmaking a decision to\b/gi, replacement: "deciding to" },
  // make an attempt to
  { pattern: /\bmake an attempt to\b/gi, replacement: "attempt to" },
  { pattern: /\bmakes an attempt to\b/gi, replacement: "attempts to" },
  { pattern: /\bmade an attempt to\b/gi, replacement: "attempted to" },
  { pattern: /\bmaking an attempt to\b/gi, replacement: "attempting to" },
  // have an effect on
  { pattern: /\bhave an effect on\b/gi, replacement: "affect" },
  { pattern: /\bhas an effect on\b/gi, replacement: "affects" },
  { pattern: /\bhad an effect on\b/gi, replacement: "affected" },
  { pattern: /\bhaving an effect on\b/gi, replacement: "affecting" },
  // have a discussion about
  { pattern: /\bhave a discussion about\b/gi, replacement: "discuss" },
  { pattern: /\bhas a discussion about\b/gi, replacement: "discusses" },
  { pattern: /\bhad a discussion about\b/gi, replacement: "discussed" },
  { pattern: /\bhaving a discussion about\b/gi, replacement: "discussing" },
  // do an analysis of
  { pattern: /\bdo an analysis of\b/gi, replacement: "analyze" },
  { pattern: /\bdoes an analysis of\b/gi, replacement: "analyzes" },
  { pattern: /\bdid an analysis of\b/gi, replacement: "analyzed" },
  { pattern: /\bdoing an analysis of\b/gi, replacement: "analyzing" },
  // get in touch with
  { pattern: /\bget in touch with\b/gi, replacement: "contact" },
  { pattern: /\bgets in touch with\b/gi, replacement: "contacts" },
  { pattern: /\bgot in touch with\b/gi, replacement: "contacted" },
  { pattern: /\bgetting in touch with\b/gi, replacement: "contacting" },
];

function detectWeakVerbs(text) {
  const matches = [];
  for (const phrase of WEAK_VERB_PHRASES) {
    for (const m of findMatches(phrase.pattern, text)) {
      const replacement = preserveCase(m.original, phrase.replacement);
      matches.push({
        offset: m.offset,
        length: m.length,
        message: `Weak verb phrase: consider "${replacement}".`,
        replacements: [replacement],
        category: "Prose Style",
      });
    }
  }
  return matches;
}

const LONG_SENTENCE_WORD_LIMIT = 25;
const WORD_TOKEN_REGEX =
  /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+|[-‐‑–—][\p{L}\p{N}]+)*/gu;
const SENTENCE_ABBREVIATIONS = new Set([
  "e.g.",
  "i.e.",
  "inc.",
  "ltd.",
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "fig.",
  "no.",
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "jun.",
  "jul.",
  "aug.",
  "sep.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
  "u.s.",
]);
const NON_PROSE_PREFIX_REGEX =
  /^(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+|```|(?:const|let|var|function|class|import|export)\b)/;
const LEADING_EMOJI_REGEX = /[\u{1f000}-\u{1faff}\u{2600}-\u{27bf}]/u;

function isSentenceBoundary(text, start, index) {
  const character = text[index];
  if (!/[.!?]/.test(character)) return false;

  const next = text[index + 1];
  if (
    character === "." &&
    /\d/.test(text[index - 1] || "") &&
    /\d/.test(next || "")
  ) {
    return false;
  }

  const prefix = text.slice(start, index + 1);
  const token = prefix.match(/([a-z](?:[a-z.]*)\.)$/i)?.[1]?.toLowerCase();
  if (token && SENTENCE_ABBREVIATIONS.has(token)) {
    return false;
  }
  if (
    character === "." &&
    /^[a-z]\.$/i.test(prefix.trim().split(/\s+/).pop() || "") &&
    /^\s+[A-Z]/.test(text.slice(index + 1))
  ) {
    return false;
  }

  if (character === "." && /^\s*\d+\.\s/.test(text.slice(start, index + 2))) {
    return false;
  }

  let end = index + 1;
  while (/[.!?]/.test(text[end] || "")) end += 1;
  while (/["'”’)\]}]/.test(text[end] || "")) end += 1;
  return end === text.length || /\s/.test(text[end]);
}

function getSentenceSpans(text) {
  const spans = [];
  let sentenceStart = 0;

  const addSpan = (end) => {
    const raw = text.slice(sentenceStart, end);
    const leading = raw.search(/\S/);
    if (leading === -1) return;
    const trimmedEnd = raw.trimEnd().length;
    if (trimmedEnd <= leading) return;
    const firstWord = raw.search(/[\p{L}\p{N}]/u);
    const leadingContent =
      firstWord === -1 ? "" : raw.slice(leading, firstWord);
    const contentStart =
      firstWord >= 0 && LEADING_EMOJI_REGEX.test(leadingContent)
        ? firstWord
        : leading;
    const offset = sentenceStart + contentStart;
    spans.push({
      offset,
      length: trimmedEnd - contentStart,
      text: text.slice(offset, sentenceStart + trimmedEnd),
      prefix: raw.slice(0, contentStart),
    });
  };

  let index = 0;
  while (index < text.length) {
    if (text[index] === "\n") {
      addSpan(index);
      sentenceStart = index + 1;
      index += 1;
      continue;
    }

    if (isSentenceBoundary(text, sentenceStart, index)) {
      let end = index + 1;
      while (/[.!?]/.test(text[end] || "")) end += 1;
      while (/["'”’)\]}]/.test(text[end] || "")) end += 1;
      addSpan(end);
      sentenceStart = end;
      index = end;
      continue;
    }

    index += 1;
  }

  addSpan(text.length);
  return spans;
}

function isLikelyNonProse(sentence) {
  const value = `${sentence.prefix || ""}${sentence.text}`.trim();
  return (
    NON_PROSE_PREFIX_REGEX.test(value) ||
    value.includes("```") ||
    /^(?:https?:\/\/|www\.)\S+$/.test(value)
  );
}

function countWords(text) {
  return text.match(WORD_TOKEN_REGEX)?.length || 0;
}

function detectLongSentences(text) {
  const matches = [];
  for (const sentence of getSentenceSpans(text)) {
    if (isLikelyNonProse(sentence)) continue;
    const wordCount = countWords(sentence.text);
    if (wordCount <= LONG_SENTENCE_WORD_LIMIT) continue;

    matches.push({
      offset: sentence.offset,
      length: sentence.length,
      message:
        `Long sentence: ${wordCount} words may be harder to read. ` +
        "Consider splitting it for clarity.",
      replacements: [],
      category: "Prose Style",
    });
  }
  return matches;
}

const FILLER_PATTERNS = [
  {
    pattern:
      /\b(very)\b(?=\s+(?:good|bad|important|big|small|large|difficult|hard|easy|clear|obvious|interesting|useful|helpful|simple|complex|likely|unlikely|necessary|possible|impossible|different|same|sure|true|certain|ready|happy|sad|tired|busy|nice|new|old)\b)/gi,
    message:
      "Filler intensifier: consider using a stronger, more precise word.",
    action: "remove",
  },
  {
    pattern:
      /\b(really)\b(?=\s+(?:good|bad|important|interesting|useful|helpful|simple|complex|likely|unlikely|clear|obvious|like|love|want|need|think|believe|feel|know|understand|enjoy|hate|hope|wish|prefer|seem|matter|work|help)\b)/gi,
    message:
      "Filler intensifier: consider using a stronger, more precise word.",
    action: "remove",
  },
  {
    pattern:
      /\b(just)\b(?=\s+(?:need|want|try|hope|think|feel|have|seem|mean|say|ask|wonder|look|use|make|start|started)\b)/gi,
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
    if (
      openers.length === OPENER_STREAK_MIN &&
      openers.every((w) => w === openers[0])
    ) {
      const fullFirstWord = sentenceList[i].text.trim().match(/\S+/g)[0];
      matches.push({
        offset: sentenceList[i].offset,
        length: sentenceList[i].text.length,
        message:
          "Repetitive sentence openers: " +
          OPENER_STREAK_MIN +
          ' consecutive sentences start with "' +
          fullFirstWord +
          '". Vary your sentence beginnings.',
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
    ...detectWeakVerbs(text),
    ...detectLongSentences(text),
    ...detectFillerWords(text),
    ...detectHedging(text),
    ...detectRepetitiveOpeners(text),
  ];
}

export function extractSentenceContext(text, offset) {
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const sentStart =
    Math.max(
      before.lastIndexOf(". "),
      before.lastIndexOf("! "),
      before.lastIndexOf("? "),
      before.lastIndexOf("\n")
    ) + 1;
  let sentEnd = after.search(/[.!?](?:\s|$)/);
  if (sentEnd === -1) sentEnd = after.length;
  else sentEnd += 1;
  const raw = text.slice(sentStart, offset + sentEnd);
  const trimmed = raw.trim();
  const leadingWS = raw.indexOf(trimmed[0]);
  return {
    text: trimmed,
    offset: sentStart + leadingWS,
    length: trimmed.length,
  };
}
