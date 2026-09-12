import { describe, expect, it } from "vitest";
import {
  AI_TOOL_NAMES,
  CONTINUE_TOOL_NAME,
  EXPAND_TOOL_NAME,
  EXPRESS_TONE_TEMPERATURES,
  REWRITE_CLASS_TOOLS,
  TOOL_TEMPERATURES,
  getToolTemperature,
  promptForTool,
} from "../prompts.js";

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

describe("Continue and Expand prompts", () => {
  it("names both tools for entries and shortcuts", () => {
    expect(CONTINUE_TOOL_NAME).toBe("Continue");
    expect(EXPAND_TOOL_NAME).toBe("Expand");
    expect(AI_TOOL_NAMES).toContain("Continue");
    expect(AI_TOOL_NAMES).toContain("Expand");
  });

  it("asks for new sentences without repeating input", () => {
    const prompt = promptForTool("Continue", "en-US");
    expect(prompt).toMatch(/next/i);
    expect(prompt).toMatch(/do not repeat/i);
    expect(prompt).toMatch(/only.*new sentences|output only/i);
  });

  it("asks expansions to preserve meaning", () => {
    const prompt = promptForTool("Expand", "en-US");
    expect(prompt).toMatch(/expand/i);
    expect(prompt).toMatch(/preserve.*meaning|keep.*meaning/i);
  });

  it("names the draft language for both", () => {
    expect(promptForTool("Continue", "es")).toContain("Spanish");
    expect(promptForTool("Continue", "es")).toContain("Do not translate");
    expect(promptForTool("Expand", "es")).toContain("Do not translate");
  });

  it("uses no em dashes in either prompt", () => {
    const emDash = String.fromCharCode(8212);
    expect(promptForTool("Continue", "en-US")).not.toContain(emDash);
    expect(promptForTool("Expand", "en-US")).not.toContain(emDash);
  });
});

describe("REWRITE_CLASS_TOOLS", () => {
  it("covers Rewrite, Concise, all tones, and Expand", () => {
    for (const name of ["Rewrite", "Concise", "Expand"]) {
      expect(REWRITE_CLASS_TOOLS).toContain(name);
    }
    for (const tone of ["Friendly", "Professional", "Humorous"]) {
      expect(REWRITE_CLASS_TOOLS).toContain(tone);
    }
    expect(REWRITE_CLASS_TOOLS).toHaveLength(12);
  });

  it("excludes summary-class and special tools", () => {
    for (const name of ["Summary", "Key Points", "List", "Table", "Continue"]) {
      expect(REWRITE_CLASS_TOOLS).not.toContain(name);
    }
  });
});

describe("temperature calibrations", () => {
  it("calibrates exact temperatures for all built-in tools and tones", () => {
    expect(TOOL_TEMPERATURES).toEqual({
      Table: 0.0,
      Concise: 0.2,
      Summary: 0.2,
      "Key Points": 0.2,
      List: 0.2,
      Professional: 0.3,
      Academic: 0.3,
      Formal: 0.3,
      Rewrite: 0.5,
      Casual: 0.6,
      Friendly: 0.6,
      Playful: 0.6,
      Empathetic: 0.6,
      Persuasive: 0.6,
      Humorous: 0.6,
    });
  });

  it("calibrates exact temperatures for Express in English tones", () => {
    expect(EXPRESS_TONE_TEMPERATURES).toEqual({
      auto: 0.3,
      concise: 0.2,
      professional: 0.3,
      formal: 0.3,
      casual: 0.6,
      friendly: 0.6,
    });
  });

  it("resolves temperature via getToolTemperature", () => {
    expect(getToolTemperature("Table")).toBe(0.0);
    expect(getToolTemperature("Concise")).toBe(0.2);
    expect(getToolTemperature("Summary")).toBe(0.2);
    expect(getToolTemperature("Professional")).toBe(0.3);
    expect(getToolTemperature("Rewrite")).toBe(0.5);
    expect(getToolTemperature("Casual")).toBe(0.6);
    expect(getToolTemperature("Playful")).toBe(0.6);
    // Custom tool or unknown tool defaults to balanced 0.4
    expect(getToolTemperature("CustomSummary")).toBe(0.4);
    expect(getToolTemperature("")).toBe(0.4);
  });
});
