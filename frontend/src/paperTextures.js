// Paper texture pairs (C47.2). Pure data — no DOM, no styles.
//
// Each texture is a pre-tuned pair: pageColor (the writing surface) +
// surroundColor (the gutter around the page inside the editor column) with
// grain and shadow intensities. Consumers set the --lex-* variables on the
// editor root from these pairs. Plain White is the default and renders with
// the container white and the page wrapper transparent and full-bleed
// (gutter 0, max-width none), so shipping v0.10.0 keeps today's pixels —
// its declared surroundColor never actually shows.

export const PAPER_TEXTURES = [
  {
    id: "plain-white",
    label: "Plain White",
    pageColor: "#FFFFFF",
    surroundColor: "#F7F6F3",
    grainOpacity: 0,
    shadowStrength: 0,
  },
  {
    id: "warm-cream",
    label: "Warm Cream",
    pageColor: "#FEFBF0",
    surroundColor: "#F7F6F3",
    grainOpacity: 0.04,
    shadowStrength: 0.08,
  },
  {
    id: "linen",
    label: "Linen",
    pageColor: "#F5EFE0",
    surroundColor: "#F7F6F3",
    grainOpacity: 0.06,
    shadowStrength: 0.12,
  },
  {
    id: "newsprint",
    label: "Newsprint",
    pageColor: "#F2F3F1",
    surroundColor: "#F7F6F3",
    grainOpacity: 0.1,
    shadowStrength: 0.15,
  },
  {
    id: "dark-slate",
    label: "Dark Slate",
    pageColor: "#242424",
    surroundColor: "#1B1B1B",
    grainOpacity: 0.05,
    shadowStrength: 0.45,
  },
];
