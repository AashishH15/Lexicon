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
} from "@phosphor-icons/react";

const groups = [
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

export default function Toolbar() {
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-2">
            {group.label}
          </p>
          <ul className="flex flex-col">
            {group.tools.map(({ name, icon: Icon }) => (
              <li key={name}>
                <button
                  type="button"
                  className="group flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-ink hover:bg-hairline/60"
                >
                  <Icon
                    size={16}
                    weight="bold"
                    className="text-muted transition-transform duration-200 group-hover:scale-125"
                  />
                  <span className="transition-transform duration-200 group-hover:scale-105">
                    {name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
