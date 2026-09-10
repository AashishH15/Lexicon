import { describe, expect, it } from "vitest";
import { promptForTool } from "../prompts.js";

describe("promptForTool language keeping", () => {
  it("leaves English prompts unchanged", () => {
    const prompt = promptForTool("Professional", "en-US");
    expect(prompt).toContain("workplace");
    expect(prompt).not.toContain("Do not translate");
  });

  it("leaves prompts unchanged without a language", () => {
    expect(promptForTool("Professional")).not.toContain("Do not translate");
    expect(promptForTool("Professional", "")).not.toContain("Do not translate");
  });

  it("names the draft language for tones", () => {
    const prompt = promptForTool("Professional", "es");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("Do not translate");
  });

  it("names the draft language for rewrite and structure tools", () => {
    expect(promptForTool("Rewrite", "es")).toContain("Do not translate");
    expect(promptForTool("Summary", "fr")).toContain("French");
  });

  it("returns null for unknown tools", () => {
    expect(promptForTool("Nope", "es")).toBe(null);
  });
});
