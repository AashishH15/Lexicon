import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const grammarPluginKey = new PluginKey("grammarHighlight");

// Walks the document and produces the plain text we send to the grammar
// backend along with a map from each text offset back to a ProseMirror
// position. The two must be built together so the offsets LanguageTool
// returns line up exactly with where we draw the squiggles.
export function buildTextWithMap(doc) {
  let text = "";
  const map = [];

  doc.descendants((node, pos) => {
    if (node.isText) {
      for (let i = 0; i < node.text.length; i++) {
        map[text.length] = pos + i;
        text += node.text[i];
      }
      return true;
    }
    // Put a newline between block boundaries so words from separate
    // paragraphs don't get glued together and flagged as errors.
    if (node.isTextblock && text.length > 0) {
      map[text.length] = pos;
      text += "\n";
    }
    return true;
  });

  return { text, map };
}

function decorationsFromMatches(doc, matches, map) {
  const decorations = [];
  for (const match of matches) {
    const from = map[match.offset];
    const lastCharPos = map[match.offset + match.length - 1];
    if (from == null) {
      continue;
    }
    const to = (lastCharPos ?? from) + 1;
    decorations.push(Decoration.inline(from, to, { class: "lex-error" }));
  }
  return DecorationSet.create(doc, decorations);
}

export function applyGrammarDecorations(editor, matches, map) {
  const decorations = decorationsFromMatches(editor.state.doc, matches, map);
  const tr = editor.state.tr.setMeta(grammarPluginKey, { decorations });
  editor.view.dispatch(tr);
}

export function clearGrammarDecorations(editor) {
  const tr = editor.state.tr.setMeta(grammarPluginKey, {
    decorations: DecorationSet.empty,
  });
  editor.view.dispatch(tr);
}

export const GrammarHighlight = Extension.create({
  name: "grammarHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: grammarPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            const meta = tr.getMeta(grammarPluginKey);
            if (meta) {
              return meta.decorations;
            }
            // Keep existing squiggles positioned correctly as the user edits.
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return grammarPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
