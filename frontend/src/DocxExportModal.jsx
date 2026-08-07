import { useEffect, useState } from "react";
import {
  X,
  FileDoc,
  CircleNotch,
  PencilSimpleLine,
} from "@phosphor-icons/react";
import { downloadBlob } from "./download.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_AUTHOR_KEY = "lexicon:docxAuthor";
const DOCX_TRACK_KEY = "lexicon:docxTrackSuggestions";

function loadDefaultAuthor() {
  try {
    const saved = localStorage.getItem(DOCX_AUTHOR_KEY);
    return saved != null && saved !== "" ? saved : "";
  } catch {
    return "";
  }
}

function loadDefaultTrackSuggestions() {
  try {
    const saved = localStorage.getItem(DOCX_TRACK_KEY);
    return saved == null ? true : saved === "true";
  } catch {
    return true;
  }
}

export default function DocxExportModal({ editor, matches, onClose }) {
  const [author, setAuthor] = useState(loadDefaultAuthor);
  const [trackChanges, setTrackChanges] = useState(loadDefaultTrackSuggestions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, busy]);

  function handleAuthorChange(value) {
    setAuthor(value);
    try {
      localStorage.setItem(DOCX_AUTHOR_KEY, value);
    } catch {
      // storage unavailable — the export still uses the field value
    }
  }

  function handleTrackChange(checked) {
    setTrackChanges(checked);
    try {
      localStorage.setItem(DOCX_TRACK_KEY, String(checked));
    } catch {
      // storage unavailable — the export still uses the toggle state
    }
  }

  async function handleExport() {
    if (!editor || busy) return;
    setBusy(true);
    setError("");
    try {
      const revisions = (matches || [])
        .map((m) => ({
          offset: m.offset,
          length: m.length,
          suggestion: m.replacements?.[0] || "",
        }))
        .filter((r) => r.length > 0);
      const { buildDocx } = await import("./docxExport.js");
      const blob = await buildDocx({
        html: editor.getHTML(),
        revisions,
        author: author.trim(),
        trackChanges,
      });
      downloadBlob(blob, "document.docx", DOCX_MIME);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not generate the DOCX file.");
    } finally {
      setBusy(false);
    }
  }

  const revisionCount = (matches || []).filter((m) => m.length > 0).length;

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
        aria-labelledby="docx-export-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 id="docx-export-title" className="font-serif text-lg font-medium text-ink">
              Export DOCX
            </h2>
            <p className="font-sans text-xs text-muted">
              Standard .docx format. Opens in Microsoft Word, Google Docs, Apple
              Pages, LibreOffice, and more.
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
            <span className="flex items-center gap-1.5 font-sans text-xs font-medium text-ink">
              <PencilSimpleLine size={13} weight="bold" />
              Author Name for Tracked Suggestions
            </span>
            <input
              type="text"
              value={author}
              onChange={(event) => handleAuthorChange(event.target.value)}
              placeholder="Lex"
              className="mt-1 w-full rounded-lg border border-hairline bg-white px-3 py-2 font-sans text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink"
            />
            <span className="mt-1 block font-sans text-[11px] leading-relaxed text-muted">
              Saved as the default for future exports. This name appears next to
              every redline.
            </span>
          </label>

          <div className="mt-4 rounded-xl border border-hairline bg-hairline/20 p-3.5">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={trackChanges}
                onChange={(event) => handleTrackChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#1F6C9F]"
              />
              <span className="font-sans text-xs font-medium text-ink">
                Export with Tracked Suggestions
              </span>
            </label>
            <p className="mt-1.5 font-sans text-[11px] leading-relaxed text-muted">
              {revisionCount > 0
                ? `${revisionCount} active suggestion${revisionCount === 1 ? "" : "s"} will appear as redlines (strikethrough + insert) that you can accept or reject in Word, Google Docs, Apple Pages, or LibreOffice.`
                : "No active suggestions right now — this will export as a clean document."}
            </p>
          </div>

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
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {busy ? (
              <CircleNotch size={16} weight="bold" className="animate-spin" />
            ) : (
              <FileDoc size={16} weight="bold" />
            )}
            {busy ? "Generating…" : "Generate .docx"}
          </button>
        </div>
      </div>
    </div>
  );
}
