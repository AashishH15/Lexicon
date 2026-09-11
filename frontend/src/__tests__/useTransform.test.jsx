// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import useTransform from "../useTransform.js";
import * as api from "../api.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api.js", () => ({
  transformText: vi.fn(),
  cancelTransform: vi.fn().mockResolvedValue({ cancelled: true }),
}));

function mountHook() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = { current: null };
  function Harness() {
    ref.current = useTransform();
    return null;
  }
  act(() => {
    root.render(<Harness />);
  });
  return { container, root, ref };
}

describe("useTransform sampling options", () => {
  let mounted;
  beforeEach(() => {
    mounted = mountHook();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mounted.root.unmount();
    mounted.container.remove();
  });

  it("passes temperature and maxTokens to the backend", async () => {
    api.transformText.mockResolvedValue({ text: "More words." });
    let out;
    await act(async () => {
      out = await mounted.ref.current.run({
        prompt: "P",
        text: "T",
        temperature: 0.7,
        maxTokens: 120,
      });
    });
    expect(out).toBe("More words.");
    expect(api.transformText).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7, maxTokens: 120 }),
    );
  });

  it("leaves sampling options unset by default", async () => {
    api.transformText.mockResolvedValue({ text: "More words." });
    await act(async () => {
      await mounted.ref.current.run({ prompt: "P", text: "T" });
    });
    const args = api.transformText.mock.calls[0][0];
    expect(args.temperature).toBe(undefined);
    expect(args.maxTokens).toBe(undefined);
  });
});
