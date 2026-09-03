import { describe, it, expect } from "vitest";
import {
  checkProseQuality,
  extractSentenceContext,
} from "../proseQualityEngine.js";
import { computeReadability } from "../readability.js";

describe("checkProseQuality / Passive Voice", () => {
  it("flags 'was made' as passive", () => {
    const text = "The decision was made by the committee.";
    const result = checkProseQuality(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice")
    );
    expect(hit).toBeTruthy();
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe(
      "was made"
    );
  });

  it("flags 'were implemented' as passive", () => {
    const text = "The changes were implemented last week.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice")
    );
    expect(hit).toBeTruthy();
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe(
      "were implemented"
    );
  });

  it("flags 'is being reviewed' as passive", () => {
    const text = "The document is being reviewed by the editor.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice") &&
        text
          .slice(m.offset, m.offset + m.length)
          .toLowerCase()
          .includes("reviewed")
    );
    expect(hit).toBeTruthy();
  });

  it("flags irregular participles like 'was written' and 'have been taken'", () => {
    const result = checkProseQuality(
      "The report was written by her. The items have been taken."
    );
    const hits = result.filter(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice")
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("does not flag stative adjective constructions like 'was excited about' or 'is interested in'", () => {
    const result = checkProseQuality(
      "She was excited about the project and he was interested in music."
    );
    const hits = result.filter(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice")
    );
    expect(hits).toHaveLength(0);
  });

  it("does not flag active voice sentences", () => {
    const result = checkProseQuality(
      "The committee made the decision yesterday."
    );
    const hits = result.filter(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("passive voice")
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
    expect(text.slice(hit.offset, hit.offset + hit.length).toLowerCase()).toBe(
      "on a daily basis"
    );
  });

  it("flags 'at the end of the day' as wordy", () => {
    const text = "At the end of the day, it was the right call.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        text.slice(m.offset, m.offset + m.length).toLowerCase() ===
        "at the end of the day"
    );
    expect(hit).toBeTruthy();
  });

  it("flags 'think outside the box' as cliché", () => {
    const text = "We need to think outside the box on this one.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        text.slice(m.offset, m.offset + m.length).toLowerCase() ===
        "think outside the box"
    );
    expect(hit).toBeTruthy();
    expect(hit.replacements.length).toBeGreaterThanOrEqual(1);
  });
});

describe("checkProseQuality / High-confidence clichés", () => {
  it.each([
    [
      "At this point in time, the plan is clear.",
      "at this point in time",
      "now",
    ],
    [
      "At the present time, the system is stable.",
      "at the present time",
      "now",
    ],
    [
      "The update will arrive in the near future.",
      "in the near future",
      "soon",
    ],
    [
      "In the not too distant future, the tool will improve.",
      "in the not too distant future",
      "soon",
    ],
    [
      "When all is said and done, the result matters.",
      "when all is said and done",
      "ultimately",
    ],
    ["In this day and age, privacy matters.", "in this day and age", "today"],
    ["In today's world, privacy matters.", "in today's world", "today"],
    [
      "In the grand scheme of things, this is minor.",
      "in the grand scheme of things",
      "overall",
    ],
    ["In the long run, consistency wins.", "in the long run", "ultimately"],
    [
      "The same issue appears time and time again.",
      "time and time again",
      "repeatedly",
    ],
    ["The project grew by leaps and bounds.", "by leaps and bounds", "rapidly"],
    [
      "The team discussed the low-hanging fruit.",
      "low-hanging fruit",
      "easy opportunities",
    ],
    [
      "The product's secret sauce is its simplicity.",
      "secret sauce",
      "key advantage",
    ],
    [
      "There is no silver bullet for this problem.",
      "silver bullet",
      "simple solution",
    ],
    [
      "We need a magic bullet for the issue.",
      "magic bullet",
      "simple solution",
    ],
    [
      "The change was a paradigm shift for the team.",
      "paradigm shift",
      "major change",
    ],
    [
      "This option offers the best of both worlds.",
      "best of both worlds",
      "advantages of both",
    ],
    [
      "This is only the tip of the iceberg.",
      "the tip of the iceberg",
      "a small part",
    ],
    [
      "We should address the elephant in the room.",
      "the elephant in the room",
      "an obvious issue",
    ],
    [
      "There is a light at the end of the tunnel.",
      "a light at the end of the tunnel",
      "hope",
    ],
    [
      "The new design is a breath of fresh air.",
      "a breath of fresh air",
      "a refreshing change",
    ],
    [
      "The failure became a blessing in disguise.",
      "a blessing in disguise",
      "an unexpected benefit",
    ],
    ["These errors are a dime a dozen.", "a dime a dozen", "common"],
    ["The exam was a piece of cake.", "a piece of cake", "easy"],
    ["I felt under the weather.", "under the weather", "ill"],
    ["That delay is par for the course.", "par for the course", "expected"],
  ])(
    "detects %s with a useful direct alternative",
    (text, original, replacement) => {
      const result = checkProseQuality(text);
      const hit = result.find(
        (m) =>
          m.category === "Prose Style" &&
          m.message?.toLowerCase().includes("clich") &&
          text.slice(m.offset, m.offset + m.length).toLowerCase() === original
      );

      expect(hit).toBeTruthy();
      expect(hit.replacements.map((value) => value.toLowerCase())).toContain(
        replacement
      );
    }
  );

  it.each([
    ["We need to go the extra mile.", "go the extra mile"],
    ["This change will move the needle.", "move the needle"],
    ["The new design will push the envelope.", "push the envelope"],
    ["We should raise the bar.", "raise the bar"],
    ["They keep moving the goalposts.", "moving the goalposts"],
    ["The policy should level the playing field.", "level the playing field"],
    ["Let's get on the same page.", "on the same page"],
    ["She is in the driver's seat.", "in the driver's seat"],
    ["This is an all hands on deck situation.", "all hands on deck"],
    ["You need to read between the lines.", "read between the lines"],
    ["Let's cut to the chase.", "cut to the chase"],
    ["We have to bite the bullet.", "bite the bullet"],
    ["The reset sent us back to square one.", "back to square one"],
    ["They burn the midnight oil.", "burn the midnight oil"],
    ["We will pull out all the stops.", "pull out all the stops"],
    ["This search is a needle in a haystack.", "needle in a haystack"],
    ["When push comes to shove, we will adapt.", "when push comes to shove"],
    ["The company is on thin ice.", "on thin ice"],
  ])(
    "detects %s without guessing a context-sensitive replacement",
    (text, original) => {
      const result = checkProseQuality(text);
      const hit = result.find(
        (m) =>
          m.category === "Prose Style" &&
          m.message?.toLowerCase().includes("clich") &&
          text.slice(m.offset, m.offset + m.length).toLowerCase() === original
      );

      expect(hit).toBeTruthy();
      expect(hit.replacements).toEqual([]);
    }
  );

  it("does not flag ordinary wording or partial phrase matches as clichés", () => {
    const text =
      "The meeting happened today. The present time zone is UTC. " +
      "The near-future forecast is uncertain. The team agreed on the plan. " +
      "The report describes a major change and a small part of the process.";
    const result = checkProseQuality(text);

    expect(
      result.filter(
        (m) =>
          m.category === "Prose Style" &&
          m.message?.toLowerCase().includes("clich")
      )
    ).toHaveLength(0);
  });

  it("preserves capitalization in direct cliché replacements", () => {
    const text = "At this point in time, the plan is clear.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        text.slice(m.offset, m.offset + m.length).toLowerCase() ===
        "at this point in time"
    );

    expect(hit).toBeTruthy();
    expect(hit.replacements[0]).toBe("Now");
  });

  it("does not double-flag the fixed expression 'when all is said and done' as passive", () => {
    const result = checkProseQuality(
      "When all is said and done, the result matters."
    );

    expect(
      result.filter((m) => m.message?.toLowerCase().includes("passive voice"))
    ).toHaveLength(0);
  });

  it("preserves UTF-16-compatible JavaScript offsets for new cliché matches", () => {
    const text = "😀 At this point in time, the plan is clear.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.message?.toLowerCase().includes("clich") &&
        text.slice(m.offset, m.offset + m.length).toLowerCase() ===
          "at this point in time"
    );

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(3);
    expect(hit.length).toBe("at this point in time".length);
  });
});

describe("checkProseQuality / Weak verbs", () => {
  it.each([
    ["We make use of the tool.", "make use of", "use"],
    ["Make use of the tool.", "Make use of", "Use"],
    ["MAKE USE OF THE TOOL.", "MAKE USE OF", "USE"],
    ["The team makes use of the tool.", "makes use of", "uses"],
    ["The team made use of the tool.", "made use of", "used"],
    ["The team is making use of the tool.", "making use of", "using"],
    ["They make a decision to proceed.", "make a decision to", "decide to"],
    ["She made a decision to proceed.", "made a decision to", "decided to"],
    ["He makes a decision to proceed.", "makes a decision to", "decides to"],
    [
      "They are making a decision to proceed.",
      "making a decision to",
      "deciding to",
    ],
    ["They make an attempt to fix it.", "make an attempt to", "attempt to"],
    ["She made an attempt to fix it.", "made an attempt to", "attempted to"],
    ["He makes an attempt to fix it.", "makes an attempt to", "attempts to"],
    [
      "They are making an attempt to fix it.",
      "making an attempt to",
      "attempting to",
    ],
    [
      "These changes have an effect on performance.",
      "have an effect on",
      "affect",
    ],
    [
      "This change has an effect on performance.",
      "has an effect on",
      "affects",
    ],
    [
      "The change had an effect on performance.",
      "had an effect on",
      "affected",
    ],
    [
      "The change is having an effect on performance.",
      "having an effect on",
      "affecting",
    ],
    ["We have a discussion about scope.", "have a discussion about", "discuss"],
    [
      "She has a discussion about scope.",
      "has a discussion about",
      "discusses",
    ],
    [
      "They had a discussion about scope.",
      "had a discussion about",
      "discussed",
    ],
    [
      "They are having a discussion about scope.",
      "having a discussion about",
      "discussing",
    ],
    ["We do an analysis of the data.", "do an analysis of", "analyze"],
    ["She does an analysis of the data.", "does an analysis of", "analyzes"],
    ["They did an analysis of the data.", "did an analysis of", "analyzed"],
    [
      "They are doing an analysis of the data.",
      "doing an analysis of",
      "analyzing",
    ],
    ["We get in touch with support.", "get in touch with", "contact"],
    ["She gets in touch with support.", "gets in touch with", "contacts"],
    ["They got in touch with support.", "got in touch with", "contacted"],
    [
      "They are getting in touch with support.",
      "getting in touch with",
      "contacting",
    ],
  ])(
    "flags %s with an inflection-safe replacement",
    (text, original, replacement) => {
      const result = checkProseQuality(text);
      const hit = result.find(
        (m) =>
          m.category === "Prose Style" &&
          m.message?.toLowerCase().includes("weak verb") &&
          text.slice(m.offset, m.offset + m.length).toLowerCase() ===
            original.toLowerCase()
      );

      expect(hit).toBeTruthy();
      expect(hit.replacements).toEqual([replacement]);
      expect(hit.action).toBeUndefined();
    }
  );

  it.each([
    ["She makes a cake.", "make"],
    ["They made progress quickly.", "made"],
    ["We get access to the report.", "get"],
    ["I do research every day.", "do"],
    ["They have a meeting today.", "have"],
    ["We make a decision about the launch.", "make a decision"],
    ["She makes an attempt at the fix.", "makes an attempt"],
    ["We have a discussion with the vendor.", "have a discussion"],
    ["They do an analysis for the report.", "do an analysis"],
    ["We get in touch about the issue.", "get in touch"],
    ["They made-use-of the tool.", "made-use-of"],
    ["They attempted to fix it.", "attempted to"],
    ["She discusses scope.", "discusses"],
    ["They analyzed the data.", "analyzed"],
    ["We contacted support.", "contacted"],
    ["We make\nuse of the tool.", "make\nuse"],
    ["We use the tool and contact support.", "use"],
  ])("does not flag %s as a weak-verb collocation", (text) => {
    const result = checkProseQuality(text);

    expect(
      result.filter((m) => m.message?.toLowerCase().includes("weak verb"))
    ).toHaveLength(0);
  });

  it("preserves UTF-16-compatible offsets for weak-verb matches", () => {
    const text = "😀 They got in touch with support.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.message?.toLowerCase().includes("weak verb") &&
        text.slice(m.offset, m.offset + m.length).toLowerCase() ===
          "got in touch with"
    );

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(8);
    expect(hit.length).toBe("got in touch with".length);
    expect(hit.replacements).toEqual(["contacted"]);
  });
});

describe("checkProseQuality / Sentence length", () => {
  const twentyWordSentence =
    "The research team reviewed the proposal and identified several practical improvements before recommending approval to the board during Monday's meeting.";
  const twentyFiveWordSentence =
    "The research team reviewed the proposal and identified several practical improvements before recommending approval to the board during Monday's meeting with stakeholders from every department.";
  const twentySixWordSentence =
    "The research team reviewed the proposal and identified several practical improvements before recommending approval to the board during Monday's meeting with stakeholders from every department today.";

  function findLongSentenceHit(text) {
    return checkProseQuality(text).find(
      (match) =>
        match.category === "Prose Style" &&
        match.message?.toLowerCase().includes("long sentence")
    );
  }

  it("flags a sentence longer than 25 words", () => {
    const hit = findLongSentenceHit(twentySixWordSentence);

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(0);
    expect(hit.length).toBe(twentySixWordSentence.length);
    expect(
      twentySixWordSentence.slice(hit.offset, hit.offset + hit.length)
    ).toBe(twentySixWordSentence);
    expect(hit.replacements).toEqual([]);
    expect(hit.action).toBeUndefined();
  });

  it("does not flag a sentence at the 25-word threshold", () => {
    expect(findLongSentenceHit(twentyFiveWordSentence)).toBeUndefined();
  });

  it("does not flag a 20-word sentence", () => {
    expect(findLongSentenceHit(twentyWordSentence)).toBeUndefined();
  });

  it("flags only the long sentence and preserves its document offset", () => {
    const text = `Short opening. ${twentySixWordSentence} Final note.`;
    const hit = findLongSentenceHit(text);

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe("Short opening. ".length);
    expect(hit.length).toBe(twentySixWordSentence.length);
  });

  it("handles a final sentence without terminal punctuation", () => {
    const text = twentySixWordSentence.slice(0, -1);
    const hit = findLongSentenceHit(text);

    expect(hit).toBeTruthy();
    expect(hit.length).toBe(text.length);
  });

  it("does not combine separate paragraphs into one long sentence", () => {
    const text =
      "The research team reviewed the proposal and identified\n" +
      "several improvements before recommending approval to the board during Monday's meeting";

    expect(findLongSentenceHit(text)).toBeUndefined();
  });

  it("does not split long sentences at abbreviations or decimal numbers", () => {
    const text =
      "The review by Dr. Smith covered the proposal, the implementation details, the migration risks, and the testing strategy before the team approved version 3.14 for release today.";
    const hit = findLongSentenceHit(text);

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(0);
    expect(hit.length).toBe(text.length);
  });

  it.each([
    `- Review the proposal and identify several practical improvements before recommending approval to the board during Monday's meeting with stakeholders tomorrow morning during the final review session`,
    `# Review the proposal and identify several practical improvements before recommending approval to the board during Monday's meeting with stakeholders tomorrow during the final review session`,
  ])("does not flag non-prose lines: %s", (text) => {
    expect(findLongSentenceHit(text)).toBeUndefined();
  });

  it("preserves UTF-16-compatible offsets for long sentences", () => {
    const text = `😀 ${twentySixWordSentence}`;
    const hit = findLongSentenceHit(text);

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(3);
    expect(hit.length).toBe(twentySixWordSentence.length);
  });
});

describe("checkProseQuality / Filler & Hedging", () => {
  it.each([
    ["This is very important.", "very"],
    ["I really like this idea.", "really"],
    ["Actually, the plan works.", "Actually"],
    ["We just need a minute.", "just"],
  ])("flags likely filler language in %s", (text, original) => {
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("filler") &&
        text.slice(m.offset, m.offset + m.length) === original
    );

    expect(hit).toBeTruthy();
    expect(hit.replacements).toEqual([""]);
    expect(hit.action).toBe("remove");
  });

  it.each([
    ["I think this is useful.", "I think", false],
    ["It seems that the plan works.", "It seems", false],
    ["Perhaps we should wait.", "Perhaps", true],
    ["The plan might be delayed.", "might be", false],
    ["The result is probably correct.", "probably", true],
  ])("flags hedging language in %s", (text, original, isRemovable) => {
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("hedg") &&
        text.slice(m.offset, m.offset + m.length) === original
    );

    expect(hit).toBeTruthy();
    if (isRemovable) {
      expect(hit.replacements).toEqual([""]);
      expect(hit.action).toBe("remove");
    } else {
      expect(hit.replacements).toEqual([]);
      expect(hit.action).toBeUndefined();
    }
  });

  it("does not flag context-dependent words when they are not acting as filler or hedges", () => {
    const text =
      "The very idea surprised me. I just arrived. The system actually works. Could you review this?";
    const result = checkProseQuality(text);

    expect(
      result.filter(
        (m) =>
          m.message?.toLowerCase().includes("filler") ||
          m.message?.toLowerCase().includes("hedg")
      )
    ).toHaveLength(0);
  });

  it("preserves UTF-16-compatible JavaScript offsets for filler matches", () => {
    const text = "😀 Actually, the plan works.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.message?.toLowerCase().includes("filler") &&
        text.slice(m.offset, m.offset + m.length) === "Actually"
    );

    expect(hit).toBeTruthy();
    expect(hit.offset).toBe(3);
    expect(hit.length).toBe("Actually".length);
  });
});

describe("checkProseQuality / Repetitive Openers", () => {
  it("flags 3 consecutive sentences with the same opener", () => {
    const text =
      "The cat sat on the mat. The dog ran outside. The bird flew away.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hit).toBeTruthy();
  });

  it("does not flag 2 sentences with the same opener", () => {
    const text = "The cat sat on the mat. The dog ran outside.";
    const result = checkProseQuality(text);
    const hits = result.filter((m) =>
      m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hits).toHaveLength(0);
  });

  it("flags 3 consecutive sentences with mixed-case openers", () => {
    const text =
      "The cat sat on the mat. the dog ran outside. THE bird flew away.";
    const result = checkProseQuality(text);
    const hit = result.find(
      (m) =>
        m.category === "Prose Style" &&
        m.message?.toLowerCase().includes("repetitive sentence openers")
    );
    expect(hit).toBeTruthy();
  });

  it("does not flag varied openers even with many sentences", () => {
    const text =
      "The cat sat on the mat. A dog ran outside. That bird flew away.";
    const result = checkProseQuality(text);
    const hits = result.filter((m) =>
      m.message?.toLowerCase().includes("repetitive sentence openers")
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
    const result = computeReadability(
      "The cat sat on the mat. The dog ran outside."
    );
    expect(result.readingTime).not.toBe("0:00");
  });

  it("returns a speaking time greater than zero for non-empty text", () => {
    const result = computeReadability(
      "The cat sat on the mat. The dog ran outside."
    );
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
    const result = checkProseQuality(
      "The quick brown fox jumps over the lazy dog."
    );
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
