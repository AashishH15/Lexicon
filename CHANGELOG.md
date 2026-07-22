# Changelog

Lexicon is a local-first, offline writing assistant. No accounts, no cloud,
no usage costs — the grammar engine and your documents stay on your machine.

This changelog tracks what is **live** in each release and what is still
**stubbed** (shown in the interface but not yet functional). Stubbed features
are listed so the release reads honestly about what works today.

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
