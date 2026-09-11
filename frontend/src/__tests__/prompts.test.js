import { describe, expect, it } from "vitest";
import {
  AI_TOOL_NAMES,
  CONTINUE_TOOL_NAME,
  EXPAND_TOOL_NAME,
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
