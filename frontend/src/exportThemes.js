// Export theme presets + the semantic print/export helpers.
//
// Every theme is one CSS string: screen rules (typography the exported HTML
// uses when opened in a browser and during printing) followed by an
// `@media print` block with page rules. Selectors target `.ProseMirror`,
// which the exported HTML wrapper carries.

import { invoke } from "@tauri-apps/api/core";

const BASE_EXPORT_CSS = `
html { font-size: 16px; }
body {
  margin: 0;
  background: #fff;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.lex-export { max-width: 46rem; margin: 0 auto; padding: 2.5rem 2rem 4rem; }
.ProseMirror {
  outline: none;
  user-select: text;
  -webkit-user-select: text;
}
.ProseMirror img { max-width: 100%; height: auto; }
.ProseMirror li > p { margin: 0; }
@page { margin: 1in; }
@media print {
  html, body { background: #fff; }
  .lex-export { max-width: none; margin: 0; padding: 0; }
  *, *::before, *::after {
    backdrop-filter: none !important;
    filter: none !important;
    transform: none !important;
    perspective: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
}
`;

export const EXPORT_THEMES = [
  {
    id: "academic",
    name: "Academic / Formal",
    description:
      "Serif (Times New Roman / Computer Modern), 1.5 line height, CSS-numbered section headers, running header and page footer.",
    css: `
.ProseMirror {
  font-family: "Times New Roman", "Computer Modern", "STIX Two Text", Georgia, serif;
  line-height: 1.5;
  color: #1a1a1a;
  counter-reset: lex-section;
}
.ProseMirror h1 { font-size: 1.6em; text-align: center; margin: 0 0 0.5em; }
.ProseMirror h2 { font-size: 1.25em; font-weight: 700; margin: 1.4em 0 0.5em; counter-reset: lex-subsection; counter-increment: lex-section; }
.ProseMirror h2::before { content: counter(lex-section) ". "; }
.ProseMirror h3 { font-size: 1.1em; font-weight: 700; margin: 1.2em 0 0.4em; counter-increment: lex-subsection; }
.ProseMirror h3::before { content: counter(lex-section) "." counter(lex-subsection) " "; }
.ProseMirror p { margin: 0 0 0.75em; text-align: justify; }
.ProseMirror a { color: #1f6c9f; }
.ProseMirror blockquote { border-left: 3px solid #999; margin: 1em 0; padding: 0.25em 0 0.25em 1em; color: #333; }
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.ProseMirror table th, .ProseMirror table td { border: 1px solid #666; padding: 6px 10px; text-align: left; }
.ProseMirror table th { background: #eee; }
.ProseMirror pre { font-family: "Courier New", monospace; font-size: 0.85em; background: #f5f5f5; padding: 0.75em; }
.ProseMirror ol, .ProseMirror ul { margin: 0.5em 0 0.75em 1.5em; }
.ProseMirror li { margin: 0.15em 0; }
@page { size: letter; margin: 1in; }
@page {
  @top-center { content: "Lexicon"; font-family: Georgia, serif; font-size: 9pt; color: #666; }
  @bottom-center { content: counter(page); font-family: Georgia, serif; font-size: 10pt; color: #666; }
}
@media print {
  .ProseMirror { font-size: 12pt; line-height: 1.5; }
  h1, h2, h3, h4 { break-after: avoid; }
  table, pre, blockquote { break-inside: avoid; }
  .ProseMirror a { text-decoration: none; }
}
`,
  },
  {
    id: "novel",
    name: "Novel / Literary",
    description:
      "Classic Garamond/Georgia layout, 1-inch margins, centered chapter headers, first-line indents, and a drop cap on the first paragraph after the opening scene break.",
    css: `
.ProseMirror {
  font-family: Garamond, "EB Garamond", Georgia, "Times New Roman", serif;
  color: #1a1a1a;
}
.ProseMirror h1 { text-align: center; font-size: 1.5em; letter-spacing: 0.04em; margin: 1.8em 0 1em; }
.ProseMirror h2 { text-align: center; font-size: 1.25em; margin: 1.6em 0 0.8em; }
.ProseMirror p { margin: 0; text-indent: 0.5in; text-align: justify; }
.ProseMirror h1 + p, .ProseMirror h2 + p, .ProseMirror blockquote p { text-indent: 0; }
.ProseMirror blockquote { margin: 0 2em; font-style: italic; }
.ProseMirror hr:first-of-type + h1 + p::first-letter {
  float: left;
  font-size: 3.2em;
  line-height: 0.85;
  padding-right: 0.08em;
  font-family: Georgia, serif;
}
.ProseMirror table { border-collapse: collapse; width: 100%; }
.ProseMirror table th, .ProseMirror table td { border: 1px solid #bbb; padding: 5px 8px; }
.ProseMirror table th { font-weight: 700; }
.ProseMirror pre { font-family: "Courier New", monospace; font-size: 0.9em; }
@page { size: letter; margin: 1in; }
@media print {
  .ProseMirror { font-size: 12pt; }
  h1, h2 { break-after: avoid; }
  p { orphans: 2; widows: 2; }
}
`,
  },
  {
    id: "minimal",
    name: "Minimalist / Modern",
    description:
      "Sans-serif Inter, bold monochrome accents, high-contrast blockquotes, and crisp table rules with dark code blocks.",
    css: `
.ProseMirror {
  font-family: Inter, "Geist Sans", "Helvetica Neue", Arial, sans-serif;
  line-height: 1.7;
  color: #16181d;
}
.ProseMirror h1 { font-size: 1.9em; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 0.4em; }
.ProseMirror h2 { font-size: 1.35em; font-weight: 700; margin: 1.5em 0 0.4em; padding-bottom: 0.25em; border-bottom: 3px solid #16181d; }
.ProseMirror h3 { font-size: 1.1em; font-weight: 700; margin: 1.2em 0 0.3em; }
.ProseMirror p { margin: 0 0 1em; }
.ProseMirror a { color: #1f6c9f; text-decoration: underline; text-underline-offset: 2px; }
.ProseMirror blockquote {
  border-left: 4px solid #16181d;
  background: #f4f4f2;
  padding: 0.75em 1.25em;
  margin: 1em 0;
  font-size: 1.05em;
  line-height: 1.6;
}
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.ProseMirror table th, .ProseMirror table td { border: 1px solid #d8d8d4; padding: 7px 10px; text-align: left; }
.ProseMirror table th { border-bottom-width: 3px; border-bottom-color: #16181d; background: #fafaf8; }
.ProseMirror pre {
  background: #16181d;
  color: #f4f4f2;
  padding: 1em;
  border-radius: 8px;
  font-size: 0.85em;
  overflow-x: auto;
}
.ProseMirror code { font-family: "JetBrains Mono", ui-monospace, monospace; }
.ProseMirror li { margin: 0.2em 0; }
.ProseMirror hr { border: 0; border-top: 1px solid #d8d8d4; margin: 2em 0; }
@page { size: letter; margin: 0.75in; }
@media print {
  .ProseMirror { font-size: 11pt; }
  h1, h2, h3 { break-after: avoid; }
  table, pre, blockquote { break-inside: avoid; }
}
`,
  },
  {
    id: "executive",
    name: "Executive / Corporate",
    description:
      "Modern sans-serif, navy corporate header bars, clean card-style callout boxes, branded gold accent rules, running header and page footer.",
    css: `
.ProseMirror {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: #1c2333;
}
.ProseMirror h1 {
  background: #16233e;
  color: #fff;
  padding: 0.6em 1em;
  margin: 0 0 0.75em;
  font-size: 1.5em;
  letter-spacing: 0.01em;
  border-left: 6px solid #d9a441;
}
.ProseMirror h2 { color: #16233e; font-size: 1.2em; margin: 1.4em 0 0.4em; padding-bottom: 0.2em; border-bottom: 2px solid #d9a441; }
.ProseMirror h3 { color: #16233e; font-size: 1.05em; margin: 1.1em 0 0.3em; }
.ProseMirror p { margin: 0 0 0.8em; }
.ProseMirror a { color: #1f6c9f; }
.ProseMirror blockquote {
  border: 1px solid #d9d9d6;
  border-radius: 10px;
  background: #f6f5f1;
  box-shadow: 0 1px 3px rgba(22, 35, 62, 0.08);
  padding: 0.9em 1.25em;
  margin: 1em 0;
}
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.ProseMirror table th { background: #16233e; color: #fff; padding: 8px 10px; text-align: left; }
.ProseMirror table td { border-bottom: 1px solid #d9d9d6; padding: 7px 10px; }
.ProseMirror pre { background: #16233e; color: #f6f5f1; padding: 0.9em 1em; border-radius: 8px; font-size: 0.85em; }
.ProseMirror hr { border: 0; border-top: 2px solid #d9a441; margin: 1.5em 0; }
.ProseMirror li { margin: 0.15em 0; }
@page { size: letter; margin: 0.8in; }
@page {
  @top-center { content: "Lexicon"; font-family: "Segoe UI", Arial, sans-serif; font-size: 9pt; color: #666; }
  @bottom-right { content: counter(page); font-family: "Segoe UI", Arial, sans-serif; font-size: 10pt; color: #666; }
}
@media print {
  .ProseMirror { font-size: 11pt; }
  h1, h2, h3 { break-after: avoid; }
  table, pre, blockquote { break-inside: avoid; }
}
`,
  },
];

export function getThemeById(id) {
  return EXPORT_THEMES.find((theme) => theme.id === id) || null;
}

// Wraps editor HTML in a standalone, styled document. The content wrapper
// carries `.ProseMirror` so theme selectors apply unchanged. This document is
// also used as the isolated print surface, so editor decorations and app UI
// are never part of the print tree. KaTeX stylesheet is inlined for
// structure; its font files are not shipped (browser fallback).
export async function buildExportHtml(html, css, title = "Document") {
  let katexCss = "";
  try {
    const mod = await import("katex/dist/katex.min.css?inline");
    katexCss = mod.default || "";
  } catch {
    // Math still renders structurally; fonts fall back to system faces.
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${BASE_EXPORT_CSS}
${css}
${katexCss}
</style>
</head>
<body>
<main class="lex-export ProseMirror">
${html}
</main>
</body>
</html>
`;
}

const PRINT_RESOURCE_TIMEOUT_MS = 5000;
const PRINT_CLEANUP_TIMEOUT_MS = 60000;

function resolveWithin(promise, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, timeoutMs);

    Promise.resolve(promise).then(
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    );
  });
}

function waitForDocumentReady(doc) {
  if (!doc || doc.readyState === "complete") return Promise.resolve();

  return resolveWithin(
    new Promise((resolve) => {
      const view = doc.defaultView;
      const cleanup = () => {
        doc.removeEventListener("readystatechange", onReady);
        view?.removeEventListener("load", onLoad);
      };
      const onReady = () => {
        if (doc.readyState !== "complete") return;
        cleanup();
        resolve();
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      doc.addEventListener("readystatechange", onReady);
      view?.addEventListener("load", onLoad);
      onReady();
    }),
    PRINT_RESOURCE_TIMEOUT_MS
  );
}

function waitForImage(image) {
  const decode = () => {
    if (typeof image.decode !== "function") return Promise.resolve();
    try {
      return resolveWithin(
        Promise.resolve(image.decode()),
        PRINT_RESOURCE_TIMEOUT_MS
      );
    } catch {
      return Promise.resolve();
    }
  };

  if (image.complete) return decode();

  return resolveWithin(
    new Promise((resolve) => {
      const finish = () => {
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    }),
    PRINT_RESOURCE_TIMEOUT_MS
  ).then(decode);
}

async function renderPrintMath(doc) {
  const mathNodes = Array.from(
    doc.querySelectorAll('[data-type="inline-math"], [data-type="block-math"]')
  );
  if (!mathNodes.length) return;

  let katex = null;
  try {
    const mod = await import("katex");
    katex = mod.default || mod;
  } catch {
    // The source formula fallback below keeps math content available.
  }

  for (const node of mathNodes) {
    const latex = node.getAttribute("data-latex") || "";
    if (!latex || !katex?.renderToString) {
      if (!node.textContent.trim() && latex) node.textContent = latex;
      continue;
    }
    try {
      node.innerHTML = katex.renderToString(latex, {
        displayMode: node.dataset.type === "block-math",
        throwOnError: false,
      });
    } catch {
      node.textContent = latex;
    }
  }
}

async function waitForPrintResources(doc) {
  await renderPrintMath(doc);
  await waitForDocumentReady(doc);
  if (doc.fonts?.ready) {
    await resolveWithin(doc.fonts.ready, PRINT_RESOURCE_TIMEOUT_MS);
  }
  await Promise.all(Array.from(doc.images || [], waitForImage));
}

function usesWindowsNativePdf() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.__TAURI_INTERNALS__) &&
    /Windows/i.test(window.navigator?.userAgent || "")
  );
}

async function prepareNativePdfHtml(html) {
  if (typeof DOMParser !== "function") return html;

  const printDocument = new DOMParser().parseFromString(html, "text/html");
  await renderPrintMath(printDocument);
  const doctype = printDocument.doctype
    ? `<!DOCTYPE ${printDocument.doctype.name}>`
    : "<!DOCTYPE html>";
  return `${doctype}\n${printDocument.documentElement.outerHTML}`;
}

// Prints an isolated semantic document instead of the live application DOM.
// An off-screen but renderable iframe avoids app chrome, editor decorations,
// and popovers while keeping the source content as normal text nodes.
export async function printExportHtml(html) {
  if (typeof document === "undefined") {
    throw new Error("Print export requires a browser document.");
  }

  if (usesWindowsNativePdf()) {
    const preparedHtml = await prepareNativePdfHtml(html);
    await invoke("native_pdf_export", { html: preparedHtml });
    return;
  }

  const frame = document.createElement("iframe");
  frame.title = "Lexicon print document";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:100vw;height:100vh;" +
    "border:0;pointer-events:none;";
  document.body.appendChild(frame);

  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  if (!printDocument || !printWindow) {
    frame.remove();
    throw new Error("Could not create a print document.");
  }

  printDocument.open();
  printDocument.write(html);
  printDocument.close();

  try {
    await waitForPrintResources(printDocument);
    if (typeof printWindow.print !== "function") {
      throw new Error("Printing is not available in this window.");
    }
  } catch (error) {
    frame.remove();
    throw error;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let cleanupTimer = null;
    const parentWindow =
      typeof window !== "undefined" && window !== printWindow ? window : null;

    const cleanup = () => {
      printWindow.removeEventListener("afterprint", finish);
      parentWindow?.removeEventListener("afterprint", finish);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      frame.remove();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    printWindow.addEventListener("afterprint", finish, { once: true });
    parentWindow?.addEventListener("afterprint", finish, { once: true });
    cleanupTimer = setTimeout(finish, PRINT_CLEANUP_TIMEOUT_MS);

    try {
      printWindow.print();
    } catch (error) {
      fail(error);
    }
  });
}
