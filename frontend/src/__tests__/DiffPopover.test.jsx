// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import DiffPopover from "../DiffPopover.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderPopover(props = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const handlers = {
    onApply: vi.fn(),
    onDismiss: vi.fn(),
    onClose: vi.fn(),
  };
  await act(async () => {
    root.render(
      <DiffPopover
        tool="Expand"
        sourceText="The road was dusty."
        resultText="The road was dusty. Birds sang."
        {...handlers}
        {...props}
      />,
    );
  });
  return { container, root, handlers };
}

describe("DiffPopover panes", () => {
  it("marks removals and additions across both panes", async () => {
    const { container, root } = await renderPopover({
      sourceText: "The colour is nice",
      resultText: "The color is nice and bright",
    });
    const removed = container.querySelector(".lex-diff-removed");
    expect(removed).not.toBe(null);
    expect(removed.textContent).toContain("colour");
    const added = container.querySelectorAll(".lex-diff-added");
    expect(added.length).toBeGreaterThan(0);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the result alone without a source", async () => {
    const { container, root } = await renderPopover({ sourceText: "" });
    expect(container.textContent).toContain("Birds sang.");
    expect(container.querySelector(".lex-diff-removed")).toBe(null);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe("DiffPopover actions", () => {
  it("applies, dismisses, and closes explicitly", async () => {
    const { container, root, handlers } = await renderPopover();
    const apply = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Apply",
    );
    await act(async () => {
      apply.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
    const dismiss = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "Dismiss",
    );
    await act(async () => {
      dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
    const close = container.querySelector("button[aria-label='Close diff view']");
    await act(async () => {
      close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("closes on Escape without applying", async () => {
    const { container, root, handlers } = await renderPopover();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onApply).not.toHaveBeenCalled();
    expect(handlers.onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("closes on backdrop click without applying", async () => {
    const { container, root, handlers } = await renderPopover();
    const backdrop = container.querySelector("[data-testid='diff-popover-backdrop']");
    await act(async () => {
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
    expect(handlers.onApply).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
