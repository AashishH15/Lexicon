import { useEffect, useState } from "react";
import { TONE_TOOLS, rawScoreForTone } from "./toneScore.js";

const PALETTE = [
  "#1f6c9f",
  "#346538",
  "#956400",
  "#787774",
  "#9f2f2d",
  "#5b7e7a",
  "#7a5c3d",
  "#b4719f",
  "#a05b8a",
];

export default function ToneChart({ editor }) {
  const [distribution, setDistribution] = useState([]);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const text = editor.getText().toLowerCase().trim();
      if (!text) {
        setDistribution([]);
        return;
      }
      const scores = TONE_TOOLS.map((tone) => ({
        tone,
        raw: rawScoreForTone(text, tone),
      }));
      const grandTotal = scores.reduce((sum, s) => sum + s.raw, 0);
      if (grandTotal === 0) {
        setDistribution([]);
        return;
      }
      const withPct = scores
        .map((s) => ({
          tone: s.tone,
          pct: Math.round((s.raw / grandTotal) * 100),
        }))
        .filter((s) => s.pct > 0)
        .sort((a, b) => b.pct - a.pct);
      setDistribution(withPct);
    };
    update();
    editor.on("update", update);
    return () => editor.off("update", update);
  }, [editor]);

  if (distribution.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-hairline bg-canvas p-3 font-mono text-[10px] text-muted">
        <p className="italic">Neutral / Unclear — no strong tone signals detected.</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#EAEAEA]">
        {distribution.map((d, i) => (
          <div
            key={d.tone}
            style={{
              width: `${d.pct}%`,
              backgroundColor: PALETTE[i % PALETTE.length],
            }}
            className="h-full transition-all duration-500 ease-out"
            title={`${d.tone}: ${d.pct}%`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {distribution.map((d, i) => (
          <div key={d.tone} className="flex items-center gap-1.5 font-sans text-[10px] text-muted">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="font-medium text-ink">{d.tone}</span>
            <span>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
