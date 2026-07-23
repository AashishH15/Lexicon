import { useState, useEffect } from "react";
import {
  CheckCircle,
  PencilSimple,
  TextT,
  ChatCircleText,
  Briefcase,
  Article,
  ListChecks,
  ListBullets,
  Table,
  GraduationCap,
  Suitcase,
  TShirt,
  Confetti,
  Heart,
  Megaphone,
  Smiley,
  LockSimple,
  CircleNotch,
  X,
  Sparkle,
} from "@phosphor-icons/react";
import { getCustomTools } from "./prompts.js";
import { CUSTOM_ICON_MAP } from "./CustomToolsSettings.jsx";

const builtinGroups = [
  { label: "Analysis", tools: [{ name: "Proofread", icon: CheckCircle }] },
  {
    label: "Refinement",
    tools: [
      { name: "Rewrite", icon: PencilSimple },
      { name: "Concise", icon: TextT },
    ],
  },
  {
    label: "Tone",
    tools: [
      { name: "Friendly", icon: ChatCircleText },
      { name: "Professional", icon: Briefcase },
      { name: "Academic", icon: GraduationCap },
      { name: "Formal", icon: Suitcase },
      { name: "Casual", icon: TShirt },
      { name: "Playful", icon: Confetti },
      { name: "Empathetic", icon: Heart },
      { name: "Persuasive", icon: Megaphone },
      { name: "Humorous", icon: Smiley },
    ],
  },
  {
    label: "Structure",
    tools: [
      { name: "Summary", icon: Article },
      { name: "Key Points", icon: ListChecks },
      { name: "List", icon: ListBullets },
      { name: "Table", icon: Table },
    ],
  },
];

export default function Toolbar({ editor, activeTool, onToolClick, onAiSetup, aiConfigured, panelWidth, isMac, isWarming, transformStatus, transformRunning }) {
  const [customTools, setCustomTools] = useState(getCustomTools);

  useEffect(() => {
    function refresh() {
      setCustomTools(getCustomTools());
    }
    window.addEventListener("lexicon:tools-changed", refresh);
    return () => window.removeEventListener("lexicon:tools-changed", refresh);
  }, []);

  const groups = [...builtinGroups];
  if (customTools.length > 0) {
    groups.push({
      label: "Custom",
      tools: customTools.map((t) => ({
        name: t.name,
        icon: CUSTOM_ICON_MAP[t.icon] || Sparkle,
      })),
    });
  }

  // Below this panel width the Proofread shortcut hint can't fit alongside
  // the label, so we drop it to keep the row from wrapping/cramping.
  const showProofreadHint = (panelWidth ?? 256) >= 220;
  const proofreadHint = isMac ? "⌘ + ↵" : "Ctrl + ↵";
  const aiLocked = !aiConfigured;
  const warmingTool = isWarming && activeTool && activeTool !== "Proofread";
  const runningTool = transformRunning && activeTool && activeTool !== "Proofread";
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-2">
            {group.label}
          </p>
          <ul className="flex flex-col">
            {group.tools.map(({ name, icon: Icon }) => {
              const isProofread = name === "Proofread";
              const locked = aiLocked && !isProofread;
              const isWarmingThis = warmingTool === name;
              const isRunningThis = runningTool === name;
              return (
                <li key={name}>
                  <button
                    type="button"
                    disabled={locked || (isWarmingThis && !isRunningThis)}
                    onClick={() => (locked ? onAiSetup() : onToolClick(name))}
                    aria-pressed={activeTool === name}
                    aria-busy={isWarmingThis || isRunningThis}
                    title={locked ? "Set up Lexicon AI to use this tool" : isRunningThis ? "Click to cancel" : undefined}
                    className={
                      "group flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors " +
                      (locked
                        ? "cursor-not-allowed text-muted opacity-45"
                        : activeTool === name
                          ? "bg-ink text-white"
                          : "text-ink hover:bg-hairline/60")
                    }
                  >
                    <Icon
                      size={16}
                      weight="bold"
                      className={
                        "transition-transform duration-200 " +
                        (locked || isWarmingThis ? "" : "group-hover:scale-125")
                      }
                    />
                    <span className={locked ? "" : "transition-transform duration-200 group-hover:scale-105"}>
                      {name}
                    </span>
                    {locked && (
                      <LockSimple size={13} weight="bold" className="ml-auto opacity-70" />
                    )}
                    {isWarmingThis && (
                      <CircleNotch size={14} weight="bold" className="ml-auto animate-spin" />
                    )}
                    {isRunningThis && (
                      <X size={14} weight="bold" className="ml-auto opacity-80" />
                    )}
                    {isProofread && showProofreadHint && (
                      <kbd className="ml-auto rounded border border-current/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider opacity-60">
                        {proofreadHint}
                      </kbd>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
