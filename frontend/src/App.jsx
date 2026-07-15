import { useState, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ProofreadShortcut } from "./proofreadShortcut.js";
import Toolbar from "./Toolbar.jsx";
import Editor from "./Editor.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import GrammarTooltip from "./GrammarTooltip.jsx";
import Settings from "./Settings.jsx";
import { Gear } from "@phosphor-icons/react";
import { checkGrammar } from "./api.js";
import {
  GrammarHighlight,
  buildTextWithMap,
  applyGrammarDecorations,
  clearGrammarDecorations,
  applySuggestion,
  dismissError,
  focusError,
  findErrorAt,
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
const languageKey = "lexicon:language";
const fontSizeKey = "lexicon:fontSize";
const focusModeKey = "lexicon:focusMode";
const lineSpacingKey = "lexicon:lineSpacing";

function loadContent() {
  const saved = localStorage.getItem(storageKey);
  return saved ?? "<p></p>";
}

function loadLanguage() {
  return localStorage.getItem(languageKey) ?? "en-US";
}

function loadFontSize() {
  const saved = Number(localStorage.getItem(fontSizeKey));
  return saved || 16;
}

function loadFocusMode() {
  return localStorage.getItem(focusModeKey) === "true";
}

function loadLineSpacing() {
  return Number(localStorage.getItem(lineSpacingKey)) || 1.6;
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
  const [activeErrorId, setActiveErrorId] = useState(null);
  const [language, setLanguage] = useState(loadLanguage);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [focusMode, setFocusMode] = useState(loadFocusMode);
  const [lineSpacing, setLineSpacing] = useState(loadLineSpacing);
  const [editorFocused, setEditorFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const proofreadRef = useRef(() => {});
  const activeErrorRef = useRef(null);
  const matchesRef = useRef([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      GrammarHighlight,
      ProofreadShortcut.configure({
        onProofread: () => proofreadRef.current(),
      }),
    ],
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
    const syncActiveError = () => {
      const id = findErrorAt(editor, editor.state.selection.from);
      activeErrorRef.current = id;
      setActiveErrorId(id);
      // Re-emphasize the squiggle under the caret so the user can see which
      // suggestion Ctrl/Cmd+Alt+A / +D will target.
      setGrammarMatches((current) => {
        if (current.length === 0) {
          return current;
        }
        applyGrammarDecorations(editor, current, buildTextWithMap(editor.state.doc).map, id);
        return current;
      });
    };
    const handleFocus = () => setEditorFocused(true);
    const handleBlur = () => setEditorFocused(false);
    editor.on("selectionUpdate", syncSelection);
    editor.on("selectionUpdate", syncActiveError);
    editor.on("update", syncSelection);
    editor.on("update", syncActiveError);
    editor.on("focus", handleFocus);
    editor.on("blur", handleBlur);
    return () => {
      editor.off("selectionUpdate", syncSelection);
      editor.off("selectionUpdate", syncActiveError);
      editor.off("update", syncSelection);
      editor.off("update", syncActiveError);
      editor.off("focus", handleFocus);
      editor.off("blur", handleBlur);
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
    const rawMatches = await checkGrammar(text, language);
    const matches = rawMatches.map((match, i) => ({
      ...match,
      id: i,
      original: text.slice(match.offset, match.offset + match.length),
      category: categoryLabel(match),
    }));
    setGrammarMatches(matches);
    applyGrammarDecorations(editor, matches, map, activeErrorId);
  }

  function handleApplySuggestion(match, replacement) {
    if (!editor) {
      return;
    }
    applySuggestion(editor, match.id, replacement);
    setGrammarMatches((current) => {
      const next = current.filter((m) => m.id !== match.id);
      if (next.length === 0) {
        setActiveErrorId(null);
        activeErrorRef.current = null;
      }
      return next;
    });
    setHoveredError(null);
  }

  function handleDismiss(match) {
    if (!editor) {
      return;
    }
    dismissError(editor, match.id);
    setGrammarMatches((current) => {
      const next = current.filter((m) => m.id !== match.id);
      if (next.length === 0) {
        setActiveErrorId(null);
        activeErrorRef.current = null;
      }
      return next;
    });
    setHoveredError(null);
  }

  function handleLocate(match) {
    if (!editor) {
      return;
    }
    focusError(editor, match.id);
  }

  function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage);
    localStorage.setItem(languageKey, nextLanguage);
  }

  function handleFontSizeChange(nextSize) {
    setFontSize(nextSize);
    localStorage.setItem(fontSizeKey, String(nextSize));
  }

  function handleFocusModeChange(next) {
    setFocusMode(next);
    localStorage.setItem(focusModeKey, String(next));
  }

  function handleLineSpacingChange(next) {
    setLineSpacing(next);
    localStorage.setItem(lineSpacingKey, String(next));
  }

  useEffect(() => {
    if (activeTool === "Proofread") {
      runGrammarCheck();
    }
    // Re-run the proofread pass whenever the language changes so the results
    // reflect the newly selected variant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Keep a live ref of the current matches and active id so the global
  // keydown handler always reads fresh values instead of a stale closure.
  useEffect(() => {
    matchesRef.current = grammarMatches;
  }, [grammarMatches]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        setSettingsOpen((current) => (current ? false : current));
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen((current) => !current);
        return;
      }

      // Accept / dismiss the suggestion under the caret when one is active,
      // otherwise fall back to the first card in the stream. Values are read
      // through refs so this handler never acts on a stale closure.
      if ((event.ctrlKey || event.metaKey) && event.altKey && (key === "a" || key === "d")) {
        const matches = matchesRef.current;
        const activeId = activeErrorRef.current;
        const target =
          (activeId != null && matches.find((m) => m.id === activeId)) ||
          matches[0];
        if (!target) {
          return;
        }
        event.preventDefault();
        if (key === "a") {
          const replacement = target.replacements[0];
          if (replacement) {
            handleApplySuggestion(target, replacement);
          }
        } else {
          handleDismiss(target);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editor]);

  function handleToolClick(name) {
    const nextTool = activeTool === name ? "" : name;
    setActiveTool(nextTool);
    if (name === "Proofread") {
      if (nextTool === "Proofread") {
        runGrammarCheck();
      } else if (editor) {
        setGrammarMatches([]);
        setActiveErrorId(null);
        activeErrorRef.current = null;
        clearGrammarDecorations(editor);
      }
    }
  }

  function triggerProofread() {
    setActiveTool("Proofread");
    runGrammarCheck();
  }

  proofreadRef.current = triggerProofread;

  const dimmed = focusMode && editorFocused && grammarMatches.length === 0;
  const panelDim =
    "transition-opacity duration-700 ease-in-out " +
    (dimmed ? "opacity-[0.02] hover:opacity-100" : "opacity-100");

  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <header className="flex items-center justify-between px-6 h-14 border-b border-hairline">
        <div className="leading-tight">
          <span className="block font-serif text-lg tracking-tight">Lexicon</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            System Toolset V3.0
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:text-ink"
          aria-label="Open settings"
        >
          {language}
        </button>
      </header>

      <main className="flex flex-1 min-h-0">
        <aside className={"flex w-64 shrink-0 flex-col justify-between border-r border-hairline p-4 " + panelDim}>
          <Toolbar editor={editor} activeTool={activeTool} onToolClick={handleToolClick} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="group mt-6 flex items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            aria-label="Open settings"
          >
            <Gear
              size={16}
              weight="bold"
              className="transition-transform duration-200 group-hover:rotate-45"
            />
            <span>Settings</span>
          </button>
        </aside>

        <section className="flex-1 min-w-0 p-6">
          <Editor editor={editor} fontSize={fontSize} lineSpacing={lineSpacing} />
        </section>

        <aside className={"w-80 shrink-0 border-l border-hairline " + panelDim}>
          <ReviewPanel
            editor={editor}
            selectedText={selectedText}
            activeTool={activeTool}
            grammarMatches={grammarMatches}
            onApply={handleApplySuggestion}
            onDismiss={handleDismiss}
            onLocate={handleLocate}
            onClear={() => {
              setActiveTool("");
              setGrammarMatches([]);
              setActiveErrorId(null);
              activeErrorRef.current = null;
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

      <Settings
        open={settingsOpen}
        language={language}
        onLanguageChange={handleLanguageChange}
        fontSize={fontSize}
        onFontSizeChange={handleFontSizeChange}
        lineSpacing={lineSpacing}
        onLineSpacingChange={handleLineSpacingChange}
        focusMode={focusMode}
        onFocusModeChange={handleFocusModeChange}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
