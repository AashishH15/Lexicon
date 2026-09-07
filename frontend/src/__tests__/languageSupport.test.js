import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../languages.js";
import {
  getNonEnglishDeepProofreadNotice,
  isEnglishLocale,
  languageFamily,
  normalizeLanguageTag,
} from "../languageSupport.js";

describe("languageSupport Deep Proofread notices", () => {
  it("treats all English variants as English", () => {
    for (const code of ["en-US", "en-GB", "en-AU", "en-CA", "en-NZ", "en-ZA"]) {
      expect(isEnglishLocale(code)).toBe(true);
      expect(getNonEnglishDeepProofreadNotice(code)).toBe("");
    }
  });

  it("shows an untested-AI notice for every non-English catalog locale", () => {
    for (const { code } of LANGUAGES) {
      if (isEnglishLocale(code)) continue;
      const notice = getNonEnglishDeepProofreadNotice(code);
      expect(notice).toMatch(/not been thoroughly tested/i);
      expect(notice).toMatch(/may produce incorrect/i);
    }
  });

  it("names the selected language in the notice", () => {
    expect(getNonEnglishDeepProofreadNotice("fr")).toMatch(/French/i);
    expect(getNonEnglishDeepProofreadNotice("de-DE")).toMatch(/German/i);
    expect(getNonEnglishDeepProofreadNotice("es")).toMatch(/Spanish/i);
  });
});

describe("languageFamily", () => {
  it("normalizes regional tags to family keys", () => {
    expect(normalizeLanguageTag("en-US")).toBe("en-us");
    expect(languageFamily("en-GB")).toBe("en");
    expect(languageFamily("fr-CA")).toBe("fr");
    expect(languageFamily("de-DE-x-simple-language")).toBe("de");
    expect(languageFamily("pt-BR")).toBe("pt");
    expect(languageFamily("zh-CN")).toBe("zh");
    expect(languageFamily("ca-ES-valencia")).toBe("ca");
  });
});
