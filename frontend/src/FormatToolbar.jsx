import { useEditorState } from "@tiptap/react";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  ListBullets,
  ListNumbers,
  TextHOne,
  TextHTwo,
} from "@phosphor-icons/react";

const buttons = [
  { icon: TextB, label: "Bold", action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
  { icon: TextItalic, label: "Italic", action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
  { icon: TextUnderline, label: "Underline", action: (e) => e.chain().focus().toggleUnderline().run(), isActive: (e) => e.isActive("underline") },
  { icon: TextStrikethrough, label: "Strikethrough", action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
  { icon: ListBullets, label: "Bullet list", action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive("bulletList") },
  { icon: ListNumbers, label: "Numbered list", action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive("orderedList") },
  { icon: TextHOne, label: "Heading 1", action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (e) => e.isActive("heading", { level: 1 }) },
  { icon: TextHTwo, label: "Heading 2", action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (e) => e.isActive("heading", { level: 2 }) },
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
