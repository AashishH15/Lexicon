import { useEffect, useState } from "react";
import { X, Book, CircleNotch } from "@phosphor-icons/react";
import { downloadBlob } from "./download.js";

const FIELD_CLASS =
  "mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 font-sans text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink";

export default function EpubMetadataModal({ editor, onClose }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState("en-US");
  const [publisher, setPublisher] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  async function handleExport() {
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    try {
      // Lazy-load jszip/epubExport so the archive engine never enters the
      // initial bundle; it is only needed when a file is actually generated.
      const { buildEpub, epubFileName } = await import("./epubExport.js");
      const fileName = epubFileName(title.trim() || "Untitled Document");
      const blob = await buildEpub({
        title: title.trim() || "Untitled Document",
        author: author.trim(),
        language: language.trim() || "en-US",
        publisher: publisher.trim(),
        html: editor.getHTML(),
      });
      downloadBlob(blob, fileName, "application/epub+zip");
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not generate the EPUB file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={() => !busy && onClose?.()}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="epub-export-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 id="epub-export-title" className="font-serif text-lg font-medium text-ink">
              Export EPUB
            </h2>
            <p className="font-sans text-xs text-muted">
              Add book details before generating the ebook file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="font-sans text-xs font-medium text-ink">
              Book Title <span className="text-amber-800">*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. The Last Lighthouse"
              className={FIELD_CLASS}
            />
          </label>

          <label className="mt-4 block">
            <span className="font-sans text-xs font-medium text-ink">
              Author Name
            </span>
            <input
              type="text"
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="e.g. Jane Writer"
              className={FIELD_CLASS}
            />
          </label>

          <label className="mt-4 block">
            <span className="font-sans text-xs font-medium text-ink">
              Language
            </span>
            <input
              type="text"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="en-US"
              className={FIELD_CLASS}
            />
            <span className="mt-1 block font-sans text-[11px] text-muted">
              BCP 47 code, e.g. en-US, en-GB, es, fr.
            </span>
          </label>

          <label className="mt-4 block">
            <span className="font-sans text-xs font-medium text-ink">
              Publisher
            </span>
            <input
              type="text"
              value={publisher}
              onChange={(event) => setPublisher(event.target.value)}
              placeholder="Optional"
              className={FIELD_CLASS}
            />
          </label>

          <p className="mt-4 rounded-xl border border-hairline bg-hairline/20 p-3 font-sans text-xs leading-relaxed text-muted">
            Generates a standard EPUB 3 file with your document as a single
            chapter. Open it in any ebook reader (e.g. Calibre, Apple Books,
            Readium) to verify.
          </p>

          {error && (
            <p className="mt-3 font-sans text-xs text-amber-800">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="font-sans text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy || !title.trim()}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={16} weight="bold" className="animate-spin" />
            ) : (
              <Book size={16} weight="bold" />
            )}
            {busy ? "Generating…" : "Generate .epub"}
          </button>
        </div>
      </div>
    </div>
  );
}
