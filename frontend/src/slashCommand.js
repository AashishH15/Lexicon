import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  Highlighter,
  TextSuperscript,
  TextSubscript,
  Code,
  Quotes,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextHFour,
  TextHFive,
  TextHSix,
  ListBullets,
  ListNumbers,
  ListChecks,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  Link as LinkIcon,
  Image as ImageIcon,
  Paragraph,
  MathOperations,
  Function,
  Table as TableIcon,
} from "@phosphor-icons/react";
import CommandList from "./CommandList.jsx";

// Every slash command. `keywords` drive the filter (so "/bold" matches the
// Bold row). `isActive` is kept as a function on each item so the command can
// read the editor's current state at click time. `set` and `unset` are
// explicit so a re-selection of an already-active format deterministically
// turns it OFF (a blind toggle() is unreliable when the cursor has no
// selection).
//
// `keepOpen` marks commands that should leave the menu open after selection so
// the user can stack several formats in one session (e.g. Italic + Underline
// + Highlight). Structural/block commands close the menu as usual.
const COMMANDS = [
  {
    id: "bold",
    label: "Bold",
    icon: TextB,
    keywords: ["bold", "b", "strong", "fat"],
    isActive: (e) => e.isActive("bold"),
    markName: "bold",
    set: (e) => e.chain().focus().setBold().run(),
    unset: (e) => e.chain().focus().unsetBold().run(),
    keepOpen: true,
  },
  {
    id: "italic",
    label: "Italic",
    icon: TextItalic,
    keywords: ["italic", "i", "em", "slant"],
    isActive: (e) => e.isActive("italic"),
    markName: "italic",
    set: (e) => e.chain().focus().setItalic().run(),
    unset: (e) => e.chain().focus().unsetItalic().run(),
    keepOpen: true,
  },
  {
    id: "underline",
    label: "Underline",
    icon: TextUnderline,
    keywords: ["underline", "u"],
    isActive: (e) => e.isActive("underline"),
    markName: "underline",
    set: (e) => e.chain().focus().setUnderline().run(),
    unset: (e) => e.chain().focus().unsetUnderline().run(),
    keepOpen: true,
  },
  {
    id: "strike",
    label: "Strikethrough",
    icon: TextStrikethrough,
    keywords: ["strike", "strikethrough", "s", "crossed"],
    isActive: (e) => e.isActive("strike"),
    markName: "strike",
    set: (e) => e.chain().focus().setStrike().run(),
    unset: (e) => e.chain().focus().unsetStrike().run(),
    keepOpen: true,
  },
  {
    id: "highlight",
    label: "Highlight",
    icon: Highlighter,
    keywords: ["highlight", "mark", "color"],
    isActive: (e) => e.isActive("highlight"),
    markName: "highlight",
    set: (e) => e.chain().focus().setHighlight().run(),
    unset: (e) => e.chain().focus().unsetHighlight().run(),
    keepOpen: true,
  },
  {
    id: "superscript",
    label: "Superscript",
    icon: TextSuperscript,
    keywords: ["superscript", "super", "upper"],
    isActive: (e) => e.isActive("superscript"),
    markName: "superscript",
    set: (e) => e.chain().focus().setSuperscript().run(),
    unset: (e) => e.chain().focus().unsetSuperscript().run(),
    keepOpen: true,
  },
  {
    id: "subscript",
    label: "Subscript",
    icon: TextSubscript,
    keywords: ["subscript", "sub", "lower"],
    isActive: (e) => e.isActive("subscript"),
    markName: "subscript",
    set: (e) => e.chain().focus().setSubscript().run(),
    unset: (e) => e.chain().focus().unsetSubscript().run(),
    keepOpen: true,
  },
  {
    id: "code",
    label: "Code block",
    icon: Code,
    keywords: ["code", "codeblock", "pre", "mono"],
    isActive: (e) => e.isActive("codeBlock"),
    set: (e) => e.chain().focus().setCodeBlock().run(),
    unset: (e) => e.chain().focus().unsetCodeBlock().run(),
  },
  {
    id: "blockquote",
    label: "Blockquote",
    icon: Quotes,
    keywords: ["blockquote", "quote", "cite"],
    isActive: (e) => e.isActive("blockquote"),
    set: (e) => e.chain().focus().setBlockquote().run(),
    unset: (e) => e.chain().focus().unsetBlockquote().run(),
  },
  {
    id: "h1",
    label: "Heading 1",
    icon: TextHOne,
    keywords: ["h1", "heading", "title", "header"],
    isActive: (e) => e.isActive("heading", { level: 1 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: TextHTwo,
    keywords: ["h2", "heading", "subtitle"],
    isActive: (e) => e.isActive("heading", { level: 2 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: TextHThree,
    keywords: ["h3", "heading"],
    isActive: (e) => e.isActive("heading", { level: 3 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h4",
    label: "Heading 4",
    icon: TextHFour,
    keywords: ["h4", "heading"],
    isActive: (e) => e.isActive("heading", { level: 4 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 4 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h5",
    label: "Heading 5",
    icon: TextHFive,
    keywords: ["h5", "heading"],
    isActive: (e) => e.isActive("heading", { level: 5 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 5 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "h6",
    label: "Heading 6",
    icon: TextHSix,
    keywords: ["h6", "heading"],
    isActive: (e) => e.isActive("heading", { level: 6 }),
    set: (e) => e.chain().focus().toggleHeading({ level: 6 }).run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "paragraph",
    label: "Paragraph",
    icon: Paragraph,
    keywords: ["paragraph", "p", "body", "normal"],
    isActive: (e) => e.isActive("paragraph") && !e.isActive("heading"),
    set: (e) => e.chain().focus().setParagraph().run(),
    unset: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "bullet",
    label: "Bullet list",
    icon: ListBullets,
    keywords: ["bullet", "list", "ul", "unordered"],
    isActive: (e) => e.isActive("bulletList"),
    set: (e) => e.chain().focus().toggleBulletList().run(),
    unset: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "numbered",
    label: "Numbered list",
    icon: ListNumbers,
    keywords: ["numbered", "ordered", "list", "ol"],
    isActive: (e) => e.isActive("orderedList"),
    set: (e) => e.chain().focus().toggleOrderedList().run(),
    unset: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "Task list",
    icon: ListChecks,
    keywords: ["task", "todo", "checklist", "list"],
    isActive: (e) => e.isActive("taskList"),
    set: (e) => e.chain().focus().toggleTaskList().run(),
    unset: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: "align-left",
    label: "Align left",
    icon: TextAlignLeft,
    keywords: ["align", "left", "justify"],
    isActive: (e) => e.isActive({ textAlign: "left" }),
    set: (e) => e.chain().focus().setTextAlign("left").run(),
    unset: (e) => e.chain().focus().setTextAlign("left").run(),
  },
  {
    id: "align-center",
    label: "Align center",
    icon: TextAlignCenter,
    keywords: ["align", "center", "centre"],
    isActive: (e) => e.isActive({ textAlign: "center" }),
    set: (e) => e.chain().focus().setTextAlign("center").run(),
    unset: (e) => e.chain().focus().setTextAlign("center").run(),
  },
  {
    id: "align-right",
    label: "Align right",
    icon: TextAlignRight,
    keywords: ["align", "right"],
    isActive: (e) => e.isActive({ textAlign: "right" }),
    set: (e) => e.chain().focus().setTextAlign("right").run(),
    unset: (e) => e.chain().focus().setTextAlign("right").run(),
  },
  {
    id: "align-justify",
    label: "Justify",
    icon: TextAlignJustify,
    keywords: ["align", "justify", "full"],
    isActive: (e) => e.isActive({ textAlign: "justify" }),
    set: (e) => e.chain().focus().setTextAlign("justify").run(),
    unset: (e) => e.chain().focus().setTextAlign("justify").run(),
  },
  {
    id: "link",
    label: "Link",
    icon: LinkIcon,
    keywords: ["link", "url", "href", "anchor"],
    isActive: (e) => e.isActive("link"),
    set: (e) => {
      const previous = e.getAttributes("link").href || "";
      const url = window.prompt("Link URL", previous);
      if (url !== null && url.trim() !== "") {
        e.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
      }
    },
    unset: (e) => e.chain().focus().extendMarkRange("link").unsetLink().run(),
  },
  {
    id: "image",
    label: "Image",
    icon: ImageIcon,
    keywords: ["image", "img", "picture", "photo"],
    isActive: () => false,
    set: (e) => {
      const url = window.prompt("Image URL");
      if (url && url.trim()) {
        e.chain().focus().setImage({ src: url.trim() }).run();
      }
    },
    unset: () => {},
  },
  {
    id: "math",
    label: "Inline math",
    icon: MathOperations,
    keywords: ["math", "latex", "equation", "formula", "inline"],
    isActive: (e) => e.isActive("inlineMath"),
    set: (e) => {
      const pos = e.state.selection.$from.pos;
      e.chain().focus().insertInlineMath({ latex: " ", pos }).run();
      window.dispatchEvent(
        new CustomEvent("lex:edit-math", {
          detail: { kind: "inline", pos, latex: "", isNew: true },
        }),
      );
    },
    unset: (e) => e.chain().focus().deleteInlineMath().run(),
  },
  {
    id: "mathblock",
    label: "Block math",
    icon: Function,
    keywords: ["math", "latex", "equation", "formula", "block", "display"],
    isActive: (e) => e.isActive("blockMath"),
    // Drop an empty pending box, then open the editor with a blank input.
    set: (e) => {
      const pos = e.state.selection.$from.pos;
      e.chain().focus().insertBlockMath({ latex: " ", pos }).run();
      window.dispatchEvent(
        new CustomEvent("lex:edit-math", {
          detail: { kind: "block", pos, latex: "", isNew: true },
        }),
      );
    },
    unset: (e) => e.chain().focus().deleteBlockMath().run(),
  },
  {
    id: "table",
    label: "Table",
    icon: TableIcon,
    keywords: ["table", "grid", "rows", "columns", "tabular"],
    isActive: (e) => e.isActive("table"),
    set: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    unset: (e) => e.chain().focus().deleteTable().run(),
  },
];

// Filters the command list by the typed query. Matching is prefix-or-substring
// over the id plus any keyword, so "/bold" surfaces Bold and "/h" surfaces the
// headings. With an empty query every command is shown.
function filterCommands(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return COMMANDS;
  }
  return COMMANDS.filter((command) => {
    if (command.id.startsWith(q)) {
      return true;
    }
    return command.keywords.some(
      (keyword) => keyword.startsWith(q) || keyword.includes(q),
    );
  });
}

// Deleting the slash from an otherwise empty paragraph can clear the cursor's
// stored marks. Capture the marks carried by the slash, then restore the
// resulting set after the command has applied its own mark. Without this,
// selecting Underline after Italic replaces the cursor context instead of
// stacking the two marks.
function restoreMarkContext(editor, previousMarks, markName, wasActive) {
  editor.commands.command(({ tr }) => {
    const marksAfterCommand = tr.storedMarks || tr.selection.$from.marks();
    const preservedMarks = previousMarks.filter(
      (mark) => mark.type.name !== markName,
    );
    const selectedMark = wasActive
      ? []
      : marksAfterCommand.filter((mark) => mark.type.name === markName);

    tr.setStoredMarks([...preservedMarks, ...selectedMark]);
    return true;
  });
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        // Trigger anywhere — not just after a space — so "/bold" works whether
        // the user types it at the start of a line, right after a word, or
        // directly following punctuation.
        allowedPrefixes: null,
        command: ({ editor, range, props }) => {
          const wasActive = props.isActive(editor);
          const previousMarks = props.markName
            ? editor.state.storedMarks || editor.state.selection.$from.marks()
            : null;

          // Remove the "/query" text the user typed before acting.
          editor.chain().focus().deleteRange(range).run();

          // Use the state captured before deleting the slash. Deleting a lone
          // trigger can clear stored marks, which would otherwise make an
          // active format look inactive and break deterministic toggling.
          if (wasActive) {
            props.unset(editor);
          } else {
            props.set(editor);
          }

          if (props.markName) {
            restoreMarkContext(editor, previousMarks, props.markName, wasActive);
          }

          // Keep the menu open for stacking-friendly formats (marks) so the
          // user can apply Italic + Underline + Highlight in one session.
          // Re-insert "/" to keep the suggestion active and refocus.
          if (props.keepOpen) {
            editor.chain().focus().insertContent("/").run();
          }
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query, editor }) =>
          filterCommands(query).map((command) => ({
            ...command,
            active: command.isActive(editor),
          })),
        render: () => {
          let component;
          let unmount = null;

          return {
            onStart(props) {
              component = new ReactRenderer(CommandList, {
                props,
                editor: props.editor,
              });
              unmount = props.mount(component.element);
            },
            onUpdate(props) {
              component.updateProps(props);
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                return false;
              }
              return component.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              unmount?.();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;
