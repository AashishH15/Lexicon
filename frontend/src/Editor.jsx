import { useState, useEffect, useRef, forwardRef } from "react";
import { EditorContent } from "@tiptap/react";
import { getMarkRange } from "@tiptap/core";
import {
  Info,
  CaretUp,
  CaretDown,
  ArrowSquareOut,
  Pen,
  LinkBreak,
} from "@phosphor-icons/react";
import FormatToolbar from "./FormatToolbar.jsx";

export default function Editor({
  editor,
  fontSize,
  lineSpacing,
  clarityScore,
  clarityGrade,
  clarityDensity,
  grammarMatches,
  emptyDoc,
  proofreadActive,
  toneResult,
}) {
  const hasMetrics = proofreadActive && !emptyDoc;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("lexicon:metricsCollapsed");
    return saved === null ? true : saved === "true";
  });

  const detailed = showBreakdown && !collapsed;
  const [linkPopover, setLinkPopover] = useState(null);
  const linkPopoverRef = useRef(null);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("lexicon:metricsCollapsed", String(next));
      return next;
    });
  }

  // Hover handling on links inside the editor:
  //  - Hovering a link shows the inline edit/delete popover.
  //  - Clicking the link itself uses the browser's native behavior
  //    (opens in the same tab; Ctrl/Cmd+Click opens in a new tab), so we
  //    don't fight the browser over navigation.
  //  - Moving away from the link (with a short grace period) closes it.
  const closeTimer = useRef(null);

  function scheduleClose() {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setLinkPopover(null), 160);
  }

  function cancelClose() {
    clearTimeout(closeTimer.current);
  }

  useEffect(() => {
    if (!editor) {
      return;
    }
    const dom = editor.view.dom;
    const handleOver = (event) => {
      const anchor = event.target.closest("a");
      if (!anchor || !anchor.href) {
        scheduleClose();
        return;
      }
      cancelClose();
      const rect = anchor.getBoundingClientRect();
      // Resolve the link's exact document range so edits/removals target
      // this link even when the editor caret is elsewhere.
      const pos = editor.view.posAtDOM(anchor, 0);
      const $pos = editor.state.doc.resolve(pos);
      const range = getMarkRange($pos, editor.state.schema.marks.link);
      setLinkPopover({
        href: anchor.getAttribute("href") || "",
        rect: { top: rect.top, left: rect.left, bottom: rect.bottom },
        from: range ? range.from : null,
        to: range ? range.to : null,
      });
    };
    dom.addEventListener("mouseover", handleOver);
    return () => {
      dom.removeEventListener("mouseover", handleOver);
      clearTimeout(closeTimer.current);
    };
  }, [editor]);

  // Click-away close: dismiss the popover when clicking outside it.
  useEffect(() => {
    if (!linkPopover) {
      return;
    }
    const handleAway = (event) => {
      if (
        linkPopoverRef.current &&
        !linkPopoverRef.current.contains(event.target)
      ) {
        setLinkPopover(null);
      }
    };
    document.addEventListener("mousedown", handleAway);
    return () => document.removeEventListener("mousedown", handleAway);
  }, [linkPopover]);

  function requestLink(editorInstance) {
    if (!editorInstance) {
      return;
    }
    const { from, to } = editorInstance.state.selection;
    if (from === to) {
      return;
    }
    const rect = editorInstance.view.coordsAtPos(from);
    setLinkPopover({
      href: editorInstance.getAttributes("link").href || "",
      rect: { top: rect.top, left: rect.left, bottom: rect.bottom },
      addMode: true,
    });
  }

  function applyLink(href) {
    const url = href.trim();
    if (!url || !linkPopover || linkPopover.from == null) {
      return;
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkPopover.from, to: linkPopover.to })
      .setLink({ href: url })
      .run();
    setLinkPopover(null);
  }

  function removeLink() {
    if (!linkPopover || linkPopover.from == null) {
      return;
    }
    editor
      .chain()
      .focus()
      .setTextSelection({ from: linkPopover.from, to: linkPopover.to })
      .unsetLink()
      .run();
    setLinkPopover(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          Source Document
        </p>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand metrics" : "Collapse metrics"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand metrics" : "Collapse metrics"}
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
        >
          {collapsed ? (
            <CaretDown size={14} weight="bold" />
          ) : (
            <CaretUp size={14} weight="bold" />
          )}
        </button>
      </div>

      {collapsed ? (
        <div className="mt-4 grid grid-cols-2 gap-4 mb-6">
          <div className="lex-card-enter flex items-center justify-between rounded border border-hairline bg-white px-4 py-3">
            <span className="font-mono text-xs uppercase leading-none tracking-widest text-[#787774]">
              Clarity Score
            </span>
            <span className="font-mono text-sm font-medium text-[#111111]">
              {hasMetrics ? clarityScore : "-"}
            </span>
          </div>
          <div className="lex-card-enter flex items-center justify-between rounded border border-hairline bg-white px-4 py-3">
            <span className="font-mono text-xs uppercase leading-none tracking-widest text-[#787774]">
              Tone
            </span>
            <span className="truncate pl-3 font-mono text-sm font-medium text-[#111111]">
              {toneResult ? toneResult.label : "N/A"}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="mt-4 grid grid-cols-2 gap-4 mb-6"
          onMouseEnter={() => setShowBreakdown(true)}
          onMouseLeave={() => setShowBreakdown(false)}
        >
          <div className="lex-card-enter flex flex-col justify-between rounded border border-hairline bg-white p-6">
            <div className="flex flex-col">
              <div className="mb-4 flex items-center gap-1.5">
                <span className="font-mono text-xs uppercase leading-none tracking-widest text-[#787774]">
                  Clarity Score
                </span>
                <span className="group relative inline-flex">
                  <Info size={13} weight="bold" className="-mt-px text-[#787774]" />
                  <span className="pointer-events-none absolute left-0 top-5 z-10 w-60 rounded-md border border-hairline bg-white p-3 font-sans text-[11px] leading-relaxed text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                    A readbility score from 0 to 100. It uses an error density
                    ratio, not a raw count: Clarity = 100 minus (active
                    suggestions divided by total word count, times 100, times a
                    severity weight of 12).
                  </span>
                </span>
              </div>
              <p className="font-serif text-4xl font-bold text-[#111111]">
                {hasMetrics ? clarityScore : "-"}
              </p>
              {hasMetrics && clarityGrade && (
                <>
                  <p className="mt-2 block font-mono text-[10px] font-medium uppercase tracking-widest text-[#111111]">
                    {clarityGrade}
                  </p>
                  {clarityDensity && (
                    <p className="mt-0.5 block font-mono text-[10px] lowercase tracking-widest text-muted">
                      {clarityDensity}
                    </p>
                  )}
                </>
              )}
              <div
                className={
                  "overflow-hidden transition-all duration-200 ease-out " +
                  (detailed ? "mt-3 max-h-60 opacity-100" : "max-h-0 opacity-0")
                }
              >
                <div className="rounded-md border border-hairline bg-canvas p-3 font-mono text-[10px] leading-relaxed text-muted">
                  <p className="mb-1 uppercase tracking-widest text-[#787774]">
                    Issue Breakdown
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span>Spelling Errors</span>
                    <span className="font-medium text-[#111111]">
                      {grammarMatches.filter((m) => m.category === "Spelling").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Grammar Conflicts</span>
                    <span className="font-medium text-[#111111]">
                      {grammarMatches.filter((m) => m.category === "Grammar").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Punctuation Marks</span>
                    <span className="font-medium text-[#111111]">
                      {grammarMatches.filter((m) => m.category === "Punctuation").length}
                    </span>
                  </div>
                  <div className="my-1 border-t border-hairline" />
                  <div className="flex items-center justify-between gap-2 font-medium text-[#111111]">
                    <span>TOTAL DETECTED</span>
                    <span>{grammarMatches.length}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[#EAEAEA]">
              <div
                className="h-full bg-[#111111] transition-all duration-500 ease-out"
                style={{ width: `${hasMetrics ? clarityScore : 0}%` }}
              />
            </div>
          </div>
          <div className="lex-card-enter flex flex-col rounded border border-hairline bg-white p-6">
            <div className="flex flex-col">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="font-mono text-xs uppercase leading-none tracking-widest text-[#787774]">
                  Tone
                </span>
                <span className="group relative inline-flex">
                  <Info size={13} weight="bold" className="-mt-px text-[#787774]" />
                  <span className="pointer-events-none absolute left-0 top-5 z-10 w-60 rounded-md border border-hairline bg-white p-3 font-sans text-[11px] leading-relaxed text-muted opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                    Automatically detects the dominant tone of your text. It scans
                    for tone signals (formal transitions, pronouns, sentence
                    length) and scores alignment from 0 to 100. No server calls,
                    instant on every keystroke.
                  </span>
                </span>
              </div>
              <p className="font-serif text-4xl font-bold text-[#111111]">
                {toneResult ? toneResult.label : "N/A"}
              </p>
              {toneResult ? (
                <div className="group mt-2">
                  <div className="font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-sm font-medium text-[#111111]">
                      {toneResult.score}% ALIGNMENT
                    </span>
                    <p className="mt-0.5 block text-muted">{toneResult.status}</p>
                  </div>
                  <div
                    className={
                      "overflow-hidden transition-all duration-200 ease-out " +
                      (detailed
                        ? "mt-3 max-h-60 opacity-100"
                        : "max-h-0 opacity-0")
                    }
                  >
                    <div className="rounded-md border border-hairline bg-canvas p-3 font-mono text-[10px] leading-relaxed text-muted">
                      <p className="mb-1 uppercase tracking-widest text-[#787774]">
                        Tone Composition
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-[#111111]">
                          {toneResult.label === "NEUTRAL / UNCLEAR"
                            ? toneResult.label
                            : `${toneResult.label} Signals`}
                        </span>
                        <span className="font-medium text-[#111111]">
                          {toneResult.score}%
                        </span>
                      </div>
                      {toneResult.parts.map((part) => (
                        <div
                          key={part.label}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-muted">
                            {part.label}
                          </span>
                          <span className="text-muted">{part.value}%</span>
                        </div>
                      ))}
                      <div className="my-1 border-t border-hairline" />
                      <div className="flex items-center justify-between gap-2 font-medium text-[#111111]">
                        <span>TOTAL</span>
                        <span>
                          {toneResult.score +
                            toneResult.parts.reduce(
                              (sum, p) => sum + p.value,
                              0
                            )}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                  No Tone Selected
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <FormatToolbar editor={editor} onRequestLink={requestLink} />

      <div className="lex-scroll flex-1 overflow-auto rounded border border-hairline bg-white">
        <EditorContent
          editor={editor}
          style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
          className="h-full px-8 py-3 text-ink [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      </div>

      {linkPopover && (
        <LinkPopover
          ref={linkPopoverRef}
          data={linkPopover}
          onOpen={() =>
            linkPopover.href &&
            window.open(linkPopover.href, "_blank", "noopener,noreferrer")
          }
          onApply={applyLink}
          onRemove={removeLink}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onClose={() => setLinkPopover(null)}
        />
      )}
    </div>
  );
}

const LinkPopover = forwardRef(function LinkPopover(
  { data, onOpen, onApply, onRemove, onMouseEnter, onMouseLeave, onClose },
  ref,
) {
  const [value, setValue] = useState(data.href || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const style = {
    position: "fixed",
    top: data.rect.bottom + 6,
    left: data.rect.left,
    zIndex: 50,
  };

  return (
    <div
      ref={ref}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="lex-pop flex w-72 items-center gap-2 rounded-lg border border-hairline bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onApply(value);
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="https://example.com"
        className="min-w-0 flex-1 rounded border border-hairline bg-canvas px-2 py-1.5 font-sans text-xs text-ink outline-none focus:border-muted"
      />
      {data.href && (
        <button
          type="button"
          title="Open link"
          aria-label="Open link"
          onClick={onOpen}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
        >
          <ArrowSquareOut size={16} weight="bold" />
        </button>
      )}
      <button
        type="button"
        title="Save link"
        aria-label="Save link"
        onClick={() => onApply(value)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
      >
        <Pen size={16} weight="bold" />
      </button>
      <button
        type="button"
        title="Remove link"
        aria-label="Remove link"
        onClick={onRemove}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-pale-red hover:text-pale-red-text"
      >
        <LinkBreak size={16} weight="bold" />
      </button>
    </div>
  );
});
