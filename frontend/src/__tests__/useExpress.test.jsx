// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import useExpress, {
  EXPRESS_DEFAULT_TONE,
  EXPRESS_NEEDS_MODEL_MESSAGE,
  isExpressModelAllowed,
} from "../useExpress.js";
import * as api from "../api.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  transformText: vi.fn(),
  cancelTransform: vi.fn().mockResolvedValue({ cancelled: true }),
}));

function testTones() {
  return {
    auto: "Auto text.",
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
  };
}

function rawResult(language = "Spanish", tones = testTones()) {
  return JSON.stringify({ detectedLanguage: language, tones });
}

// Mount the hook. Keep the latest value in ref.
function mountHook() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = { current: null };
  function Harness() {
    ref.current = useExpress();
    return null;
  }
  act(() => {
    root.render(<Harness />);
  });
  return { container, root, ref };
}

describe("isExpressModelAllowed", () => {
  it("allows Standard and Quality", () => {
    expect(isExpressModelAllowed("2b")).toBe(true);
    expect(isExpressModelAllowed("quality")).toBe(true);
  });

  it("blocks Light", () => {
    expect(isExpressModelAllowed("0.8b")).toBe(false);
  });

  it("allows auto and external backends", () => {
    expect(isExpressModelAllowed(undefined)).toBe(true);
    expect(isExpressModelAllowed(null)).toBe(true);
  });

  it("exposes the upgrade message", () => {
    expect(EXPRESS_NEEDS_MODEL_MESSAGE).toContain("Standard");
    expect(EXPRESS_NEEDS_MODEL_MESSAGE).toContain("Quality");
  });
});

describe("useExpress defaults", () => {
  let mounted;

  beforeEach(() => {
    vi.clearAllMocks();
    mounted = mountHook();
  });

  afterEach(() => {
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  });

  it("starts idle with auto tone and no result", () => {
    expect(EXPRESS_DEFAULT_TONE).toBe("auto");
    expect(mounted.ref.current.activeTone).toBe("auto");
    expect(mounted.ref.current.result).toBe(null);
    expect(mounted.ref.current.status).toBe("idle");
    expect(mounted.ref.current.activeText).toBe("");
  });

  it("exposes cancel and abort from the shared transform", () => {
    expect(typeof mounted.ref.current.cancel).toBe("function");
    expect(typeof mounted.ref.current.abort).toBe("function");
  });
});

describe("useExpress run with Standard", () => {
  let mounted;

  beforeEach(() => {
    vi.clearAllMocks();
    api.transformText.mockResolvedValue({ text: rawResult() });
    mounted = mountHook();
  });

  afterEach(() => {
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  });

  it("calls transform once and parses tones", async () => {
    let parsed;
    await act(async () => {
      parsed = await mounted.ref.current.runExpress("Estoy contento.", { modelKey: "2b" });
    });
    expect(api.transformText).toHaveBeenCalledTimes(1);
    const args = api.transformText.mock.calls[0][0];
    expect(args.text).toBe("Estoy contento.");
    expect(args.modelKey).toBe("2b");
    expect(args.prompt).toContain("detectedLanguage");
    expect(args.prompt).toContain("professional");
    expect(parsed.detectedLanguage).toBe("Spanish");
    expect(mounted.ref.current.result.detectedLanguage).toBe("Spanish");
    expect(mounted.ref.current.result.tones.casual).toBe("Casual text.");
    expect(mounted.ref.current.activeText).toBe("Auto text.");
  });

  it("switches active text when the tone changes", async () => {
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    act(() => {
      mounted.ref.current.setActiveTone("concise");
    });
    expect(mounted.ref.current.activeTone).toBe("concise");
    expect(mounted.ref.current.activeText).toBe("Concise text.");
  });

  it("ignores an unknown tone name", async () => {
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    act(() => {
      mounted.ref.current.setActiveTone("pirate");
    });
    expect(mounted.ref.current.activeTone).toBe("auto");
  });

  it("parses a fenced model reply", async () => {
    api.transformText.mockResolvedValue({ text: "```json\n" + rawResult("German") + "\n```" });
    await act(async () => {
      await mounted.ref.current.runExpress("Guten Tag.", { modelKey: "quality" });
    });
    expect(mounted.ref.current.result.detectedLanguage).toBe("German");
  });

  it("does not call the API for blank input", async () => {
    let out;
    await act(async () => {
      out = await mounted.ref.current.runExpress("   ", { modelKey: "2b" });
    });
    expect(out).toBe(null);
    expect(api.transformText).not.toHaveBeenCalled();
    expect(mounted.ref.current.result).toBe(null);
  });
});

describe("useExpress Light gate", () => {
  let mounted;

  beforeEach(() => {
    vi.clearAllMocks();
    mounted = mountHook();
  });

  afterEach(() => {
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  });

  it("blocks Light and shows the upgrade message", async () => {
    let out;
    await act(async () => {
      out = await mounted.ref.current.runExpress("Hola.", { modelKey: "0.8b" });
    });
    expect(out).toBe(null);
    expect(api.transformText).not.toHaveBeenCalled();
    expect(mounted.ref.current.error).toContain("Standard");
    expect(mounted.ref.current.needsUpgrade).toBe(true);
    expect(mounted.ref.current.result).toBe(null);
  });

  it("Light block clears a prior Standard result", async () => {
    api.transformText.mockResolvedValue({ text: rawResult() });
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    expect(mounted.ref.current.result).not.toBe(null);

    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "0.8b" });
    });
    expect(api.transformText).toHaveBeenCalledTimes(1);
    expect(mounted.ref.current.needsUpgrade).toBe(true);
    expect(mounted.ref.current.result).toBe(null);
  });
});

describe("useExpress error path", () => {
  let mounted;

  beforeEach(() => {
    vi.clearAllMocks();
    mounted = mountHook();
  });

  afterEach(() => {
    act(() => {
      mounted.root.unmount();
    });
    mounted.container.remove();
  });

  it("surfaces the transform error and keeps no result", async () => {
    api.transformText.mockRejectedValue(new Error("Model offline."));
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    expect(mounted.ref.current.status).toBe("error");
    expect(mounted.ref.current.error).toContain("Model offline.");
    expect(mounted.ref.current.result).toBe(null);
  });

  it("cancel leaves the hook idle without a crash", async () => {
    api.transformText.mockResolvedValue({ text: rawResult() });
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    act(() => {
      mounted.ref.current.cancel();
    });
    expect(mounted.ref.current.status).toBe("idle");
  });

  it("cancels an in-flight run via shared cancel", async () => {
    let release;
    api.transformText.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );

    let outPromise;
    await act(async () => {
      outPromise = mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    expect(["warming", "working"]).toContain(mounted.ref.current.status);

    await act(async () => {
      mounted.ref.current.cancel();
    });
    expect(mounted.ref.current.status).toBe("idle");

    await act(async () => {
      release({ text: rawResult() });
      await outPromise;
    });
    expect(mounted.ref.current.result).toBe(null);
  });

  it("clear drops result and notice but keeps the tone", async () => {
    api.transformText.mockResolvedValue({ text: rawResult() });
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "2b" });
    });
    act(() => {
      mounted.ref.current.setActiveTone("casual");
    });
    await act(async () => {
      await mounted.ref.current.runExpress("Hola.", { modelKey: "0.8b" });
    });
    act(() => {
      mounted.ref.current.clear();
    });
    expect(mounted.ref.current.result).toBe(null);
    expect(mounted.ref.current.notice).toBe("");
    expect(mounted.ref.current.needsUpgrade).toBe(false);
    expect(mounted.ref.current.activeTone).toBe("casual");
  });
});
