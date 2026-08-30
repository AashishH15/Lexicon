import { describe, expect, it } from "vitest";
import { LEX_STATUS, resolveLexStatus, lexStatusMessage } from "../lexStatus.js";

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
  });
});
