import { InputRule } from "@tiptap/core";
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";

const PENDING_LATEX = " ";

const InlineMathWithDollar = InlineMath.extend({
  addInputRules() {
    const parentRules = (this.parent?.() ?? []);
    return [
      ...parentRules,
      new InputRule({
        find: /(?<!\$)(\$([^$\n]+?)\$)(?!\$)/,
        handler: ({ state, range, match }) => {
          const latex = match[2];
          if (!latex) return;
          // Insert a placeholder node, then signal the UI to open the popover
          // with the captured latex so the user can confirm / edit.
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ latex: PENDING_LATEX }));
          queueMicrotask(() => {
            window.dispatchEvent(
              new CustomEvent("lex:open-math", {
                detail: { pos: range.from, latex, kind: "inline" },
              }),
            );
          });
        },
      }),
    ];
  },
});

export { InlineMathWithDollar, BlockMath };
