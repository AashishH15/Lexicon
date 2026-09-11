import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const continueGhostKey = new PluginKey("continueGhost");

// Phosphor ArrowLineRight, regular weight, inlined because the widget
// is plain DOM outside React. Stroked bold so it reads at hint size.
const ARROW_LINE_RIGHT_SVG =
  `<svg viewBox="0 0 256 256" width="11" height="11" fill="none" ` +
  `stroke="currentColor" stroke-width="24" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true" focusable="false">` +
  `<path d="M189.66,122.34a8,8,0,0,1,0,11.32l-72,72a8,8,0,0,1-11.32-11.32` +
  `L164.69,136H32a8,8,0,0,1,0-16H164.69L106.34,61.66a8,8,0,0,1,11.32` +
  `-11.32ZM216,32a8,8,0,0,0-8,8V216a8,8,0,0,0,16,0V40A8,8,0,0,0,216,32Z"/>` +
  `</svg>`;

function activeGhost(state) {
  return continueGhostKey.getState(state);
}

export function acceptContinueSuggestion(view) {
  const ghost = activeGhost(view.state);
  if (!ghost || !ghost.text) {
    return false;
  }
  // One step: insert, drop the ghost, park the cursor after the text.
  view.dispatch(
    view.state.tr
      .insertText(ghost.text, ghost.pos)
      .setMeta(continueGhostKey, { clear: true })
      .scrollIntoView(),
  );
  return true;
}

export function clearContinueSuggestion(view) {
  view.dispatch(view.state.tr.setMeta(continueGhostKey, { clear: true }));
}

// True for a bare Tab press while a ghost is shown. The editor-level
// shortcut handler checks this first so accepting wins over indent.
export function shouldAcceptGhostTab(view, event) {
  if (!event || event.key !== "Tab") {
    return false;
  }
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  const ghost = view && view.state ? activeGhost(view.state) : null;
  return Boolean(ghost && ghost.text);
}

export const ContinueGhost = Extension.create({
  name: "continueGhost",

  addCommands() {
    return {
      setContinueSuggestion:
        ({ pos, text }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(continueGhostKey, { set: { pos, text } }));
          }
          return true;
        },
      clearContinueSuggestion:
        () =>
        ({ view }) => {
          clearContinueSuggestion(view);
          return true;
        },
      acceptContinueSuggestion:
        () =>
        ({ view }) => acceptContinueSuggestion(view),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: continueGhostKey,
        state: {
          init: () => null,
          apply(tr, prev) {
            const meta = tr.getMeta(continueGhostKey);
            if (meta && meta.clear) {
              return null;
            }
            if (meta && meta.set) {
              return { text: meta.set.text, pos: meta.set.pos };
            }
            // Any edit or cursor move from elsewhere retires the ghost.
            if (tr.docChanged || tr.selectionSet) {
              return null;
            }
            return prev;
          },
        },
        props: {
          decorations(state) {
            const ghost = activeGhost(state);
            if (!ghost || !ghost.text) {
              return null;
            }
            const widget = document.createElement("span");
            widget.className = "lex-continue-ghost";
            const body = document.createElement("span");
            body.className = "lex-continue-text";
            body.textContent = ghost.text;
            widget.appendChild(body);
            const hint = document.createElement("span");
            hint.className = "lex-continue-hint";
            hint.setAttribute("aria-hidden", "true");
            hint.innerHTML = `${ARROW_LINE_RIGHT_SVG}<span>Tab to accept</span>`;
            widget.appendChild(hint);
            return DecorationSet.create(state.doc, [
              Decoration.widget(ghost.pos, widget, { side: 1 }),
            ]);
          },
          handleKeyDown(view, event) {
            if (shouldAcceptGhostTab(view, event)) {
              event.preventDefault();
              return acceptContinueSuggestion(view);
            }
            if (activeGhost(view.state) && event.key === "Escape") {
              clearContinueSuggestion(view);
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default ContinueGhost;
