// Live Express smoke against Standard.
// Set EXPRESS_SMOKE=1 to run. Skip by default so npm test stays fast.
// Keep sentences short. Use simple words. No em dashes.

import { beforeAll, describe, expect, it } from "vitest";
import { getExpressPrompt } from "../prompts.js";
import { EXPRESS_TONES, parseExpressJson } from "../expressParser.js";
import {
  casualUsesContractions,
  conciseIsClearlyShorter,
  languageLooksValid,
  preservesTokens,
  tonesFeelDistinct,
} from "../expressSmokeChecks.js";

const TEST_ENV = globalThis.process?.env || {};
const RUN_LIVE = TEST_ENV.EXPRESS_SMOKE === "1";
const API_URL = TEST_ENV.VITE_API_URL || "http://127.0.0.1:8000";
const MODEL_KEY = "2b";
const LIVE_TIMEOUT_MS = 180_000;

const CASES = [
  {
    id: "spanish",
    text: "Estoy muy contento con los resultados de Maria en 2024.",
    languageHint: "Spanish",
    tokens: ["Maria", "2024"],
  },
  {
    id: "german",
    text: "Ich bin sehr zufrieden mit den Ergebnissen von Hans im Jahr 2024.",
    languageHint: "German",
    tokens: ["Hans", "2024"],
  },
  {
    id: "french",
    text: "Je suis tres content des resultats de Sophie en 2024.",
    languageHint: "French",
    tokens: ["Sophie", "2024"],
  },
  {
    id: "chinese",
    text: "我对 Maria 在 2024 年的结果非常满意。",
    languageHint: "Chinese",
    tokens: ["Maria", "2024"],
  },
  {
    id: "hindi",
    text: "Main 2024 mein Maria ke results se bahut khush hoon.",
    languageHint: "Hindi",
    tokens: ["Maria", "2024"],
    optional: true,
  },
  {
    id: "english",
    text: "I am happy with Maria's results in 2024.",
    languageHint: "English",
    tokens: ["Maria", "2024"],
    englishPalette: true,
  },
];

async function transformExpress(text) {
  const response = await fetch(`${API_URL}/transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: getExpressPrompt(text),
      text,
      model_key: MODEL_KEY,
      backend: "bundled",
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.detail || `Transform failed: ${response.status}`);
  }
  return response.json();
}

describe.skipIf(!RUN_LIVE)("Express live multilingual smoke (Standard)", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_URL}/health`);
    expect(health.ok).toBe(true);
    await fetch(`${API_URL}/ai/preference`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backend: "bundled", model_key: MODEL_KEY }),
    });
  }, LIVE_TIMEOUT_MS);

  for (const sample of CASES) {
    it(
      `phrases ${sample.id} into distinct English tones`,
      async () => {
        let raw;
        try {
          raw = await transformExpress(sample.text);
        } catch (error) {
          if (sample.optional) {
            console.warn(`Optional ${sample.id} smoke skipped: ${error.message}`);
            return;
          }
          throw error;
        }

        const parsed = parseExpressJson(raw.text || raw.result || "");
        expect(parsed).toBeTruthy();
        expect(languageLooksValid(parsed.detectedLanguage, sample.languageHint)).toBe(
          true,
        );

        for (const tone of EXPRESS_TONES) {
          expect(String(parsed.tones[tone] || "").trim().length).toBeGreaterThan(0);
          // Output must be English letters for Latin cases, not the source copy.
          if (sample.id !== "chinese" && sample.id !== "hindi") {
            expect(parsed.tones[tone]).not.toBe(sample.text);
          }
        }

        expect(tonesFeelDistinct(parsed.tones)).toBe(true);
        expect(conciseIsClearlyShorter(parsed.tones)).toBe(true);
        // Small models may drop a token in one tone. Keep it in most tones.
        expect(preservesTokens(parsed.tones, sample.tokens, 4)).toBe(true);

        if (!sample.englishPalette) {
          expect(casualUsesContractions(parsed.tones)).toBe(true);
        }

        // No em dashes in model output we keep.
        for (const tone of EXPRESS_TONES) {
          expect(parsed.tones[tone]).not.toContain(String.fromCharCode(8212));
        }
      },
      LIVE_TIMEOUT_MS,
    );
  }
});
