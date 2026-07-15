import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export default function Editor() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "<p></p>",
  });

  return (
    <div className="flex flex-col h-full">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-3">
        Source Document
      </p>
      <div className="flex-1 overflow-auto rounded border border-hairline bg-white">
        <EditorContent
          editor={editor}
          className="h-full px-4 py-3 leading-relaxed text-ink [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      </div>
    </div>
  );
}
