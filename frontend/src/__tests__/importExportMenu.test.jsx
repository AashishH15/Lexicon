// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ImportExportMenu from "../ImportExportMenu.jsx";
import { downloadBlob } from "../download.js";
import { printExportHtml } from "../exportThemes.js";

vi.mock("../download.js", () => ({
  downloadBlob: vi.fn(),
}));

vi.mock("../exportThemes.js", async () => {
  const actual = await vi.importActual("../exportThemes.js");
  return {
    ...actual,
    printExportHtml: vi.fn().mockResolvedValue(undefined),
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const EDITOR_HTML = "<h1>Chapter</h1><p>Body text.</p>";

function makeEditor() {
  return {
    getHTML: () => EDITOR_HTML,
    commands: {
      setContent: vi.fn(),
    },
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
});

async function renderMenu(props = {}) {
  const editor = makeEditor();
  const onOpenTemplates = vi.fn();
  const onRequestConfirm = vi.fn();
  await act(async () => {
    root.render(
      <ImportExportMenu
        editor={editor}
        onRequestConfirm={onRequestConfirm}
        onOpenTemplates={onOpenTemplates}
        grammarMatches={[]}
        {...props}
      />
    );
  });
  return { editor, onOpenTemplates, onRequestConfirm };
}

async function openMenu() {
  await act(async () => {
    document
      .querySelector('button[aria-label="Import / Export"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function menuItems() {
  return Array.from(
    document.querySelectorAll(
      'div[class*="shadow-lg"] button'
    )
  ).map((btn) => btn.textContent.trim());
}

function sectionLabels() {
  return Array.from(
    document.querySelectorAll('div[class*="shadow-lg"] p')
  ).map((p) => p.textContent.trim());
}

describe("ImportExportMenu — C46.5 structured dropdown", () => {
  it("groups items into Quick Export / Rich Export / Templates sections", async () => {
    await renderMenu();
    await openMenu();
    expect(sectionLabels()).toEqual([
      "Quick Export",
      "Rich Export",
      "Templates",
    ]);
    expect(menuItems()).toEqual([
      "Import File…",
      "Export as HTML",
      "Export as Plain Text",
      "Export as Markdown",
      "Export as Styled HTML…",
      "Export as PDF…",
      "Export as EPUB…",
      "Export as DOCX…",
      "Template Gallery…",
    ]);
  });

  it("quick-export HTML downloads editor HTML directly", async () => {
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as HTML")
        .click();
    });
    expect(downloadBlob).toHaveBeenCalledWith(
      EDITOR_HTML,
      "document.html",
      "text/html"
    );
  });

  it("quick-export Markdown converts through TurndownService", async () => {
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as Markdown")
        .click();
    });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [html] = downloadBlob.mock.calls[0];
    expect(html).toContain("# Chapter");
    expect(html).toContain("Body text.");
  });

  it("opens the PDF options modal for rich export", async () => {
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as PDF…")
        .click();
    });
    expect(document.body.textContent).toContain("Export PDF");
    expect(document.body.textContent).toContain("Print Theme");
  });

  it("sends semantic editor HTML to the PDF print helper", async () => {
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as PDF…")
        .click();
    });
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Print / Save as PDF")
        .click();
    });
    await vi.waitFor(() => {
      expect(printExportHtml).toHaveBeenCalledTimes(1);
    });
    expect(printExportHtml.mock.calls[0][0]).toContain(EDITOR_HTML);
  });

  it("opens the EPUB metadata modal for rich export", async () => {
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as EPUB…")
        .click();
    });
    expect(document.body.textContent).toContain("Export EPUB");
    expect(document.body.textContent).toContain("Book Title");
  });

  it("opens the DOCX modal pre-filled with the saved tracked-suggestions author", async () => {
    localStorage.setItem("lexicon:docxAuthor", "Test Reviewer");
    await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Export as DOCX…")
        .click();
    });
    expect(document.body.textContent).toContain("Export DOCX");
    const input = Array.from(document.querySelectorAll("input")).find(
      (el) => el.placeholder === "Lex"
    );
    expect(input).toBeTruthy();
    expect(input.value).toBe("Test Reviewer");
  });

  it("opens the template gallery on Templates section action", async () => {
    const { onOpenTemplates } = await renderMenu();
    await openMenu();
    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((b) => b.textContent.trim() === "Template Gallery…")
        .click();
    });
    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
  });

  it("imports a .txt file through the overwrite confirmation", async () => {
    const { editor, onRequestConfirm } = await renderMenu();
    const file = new File(["Hello\n\nWorld"], "note.txt", {
      type: "text/plain",
    });
    await act(async () => {
      const input = document.querySelector('input[type="file"]');
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onRequestConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Overwrite Document?" })
    );
    const { onConfirm } = onRequestConfirm.mock.calls[0][0];
    await act(async () => {
      await onConfirm();
    });
    expect(editor.commands.setContent).toHaveBeenCalledTimes(1);
    expect(editor.commands.setContent.mock.calls[0][0]).toContain(
      "<p>Hello</p><p>World</p>"
    );
  });

  it("imports a .md file through Markdown conversion", async () => {
    const { editor, onRequestConfirm } = await renderMenu();
    const file = new File(["# Title\n\nBody"], "note.md", {
      type: "text/markdown",
    });
    await act(async () => {
      const input = document.querySelector('input[type="file"]');
      Object.defineProperty(input, "files", {
        value: [file],
        configurable: true,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const { onConfirm } = onRequestConfirm.mock.calls[0][0];
    await act(async () => {
      await onConfirm();
    });
    expect(editor.commands.setContent).toHaveBeenCalledTimes(1);
    expect(editor.commands.setContent.mock.calls[0][0]).toContain("<h1>");
  });

  it("keeps the file input accepting html/txt/md/docx", async () => {
    await renderMenu();
    const input = document.querySelector('input[type="file"]');
    expect(input.accept).toBe(".html,.htm,.txt,.md,.markdown,.docx");
  });
});
