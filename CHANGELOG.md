# Changelog

Lexicon is a local-first, offline writing assistant. No accounts, no cloud,
no usage costs — the grammar engine and your documents stay on your machine.

This changelog tracks what is **live** in each release and what is still
**stubbed** (shown in the interface but not yet functional). Stubbed features
are listed so the release reads honestly about what works today.

## v0.10.0 — Typography & Reading Presets

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.10.0/Lexicon_0.10.0_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.10.0/Lexicon_0.10.0_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.0)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.0)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

---

### What's New in v0.10.0:

- **Typography Preset Catalog**: Switch between 4 curated font pairings in real time:
  - **Default**: System sans-serif body with serif headings (`Newsreader` / `Georgia`).
  - **Editorial**: Newsreader serif body and headings for classic literary writing.
  - **Modern**: Inter sans-serif body and headings for clean contemporary prose.
  - **Monospace**: JetBrains Mono body and headings for technical drafting.

- **100% Local Bundled Fonts (Zero Network Privacy)**:
  - Bundled `Newsreader.woff2`, `Inter.woff2`, `JetBrainsMono.woff2`, and `OpenDyslexic.woff2` locally under `src/assets/fonts/`.
  - Removed all external Google Fonts API network calls (`fonts.googleapis.com` / `fonts.gstatic.com`). All custom typefaces render 100% offline with zero external network connections or IP telemetry.

- **Bundled LanguageTool Engine (Out-of-the-Box Offline Proofreading)**:
  - The exact `LanguageTool-6.8` Java engine is now pre-bundled directly into the application sidecar bundle (`lt/`).
  - Fresh installs on Windows, macOS, and Linux run grammar proofreading 100% offline from second zero without triggering background downloads.

- **Paper Texture Backgrounds**: Customize the reading and writing canvas with 5 pre-tuned paper surface pairs:
  - **Plain White (Default)**: Crisp `#FFFFFF` page with `#F7F6F3` surround.
  - **Warm Cream**: Warm `#FEFBF0` page with `#F3EEE0` surround.
  - **Linen**: Textured `#F5EFE0` page with `#E2DACD` surround.
  - **Newsprint**: Newspaper-style `#F2F3F1` page with `#E2E4E0` surround.
  - **Dark Slate**: Low-glare `#242424` dark theme with `#1B1B1B` surround and inverted light ink.
  - Includes subtle procedural grain overlays and soft edge drop-shadows.

- **Reading Modes (Bionic & OpenDyslexic)**:
  - **Bionic Reading**: Non-destructive ProseMirror decoration plugin (`.lex-bionic-prefix`) that bolds the leading prefix (~50%) of every word. Code blocks, LaTeX math formulas, and inline code are automatically skipped. Document content and marks remain 100% byte-identical so undo/redo, saving, and grammar highlight offsets are completely untouched.
  - **OpenDyslexic**: Bundled local `OpenDyslexic-Regular.woff2` and `OpenDyslexic-Bold.woff2` fonts (Bitstream Vera license). Swaps the entire writing canvas (headings included) to OpenDyslexic while keeping code blocks monospaced.

- **Appearance Settings Panel**:
  - Dedicated **Appearance** controls in Settings modal with dropdown selectors for Typography Preset, Paper Texture, and Reading Mode.
  - Full persistence across app reboots via `localStorage` with catalog-validated fallback protections.

- **Browser-Style Zoom (Accessibility)**: Full-page zoom is now enabled. Ctrl + Plus / Ctrl + Minus, Ctrl + 0 to reset, Ctrl + mouse wheel, and touchpad pinch gestures all scale the interface exactly like a browser.

---

## v0.9.1 — Hotfix: Backend Engine Startup & macOS Diagnostic Guidance

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.9.1/Lexicon_0.9.1_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.9.1/Lexicon_0.9.1_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.9.1)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.9.1)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

---

### What's New in v0.9.1:

- **Automatic Sidecar Permissions on macOS & Linux**: Rust now inspects Unix executable permission bits (`0o755`) on `lexicon-backend` prior to spawning. If execution bits are missing, `chmod +x` is automatically applied programmatically before execution, fixing `Permission Denied` startup failures on macOS/Linux.

- **Detailed Diagnostic Error Reporting**: The Review Panel warning card now surfaces the exact raw Rust error message (e.g. `Permission denied`, `No such file`, `Access is denied`) under a collapsible **`▸ Show error details`** toggle, eliminating blind troubleshooting for bug reports.

- **Active Engine Reconnection**:
  - **Manual `[ Retry Engine ]` Button**: Added a dedicated retry button to the warning card featuring an animated spinning badge (`Retrying...`) to trigger an immediate connection attempt and sidecar spawn on demand.
  - **8-Second Auto-Reconnect Polling**: Added a background polling loop that retries connection every 8 seconds when offline, automatically clearing the warning card as soon as the sidecar engine responds.

- **Dynamic macOS Gatekeeper Guidance**: When macOS Gatekeeper or quarantine flags block the backend binary, the diagnostic box dynamically parses the user's installation path and formats the exact `xattr -cr` command alongside a direct link to GitHub documentation explaining why the command is safe.

- **Strict Backend URL Targeting**: Removed the speculative 8000↔18000 port fallback from API requests. Requests now always target the configured backend port, restarting the sidecar once if a request fails — eliminating false-success collisions where a request could silently reach the wrong backend.

---

## v0.9.0 — Rich Export Formats & Starter Templates

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.9.0/Lexicon_0.9.0_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.9.0/Lexicon_0.9.0_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.9.0)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.9.0)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

---

### What's New in v0.9.0:

- **Linux x64 Desktop Support**: Lexicon is now packaged for Linux distributions with native `.deb` packages for Debian, Ubuntu, Linux Mint, and Pop!_OS.

- **Built-in Document Template Gallery**: Jumpstart your writing with 1-click starter templates tailored for different writing styles:
  - **Academic Paper:** Pre-structured research layout complete with Abstract, section headers, results data table, LaTeX math formulas, and a references list.
  - **Novel Manuscript:** Classic fiction manuscript format featuring title block, chapter headers, scene breaks (`***`) or (`---`), dialogue, and first-line paragraph indents.
  - **Minimalist Blog:** Clean blog post skeleton featuring a lead paragraph, pull-quote callout box, syntax-highlighted code block, and summary list.
  - **Executive Summary:** Corporate review layout featuring key takeaway callout boxes, metrics table, and interactive action-item task lists.
  - **Visual Selector Modal:** Easily browse templates with card thumbnails, tags, and descriptions. Includes a safety confirmation dialog to prevent accidentally overwriting active work.
  - **Quick Access:** Open the gallery anytime via **Template Gallery…** in the top-right export menu (`ImportExportMenu`).

- **Structured Import/Export Menu**: The Import/Export dropdown is now organized into clear sections — **Import File…**, **Quick Export** (HTML, Plain Text, Markdown — one-click downloads), **Rich Export** (Styled HTML, PDF, EPUB, DOCX — each opens its configuration dialog before generating), and **Templates** (Template Gallery…). All existing import/export flows are unchanged.

- **Professional PDF & HTML Export Themes**: Transform your drafts into beautifully styled documents before printing or exporting:
  - **Four Print Theme Presets:** Choose from **Academic / Formal** (serif font, numbered section headers, page footers), **Novel / Literary** (classic Garamond/Georgia layout, drop caps), **Minimalist / Modern** (sans-serif Inter, bold monochrome accents), or **Executive / Corporate** (navy header bars, card callout boxes, gold rules).
  - **Ask Lex to Style Your Document (100% Offline AI):** Users can describe their document layout in plain English (or tap 1-click quick style chips like *Navy Headings*, *Double Spaced*, *Legal Brief*, *Callout Cards*). Lexicon's local AI generates clean CSS directly into the Custom CSS box.
  - **Custom CSS Support:** Power users can type or edit custom CSS rules directly to personalize exported documents.
  - **Clean Vector PDF Export:** Automatically hides background app interface buttons, removes clutter like browser URLs (`localhost:5173`) and dates, and includes an in-app tip guiding users to save clean, 100% highlightable text PDFs.
  - **Export as Styled HTML:** Export self-contained, beautifully styled `.html` files that preserve your selected design theme when opened in any web browser.

- **Client-Side EPUB Export (eBook Generator)**: Turn any document into a standard ebook with one click:
  - **Standard EPUB 3 Archive:** Generates fully spec-compliant `.epub` files client-side (uncompressed `mimetype` entry first, `container.xml`, content package with manifest/spine, and navigation document) — verified clean with the official W3C EPUBCheck 5.3.0 validator (0 errors / 0 warnings).
  - **Clean XHTML Conversion:** Editor content is converted into well-formed XHTML chapters with self-closing void tags, escaped text, and embedded styling, so headings, quotes, tables, code blocks, and images render beautifully in any ebook reader (Apple Books, Kobo, Calibre).
  - **LaTeX Math Preservation:** Math formulas keep their full LaTeX source (`\(E = mc^2\)`) inside the ebook so no content is lost, even in readers that cannot render KaTeX.
  - **Book Metadata Dialog:** Set Book Title, Author Name, Language (default `en-US`), and Publisher before generating, with a safe slug-based filename derived from the title.
  - **Zero-Impact Bundle Size:** The ZIP packaging engine is lazy-loaded only when you generate a file, keeping the app's main bundle lean.

- **Client-Side DOCX Export with Native Tracked Suggestions**: Export your document as a real Microsoft Word `.docx` file, with grammar suggestions turned into true Word redlines:
  - **Native Tracked Suggestions:** Each unapplied grammar suggestion is exported as an OOXML `<w:ins>` / `<w:del>` revision pair (shared `w:id`, ISO timestamp). Open the file in Microsoft Word and every fix appears as a native redline you can **Accept** or **Reject** one by one — nothing is silently applied.
  - **Configurable Reviewer Attribution:** Redlines carry the name of who proposed the fix. The field starts blank (sample text `Lex` shown as a hint), editable per export, and settable as a persistent **Default Author / Reviewer Name** in App Settings.
  - **Clean or Tracked Export:** One checkbox switches between exporting the document with tracked suggestions or as a clean, fully-applied final copy.
  - **Full Format Fidelity:** Headings, bold/italic/underline/highlight, bulleted and numbered lists, task-list checkboxes, blockquotes, code blocks, tables, and embedded images (base64) all map to native Word styling. LaTeX math is preserved as plain-text formulas.
  - **Zero-Impact Bundle Size:** The DOCX engine shares the same lazy-loaded ZIP chunk as EPUB export, keeping the main bundle lean.

- **DOCX File Import**: Open documents from Word, Google Docs, Apple Pages, or LibreOffice directly in Lexicon:
  - **Native .docx Support:** Import real Word files with headings, bold/italic/underline, bulleted and numbered lists, tables, blockquotes, and embedded images — all converted into the editor and re-exportable in any format.
  - **Tracked Suggestions Accepted:** If the file contains tracked revisions, the accepted (inserted) text is kept and rejected (deleted) text is dropped, so imports read as the final document.
  - **Zero-Overhead Conversion:** The converter is pure client-side JavaScript, lazy-loaded only when you pick a `.docx` file — no backend involvement and no startup slowdown. Corrupted or password-protected files show a clear error dialog instead of failing silently.
  - **Block-Level Image Fix:** Fixed a DOCX export bug where imported images (serialized by the editor as block-level `<img>` elements outside `<p>`) were silently dropped from the exported `.docx`, leaving empty paragraphs in Word. Block images now register as media parts and render as native Word drawings.

- **Beta Release Channel**: Opt in to pre-release builds before they ship to everyone:
  - **Settings Toggle:** Enable **Beta Releases** in **Settings → About & Feedback → Updates** to start receiving pre-release versions. Stable users never see beta builds; beta users can switch back any time (updates only move forward, so you stay on beta until the next stable release is newer).
  - **Channel-Aware Updater:** The in-app updater checks a separate beta manifest (published to the `gh-pages` branch by the release workflow) when the beta channel is enabled, and the normal GitHub `latest.json` otherwise. Beta tags look like `v0.9.1-beta.1` and publish as pre-releases so GitHub's "latest" release always remains stable.
  - **Invite Early:** Beta testers get first access to new features — send them the latest beta build link and ask them to enable the toggle to receive future betas automatically.

## v0.8.5 — Bug Fixes & Stability Improvements

### What's New in v0.8.5:

- **Targeted Process Isolation**: Removed global `taskkill /F /IM java.exe` commands from backend process cleanup (`languagetool.py` and `main.rs`). Sidecar shutdown now targets only the specific LanguageTool child process PID and process tree, allowing other Java applications (such as IDEs, Minecraft, or build services) to run concurrently without interference.
- **Link Selection & Range Preservation**: Added explicit text selection range parameters (`from` and `to`) to the link popover state in `Editor.jsx`. Submitting or removing a link now preserves the exact selection range for Tiptap execution.
- **Click-Away Link Popover Dismissal**: Removed automatic hover-off auto-close timeouts from the editor link popover in `Editor.jsx`. The popover remains open while editing or typing and only closes when clicking outside the popover card (click-away) or pressing `Escape`.
- **AI Setup Proofread Request Fix**: Resolved an issue in `App.jsx` where loading sample content after AI setup passed invalid parameters to `runGrammarCheck`, fixing an HTTP 422 Unprocessable Entity validation error.
- **Ollama Model Tags CORS Resilience**: Updated `/ai/status` in `main.py` and `_chat_models()` in `inference.py` to return available Ollama models server-side, and updated `ModelManager.jsx` to consume `s.ollama_models`. Eliminates browser CORS blocks on direct `fetch("http://localhost:11434/api/tags")` calls so model pill buttons render reliably across all environments and WebView sandboxes.
- **Partial-Download Resume Validation**: Added HTTP status verification (`206 Partial Content`) to `_stream_download` in `model_manager.py`. If a proxy or CDN ignores the `Range` header and returns `200 OK`, the engine resets the resume position to 0 and overwrites cleanly (`mode="wb"`), preventing model file corruption caused by appending duplicate bytes.
- **React Rules of Hooks Compliance**: Hoisted all `useState`, `useRef`, and `useEffect` hook calls in `Settings.jsx` above the `if (!open) return null;` guard. Hooks now execute unconditionally on every render cycle, eliminating React `renderWithHooks` warnings and hook mismatch errors when opening or closing Settings.
- **System Default Browser Navigation**: Replaced `window.open` with `openExternalUrl()` in `Editor.jsx` for the link popover **Open link** button (`↗`). External links now launch in your operating system's default browser instead of being silently blocked by Tauri's webview sandbox.
- **Structural Passive Voice Inspection**: Enhanced `detectPassiveVoice` in `proseQualityEngine.js` with structural syntax rules (inspecting compound auxiliaries, explicit `by <agent>` phrases, and stative prepositional complements like `about`, `in`, `with`, `for`). Eliminates false positives on stative predicate adjectives (e.g. *"was excited about"*, *"is interested in"*) without requiring hardcoded wordlists.
- **Network Resilience & Unhandled Rejection Safeguard**: Updated `runGrammarCheck()` in `App.jsx` to log non-abort network errors as warning logs instead of re-throwing `throw error;`. Prevents unhandled promise rejections across button click event handlers when the backend sidecar is temporarily offline or restarting.
- **Offline Backend UI Status Banner**: Added a `backendOffline` state in `App.jsx` and `ReviewPanel.jsx`. When the backend is offline or unreachable, the Review panel displays an amber warning card (*"Grammar engine unreachable. Reconnecting..."*) and the Clarity Score displays `-` instead of misleadingly claiming `100` or *"Every sentence reads cleanly"* during an offline state.
- **Sentence Context Dismissed-Keys & Persistence**: Replaced numeric character offset keying with sentence-and-content signature keying in `App.jsx`. Dismissed suggestions now remain permanently dismissed when typing text above them, never shift onto adjacent words, and persist across application restarts via `localStorage`.
- **Java-Specific Subprocess Popen Isolation**: Replaced broad `.endswith(".exe")` matching in `languagetool.py` with strict `_is_java_executable()` basename verification. Prevents JVM memory flags from being erroneously prepended to non-Java Windows executables (such as `cmd.exe`, `git.exe`, or `ollama.exe`).
- **Production Remote Image CSP Support**: Added `https:` to the `img-src` directive in `tauri.conf.json`. Ensures pasted remote web images and `/image` URLs render cleanly in compiled production builds without being blocked by Tauri's WebView security policy.
- **LocalStorage Quota Exception Safeguard**: Wrapped `localStorage.setItem(storageKey, html)` in a `try/catch` block in `App.jsx`. Prevents unhandled `QuotaExceededError` DOM exceptions when pasting large image Base64 data URLs or long documents.
- **Local Image File Upload Picker**: Added `UploadSimple` to `@phosphor-icons/react` imports and embedded a local file upload button (`<input type="file" accept="image/*">`) inside the image toolbar popover in `FormatToolbar.jsx`. Allows users to browse and insert local image files directly from disk.
- **Block-Level Image Drag-and-Drop**: Updated `handleDrop` in `App.jsx` to resolve `$pos.depth > 0 ? $pos.after(1) : dropPos` and dispatch top-level block transactions directly via `view.dispatch(tr)`. Ensures dragged image files land at valid block positions instead of being rejected inside inline paragraph nodes. Fixed `NaN` CSS top position warning in `FormatToolbar.jsx`.
- **Native Drag-and-Drop Image Support (Windows)**: Added Tauri native event listeners in `App.jsx` to capture OS-level file drag-and-drop events in the Windows WebView2. Added `isImageFilePath` helper and `convertFileSrc` integration to enable native dropping of local image files (e.g., from Explorer) onto the editor.
- **Development Version Alignment**: Synchronized project version strings across `tauri.conf.json`, `Cargo.toml`, and `package.json` to `0.8.5`, matching `CHANGELOG.md` and eliminating version drift in local dev builds (`v0.7.0` / `0.0.0`).
- **Stale JVM Log Cleanup & Ignore Patterns**: Removed untracked JVM crash dumps (`hs_err_pid*.log`, `replay_pid*.log`) and dev logs from `backend/` and `frontend/`, and updated root `.gitignore` to prevent JVM crash logs from cluttering local workspaces.
- **Grammar Cache Hash Docblock Correction**: Updated the key formula docblock in `grammarCache.js` to accurately state `FNV1A64` instead of `XXH64`, resolving a documentation mismatch with `hashUtils.js`.
- **Zero-Dependency 27x Hash Performance Optimization**: Replaced `BigInt` character loop allocations in `hashUtils.js` with Dual 32-bit bitwise `Math.imul()` calculations. Achieves a measured 27.6x speedup (time for 10,000 LRU computeKey ops dropped from 691ms to 25ms) while executing in V8 hardware registers with 0 heap object allocations.
- **Thread-Safe Per-Key Model Download Cancellation**: Replaced single global `_DOWNLOAD_CANCELLED` boolean in `model_manager.py` with a thread-safe `_CANCELLED_KEYS` set and `_CANCEL_LOCK`. Model cancellations now operate strictly per-key (`2b` vs `0.8b`), preventing cross-cancellation and race conditions between concurrent download tasks.
- **Export Style Preset Population Improvement**: Updated preset chip buttons (*Navy Headings*, *Double Spaced*, *Legal Brief*, *Callout Cards*) in `ExportOptionsModal.jsx` to populate the prompt input field without triggering auto-generation. Users can now inspect and customize the preset text before clicking **Style**.
- **AI Style Generation Cancellation & Progress Bar**: Added an `AbortController` cancellation system and a clean single **Cancel** button in `ExportOptionsModal.jsx` (and on `Escape` keypress), allowing users to immediately abort long-running CSS generation HTTP requests. Added a smooth, custom animated progress bar (`.lex-progress-slide-bar` in `index.css`), real-time elapsed seconds ticker, and multi-stage status messaging.

---

## v0.8.0 — Rule-Based Prose Engine, Readability Metrics & AI Active Voice Rewrites

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.8.0/Lexicon_0.8.0_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.8.0/Lexicon_0.8.0_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.8.0)**: Complete list of installers including ARM64 Windows, x86 Windows, and Intel macOS.

---

### Welcome to Lexicon v0.8.0!

Lexicon v0.8.0 introduces high-speed rule-based prose style checking, integrated readability scoring, non-punitive clarity calculations, and full-sentence AI active voice rewrites.

---

### What's New in v0.8.0:

- **Deterministic Prose & Style Engine**: Real-time rule-based scanning that catches passive voice constructions, over 30 common wordy clichés (e.g., *"due to the fact that"* $\rightarrow$ *"because"*, *"in order to"* $\rightarrow$ *"to"*), and repetitive 3+ sentence opener streaks.
- **AI Active Voice Rewrites (Lex Integration)**: Passive voice suggestion cards feature a subtle `✦ Active Voice` button powered by your local LLM. Slices full sentence context and computes exact document offsets (`sentenceOffset` to `sentenceLength`) to cleanly replace the full sentence without leaving duplicate word fragments in the editor.
- **Visual Tone Distribution Line (`ToneChart.jsx`)**: The expanded metrics card in the header now features a clean, horizontal stacked bar chart visualizing your document's composite tone breakdown across detected tone signals.
- **Customizable Document Stats Footer (`DocStats.jsx`)**: Re-architected the document statistics bar into a flexible 2-slot display with real-time Flesch-Kincaid Grade Level, Reading Ease, estimated reading time, speaking time, word count, and character count.
- **Soft Lavender Editor Highlights**: Prose Style suggestions use a subtle inline lavender background (`#F3E8FF` / `#6B21A8`) without wavy underlines, keeping style suggestions visual distinct from grammar yellow and spelling red.
- **Non-Punitive Clarity Scoring**: Re-architected the Clarity Score error ratio calculation to filter out "Prose Style" suggestions. Mechanical errors (spelling, grammar, punctuation) determine the score, ensuring deliberate stylistic choices don't penalize clean copy.
- **Scan Prose & Style Toggle**: New setting under **Settings** $\rightarrow$ **Scan Prose & Style** (persisted to `localStorage` as `lexicon:proseScanEnabled`) allowing writers to turn off style rules for zero-distraction drafting.
- **Unified Card Interaction**: Standardized primary card actions across all suggestions to a clean, single-line **`Accept`** label.
- **Updated Legend**: Review Panel hover legend updated to display `#6B21A8` for Prose Style labeled as `LAVENDER`.
- **Unit Test Suite (`proseQuality.test.js`)**: Added 34 Vitest unit tests covering passive voice detection, cliché matching, repetitive opener streaks, `extractSentenceContext` bounds across punctuation (`.`, `!`, `?`), newlines, readability formulas, and input hygiene (`null`, `undefined`, whitespace).

### Refinements

- **Visual Palette Parity**: Removed wavy underlines from prose decorations so all suggestion types share a clean, unified highlight block pattern.
- **Color Conflict Resolution**: Shifted Prose Style highlights from amber (`#FFECB3`) to soft lavender (`#F3E8FF`) to eliminate visual overlap with standard grammar yellow (`#FBF3DB`).
- **Reset to Default Support**: Restoring default settings in the Settings modal resets `proseScanEnabled` back to `false`.
- **Document-mapping bug fixed**: LanguageTool saw two adjacent blocks touch without punctuation or a newline, i.e. "Lexicon{new line}Lexicon" as a repeated word typo. No longer an issue.
- **Icon update**: Friendly Tone and Share Feedback shared the same icon both have been changed. Friendly -> hand-waving, Share Feedback -> paper-plane.
- **Updated min/max width for sidebars**: Left sidebar can now be resized between 175px and 275px (max) with 100px as collapse. Right sidebar can be resized between 300px and 450px (max) with 100px as collapse. Defaults at min size panels.
- **Math keyboard fix**: Before $...$ wasn't creating the inline math now it does. $...$ for inline, $$$...$$$ for block math.
- **Reworked Settings Menu**: Now the bottom left area is now just a settings button which opens up to an expanded settings menu where multiple subsection settings now live including previous + "Your Dictionary", "History & Draft", and "Feedback" (within About & Feedback). 
- **Ollama detection**: Wasn't properly working or detecting Ollama Server, now it does and also lets you pick which model you would like to use.
- **Search Setting**: Added a way to search in setting menu.

## v0.7.5 — Skeleton Loading, Accessibility, Feedback & Faster Startup

### Skeleton Loading
- While the app is checking your document for grammar issues or applying changes, the Review Panel now shows a gentle animated placeholder instead of sitting blank — so you know something is happening

### Test Suite
- Added automated tests (56 in total) that check the editor, grammar highlights, import/export, and all the behind-the-scenes logic every time a change is made — this means fewer regressions and a more reliable app

### Accessibility
- **Keyboard navigation:** Every button in the toolbar and formatting bar now has a visible focus ring when tabbed to, making it easy to see where you are on the page
- **Screen readers:** The slash menu (the popup that appears when you type "/") now correctly labels itself and its options. The grammar suggestion cards and review panel announce their contents and actions. The editor itself is labeled as a textbox for screen reader users
- **Blind-accessible actions:** Accept, Dismiss, and Add-to-Dictionary buttons on suggestion cards all have descriptive labels. The Accept All, Dismiss All, and Clear buttons in the Review Panel are labeled too

### Share Your Feedback
- A new **"Share Feedback"** button in the sidebar (bottom section, looks like a chat bubble) lets you send us suggestions or report issues — it opens a simple form where you can tell us what you think
- The same link also appears in **Settings**, just below the GitHub link, labeled "Send feedback or report an issue"

### Faster Startup & Loading
- The app now should load significantly faster on startup by splitting itself into smaller pieces that are fetched only when needed
- Settings, Dictionary, History, and AI Setup panels now load only when you open them — not all at once when the app starts
- Syntax highlighting for code blocks loads language definitions on demand instead of downloading all 37 languages upfront
- Math equation rendering styles kick in only when you actually open the math editor
- Overall the main app bundle was reduced from about 1.7 MB to roughly 160 kB — so the app feels snappier to open and navigate

## v0.7.0 — Polished Writing Experience & Privacy Identity

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.7.0/Lexicon_0.7.0_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.7.0/Lexicon_0.7.0_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.7.0)**: Complete list of installers including ARM64 Windows, x86 Windows, and Intel macOS.

---

### Welcome to Lexicon v0.7.0!

Lexicon is a private, local-first writing assistant designed for calm, distraction-free drafting. Everything runs directly on your device; no accounts, no cloud subscriptions, no tracking, and zero data leaving your machine.

#### Key Features Included:

- **100% Offline & Private**: Your drafts, notes, and documents stay strictly on your local hardware.
- **Local Grammar & Spellchecking**: Instant, deterministic proofreading powered by local LanguageTool (zero LLM latency).
- **Your Local Assistant (Lex)**: Opt-in local AI for rewriting, tone adjustments (Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic, Persuasive, Humorous), and document summaries running entirely on your machine or an optional Ollama server.
- **Distraction-Free Workspace**: Rich-text editing with headings, lists, blockquotes, typography rules, slash commands, LaTeX math ($E=mc^2$), resizable side panels, and Focus Mode.
- **Import & Export**: Support for `.md`, `.txt`, `.html` imports and clean PDF / Markdown exports.

---

### What's New in v0.7.0:

- **History & Recents Panel**: A dedicated panel that automatically saves drafts as you write (3s debounced) and captures snapshots before each proofread. Features auto/manual draft toggles, per-item lock/unlock, copy with visual feedback, per-tab Clear actions, and smart history cap that preserves locked items.
- **Custom AI Prompts & User Tools**: Settings UI for defining custom AI tool shortcuts and prompt overrides, giving you control over how Lex transforms your text. You can create up to 5 new AI prompts or edit how exisiting AI Actions behave. You can save distinct tone profiles that steer Lex.
- **Empty-Editor Placeholder Rotator**: When the document is empty, rotating one-liner appears in the editor.
- **Zero-Issue Checkmark Bloom**: When a proofread pass completes with zero issues, a calm `CheckCircle` icon with understated copy ("No issues detected. Your draft is clear.") appears in the Review panel.
- **"Draft Saved" Privacy Signature**: A subtle confirmation appears next to the History button whenever autosave or manual snapshot writes to local storage. Uses a `LockKey` icon with privacy-affirming copy ("saved locally", "draft secured on device"). Collapses to icon-only on narrow sidebar widths.
- **Per-Category Squiggle Legend**: A hover-triggered popover in both the Proofread and AI Results panels explaining each squiggle color — red for Spelling, yellow for Grammar & Punctuation, blue for Style & AI Tone.
- **"Caught It" Pulse**: When a grammar squiggle first appears, a subtle one-shot ring pulse acknowledges the catch.
- **Accept-All / Dismiss-All Fold Animation**: Batch actions no longer snap cards out of existence. Each card folds upward in staggered sequence (45ms per index), shrinking and fading over 280ms. Single-card Accept slides the card right, then collapses the space.
- **Settings Signature**: A quiet identity statement in the Settings modal

### Refinements

- **Category Color System Realigned**: Suggestion card badges and the legend now share a unified color mapping — red for Spelling, yellow for Grammar & Punctuation, blue for Style & AI Tone. Badge matching is case-insensitive and supports substrings.
- **Scroll Jitter Eliminated**: Auto-scroll on card activation now only happens on explicit clicks, not on side-effect re-renders after item deletion. The scroll container uses `overflow-anchor: none` to prevent browser layout anchoring during height collapses.
- **Entrance Animations Disabled on Re-Render**: Remaining cards no longer replay their slide-in animation when a sibling is removed from the list.

### Live in v0.7.0 (from v0.6.0)

- **Editor** — TipTap rich-text canvas with inline grammar squiggles and a slash-command menu.
  - Formatting: bold, italic, underline, strikethrough, highlight, superscript/subscript, inline code, links (inline URL popover).
  - Structure: headings (H1–H6), bullet / numbered / task lists, blockquotes, text alignment, resizable tables, code blocks with syntax highlighting, images, drag handles, empty-draft placeholder.
  - Math: inline (`$...$`) and block (`$$$...$$$`) LaTeX rendered with KaTeX and a live-preview editor.
  - Smart typography: automatic em-dashes, ellipses, and smart quotes.
  - Content auto-saved to `localStorage`.
- **Proofread** — rule-based grammar, spelling, and punctuation checking via LanguageTool (runs locally; no server or Docker needed).
  - Inline squiggles, hover tooltip with an apply action.
  - Review Panel suggestion cards: apply / dismiss individual fixes, Add to Dictionary, Accept all / Dismiss all.
  - Dismissed suggestions stay dismissed across re-runs.
  - Click a squiggle to jump to its card (and vice versa).
- **User dictionary** — add and remove words; ignored words stop being flagged and reappear if removed.
- **Tone read & clarity score** — summary of the draft's tone and a 0–100 clarity score in the Review Panel.
- **Settings** — language picker, font size, line spacing, Focus Mode, custom AI tools, with smart defaults and a one-click Reset to Default. Keyboard-shortcut cheat sheet.
- **Layout** — three-column workspace (Tool Matrix · Editor · Review Panel) with collapsible, resizable side panels and Focus Mode.
- **Import / Export** — import `.txt`, `.md`/`.markdown`, `.html`; export as HTML, Plain Text, Markdown, or PDF (clean "final manuscript" print output).
- **Keyboard shortcuts** — `Ctrl`/`Cmd` + `Enter` to Proofread, accept/dismiss shortcuts, `Esc` / `Mod-,` for settings, and the full formatting shortcut set.
- **Onboarding** — 4-step local-first onboarding wizard covering privacy philosophy, language dialect, Lex AI setup, and sample draft ingestion.

## v0.6.0 - Major Landmark Release: 4-Step Local Onboarding & Complete App Overview

### Quick Downloads (Most Popular Releases):

- 🪟 **[Windows x64 Setup (Most Popular)](https://github.com/AashishH15/Lexicon/releases/download/v0.6.0/Lexicon_0.6.0_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG (Most Popular)](https://github.com/AashishH15/Lexicon/releases/download/v0.6.0/Lexicon_0.6.0_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 📦 **[View All 15 Platform Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.6.0)**: Complete list of installers including ARM64 Windows, x86 Windows, and Intel macOS.

---

### Welcome to Lexicon v0.6.0!

Lexicon is a private, local-first writing assistant designed for calm, distraction-free drafting. Everything runs directly on your device; no accounts, no cloud subscriptions, no tracking, and zero data leaving your machine.

#### Key Features Included:

- **100% Offline & Private**: Your drafts, notes, and documents stay strictly on your local hardware.
- **Local Grammar & Spellchecking**: Instant, deterministic proofreading powered by local LanguageTool (zero LLM latency).
- **Your Local Assistant (Lex)**: Opt-in local AI for rewriting, tone adjustments (Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic, Persuasive, Humorous), and document summaries running entirely on your machine or an optional Ollama server.
- **Distraction-Free Workspace**: Rich-text editing with headings, lists, blockquotes, typography rules, slash commands, LaTeX math ($E=mc^2$), resizable side panels, and Focus Mode.
- **Import & Export**: Support for `.md`, `.txt`, `.html` imports and clean PDF / Markdown exports.

---

### What's New in v0.6.0:

- **4-Step Local-First Onboarding Experience**: Interactive wizard (`OnboardingModal.jsx`) guiding new users through Lexicon's privacy philosophy, language dialect preferences (`en-US`, `en-GB`, etc.), Lex AI assistant configuration, and sample draft ingestion.
- **Interactive Sample Document**: Pre-populated onboarding draft featuring live proofreading squiggles, LaTeX math ($E=mc^2$), and AI rewrite prompts.
- **UI Icon & Aesthetics Refinement**: Phosphor SVG icons (`ShieldCheck`, `PencilLine`, `Robot`, `Confetti`), branded logo visuals, and clean slate paper aesthetic.
- **Process & Type Safety Patches**: Subprocess creation window suppression with `__class_getitem__` type hint safety for Windows sidecar execution.
- **Shared System Prompt Parity Across Inference Backends**: Unified `SYSTEM_PROMPT` constant across bundled GGUF models and external Ollama servers (`v0.5.19`).

## v0.5.19 - Shared System Prompt Parity Across Inference Backends

### Changes Made:

- **Unified System Instructions**: Defined a single module-level `SYSTEM_PROMPT` constant in `backend/inference.py` enforced across both local bundled GGUF models and external Ollama servers.
- **Ollama System Field Inclusion**: Passed top-level `"system": SYSTEM_PROMPT` to Ollama `/api/generate` requests, preventing external models (`llama3`, `mistral`, `deepseek-r1`, `qwen2.5`) from outputting conversational preamble or reasoning chatter.
- **Architectural Prompt Parity**: Refactored `BundledBackend` and `OllamaBackend` to reference the single source of truth constant, guaranteeing complete behavioral parity and preventing prompt drift.

## v0.5.18 - Non-Blocking Startup, Instant Quit & Release Workflow Prioritization

- **Non-Blocking UI Startup**: Backend sidecar startup runs on an asynchronous background thread so the window and `index.html` load instantly (< 1ms) without blocking the OS UI thread.
- **Instant Window Hiding on Quit**: Main window hides (`window.hide()`) on line 1 of the Quit handler so the desktop UI vanishes instantly (< 1ms) while process termination completes silently in the background.
- **Native Window Theme & Boot Optimization**: Configured `"theme": "Light"` and `"backgroundColor": "#f7f7f5"` in `tauri.conf.json` (matching `index.html`), and set Google Fonts to non-blocking loading for instant frame-1 boot screen rendering.
- **Detached Process Cleanup & Console Suppression**: Added silent Java process termination on quit (`taskkill /F /IM java.exe`) and global Windows `CREATE_NO_WINDOW` / `SW_HIDE` subprocess overrides to eliminate console window flashes.
- **Release Workflow Prioritization**: Updated `.github/workflows/release.yml` to prioritize extracting release notes directly from `CHANGELOG.md` first.

## v0.5.17 - Model Memory Mapping, Context Bounds & Paragraph-Level LRU Caching

- **Model Context Window Bounds (`n_ctx = 4096`)**: Reduced local LLM context window from 8,192 to 4,096 tokens, cutting KV-cache RAM/VRAM allocation by 50% (~300–600 MB savings) and doubling prompt evaluation speed.
- **Memory Mapping (`use_mmap = True`)**: Configured OS-level memory mapping for GGUF model weights for near-instant model loading (< 0.5s) and instant physical RAM page reclamation during Tier 1 offloads.
- **Frontend Chunking Budget Alignment**: Updated `TRANSFORM_INPUT_BUDGET` and `TRANSFORM_CHUNK_BUDGET` to 1,800 tokens (~7,200 chars / ~3–4 full paragraphs), with 2,048 max output token headroom.
- **Sub-Microsecond 64-Bit Hashing**: Implemented synchronous `fnv1a64(str)` hashing (< 20 nanoseconds per block) for instant LRU cache key calculations without Promise overhead.
- **Context-Aware Predecessor Keys**: Paragraph cache keys incorporate the preceding paragraph's suffix (`suffix(A, 64)`). Deletions, additions, or merges automatically update predecessor keys and invalidate downstream boundary rules without requiring complex cascade-invalidation code.
- **Differentiated Proofread Triggers**: Live typing auto-checks evaluate only modified/uncached paragraphs; clicking the manual **Proofread** button or pressing `Ctrl`/`Cmd` + `Enter` bypasses the cache to perform a 100% full-document scan.

## v0.5.16 - Memory Tuning, Process Tree Cleanup & Pre-warming

- **Windows Job Object Cleanup**: Bound backend sidecar processes to an OS-level Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`), ensuring `lexicon-backend.exe` and `java.exe` are automatically killed when Lexicon is terminated via Task Manager "End Task".
- **Silent Background Pre-Warming**: Clicking into the editor canvas or focusing the window silently wakes offloaded backend tiers in the background before typing completes.
- **Aggressive Heap Bounds**: Capped JVM heap memory to `-Xms64M -Xmx384M`.
- **G1GC Memory Return Tuning**: Configured `-XX:+UseG1GC` with `-XX:MinHeapFreeRatio=10` and `-XX:MaxHeapFreeRatio=20` to force Java to immediately release unused memory back to the host operating system.
- **String Deduplication**: Enabled `-XX:+UseStringDeduplication` to reduce RAM footprint from repetitive dictionary strings and rule patterns.
- **Locale Filtering**: Initialized LanguageTool specifically for the user's preferred locale (`en-US`, `en-GB`, etc.), skipping unneeded language modules.
- **Markdown Release Notes**: Update modal renders release notes using `marked` with styled HTML formatting for headers, lists, bold text, and code blocks.
- **Automated Updater Manifests**: Updated the GitHub Actions release workflow to extract release notes into `latest.json`.

## v0.3.0 - Grammar-checking Editor working

First tagged snapshot of the non-AI core. The editor, proofreading,
dictionary, settings, and export pipeline are complete and useful on their
own. The AI rewriting and tone tools are present in the toolbar but not yet
connected to a model; clicking one shows a "coming soon" notice rather than
failing silently.

Tagged as a developer preview using the existing `npm` / `uvicorn` run
instructions. It does not yet ship a packaged installer (that is a later
milestone, C39–C41) — running it requires the two commands in the README.

### Live

- **Editor** — TipTap rich-text canvas with inline grammar squiggles and a
  slash-command menu.
  - Formatting: bold, italic, underline, strikethrough, highlight,
    superscript/subscript, inline code, links (inline URL popover).
  - Structure: headings (H1–H6), bullet / numbered / task lists, blockquotes,
    text alignment, resizable tables, code blocks with syntax highlighting,
    images, drag handles, empty-draft placeholder.
  - Math: inline (`$...$`) and block (`$$$...$$$`) LaTeX rendered with KaTeX
    and a live-preview editor.
  - Smart typography: automatic em-dashes, ellipses, and smart quotes.
  - Content auto-saved to `localStorage`.
- **Proofread** — rule-based grammar, spelling, and punctuation checking via
  LanguageTool (runs locally; no server or Docker needed). This is
  **not** an AI feature — it is deterministic rule checking.
  - Inline squiggles, hover tooltip with an apply action.
  - Review Panel suggestion cards: apply / dismiss individual fixes, Add to
    Dictionary, Accept all / Dismiss all.
  - Dismissed suggestions stay dismissed across re-runs.
  - Click a squiggle to jump to its card (and vice versa).
- **User dictionary** — add and remove words; ignored words stop being
  flagged and reappear if removed.
- **Tone read & clarity score** — summary of the draft's tone and a 0–100
  clarity score in the Review Panel.
- **Settings** — language picker, font size, line spacing, Focus Mode, with
  smart defaults and a one-click Reset to Default. Keyboard-shortcut cheat
  sheet.
- **Layout** — three-column workspace (Tool Matrix · Editor · Review Panel)
  with collapsible, resizable side panels and Focus Mode.
- **Import / Export** — import `.txt`, `.md`/`.markdown`, `.html`; export as
  HTML, Plain Text, Markdown, or PDF (clean "final manuscript" print output).
- **Keyboard shortcuts** — `Ctrl`/`Cmd` + `Enter` to Proofread, accept/dismiss
  shortcuts, `Esc` / `Mod-,` for settings, and the full formatting shortcut
  set.
- **Source link** — GitHub icon in Settings opens the project repository.

### Stubbed (UI present, not yet functional)

These toolbar buttons appear and are interactive, but they are not wired to
a model in this build. Clicking any of them shows a "coming soon" notice.
They depend on the local AI inference pipeline, which is planned
but not part of v0.3.0.

- **Refinement** — Rewrite, Concise
- **Tone** — Friendly, Professional, Academic, Formal, Casual, Playful,
  Empathetic, Persuasive, Humorous
- **Structure** — Summary, Key Points, List, Table (AI-generated; the editor's
  manual table/list tools above are live)

### Not in this release

- Bundled or detected local LLM backend (Ollama auto-detect, bundled
  `llama.cpp` model, model download/setup flow).
- AI asisted tools (i.e. Refinement, Tones, Structure)
- Dark mode
- unit/end-to-end tests
- bundle-size optimization.
- Packaged desktop installer and auto-update (Tauri).
- Mobile layout.

### Running v0.3.0

See the README for the backend (`pip install -r requirements.txt`,
`uvicorn main:app --reload`) and frontend (`npm install`, `npm run dev`)
instructions. The app runs entirely offline on `localhost`.
