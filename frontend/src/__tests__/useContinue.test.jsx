// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import useContinue, {
  CONTINUE_CONTEXT_CHARS,
  CONTINUE_MAX_TOKENS,
  CONTINUE_TEMPERATURES,
  CONTINUE_TEMPERATURE_DEFAULT,
  continueContext,
  continueLengthPrompt,
  continueMaxTokens,
  loadContinueIdleSeconds,
  loadContinueTemperature,
  paragraphBudget,
  stripEchoedPrefix,
  truncateSentences,
} from "../useContinue.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const runMock = vi.fn();
const cancelMock = vi.fn();
vi.mock("../useTransform.js", () => ({
  default: () => ({
    status: "idle",
    error: "",
    run: runMock,
    cancel: cancelMock,
    abort: cancelMock,
    isWarming: false,
  }),
}));

function mountHook() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = { current: null };
  function Harness() {
    ref.current = useContinue();
    return null;
  }
  act(() => {
    root.render(<Harness />);
  });
  return { container, root, ref };
}

describe("continueContext", () => {
  it("takes the trailing slice before the cursor", () => {
    expect(continueContext("Hello world", 5)).toBe("Hello");
    expect(continueContext("Hello world", 11)).toBe("Hello world");
  });

  it("caps context to the trailing budget", () => {
    const text = "a".repeat(CONTINUE_CONTEXT_CHARS + 50);
    const slice = continueContext(text, text.length);
    expect(slice.length).toBe(CONTINUE_CONTEXT_CHARS);
    expect(text.endsWith(slice)).toBe(true);
  });

  it("ignores blank context", () => {
    expect(continueContext("   ", 3)).toBe("");
  });
});

describe("useContinue request", () => {
  let mounted;
  beforeEach(() => {
    mounted = mountHook();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mounted.root.unmount();
    mounted.container.remove();
  });

  it("runs the Continue prompt with sampling options", async () => {
    runMock.mockResolvedValue(" And then more.");
    let out;
    await act(async () => {
      out = await mounted.ref.current.request({
        fullText: "Once upon a time",
        pos: 16,
        language: "es",
      });
    });
    expect(out.text).toBe(" And then more.");
    const args = runMock.mock.calls[0][0];
    expect(args.prompt).toContain("Do not repeat");
    expect(args.prompt).toContain("Spanish");
    expect(args.text).toBe("Once upon a time");
    expect(args.temperature).toBe(0.4);
    expect(args.maxTokens).toBe(CONTINUE_MAX_TOKENS);
    expect(mounted.ref.current.suggestion).toBe(" And then more.");
  });

  it("skips blank context with no model call", async () => {
    const out = await mounted.ref.current.request({
      fullText: "   ",
      pos: 3,
      language: "en-US",
    });
    expect(out).toBe(null);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("dismiss clears the suggestion", async () => {
    runMock.mockResolvedValue(" And then more.");
    await act(async () => {
      await mounted.ref.current.request({
        fullText: "Once upon a time",
        pos: 16,
        language: "en-US",
      });
    });
    expect(mounted.ref.current.suggestion).toBe(" And then more.");
    act(() => {
      mounted.ref.current.dismiss();
    });
    expect(mounted.ref.current.suggestion).toBe("");
  });
});

describe("continue temperature presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps presets to spaced values with a balanced default", () => {
    expect(CONTINUE_TEMPERATURES).toEqual({
      precise: 0.2,
      balanced: 0.4,
      bold: 0.6,
    });
    expect(CONTINUE_TEMPERATURE_DEFAULT).toBe("balanced");
    expect(loadContinueTemperature()).toBe("balanced");
  });

  it("falls back to balanced for unknown stored values", () => {
    localStorage.setItem("lexicon:continueTemperature", "wild");
    expect(loadContinueTemperature()).toBe("balanced");
    localStorage.removeItem("lexicon:continueTemperature");
  });

  it("requests the bold temperature end to end", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = { current: null };
    function Harness() {
      ref.current = useContinue();
      return null;
    }
    await act(async () => {
      root.render(<Harness />);
    });
    runMock.mockResolvedValue(" Bold words.");
    let out;
    await act(async () => {
      out = await ref.current.request({
        fullText: "Start here",
        pos: 10,
        language: "en-US",
        temperature: "bold",
      });
    });
    expect(out.text).toBe(" Bold words.");
    expect(runMock.mock.calls[0][0].temperature).toBe(0.6);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("stripEchoedPrefix", () => {
  it("strips a repeated tail off the suggestion", () => {
    expect(
      stripEchoedPrefix(
        "So there was a man walking",
        "So there was a man walking, his boots crunch",
      ),
    ).toBe("his boots crunch");
  });

  it("leaves clean continuations byte-identical", () => {
    expect(stripEchoedPrefix("Once upon a time", " And then more.")).toBe(
      " And then more.",
    );
  });

  it("needs at least two shared words", () => {
    expect(stripEchoedPrefix("the dog walking", "walking home")).toBe(
      "walking home",
    );
  });

  it("matches case-insensitively through punctuation", () => {
    expect(stripEchoedPrefix("Hello World", "hello world again")).toBe("again");
  });

  it("returns empty when the whole suggestion echoes", () => {
    expect(stripEchoedPrefix("same words here", "same words here")).toBe("");
  });
});

describe("continue length variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays silent for auto", () => {
    expect(continueLengthPrompt("auto")).toBe("");
    expect(continueLengthPrompt("")).toBe("");
    expect(continueLengthPrompt("novella")).toBe("");
  });

  it("asks sentence mode to stop at the sentence end", () => {
    expect(continueLengthPrompt("sentence")).toMatch(/sentence end/i);
  });

  it("asks paragraph mode for about three sentences", () => {
    expect(continueLengthPrompt("paragraph")).toMatch(/about 3 sentences/i);
    expect(continueMaxTokens("paragraph")).toBe(300);
  });

  it("budgets tokens per length", () => {
    expect(continueMaxTokens("sentence")).toBe(40);
    expect(continueMaxTokens("auto")).toBe(CONTINUE_MAX_TOKENS);
    expect(continueMaxTokens("novella")).toBe(CONTINUE_MAX_TOKENS);
  });
  it("requests the sentence variant end to end", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = { current: null };
    function Harness() {
      ref.current = useContinue();
      return null;
    }
    await act(async () => {
      root.render(<Harness />);
    });
    runMock.mockResolvedValue(" End of it.");
    let out;
    await act(async () => {
      out = await ref.current.request({
        fullText: "Start of it",
        pos: 11,
        language: "en-US",
        length: "sentence",
      });
    });
    expect(out.text).toBe(" End of it.");
    const args = runMock.mock.calls[0][0];
    expect(args.prompt).toMatch(/sentence end/i);
    expect(args.maxTokens).toBe(40);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("caps paragraph output at ten sentences", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = { current: null };
    function Harness() {
      ref.current = useContinue();
      return null;
    }
    await act(async () => {
      root.render(<Harness />);
    });
    runMock.mockResolvedValue(
      " One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten. Eleven. Twelve.",
    );
    let out;
    await act(async () => {
      out = await ref.current.request({
        fullText: "Start here.",
        pos: 11,
        language: "en-US",
        length: "paragraph",
      });
    });
    expect(out.text).toBe(
      " One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.",
    );
    const args = runMock.mock.calls[0][0];
    expect(args.prompt).toMatch(/about 3 sentences/i);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("caps auto output to three sentences", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const ref = { current: null };
    function Harness() {
      ref.current = useContinue();
      return null;
    }
    await act(async () => {
      root.render(<Harness />);
    });
    runMock.mockResolvedValue(" One. Two. Three. Four. Five.");
    let out;
    await act(async () => {
      out = await ref.current.request({
        fullText: "Start here",
        pos: 10,
        language: "en-US",
        length: "auto",
      });
    });
    expect(out.text).toBe(" One. Two. Three.");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("paragraphBudget", () => {
  it("counts sentences in the cursor block", () => {
    expect(paragraphBudget("One. Two. Three. Four.", 22)).toEqual({
      blockSentences: 4,
      full: false,
    });
    expect(paragraphBudget("One.", 4)).toEqual({
      blockSentences: 1,
      full: false,
    });
    expect(paragraphBudget("", 0)).toEqual({
      blockSentences: 0,
      full: false,
    });
  });

  it("marks full blocks for a fresh paragraph", () => {
    expect(paragraphBudget("One. Two.", 9).full).toBe(false);
    expect(
      paragraphBudget("One. Two. Three. Four. Five.", 30).full,
    ).toBe(true);
    expect(
      paragraphBudget("One. Two. Three. Four. Five. Six.", 33).full,
    ).toBe(true);
  });
});

describe("truncateSentences", () => {
  it("caps output to N sentences", () => {
    expect(truncateSentences("One. Two. Three.", 2)).toBe("One. Two.");
    expect(truncateSentences("One. Two.", 5)).toBe("One. Two.");
  });

  it("drops a trailing fragment", () => {
    expect(truncateSentences("One. Two par", 2)).toBe("One.");
  });

  it("asks paragraph mode for a fresh start on full blocks", () => {
    expect(
      continueLengthPrompt("paragraph", { remaining: 1, fresh: true }),
    ).toMatch(/fresh paragraph/i);
    expect(continueMaxTokens("paragraph", { fresh: true })).toBe(300);
  });
});

describe("continue idle delay", () => {
  it("snaps stored values to 1s steps within 1 to 60", () => {
    localStorage.setItem("lexicon:continueIdleSeconds", "7");
    expect(loadContinueIdleSeconds()).toBe(7);
    localStorage.setItem("lexicon:continueIdleSeconds", "100");
    expect(loadContinueIdleSeconds()).toBe(60);
    localStorage.setItem("lexicon:continueIdleSeconds", "0");
    expect(loadContinueIdleSeconds()).toBe(1);
    localStorage.setItem("lexicon:continueIdleSeconds", "1");
    expect(loadContinueIdleSeconds()).toBe(1);
    localStorage.removeItem("lexicon:continueIdleSeconds");
  });

  it("defaults to 10s without a stored value", () => {
    localStorage.removeItem("lexicon:continueIdleSeconds");
    expect(loadContinueIdleSeconds()).toBe(10);
  });
});
