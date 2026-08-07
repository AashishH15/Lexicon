// @vitest-environment jsdom
// C47.5: unit tests for the appearance workstream: typography preset catalog,
// paper texture catalog, Bionic reading mode (prefix transforms + decoration
// plugin), the OpenDyslexic font swap, and the appearance settings
// persistence contract (load, fallback, reset).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { InlineMath, BlockMath } from "@tiptap/extension-mathematics";
import tailwindConfig from "../../tailwind.config.js";
import { TYPOGRAPHY_PRESETS } from "../typographyPresets.js";
import { PAPER_TEXTURES } from "../paperTextures.js";
import {
  READING_MODES,
  READING_MODE_DEFAULT,
  OPEN_DYSLEXIC_CLASS,
  setReadingMode,
  getReadingMode,
  applyReadingMode,
  bionicPrefixes,
  BIONIC_SKIP_NODES,
  bionicReadingPluginKey,
  BionicReading,
} from "../readingMode.js";
import { SETTINGS_DEFAULTS } from "../Settings.jsx";
import {
  typographyPresetKey,
  paperTextureKey,
  readingModeKey,
  loadTypographyPreset,
  loadPaperTexture,
  loadReadingMode,
} from "../appearanceSettings.js";

const GENERICS = new Set(["serif", "sans-serif", "monospace"]);

describe("Typography preset catalog invariants", () => {
  it("has unique ids", () => {
    const ids = TYPOGRAPHY_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset carries all required fields with sane values", () => {
    for (const preset of TYPOGRAPHY_PRESETS) {
      expect(typeof preset.id).toBe("string");
      expect(preset.id.length).toBeGreaterThan(0);
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.description).toBe("string");
      expect(preset.description.length).toBeGreaterThan(0);
      expect(Array.isArray(preset.bodyFontStack)).toBe(true);
      expect(Array.isArray(preset.headingFontStack)).toBe(true);
    }
  });

  it("has no undefined or NaN values anywhere", () => {
    for (const preset of TYPOGRAPHY_PRESETS) {
      for (const key of ["id", "label", "description"]) {
        expect(preset[key]).not.toBeUndefined();
      }
      for (const stack of [preset.bodyFontStack, preset.headingFontStack]) {
        expect(stack).not.toBeUndefined();
        for (const face of stack) {
          expect(typeof face).toBe("string");
          expect(Number.isNaN(face)).toBe(false);
        }
      }
    }
  });

  it("font stacks are non-empty and end in a generic family", () => {
    for (const preset of TYPOGRAPHY_PRESETS) {
      for (const stack of [preset.bodyFontStack, preset.headingFontStack]) {
        expect(stack.length).toBeGreaterThanOrEqual(2);
        expect(GENERICS.has(stack[stack.length - 1])).toBe(true);
      }
    }
  });

  it("lists the current preset first", () => {
    expect(TYPOGRAPHY_PRESETS[0].id).toBe("current");
  });

  it("current preset stacks match tailwind.config.js exactly", () => {
    const current = TYPOGRAPHY_PRESETS[0];
    const { sans, serif } = tailwindConfig.theme.extend.fontFamily;
    expect(current.bodyFontStack).toEqual(sans);
    expect(current.headingFontStack).toEqual(serif);
  });
});

describe("Paper texture catalog invariants", () => {
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  it("has exactly the five known textures", () => {
    expect(PAPER_TEXTURES).toHaveLength(5);
  });

  it("has unique ids", () => {
    const ids = PAPER_TEXTURES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every texture carries both color fields and sane grain/shadow bounds", () => {
    for (const texture of PAPER_TEXTURES) {
      expect(typeof texture.id).toBe("string");
      expect(texture.id.length).toBeGreaterThan(0);
      expect(typeof texture.label).toBe("string");
      expect(HEX_RE.test(texture.pageColor)).toBe(true);
      expect(HEX_RE.test(texture.surroundColor)).toBe(true);
      expect(typeof texture.grainOpacity).toBe("number");
      expect(Number.isNaN(texture.grainOpacity)).toBe(false);
      expect(texture.grainOpacity).toBeGreaterThanOrEqual(0);
      expect(texture.grainOpacity).toBeLessThanOrEqual(0.15);
      expect(typeof texture.shadowStrength).toBe("number");
      expect(Number.isNaN(texture.shadowStrength)).toBe(false);
      expect(texture.shadowStrength).toBeGreaterThanOrEqual(0);
      expect(texture.shadowStrength).toBeLessThanOrEqual(0.6);
    }
  });

  it("lists plain white first as the shipping default", () => {
    expect(PAPER_TEXTURES[0].id).toBe("plain-white");
    expect(PAPER_TEXTURES[0].pageColor).toBe("#FFFFFF");
    expect(PAPER_TEXTURES[0].grainOpacity).toBe(0);
    expect(PAPER_TEXTURES[0].shadowStrength).toBe(0);
  });

  it("keeps ink readable on every page color (WCAG contrast)", () => {
    for (const texture of PAPER_TEXTURES) {
      if (texture.id === "dark-slate") {
        // Dark Slate is the dark theme: the app inverts the text to a light
        // ink (C47.4 dark-slate overrides), so check that pair instead.
        expect(contrastRatio("#eceae4", texture.pageColor)).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(contrastRatio("#111111", texture.pageColor)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps ink readable on the surround shell of every theme (WCAG AA)", () => {
    for (const texture of PAPER_TEXTURES) {
      if (texture.id === "dark-slate") {
        expect(contrastRatio("#edece8", texture.surroundColor)).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(contrastRatio("#111111", texture.surroundColor)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps muted text readable on every page and surround (WCAG AA)", () => {
    // Muted comes from the Tailwind token so the test tracks the real value.
    const muted = tailwindConfig.theme.extend.colors.muted;
    for (const texture of PAPER_TEXTURES) {
      if (texture.id === "dark-slate") {
        // Dark Slate overrides text-muted to a light gray on the dark shell.
        expect(contrastRatio("#b0ada6", texture.pageColor)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio("#b0ada6", texture.surroundColor)).toBeGreaterThanOrEqual(4.5);
        // ...and on elevated surfaces (the dark bg-white replacement).
        expect(contrastRatio("#b0ada6", "#2c2c2c")).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(contrastRatio(muted, texture.pageColor)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(muted, texture.surroundColor)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(muted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps placeholder hints readable (WCAG AA)", () => {
    // Light theme: the placeholder-muted class and placeholder:text-muted
    // both resolve to the muted token.
    const muted = tailwindConfig.theme.extend.colors.muted;
    expect(contrastRatio(muted, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, "#F7F6F3")).toBeGreaterThanOrEqual(4.5);
    // Dark Slate: the CSS override re-lights placeholders on inputs.
    expect(contrastRatio("#9a9791", "#2c2c2c")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#9a9791", "#1b1b1b")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Bionic prefix transforms", () => {
  it("emphasizes the first half of each word, at least one character", () => {
    expect(bionicPrefixes("hello")).toEqual([{ from: 0, to: 3 }]);
    expect(bionicPrefixes("hi")).toEqual([{ from: 0, to: 1 }]);
    expect(bionicPrefixes("a")).toEqual([{ from: 0, to: 1 }]);
    expect(bionicPrefixes("four")).toEqual([{ from: 0, to: 2 }]);
  });

  it("keeps punctuation outside the emphasized spans", () => {
    expect(bionicPrefixes("Hello, world!")).toEqual([
      { from: 0, to: 3 },
      { from: 7, to: 10 },
    ]);
  });

  it("treats internal apostrophes as part of the word", () => {
    expect(bionicPrefixes("don't")).toEqual([{ from: 0, to: 3 }]);
    expect(bionicPrefixes("o'clock")).toEqual([{ from: 0, to: 4 }]);
  });

  it("handles unicode letters and digits", () => {
    expect(bionicPrefixes("café")).toEqual([{ from: 0, to: 2 }]);
    expect(bionicPrefixes("École")).toEqual([{ from: 0, to: 3 }]);
    expect(bionicPrefixes("2024")).toEqual([{ from: 0, to: 2 }]);
  });

  it("splits hyphenated compounds into separate words", () => {
    expect(bionicPrefixes("well-known")).toEqual([
      { from: 0, to: 2 },
      { from: 5, to: 8 },
    ]);
  });

  it("ignores emoji and symbols", () => {
    expect(bionicPrefixes("🎉 party 🎉")).toEqual([{ from: 3, to: 6 }]);
    expect(bionicPrefixes("***")).toEqual([]);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(bionicPrefixes("")).toEqual([]);
    expect(bionicPrefixes("   \n\t ")).toEqual([]);
  });

  it("tracks offsets inside leading and trailing whitespace", () => {
    expect(bionicPrefixes("  hello  ")).toEqual([{ from: 2, to: 5 }]);
  });

  it("never emits out-of-range or inverted spans", () => {
    const samples = ["Hello world", "x", "don't stop", "  spaced  out  "];
    for (const sample of samples) {
      for (const { from, to } of bionicPrefixes(sample)) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThanOrEqual(sample.length);
        expect(from).toBeLessThan(to);
      }
    }
  });
});

describe("Bionic reading decoration plugin", () => {
  let editor;

  function makeEditor(content, extra = []) {
    return new Editor({
      extensions: [StarterKit, ...extra, BionicReading],
      content,
    });
  }

  function bionicRanges() {
    const set = bionicReadingPluginKey.getState(editor.state).set;
    return set.find().map((d) => ({ from: d.from, to: d.to, className: d.type.attrs.class }));
  }

  beforeEach(() => {
    setReadingMode("off");
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    setReadingMode("off");
  });

  it("emphasizes the first half of every word with font-weight 700", () => {
    setReadingMode("bionic");
    editor = makeEditor("<p>Hello world</p>");
    editor.view.dispatch(editor.state.tr);
    expect(bionicRanges()).toEqual([
      { from: 1, to: 4, className: "lex-bionic-prefix" },
      { from: 7, to: 10, className: "lex-bionic-prefix" },
    ]);
  });

  it("tracks the active mode via getReadingMode/setReadingMode", () => {
    setReadingMode("bionic");
    expect(getReadingMode()).toBe("bionic");
    setReadingMode("off");
    expect(getReadingMode()).toBe("off");
    expect(READING_MODE_DEFAULT).toBe("off");
  });

  it("emits no decorations while the mode is off or open-dyslexic", () => {
    editor = makeEditor("<p>Hello world</p>");
    editor.view.dispatch(editor.state.tr);
    expect(bionicRanges()).toEqual([]);
    setReadingMode("open-dyslexic");
    editor.view.dispatch(editor.state.tr);
    expect(bionicRanges()).toEqual([]);
    setReadingMode("bionic");
    editor.view.dispatch(editor.state.tr);
    expect(bionicRanges().length).toBeGreaterThan(0);
    setReadingMode("off");
    editor.view.dispatch(editor.state.tr);
    expect(bionicRanges()).toEqual([]);
  });

  it("skips code blocks, inline code, and math nodes", () => {
    setReadingMode("bionic");
    editor = makeEditor(
      "<pre><code>const x = 1</code></pre><p>plain text</p>",
      [InlineMath, BlockMath],
    );
    editor.commands.insertContent({ type: "inlineMath", attrs: { latex: "x^2" } });
    editor.commands.insertContent({ type: "blockMath", attrs: { latex: "\\int_0^1 x\\,dx" } });
    editor.view.dispatch(editor.state.tr);

    const ranges = bionicRanges();
    expect(ranges.length).toBeGreaterThan(0);
    const covered = new Set();
    for (const r of ranges) {
      for (let i = r.from; i < r.to; i += 1) {
        covered.add(i);
      }
    }
    editor.state.doc.descendants((node, pos) => {
      const skipped =
        BIONIC_SKIP_NODES.has(node.type.name) ||
        node.marks.some((mark) => mark.type.name === "code");
      if (skipped) {
        for (let i = pos; i < pos + node.nodeSize; i += 1) {
          expect(covered.has(i)).toBe(false);
        }
      }
    });
  });

  it("lists exactly the code/math node types in the skip list", () => {
    expect(BIONIC_SKIP_NODES.size).toBe(3);
    for (const name of ["codeBlock", "inlineMath", "blockMath"]) {
      expect(BIONIC_SKIP_NODES.has(name)).toBe(true);
    }
  });

  it("never mutates the document when toggling modes (non-destructive)", () => {
    editor = makeEditor("<p>Hello world, this is a <code>test</code>.</p>");
    const beforeText = editor.state.doc.textContent;
    const beforeJson = JSON.stringify(editor.getJSON());

    const markCount = () => {
      let count = 0;
      editor.state.doc.descendants((node) => {
        if (node.isText) {
          count += node.marks.length;
        }
      });
      return count;
    };
    // The content itself carries one code mark; bionic must not add any.
    const beforeMarks = markCount();
    expect(beforeMarks).toBe(1);

    for (const mode of ["bionic", "open-dyslexic", "off", "bionic", "off"]) {
      setReadingMode(mode);
      editor.view.dispatch(editor.state.tr);
    }

    expect(editor.state.doc.textContent).toBe(beforeText);
    expect(JSON.stringify(editor.getJSON())).toBe(beforeJson);
    expect(markCount()).toBe(beforeMarks);
  });

  it("computes decorations immediately on initial load in bionic mode", () => {
    setReadingMode("bionic");
    editor = makeEditor("<p>Hello world</p>");
    expect(bionicRanges().length).toBe(2);
  });
});

describe("OpenDyslexic reading mode", () => {
  it("toggles the font-swap class on the editor root", () => {
    const root = document.createElement("div");
    applyReadingMode(root, "open-dyslexic");
    expect(root.classList.contains(OPEN_DYSLEXIC_CLASS)).toBe(true);
    applyReadingMode(root, "off");
    expect(root.classList.contains(OPEN_DYSLEXIC_CLASS)).toBe(false);
    applyReadingMode(root, "bionic");
    expect(root.classList.contains(OPEN_DYSLEXIC_CLASS)).toBe(false);
    applyReadingMode(root, "open-dyslexic");
    applyReadingMode(root, "open-dyslexic");
    expect(root.classList.contains(OPEN_DYSLEXIC_CLASS)).toBe(true);
  });

  it("is a no-op without a root element", () => {
    expect(() => applyReadingMode(null, "open-dyslexic")).not.toThrow();
    expect(() => applyReadingMode(undefined, "off")).not.toThrow();
  });

  it("bundled @font-face rules resolve to real font files", () => {
    const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../index.css");
    const css = readFileSync(cssPath, "utf8");

    const allFaces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(allFaces.length).toBeGreaterThanOrEqual(4);

    for (const face of allFaces) {
      const match = face.match(/url\(\s*"?\.\/assets\/fonts\/([^")\s]+)"?\)/);
      expect(match).not.toBeNull();
      const filePath = resolve(dirname(cssPath), "assets/fonts", match[1]);
      expect(existsSync(filePath)).toBe(true);
    }

    const openDyslexicFaces = allFaces.filter((f) => f.includes('font-family: "OpenDyslexic"'));
    expect(openDyslexicFaces).toHaveLength(2);

    const weights = openDyslexicFaces.map((f) => f.match(/font-weight:\s*(\d+)/)?.[1]);
    expect(weights.sort()).toEqual(["400", "700"]);
    expect(css).toContain(".lex-reading-open-dyslexic");
  });
});

describe("Reading modes catalog", () => {
  it("lists exactly the three known modes in order", () => {
    expect(READING_MODES.map((m) => m.id)).toEqual(["off", "bionic", "open-dyslexic"]);
    for (const mode of READING_MODES) {
      expect(typeof mode.label).toBe("string");
      expect(mode.label.length).toBeGreaterThan(0);
    }
  });
});

describe("Appearance settings persistence & fallbacks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("SETTINGS_DEFAULTS carries the three appearance keys", () => {
    expect(SETTINGS_DEFAULTS.typographyPreset).toBe("current");
    expect(SETTINGS_DEFAULTS.paperTexture).toBe("plain-white");
    expect(SETTINGS_DEFAULTS.readingMode).toBe("off");
  });

  it("round-trips valid ids through the storage keys", () => {
    localStorage.setItem(typographyPresetKey, "editorial");
    localStorage.setItem(paperTextureKey, "linen");
    localStorage.setItem(readingModeKey, "bionic");
    expect(loadTypographyPreset()).toBe("editorial");
    expect(loadPaperTexture()).toBe("linen");
    expect(loadReadingMode()).toBe("bionic");
  });

  it("falls back to the default when the stored value is unknown or corrupt", () => {
    for (const bad of ["bogus", "123", "{}", "null", "[object Object]"]) {
      localStorage.setItem(typographyPresetKey, bad);
      localStorage.setItem(paperTextureKey, bad);
      localStorage.setItem(readingModeKey, bad);
      expect(loadTypographyPreset()).toBe("current");
      expect(loadPaperTexture()).toBe("plain-white");
      expect(loadReadingMode()).toBe("off");
    }
  });

  it("falls back to the default when the key is absent", () => {
    expect(loadTypographyPreset()).toBe("current");
    expect(loadPaperTexture()).toBe("plain-white");
    expect(loadReadingMode()).toBe("off");
  });

  it("reset defaults restores the three keys and leaves unrelated keys alone", () => {
    localStorage.setItem(typographyPresetKey, "mono");
    localStorage.setItem(paperTextureKey, "dark-slate");
    localStorage.setItem(readingModeKey, "open-dyslexic");
    localStorage.setItem("lexicon:language", "en-GB");
    localStorage.setItem("lexicon:user_dictionary", '["lexicon"]');

    // Same removal sequence as handleResetDefaults in App.jsx.
    localStorage.removeItem(typographyPresetKey);
    localStorage.removeItem(paperTextureKey);
    localStorage.removeItem(readingModeKey);

    expect(loadTypographyPreset()).toBe("current");
    expect(loadPaperTexture()).toBe("plain-white");
    expect(loadReadingMode()).toBe("off");
    expect(localStorage.getItem("lexicon:language")).toBe("en-GB");
    expect(localStorage.getItem("lexicon:user_dictionary")).toBe('["lexicon"]');
  });
});

function channel(value) {
  const n = value / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const m = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  expect(m).not.toBeNull();
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].map(
    channel,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
