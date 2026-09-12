# Changelog

Lexicon is a local-first writing assistant. No accounts, no cloud document
sync, and no usage costs — bundled grammar and downloaded local AI processing
on supported builds run on your machine by default. Updates, model downloads,
and servers you configure may use the network.

This changelog tracks what is **live** in each release and what is still
**stubbed** (shown in the interface but not yet functional). Stubbed features
are listed so the release reads honestly about what works today.

## v0.11.0 — Browser Extension, 3-Tier Local AI, GPU Acceleration, Deep Proofread & Continue/Expand

Lexicon v0.11.0 is a major milestone that transforms Lexicon from a standalone desktop text editor into a comprehensive writing assistant ecosystem. This release introduces companion browser extensions for Chrome and Firefox, a new Quality local model tier plus upgraded Light and Standard GGUF pins, hybrid Deep Proofread, native GPU acceleration with real-time VRAM telemetry, ghost Continue suggestions and Expand elaboration with added-sentence diffing, customizable keyboard shortcuts, direct LanguageTool integration without GPL wrappers, selectable PDF export improvements, and an empirical 1,050-sentence benchmark suite with Free-tier cloud comparisons.

---

### What's New in v0.11.0:

#### 🌐 Browser Extensions (Chrome & Firefox):
- **Cross-Browser Companion**: Packaged extensions for Google Chrome (unpacked `.zip`) and Mozilla Firefox (`.xpi`), allowing users to bring Lexicon's grammar checking and text transforms into web textareas, inputs, and rich editors.
- **In-Page Squiggles & Floating Suggestions**: Real-time error detection in the active browser tab via `detectEditable.js` and `squiggle.js`, paired with an interactive suggestions card (`suggestions.js`) for one-click fixes.
- **Deep Shadow DOM & ContentEditable Support**: Accurately traverses nested shadow DOM boundaries and complex web editors without trapping keyboard focus.
- **In-Browser Text Transforms**: Highlight text in any web field and select an AI transform (Rewrite, Casual, Friendly, Professional, Formal, Concise) to preview and replace in place.
- **Express in English for the Extension**: The in-page badge panel offers Express in English next to Tone. It phrases highlighted text (up to 600 characters) into six English tones, led by Auto, a faithful translation that keeps the source register, with a tone picker, language badge, and the same Replace selection flow; the popup transform list carries it too. Standard or Quality model required; Light and missing setups get guidance instead of a model call.
- **Match Focus & Smooth Auto-Scroll**: Clicking an issue card smoothly scrolls the web page directly to the underlined text with an animated highlight ping.
- **Dictionary Synchronization**: Personal dictionary additions sync bidirectionally between browser extensions and the desktop backend over the same-device loopback API.
- **Intelligent Offline Detection**: Extension status badge displays an alert (`!`) when the desktop backend is unreachable rather than reporting a false-positive active state.
- **Pause Proofreading & Per-Site Disable**: Extension popup toggles to pause proofreading globally (rewrites stay available) or disable Lexicon on the current site, with settings persisted in extension storage.
- **Keyboard Shortcut (`Alt+Shift+L`)**: Manifest command `lexicon-proofread` proofreads the focused text field from the keyboard on Chrome and Firefox.
- **Shared Lex Status System (`lexStatus.js`)**: Consistent status icons and labels across the extension popup and suggestion UI (idle, checking, issues, all clear, no connection, disabled, error).
- **Report / Feedback Affordance**: Extension popup includes a clear path to report issues; Settings → About & Feedback lists Chrome and Firefox extension packages.
- **Desktop Handshake**: Backend CORS allowlist for pinned extension origins plus a health-check endpoint so the extension can confirm the local Lexicon sidecar is reachable.
- **Run Deep Proofread in the Badge Panel**: every All clear offers a local-AI clarity and flow pass over the full field (chunked for long text), with clarity rows styled distinctly from grammar rows in the same list. A run that finds nothing says so instead of going silent.
- **Deep Proofread Auto-Run Toggle (off by default)**: a new popup setting auto-runs the deeper check after an accepted fix. Dismissals never auto-run.
- **Popup Engine Readout**: the popup header names the active engine (for example Standard · GPU, Ollama, or LM Studio) and hides itself when the backend is unreachable or unconfigured.
- **Draggable Suggestion Panel**: the badge panel header carries a Phosphor grip handle. Drag the panel anywhere; it keeps its offset, follows the field on scroll, survives re-renders, and clamps so the header stays reachable.
- **Scroll-True Squiggles**: textarea underlines now compensate page and field scroll, so they track the text while scrolling and stay visible on scrolled pages instead of drifting off-screen.
- **Extension Follows the App Language**: the extension checks the proofreading language saved in the desktop app (German in the app means German in the extension) for keystroke checks, Tone rewrites, and Deep Proofread, falling back to American English against older backends.

#### 🧠 3-Tier Local LLM Architecture & Hybrid Deep Proofread:
- **New Quality Tier + Light/Standard Model Upgrades**: v0.11.0 introduces a third **Quality** download tier and replaces the previous Light and Standard GGUF pins with stronger curated models. Legacy Light/Standard files can be verified and cleaned up after a safe migration.
- **3 Curated Model Tiers**:
  - **Light Tier**: Replaces the previous Light pin with **MiniCPM5-1B** (Q8_0, ~1.15 GB) for fast local rewrites on low-power devices and laptops.
  - **Standard Tier**: Replaces the previous Standard pin with **Qwen3.5-4B** (Q4_K_M, ~3.01 GB) as the default balance of speed, fluency, and contextual reasoning.
  - **Quality Tier**: **New tier** pinned to **Qwen3.8-27B** (UD-Q4_K_M, ~16.5 GB) for precision and nuance when you want maximum local accuracy.
- **Hybrid Deep Proofread Engine (`deepProofread.js`)**: Executes deterministic LanguageTool checks first as a baseline, followed by progressive 500-token chunked local LLM analysis.
- **Semantic Polarity Guard**: Automatically rejects candidate edits that drop or invert negative polarity words (*not*, *never*, *hardly*, *barely*) without rule justification, eliminating semantic reversal errors.
- **Greedy Decoding & Anti-Churn Filters**: Enforced `temperature: 0.0` to eliminate stochastic hallucinations on clean text. Blocked preposition cycling, phrase-level synonym churning, and adverb shuffling that alter style without correcting grammatical errors.
- **Multilingual Deep Proofread (`languageSupport.js`)**: Language-specific prompts, language family categorization, and localized negative polarity filters for non-English text.
- **Permissive Model JSON Parsing**: More tolerant parsing of model metadata / structured edit payloads so imperfect LLM JSON is less likely to discard valid suggestions.
- **Automated Verification & Safe Migration**: Model upgrade system verifies GGUF magic bytes and executes a 1-token test inference via `llama_cpp` before safely cleaning up legacy Light/Standard model files.
- **Model Manager UI (`ModelManager.jsx`)**: Responsive 3-column tier grid with equal-height cards, compact Phosphor action icons (`TrashSimple`, `ArrowsClockwise`), and color-coded status dots for bundled / Ollama / LM Studio / unconfigured states.
- **Gold vs Purple Suggestion Badges**: Deterministic grammar/spelling cards use warm gold/amber badges; AI clarity and Deep Proofread suggestions use purple badges with a sparkle affordance and purple dotted underlines in the editor.
- **Disabled Model Reasoning**: Transforms disable thinking (`think: false` / `enable_thinking: false`) and strip leaked `<think>` blocks so rewrites stay faster and free of reasoning chatter.
- **Bundled Backend Load Resilience**: Retries model load with `use_mmap=False` when mmap/permission failures occur, surfaces clear `Engine failed to load model` errors, and enables macOS `com.apple.security.cs.allow-jit` so llama.cpp can initialize under the app sandbox.
- **Subsuming Clarity Rewrites**: an AI clarity rewrite now absorbs the grammar cards it fully covers instead of stacking behind them. Dismissing the rewrite restores the covered cards; accepting it clears both. Covered spans track later edits so follow-up dismissals stay accurate.
- **Opt-In Auto Re-Check**: Deep Proofread and regular Proofread each get a persisted auto re-check toggle (off by default) that chains one verification pass after fixes empty the list. Dismissals, cancels, and errors never chain. Proofread now waits for a manual rescan by default, with Check again buttons in both empty states.
- **Analysis Heading Info**: hovering the info mark by the Analysis heading explains when to use fast Proofread while writing versus the slower Deep Proofread clarity pass for finished drafts.

#### ⚡ Hardware Acceleration, Diagnostics & Accelerator Inventory:
- **Dedicated Hardware Tab (`HardwareTab.jsx`)**: Hardware diagnostics and settings panel displaying CPU compatibility with instruction set badges (x86_64, AVX, AVX2, AVX512), system RAM and VRAM utilization, and accelerator inventory.
- **Comprehensive Hardware & NPU Detection (`inference.py`)**: Native discovery of dedicated GPUs, integrated GPUs (iGPUs), and Neural Processing Units (NPUs) across Windows, macOS, and Linux without third-party dependencies:
  - *Dedicated GPUs*: Discovers discrete graphics cards (NVIDIA GeForce/RTX, AMD Radeon RX/Pro, Intel Arc dGPUs). Merges authoritative `nvidia-smi` telemetry to bypass Windows WMI 4GB 32-bit integer limits and report true physical VRAM.
  - *Integrated GPUs (iGPUs)*: Classifies processor graphics (such as AMD Radeon Graphics and Intel Iris Xe / Arc iGPUs) with dedicated VRAM allocation and shared system memory notices.
  - *Neural Processing Units (NPUs)*: Detects on-die AI compute accelerators including Intel AI Boost, AMD NPU / IPU, Qualcomm Hexagon, and Apple Neural Engine via PnP `ComputeAccelerator` queries.
  - *Clean, Distraction-Free Presentation*: Systems without an NPU cleanly omit the NPU card and subtitle reference, keeping the interface uncluttered for non-technical users.
- **Compute Offload Controls**: Per-device toggle (OFF / ON) and a **Limit Model Offload** toggle that locks layers to dedicated VRAM, preventing overflow into slower shared system memory and keeping remaining model layers on CPU.
- **Dynamic VRAM Layer Offloading**: Automatically calculates optimal `n_gpu_layers` based on model context size and free VRAM headroom, preventing out-of-memory crashes while maximizing generation speed.

#### ⌨️ Customizable Keyboard Shortcuts System:
- **Dedicated Shortcuts Manager (`shortcuts.js`)**: Complete keyboard shortcut customization panel under Settings with modifier parsing (`Ctrl`, `Cmd`, `Alt`, `Shift`) and conflict detection.
- **Application Commands**: Customizable shortcuts for Trigger Proofread, Accept Suggestion, Dismiss Suggestion, and Toggle Settings.
- **Editor Commands**: Remappable formatting shortcuts for Bold, Italic, Underline, Strikethrough, Code, Headings 1 through 6, Lists, Blockquotes, Undo, and Redo.

#### 🔍 Rule-Based Grammar & Style Engine Enhancements:
- **Direct LanguageTool HTTP Client**: Removed the `language-tool-python` GPL wrapper dependency. Lexicon now communicates directly with the local LanguageTool Java server via its own lightweight, asynchronous HTTP client.
- **Standalone LT 6.8 Installer**: Added an automated installer for source checkouts that downloads LanguageTool 6.8 and verifies its SHA-256 archive checksum before extracting.
- **LanguageTool Picky Mode**: Configured LanguageTool requests with `level=picky` for comprehensive grammatical, stylistic, and punctuation coverage.
- **Proper-Noun Spelling Shield**: Suppresses mid-sentence TitleCase spelling false positives (names and entities) while still flagging sentence-initial issues and common dictionary typos.
- **POS Lite Heuristic Engine**: Added lightweight part-of-speech tagging to accurately resolve tricky subject-verb agreement across bare plurals and collective nouns.
- **Expanded Grammar Enhancement Suite (`grammar_enhancements.py`)**:
  - *Confusion Pairs & Homophones*: Catches common mix-ups including their/there/they're, affect/effect, complement/compliment, loose/lose, and principal/principle.
  - *Number-Based Articles & Bare Plurals*: Detects *a/an* before numeric phrases and pairs bare plural subjects with plural verbs.
  - *Double Negatives*: Detects and corrects constructions such as *"don't know nothing"* and *"can't hardly"*.
  - *Punctuation Correction*: Flags missing sentence terminators, mismatched brackets, and comma splices.
  - *Mass Nouns & Stative Verbs*: Flags improper pluralization of uncountable nouns (*"informations"*, *"furnitures"*) and improper progressive usage of stative verbs (*"I am knowing"*).
  - *Hedging, Fillers & Weak Verbs*: Highlights unnecessary conversational hedges and suggests strong, direct active verbs.
- **Long-Sentence & Hard-Break Detection**: Prose quality checks flag sentences over ~25 words and treat hard line breaks as sentence boundaries.
- **Smarter Sentence Replacements**: When applying suggestions, Lexicon can replace a full sentence span when the edit is a rewrite rather than a tiny local patch.
- **UTF-16-Safe Match Offsets**: Grammar enhancement offsets use UTF-16 units so emoji and other multi-byte characters stay aligned with the editor.
- **Context-Aware Grammar Scanning & Caching (`grammarScan.js`, `grammarCache.js`)**: Implemented paragraph-level hashing with cache hit/miss telemetry, skipping checks for untouched paragraphs during continuous writing.

#### 📄 Export & Desktop Status:
- **Selectable PDF Export Preview**: Export flow adds a clean preview before save. Windows uses WebView2 native PDF rendering with browser headers/footers disabled; macOS and Linux continue through system print preview.
- **Clearer PDF Export Guidance**: Export options explain how to keep selectable text and improve failure messaging when a destination cannot preserve it.
- **Shared Lex Status in the App**: Review and related surfaces use the same Lex status language/icons as the extension for proofread and AI states.

#### 🤖 External AI Providers (LM Studio & Ollama):
- **LM Studio Integration**: Full support for LM Studio via its local OpenAI-compatible API (`localhost:1234`), custom server URLs, and Bearer API key authentication.
- **Model Auto-Detection**: Detects available and currently loaded models in LM Studio and Ollama, displaying loaded model status in the Model Manager.
- **Streamed Responses & Request Cancellation**: Streamed token generation for Ollama and LM Studio transforms, backed by `_start_transform_job` / `_remove_transform_job` request IDs for instant cancellation.

#### 📊 Empirical 1,050-Sentence GEC Benchmark Suite:
- **Authentic Evaluation Corpus (`gecFluencyBenchmark.json`)**: 1,050 carefully curated sentences across JFLEG (fluency and naturalness), BEA-2019 (grammatical error correction), and LOCNESS (clean native-speaker controls to measure false-positive rate).
- **Deterministic Evaluation CLI (`npm run benchmark:gec`)**: Standardized benchmark runner computing Precision, Recall, $F_{0.5}$ (weighting precision 4x), and Clean Sentence FPR.
- **Interactive Public Benchmark Showcase (`website/benchmark.html`)**: Interactive web dashboard featuring Pareto efficiency frontiers (speed vs. accuracy), leaderboard/matrix views, and head-to-head comparisons against publicly available Free Grammarly and QuillBot interfaces under a disclosed protocol.
- **Comparative Disclaimers**: Benchmark page and Terms of Service document Free-only testing, method limits, and that results are suite-specific independent evaluations (not vendor affiliation or paid-SKU claims).

#### 🛡️ System, Desktop, Website & Compliance Polish:
- **Desktop Autostart**: Added an option to start Lexicon automatically with the operating system, minimizing to the system tray for instant background availability.
- **Cross-Platform Process Termination**: Replaced Windows-specific `taskkill` with targeted process-tree termination for the Java LanguageTool process.
- **Third-Party License Notices (`THIRD_PARTY_NOTICES.md`)**: Comprehensive license disclosures for LanguageTool 6.8, the bundled JRE, frontend and Rust dependencies, and browser extension libraries. Release packaging includes LICENSE and notices in installers and extension packages.
- **LanguageTool Independence**: Explicit documentation clarifying that Lexicon is an independent, local-first project not affiliated with LanguageTool.
- **Paper Texture & Light-Theme Surfaces**: Applied `lex-paper-surface` across dialogs, popovers, editor surfaces, and menus; theme-aware skeleton shimmer on Warm Cream / Linen / Newsprint; light-theme popover and portal coverage (including body-mounted slash-command menus); CSS nesting / `@layer` cleanup to silence stylesheet warnings while keeping Plain White and Dark Slate behavior intact.
- **Settings Navigation & Copy**: Moved **Lex's Engine** higher in the Settings tab order and clarified the local-processing blurb so built-in proofreading and local AI stay on-device, the extension only talks to the app on this computer, and network use is limited to model downloads, updates, or an external AI server you configure.
- **Brand & Asset Refresh**: Replaced generic icons with the official Lex brand mascot avatar, refined website navigation, and added Discord links across README, app, and site.
- **Mobile Hamburger Drawer**: Marketing site uses a hamburger nav toggle that opens a mobile drawer for primary links across homepage, benchmark, privacy, and terms pages.
- **Website Extension & Install Guidance**: Marketing site documents the browser extension beta, FAQ entries, and Windows SmartScreen / macOS Gatekeeper warnings for unsigned builds.
- **Privacy & Terms Updates**: Privacy Policy and Terms of Service updated for browser-extension loopback use, shared dictionary sync, local GPU/hardware display (not sent to Lexicon), Hugging Face model downloads, optional external AI endpoints, and benchmark comparative claims.

#### ✍️ Express in English (Multilingual Transcreation):
- **Six Tones From Any Language**: Write a short thought in Spanish, German, French, Chinese, Hindi, or plain English and get back natural English in six voices, starting with Auto, a faithful translation that keeps the source register with no tone picked, plus Professional, Casual, Friendly, Formal, and Concise in a single local-model pass (Standard or Quality tiers).
- **Two Ways In**: Run it from the sidebar under Refinement or straight from the selection bubble. Selections up to 600 characters run directly; longer picks get a nudge to shorten, and an empty selection opens a paste-and-Run card.
- **Replace in One Undo**: Replace Selection swaps the exact highlight in a single step, so one Ctrl+Z (Cmd+Z on macOS) restores the original, keeps bold and italics, and leaves the cursor right after the new text. Copy includes brief confirmation feedback.

#### 🔄 Engine Status & Switching You Can Trust:
- **Honest Tier Switching**: Picking a downloaded tier now shows an explicit "Switching to…" state while the choice saves, and the "installed and active" label follows the saved preference instead of the click, so the panel can no longer contradict itself. The save completes before the status refresh, which ends the old need to click a tier twice.
- **Instant Status on Reopen**: Lex's Engine reopens with the last known answer painted immediately and re-checks quietly in the background. Behind it, AI status responses are cached for a minute with concurrent requests shared and automatic invalidation on any model change, so the "Checking AI Status" spinner is gone in the common case.
- **Engine at a Glance**: The top bar now names the active engine (for example Standard · GPU, Ollama, or LM Studio) next to the language button. Selecting it jumps straight to Lex's Engine.
- **Set Up AI Goes Direct**: The Set up AI button and locked AI tools now open Settings on Lex's Engine instead of restarting the 5-step first-run wizard (which still appears on its own for brand-new installs).

#### Language Consistency:
- **AI Keeps the Draft Language**: Tone rewrites, Rewrite, Concise, summaries, and custom tools now name the selected language outright ("Keep the text in Spanish. Do not translate it into English or any other language.") so small models stop translating non-English drafts. English prompts are unchanged.
- **Switching Language Refreshes Results**: changing the proofreading language re-runs whichever analysis is displayed (Proofread or Deep Proofread) and clears stale cards otherwise, so suggestions always match the selected variant. Failures name the language.
- **Shared Language Preference**: the selected variant persists in the backend alongside the AI preference, so the desktop app and the browser extension check the same language. Switching never unloads the model.

#### ➡️ Continue & Expand (AI Drafting Aids):
- **Continue — Ghost Continuation at the Cursor**: Generates the next 1–3 sentences in the same voice and style without repeating input text. Sends the trailing 800 characters before the cursor with calibrated temperature sampling for natural, context-aware onward text.
- **Calibrated Suggestion Tone Presets**: Replaced uncalibrated 0.7 temperature sampling with a dedicated 3-tier segmented control in Settings → Continue. Lower sampling limits error rate and mid-sentence drift on small local models:
  - **Precise (0.2)**: Conservative, tightly scoped continuation and elaboration for academic, legal, or professional work where accuracy is paramount.
  - **Balanced (0.4, default)**: General-purpose balance of natural flow and dependable coherence.
  - **Bold (0.6)**: Higher creativity taking bigger narrative swings with vivid imagery and varied phrasing.
  Both Continue (ghost text) and Expand (selection diffs) share this calibrated tone scale.
- **Suggestion Length Presets**: Auto (~3 sentences, 120 tokens), Sentence (finishes only the current unfinished sentence, 40 tokens), and Paragraph (about 3 sentences, 300 tokens; starts a fresh follow-on paragraph when the current block already holds ~5+ sentences). Prompts ask, client-side sentence truncation enforces — small-model overshoot is capped, with a 10-sentence backstop for custom prompts.
- **Ghost UI (`continueGhost.js`)**: Faint, non-interactive inline widget with a `Tab to accept` hint that is never serialized. `Tab` accepts in one undo step (winning over list indent), `Esc` dismisses, and any edit or cursor move retires the ghost. Echoed draft-tail repeats (2+ shared words) are stripped so the ghost holds only new words.
- **Many Ways to Continue**: Toolbar Continue button (`ArrowRight` icon with working state), slash `/continue`, and customizable shortcut `Mod+Alt+N`. Manual runs route to Lex's Engine setup when AI is unconfigured; idle auto-runs stay silent.
- **Opt-In Auto Continue (off by default)**: Suggests onward text after a brief pause in typing. Delay slider runs 1–60s in 1s steps (default 10s); each edit reschedules, manual runs and dismissals cancel the wait.
- **Expand — Elaborate the Selection**: Expands highlighted text with more detail plus one concrete example or reason while preserving meaning, facts, names, and voice. Bare-cursor invocation falls back to the current paragraph so the shortcut always has something to work with. Inherits the active Suggestion Tone preset for consistent project voice.
- **Expand Entry Points**: Selection bubble Expand button, Refinement card flow (`Expand` tool), and customizable shortcut `Mod+Alt+E`.
- **New Settings → Continue Tab**: Segmented controls for **Suggestion Length** (Auto / Sentence / Paragraph) and **Suggestion Tone** (Precise / Balanced / Bold), an Auto Continue toggle, an Auto Continue Delay slider (1–60s), and accessible Base Prompt editors for Continue and Expand. Choices persist in `localStorage` (`lexicon:continueTemperature`, `lexicon:continueLength`, etc.), participate in Settings search with keyword aliases, and reset cleanly via Reset to Defaults.
- **Reusable Built-In Prompt Editor**: `BuiltinPromptEditor` in Custom Actions stays in sync with the Continue tab via `lexicon:tools-changed`; Continue/Expand are hidden from the generic Built-in list to avoid duplication.
- **New Shortcuts**: Customizable app-scoped `Continue writing` (`Mod+Alt+N`), `Expand selection` (`Mod+Alt+E`), and `Express in English` (`Mod+Alt+X`), all searchable in Settings → Shortcuts with keyword aliases.
- **Transform Plumbing**: `useTransform` passes through `temperature` and `maxTokens` end-to-end to `/transform` and local inference backends, and Expand cards carry `sourceText` through chunked runs for accurate diffing.

#### 🔍 Suggestion Diff Popover & Multi-Part Fixes:
- **Diff Popover for Rewrite-Class Tools** (`DiffPopover.jsx` + `wordDiff.js`): Rewrite, all nine tones, Concise, and Expand results open in a centered modal with Original | Suggestion columns (stacked on narrow screens), inline red-strike/green word diffs via token-LCS alignment, and Apply / Dismiss / Esc / backdrop-close. The panel shows a compact button-card (tool badge, preview, Review + Dismiss) that opens it; clearing results retires an open popover. Summary-class tools keep their result cards.
- **Multi-Part Apply & Dismiss** (`transformCards.js`): dismissing one chunk removes only that card, and each apply measures the real document delta so later chunks shift into place — sequential applies in any order land correctly instead of writing into stale ranges.

---

## v0.10.3 — Hotfix: Windows Bundled JRE Path Crash

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.10.3/Lexicon_0.10.3_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.10.3/Lexicon_0.10.3_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.3)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.3)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

### What's Fixed in v0.10.3:

- **Windows `\\?\` Java Path Crash**: v0.10.2 correctly put the bundled JRE on `PATH`, but some packaged launches then invoked Temurin as `\\?\C:\…\java.EXE`. OpenJDK treats that argv[0] as fatal (`jimage file name is null`, exit 1) during `java -version`, so proofreading never started and Review showed a grammar-engine error. Lexicon now strips Windows extended-length prefixes before spawning Java.
- **JVM Flags Scoped to LanguageTool Server**: Memory/GC flags (`-Xms` / `-Xmx` / G1) are only injected into the LanguageTool HTTP server process — no longer into `java -version` compatibility probes.
- **Cross-platform Safe**: Path-prefix stripping is a no-op on macOS/Linux; PATH wiring and server-only flag injection remain valid on all platforms.
- **Rollback Fallbacks**: Offline Previous Releases list is now **v0.10.2**, **v0.10.1**, and **v0.9.1**.

---

## v0.10.2 — Multi-Language Proofreading, Onboarding Polish & Dev API Fix

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.10.2/Lexicon_0.10.2_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.10.2/Lexicon_0.10.2_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.2)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.2)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

### What's New & Fixed in v0.10.2:

#### 🌐 Multi-Language Proofreading:
- **49 Languages & Dialects**: Shared `languages.js` catalog for Settings and Onboarding, covering every LanguageTool 6.8 grammar locale Lexicon exposes — English variants pinned at the top, all others sorted alphabetically (including Catalan Balearic/Valencian, Portuguese Angola/Mozambique preAO, Spanish voseo, Simple German, and more).
- **Searchable Language Dropdown**: Replaced the short native `<select>` with a searchable picker that shows display names and LanguageTool codes.
- **Relevance-Ranked Search**: Typing codes like `es` or `ta` now surfaces Spanish and Tamil first (exact code → code prefix → name prefix → word start → loose substring), so mid-word noise like “States / Catalan / Chinese” no longer buries the intended language.
- **Catalog Tests**: Added `languages.test.js` covering count, uniqueness, English pin order, alphabetical labels, official naming for voseo/preAO/Swiss/Simple German, and exclusion of LibreOffice aliases plus spellcheck-only Norwegian.
- **Language Info Tooltip**: Settings and Onboarding language labels include an info icon asking users to report Lexicon implementation issues (language not loading/applying), not LanguageTool grammar-rule quality.

#### 🧭 Onboarding Polish:
- **Beta Updates Opt-In**: Final onboarding step now includes a “Receive Beta Updates” toggle (same `lexicon:betaOptIn` preference as Settings) plus a feedback link.
- **Faster Modal Close**: Onboarding finish/close no longer awaits AI refresh before dismissing the modal, so the wizard closes immediately.
- **Paper Texture Beta Badge**: Onboarding Paper Texture now matches Settings with the Beta badge and edge-case feedback tooltip.

#### 🔧 Desktop Dev / Sidecar Reliability:
- **Tauri Always Uses Port 18000**: `api.js` now routes Tauri runtime (including `tauri dev`) to the sidecar on `127.0.0.1:18000`, so a website preview or other process on port 8000 can no longer steal `/ai/status` and produce false CORS/404 failures. Bare browser Vite still expects uvicorn on 8000.
- **Bundled JRE on PATH (Windows grammar-engine fix)**: Fixed “Grammar engine unreachable” with `/grammar/check` returning HTTP 500 on Windows installs that have no system Java. Lexicon's direct LanguageTool HTTP client now prepends the bundled `jre/bin` to `PATH` in the Tauri sidecar environment, the frozen sidecar launcher, and immediately before starting the Java server.
- **Correct Bundled JRE Lookup**: The sidecar launcher previously looked for `jre` *inside* its own folder, but the installer ships `jre` as a sibling resource of `lexicon-backend`, so the bundled runtime was never detected by the backend itself. It now resolves either layout and verifies the `java` binary actually exists.
- **Actionable Engine Errors**: `/grammar/check` now returns a `503` with a JSON `detail` (for example, a missing Java runtime or LanguageTool server JAR) instead of an unhandled `500`, and the Review panel surfaces a targeted recovery hint rather than a generic offline message.

#### ↩️ Rollback Catalog:
- **Fallback Releases**: Previous Releases & Rollback offline fallback list is now **v0.10.1**, **v0.9.1**, and **v0.8.5**.

#### 🌐 Website:
- Trust strip **0 Ads** → **45+ Languages**.
- Removed the outdated “Appearance presets arrive in v0.10.0…” disclaimer (and its unused CSS).

#### 🔤 Typography & Paper Engine (v0.10 Feature Suite):
- **Typography Presets**: Switch between Default (System Sans), Editorial (Newsreader Serif), Modern (Inter Sans), and Monospace (JetBrains Mono) with instant live rendering.
- **Paper Surface Textures**: 5 canvas textures with customizable page colors and surround chrome.
- **Accessibility & Reading Modes**: Built-in Bionic Reading mode and OpenDyslexic font support.
- **Previous Releases & Rollback**: Dynamic version history list in Settings -> About & Feedback.
- **Automated Beta Distribution**: Built-in `beta.json` manifest support for beta release channels.
- **Onboarding Studio Overhaul**: Added v0.10.0 related customization options.

---

## v0.10.1 — Typography, Paper Textures, Accessibility & Onboarding Studio

### Quick Downloads:

- 🪟 **[Windows x64 Setup](https://github.com/AashishH15/Lexicon/releases/download/v0.10.1/Lexicon_0.10.1_x64-setup.exe)**: Standard installer for modern 64-bit Windows PCs (Intel / AMD).
- 🍏 **[macOS Apple Silicon DMG](https://github.com/AashishH15/Lexicon/releases/download/v0.10.1/Lexicon_0.10.1_aarch64.dmg)**: For modern Apple Silicon Macs (M1, M2, M3, M4 chips).
- 🐧 **[Linux x64 DEB](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.1)**: Debian package (`.deb`) for 64-bit Linux distributions (Ubuntu, Debian, Mint, Pop!_OS).
- 📦 **[View All Assets & Checksums](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.1)**: Complete list of installers including ARM64 Windows, x86 Windows, Intel macOS, and Linux x64 DEB.

### What's New & Fixed in v0.10.1:

#### 🎨 Onboarding Studio Overhaul:
- **Spacious 5-Step Flow**: Expanded Lexicon Setup modal into a clean 5-step onboarding wizard.
- **In-Card Live Text Previews**: Added live typography preview boxes showing authentic `JetBrains Mono`, `Inter`, `Newsreader`, and `Geist Sans` directly inside option cards.
- **Accessibility Previews**: Added live Bionic Reading and OpenDyslexic preview boxes.
- **Paper Texture Cards**: Added color swatch dots and active checkmark badges for `Plain White`, `Cream`, `Linen`, `Newsprint`, and `Dark Slate`.
- **Dark Mode Contrast**: Hardened WCAG contrast for step badges and action buttons across all themes.

#### 🔤 Typography & Paper Engine (v0.10 Feature Suite):
- **Typography Presets**: Switch between Default (System Sans), Editorial (Newsreader Serif), Modern (Inter Sans), and Monospace (JetBrains Mono) with instant live rendering.
- **Paper Surface Textures**: 5 canvas textures with customizable page colors and surround chrome.
- **Accessibility & Reading Modes**: Built-in Bionic Reading mode and OpenDyslexic font support.
- **Previous Releases & Rollback**: Dynamic version history list in Settings -> About & Feedback.
- **Automated Beta Distribution**: Built-in `beta.json` manifest support for beta release channels.

> For more details about v0.10.0, check the [v0.10.0 release page](https://github.com/AashishH15/Lexicon/releases/tag/v0.10.0)
---

## v0.10.0 — Typography, Theme Presets, & Accessibility Additions

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

- **Local Bundled Fonts (No Font Network Requests)**:
  - Bundled `Newsreader.woff2`, `Inter.woff2`, `JetBrainsMono.woff2`, and `OpenDyslexic.woff2` locally under `src/assets/fonts/`.
  - Removed all external Google Fonts API network calls (`fonts.googleapis.com` / `fonts.gstatic.com`). All custom typefaces render from bundled files without font requests or font-provider connection metadata.

- **Bundled LanguageTool Engine (Out-of-the-Box Offline Proofreading)**:
  - The exact `LanguageTool-6.8` Java engine is now pre-bundled directly into the application sidecar bundle (`lt/`).
  - Fresh installs on Windows, macOS, and Linux run bundled grammar proofreading offline from second zero without triggering background downloads.

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

- **Appearance Settings Panel & Rollback Access**:
  - Dedicated **Appearance** controls in Settings modal with dropdown selectors for Typography Preset, Paper Texture, and Reading Mode.
  - Added expandable **Previous Releases & Rollback** section under Settings → About & Feedback, which dynamically fetches past releases directly from the GitHub Releases API so users can view release notes or download previous installer packages if they encounter regressions.
  - Full persistence across app reboots via `localStorage` with catalog-validated fallback protections.

- **WCAG AA Contrast & Accessibility Verification**:
  - Upgraded secondary muted text (`#787774` → `#5F5E5B`) to clear WCAG AA contrast requirements (≥ 4.5:1) across all light paper themes and surround shells (achieving 6.48:1 on white and 4.68:1 on Linen).
  - Re-lit Dark Slate placeholders (`#8A8780` → `#9A9791`) and checked task-list items to guarantee high-contrast legibility on dark surfaces.
  - Light-theme placeholder hints and editor content (h6 headings, blockquotes, code comments, empty-draft prompt, pending-math hint) no longer use faded 60% opacity muted (≈ 2.2:1) and now render at full contrast.
  - Added automated math-based contrast assertions (`typography.test.js`) verifying body ink, muted text, surround shells, and placeholders pass WCAG AA contrast thresholds across all 5 themes.

- **Windows High Contrast (Forced-Colors) Support**: Under Windows High Contrast or any forced-colors OS theme, the custom paper backgrounds (Dark Slate included) collapse to system colors automatically. The grain overlay and page shadows, which forced-colors does not strip, are removed, and every focus ring switches to the system `Highlight` outline so focus stays visible in High Contrast Black.

- **WCAG 2.1 Level A ARIA & Keyboard Navigation Upgrades**:
  - **Interactive Panel Rails**: Converted left and right collapse/expand handles to keyboard-focusable `<button type="button">` elements with dynamic `tabIndex` management (`tabIndex={0}` when collapsed), enabling full keyboard navigation (Tab, Enter, Space) and screen reader announcement.
  - **Explicit Input Accessibility Labels**: Added explicit `aria-label` attributes to 12 placeholder-only inputs across `Editor.jsx` (link URL, math LaTeX), `FormatToolbar.jsx` (image URL), `Settings.jsx`, `DictionaryPanel.jsx`, `HistoryPanel.jsx`, `CustomToolsSettings.jsx`, and `DocxExportModal.jsx`.
  - **Modal Dialog Semantics & ARIA Landmarks**: Configured `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to modal titles directly on the inner window cards of all 11 modals across the application (`TemplateGalleryModal`, `Settings`, `ExportOptionsModal`, `DocxExportModal`, `EpubMetadataModal`, `UpdateModal`, `ConfirmModal`, `OnboardingModal`, `DictionaryPanel`, `HistoryPanel`, `CustomToolsSettings`).

- **WCAG 2.1 Level AA Accessibility Enhancements**:
  - **Toggle Track Non-Text Contrast (1.4.11)**: Added a crisp `border border-neutral-300` to unchecked toggle switch tracks in `Toggle.jsx` so control boundaries are clearly demarcated against all paper canvas backgrounds ($\ge 3:1$ contrast).
  - **Non-Color Error Category Indicators (1.4.1)**: Added visual text decorations to error match types in `index.css` (spelling: `underline wavy`, grammar: `underline wavy`, style: `underline dashed`, prose: `underline dotted`) so colorblind users can visually distinguish error categories without relying on color alone.
  - **Voice Control & Speech Recognition Label Matching (2.5.3)**: Matched `aria-label` with visible text on ReviewPanel's "Accept all X suggestions" button (`aria-label={`Accept all ${count} suggestions`}`).
  - **Identify Input Purpose Attributes (1.3.5)**: Added `autoComplete="name"` and `autoComplete="organization"` to author and publisher input fields across export modals (`DocxExportModal.jsx`, `EpubMetadataModal.jsx`).

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
  - **Ask Lex to Style Your Document (Local AI):** Users can describe their document layout in plain English (or tap 1-click quick style chips like *Navy Headings*, *Double Spaced*, *Legal Brief*, *Callout Cards*). Lexicon's local AI generates clean CSS directly into the Custom CSS box.
  - **Custom CSS Support:** Power users can type or edit custom CSS rules directly to personalize exported documents.
  - **Text-Preserving PDF Export:** Shows a clean, selectable preview before saving. Windows uses WebView2's native PDF renderer with browser-generated headers and footers disabled; macOS and Linux continue to use the system print preview. Text selection depends on the selected PDF destination; rasterizing printers cannot preserve it.
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

Lexicon is a private, local-first writing assistant designed for calm, distraction-free drafting. The bundled experience runs directly on your device by default; there are no accounts or cloud document subscriptions. Updates, model downloads, and servers you configure are separate network paths.

#### Key Features Included:

- **Local by Default & Private**: Your drafts, notes, and documents stay on your local hardware during local processing.
- **Local Grammar & Spellchecking**: Instant, deterministic proofreading powered by local LanguageTool (zero LLM latency).
- **Your Local Assistant (Lex)**: Opt-in AI for rewriting, tone adjustments (Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic, Persuasive, Humorous), and document summaries using a downloaded local model on supported builds or an optional Ollama server.
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

Lexicon is a private, local-first writing assistant designed for calm, distraction-free drafting. The bundled experience runs directly on your device by default; there are no accounts or cloud document subscriptions. Updates, model downloads, and servers you configure are separate network paths.

#### Key Features Included:

- **Local by Default & Private**: Your drafts, notes, and documents stay on your local hardware during local processing.
- **Local Grammar & Spellchecking**: Instant, deterministic proofreading powered by local LanguageTool (zero LLM latency).
- **Your Local Assistant (Lex)**: Opt-in AI for rewriting, tone adjustments (Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic, Persuasive, Humorous), and document summaries using a downloaded local model on supported builds or an optional Ollama server.
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
instructions. The default local development setup runs through `localhost`;
configured external servers are separate network paths.
