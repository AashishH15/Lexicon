import { describe, it, expect } from "vitest";
import { checkProseQuality, extractSentenceContext } from "../proseQualityEngine.js";
import { computeReadability } from "../readability.js";

describe("checkProseQuality / Passive Voice", () => {
  it("flags 'was made' as passive", () => {
    const text = "The decision was made by the committee.";
    const result = checkProseQuality(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const hit = result.find(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice")
    );
    expect(hit).toBeTruthy();
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe("was made");
  });

  it("flags 'were implemented' as passive", () => {
    const text = "The changes were implemented last week.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice")
    );
    expect(hit).toBeTruthy();
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe("were implemented");
  });

  it("flags 'is being reviewed' as passive", () => {
    const text = "The document is being reviewed by the editor.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice") &&
        text.slice(m.offset, m.offset + m.length).toLowerCase().includes("reviewed")
    );
    expect(hit).toBeTruthy();
  });

  it("flags irregular participles like 'was written' and 'have been taken'", () => {
    const result = checkProseQuality("The report was written by her. The items have been taken.");
    const hits = result.filter(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice")
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("does not flag stative adjective constructions like 'was excited about' or 'is interested in'", () => {
    const result = checkProseQuality("She was excited about the project and he was interested in music.");
    const hits = result.filter(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice")
    );
    expect(hits).toHaveLength(0);
  });

  it("does not flag active voice sentences", () => {
    const result = checkProseQuality("The committee made the decision yesterday.");
    const hits = result.filter(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("passive voice")
    );
    expect(hits).toHaveLength(0);
  });
});

describe("checkProseQuality / Clichés & Wordiness", () => {
  it("flags 'in order to' with replacement 'to'", () => {
    const text = "She studied hard in order to pass the exam.";
    const result = checkProseQuality(text);
    const hit = result.find((m) => m.replacements?.includes("to"));
    expect(hit).toBeTruthy();
  });

  it("flags 'due to the fact that' with replacement 'because'", () => {
    const text = "The event was canceled due to the fact that it rained.";
    const result = checkProseQuality(text);
    const hit = result.find((m) => m.replacements?.includes("because"));
    expect(hit).toBeTruthy();
  });

  it("flags 'on a daily basis' with replacement suggestion", () => {
    const text = "He exercises on a daily basis.";
    const result = checkProseQuality(text);
    const hit = result.find((m) => m.replacements?.length >= 1);
    expect(hit).toBeTruthy();
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe("on a daily basis");
  });

  it("flags 'at the end of the day' as wordy", () => {
    const text = "At the end of the day, it was the right call.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => text.slice(m.offset, m.offset + m.length).toLowerCase() === "at the end of the day"
    );
    expect(hit).toBeTruthy();
  });

  it("flags 'think outside the box' as cliché", () => {
    const text = "We need to think outside the box on this one.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => text.slice(m.offset, m.offset + m.length).toLowerCase() === "think outside the box"
    );
    expect(hit).toBeTruthy();
    expect(hit.replacements.length).toBeGreaterThanOrEqual(1);
  });
});

describe("checkProseQuality / Repetitive Openers", () => {
  it("flags 3 consecutive sentences with the same opener", () => {
    const text = "The cat sat on the mat. The dog ran outside. The bird flew away.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hit).toBeTruthy();
  });

  it("does not flag 2 sentences with the same opener", () => {
    const text = "The cat sat on the mat. The dog ran outside.";
    const result = checkProseQuality(text);
    const hits = result.filter(
      (m) => m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hits).toHaveLength(0);
  });

  it("flags 3 consecutive sentences with mixed-case openers", () => {
    const text = "The cat sat on the mat. the dog ran outside. THE bird flew away.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) => m.category === "Prose Style" && m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hit).toBeTruthy();
  });

  it("does not flag varied openers even with many sentences", () => {
    const text = "The cat sat on the mat. A dog ran outside. That bird flew away.";
    const result = checkProseQuality(text);
    const hits = result.filter(
      (m) => m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hits).toHaveLength(0);
  });
});

describe("extractSentenceContext", () => {
  it("returns the full sentence for a mid-sentence offset", () => {
    const text = "The committee reviewed the report. It was approved quickly.";
    const offset = text.indexOf("was approved");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe("It was approved quickly.");
    expect(ctx.offset).toBe(text.indexOf("It"));
    expect(ctx.length).toBe("It was approved quickly.".length);
  });

  it("handles offset at the start of a sentence", () => {
    const text = "First sentence here. Second one right here.";
    const offset = text.indexOf("Second");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe("Second one right here.");
  });

  it("handles exclamation and question mark sentence boundaries", () => {
    const text = "What happened! It was fixed quickly. Are you sure?";
    const offset = text.indexOf("was fixed");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe("It was fixed quickly.");
    expect(ctx.offset).toBe(text.indexOf("It"));
    expect(ctx.length).toBe("It was fixed quickly.".length);
  });

  it("handles offset in the last sentence with no trailing punctuation", () => {
    const text = "Hello world. How are you today";
    const offset = text.indexOf("are");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe("How are you today");
    expect(ctx.offset).toBe(text.indexOf("How"));
    expect(ctx.length).toBe("How are you today".length);
  });

  it("returns earliest sentence when there is no prior punctuation", () => {
    const text = "This is just one long sentence without punctuation";
    const offset = text.indexOf("just");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe(text.trim());
    expect(ctx.offset).toBe(0);
    expect(ctx.length).toBe(text.length);
  });

  it("handles newline sentence boundaries", () => {
    const text = "First paragraph.\nSecond paragraph here.";
    const offset = text.indexOf("Second paragraph");
    const ctx = extractSentenceContext(text, offset);
    expect(ctx.text).toBe("Second paragraph here.");
  });
});

describe("computeReadability", () => {
  it("returns zeros and dashes for empty input", () => {
    const result = computeReadability("");
    expect(result.wordCount).toBe(0);
    expect(result.charCount).toBe(0);
    expect(result.gradeLabel).toBe("-");
  });

  it("returns correct word and char counts for a simple sentence", () => {
    const result = computeReadability("The cat sat on the mat.");
    expect(result.wordCount).toBe(6);
    expect(result.charCount).toBe(23);
  });

  it("returns a reading time greater than zero for non-empty text", () => {
    const result = computeReadability("The cat sat on the mat. The dog ran outside.");
    expect(result.readingTime).not.toBe("0:00");
  });

  it("returns a speaking time greater than zero for non-empty text", () => {
    const result = computeReadability("The cat sat on the mat. The dog ran outside.");
    expect(result.speakingTime).not.toBe("0:00");
  });

  it("returns Grade 1 for very simple text", () => {
    const result = computeReadability("He ran. She slept. It was good.");
    expect(result.gradeLabel).toBe("Grade 1");
  });

  it("returns a higher grade level for complex text", () => {
    const result = computeReadability(
      "The implementation of comprehensive policies significantly augmented operational efficiency across multiple departments."
    );
    expect(result.gradeLabel).toBe("Graduate");
  });
});

describe("Edge Cases & Hygiene", () => {
  it("returns empty array for empty string", () => {
    expect(checkProseQuality("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(checkProseQuality("   ")).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(checkProseQuality(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(checkProseQuality(undefined)).toEqual([]);
  });

  it("returns empty array for text with no issues", () => {
    const result = checkProseQuality("The quick brown fox jumps over the lazy dog.");
    expect(result).toEqual([]);
  });

  it("computeReadability handles null input", () => {
    const result = computeReadability(null);
    expect(result.wordCount).toBe(0);
    expect(result.gradeLabel).toBe("-");
  });

  it("computeReadability handles undefined input", () => {
    const result = computeReadability(undefined);
    expect(result.wordCount).toBe(0);
  });

  it("computeReadability handles whitespace-only input", () => {
    const result = computeReadability("   ");
    expect(result.wordCount).toBe(0);
  });
});
