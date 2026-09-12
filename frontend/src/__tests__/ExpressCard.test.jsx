// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ExpressCard from "../ExpressCard.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function testTones() {
  return {
    professional: "Professional text.",
    casual: "Casual text.",
    friendly: "Friendly text.",
    formal: "Formal text.",
    concise: "Concise text.",
  };
}

let container;
let root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function renderCard(props = {}) {
  const handlers = {
    onToneChange: vi.fn(),
    onReplace: vi.fn(),
    onCopy: vi.fn(),
    onRun: vi.fn(),
    onDismiss: vi.fn(),
    ...props.handlers,
  };
  const merged = {
    detectedLanguage: "Spanish",
    tones: testTones(),
    activeTone: "professional",
    status: "idle",
    error: "",
    hasSelection: true,
    isOverLimit: false,
    isModelAllowed: true,
    ...props.props,
  };
  await act(async () => {
    root.render(<ExpressCard {...merged} {...handlers} />);
  });
  return handlers;
}

function bodyText() {
  return container.querySelector("[data-testid='express-body']")?.textContent || "";
}

describe("ExpressCard header", () => {
  it("shows the title and the language badge with no picker", async () => {
    await renderCard();
    expect(container.textContent).toContain("Express in English");
    expect(container.textContent).toContain("Spanish -> English");
    expect(container.querySelector("select")).toBe(null);
  });

  it("hides the badge when the language is Unknown", async () => {
    await renderCard({ props: { detectedLanguage: "Unknown" } });
    expect(container.textContent).not.toContain("-> English");
  });

  it("dismisses with the close button and the Escape key", async () => {
    const handlers = await renderCard();
    await act(async () => {
      container
        .querySelector("button[aria-label='Dismiss Express card']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(handlers.onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe("ExpressCard tones", () => {
  it("switches the body text when a tone tab is picked", async () => {
    const handlers = await renderCard();
    await act(async () => {
      container
        .querySelector("button[aria-label='Casual tone']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onToneChange).toHaveBeenCalledWith("casual");
  });

  it("shows the active tone text in the body", async () => {
    await renderCard({ props: { activeTone: "friendly" } });
    expect(bodyText()).toContain("Friendly text.");
  });

  it("marks the active tab for assistive tech", async () => {
    await renderCard({ props: { activeTone: "formal" } });
    const tab = container.querySelector("button[aria-label='Formal tone']");
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("lists Auto first with its faithful hint", async () => {
    const handlers = await renderCard();
    const tabs = Array.from(container.querySelectorAll("button[role='tab']"));
    expect(tabs).toHaveLength(6);
    expect(tabs[0].getAttribute("aria-label")).toBe("Auto tone");
    await act(async () => {
      tabs[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onToneChange).toHaveBeenCalledWith("auto");
    expect(container.textContent).toContain("Faithful to the original");
  });

  it("keeps an even tab grid with no orphan span", async () => {
    await renderCard();
    expect(
      container.querySelectorAll("button[role='tab'].col-span-2").length,
    ).toBe(0);
  });

  it("keeps tone tabs unselected while waiting for a pick", async () => {
    await renderCard({
      props: {
        hasSelection: true,
        tones: null,
        activeTone: "professional",
        status: "idle",
      },
    });
    expect(container.textContent).toContain("Pick a tone to phrase this selection.");
    expect(container.textContent).not.toContain("Polished for work");
    const selected = container.querySelectorAll("button[role='tab'][aria-selected='true']");
    expect(selected.length).toBe(0);
  });

  it("keeps paste mode tones quiet until a tone is chosen", async () => {
    await renderCard({
      props: {
        hasSelection: false,
        tones: null,
        activeTone: "professional",
        status: "idle",
      },
    });
    expect(
      container.querySelectorAll("button[role='tab'][aria-selected='true']").length,
    ).toBe(0);
    await act(async () => {
      container
        .querySelector("button[aria-label='Casual tone']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const casual = container.querySelector("button[aria-label='Casual tone']");
    expect(casual.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Relaxed, like a text");
  });
});

describe("ExpressCard actions", () => {
  it("fires Replace with the active tone text", async () => {
    const handlers = await renderCard({ props: { activeTone: "concise" } });
    await act(async () => {
      container
        .querySelector("button[aria-label='Replace selection']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onReplace).toHaveBeenCalledWith("Concise text.");
  });

  it("fires Copy and shows brief feedback", async () => {
    vi.useFakeTimers();
    const handlers = await renderCard();
    await act(async () => {
      container
        .querySelector("button[aria-label='Copy result']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onCopy).toHaveBeenCalledWith("Professional text.");
    expect(container.textContent).toMatch(/Copied|Check/i);
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(container.querySelector("button[aria-label='Copy result']").textContent).not.toMatch(
      /Copied/i,
    );
  });
});

describe("ExpressCard empty and gated modes", () => {
  it("shows paste input and Run when there is no selection", async () => {
    const handlers = await renderCard({ props: { hasSelection: false, tones: null } });
    const input = container.querySelector("textarea[aria-label='Text to express in English']");
    expect(input).not.toBe(null);
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set;
      nativeSetter.call(input, "Estoy contento.");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container
        .querySelector("button[aria-label='Run Express']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onRun).toHaveBeenCalledWith("Estoy contento.", "professional");
  });

  it("shows Copy without Replace when results come from paste mode", async () => {
    await renderCard({ props: { hasSelection: false, tones: testTones() } });
    expect(container.querySelector("button[aria-label='Copy result']")).not.toBe(null);
    expect(container.querySelector("button[aria-label='Replace selection']")).toBe(null);
  });

  it("shows the length note and blocks Run when over limit", async () => {
    const handlers = await renderCard({ props: { hasSelection: false, isOverLimit: true } });
    expect(container.textContent).toContain("Please select a sentence or short paragraph.");
    const run = container.querySelector("button[aria-label='Run Express']");
    expect(run.disabled).toBe(true);
    await act(async () => {
      run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onRun).not.toHaveBeenCalled();
  });

  it("blocks Run when pasted text is over 600 characters", async () => {
    const handlers = await renderCard({ props: { hasSelection: false, tones: null } });
    const input = container.querySelector("textarea[aria-label='Text to express in English']");
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      ).set;
      nativeSetter.call(input, "a".repeat(601));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("Please select a sentence or short paragraph.");
    const run = container.querySelector("button[aria-label='Run Express']");
    expect(run.disabled).toBe(true);
    await act(async () => {
      run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onRun).not.toHaveBeenCalled();
  });

  it("shows the Light gate and blocks Run", async () => {
    const handlers = await renderCard({ props: { hasSelection: false, isModelAllowed: false } });
    expect(container.textContent).toContain("Express in English needs Standard or Quality.");
    const run = container.querySelector("button[aria-label='Run Express']");
    expect(run.disabled).toBe(true);
    await act(async () => {
      run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onRun).not.toHaveBeenCalled();
  });
});

describe("ExpressCard loading and error", () => {
  it("shows loading copy and keeps tabs mounted for stable height", async () => {
    await renderCard({ props: { status: "working", tones: null } });
    expect(container.textContent).toContain("Phrasing in English...");
    expect(container.querySelector("[role='tablist']")).not.toBe(null);
    expect(container.querySelector("[data-testid='express-body']")).not.toBe(null);
    expect(container.querySelector(".lex-shimmer")).not.toBe(null);
  });

  it("shows the error text when the run fails", async () => {
    await renderCard({ props: { status: "error", error: "Model offline.", tones: null } });
    expect(container.textContent).toContain("Model offline.");
  });
});
