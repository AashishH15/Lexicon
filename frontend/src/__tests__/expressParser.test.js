import { describe, expect, it } from "vitest";
import { getExpressPrompt } from "../prompts.js";
import { EXPRESS_TONES, parseExpressJson } from "../expressParser.js";

const SAMPLES = {
  spanish: "Estoy muy contento con los resultados del proyecto.",
  german: "Ich freue mich sehr ueber die Ergebnisse.",
  chinese: "这个项目的结果让我很满意。",
  english: "I am happy with the project results.",
};

describe("getExpressPrompt", () => {
  it("returns a string prompt for each sample input", () => {
    for (const text of Object.values(SAMPLES)) {
      const prompt = getExpressPrompt(text);
      expect(typeof prompt).toBe("string");
      expect(prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("asks for idiomatic English, not word for word translation", () => {
    const prompt = getExpressPrompt(SAMPLES.spanish).toLowerCase();
    expect(prompt).toMatch(/idiomatic/);
    expect(prompt).toMatch(/word for word/);
  });

  it("asks for exact JSON keys with a mini template", () => {
    const prompt = getExpressPrompt(SAMPLES.german);
    expect(prompt).toContain("detectedLanguage");
    expect(prompt).toContain("tones");
    for (const tone of ["auto", "professional", "casual", "friendly", "formal", "concise"]) {
      expect(prompt).toContain(`"${tone}"`);
    }
  });

  it("asks the model to detect the source language", () => {
    const prompt = getExpressPrompt(SAMPLES.chinese).toLowerCase();
    expect(prompt).toMatch(/detect/);
  });

  it("covers already English input as a style set", () => {
    const prompt = getExpressPrompt(SAMPLES.english).toLowerCase();
    expect(prompt).toMatch(/already.*english|english.*refine|style/);
  });

  it("asks to keep names, numbers, and intent with no new facts", () => {
    const prompt = getExpressPrompt(SAMPLES.spanish).toLowerCase();
    expect(prompt).toMatch(/names/);
    expect(prompt).toMatch(/numbers/);
    expect(prompt).toMatch(/no.*fact|do not add|do not invent/);
  });

  it("asks for short output with no preamble or markdown", () => {
    const prompt = getExpressPrompt(SAMPLES.spanish).toLowerCase();
    expect(prompt).toMatch(/no preamble|only.*json/);
    expect(prompt).toMatch(/no markdown|no code fence|no fence/);
  });

  it("gives tone guidance for casual, concise, and professional", () => {
    const prompt = getExpressPrompt(SAMPLES.spanish).toLowerCase();
    expect(prompt).toMatch(/contraction/);
    expect(prompt).toMatch(/shorter/);
    expect(prompt).toMatch(/workplace/);
  });

  it("asks auto to match the source register with no added flair", () => {
    const prompt = getExpressPrompt(SAMPLES.spanish).toLowerCase();
    expect(prompt).toMatch(/auto/);
    expect(prompt).toMatch(/faithful/);
  });

  it("uses no em dashes in the prompt", () => {
    expect(getExpressPrompt(SAMPLES.spanish)).not.toContain(String.fromCharCode(8212));
  });
});

describe("EXPRESS_TONES", () => {
  it("lists the six tones with auto first", () => {
    expect(EXPRESS_TONES).toEqual(["auto", "professional", "casual", "friendly", "formal", "concise"]);
  });
});

function fullTones(overrides = {}) {
  return {
    auto: "Auto text.",
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
    ...overrides,
  };
}

function rawJson(detectedLanguage = "Spanish", tones = fullTones()) {
  return JSON.stringify({ detectedLanguage, tones });
}

describe("parseExpressJson happy path", () => {
  it("parses pure JSON", () => {
    const result = parseExpressJson(rawJson());
    expect(result.detectedLanguage).toBe("Spanish");
    expect(result.tones.auto).toBe("Auto text.");
    expect(result.tones.professional).toBe("Professional text.");
    expect(result.tones.casual).toBe("Casual text.");
    expect(result.tones.friendly).toBe("Friendly text.");
    expect(result.tones.formal).toBe("Formal text.");
    expect(result.tones.concise).toBe("Concise text.");
  });

  it("strips markdown fences", () => {
    const raw = "```json\n" + rawJson("German") + "\n```";
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("German");
    expect(result.tones.professional).toBe("Professional text.");
  });

  it("strips plain fences without a language tag", () => {
    const raw = "```\n" + rawJson("French") + "\n```";
    expect(parseExpressJson(raw).detectedLanguage).toBe("French");
  });

  it("tolerates preamble and postscript chatter", () => {
    const raw = "Sure! Here is the result:\n" + rawJson("Chinese") + "\nHope this helps.";
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("Chinese");
    expect(result.tones.concise).toBe("Concise text.");
  });

  it("trims whitespace from language and tone values", () => {
    const raw = JSON.stringify({
      detectedLanguage: "  Spanish  ",
      tones: fullTones({ professional: "  Hello.  " }),
    });
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("Spanish");
    expect(result.tones.professional).toBe("Hello.");
  });

  it("replaces em and en dashes in tone text", () => {
    const em = String.fromCharCode(8212);
    const en = String.fromCharCode(8211);
    const raw = JSON.stringify({
      detectedLanguage: "German",
      tones: fullTones({
        casual: `Hans crushed it in 2024${em}I'm glad.`,
        friendly: `Nice work${en}well done.`,
      }),
    });
    const result = parseExpressJson(raw);
    expect(result.tones.casual).toBe("Hans crushed it in 2024, I'm glad.");
    expect(result.tones.friendly).toBe("Nice work, well done.");
    expect(result.tones.casual).not.toContain(em);
    expect(result.tones.friendly).not.toContain(en);
  });

  it("accepts mixed-case language and tone keys", () => {
    const raw = JSON.stringify({
      DetectedLanguage: "Spanish",
      Tones: {
        Professional: "Pro",
        Casual: "Cas",
        Friendly: "Fri",
        Formal: "For",
        Concise: "Con",
      },
    });
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("Spanish");
    expect(result.tones.professional).toBe("Pro");
    expect(result.tones.casual).toBe("Cas");
    expect(result.tones.friendly).toBe("Fri");
    expect(result.tones.formal).toBe("For");
    expect(result.tones.concise).toBe("Con");
  });

  it("accepts a flat tone map without a nested tones object", () => {
    const raw = JSON.stringify({
      detectedLanguage: "German",
      professional: "P",
      casual: "C",
      friendly: "F",
      formal: "O",
      concise: "S",
    });
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("German");
    expect(result.tones.professional).toBe("P");
    expect(result.tones.concise).toBe("S");
  });
});

describe("parseExpressJson recovery", () => {
  it("fills a missing tone from the closest available tone", () => {
    const tones = fullTones();
    delete tones.formal;
    const result = parseExpressJson(rawJson("Spanish", tones));
    expect(result.tones.formal.length).toBeGreaterThan(0);
    expect(Object.values(result.tones).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });

  it("fills several missing tones so all six keys exist", () => {
    const raw = JSON.stringify({
      detectedLanguage: "German",
      tones: { professional: "Only one tone." },
    });
    const result = parseExpressJson(raw);
    for (const tone of EXPRESS_TONES) {
      expect(typeof result.tones[tone]).toBe("string");
      expect(result.tones[tone].length).toBeGreaterThan(0);
    }
    expect(result.tones.auto).toBe("Only one tone.");
  });

  it("falls back to professional for a missing auto tone", () => {
    const tones = fullTones();
    delete tones.auto;
    const result = parseExpressJson(rawJson("Spanish", tones));
    expect(result.tones.auto).toBe("Professional text.");
  });

  it("fills every tone from auto when it is the only tone", () => {
    const raw = JSON.stringify({
      detectedLanguage: "Spanish",
      tones: { auto: "Only auto." },
    });
    const result = parseExpressJson(raw);
    for (const tone of EXPRESS_TONES) {
      expect(result.tones[tone]).toBe("Only auto.");
    }
  });

  it("uses Unknown when the language is missing", () => {
    const raw = JSON.stringify({ tones: fullTones() });
    expect(parseExpressJson(raw).detectedLanguage).toBe("Unknown");
  });

  it("keeps language and empty tones when tones object has no text", () => {
    const raw = JSON.stringify({ detectedLanguage: "Spanish", tones: {} });
    const result = parseExpressJson(raw);
    expect(result.detectedLanguage).toBe("Spanish");
    for (const tone of EXPRESS_TONES) {
      expect(result.tones[tone]).toBe("");
    }
  });

  it("treats truncated JSON as one tone and never throws", () => {
    const raw = '{"detectedLanguage": "Spanish", "tones": {"professional": "Hola';
    let result;
    expect(() => {
      result = parseExpressJson(raw);
    }).not.toThrow();
    expect(result.detectedLanguage).toBe("Unknown");
    for (const tone of EXPRESS_TONES) {
      expect(typeof result.tones[tone]).toBe("string");
      expect(result.tones[tone].length).toBeGreaterThan(0);
    }
  });

  it("treats plain text as one tone and never throws", () => {
    const raw = "I am happy with the results.";
    let result;
    expect(() => {
      result = parseExpressJson(raw);
    }).not.toThrow();
    expect(typeof result.tones.professional).toBe("string");
    expect(result.tones.professional).toContain("happy");
    for (const tone of EXPRESS_TONES) {
      expect(result.tones[tone].length).toBeGreaterThan(0);
    }
  });

  it("never throws for empty, null, or wrong types", () => {
    for (const bad of ["", "   ", null, undefined, 42, {}, []]) {
      let result;
      expect(() => {
        result = parseExpressJson(bad);
      }).not.toThrow();
      expect(result).toBeDefined();
      expect(typeof result.detectedLanguage).toBe("string");
      for (const tone of EXPRESS_TONES) {
        expect(typeof result.tones[tone]).toBe("string");
      }
    }
  });
});
