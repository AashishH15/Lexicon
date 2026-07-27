import { useEffect, useState, useRef } from "react";
import { computeReadability } from "./readability.js";
import { Sliders, Check } from "@phosphor-icons/react";

const STAT_OPTIONS = [
  { id: "words", label: "Words", desc: "Total word count", getValue: (s) => s.wordCount },
  { id: "readingTime", label: "Reading Time", desc: "Based on 250 WPM", getValue: (s) => s.readingTime },
  { id: "speakingTime", label: "Speaking Time", desc: "Based on 130 WPM", getValue: (s) => s.speakingTime },
  { id: "chars", label: "Characters", desc: "Total character count", getValue: (s) => s.charCount },
  { id: "grade", label: "Flesch-Kincaid", desc: "Readability grade level", getValue: (s) => s.gradeLabel },
];

export default function DocStats({ editor }) {
  const [stats, setStats] = useState({
    wordCount: 0,
    charCount: 0,
    readingTime: "0:00",
    speakingTime: "0:00",
    gradeLabel: "-",
  });

  const [selectedStats, setSelectedStats] = useState(() => {
    const s1 = localStorage.getItem("lexicon:statSlot1");
    const s2 = localStorage.getItem("lexicon:statSlot2");
    if (s1 && s2 && s1 !== s2) return [s1, s2];
    return ["words", "chars"];
  });

  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => setStats(computeReadability(editor.getText()));
    update();
    editor.on("update", update);
    return () => editor.off("update", update);
  }, [editor]);

  useEffect(() => {
    if (selectedStats.length >= 1) {
      localStorage.setItem("lexicon:statSlot1", selectedStats[0]);
    } else {
      localStorage.removeItem("lexicon:statSlot1");
    }
    if (selectedStats.length >= 2) {
      localStorage.setItem("lexicon:statSlot2", selectedStats[1]);
    } else {
      localStorage.removeItem("lexicon:statSlot2");
    }
  }, [selectedStats]);

  useEffect(() => {
    if (!showPopover) return;
    const handleAway = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handleAway);
    return () => document.removeEventListener("mousedown", handleAway);
  }, [showPopover]);

  const opt1 = STAT_OPTIONS.find((o) => o.id === selectedStats[0]) || STAT_OPTIONS[0];
  const opt2 = STAT_OPTIONS.find((o) => o.id === selectedStats[1]) || STAT_OPTIONS.find((o) => o.id === "chars");

  function toggleStat(id) {
    setSelectedStats((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== id);
      }
      if (prev.length >= 2) {
        const next = [...prev.slice(1), id];
        return next;
      }
      return [...prev, id];
    });
  }

  return (
    <div className="relative mt-4 border-t border-hairline pt-3 font-mono text-[10px] text-muted">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          {selectedStats.length >= 1 && (
            <div>
              <span className="uppercase">{opt1.label}:</span>{" "}
              <span className="font-medium text-ink">{opt1.getValue(stats)}</span>
            </div>
          )}
          {selectedStats.length >= 2 && (
            <div>
              <span className="uppercase">{opt2.label}:</span>{" "}
              <span className="font-medium text-ink">{opt2.getValue(stats)}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPopover((p) => !p)}
          aria-label="Customize displayed stats"
          title="Customize stats"
          className="flex h-6 w-6 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
        >
          <Sliders size={13} weight="bold" />
        </button>
      </div>

      {showPopover && (
        <div
          ref={popoverRef}
          className="lex-pop absolute bottom-10 right-0 z-50 w-56 rounded-lg border border-hairline bg-white p-3 shadow-md"
        >
          <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
            Display Stats (Pick 2)
          </p>

          <div className="space-y-1 font-sans text-xs">
            {STAT_OPTIONS.map((opt) => {
              const checked = selectedStats.includes(opt.id);
              const disabled = !checked && selectedStats.length >= 2;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleStat(opt.id)}
                  className={
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors " +
                    (disabled
                      ? "cursor-not-allowed opacity-30"
                      : "hover:bg-canvas text-ink")
                  }
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors " +
                        (checked ? "border-ink bg-ink text-white" : "border-hairline")
                      }
                    >
                      {checked && <Check size={10} weight="bold" />}
                    </div>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-[9px] text-muted">{opt.desc}</span>
                    </div>
                  </div>
                  {checked && (
                    <span className="font-mono text-[9px] uppercase text-muted">
                      Line {selectedStats.indexOf(opt.id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
