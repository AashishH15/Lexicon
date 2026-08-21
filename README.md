<p align="center">
  <img src="media/lexicon-logo-windows.png" alt="Lexicon logo" width="150" />
</p>

<h1 align="center">Lexicon</h1>

<p align="center">
  <strong>A local-first writing assistant for clearer drafts.</strong><br />
  Proofread, rewrite, format, and export your work with local processing by default.
</p>

<p align="center">
  <a href="https://lexicon-writer.pages.dev/">Website</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/AashishH15/Lexicon/releases/latest">Download release</a>
  &nbsp;&middot;&nbsp;
  <a href="https://discord.gg/nDCedWH3SV">Report an issue</a>
  &nbsp;&middot;&nbsp;
  <a href="https://discord.gg/nDCedWH3SV">Discord</a>
</p>

<p align="center">
  <a href="https://github.com/AashishH15/Lexicon/releases/latest"><img src="https://img.shields.io/github/v/release/AashishH15/Lexicon?display_name=tag" alt="Latest release" /></a>
  <a href="https://github.com/AashishH15/Lexicon/releases"><img src="https://img.shields.io/github/downloads/AashishH15/Lexicon/total" alt="Total Downloads" /></a>
  <a href="https://github.com/AashishH15/Lexicon/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
  <a href="#download"><img src="https://img.shields.io/badge/supported%20OS-Windows%20%7C%20macOS%20%7C%20Linux-4c8bf5" alt="Supported OS: Windows, macOS, and Linux" /></a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=LGL-8wP_CAY" target="_blank">
    <img src="media/Lexicon.gif" alt="Lexicon editor tour" />
  </a>
  <br />
  <sub>🍿 <em>Click the GIF above or <a href="https://www.youtube.com/watch?v=LGL-8wP_CAY">watch the full project launch video on YouTube</a> (with audio)</em></sub>
</p>

Lexicon is a distraction-free rich-text editor with inline proofreading,
local-first AI writing tools, and a review panel for suggestions. It is designed
to feel calm, private, and useful without requiring an account or a Lexicon
cloud writing service.

## Download

Download the installer for your device from the
[latest GitHub release](https://github.com/AashishH15/Lexicon/releases/latest).

### Windows

- **x64** - most modern Intel and AMD PCs
- **ARM64** - Windows ARM devices
- **x86** - older 32-bit Windows systems

The Windows installer bundles the app backend and its runtime. You do not need
Python, Node.js, or Java to use the installed application.

Windows builds are not yet Authenticode code-signed. That can trigger
**SmartScreen** and occasional **antivirus false positives** (Windows Defender,
AVG, and similar). Lexicon is open source and MIT-licensed; only download
installers from this repository’s
[Releases](https://github.com/AashishH15/Lexicon/releases) page.

**SmartScreen (“Windows protected your PC”):**

1. Click **More info**
2. Click **Run anyway**

**Antivirus quarantine / “malicious code” warnings:** these are usually
reputation heuristics on new or unsigned indie installers, not a confirmed
infection. If Defender or another AV blocks the file, restore/allow it from
quarantine after you have confirmed the download came from the GitHub Releases
URL above. If you are unsure, compare the release asset name with the build
you intended to download before allowing it.

### macOS

- **Apple Silicon / arm64** - M-series Macs
- **Intel / x64** - Intel Macs

The macOS build is currently pre-release (**unsigned**). Gatekeeper may block
launch or prevent the background engine from spawning because the app is not
notarized by Apple. That is an unsigned-developer warning, not a claim that the
build contains malware. Only download builds from this repository’s releases
page.

If Gatekeeper blocks Lexicon:

- **GUI:** Control-click (right-click) `Lexicon.app` → **Open** → **Open**
- **System Settings:** **Privacy & Security** → **Open Anyway**
  ([Apple’s guide](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unidentified-developer-mh40616/mac))
- **Terminal:** `xattr -cr /Applications/Lexicon.app` to clear the download
  quarantine flag


### Linux

- **DEB (`.deb`)** - Debian, Ubuntu, Linux Mint, Pop!_OS, etc.

## First launch

1. Open Lexicon and choose whether to download a local AI model.
2. Choose **Light** for the smaller, faster model (about 0.8 GB), or
   **Standard** for the larger model (about 1.4 GB).
3. Wait for the download progress to finish. The model is stored in your local
   app data and does not need to be downloaded again after a restart.
4. The first AI action may briefly warm up the local model. Proofread uses the
   separate LanguageTool engine and does not require the AI model.

The editor and proofreading tools work without downloading an AI model. The AI
tools can also use an existing Ollama or LM Studio server when one is
available. The default LM Studio server uses `http://localhost:1234`. If LM
Studio serves on the local network or another host, enter the address displayed
in LM Studio under Settings → Lex's Engine → Advanced; text and prompts sent
there are handled by that server. LM Studio must also have a model loaded
before Lexicon can use the server.

## Updates

Lexicon checks for new releases when it starts and provides **Check for
updates** in Settings. Updates install over the app while keeping downloaded
models and other app data in the user profile, so models do not need to be
downloaded again after an update. Packaged builds enable operating-system
startup by default and may run in the system tray while checking for updates.
After initial setup, an operating-system startup disable is respected.

## What Lexicon includes

### Writing workspace

- Rich-text editing with headings, lists, tasks, links, images, code blocks,
  tables, blockquotes, alignment, highlights, and typography rules
- Inline and block LaTeX math with a live preview editor
- Slash commands with keyboard navigation
- Resizable side panels, Focus Mode, drag handles, and local auto-save
- Language, font size, line spacing, and keyboard shortcut settings
- Personal dictionary for words that should not be flagged

### Proofreading and review

- Local LanguageTool proofreading with inline grammar and spelling squiggles
- Clickable suggestion cards that stay synchronized with the editor
- Apply, dismiss, accept all, and dismiss all actions
- Dismissed suggestions remain dismissed across re-checks
- Tone detection and a clarity/readability score

### Local AI tools

With a downloaded local model on supported builds, Lexicon provides:

- Rewrite and Concise
- Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic,
  Persuasive, and Humorous tone tools
- Summary, Key Points, List, and Table transforms
- Whole-document transforms with chunk progress for longer drafts

On supported builds, local AI transforms run through the included llama.cpp
backend. Ollama and LM Studio are optional alternatives; a network server you
configure may receive the text and prompt sent for a transform.

### Import and export

- Import `.docx`, `.txt`, `.md`, `.markdown`, `.html`, and `.htm` files
- Export HTML, plain text, Markdown, PDF, EPUB, or DOCX
- PDF export produces a clean manuscript-style document with app chrome and
  proofreading marks removed

## Privacy and local data

Lexicon is local-first:

- Your writing is processed locally by default and is not sent to a Lexicon
  cloud service.
- Updates, model downloads, and any Ollama, LM Studio, or LanguageTool endpoint
  that you configure are separate network paths. Those endpoints may receive
  the text and prompt sent to them.
- Documents are auto-saved locally in the app's browser storage.
- A downloaded local model can run the Local Assistant (Lex) on your device
  for opt-in rewriting, tone adjustments, and summaries on supported builds.
  A configured external AI server may process those requests instead.
- Downloaded models remain in your platform's Lexicon app-data directory.
- A user-triggered model download connects to Hugging Face or its CDN only to
  retrieve the selected model file.
- Ollama and LM Studio availability/model checks contact the configured server.
- LM Studio's API token, when used, is stored locally in `ai_prefs.json` and
  sent to the configured LM Studio server for authentication.
- Local app storage is not an encrypted backup. Protect your OS account and
  review which folders your backup or synchronization tools include.
- The desktop sidecar API uses an unauthenticated loopback HTTP connection
  (`127.0.0.1:18000` in packaged builds and `127.0.0.1:8000` in development).
  Other software on the same device may be able to connect to it; do not run
  untrusted local software.
- Remote images in documents may be fetched when displayed or reopened.
  User-triggered clipboard copies and DOCX/EPUB exports can also expose content
  or metadata to the OS, file recipients, or other providers.

## Developer setup

The packaged desktop app is the recommended experience for regular users. To
run the project from source, you need Python 3, Node.js with npm, and Java 17
or later. The packaged application includes its own Java runtime.

The development backend starts the official LanguageTool 6.8 HTTP server on
the loopback interface. The first run of either quick-start script downloads
the official standalone artifact from Maven Central, verifies its SHA-256
checksum, and extracts it to:

```text
backend/lt/LanguageTool-6.8/languagetool-server.jar
```

You can also install the engine manually from the project root:

```bash
python backend/install_languagetool.py
```

The engine is built from the
[LanguageTool 6.8 source](https://github.com/languagetool-org/languagetool/tree/v6.8)
and its standalone distribution includes LanguageTool's notices and license.
Lexicon communicates with the Java HTTP server directly; it does not use or
install a Python LanguageTool wrapper.

If the engine is stored elsewhere, set `LEXICON_LT_DIR` to the directory that
contains `languagetool-server.jar` before starting the backend.

### Quick start

From the project root:

```bash
# macOS / Linux
./start.sh
```

```bat
REM Windows
.\start.bat
```

These scripts create the backend environment when needed, install
dependencies, and start the local frontend and backend. Open
<http://localhost:5173> in your browser.

### Manual setup

Backend:

```bash
cd backend
python -m venv venv
```

Activate the environment, then install the dependencies:

```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The development frontend runs at <http://localhost:5173> and the backend API
runs at <http://localhost:8000>.

### LanguageTool verification

After the backend starts, send a proofreading request:

```bash
curl -X POST http://127.0.0.1:8000/grammar/check \
  -H "Content-Type: application/json" \
  -d '{"text":"Their going to there house.","language":"en-US"}'
```

The response must contain `matches` with offsets, messages, replacement
values, and rule IDs. Repeat the request after testing a multiline sentence,
an emoji before an error, another language, and a word in the ignored-word
list. To verify unload and restart, run:

```bash
curl -X POST http://127.0.0.1:8000/languagetool/unload
```

Then send another proofreading request. The backend must start one new
LanguageTool server and return the same response shape. A missing Java runtime
or engine returns HTTP 503 with an actionable error instead of HTTP 500.

## Platform and release status

The release workflow builds desktop installers for Windows (x86, x64, ARM64),
macOS (Intel and Apple Silicon), and Linux x64 (`.deb`). Builds are triggered
from version tags and attached to published GitHub release artifacts.

## Technology

- React, Vite, Tailwind CSS, and TipTap
- FastAPI and Uvicorn
- LanguageTool for rule-based proofreading
- llama.cpp and downloaded quantized GGUF models for local AI on supported builds
- Tauri for the cross-platform desktop shell

## Acknowledgements

Lexicon is built with:

- [TipTap](https://tiptap.dev/) and [ProseMirror](https://prosemirror.net/)
- [KaTeX](https://katex.org/)
- [lowlight](https://github.com/wooorm/lowlight)
- [marked](https://marked.js.org/) and [Turndown](https://github.com/mixmark-io/turndown)
- [Mammoth](https://github.com/mwilliamson/mammoth.js) and [JSZip](https://stuk.github.io/jszip/) for DOCX and EPUB import and export
- [Phosphor Icons](https://phosphoricons.com/)
- [LanguageTool](https://languagetool.org/)
- [React](https://react.dev/), [Vite](https://vite.dev/), and
  [Tailwind CSS](https://tailwindcss.com/)
- [FastAPI](https://fastapi.tiangolo.com/) and
  [Uvicorn](https://www.uvicorn.org/)
- [Hugging Face Hub](https://huggingface.co/) and [requests](https://requests.readthedocs.io/) for model downloads and inference

See [LICENSE](LICENSE) for licensing information.
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party
software, LanguageTool, bundled JRE, and dependency notices.

## Built by

**Aashish Harishchandre**

[Website](https://aashishharishchandre.netlify.app/)
&nbsp;&middot;&nbsp;
[GitHub](https://github.com/AashishH15)
&nbsp;&middot;&nbsp;
[LinkedIn](https://www.linkedin.com/in/aashish-harishchandre/)
