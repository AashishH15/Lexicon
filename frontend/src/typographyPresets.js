export const TYPOGRAPHY_PRESETS = [
  {
    id: "current",
    label: "Current",
    bodyFontStack: [
      '"Geist Sans"',
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Helvetica Neue",
      "Arial",
      "sans-serif",
    ],
    headingFontStack: ['"Newsreader"', "Georgia", "serif"],
    description:
      "The default look: a system sans-serif body with serif headings.",
  },
  {
    id: "editorial",
    label: "Serif / Editorial",
    bodyFontStack: ['"Newsreader"', "Georgia", '"Times New Roman"', "serif"],
    headingFontStack: ['"Newsreader"', "Georgia", '"Times New Roman"', "serif"],
    description:
      "Classic serif body and headings — Newsreader with Georgia and Times fallbacks.",
  },
  {
    id: "modern",
    label: "Sans / Modern",
    bodyFontStack: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Helvetica Neue",
      "Arial",
      "sans-serif",
    ],
    headingFontStack: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Helvetica Neue",
      "Arial",
      "sans-serif",
    ],
    description:
      "Inter-led sans-serif body and headings for a clean, contemporary look.",
  },
  {
    id: "mono",
    label: "Monospace / Code",
    bodyFontStack: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    headingFontStack: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    description:
      "JetBrains Mono for body and headings — a technical, monospaced look.",
  },
];
