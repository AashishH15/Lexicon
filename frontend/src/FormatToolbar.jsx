import { useEffect, useRef, useState, forwardRef } from "react";
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
  ListChecks,
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
  Code,
  Image as ImageIcon,
  ArrowCounterClockwise,
  ArrowClockwise,
  Link as LinkIcon,
  MathOperations,
  Function,
  Table as TableIcon,
  Plus,
  Trash,
  Rows,
  Columns,
  TextColumns,
  ColumnsPlusLeft,
  ArrowsMerge,
  ArrowsSplit,
  Wrench,
} from "@phosphor-icons/react";

const buttons = [
  { icon: ArrowCounterClockwise, label: "Undo", action: (e) => e.chain().focus().undo().run(), isActive: () => false, canRun: (e) => e.can().undo() },
  { icon: ArrowClockwise, label: "Redo", action: (e) => e.chain().focus().redo().run(), isActive: () => false, canRun: (e) => e.can().redo() },
  { icon: TextB, label: "Bold", action: (e) => e.chain().focus().toggleBold().run(), isActive: (e) => e.isActive("bold") },
  { icon: TextItalic, label: "Italic", action: (e) => e.chain().focus().toggleItalic().run(), isActive: (e) => e.isActive("italic") },
  { icon: TextUnderline, label: "Underline", action: (e) => e.chain().focus().toggleUnderline().run(), isActive: (e) => e.isActive("underline") },
  { icon: TextStrikethrough, label: "Strikethrough", action: (e) => e.chain().focus().toggleStrike().run(), isActive: (e) => e.isActive("strike") },
  { icon: Highlighter, label: "Highlight", action: (e) => e.chain().focus().toggleHighlight().run(), isActive: (e) => e.isActive("highlight") },
  { icon: Quotes, label: "Blockquote", action: (e) => e.chain().focus().toggleBlockquote().run(), isActive: (e) => e.isActive("blockquote") },
  { icon: Code, label: "Code block", action: (e) => e.chain().focus().toggleCodeBlock().run(), isActive: (e) => e.isActive("codeBlock") },
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

const LIST_OPTIONS = [
  { value: "bulletList", icon: ListBullets, label: "Bullet list", action: (e) => e.chain().focus().toggleBulletList().run() },
  { value: "orderedList", icon: ListNumbers, label: "Numbered list", action: (e) => e.chain().focus().toggleOrderedList().run() },
  { value: "taskList", icon: ListChecks, label: "Task list", action: (e) => e.chain().focus().toggleTaskList().run() },
];

function ListMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeList = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      for (const { value } of LIST_OPTIONS) {
        if (e.isActive(value)) {
          return value;
        }
      }
      return null;
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

  function selectList(option) {
    option.action(editor);
    setOpen(false);
  }

  const activeItem = LIST_OPTIONS.find((o) => o.value === activeList);
  const ActiveIcon = activeItem ? activeItem.icon : ListBullets;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Lists"
        aria-label="Lists"
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
          {LIST_OPTIONS.map(({ value, icon: Icon, label }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => selectList(LIST_OPTIONS.find((o) => o.value === value))}
                aria-pressed={activeList === value}
                className={
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors " +
                  (activeList === value
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

// Grid-picker limits. The hover preview highlights a rows x cols block so the
// user can choose e.g. 3x6 or 6x3 (or up to 10x10) before inserting.
const GRID_COLS = 10;
const GRID_ROWS = 10;

function TableMenu({ editor }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const containerRef = useRef(null);

  const insideTable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive("table"),
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

  function insertTable(rows, cols) {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
    setHover({ rows: 0, cols: 0 });
  }

  function runTableCommand(command) {
    editor.chain().focus()[command]().run();
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Table"
        aria-label="Table"
        aria-pressed={open || insideTable}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          "group flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors " +
          (open || insideTable
            ? "border-ink bg-ink text-white"
            : "border-transparent hover:bg-hairline/60")
        }
      >
        <TableIcon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
      </button>

      {open && (
        <div className="lex-pop absolute left-0 top-full z-10 mt-1 w-60 overflow-hidden rounded-lg border border-hairline bg-white p-3">
          {!insideTable ? (
            <>
              <div className="mb-2 text-xs font-medium text-muted">
                {hover.rows > 0
                  ? `${hover.rows} × ${hover.cols} table`
                  : "Insert table"}
              </div>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
                onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
              >
                {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
                  const r = Math.floor(i / GRID_COLS) + 1;
                  const c = (i % GRID_COLS) + 1;
                  const filled = r <= hover.rows && c <= hover.cols;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${r} by ${c} table`}
                      onMouseEnter={() => setHover({ rows: r, cols: c })}
                      onClick={() => insertTable(r, c)}
                      className={
                        "aspect-square rounded-sm border transition-colors " +
                        (filled
                          ? "border-ink bg-ink"
                          : "border-hairline bg-canvas hover:border-muted")
                      }
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="mb-1 text-xs font-medium text-muted">Edit table</div>
              <TableActionButton icon={Plus} label="Add row below" onClick={() => runTableCommand("addRowAfter")} />
              <TableActionButton icon={Plus} label="Add column after" onClick={() => runTableCommand("addColumnAfter")} />
              <TableActionButton icon={Rows} label="Delete row" onClick={() => runTableCommand("deleteRow")} />
              <TableActionButton icon={Columns} label="Delete column" onClick={() => runTableCommand("deleteColumn")} />
              <TableActionButton icon={TextColumns} label="Toggle header row" onClick={() => runTableCommand("toggleHeaderRow")} />
              <TableActionButton icon={ColumnsPlusLeft} label="Toggle header column" onClick={() => runTableCommand("toggleHeaderColumn")} />
              <TableActionButton icon={ArrowsMerge} label="Merge cells" onClick={() => runTableCommand("mergeCells")} />
              <TableActionButton icon={ArrowsSplit} label="Split cell" onClick={() => runTableCommand("splitCell")} />
              <TableActionButton icon={Wrench} label="Fix table" onClick={() => runTableCommand("fixTables")} />
              <div className="my-1 h-px bg-hairline" aria-hidden="true" />
              <TableActionButton icon={Trash} label="Delete table" onClick={() => runTableCommand("deleteTable")} danger />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TableActionButton({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors " +
        (danger
          ? "text-red-600 hover:bg-red-50"
          : "text-ink hover:bg-pale-blue hover:text-pale-blue-text")
      }
    >
      <Icon size={16} weight="bold" />
      <span>{label}</span>
    </button>
  );
}

const MATH_OPTIONS = [
  { value: "inlineMath", icon: MathOperations, label: "Inline math", kind: "inline" },
  { value: "blockMath", icon: Function, label: "Block math", kind: "block" },
  { value: "superscript", icon: TextSuperscript, label: "Superscript", action: (e) => e.chain().focus().toggleSuperscript().run(), isActive: (e) => e.isActive("superscript") },
  { value: "subscript", icon: TextSubscript, label: "Subscript", action: (e) => e.chain().focus().toggleSubscript().run(), isActive: (e) => e.isActive("subscript") },
];

function MathMenu({ editor, onRequestMath }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const activeMath = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (e.isActive("inlineMath")) {
        return "inlineMath";
      }
      if (e.isActive("blockMath")) {
        return "blockMath";
      }
      if (e.isActive("superscript")) {
        return "superscript";
      }
      if (e.isActive("subscript")) {
        return "subscript";
      }
      return null;
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

  function selectMath(option) {
    if (option.action) {
      option.action(editor);
    } else {
      onRequestMath(editor, option.kind);
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Math"
        aria-label="Math"
        aria-pressed={open || activeMath}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          "group flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors " +
          (open || activeMath
            ? "border-ink bg-ink text-white"
            : "border-transparent hover:bg-hairline/60")
        }
      >
        <MathOperations size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
      </button>

      {open && (
        <ul className="lex-pop absolute left-0 top-full z-10 mt-1 w-44 overflow-hidden rounded-lg border border-hairline bg-white py-1">
          {MATH_OPTIONS.map(({ value, icon: Icon, label }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => selectMath(MATH_OPTIONS.find((o) => o.value === value))}
                aria-pressed={activeMath === value}
                className={
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors " +
                  (activeMath === value
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

function ImageButton({ editor }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const containerRef = useRef(null);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive("image"),
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

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);
    setRect({ top: coords.bottom, left: coords.left });
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        title="Insert image"
        aria-label="Insert image"
        aria-pressed={active || open}
        aria-expanded={open}
        onClick={toggle}
        className={
          "group flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors " +
          (active || open
            ? "border-ink bg-ink text-white"
            : "border-transparent hover:bg-hairline/60")
        }
      >
        <ImageIcon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
      </button>
      {open && rect && (
        <ImagePopover
          rect={rect}
          onInsert={(url) => {
            editor.chain().focus().setImage({ src: url }).run();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

const ImagePopover = forwardRef(function ImagePopover(
  { rect, onInsert, onClose },
  ref,
) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const style = {
    position: "fixed",
    top: rect.bottom + 6,
    left: rect.left,
    zIndex: 50,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="lex-pop flex w-72 items-center gap-2 rounded-lg border border-hairline bg-white p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const url = value.trim();
            if (url) {
              onInsert(url);
            }
          } else if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
        placeholder="https://example.com/photo.png"
        className="min-w-0 flex-1 rounded border border-hairline bg-canvas px-2 py-1.5 font-sans text-xs text-ink outline-none focus:border-muted"
      />
      <button
        type="button"
        title="Insert image"
        aria-label="Insert image"
        onClick={() => {
          const url = value.trim();
          if (url) {
            onInsert(url);
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
      >
        <ImageIcon size={16} weight="bold" />
      </button>
    </div>
  );
});

function LinkButton({ editor, onRequestLink }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive("link"),
  });

  return (
    <button
      type="button"
      title="Insert link"
      aria-label="Insert link"
      aria-pressed={active}
      onClick={() => onRequestLink(editor)}
      className={
        "group flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors " +
        (active
          ? "border-ink bg-ink text-white"
          : "border-transparent hover:bg-hairline/60")
      }
    >
      <LinkIcon size={16} weight="bold" className="transition-transform duration-200 group-hover:scale-125" />
    </button>
  );
}

export default function FormatToolbar({ editor, onRequestLink, onRequestMath }) {
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
      <ListMenu editor={editor} />
      <TableMenu editor={editor} />
      <MathMenu editor={editor} onRequestMath={onRequestMath} />
      <ImageButton editor={editor} />
      <LinkButton editor={editor} onRequestLink={onRequestLink} />
    </div>
  );
}
