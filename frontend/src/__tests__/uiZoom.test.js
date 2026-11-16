// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  clampZoom,
  loadUiZoom,
  applyUiZoom,
  zoomShortcutAction,
  zoomWheelAction,
  uiZoomKey,
} from "../uiZoom.js";

describe("ui zoom", () => {
  beforeEach(() => localStorage.clear());

  it("clamps and snaps values", () => {
    expect(clampZoom(10)).toBe(50);
    expect(clampZoom(999)).toBe(300);
    expect(clampZoom(114)).toBe(110);
    expect(clampZoom("abc")).toBe(100);
  });

  it("loads with fallback", () => {
    expect(loadUiZoom()).toBe(100);
    localStorage.setItem(uiZoomKey, "150");
    expect(loadUiZoom()).toBe(150);
    localStorage.setItem(uiZoomKey, "junk");
    expect(loadUiZoom()).toBe(100);
  });

  it("applies zoom to root", () => {
    const root = document.createElement("div");
    applyUiZoom(150, root);
    expect(root.style.zoom).toBe("1.5");
    applyUiZoom(100, root);
    expect(root.style.zoom).toBe("");
  });

  it("maps shortcuts", () => {
    expect(zoomShortcutAction({ ctrlKey: true, key: "+" })).toBe("in");
    expect(zoomShortcutAction({ ctrlKey: true, key: "=" })).toBe("in");
    expect(zoomShortcutAction({ ctrlKey: true, key: "-" })).toBe("out");
    expect(zoomShortcutAction({ ctrlKey: true, key: "0" })).toBe("reset");
    expect(zoomShortcutAction({ key: "+" })).toBeNull();
  });

  it("maps ctrl+wheel", () => {
    expect(zoomWheelAction({ ctrlKey: true, deltaY: -100 })).toBe("in");
    expect(zoomWheelAction({ ctrlKey: true, deltaY: 100 })).toBe("out");
    expect(zoomWheelAction({ ctrlKey: false, deltaY: 100 })).toBeNull();
  });
});
