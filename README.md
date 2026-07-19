<div align="center">

![Lexicon](media/Lexicon.jpg)

# Lexicon: Local-First Writing Assistant

**Open Source • Privacy-First • Offline**<br>
**Fix Grammar, Rewriting & Tone - Your Words Stay on Your Laptop**

</div>

A 20-second tour of what Lexicon is:

![Lexicon](media/Lexicon.gif)

A distraction-free rich-text editor, inline grammar squiggles, and
one-click suggestion cards. All running offline on your own machine.

## Why Lexicon

A local-first AI writing assistant that runs entirely on your machine. No
accounts, no cloud, no usage costs. Inspired by the web
versions of Grammarly and Quillbot, with the kind of writing tools Apple
ships in its "Writing Tools" feature.

The earlier versions were desktop Tkinter apps with weak engines:

- v1 ([GrammarCheck](https://github.com/AashishH15/GrammarCheck)) used LanguageTool for grammar but had no AI rewriting.
- v2 ([Grammar-Checker-v2](https://github.com/AashishH15/Grammar-Checker-v2)) used TextBlob, which is really just a spellchecker.

Both were dated desktop UIs. Lexicon moves to a browser/desktop-based app and pairs a real
grammar engine with a local LLM for rewriting and tone.

## Layout

Lexicon is a three-column workspace:

- **Tool Matrix (left):** the actions panel; Proofread and the AI writing
  tools, plus quick access to your dictionary and settings.
- **Editor (center):** a full rich-text canvas with a formatting
  toolbar, inline grammar squiggles, and a slash-command menu.
- **Review Panel (right):** grammar/clarity suggestion cards you can apply or
  dismiss, a tone read, and a clarity score.

Both side panels can be collapsed, resized, or hidden entirely via Focus Mode
for a distraction-free, full-width editor.

### Writing canvas

A rich, Grammarly-style editor:

- **Formatting:** bold, italic, underline, strikethrough, highlight,
  superscript/subscript, inline code, and links (with an inline URL popover).
- **Structure:** headings (H1–H6), bullet / numbered / task lists, blockquotes,
  text alignment, code blocks with syntax highlighting, images, and tables
  (Google-Docs-style grid picker + full row/column editing).
- **Math:** inline (`$...$`) and block (`$$$...$$$`) LaTeX rendered with KaTeX,
  with a live-preview editor popover.
- **Smart typography:** automatic em-dashes, ellipses, and smart quotes.
- **Slash commands:** type `/` anywhere to open a filterable command menu with
  full keyboard navigation and multi-select mark toggling.
- **Drag handles**, a **placeholder** for empty drafts, and content
  **auto-saved** to `localStorage`.

### Grammar & review

- **Inline squiggles:** LanguageTool errors render as faint red highlights
  directly in the editor, like real Grammarly.
- **Suggestion cards:** hover or click a squiggle to jump to its card in the
  Review Panel; apply or dismiss individual fixes, or **Accept all / Dismiss
  all** in one pass. Dismissed suggestions stay dismissed across re-runs.
- **Tone detection** and a **clarity score** summarize the draft.
- **User dictionary:** add words so they stop being flagged (persisted, with a
  dedicated management panel).

### Import / Export

- **Import:** `.txt`, `.md` / `.markdown`, and `.html` files load straight into
  the editor.
- **Export:** save your document as **HTML**, **Plain Text**, **Markdown**, or
  **PDF**. PDF export uses the browser's print pipeline with a dedicated print
  stylesheet for a clean "final manuscript" page — user highlights are
  preserved, grammar squiggles and app chrome are stripped, and page margins
  are set for a proper document look.

### Settings & shortcuts

- Language picker, font size, line spacing, and Focus Mode, with **smart
  defaults** and a one-click **Reset to Default**.
- Keyboard shortcuts (e.g. `Ctrl/Cmd + Enter` to Proofread, accept/dismiss
  shortcuts, `Esc` / `Mod-,` for settings) with an in-app cheat sheet.

## Running the backend

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The API is then available at http://localhost:8000.

### Grammar engine (LanguageTool)

The backend uses `language_tool_python`, which downloads and runs LanguageTool
locally on first use. No separate server or Docker needed. Java is required
(LanguageTool runs on the JVM); install it from java.com if absent.

To point at an already-running LanguageTool server instead, set:

```
set LANGUAGETOOL_SERVER=http://localhost:8081
```

## Running the frontend

```
cd frontend
npm install
npm run dev
```

The app is then available at http://localhost:5173 (or 5174 if 5173 is busy).

> **Note:** TipTap is pinned to `3.27.4`. When adding a new `@tiptap/*`
> package, install it with `--save-exact @3.27.4` to keep every extension on
> the same version.

## Acknowledgements

Lexicon is built on the shoulders of several super awesome open-source projects and tools:

- **[TipTap](https://github.com/ueberdosis/tiptap):** the headless rich-text editor framework
  (built on ProseMirror) that powers the writing canvas, inline grammar
  squiggles, and formatting toolbar.
- **[KaTeX](https://github.com/KaTeX/KaTeX):** renders the inline and block LaTeX math.
- **[lowlight](https://github.com/wooorm/lowlight):** syntax highlighting for code blocks.
- **[marked](https://github.com/markedjs/marked)** & **[Turndown](https://github.com/mixmark-io/turndown):** Markdown import and export conversion.
- **[Phosphor Icons](https://github.com/phosphor-icons/homepage):** the icon set used across
  the tool matrix, format toolbar, settings, and suggestion cards.
- **[LanguageTool](https://github.com/languagetool-org/languagetool):** the rule-based grammar and
  spell-checking engine (`language_tool_python`) that drives inline squiggles
  and the Proofread pass.
- **[React](https://github.com/facebook/react):** the UI library behind the frontend.
- **[Vite](https://github.com/vitejs/vite):** the build tool and dev server.
- **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss):** the utility-first styling
  layer that implements the Lexicon design system.
- **[FastAPI](https://github.com/fastapi/fastapi):** the Python backend that serves
  the API and the frontend.
- **[Uvicorn](https://github.com/Kludex/uvicorn):** the ASGI server running the backend.
