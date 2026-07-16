import { useState, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Strike from "@tiptap/extension-strike";
import Highlight from "@tiptap/extension-highlight";
import Superscript from "@tiptap/extension-superscript";
import Subscript from "@tiptap/extension-subscript";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import { createLowlight, common } from "lowlight";
import { ProofreadShortcut } from "./proofreadShortcut.js";
import { detectTone } from "./toneScore.js";
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
const dictionaryKey = "lexicon:user_dictionary";

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

function loadDictionary() {
  try {
    const saved = JSON.parse(localStorage.getItem(dictionaryKey));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function selectionText(editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ");
}

export default function App() {
  const [selectedText, setSelectedText] = useState("");
  const [activeTool, setActiveTool] = useState("");
  const [grammarMatches, setGrammarMatches] = useState([]);
  const [checking, setChecking] = useState(false);
  const [hoveredError, setHoveredError] = useState(null);
  const [activeErrorId, setActiveErrorId] = useState(null);
  const [language, setLanguage] = useState(loadLanguage);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [focusMode, setFocusMode] = useState(loadFocusMode);
  const [lineSpacing, setLineSpacing] = useState(loadLineSpacing);
  const [userDictionary, setUserDictionary] = useState(loadDictionary);
  const [docText, setDocText] = useState("");
  const [toneResult, setToneResult] = useState(null);
  const [editorFocused, setEditorFocused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const proofreadRef = useRef(() => {});
  const activeErrorRef = useRef(null);
  const matchesRef = useRef([]);
  const activeToolRef = useRef(activeTool);
  const scheduleCheckRef = useRef(() => {});
  const checkTimer = useRef(null);
  const checkAbortRef = useRef(null);
  const checkingRef = useRef(false);
  const userDictionaryRef = useRef(userDictionary);
  activeToolRef.current = activeTool;
  userDictionaryRef.current = userDictionary;

  const lowlight = createLowlight(common);

  const editor = useEditor({
    extensions: [
      // StarterKit bundles the base `codeBlock` node; disable it so the
      // Lowlight-powered one below can own the `codeBlock` schema type
      // without a node-type collision.
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Strike,
      Highlight.configure({ multicolor: false }),
      Superscript,
      Subscript,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      // Image node: block-level. base64 is allowed so images pasted from the
      // local clipboard
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          referrerpolicy: "no-referrer",
          loading: "lazy",
          decoding: "async",
        },
      }),
      GrammarHighlight,
      ProofreadShortcut.configure({
        onProofread: () => proofreadRef.current(),
      }),
    ],
    editorProps: {
      attributes: {
        spellcheck: "false",
      },
      // Accept images dropped/pasted from the local clipboard.
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        const text = clipboard?.getData("text/plain")?.trim() || "";
        const hasFiles = (clipboard?.files?.length || 0) > 0;
        const hasHtml = (clipboard?.getData("text/html") || "").length > 0;
        if (
          !hasFiles &&
          !hasHtml &&
          text &&
          /^(https?:\/\/|data:image\/)/i.test(text) &&
          /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(text)
        ) {
          event.preventDefault();
          const { schema } = view.state;
          const node = schema.nodes.image.create({ src: text });
          view.dispatch(view.state.tr.insert(view.state.selection.from, node));
          return true;
        }
        const files = Array.from(clipboard?.files || []);
        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) {
          return false;
        }
        event.preventDefault();
        const { schema } = view.state;
        images.forEach((file) => {
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result;
            const node = schema.nodes.image.create({ src });
            const insertAt = view.state.selection.from;
            view.dispatch(view.state.tr.insert(insertAt, node));
          };
          reader.readAsDataURL(file);
        });
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files || []);
        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length === 0) {
          return false;
        }
        event.preventDefault();
        const { schema } = view.state;
        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        const dropPos = coords ? coords.pos : view.state.selection.from;
        images.forEach((file) => {
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result;
            const node = schema.nodes.image.create({ src });
            view.dispatch(view.state.tr.insert(dropPos, node));
          };
          reader.readAsDataURL(file);
        });
        return true;
      },
    },
    content: loadContent(),
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      localStorage.setItem(storageKey, editor.getHTML());
      setDocText(text);
      setToneResult(detectTone(text));
      // Smart trigger: once a word or sentence is clearly finished
      const smartTrigger = /[.?\s]$/.test(text);
      scheduleCheckRef.current(smartTrigger);
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

  async function runGrammarCheck(silent = false, ignoreOverride = null) {
    if (!editor) {
      return;
    }
    if (checkingRef.current) {
      return;
    }
    // Cancel any prior in-flight fetch so a superseded check can't linger.
    if (checkAbortRef.current) {
      checkAbortRef.current.abort();
    }
    const abortController = new AbortController();
    checkAbortRef.current = abortController;
    checkingRef.current = true;
    if (!silent) {
      setChecking(true);
    }
    try {
      const { text, map } = buildTextWithMap(editor.state.doc);
      const ignore = ignoreOverride ?? userDictionaryRef.current;
      const rawMatches = await checkGrammar(
        text,
        language,
        ignore,
        abortController.signal,
      );
      const matches = rawMatches.map((match, i) => ({
        ...match,
        id: i,
        original: text.slice(match.offset, match.offset + match.length),
        category: categoryLabel(match),
      }));
      setGrammarMatches(matches);
      applyGrammarDecorations(editor, matches, map, activeErrorId);
    } catch (error) {
      if (error?.name !== "AbortError") {
        throw error;
      }
    } finally {
      if (checkAbortRef.current === abortController) {
        checkAbortRef.current = null;
      }
      checkingRef.current = false;
      if (!silent) {
        setChecking(false);
      }
    }
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
    runGrammarCheck();
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
    runGrammarCheck();
  }

  function handleAddToDictionary(match) {
    const word = (match.original || "").trim();
    if (!word || userDictionary.includes(word)) {
      // Still remove the card locally even if it's already in the dictionary.
      handleDismiss(match);
      return;
    }
    const next = [...userDictionary, word];
    setUserDictionary(next);
    localStorage.setItem(dictionaryKey, JSON.stringify(next));
    // Remove this card and re-run so any other occurrences of the word clear.
    dismissError(editor, match.id);
    setGrammarMatches((current) => {
      const remaining = current.filter((m) => m.id !== match.id);
      if (remaining.length === 0) {
        setActiveErrorId(null);
        activeErrorRef.current = null;
      }
      return remaining;
    });
    setHoveredError(null);
    runGrammarCheck(false, next);
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

  // Reactive grammar sync while Proofread is active. 
  // 300-400ms is the sweet spot
  const GRAMMAR_DEBOUNCE_MS = 350;
  function scheduleCheck(immediate = false) {
    if (activeToolRef.current !== "Proofread") {
      return;
    }
    if (checkTimer.current) {
      clearTimeout(checkTimer.current);
    }
    if (immediate) {
      runGrammarCheck(true);
      return;
    }
    checkTimer.current = setTimeout(() => {
      runGrammarCheck(true);
    }, GRAMMAR_DEBOUNCE_MS);
  }

  scheduleCheckRef.current = scheduleCheck;

  const emptyDoc = docText.trim().length === 0;
  const totalWords = emptyDoc ? 0 : docText.trim().split(/\s+/).length;
  const errorRatio = totalWords > 0 ? grammarMatches.length / totalWords : 0;
  const clarityScore = emptyDoc
    ? null
    : Math.max(0, Math.min(100, Math.round(100 - errorRatio * 100 * 12)));

  function clarityGrade(score) {
    if (score >= 95) return "EXCELLENT";
    if (score >= 85) return "GREAT";
    if (score >= 65) return "GOOD";
    if (score >= 40) return "FAIR";
    return "NEEDS IMPROVEMENT";
  }

  const clarityDensity = emptyDoc
    ? null
    : errorRatio <= 0.02
      ? "error density low"
      : errorRatio <= 0.06
        ? "error density moderate"
        : "error density high";

  const clarityGradeLabel = clarityScore == null ? null : clarityGrade(clarityScore);

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
          <Editor
            editor={editor}
            fontSize={fontSize}
            lineSpacing={lineSpacing}
            clarityScore={clarityScore}
            clarityGrade={clarityGradeLabel}
            clarityDensity={clarityDensity}
            grammarMatches={grammarMatches}
            emptyDoc={emptyDoc}
            proofreadActive={activeTool === "Proofread"}
            toneResult={toneResult}
          />
        </section>

        <aside className={"w-80 shrink-0 border-l border-hairline " + panelDim}>
          <ReviewPanel
            editor={editor}
            selectedText={selectedText}
            activeTool={activeTool}
            grammarMatches={grammarMatches}
            checking={checking}
            onApply={handleApplySuggestion}
            onDismiss={handleDismiss}
            onAddToDictionary={handleAddToDictionary}
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
