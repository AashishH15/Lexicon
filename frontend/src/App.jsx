import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
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
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import DragHandle from "@tiptap/extension-drag-handle";
import { TableKit } from "@tiptap/extension-table";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import SlashCommand from "./slashCommand.js";
import { createLowlight, common } from "lowlight";
import { ProofreadShortcut } from "./proofreadShortcut.js";
import { detectTone } from "./toneScore.js";
import Toolbar from "./Toolbar.jsx";
import Editor from "./Editor.jsx";
import ImportExportMenu from "./ImportExportMenu.jsx";
import ReviewPanel from "./ReviewPanel.jsx";
import GrammarTooltip from "./GrammarTooltip.jsx";
import Settings, { SETTINGS_DEFAULTS } from "./Settings.jsx";
import DictionaryPanel from "./DictionaryPanel.jsx";
import AiSetupModal from "./AiSetupModal.jsx";
import useTransform from "./useTransform.js";
import { isAiTool, promptForTool } from "./prompts.js";
import { marked } from "marked";
import {
  Gear,
  BookBookmark,
  ArrowsOut,
  ArrowsIn,
  ArrowLineLeft,
  ArrowLineRight,
  ArrowSquareLeft,
  ArrowSquareRight,
  CircleNotch,
} from "@phosphor-icons/react";
import { checkGrammar, getAiStatus } from "./api.js";
import {
  checkForUpdate,
  installUpdate,
  updaterIsAvailable,
} from "./updater.js";
import UpdateBanner from "./UpdateBanner.jsx";
import {
  GrammarHighlight,
  buildTextWithMap,
  applyGrammarDecorations,
  clearGrammarDecorations,
  applySuggestion,
  dismissError,
  focusError,
  findErrorAt,
  grammarPluginKey,
} from "./grammarHighlight.js";
import { DecorationSet } from "@tiptap/pm/view";

// Six-dot grip used for the drag handle
const DRAG_HANDLE_GRIP_SVG = `
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="4" cy="3" r="1.3" fill="#787774" />
    <circle cx="10" cy="3" r="1.3" fill="#787774" />
    <circle cx="4" cy="7" r="1.3" fill="#787774" />
    <circle cx="10" cy="7" r="1.3" fill="#787774" />
    <circle cx="4" cy="11" r="1.3" fill="#787774" />
    <circle cx="10" cy="11" r="1.3" fill="#787774" />
  </svg>
`;

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
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "v0.5.8";
const leftPanelKey = "lexicon:leftPanelOpen";
const rightPanelKey = "lexicon:rightPanelOpen";
const leftWidthKey = "lexicon:leftPanelWidth";
const rightWidthKey = "lexicon:rightPanelWidth";
const MIN_PANEL_WIDTH = 175;
const MAX_PANEL_WIDTH = 575;
// How far past the hard-stop (MIN_PANEL_WIDTH) the user must keep pulling
// before releasing collapses the panel. Gives a felt "stop" before close.
const COLLAPSE_PAST = 100;

function loadContent() {
  const saved = localStorage.getItem(storageKey);
  return saved ?? "<p></p>";
}

function loadLanguage() {
  return localStorage.getItem(languageKey) ?? SETTINGS_DEFAULTS.language;
}

function loadFontSize() {
  const saved = Number(localStorage.getItem(fontSizeKey));
  return saved || SETTINGS_DEFAULTS.fontSize;
}

function loadFocusMode() {
  return localStorage.getItem(focusModeKey) === "true";
}

function loadLineSpacing() {
  return Number(localStorage.getItem(lineSpacingKey)) || SETTINGS_DEFAULTS.lineSpacing;
}

function loadPanelOpen(key) {
  // Default to open (key absent === true). Only an explicit "false" collapses.
  return localStorage.getItem(key) !== "false";
}

function loadDictionary() {
  try {
    const saved = JSON.parse(localStorage.getItem(dictionaryKey));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function loadPanelWidth(key, fallback) {
  const v = parseInt(localStorage.getItem(key), 10);
  if (Number.isNaN(v)) return fallback;
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, v));
}

// Platform hint used for shortcut labels (⌘ on macOS, Ctrl elsewhere).
const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function selectionText(editor) {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to, " ");
}

// Click handler for inline/block math nodes: open the inline math editor
function requestMathEdit(kind, node, pos) {
  window.dispatchEvent(
    new CustomEvent("lex:edit-math", {
      detail: { kind, pos, latex: node.attrs.latex ?? "" },
    }),
  );
}

export default function App() {
  const [selectedText, setSelectedText] = useState("");
  const [activeTool, setActiveTool] = useState("");
  const [grammarMatches, setGrammarMatches] = useState([]);
  const [userResolvedAll, setUserResolvedAll] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set());
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
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [aiSetupOpen, setAiSetupOpen] = useState(() => {
    // First-run AI setup flow: shown once, gated by a localStorage flag.
    return localStorage.getItem("lexicon:aiSetupDone") !== "true";
  });
  const [updateState, setUpdateState] = useState({
    status: "idle",
    update: null,
    message: "",
    progress: null,
    dismissed: false,
  });

  const runUpdateCheck = useCallback(async ({ silent = false } = {}) => {
    setUpdateState((current) => ({
      ...current,
      status: "checking",
      message: "",
      dismissed: false,
    }));
    try {
      const update = await checkForUpdate();
      if (!update) {
        setUpdateState({
          status: updaterIsAvailable() ? "current" : "unavailable",
          update: null,
          message: updaterIsAvailable()
            ? "Lexicon is up to date."
            : "Updates are checked from an installed Lexicon build.",
          progress: null,
          dismissed: false,
        });
        return null;
      }
      setUpdateState({
        status: "available",
        update,
        message: "",
        progress: null,
        dismissed: false,
      });
      return update;
    } catch {
      setUpdateState((current) => ({
        ...current,
        status: silent ? "idle" : "error",
        message: silent ? "" : "Could not check for updates right now.",
        progress: null,
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      runUpdateCheck({ silent: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [runUpdateCheck]);

  const installAvailableUpdate = useCallback(async () => {
    if (!updateState.update) return;
    setUpdateState((current) => ({
      ...current,
      status: "installing",
      message: "Downloading the update…",
      progress: { downloaded: 0, total: 0 },
    }));
    try {
      await installUpdate(updateState.update, (progress) => {
        setUpdateState((current) => ({ ...current, progress }));
      });
    } catch {
      setUpdateState((current) => ({
        ...current,
        status: "error",
        message: "The update could not be installed. Please try again later.",
      }));
    }
  }, [updateState.update]);

  const { status: transformStatus, error: transformError, run: runTransform, abort: abortTransform, isWarming } =
    useTransform();
  const [transformResults, setTransformResults] = useState([]); // [{ tool, text, from, to, part, total }]
  const [transformProgress, setTransformProgress] = useState(null); // { current, total } | null
  const [transformRunning, setTransformRunning] = useState(false);
  const transformRunningRef = useRef(false);
  const cancelTransformRef = useRef(false);
  const runIdRef = useRef(0);
  // Budgets must fit n_ctx (8192): input + max_tokens (4096) + overhead.
  // Keep input per chunk <= 3500 tokens so 3500 + 4096 ~= 7600 < 8192.
  const TRANSFORM_INPUT_BUDGET = 3500;
  const TRANSFORM_CHUNK_BUDGET = 3500;

  const refreshAiConfigured = useCallback(async () => {
    try {
      const s = await getAiStatus();
      const configured =
        s.preference?.backend === "ollama"
          ? s.ollama_available
          : Boolean(s.models_ready?.[s.preference?.model_key || s.model_key]);
      setAiConfigured(configured);
    } catch {
      setAiConfigured(false);
    }
  }, []);
  useEffect(() => {
    refreshAiConfigured();
  }, [refreshAiConfigured]);
  // Settings-panel model changes (delete / re-select) fire this so the
  // toolbar can un-grey without the modal close path.
  useEffect(() => {
    const onCfg = () => refreshAiConfigured();
    window.addEventListener("lexicon:ai-configured", onCfg);
    return () => window.removeEventListener("lexicon:ai-configured", onCfg);
  }, [refreshAiConfigured]);
  const [leftPanelOpen, setLeftPanelOpen] = useState(() =>
    loadPanelOpen(leftPanelKey),
  );
  const [rightPanelOpen, setRightPanelOpen] = useState(() =>
    loadPanelOpen(rightPanelKey),
  );
  const [leftWidth, setLeftWidth] = useState(() =>
    loadPanelWidth(leftWidthKey, 256),
  );
  const [rightWidth, setRightWidth] = useState(() =>
    loadPanelWidth(rightWidthKey, 320),
  );
  const [leftPeek, setLeftPeek] = useState(false);
  const [rightPeek, setRightPeek] = useState(false);
  // Focus Mode: when on, panels auto-collapse for a distraction-free view
  const leftCloseTimer = useRef(null);
  const rightCloseTimer = useRef(null);
  const openLeftPeek = useCallback(() => {
    clearTimeout(leftCloseTimer.current);
    setLeftPeek(true);
  }, []);
  const scheduleCloseLeft = useCallback(() => {
    clearTimeout(leftCloseTimer.current);
    leftCloseTimer.current = setTimeout(() => setLeftPeek(false), 180);
  }, []);
  const openRightPeek = useCallback(() => {
    clearTimeout(rightCloseTimer.current);
    setRightPeek(true);
  }, []);
  const scheduleCloseRight = useCallback(() => {
    clearTimeout(rightCloseTimer.current);
    rightCloseTimer.current = setTimeout(() => setRightPeek(false), 180);
  }, []);

  const proofreadRef = useRef(() => {});
  const activeErrorRef = useRef(null);
  const matchesRef = useRef([]);
  const activeToolRef = useRef(activeTool);
  const scheduleCheckRef = useRef(() => {});
  const checkTimer = useRef(null);
  const checkAbortRef = useRef(null);
  const checkingRef = useRef(false);
  const userDictionaryRef = useRef(userDictionary);
  const dismissedKeysRef = useRef(dismissedKeys);
  activeToolRef.current = activeTool;
  userDictionaryRef.current = userDictionary;
  dismissedKeysRef.current = dismissedKeys;

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
      // Tables: TableKit bundles the Table / TableRow / TableHeader /
      // TableCell nodes. `resizable: true` enables the drag handles on column
      // borders so users can adjust column widths.
      TableKit.configure({
        table: { resizable: true },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      // Mathematics: inline ($...$) and block ($$$...$$$) LaTeX rendered via
      // KaTeX. Errors render inline (throwOnError:false) instead of crashing.
      Mathematics.configure({
        katexOptions: { throwOnError: false, errorColor: "#9f2f2d" },
        inlineOptions: {
          onClick: (node, pos) => requestMathEdit("inline", node, pos),
        },
        blockOptions: {
          onClick: (node, pos) => requestMathEdit("block", node, pos),
        },
      }),
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
      // Slash command menu: typing "/" opens a filterable command list with
      // full keyboard navigation (arrows + Enter). Active formats are flagged
      // so re-selecting toggles them off.
      SlashCommand,
      // Clean empty-draft hint. Only shows when the document has no content,
      // so it stays out of the way once the user starts writing.
      Placeholder.configure({
        placeholder: "Start writing, and press Proofread to check your draft…",
      }),
      // Typography smart rules: ... -> ellipsis, -- -> em dash, and straight
      // quotes -> curly quotes, applied live as the user types.
      Typography,
      // Drag handle: a grip that appears beside the hovered block so the user
      // can reorder paragraphs, headings, images, code blocks, and (with
      // nested: true) grab parent containers like lists/blockquotes.
      DragHandle.configure({
        nested: {
          edgeDetection: "none",
        },
        onNodeChange: ({ node, editor }) => {
          const handle = editor.view.dom.parentElement?.querySelector(
            ".lex-drag-handle",
          );
          if (!handle) {
            return;
          }
          const isListItem = node?.type?.name === "listItem";
          handle.classList.toggle("lex-drag-handle--list", isListItem);
        },
        render: () => {
          const el = document.createElement("div");
          el.className = "lex-drag-handle";
          el.setAttribute("role", "button");
          el.setAttribute("aria-label", "Drag to move block");
          el.setAttribute("contenteditable", "false");
          el.innerHTML = DRAG_HANDLE_GRIP_SVG;
          return el;
        },
      }),
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
        if (view.dragging) {
          return false;
        }
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
    const handleClick = (event) => {
      const target = event.target.closest(".lex-error");
      if (!target) {
        return;
      }
      const id = Number(target.getAttribute("data-error-id"));
      activeErrorRef.current = id;
      setActiveErrorId(id);
    };
    dom.addEventListener("mouseover", handleOver);
    dom.addEventListener("click", handleClick);
    return () => {
      dom.removeEventListener("mouseover", handleOver);
      dom.removeEventListener("click", handleClick);
    };
  }, [editor]);

  function matchKey(match, text) {
    const original = text
      ? text.slice(match.offset, match.offset + match.length)
      : match.original;
    return `${match.message}::${match.offset}::${match.length}::${original}`;
  }

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
      if (dismissedKeysRef.current.size > 0) {
        const trimmed = new Set();
        dismissedKeysRef.current.forEach((key) => {
          const offset = Number(key.split("::")[1]);
          if (!Number.isNaN(offset) && offset <= text.length) {
            trimmed.add(key);
          }
        });
        if (trimmed.size !== dismissedKeysRef.current.size) {
          setDismissedKeys(trimmed);
          dismissedKeysRef.current = trimmed;
        }
      }
      const matches = rawMatches
        .filter((match) => !dismissedKeysRef.current.has(matchKey(match, text)))
        .map((match, i) => ({
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

  function rememberDismissed(match) {
    setDismissedKeys((current) => {
      const key = matchKey(match, null);
      if (current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function handleDismiss(match) {
    if (!editor) {
      return;
    }
    rememberDismissed(match);
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

  function handleAcceptAll() {
    if (!editor) {
      return;
    }
    // Apply every replacement in a single transaction, processed right-to-left
    // (descending document position). Because each edit sits to the right of
    // all not-yet-applied matches, their original positions stay valid, so a
    // replacement of one length can't corrupt a later match's range the way
    // sequential left-to-right edits do.
    const { map } = buildTextWithMap(editor.state.doc);
    const edits = grammarMatches
      .map((match) => {
        const replacement = match.replacements && match.replacements[0];
        if (!replacement) {
          return null;
        }
        const from = map[match.offset];
        const last = map[match.offset + match.length - 1];
        if (from == null || last == null) {
          return null;
        }
        return { from, to: last + 1, replacement };
      })
      .filter(Boolean)
      .sort((a, b) => b.from - a.from);

    let tr = editor.state.tr;
    edits.forEach(({ from, to, replacement }) => {
      tr = tr.insertText(replacement, from, to);
    });
    tr.setMeta(grammarPluginKey, { decorations: DecorationSet.empty });
    editor.view.dispatch(tr);

    setGrammarMatches([]);
    setActiveErrorId(null);
    activeErrorRef.current = null;
    setHoveredError(null);
    setUserResolvedAll(true);
    runGrammarCheck();
  }

  function handleDismissAll() {
    grammarMatches.forEach((match) => rememberDismissed(match));
    if (editor) {
      clearGrammarDecorations(editor);
    }
    setGrammarMatches([]);
    setActiveErrorId(null);
    activeErrorRef.current = null;
    setHoveredError(null);
    setUserResolvedAll(true);
    runGrammarCheck();
  }

  function handleAddWordToDictionary(rawWord) {
    const word = (rawWord || "").trim();
    if (!word) {
      return "empty";
    }
    if (userDictionary.includes(word)) {
      return "duplicate";
    }
    const next = [...userDictionary, word];
    setUserDictionary(next);
    localStorage.setItem(dictionaryKey, JSON.stringify(next));
    runGrammarCheck(false, next);
    return "added";
  }

  // Remove a word from the user dictionary. Re-runs the check so any errors
  // that were previously ignored for that word show up again.
  function handleRemoveFromDictionary(word) {
    const next = userDictionary.filter((w) => w !== word);
    setUserDictionary(next);
    localStorage.setItem(dictionaryKey, JSON.stringify(next));
    runGrammarCheck(false, next);
  }

  function handleLocate(match) {
    if (!editor) {
      return;
    }
    setActiveErrorId(match.id);
    activeErrorRef.current = match.id;
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
    // Leaving Focus Mode restores the user's normal open/collapsed preference
    // and clears any transient peek.
    if (!next) {
      setLeftPeek(false);
      setRightPeek(false);
    }
  }

  function handleToggleLeftPanel() {
    setLeftPanelOpen((open) => {
      const next = !open;
      localStorage.setItem(leftPanelKey, String(next));
      return next;
    });
  }

  function handleToggleRightPanel() {
    setRightPanelOpen((open) => {
      const next = !open;
      localStorage.setItem(rightPanelKey, String(next));
      return next;
    });
  }

  const [resizing, setResizing] = useState(null); // "left" | "right" | null
  const [aboutToCollapse, setAboutToCollapse] = useState(null); // "left" | "right" | null
  function startResize(side) {
    return (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = side === "left" ? leftWidth : rightWidth;
      let rafId = null;
      let latest = startWidth;
      let overshoot = 0;
      setResizing(side);
      const onMove = (ev) => {
        const delta = ev.clientX - startX;
        // Left panel grows when dragged right; right panel grows when dragged left.
        let raw = side === "left" ? startWidth + delta : startWidth - delta;
        raw = Math.min(MAX_PANEL_WIDTH, raw);
        if (raw <= MIN_PANEL_WIDTH) {
          // Hard stop: clamp at the minimum and remember how far past it the
          // pointer kept travelling, so a deliberate pull-past can close it.
          latest = MIN_PANEL_WIDTH;
          overshoot = MIN_PANEL_WIDTH - raw;
        } else {
          latest = raw;
          overshoot = 0;
        }
        // Once the user has pulled past the collapse threshold, flag the panel
        // so the UI can show a "release to collapse" indicator.
        setAboutToCollapse(overshoot >= COLLAPSE_PAST ? side : null);
        if (rafId == null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (side === "left") setLeftWidth(latest);
            else setRightWidth(latest);
          });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (rafId != null) cancelAnimationFrame(rafId);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setResizing(null);
        setAboutToCollapse(null);
        if (overshoot >= COLLAPSE_PAST) {
          const reset = side === "left"
            ? Math.max(startWidth, 256)
            : Math.max(startWidth, 320);
          if (side === "left") {
            setLeftPanelOpen(false);
            setLeftWidth(reset);
            localStorage.setItem(leftWidthKey, String(reset));
          } else {
            setRightPanelOpen(false);
            setRightWidth(reset);
            localStorage.setItem(rightWidthKey, String(reset));
          }
        } else {
          const final = latest;
          if (side === "left") {
            setLeftWidth(final);
            localStorage.setItem(leftWidthKey, String(final));
          } else {
            setRightWidth(final);
            localStorage.setItem(rightWidthKey, String(final));
          }
        }
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  // In Focus Mode the edge rail is hover-to-peek only
  function handleRailLeftClick() {
    if (!focusMode) handleToggleLeftPanel();
  }

  function handleRailRightClick() {
    if (!focusMode) handleToggleRightPanel();
  }

  function handleCollapseLeft() {
    if (focusMode) {
      clearTimeout(leftCloseTimer.current);
      setLeftPeek(false);
    } else {
      handleToggleLeftPanel();
    }
  }

  function handleCollapseRight() {
    if (focusMode) {
      clearTimeout(rightCloseTimer.current);
      setRightPeek(false);
    } else {
      handleToggleRightPanel();
    }
  }

  function handleLineSpacingChange(next) {
    setLineSpacing(next);
    localStorage.setItem(lineSpacingKey, String(next));
  }

  function handleResetDefaults() {
    setLanguage(SETTINGS_DEFAULTS.language);
    setFontSize(SETTINGS_DEFAULTS.fontSize);
    setFocusMode(SETTINGS_DEFAULTS.focusMode);
    setLineSpacing(SETTINGS_DEFAULTS.lineSpacing);
    localStorage.removeItem(languageKey);
    localStorage.removeItem(fontSizeKey);
    localStorage.removeItem(focusModeKey);
    localStorage.removeItem(lineSpacingKey);
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
      return;
    }
    if (!isAiTool(name)) {
      return;
    }
    if (!aiConfigured) {
      setAiSetupOpen(true);
      return;
    }
    // Clicking the already-active AI tool again cancels an in-progress run
    if (nextTool === "") {
      if (transformRunningRef.current) {
        cancelTransform();
      } else {
        setTransformResults([]);
        setTransformProgress(null);
      }
      return;
    }
    runAiTool(name);
  }

  function windowBlock(block) {
    // A block larger than the budget (e.g. a wall-of-text paragraph) can't be
    // split by paragraph, so cut it into fixed character windows within its
    // real range. Ranges stay valid for Apply.
    const maxChars = TRANSFORM_CHUNK_BUDGET * 4;
    const out = [];
    for (let start = 0; start < block.text.length; start += maxChars) {
      const end = Math.min(start + maxChars, block.text.length);
      out.push({
        from: block.from + start,
        to: block.from + end,
        text: block.text.slice(start, end),
        tokens: Math.ceil((end - start) / 4),
      });
    }
    return out;
  }

  function buildChunks() {
    const blocks = [];
    editor.state.doc.forEach((node, pos) => {
      const text = node.textContent;
      if (!text.trim()) {
        return;
      }
      blocks.push({ from: pos, to: pos + node.nodeSize, text });
    });
    const estimate = (t) => Math.ceil(t.length / 4);
    const chunks = [];
    let current = null;
    const pushCurrent = () => {
      if (!current) {
        return;
      }
      // Window any oversized chunk (covers a lone large block too — the
      // single-block case the naive loop missed).
      if (current.tokens > TRANSFORM_CHUNK_BUDGET) {
        chunks.push(...windowBlock(current));
      } else {
        chunks.push(current);
      }
      current = null;
    };
    for (const block of blocks) {
      const tokens = estimate(block.text);
      if (current && current.tokens + tokens > TRANSFORM_CHUNK_BUDGET) {
        pushCurrent();
      }
      if (!current) {
        if (tokens > TRANSFORM_CHUNK_BUDGET) {
          // Oversized on its own — window it directly instead of buffering.
          chunks.push(...windowBlock(block));
          continue;
        }
        current = { from: block.from, to: block.to, text: block.text, tokens };
        continue;
      }
      current.to = block.to;
      current.text += "\n\n" + block.text;
      current.tokens += tokens;
    }
    pushCurrent();
    return chunks;
  }

  async function runAiTool(name) {
    if (!editor) {
      return;
    }
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    const prompt = promptForTool(name);
    if (!prompt) {
      return;
    }
    // Selection-scoped: single transform over the selection (bounded).
    if (hasSelection) {
      const sourceText = editor.state.doc.textBetween(from, to, " ");
      if (!sourceText.trim()) {
        return;
      }
      const result = await runTransform({ prompt, text: sourceText });
      if (result == null) {
        return;
      }
      setTransformResults([
        { tool: name, text: result, from, to, part: 1, total: 1 },
      ]);
      return;
    }
    // Whole-doc: chunk if it exceeds the single-shot budget, else one card.
    const fullText = editor.getText();
    if (!fullText.trim()) {
      return;
    }
    const inputTokens = Math.ceil(fullText.length / 4);
    let chunks;
    if (inputTokens <= TRANSFORM_INPUT_BUDGET) {
      chunks = [{ from: 0, to: editor.state.doc.content.size, text: fullText }];
    } else {
      chunks = buildChunks();
    }
    const total = chunks.length;
    const runId = ++runIdRef.current;
    transformRunningRef.current = true;
    setTransformRunning(true);
    cancelTransformRef.current = false;
    editor.setEditable(false);
    setTransformResults([]);
    setTransformProgress({ current: 0, total });
    let aborted = false;
    for (let i = 0; i < total; i++) {
      if (cancelTransformRef.current || runIdRef.current !== runId) {
        aborted = true;
        break;
      }
      setTransformProgress({ current: i + 1, total });
      const chunk = chunks[i];
      const result = await runTransform({ prompt, text: chunk.text });
      if (runIdRef.current !== runId) {
        aborted = true;
        break;
      }
      if (result == null) {
        // Errored/aborted — useTransform holds the error; stop the sequence.
        aborted = true;
        break;
      }
      const card = {
        tool: name,
        text: result,
        from: chunk.from,
        to: chunk.to,
        part: i + 1,
        total,
      };
      setTransformResults((prev) => [...prev, card]);
    }
    transformRunningRef.current = false;
    setTransformRunning(false);
    editor.setEditable(true);
    setTransformProgress(null);
    if (aborted && runIdRef.current === runId) {
      // Cancel or error: clear the panel (per design — no partial cards kept).
      // Guarded by runId so a stale loop waking after a newer run started can
      // never clobber the new run's state.
      setTransformResults([]);
    }
  }

  function cancelTransform() {
    cancelTransformRef.current = true;
    // Invalidate this run so its async loop tears down instead of interfering
    // with a run that may start next. Bump runId and abort the in-flight fetch
    // so the awaiting runTransform rejects fast (client-side cancel is instant
    // even though the backend finishes its current chunk quietly).
    runIdRef.current += 1;
    abortTransform();
    transformRunningRef.current = false;
    setTransformRunning(false);
    editor?.setEditable(true);
    setTransformResults([]);
    setTransformProgress(null);
  }

  function normalizeTableCells(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("th, td").forEach((cell) => {
      const hasBlock = cell.querySelector("p, div, ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6");
      if (!hasBlock) {
        const para = doc.createElement("p");
        para.innerHTML = cell.innerHTML;
        cell.innerHTML = "";
        cell.appendChild(para);
      }
    });
    return doc.body.innerHTML;
  }

  function applyTransformResult(card) {
    if (!editor || !card) {
      return;
    }
    const { from, to, text } = card;
    let html = marked.parse(text);
    if (/<table/i.test(html)) {
      html = normalizeTableCells(html);
    }
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, html)
      .run();
    // Remove just this card so remaining parts stay available.
    setTransformResults((prev) => {
      const next = prev.filter((c) => c !== card);
      if (next.length === 0) {
        setActiveTool("");
      }
      return next;
    });
  }

  function dismissTransformResult() {
    setTransformResults([]);
    setTransformProgress(null);
    setActiveTool("");
  }

  function triggerProofread() {
    setActiveTool("Proofread");
    setUserResolvedAll(false);
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

  const leftVisible = focusMode ? leftPeek : leftPanelOpen;
  const rightVisible = focusMode ? rightPeek : rightPanelOpen;
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const leftWidthRef = useRef(leftWidth);
  leftWidthRef.current = leftWidth;
  const rightWidthRef = useRef(rightWidth);
  rightWidthRef.current = rightWidth;
  const leftAnimRef = useRef(null);
  const rightAnimRef = useRef(null);
  const playSlide = (animRef, el, marginProp, toTransform, toMargin) => {
    const cs = getComputedStyle(el);
    const fromTransform = cs.transform;
    const fromMargin = cs[marginProp];
    if (animRef.current) animRef.current.cancel();
    const anim = el.animate(
      [
        { transform: fromTransform, [marginProp]: fromMargin },
        { transform: toTransform, [marginProp]: toMargin },
      ],
      { duration: 300, easing: "ease-out", fill: "forwards" },
    );
    animRef.current = anim;
  };
  useLayoutEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    const w = leftWidthRef.current;
    playSlide(
      leftAnimRef,
      el,
      "marginLeft",
      leftVisible ? "translateX(0px)" : `translateX(-${w}px)`,
      leftVisible ? "0px" : `-${w}px`,
    );
  }, [leftVisible]);
  useLayoutEffect(() => {
    const el = rightPanelRef.current;
    if (!el) return;
    const w = rightWidthRef.current;
    playSlide(
      rightAnimRef,
      el,
      "marginRight",
      rightVisible ? "translateX(0px)" : `translateX(${w}px)`,
      rightVisible ? "0px" : `-${w}px`,
    );
  }, [rightVisible]);

  return (
    <div className="lex-app-shell flex flex-col h-screen overflow-hidden bg-canvas text-ink">
      <header className="lex-no-print flex items-center justify-between px-6 h-14 border-b border-hairline">
        <div className="leading-tight">
          <span className="block font-serif text-lg tracking-tight">Lexicon</span>
          <div className="flex items-center gap-2">
            <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
              {APP_VERSION}
            </span>
            {updateState.status === "available" && !updateState.dismissed && (
              <UpdateBanner
                update={updateState.update}
                onInstall={installAvailableUpdate}
              />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ImportExportMenu editor={editor} />
          <button
            type="button"
            onClick={() => handleFocusModeChange(!focusMode)}
            className={
              "rounded p-1.5 transition-colors " +
              (focusMode
                ? "bg-accent/15 text-accent hover:bg-accent/25"
                : "text-muted hover:bg-hairline/60 hover:text-ink")
            }
            aria-label={focusMode ? "Exit focus" : "Enter focus"}
            title={focusMode ? "Exit focus" : "Enter focus"}
          >
            {focusMode ? (
              <ArrowsIn size={16} weight="bold" />
            ) : (
              <ArrowsOut size={16} weight="bold" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:text-ink"
            aria-label="Open settings"
          >
            {language}
          </button>
        </div>
      </header>

      <main className="relative flex flex-1 min-h-0 overflow-x-hidden">
        <div
          ref={leftPanelRef}
          style={{ width: leftWidth }}
          className={
            "lex-no-print relative shrink-0 overflow-hidden border-r border-hairline transition-opacity duration-200 " +
            (leftVisible ? " " + panelDim : "") +
            (aboutToCollapse === "left" ? " opacity-70" : "")
          }
          onMouseEnter={() => focusMode && openLeftPeek()}
          onMouseLeave={() => focusMode && scheduleCloseLeft()}
        >
          <aside className="flex h-full w-full flex-col">
          {!focusMode && leftPanelOpen && (
            <div
              onPointerDown={startResize("left")}
              className={
                "absolute right-0 top-0 z-20 h-full w-1.5 cursor-ew-resize transition-all " +
                (aboutToCollapse === "left"
                  ? "w-2.0 bg-amber-500/70 animate-pulse"
                  : resizing === "left"
                    ? "bg-accent/60"
                    : "bg-transparent hover:bg-accent/30")
              }
              title="Drag to resize"
              aria-label="Resize left panel"
            />
          )}
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Actions
              </p>
              <button
                type="button"
                onClick={handleCollapseLeft}
                className={
                  "rounded p-1 transition-colors hover:bg-hairline/60 " +
                  (aboutToCollapse === "left"
                    ? "text-amber-500"
                    : "text-muted hover:text-ink")
                }
                aria-label="Collapse left panel"
                title="Collapse panel"
              >
                <ArrowLineLeft size={14} weight="bold" />
              </button>
            </div>
            <div className="lex-scroll flex-1 overflow-y-auto px-4 pb-4 pt-3">
              <Toolbar
                editor={editor}
                activeTool={activeTool}
                onToolClick={handleToolClick}
                onAiSetup={() => setAiSetupOpen(true)}
                aiConfigured={aiConfigured}
                panelWidth={leftWidth}
                isMac={isMac}
                isWarming={isWarming}
                transformRunning={transformRunning}
                transformStatus={transformStatus}
              />
              {!aiConfigured && (
                <div className="mt-2 rounded-lg border border-dashed border-hairline bg-canvas px-3 py-2.5">
                  <p className="font-sans text-xs leading-snug text-muted">
                    AI tools aren&rsquo;t set up yet. Download a local model or
                    connect your Ollama server to enable Rewrite, Tones,
                    Summary and more.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiSetupOpen(true)}
                    className="mt-2 rounded bg-pale-blue-text px-2.5 py-1 font-sans text-xs font-medium text-white transition-colors hover:bg-pale-blue-text/90"
                  >
                    Set up AI
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 border-t border-hairline p-4">
              <button
                type="button"
                onClick={() => setDictionaryOpen(true)}
                className="group flex items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
                aria-label="Open your dictionary"
              >
                <BookBookmark
                  size={16}
                  weight="bold"
                  className="transition-transform duration-200 group-hover:scale-110"
                />
                <span>Your Dictionary</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="group flex items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
                aria-label="Open settings"
              >
                <Gear
                  size={16}
                  weight="bold"
                  className="transition-transform duration-200 group-hover:rotate-45"
                />
                <span>Settings</span>
              </button>
            </div>
          </aside>
        </div>
        {/* Edge rail — always mounted (visibility toggled via classes, never
            unmounted) so clicking it doesn't remove a sibling DOM node in the
            same commit as the panel's class change, which would make Chromium
            skip the open transition. Click or (in Focus Mode) hover restores
            the panel. Always faintly visible + wider so users can discover it. */}
        <div
          onMouseEnter={() => focusMode && openLeftPeek()}
          onMouseLeave={() => focusMode && scheduleCloseLeft()}
          className={
            "lex-no-print group absolute left-0 top-0 z-10 flex h-full w-6 items-center justify-center bg-hairline/40 transition-colors hover:bg-hairline " +
            (leftVisible
              ? "pointer-events-none opacity-0"
              : "cursor-pointer")
          }
          onClick={handleRailLeftClick}
          aria-label="Show left panel"
          title="Show left panel"
        >
          <ArrowSquareRight
            size={14}
            weight="bold"
            className="text-muted/60 transition-opacity group-hover:text-muted"
          />
        </div>

        <section className="relative flex-1 min-w-0 px-6 pt-4 pb-6">
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
          {transformRunning && (
            <div className="pointer-events-none absolute right-12 top-3 z-10">
              <div className="flex items-center gap-2.5 rounded-full border border-hairline bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur">
                <CircleNotch size={14} weight="bold" className="animate-spin text-muted" />
                <p className="font-sans text-xs text-ink">
                  {activeTool} is running — editing paused
                </p>
                <button
                  type="button"
                  onClick={() => handleToolClick(activeTool)}
                  className="pointer-events-auto rounded border border-hairline px-2 py-0.5 font-sans text-xs font-medium text-ink transition-colors hover:bg-hairline/60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
        <div
          ref={rightPanelRef}
          style={{ width: rightWidth }}
          className={
            "lex-no-print relative shrink-0 overflow-hidden border-l border-hairline transition-opacity duration-200 " +
            (rightVisible ? " " + panelDim : "") +
            (aboutToCollapse === "right" ? " opacity-70" : "")
          }
          onMouseEnter={() => focusMode && openRightPeek()}
          onMouseLeave={() => focusMode && scheduleCloseRight()}
        >
          <aside className="flex h-full w-full flex-col">
          {!focusMode && rightPanelOpen && (
            <div
              onPointerDown={startResize("right")}
              className={
                "absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize transition-all " +
                (aboutToCollapse === "right"
                  ? "w-2.0 bg-amber-500/70 animate-pulse"
                  : resizing === "right"
                    ? "bg-accent/60"
                    : "bg-transparent hover:bg-accent/30")
              }
              title="Drag to resize"
              aria-label="Resize right panel"
            />
          )}
            <ReviewPanel
              editor={editor}
              selectedText={selectedText}
              activeTool={activeTool}
              grammarMatches={grammarMatches}
              checking={checking}
              userResolvedAll={userResolvedAll}
              activeErrorId={activeErrorId}
              aboutToCollapse={aboutToCollapse === "right"}
              onApply={handleApplySuggestion}
              onDismiss={handleDismiss}
              onAcceptAll={handleAcceptAll}
              onDismissAll={handleDismissAll}
              onAddToDictionary={handleAddToDictionary}
              onLocate={handleLocate}
              onCollapse={handleCollapseRight}
              onClear={() => {
                setActiveTool("");
                setGrammarMatches([]);
                setActiveErrorId(null);
                activeErrorRef.current = null;
                setHoveredError(null);
                setTransformResults([]);
                setTransformProgress(null);
                if (editor) {
                  clearGrammarDecorations(editor);
                }
              }}
              transformResults={transformResults}
              transformProgress={transformProgress}
              transformRunning={transformRunning}
              transformStatus={transformStatus}
              transformError={transformError}
              onApplyTransform={applyTransformResult}
              onDismissTransform={dismissTransformResult}
            />
          </aside>
        </div>
        {/* Edge rail — always mounted (visibility toggled via classes, never
            unmounted) so clicking it doesn't remove a sibling DOM node in the
            same commit as the panel's class change, which would make Chromium
            skip the open transition. Click or (in Focus Mode) hover restores
            the panel. Always faintly visible + wider so users can discover it. */}
        <div
          onMouseEnter={() => focusMode && openRightPeek()}
          onMouseLeave={() => focusMode && scheduleCloseRight()}
          className={
            "lex-no-print group absolute right-0 top-0 z-10 flex h-full w-6 items-center justify-center bg-hairline/40 transition-colors hover:bg-hairline " +
            (rightVisible
              ? "pointer-events-none opacity-0"
              : "cursor-pointer")
          }
          onClick={handleRailRightClick}
          aria-label="Show right panel"
          title="Show right panel"
        >
          <ArrowSquareLeft
            size={14}
            weight="bold"
            className="text-muted/60 transition-opacity group-hover:text-muted"
          />
        </div>
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
        onResetDefaults={handleResetDefaults}
        onCheckForUpdates={() => runUpdateCheck()}
        updateState={updateState}
        onClose={() => setSettingsOpen(false)}
      />

      <DictionaryPanel
        open={dictionaryOpen}
        userDictionary={userDictionary}
        onAddWord={handleAddWordToDictionary}
        onRemoveWord={handleRemoveFromDictionary}
        onClose={() => setDictionaryOpen(false)}
      />
      {aiSetupOpen && (
        <AiSetupModal
          onConfigured={refreshAiConfigured}
          onClose={async () => {
            await refreshAiConfigured();
            setAiSetupOpen(false);
          }}
        />
      )}
    </div>
  );
}
