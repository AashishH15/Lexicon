// Catalog-validated appearance settings: typography preset, paper
// texture, reading mode. Extracted from App.jsx so the unit suite can test
// the load/fallback contract directly. A stored value that matches no known
// preset/texture/mode id (corrupt, or from an older build) falls back to the
// setting default rather than rendering a blank state.

import { SETTINGS_DEFAULTS } from "./Settings.jsx";
import { TYPOGRAPHY_PRESETS } from "./typographyPresets.js";
import { PAPER_TEXTURES } from "./paperTextures.js";
import { READING_MODES } from "./readingMode.js";

export const typographyPresetKey = "lexicon:typographyPreset";
export const paperTextureKey = "lexicon:paperTexture";
export const readingModeKey = "lexicon:readingMode";

export function loadTypographyPreset() {
  const saved = localStorage.getItem(typographyPresetKey);
  return TYPOGRAPHY_PRESETS.some((p) => p.id === saved)
    ? saved
    : SETTINGS_DEFAULTS.typographyPreset;
}

export function loadPaperTexture() {
  const saved = localStorage.getItem(paperTextureKey);
  return PAPER_TEXTURES.some((t) => t.id === saved)
    ? saved
    : SETTINGS_DEFAULTS.paperTexture;
}

export function loadReadingMode() {
  const saved = localStorage.getItem(readingModeKey);
  return READING_MODES.some((m) => m.id === saved)
    ? saved
    : SETTINGS_DEFAULTS.readingMode;
}
