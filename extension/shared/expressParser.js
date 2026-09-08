// Express in English for the extension. Parse one-call multi-tone JSON
// and gate the tool by model tier. Mirrors the desktop flow in
// frontend/src/expressParser.js, frontend/src/prompts.js, and
// frontend/src/useExpress.js. Keep the three in sync on purpose.
// Use short sentences. Use simple words. No em dashes in this file.

export const EXPRESS_TOOL = "Express in English";

export const EXPRESS_MAX_CHARS = 600;

// Fixed tone list. Keep desktop order so results match across clients.
export const EXPRESS_TONES = [
  "professional",
  "casual",
  "friendly",
  "formal",
  "concise",
];

// Fallback order for a missing tone. Use the closest tone first.
const EXPRESS_FALLBACKS = {
  professional: ["formal", "friendly", "casual", "concise"],
  casual: ["friendly", "professional", "formal", "concise"],
  friendly: ["casual", "professional", "formal", "concise"],
  formal: ["professional", "friendly", "casual", "concise"],
  concise: ["professional", "formal", "friendly", "casual"],
};

const UNKNOWN_LANGUAGE = "Unknown";

// True for the Express tool name. Use it instead of raw strings.
export function isExpressTool(tool) {
  return tool === EXPRESS_TOOL;
}

// Remove markdown fences. Keep the text inside the fence.
function stripCodeFences(value) {
  const text = String(value);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && typeof fenced[1] === "string") {
    return fenced[1].trim();
  }
  return text.replace(/```/g, "").trim();
}

// Get the JSON part from chatter. Find the first { and the last }.
function sliceJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

// Clean a value. Trim it. Swap em and en dashes for commas.
function cleanString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/\u2014/g, ",")
    .replace(/\u2013/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Make a lookup map with lower case keys. Accept mixed case keys.
function lowerKeyMap(source) {
  const map = {};
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return map;
  }
  for (const key of Object.keys(source)) {
    map[String(key).toLowerCase()] = source[key];
  }
  return map;
}

// Make an empty tone set. Use it when input has no usable text.
function emptyTones() {
  return {
    professional: "",
    casual: "",
    friendly: "",
    formal: "",
    concise: "",
  };
}

// Copy one text into all tones. Use it when JSON is unusable.
function singleToneResult(text) {
  const clean = cleanString(text);
  return {
    detectedLanguage: UNKNOWN_LANGUAGE,
    tones: {
      professional: clean,
      casual: clean,
      friendly: clean,
      formal: clean,
      concise: clean,
    },
  };
}

// Fill each empty tone from the closest available tone.
function fillMissingTones(tones) {
  const next = { ...tones };
  for (const tone of EXPRESS_TONES) {
    if (cleanString(next[tone])) {
      next[tone] = cleanString(next[tone]);
      continue;
    }
    next[tone] = "";
    for (const fallback of EXPRESS_FALLBACKS[tone]) {
      const candidate = cleanString(next[fallback] || tones[fallback]);
      if (candidate) {
        next[tone] = candidate;
        break;
      }
    }
  }
  return next;
}

// Parse raw model output for Express in English. Never throw.
export function parseExpressJson(raw) {
  try {
    if (typeof raw !== "string") {
      return { detectedLanguage: UNKNOWN_LANGUAGE, tones: emptyTones() };
    }
    const cleaned = stripCodeFences(raw);
    if (!cleaned) {
      return { detectedLanguage: UNKNOWN_LANGUAGE, tones: emptyTones() };
    }

    let parsed = null;
    const candidate = sliceJsonObject(cleaned);
    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch (e) {
        parsed = null;
      }
    }
    if (parsed === null) {
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        parsed = null;
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return singleToneResult(cleaned);
    }

    const topMap = lowerKeyMap(parsed);
    const languageRaw = topMap["detectedlanguage"];
    const detectedLanguage = cleanString(languageRaw) || UNKNOWN_LANGUAGE;

    // Prefer nested tones. Accept mixed case keys like "Tones".
    // If tones is missing, treat the top object as a flat tone map.
    let toneSource = topMap["tones"];
    if (
      !toneSource ||
      typeof toneSource !== "object" ||
      Array.isArray(toneSource)
    ) {
      toneSource = parsed;
    }
    const toneMap = lowerKeyMap(toneSource);
    const tones = {
      professional: cleanString(toneMap["professional"]),
      casual: cleanString(toneMap["casual"]),
      friendly: cleanString(toneMap["friendly"]),
      formal: cleanString(toneMap["formal"]),
      concise: cleanString(toneMap["concise"]),
    };

    const filled = fillMissingTones(tones);
    const hasTone = EXPRESS_TONES.some((tone) => cleanString(filled[tone]));
    if (!hasTone) {
      // JSON parsed, but no tone text. Keep the language. Give empty tones.
      return { detectedLanguage, tones: filled };
    }
    return { detectedLanguage, tones: filled };
  } catch (e) {
    try {
      return singleToneResult(raw);
    } catch (inner) {
      return { detectedLanguage: UNKNOWN_LANGUAGE, tones: emptyTones() };
    }
  }
}

// Pick the entry gate from a raw /ai/status answer.
// Return run, light, or setup. Small models fail the JSON task,
// so Light stays out. External servers run when reachable.
export function resolveExpressGate(status) {
  try {
    if (!status || typeof status !== "object" || Array.isArray(status)) {
      return "setup";
    }
    const preference =
      status.preference && typeof status.preference === "object"
        ? status.preference
        : {};
    const backend = preference.backend || "auto";
    const active = status.active_backend || "";
    const external =
      backend === "ollama" ||
      backend === "lmstudio" ||
      active === "ollama" ||
      active === "lmstudio";
    if (external) {
      const available =
        backend === "ollama" || active === "ollama"
          ? Boolean(status.ollama_available)
          : Boolean(status.lmstudio_available);
      return available ? "run" : "setup";
    }
    const key = preference.model_key || status.model_key || "2b";
    if (!status.models_ready || typeof status.models_ready !== "object") {
      return "setup";
    }
    if (!status.models_ready[key]) {
      return "setup";
    }
    return key === "0.8b" ? "light" : "run";
  } catch (e) {
    return "setup";
  }
}
