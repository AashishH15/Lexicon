import { EditorContent } from "@tiptap/react";
import FormatToolbar from "./FormatToolbar.jsx";

export default function Editor({ editor, fontSize }) {
  return (
    <div className="flex flex-col h-full">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-3">
        Source Document
      </p>
      <FormatToolbar editor={editor} />
      <div className="lex-scroll flex-1 overflow-auto rounded border border-hairline bg-white">
        <EditorContent
          editor={editor}
          style={{ fontSize: `${fontSize}px` }}
          className="h-full px-4 py-3 leading-relaxed text-ink [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      </div>
    </div>
  );
}
