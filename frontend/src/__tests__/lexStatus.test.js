import { describe, expect, it } from "vitest";
import {
  LEX_STATUS,
  formatEngineTierLabel,
  resolveLexStatus,
  lexStatusMessage,
} from "../lexStatus.js";

describe("Lex status resolver", () => {
  it("keeps Lex idle until a meaningful operation or result exists", () => {
    expect(resolveLexStatus({ hasContent: false })).toBe(LEX_STATUS.IDLE);
  });

  it("uses checking for proofreading and AI work", () => {
    expect(
      resolveLexStatus({
        activeTool: "Proofread",
        checking: true,
        grammarMatches: [{ message: "stale issue" }],
      }),
    ).toBe(LEX_STATUS.CHECKING);
    expect(
      resolveLexStatus({
        activeTool: "Friendly",
        transformStatus: "warming",
        hasContent: true,
      }),
    ).toBe(LEX_STATUS.CHECKING);
  });

  it("preserves the documented error and connection precedence", () => {
    expect(
      resolveLexStatus({
        activeTool: "Rewrite",
        transformStatus: "error",
        transformError: "model failed",
        backendOffline: true,
      }),
    ).toBe(LEX_STATUS.ERROR);
    expect(
      resolveLexStatus({
        backendOffline: true,
        aiConfigured: false,
      }),
    ).toBe(LEX_STATUS.NO_CONNECTION);
  });

  it("treats a failed AI connection as no connection", () => {
    expect(
      resolveLexStatus({
        activeTool: "Rewrite",
        transformStatus: "error",
        transformError: "Failed to fetch",
      }),
    ).toBe(LEX_STATUS.NO_CONNECTION);
  });

  it("distinguishes disabled AI from a reachable proofreading engine", () => {
    expect(
      resolveLexStatus({ aiConfigured: false, hasContent: false }),
    ).toBe(LEX_STATUS.IDLE);
    expect(
      resolveLexStatus({
        activeTool: "Rewrite",
        aiConfigured: false,
        hasContent: true,
      }),
    ).toBe(LEX_STATUS.DISABLED);
    expect(
      resolveLexStatus({
        activeTool: "Proofread",
        aiConfigured: false,
        hasContent: true,
        grammarMatches: [],
      }),
    ).toBe(LEX_STATUS.ALL_CLEAR);
  });

  it("reports proofreading findings and clean results separately", () => {
    expect(
      resolveLexStatus({
        activeTool: "Proofread",
        hasContent: true,
        grammarMatches: [{}, {}],
      }),
    ).toBe(LEX_STATUS.ISSUES);
    expect(
      lexStatusMessage(LEX_STATUS.ISSUES, { issueCount: 2 }),
    ).toBe("I found 2 issues.");
    expect(
      lexStatusMessage(LEX_STATUS.CHECKING, { activeTool: "Rewrite" }),
    ).toBe("I’m working on your selection…");
    expect(
      lexStatusMessage(LEX_STATUS.CHECKING, { activeTool: "Deep Proofread" }),
    ).toBe("I’m checking your draft…");
  });

  it("tracks the Deep Proofread mode like proofreading", () => {
    expect(
      resolveLexStatus({ activeTool: "Deep Proofread", deepRunning: true }),
    ).toBe(LEX_STATUS.CHECKING);
    expect(
      resolveLexStatus({
        activeTool: "Deep Proofread",
        deepError: "model failed",
        hasContent: true,
      }),
    ).toBe(LEX_STATUS.ERROR);
    expect(
      resolveLexStatus({
        activeTool: "Deep Proofread",
        deepError: "Failed to fetch",
      }),
    ).toBe(LEX_STATUS.NO_CONNECTION);
    expect(
      resolveLexStatus({
        activeTool: "Deep Proofread",
        aiConfigured: false,
        hasContent: true,
      }),
    ).toBe(LEX_STATUS.DISABLED);
    expect(
      resolveLexStatus({
        activeTool: "Deep Proofread",
        hasContent: true,
        deepMatches: [{}],
      }),
    ).toBe(LEX_STATUS.ISSUES);
    expect(
      resolveLexStatus({
        activeTool: "Deep Proofread",
        hasContent: true,
        deepMatches: [],
      }),
    ).toBe(LEX_STATUS.ALL_CLEAR);
  });
});

describe("formatEngineTierLabel", () => {
  it("stays empty when AI is not configured", () => {
    expect(formatEngineTierLabel()).toBe("");
    expect(formatEngineTierLabel({ configured: false })).toBe("");
    expect(
      formatEngineTierLabel({ configured: false, modelKey: "quality" }),
    ).toBe("");
  });

  it("names the bundled tiers", () => {
    expect(
      formatEngineTierLabel({ configured: true, modelKey: "2b" }),
    ).toBe("Standard");
    expect(
      formatEngineTierLabel({ configured: true, modelKey: "0.8b" }),
    ).toBe("Light");
    expect(
      formatEngineTierLabel({ configured: true, modelKey: "quality" }),
    ).toBe("Quality");
  });

  it("falls back to Standard for an unknown tier", () => {
    expect(formatEngineTierLabel({ configured: true, modelKey: "9b" })).toBe(
      "Standard",
    );
  });

  it("adds the device in uppercase", () => {
    expect(
      formatEngineTierLabel({
        configured: true,
        modelKey: "2b",
        device: "gpu",
      }),
    ).toBe("Standard · GPU");
  });

  it("names external servers directly", () => {
    expect(formatEngineTierLabel({ configured: true, backend: "ollama" })).toBe(
      "Ollama",
    );
    expect(
      formatEngineTierLabel({ configured: true, backend: "lmstudio" }),
    ).toBe("LM Studio");
  });

  it("follows auto detection for external servers", () => {
    expect(
      formatEngineTierLabel({
        configured: true,
        backend: "auto",
        activeBackend: "ollama",
      }),
    ).toBe("Ollama");
    expect(
      formatEngineTierLabel({
        configured: true,
        backend: "auto",
        activeBackend: "lmstudio",
      }),
    ).toBe("LM Studio");
    expect(
      formatEngineTierLabel({
        configured: true,
        backend: "auto",
        activeBackend: "bundled",
        modelKey: "quality",
      }),
    ).toBe("Quality");
  });
});
