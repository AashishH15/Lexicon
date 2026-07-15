import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Toolbar from "./Toolbar.jsx";
import Editor from "./Editor.jsx";
import ReviewPanel from "./ReviewPanel.jsx";

const storageKey = "lexicon:document";

function loadContent() {
  const saved = localStorage.getItem(storageKey);
  return saved ?? "<p></p>";
}

function selectionText(editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ");
}

export default function App() {
  const [selectedText, setSelectedText] = useState("");
  const [activeTool, setActiveTool] = useState("");

  const editor = useEditor({
    extensions: [StarterKit],
    content: loadContent(),
    onUpdate: ({ editor }) => {
      localStorage.setItem(storageKey, editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const syncSelection = () => setSelectedText(selectionText(editor));
    editor.on("selectionUpdate", syncSelection);
    editor.on("update", syncSelection);
    editor.on("blur", () => setActiveTool(""));
    return () => {
      editor.off("selectionUpdate", syncSelection);
      editor.off("update", syncSelection);
      editor.off("blur", () => setActiveTool(""));
    };
  }, [editor]);

  function handleToolClick(name) {
    setActiveTool((current) => (current === name ? "" : name));
  }

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <header className="flex items-center px-6 h-14 border-b border-hairline">
        <div className="leading-tight">
          <span className="block font-serif text-lg tracking-tight">Lexicon</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            System Toolset V3.0
          </span>
        </div>
      </header>

      <main className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-hairline p-4">
          <Toolbar editor={editor} activeTool={activeTool} onToolClick={handleToolClick} />
        </aside>

        <section className="flex-1 min-w-0 border-r border-hairline p-6">
          <Editor editor={editor} />
        </section>

        <aside className="w-80 shrink-0 p-4">
          <ReviewPanel
            selectedText={selectedText}
            activeTool={activeTool}
            onClear={() => setActiveTool("")}
          />
        </aside>
      </main>
    </div>
  );
}
