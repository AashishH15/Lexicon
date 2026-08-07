// Reading modes: Off / Bionic / OpenDyslexic.
//
// Bionic emphasis is a ProseMirror decoration plugin, never document marks.
// Content stays byte-identical, so undo/redo, save/load, and grammar-match
// offsets are untouched. OpenDyslexic is a font swap: applyReadingMode()
// toggles a class on the editor root, and CSS in index.css switches the
// whole canvas (headings included) to the bundled OpenDyslexic faces.
// Settings copy must stay neutral: no comprehension or reading-speed claims.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const READING_MODES = [
  { id: "off", label: "Off" },
  { id: "bionic", label: "Bionic" },
  { id: "open-dyslexic", label: "OpenDyslexic" },
];

export const READING_MODE_DEFAULT = "off";

export const OPEN_DYSLEXIC_CLASS = "lex-reading-open-dyslexic";

let activeMode = READING_MODE_DEFAULT;

export function setReadingMode(mode) {
  activeMode = mode;
}

export function getReadingMode() {
  return activeMode;
}

// Toggles the OpenDyslexic font-swap class on the given editor root element.
export function applyReadingMode(root, mode) {
  if (!root) {
    return;
  }
  root.classList.toggle(OPEN_DYSLEXIC_CLASS, mode === "open-dyslexic");
}

// Emphasized prefix spans for a run of text. Words are letter/number runs
// that may carry internal apostrophes (don't, o'clock); the prefix is the
// first half of the word, at least one character, so single-character words
// and punctuation-only runs behave sanely.
export function bionicPrefixes(text) {
  const out = [];
  const wordRe = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;
  let match;
  while ((match = wordRe.exec(text)) !== null) {
    const start = match.index;
    const prefixLen = Math.max(1, Math.ceil(match[0].length / 2));
    out.push({ from: start, to: start + prefixLen });
  }
  return out;
}

// Skip list (decided): no emphasis inside code blocks, math nodes (KaTeX
// text is invisible anyway), or code-marked runs. Everything else
// (headings, paragraphs, lists, quotes, tables) gets the treatment.
export const BIONIC_SKIP_NODES = new Set(["codeBlock", "inlineMath", "blockMath"]);

function bionicDecorations(doc) {
  if (!doc || typeof doc.descendants !== "function") {
    return DecorationSet.empty;
  }
  const decorations = [];
  doc.descendants((node, pos) => {
    if (BIONIC_SKIP_NODES.has(node.type.name)) {
      return false;
    }
    if (!node.isText) {
      return true;
    }
    if (node.marks.some((mark) => mark.type.name === "code")) {
      return true;
    }
    for (const prefix of bionicPrefixes(node.text)) {
      decorations.push(
        Decoration.inline(pos + prefix.from, pos + prefix.to, {
          class: "lex-bionic-prefix",
        }),
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

export const bionicReadingPluginKey = new PluginKey("bionicReading");

export const BionicReading = Extension.create({
  name: "bionicReading",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: bionicReadingPluginKey,
        // Recompute only when the document changes or the mode flips, so
        // caret moves and selection renders don't re-walk the document.
        state: {
          init(config, instance) {
            const doc = instance?.doc || config?.doc;
            return {
              doc,
              set:
                activeMode === "bionic" && doc
                  ? bionicDecorations(doc)
                  : DecorationSet.empty,
              mode: activeMode,
            };
          },
          apply(tr, cached) {
            if (!tr.docChanged && cached.mode === activeMode) {
              return cached;
            }
            return {
              doc: tr.doc,
              set:
                activeMode === "bionic"
                  ? bionicDecorations(tr.doc)
                  : DecorationSet.empty,
              mode: activeMode,
            };
          },
        },
        props: {
          decorations(state) {
            return bionicReadingPluginKey.getState(state)?.set ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
