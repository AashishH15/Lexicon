// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EXPORT_THEMES,
  getThemeById,
  applyPrintTheme,
  buildExportHtml,
} from "../exportThemes.js";

describe("theme catalog", () => {
  it("exports four themes with unique ids and complete metadata", () => {
    expect(EXPORT_THEMES.length).toBe(4);
    const ids = new Set(EXPORT_THEMES.map((t) => t.id));
    expect(ids.size).toBe(EXPORT_THEMES.length);
    for (const theme of EXPORT_THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(theme.css).toContain("@media print");
    }
  });

  it("getThemeById resolves ids and returns null for unknown ids", () => {
    expect(getThemeById("academic").id).toBe("academic");
    expect(getThemeById("nope")).toBeNull();
  });

  it("academic theme numbers section headers and has running header/footer rules", () => {
    const css = getThemeById("academic").css;
    expect(css).toContain("counter-increment: lex-section");
    expect(css).toContain("@top-center");
    expect(css).toContain("@bottom-center");
    expect(css).toContain("Times New Roman");
  });

  it("novel theme has first-line indents and a drop cap rule", () => {
    const css = getThemeById("novel").css;
    expect(css).toContain("text-indent: 0.5in");
    expect(css).toContain("::first-letter");
    expect(css).toContain("Garamond");
  });

  it("minimal theme uses Inter and high-contrast blockquotes", () => {
    const css = getThemeById("minimal").css;
    expect(css).toContain("Inter");
    expect(css).toContain("border-left: 4px solid #16181d");
    expect(css).toContain("border-bottom: 3px solid #16181d");
  });

  it("executive theme has corporate bars and running header/footer rules", () => {
    const css = getThemeById("executive").css;
    expect(css).toContain("background: #16233e");
    expect(css).toContain("border-left: 6px solid #d9a441");
    expect(css).toContain("@top-center");
    expect(css).toContain("@bottom-right");
  });
});

describe("applyPrintTheme", () => {
  beforeEach(() => {
    window.print = vi.fn();
    document.getElementById("lex-print-theme")?.remove();
  });

  it("injects a temporary style and removes it on afterprint", async () => {
    vi.useFakeTimers();
    applyPrintTheme(".ProseMirror { color: red; }");
    const style = document.getElementById("lex-print-theme");
    expect(style).toBeTruthy();
    expect(style.textContent).toContain("color: red");
    expect(window.print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("afterprint"));
    vi.advanceTimersByTime(5000);
    expect(document.getElementById("lex-print-theme")).toBeNull();
    vi.useRealTimers();
  });

  it("dedupes repeated invocations to a single style element", () => {
    vi.useFakeTimers();
    applyPrintTheme("a");
    applyPrintTheme("b");
    const styles = document.querySelectorAll("#lex-print-theme");
    expect(styles.length).toBe(1);
    expect(styles[0].textContent).toBe("b");
    window.dispatchEvent(new Event("afterprint"));
    vi.advanceTimersByTime(5000);
    expect(document.getElementById("lex-print-theme")).toBeNull();
    vi.useRealTimers();
  });
});

describe("buildExportHtml", () => {
  it("wraps content in a standalone styled document", async () => {
    const html = await buildExportHtml(
      "<h1>Hello</h1><p>World</p>",
      getThemeById("academic").css
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>Document</title>");
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("lex-export ProseMirror");
    expect(html).toContain("counter-increment: lex-section");
  });

  it("accepts a custom title and empty css", async () => {
    const html = await buildExportHtml("<p>x</p>", "", "My Doc");
    expect(html).toContain("<title>My Doc</title>");
  });

  it("combines theme CSS with user custom CSS in exported HTML after theme rules", async () => {
    const themeCss = getThemeById("academic").css;
    const customCss = ".ProseMirror p { color: #ff0000 !important; font-size: 18px; }";
    const combinedCss = [themeCss, customCss].join("\n");
    const html = await buildExportHtml("<h1>Title</h1><p>Test</p>", combinedCss, "Custom Test");

    expect(html).toContain("counter-increment: lex-section");
    expect(html).toContain(".ProseMirror p { color: #ff0000 !important; font-size: 18px; }");
    const themeIndex = html.indexOf("counter-increment: lex-section");
    const customIndex = html.indexOf(".ProseMirror p { color: #ff0000 !important; font-size: 18px; }");
    expect(customIndex).toBeGreaterThan(themeIndex);
  });
});
