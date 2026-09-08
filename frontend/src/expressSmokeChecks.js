// Offline quality checks for Express smoke results.
// Keep sentences short. Use simple words. No em dashes.

import { EXPRESS_TONES } from "./expressParser.js";

// True when at least four tones use different wording.
export function tonesFeelDistinct(tones) {
  if (!tones || typeof tones !== "object") {
    return false;
  }
  const values = EXPRESS_TONES.map((tone) =>
    String(tones[tone] || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(),
  ).filter(Boolean);
  if (values.length < EXPRESS_TONES.length) {
    return false;
  }
  return new Set(values).size >= 4;
}

// True when Concise is shorter than every other filled tone.
export function conciseIsClearlyShorter(tones) {
  if (!tones || typeof tones !== "object") {
    return false;
  }
  const concise = String(tones.concise || "").trim();
  if (!concise) {
    return false;
  }
  return EXPRESS_TONES.filter((tone) => tone !== "concise").every((tone) => {
    const other = String(tones[tone] || "").trim();
    return !other || concise.length < other.length;
  });
}

// True when Casual uses at least one common contraction.
export function casualUsesContractions(tones) {
  const casual = String(tones?.casual || "");
  return /\b(?:I'm|I've|I'd|I'll|you're|you've|you'd|you'll|we're|we've|we'd|we'll|they're|they've|they'd|they'll|it's|that's|what's|who's|can't|don't|won't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|couldn't|shouldn't|wouldn't)\b/i.test(
    casual,
  );
}

// True when every token appears in at least minTones tone versions.
export function preservesTokens(tones, tokens, minTones = EXPRESS_TONES.length) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return true;
  }
  if (!tones || typeof tones !== "object") {
    return false;
  }
  const needed = Math.min(minTones, EXPRESS_TONES.length);
  return tokens.every((token) => {
    const hits = EXPRESS_TONES.filter((tone) =>
      String(tones[tone] || "").includes(String(token)),
    ).length;
    return hits >= needed;
  });
}

// True when detectedLanguage looks like a real language name.
export function languageLooksValid(detectedLanguage, expectedHint) {
  const value = String(detectedLanguage || "").trim();
  if (!value || value.toLowerCase() === "unknown") {
    return false;
  }
  if (!expectedHint) {
    return true;
  }
  return value.toLowerCase().includes(String(expectedHint).toLowerCase());
}
