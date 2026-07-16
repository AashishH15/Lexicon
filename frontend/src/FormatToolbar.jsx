import { useEditorState } from "@tiptap/react";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  Highlighter,
  TextSuperscript,
  TextSubscript,
  ListBullets,
  ListNumbers,
  TextHOne,
  TextHTwo,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  Quotes,
} from "@phosphor-icons/react";

const buttons = [
  { icon: TextB, label: "Bold", action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
  { icon: TextItalic, label: "Italic", action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
  { icon: TextUnderline, label: "Underline", action: (e) => e.chain().focus().toggleUnderline().run(), isActive: (e) => e.isActive("underline") },
  { icon: TextStrikethrough, label: "Strikethrough", action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
  { icon: Highlighter, label: "Highlight", action: (e) => e.chain().focus().toggleHighlight().run(), isActive: (e) => e.isActive("highlight") },
  { icon: TextSuperscript, label: "Superscript", action: (e) => e.chain().focus().toggleSuperscript().run(), isActive: (e) => e.isActive("superscript") },
  { icon: TextSubscript, label: "Subscript", action: (e) => e.chain().focus().toggleSubscript().run(), isActive: (e) => e.isActive("subscript") },
  { icon: ListBullets, label: "Bullet list", action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive("bulletList") },
  { icon: ListNumbers, label: "Numbered list", action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive("orderedList") },
  { icon: TextHOne, label: "Heading 1", action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e) => e.isActive("heading", { level: 1 }) },
  { icon: TextHTwo, label: "Heading 2", action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive("heading", { level: 2 }) },
  { icon: TextAlignLeft, label: "Align left", action: (e) => e.chain().focus().setTextAlign("left").run(), isActive: (e) => e.isActive({ textAlign: "left" }) },
  { icon: TextAlignCenter, label: "Align center", action: (e) => e.chain().focus().setTextAlign("center").run(), isActive: (e) => e.isActive({ textAlign: "center" }) },
  { icon: TextAlignRight, label: "Align right", action: (e) => e.chain().focus().setTextAlign("right").run(), isActive: (e) => e.isActive({ textAlign: "right" }) },
  { icon: TextAlignJustify, label: "Justify", action: (e) => e.chain().focus().setTextAlign("justify").run(), isActive: (e) => e.isActive({ textAlign: "justify" }) },
  { icon: Quotes, label: "Blockquote", action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive("blockquote") },
];

export default function FormatToolbar({ editor }) {
  const active = useEditorState({
    editor,
    selector: (snapshot) => {
      const e = snapshot.editor;
      return buttons.map((b) => b.isActive(e));
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 border-b border-hairline pb-2 mb-3">
      {buttons.map(({ icon: Icon, label, action }, i) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={active[i]}
          onClick={() => action(editor)}
          className={
            "group flex h-8 w-8 items-center justify-center rounded border text-ink " +
            (active[i]
              ? "border-ink bg-ink text-white"
              : "border-transparent hover:bg-hairline/60")
          }
        >
          <Icon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
        </button>
      ))}
    </div>
  );
}
