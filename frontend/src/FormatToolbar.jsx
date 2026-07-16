import { useEffect, useRef, useState } from "react";
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
  TextH,
  TextHOne,
  TextHTwo,
  TextHThree,
  TextHFour,
  TextHFive,
  TextHSix,
  CaretDown,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  Quotes,
  ArrowCounterClockwise,
  ArrowClockwise,
} from "@phosphor-icons/react";

const buttons = [
  { icon: ArrowCounterClockwise, label: "Undo", action: (e) => e.chain().focus().undo().run(), isActive: () => false, canRun: (e) => e.can().undo() },
  { icon: ArrowClockwise, label: "Redo", action: (e) => e.chain().focus().redo().run(), isActive: () => false, canRun: (e) => e.can().redo() },
  { icon: TextB, label: "Bold", action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
  { icon: TextItalic, label: "Italic", action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
  { icon: TextUnderline, label: "Underline", action: (e) => e.chain().focus().toggleUnderline().run(), isActive: (e) => e.isActive("underline") },
  { icon: TextStrikethrough, label: "Strikethrough", action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
  { icon: Highlighter, label: "Highlight", action: (e) => e.chain().focus().toggleHighlight().run(), isActive: (e) => e.isActive("highlight") },
  { icon: TextSuperscript, label: "Superscript", action: (e) => e.chain().focus().toggleSuperscript().run(), isActive: (e) => e.isActive("superscript") },
  { icon: TextSubscript, label: "Subscript", action: (e) => e.chain().focus().toggleSubscript().run(), isActive: (e) => e.isActive("subscript") },
  { icon: ListBullets, label: "Bullet list", action: (e) => e.chain().focus().toggleBulletList().run(), isActive: (e) => e.isActive("bulletList") },
  { icon: ListNumbers, label: "Numbered list", action: (e) => e.chain().focus().toggleOrderedList().run(), isActive: (e) => e.isActive("orderedList") },
  { icon: Quotes, label: "Blockquote", action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive("blockquote") },
];

const HEADING_LEVELS = [
  { level: 1, icon: TextHOne, label: "Heading 1" },
  { level: 2, icon: TextHTwo, label: "Heading 2" },
  { level: 3, icon: TextHThree, label: "Heading 3" },
  { level: 4, icon: TextHFour, label: "Heading 4" },
  { level: 5, icon: TextHFive, label: "Heading 5" },
  { level: 6, icon: TextHSix, label: "Heading 6" },
];

const ALIGNMENTS = [
  { value: "left", icon: TextAlignLeft, label: "Align left" },
  { value: "center", icon: TextAlignCenter, label: "Align center" },
  { value: "right", icon: TextAlignRight, label: "Align right" },
  { value: "justify", icon: TextAlignJustify, label: "Justify" },
];

function HeadingMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeLevel = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      for (const { level } of HEADING_LEVELS) {
        if (e.isActive("heading", { level })) {
          return level;
        }
      }
      return 0;
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectLevel(level) {
    editor.chain().focus().toggleHeading({ level }).run();
    setOpen(false);
  }

  const isActive = activeLevel > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Heading"
        aria-label="Heading"
        aria-pressed={isActive}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          "group flex h-8 items-center gap-0.5 rounded border px-2 text-ink " +
          (isActive || open
            ? "border-ink bg-ink text-white"
            : "border-transparent hover:bg-hairline/60")
        }
      >
        <TextH size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-110" />
        <CaretDown
          size={11}
          weight="bold"
          className={"transition-transform duration-200 " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <ul className="lex-pop absolute left-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-hairline bg-white py-1">
          {HEADING_LEVELS.map(({ level, icon: Icon, label }) => (
            <li key={level}>
              <button
                type="button"
                onClick={() => selectLevel(level)}
                aria-pressed={activeLevel === level}
                className={
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors " +
                  (activeLevel === level
                    ? "bg-pale-blue text-pale-blue-text"
                    : "text-ink hover:bg-pale-blue hover:text-pale-blue-text")
                }
              >
                <Icon size={16} weight="bold" />
                <span>{label}</span>
              </button>
            </li>
          ))}
          <li className="my-1 border-t border-hairline" />
          <li>
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setOpen(false);
              }}
              className={
                "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors " +
                (activeLevel === 0
                  ? "bg-pale-blue text-pale-blue-text"
                  : "text-ink hover:bg-pale-blue hover:text-pale-blue-text")
              }
            >
              <TextH size={16} weight="bold" />
              <span>Paragraph</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function AlignMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeAlign = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      for (const { value } of ALIGNMENTS) {
        if (e.isActive({ textAlign: value })) {
          return value;
        }
      }
      return "left";
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function selectAlign(value) {
    editor.chain().focus().setTextAlign(value).run();
    setOpen(false);
  }

  const activeItem = ALIGNMENTS.find((a) => a.value === activeAlign) || ALIGNMENTS[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Text align"
        aria-label="Text align"
        aria-pressed={open}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          "group flex h-8 items-center gap-0.5 rounded border px-2 text-ink " +
          (open
            ? "border-ink bg-ink text-white"
            : "border-transparent hover:bg-hairline/60")
        }
      >
        <ActiveIcon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-110" />
        <CaretDown
          size={11}
          weight="bold"
          className={"transition-transform duration-200 " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <ul className="lex-pop absolute left-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-hairline bg-white py-1">
          {ALIGNMENTS.map(({ value, icon: Icon, label }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => selectAlign(value)}
                aria-pressed={activeAlign === value}
                className={
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors " +
                  (activeAlign === value
                    ? "bg-pale-blue text-pale-blue-text"
                    : "text-ink hover:bg-pale-blue hover:text-pale-blue-text")
                }
              >
                <Icon size={16} weight="bold" />
                <span>{label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FormatToolbar({ editor }) {
  const state = useEditorState({
    editor,
    selector: (snapshot) => {
      const e = snapshot.editor;
      return buttons.map((b) => ({
        active: b.isActive(e),
        enabled: b.canRun ? b.canRun(e) : true,
      }));
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline pb-2 mb-3">
      {buttons.map(({ icon: Icon, label, action }, i) => (
        <button
          key={label}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={state[i].active}
          disabled={!state[i].enabled}
          onClick={() => action(editor)}
          className={
            "group flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors " +
            (state[i].active
              ? "border-ink bg-ink text-white"
              : state[i].enabled
                ? "border-transparent hover:bg-hairline/60"
                : "border-transparent text-muted/40 cursor-not-allowed")
          }
        >
          <Icon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />

      <HeadingMenu editor={editor} />
      <AlignMenu editor={editor} />
    </div>
  );
}
