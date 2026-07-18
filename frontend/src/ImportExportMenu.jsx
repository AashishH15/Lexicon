import { useEffect, useRef, useState } from "react";
import { Export, DownloadSimple, FileHtml, FileText, FileMd, FilePdf } from "@phosphor-icons/react";
import TurndownService from "turndown";
import { marked } from "marked";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Strips HTML and rejoins into plain paragraphs for the .txt fallback.
function htmlToPlainText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// Wraps raw text lines into minimal paragraphs TipTap can parse.
function plainTextToHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return paragraphs || "<p></p>";
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function ImportExportMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleExport(kind) {
    setOpen(false);
    if (!editor) return;
    if (kind === "html") {
      downloadBlob(editor.getHTML(), "document.html", "text/html");
    } else if (kind === "txt") {
      const text = htmlToPlainText(editor.getHTML());
      downloadBlob(text, "document.txt", "text/plain");
    } else if (kind === "md") {
      const md = turndown.turndown(editor.getHTML());
      downloadBlob(md, "document.md", "text/markdown");
    } else if (kind === "pdf") {
      window.print();
    }
  }

  function triggerImport() {
    setOpen(false);
    requestAnimationFrame(() => fileInputRef.current?.click());
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) return;
    const proceed = window.confirm(
      "Importing a new file will permanently overwrite your auto-saved document. Continue?",
    );
    if (!proceed) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lower = file.name.toLowerCase();
      let html;
      if (lower.endsWith(".txt")) {
        html = plainTextToHtml(text);
      } else if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
        html = marked.parse(text);
      } else {
        // .html / .htm / fallback: assume HTML
        html = text;
      }
      editor.commands.setContent(html);
    };
    reader.readAsText(file);
  }

  const itemClass =
    "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-hairline/60";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Import / Export"
        aria-label="Import / Export"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          "flex h-8 w-8 items-center justify-center rounded border-transparent text-muted transition-colors " +
          (open ? "bg-ink text-white" : "hover:bg-hairline/60 hover:text-ink")
        }
      >
        <Export size={16} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded border border-hairline bg-canvas p-1 shadow-lg">
          <button type="button" className={itemClass} onClick={triggerImport}>
            <DownloadSimple size={16} weight="bold" className="text-muted" />
            Import File…
          </button>
          <div className="my-1 h-px bg-hairline" />
          <button type="button" className={itemClass} onClick={() => handleExport("html")}>
            <FileHtml size={16} weight="bold" className="text-muted" />
            Export as HTML
          </button>
          <button type="button" className={itemClass} onClick={() => handleExport("txt")}>
            <FileText size={16} weight="bold" className="text-muted" />
            Export as Plain Text
          </button>
          <button type="button" className={itemClass} onClick={() => handleExport("md")}>
            <FileMd size={16} weight="bold" className="text-muted" />
            Export as Markdown
          </button>
          <button type="button" className={itemClass} onClick={() => handleExport("pdf")}>
            <FilePdf size={16} weight="bold" className="text-muted" />
            Export as PDF
          </button>
        </div>
      )}
      {/* Always mounted (not gated by {open}) so the ref stays valid
          when triggerImport() clicks it after closing the dropdown. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.txt,.md,.markdown"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
