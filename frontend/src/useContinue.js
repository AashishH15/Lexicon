import { useCallback, useRef, useState } from "react";
import useTransform from "./useTransform.js";
import { CONTINUE_TOOL_NAME, promptForTool } from "./prompts.js";

// Trailing draft slice sent as continuation context.
export const CONTINUE_CONTEXT_CHARS = 800;
// Sampling favors varied continuations over deterministic rewrites.
// Presets stay wide apart so each step reads differently. Ghost text
// errs precise: a wrong-but-boring suggestion dismisses quietly,
// while a wild one reads as broken.
export const CONTINUE_TEMPERATURES = Object.freeze({
  precise: 0.2,
  balanced: 0.4,
  bold: 0.6,
});
export const CONTINUE_TEMPERATURE_PRESETS = ["precise", "balanced", "bold"];
export const CONTINUE_TEMPERATURE_DEFAULT = "balanced";
export const CONTINUE_TEMPERATURE_KEY = "lexicon:continueTemperature";
export const CONTINUE_MAX_TOKENS = 120;
// Length presets for the suggestion. Auto keeps current behavior.
export const CONTINUE_LENGTHS = ["auto", "sentence", "paragraph"];
// Idle pause before auto continue fires, when enabled.
export const CONTINUE_IDLE_MS = 8000;
export const CONTINUE_LENGTH_KEY = "lexicon:continueLength";
export const CONTINUE_AUTO_KEY = "lexicon:continueAuto";
export const CONTINUE_IDLE_KEY = "lexicon:continueIdleSeconds";
export const CONTINUE_IDLE_MIN_SECONDS = 5;
export const CONTINUE_IDLE_MAX_SECONDS = 60;
export const CONTINUE_IDLE_STEP_SECONDS = 5;
export const CONTINUE_IDLE_DEFAULT_SECONDS = 10;

export function loadContinueLength() {
  try {
    const saved = localStorage.getItem(CONTINUE_LENGTH_KEY);
    return CONTINUE_LENGTHS.includes(saved) ? saved : "auto";
  } catch {
    return "auto";
  }
}

export function loadContinueAuto() {
  try {
    return localStorage.getItem(CONTINUE_AUTO_KEY) === "true";
  } catch {
    return false;
  }
}

export function loadContinueTemperature() {
  try {
    const saved = localStorage.getItem(CONTINUE_TEMPERATURE_KEY);
    return CONTINUE_TEMPERATURE_PRESETS.includes(saved)
      ? saved
      : CONTINUE_TEMPERATURE_DEFAULT;
  } catch {
    return CONTINUE_TEMPERATURE_DEFAULT;
  }
}

export function continueTemperatureValue(preset) {
  return CONTINUE_TEMPERATURES[preset] ?? CONTINUE_TEMPERATURES[CONTINUE_TEMPERATURE_DEFAULT];
}

export function loadContinueIdleSeconds() {
  try {
    const raw = localStorage.getItem(CONTINUE_IDLE_KEY);
    if (raw == null || !String(raw).trim()) {
      return CONTINUE_IDLE_DEFAULT_SECONDS;
    }
    return snapContinueIdleSeconds(raw);
  } catch {
    return CONTINUE_IDLE_DEFAULT_SECONDS;
  }
}

// Idle delays snap to 5s steps inside 5 to 60 seconds.
export function snapContinueIdleSeconds(value) {
  const stepped =
    Math.round(Number(value) / CONTINUE_IDLE_STEP_SECONDS) *
    CONTINUE_IDLE_STEP_SECONDS;
  if (!Number.isFinite(stepped)) {
    return CONTINUE_IDLE_DEFAULT_SECONDS;
  }
  return Math.min(
    CONTINUE_IDLE_MAX_SECONDS,
    Math.max(CONTINUE_IDLE_MIN_SECONDS, stepped),
  );
}

// Length instruction appended to the base prompt. Silent for auto.
// Paragraph mode always asks for about three sentences so output stays
// predictable; a full block starts fresh instead. Truncation backstops
// custom prompts at ten sentences for research-length paragraphs.
export const CONTINUE_PARAGRAPH_SENTENCES = 3;
export const CONTINUE_PARAGRAPH_MAX_SENTENCES = 10;
// A block this long already holds a full paragraph.
export const CONTINUE_FULL_BLOCK_SENTENCES = 5;

export function continueLengthPrompt(length, options = {}) {
  if (length === "sentence") {
    return " Complete only the current unfinished sentence. Stop at the first sentence end.";
  }
  if (length === "paragraph") {
    if (options.fresh) {
      return " Start a fresh paragraph that follows naturally from the draft above. Do not continue the current paragraph.";
    }
    return " Continue with about 3 sentences.";
  }
  return "";
}

export function continueMaxTokens(length) {
  if (length === "sentence") {
    return 40;
  }
  if (length === "paragraph") {
    return 300;
  }
  return CONTINUE_MAX_TOKENS;
}

// Keep the first N sentences of model output. Prompts ask, this
// enforces: small models overshoot "at most" freely.
export function truncateSentences(text, count) {
  const source = String(text ?? "");
  const limit = Number.isInteger(count) && count > 0 ? count : 1;
  const ends = [];
  const pattern = /[^.!?…]+[.!?…]+["”']?/g;
  let match = pattern.exec(source);
  while (match && ends.length < limit) {
    ends.push(match.index + match[0].length);
    match = pattern.exec(source);
  }
  if (ends.length === 0) {
    return source;
  }
  return source.slice(0, ends[ends.length - 1]).trimEnd();
}

// Sentences still missing for a full paragraph at the cursor. Never
// below one so a finished block still gets a short follow-up.
export function paragraphBudget(fullText, pos) {
  const text = String(fullText ?? "");
  const at = Number.isInteger(pos)
    ? Math.max(0, Math.min(pos, text.length))
    : text.length;
  const blocks = [];
  let start = 0;
  for (const part of text.split(/\n\s*\n/)) {
    blocks.push({ start, end: start + part.length });
    start += part.length + 2;
  }
  const block = blocks.find((span) => at >= span.start && at <= span.end) || {
    start: at,
    end: at,
  };
  const body = text.slice(block.start, block.end);
  const sentences = body.match(/[^.!?…]+[.!?…]+["”']?/g) || [];
  return {
    blockSentences: sentences.length,
    full: sentences.length >= CONTINUE_FULL_BLOCK_SENTENCES,
  };
}

// Trailing slice of the draft before the cursor. Blank when there is
// nothing to continue from.
export function continueContext(fullText, pos) {
  const text = String(fullText ?? "");
  const at = Number.isInteger(pos)
    ? Math.max(0, Math.min(pos, text.length))
    : text.length;
  const slice = text.slice(Math.max(0, at - CONTINUE_CONTEXT_CHARS), at);
  return slice.trim() ? slice : "";
}

// Small models restate the draft tail before continuing. Strip a
// repeated tail word-wise so the ghost only holds new words. Needs at
// least two shared words; single shared words continue legitimately.
export function stripEchoedPrefix(context, suggestion) {
  const source = String(suggestion ?? "");
  const norm = (word) =>
    String(word ?? "")
      .toLowerCase()
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  const ctxWords = String(context ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(norm);
  if (ctxWords.length === 0) {
    return source;
  }
  const leadingWs = (source.match(/^\s*/) || [""])[0].length;
  const rest = source.slice(leadingWs);
  const sugWords = rest.split(/\s+/).filter(Boolean);
  const maxN = Math.min(ctxWords.length, sugWords.length);
  for (let n = maxN; n >= 2; n -= 1) {
    let shared = true;
    for (let i = 0; i < n; i += 1) {
      const hit = norm(sugWords[i]);
      if (!hit || hit !== ctxWords[ctxWords.length - n + i]) {
        shared = false;
        break;
      }
    }
    if (!shared) {
      continue;
    }
    let idx = 0;
    for (let count = 0; count < n; count += 1) {
      while (idx < rest.length && /\s/.test(rest[idx])) {
        idx += 1;
      }
      while (idx < rest.length && !/\s/.test(rest[idx])) {
        idx += 1;
      }
    }
    while (idx < rest.length && /\s/.test(rest[idx])) {
      idx += 1;
    }
    return rest.slice(idx);
  }
  return source;
}

export default function useContinue() {
  const transform = useTransform();
  const [suggestion, setSuggestion] = useState("");
  const [anchor, setAnchor] = useState(null);
  const anchorRef = useRef(null);

  const dismiss = useCallback(() => {
    anchorRef.current = null;
    setAnchor(null);
    setSuggestion("");
  }, []);

  const cancel = useCallback(() => {
    transform.cancel();
    anchorRef.current = null;
    setAnchor(null);
    setSuggestion("");
  }, [transform]);

  const request = useCallback(
    async ({ fullText, pos, language, length, temperature }) => {
      const snapshotText = String(fullText ?? "");
      const context = continueContext(snapshotText, pos);
      if (!context) {
        return null;
      }
      const at = Number.isInteger(pos)
        ? Math.max(0, Math.min(pos, snapshotText.length))
        : snapshotText.length;
      const resolvedLength = CONTINUE_LENGTHS.includes(length)
        ? length
        : loadContinueLength();
      const budget =
        resolvedLength === "paragraph"
          ? paragraphBudget(snapshotText, at)
          : null;
      const fresh = Boolean(budget && budget.full);
      const variant = { fresh };
      const resolvedTemperature = CONTINUE_TEMPERATURE_PRESETS.includes(temperature)
        ? temperature
        : loadContinueTemperature();
      const text = await transform.run({
        prompt:
          promptForTool(CONTINUE_TOOL_NAME, language) +
          continueLengthPrompt(resolvedLength, variant),
        text: context,
        temperature: continueTemperatureValue(resolvedTemperature),
        maxTokens: continueMaxTokens(resolvedLength, variant),
      });
      const echoed =
        typeof text === "string" ? stripEchoedPrefix(context, text) : "";
      // Sentence, paragraph, and auto modes cap output client-side.
      // Prompts ask, this enforces: small models overshoot freely.
      // Paragraph caps at ten so custom prompts can run research-long.
      const capped =
        resolvedLength === "sentence"
          ? truncateSentences(echoed, 1)
          : resolvedLength === "paragraph"
            ? truncateSentences(echoed, CONTINUE_PARAGRAPH_MAX_SENTENCES)
            : truncateSentences(echoed, CONTINUE_PARAGRAPH_SENTENCES);
      if (!capped.trim()) {
        return null;
      }
      anchorRef.current = { snapshotText, pos: at };
      setAnchor(anchorRef.current);
      setSuggestion(capped);
      return { text: capped, snapshotText, pos: at };
    },
    [transform],
  );

  return {
    suggestion,
    anchor,
    status: transform.status,
    error: transform.error,
    request,
    dismiss,
    cancel,
  };
}
