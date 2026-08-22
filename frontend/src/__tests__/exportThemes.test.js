// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import {
  EXPORT_THEMES,
  getThemeById,
  buildExportHtml,
  printExportHtml,
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
    expect(html).toContain("@page { margin: 1in; }");
  });

  it("accepts a custom title and empty css", async () => {
    const html = await buildExportHtml("<p>x</p>", "", "My Doc");
    expect(html).toContain("<title>My Doc</title>");
  });

  it("keeps flagged source words as text in the standalone document", async () => {
    const html = await buildExportHtml(
      '<p>The <span class="lex-error">teh</span> cat.</p>',
      ""
    );
    expect(html).toContain('class="lex-error">teh</span>');
    expect(html).not.toContain(".lex-error { display: none");
  });

  it("combines theme CSS with user custom CSS in exported HTML after theme rules", async () => {
    const themeCss = getThemeById("academic").css;
    const customCss =
      ".ProseMirror p { color: #ff0000 !important; font-size: 18px; }";
    const combinedCss = [themeCss, customCss].join("\n");
    const html = await buildExportHtml(
      "<h1>Title</h1><p>Test</p>",
      combinedCss,
      "Custom Test"
    );

    expect(html).toContain("counter-increment: lex-section");
    expect(html).toContain(
      ".ProseMirror p { color: #ff0000 !important; font-size: 18px; }"
    );
    const themeIndex = html.indexOf("counter-increment: lex-section");
    const customIndex = html.indexOf(
      ".ProseMirror p { color: #ff0000 !important; font-size: 18px; }"
    );
    expect(customIndex).toBeGreaterThan(themeIndex);
  });

  it("does not carry a selected theme into a later unthemed document", async () => {
    const themed = await buildExportHtml(
      "<h2>Heading</h2>",
      getThemeById("academic").css
    );
    const plain = await buildExportHtml("<h2>Heading</h2>", "");
    expect(themed).toContain("counter-increment: lex-section");
    expect(plain).not.toContain("counter-increment: lex-section");
  });
});

describe("printExportHtml", () => {
  it("uses the Windows native PDF command in the Tauri runtime", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const originalInternals = window.__TAURI_INTERNALS__;
    const hadOwnInternals = Object.prototype.hasOwnProperty.call(
      window,
      "__TAURI_INTERNALS__"
    );
    const originalUserAgent = window.navigator.userAgent;

    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: { invoke },
    });
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    });

    try {
      await printExportHtml(
        "<!doctype html><html><body><main>Selectable text</main></body></html>"
      );
      expect(invoke).toHaveBeenCalled();
      expect(invoke.mock.calls[0][0]).toBe("native_pdf_export");
      expect(invoke.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          html: expect.stringContaining("Selectable text"),
        })
      );
    } finally {
      if (hadOwnInternals) {
        Object.defineProperty(window, "__TAURI_INTERNALS__", {
          configurable: true,
          value: originalInternals,
        });
      } else {
        delete window.__TAURI_INTERNALS__;
      }
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value: originalUserAgent,
      });
    }
  });

  it("prints the isolated document and removes its frame after printing", async () => {
    const printPromise = printExportHtml(
      "<!doctype html><html><body><main>Selectable text</main></body></html>"
    );
    const frame = document.querySelector(
      'iframe[title="Lexicon print document"]'
    );
    expect(frame).toBeTruthy();
    expect(frame.contentDocument.body.textContent).toContain("Selectable text");

    const printWindow = frame.contentWindow;
    const print = vi.fn(() => {
      printWindow.dispatchEvent(new Event("afterprint"));
    });
    printWindow.print = print;

    await printPromise;
    expect(print).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('iframe[title="Lexicon print document"]')
    ).toBeNull();
  });

  it("waits for images before starting the print operation", async () => {
    const printPromise = printExportHtml(
      '<!doctype html><html><body><img src="document-image.png"></body></html>'
    );
    const frame = document.querySelector(
      'iframe[title="Lexicon print document"]'
    );
    const image = frame.contentDocument.querySelector("img");
    Object.defineProperty(image, "complete", {
      configurable: true,
      value: false,
    });
    const originalAddEventListener = image.addEventListener.bind(image);
    let resolveImageListener;
    const imageListenerReady = new Promise((resolve) => {
      resolveImageListener = resolve;
    });
    vi.spyOn(image, "addEventListener").mockImplementation(
      (type, listener, options) => {
        originalAddEventListener(type, listener, options);
        if (type === "load") resolveImageListener();
      }
    );

    const printWindow = frame.contentWindow;
    const print = vi.fn(() => {
      printWindow.dispatchEvent(new Event("afterprint"));
    });
    printWindow.print = print;

    await imageListenerReady;
    expect(print).not.toHaveBeenCalled();

    image.dispatchEvent(new Event("load"));
    await printPromise;
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("renders serialized math before starting the print operation", async () => {
    const printPromise = printExportHtml(
      '<!doctype html><html><body><p><span data-type="inline-math" data-latex="E = mc^2"></span></p><div data-type="block-math" data-latex="a^2 + b^2 = c^2"></div></body></html>'
    );
    const frame = document.querySelector(
      'iframe[title="Lexicon print document"]'
    );
    const printWindow = frame.contentWindow;
    let printedHtml = "";
    const print = vi.fn(() => {
      printedHtml = frame.contentDocument.body.innerHTML;
      printWindow.dispatchEvent(new Event("afterprint"));
    });
    printWindow.print = print;

    await printPromise;
    expect(print).toHaveBeenCalledTimes(1);
    expect(printedHtml).toContain('data-latex="E = mc^2"');
    expect(printedHtml).toContain("katex");
  });
});
