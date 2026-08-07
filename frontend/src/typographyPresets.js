export const TYPOGRAPHY_PRESETS = [
  {
    id: "current",
    label: "Default",
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
      "System sans-serif body with serif headings.",
  },
  {
    id: "editorial",
    label: "Editorial",
    bodyFontStack: ['"Newsreader"', "Georgia", '"Times New Roman"', "serif"],
    headingFontStack: ['"Newsreader"', "Georgia", '"Times New Roman"', "serif"],
    description:
      "Newsreader serif body and headings for classic literary writing.",
  },
  {
    id: "modern",
    label: "Modern",
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
      "Inter sans-serif body and headings for clean contemporary prose.",
  },
  {
    id: "mono",
    label: "Monospace",
    bodyFontStack: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    headingFontStack: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
    description:
      "JetBrains Mono body and headings for technical drafting.",
  },
];
