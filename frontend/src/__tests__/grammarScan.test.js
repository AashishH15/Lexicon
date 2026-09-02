import { describe, expect, it } from "vitest";
import { GrammarCache } from "../grammarCache.js";
import {
  buildGrammarWindows,
  createLatestWinsCoordinator,
  filterWindowMatches,
  scanGrammarWindows,
} from "../grammarScan.js";

function matchAt(offset, length, id = "TEST_RULE") {
  return {
    offset,
    length,
    message: "Test match",
    replacements: ["replacement"],
    rule: { id, description: "Test rule" },
  };
}

describe("buildGrammarWindows", () => {
  it("covers every non-empty core with neighboring context", () => {
    const text = "alpha\nbeta\ngamma";
    const windows = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 100,
    });

    expect(windows).toHaveLength(3);
    expect(windows.map((window) => text.slice(window.coreStart, window.coreEnd))).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(windows[0].requestText).toBe("alpha\nbeta");
    expect(windows[1].requestText).toBe("alpha\nbeta\ngamma");
    expect(windows[2].requestText).toBe("beta\ngamma");
    expect(windows[1].coreOffset).toBe("alpha\n".length);
    expect(windows[1].coreLength).toBe("beta".length);
  });

  it("keeps context bounded without truncating the target core", () => {
    const text = `${"left context ".repeat(20)}\ncore paragraph\n${"right context ".repeat(20)}`;
    const windows = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 12,
    });
    const core = windows.find(
      (window) => text.slice(window.coreStart, window.coreEnd) === "core paragraph",
    );

    expect(core).toBeDefined();
    expect(core.requestText.slice(core.coreOffset, core.coreOffset + core.coreLength)).toBe(
      "core paragraph",
    );
    expect(core.coreStart - core.requestStart).toBeLessThanOrEqual(12);
    expect(core.requestEnd - core.coreEnd).toBeLessThanOrEqual(12);
  });

  it("ignores empty blocks as scan targets while preserving their separators", () => {
    const text = "first\n\nthird";
    const windows = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 100,
    });

    expect(windows).toHaveLength(2);
    expect(windows[1].requestText).toBe("first\n\nthird");
    expect(text.slice(windows[1].coreStart, windows[1].coreEnd)).toBe("third");
  });
});

describe("filterWindowMatches", () => {
  it("rebases only matches owned by the target core", () => {
    const text = "before\ncore text\nafter";
    const window = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 100,
    }).find((item) => text.slice(item.coreStart, item.coreEnd) === "core text");
    const validOffset = window.requestText.indexOf("core");

    const matches = filterWindowMatches(text, window, [
      matchAt(validOffset, 4, "VALID"),
      matchAt(0, 6, "CONTEXT"),
      matchAt(window.coreOffset - 1, 3, "CROSSING"),
      matchAt(window.coreOffset, 0, "ZERO_LENGTH"),
      matchAt(window.coreOffset + window.coreLength, 1, "AFTER_CORE"),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      offset: text.indexOf("core"),
      length: 4,
      rule: { id: "VALID" },
    });
  });

  it("rejects newline-spanning and malformed matches and deduplicates matches", () => {
    const text = "before\ncore text\nafter";
    const window = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 100,
    }).find((item) => text.slice(item.coreStart, item.coreEnd) === "core text");
    const validOffset = window.requestText.indexOf("core");

    const matches = filterWindowMatches(text, window, [
      matchAt(validOffset, 4, "VALID"),
      matchAt(validOffset, 4, "VALID"),
      matchAt(window.coreOffset - 1, 2, "NEWLINE"),
      { offset: "invalid", length: 2, rule: { id: "MALFORMED" } },
      matchAt(window.requestText.length + 1, 2, "OUTSIDE"),
    ]);

    expect(matches).toHaveLength(1);
    expect(matches[0].rule.id).toBe("VALID");
  });

  it("rebases offsets correctly when an earlier core contains emoji", () => {
    const text = "😀 intro\ncore text";
    const window = buildGrammarWindows(text, {
      contextParagraphs: 1,
      maxContextChars: 100,
    }).find((item) => text.slice(item.coreStart, item.coreEnd) === "core text");
    const localOffset = window.requestText.indexOf("core");

    const matches = filterWindowMatches(
      text,
      window,
      [matchAt(localOffset, 4, "EMOJI_OFFSET")],
    );

    expect(matches[0].offset).toBe(text.indexOf("core"));
    expect(text.slice(matches[0].offset, matches[0].offset + 4)).toBe("core");
  });
});

describe("scanGrammarWindows", () => {
  it("adds context-sensitive matches once at their global document offset", async () => {
    const text = "intro\nThe list of items\nAre on the table.\noutro";
    const cache = new GrammarCache();
    const requests = [];
    const result = await scanGrammarWindows({
      text,
      language: "en-US",
      ignore: [],
      cache,
      checkGrammar: async (requestText) => {
        requests.push(requestText);
        const offset = requestText.indexOf("Are");
        return offset < 0 ? [] : [matchAt(offset, 3, "AGREEMENT_SENT_START")];
      },
    });

    expect(requests).toHaveLength(4);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      offset: text.indexOf("Are"),
      length: 3,
      rule: { id: "AGREEMENT_SENT_START" },
    });
  });

  it("reuses unchanged windows and rescans windows whose context changed", async () => {
    const cache = new GrammarCache();
    const requests = [];
    const checkGrammar = async (requestText) => {
      requests.push(requestText);
      return [];
    };
    const options = {
      language: "en-US",
      ignore: [],
      cache,
      checkGrammar,
    };

    await scanGrammarWindows({ ...options, text: "first\nsecond\nthird\nfourth" });
    await scanGrammarWindows({ ...options, text: "changed\nsecond\nthird\nfourth" });

    expect(requests).toHaveLength(6);
    expect(requests.slice(4)).toEqual([
      "changed\nsecond",
      "changed\nsecond\nthird",
    ]);
  });

  it("supports cancellation through the caller's signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      scanGrammarWindows({
        text: "one\ntwo",
        language: "en-US",
        ignore: [],
        cache: new GrammarCache(),
        signal: controller.signal,
        checkGrammar: async () => [],
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("createLatestWinsCoordinator", () => {
  it("aborts and invalidates an older run when a newer run starts", () => {
    const coordinator = createLatestWinsCoordinator();
    const first = coordinator.start();
    const second = coordinator.start();

    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);

    coordinator.invalidate();
    expect(second.signal.aborted).toBe(true);
    expect(second.isCurrent()).toBe(false);
  });
});
