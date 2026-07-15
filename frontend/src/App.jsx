import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Toolbar from "./Toolbar.jsx";
import Editor from "./Editor.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import GrammarTooltip from "./GrammarTooltip.jsx";
import { checkGrammar } from "./api.js";
import {
  GrammarHighlight,
  buildTextWithMap,
  applyGrammarDecorations,
  clearGrammarDecorations,
  applySuggestion,
  dismissError,
  focusError,
} from "./grammarHighlight.js";

function categoryLabel(match) {
  const id = (match.rule?.id || "").toUpperCase();
  const description = (match.rule?.description || "").toLowerCase();
  if (id.includes("SPELL") || description.includes("spell") || description.includes("typo")) {
    return "Spelling";
  }
  if (id.includes("PUNCT") || description.includes("punctuation")) {
    return "Punctuation";
  }
  return "Grammar";
}

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
  const [grammarMatches, setGrammarMatches] = useState([]);
  const [hoveredError, setHoveredError] = useState(null);

  const editor = useEditor({
    extensions: [StarterKit, GrammarHighlight],
    editorProps: {
      attributes: {
        spellcheck: "false",
      },
    },
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
    return () => {
      editor.off("selectionUpdate", syncSelection);
      editor.off("update", syncSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const dom = editor.view.dom;
    const handleOver = (event) => {
      const target = event.target.closest(".lex-error");
      if (!target) {
        return;
      }
      const id = Number(target.getAttribute("data-error-id"));
      const rect = target.getBoundingClientRect();
      setHoveredError({ id, rect });
    };
    dom.addEventListener("mouseover", handleOver);
    return () => {
      dom.removeEventListener("mouseover", handleOver);
    };
  }, [editor]);

  async function runGrammarCheck() {
    if (!editor) {
      return;
    }
    const { text, map } = buildTextWithMap(editor.state.doc);
    const rawMatches = await checkGrammar(text);
    const matches = rawMatches.map((match, i) => ({
      ...match,
      id: i,
      original: text.slice(match.offset, match.offset + match.length),
      category: categoryLabel(match),
    }));
    setGrammarMatches(matches);
    applyGrammarDecorations(editor, matches, map);
  }

  function handleApplySuggestion(match, replacement) {
    if (!editor) {
      return;
    }
    applySuggestion(editor, match.id, replacement);
    setGrammarMatches((current) => current.filter((m) => m.id !== match.id));
    setHoveredError(null);
  }

  function handleDismiss(match) {
    if (!editor) {
      return;
    }
    dismissError(editor, match.id);
    setGrammarMatches((current) => current.filter((m) => m.id !== match.id));
    setHoveredError(null);
  }

  function handleLocate(match) {
    if (!editor) {
      return;
    }
    focusError(editor, match.id);
  }

  function handleToolClick(name) {
    const nextTool = activeTool === name ? "" : name;
    setActiveTool(nextTool);
    if (name === "Proofread") {
      if (nextTool === "Proofread") {
        runGrammarCheck();
      } else if (editor) {
        setGrammarMatches([]);
        clearGrammarDecorations(editor);
      }
    }
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

        <section className="flex-1 min-w-0 p-6">
          <Editor editor={editor} />
        </section>

        <aside className="w-80 shrink-0 border-l border-hairline">
          <ReviewPanel
            selectedText={selectedText}
            activeTool={activeTool}
            grammarMatches={grammarMatches}
            onApply={handleApplySuggestion}
            onDismiss={handleDismiss}
            onLocate={handleLocate}
            onClear={() => {
              setActiveTool("");
              setGrammarMatches([]);
              setHoveredError(null);
              if (editor) {
                clearGrammarDecorations(editor);
              }
            }}
          />
        </aside>
      </main>

      {hoveredError && (
        <GrammarTooltip
          match={grammarMatches.find((m) => m.id === hoveredError.id)}
          rect={hoveredError.rect}
          onApply={handleApplySuggestion}
          onDismiss={() => setHoveredError(null)}
        />
      )}
    </div>
  );
}
