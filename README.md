<p align="center">
  <img src="media/lexicon-logo-windows.png" alt="Lexicon logo" width="150" />
</p>

<h1 align="center">Lexicon</h1>

<p align="center">
  <strong>A local-first writing assistant for clearer drafts.</strong><br />
  Proofread, rewrite, format, and export your work while keeping your words on your machine.
</p>

<p align="center">
  <a href="https://github.com/AashishH15/Lexicon/releases/latest">Download the latest release</a>
  &nbsp;&middot;&nbsp;
  <a href="https://github.com/AashishH15/Lexicon/issues">Report an issue</a>
</p>

<p align="center">
  <a href="https://github.com/AashishH15/Lexicon/releases/latest"><img src="https://img.shields.io/github/v/release/AashishH15/Lexicon?display_name=tag" alt="Latest release" /></a>
  <a href="https://github.com/AashishH15/Lexicon/blob/master/LICENSE"><img src="https://img.shields.io/github/license/AashishH15/Lexicon" alt="License" /></a>
</p>

<p align="center">
  <img src="media/Lexicon.gif" alt="Lexicon editor tour" />
</p>

Lexicon is a distraction-free rich-text editor with inline proofreading,
local AI writing tools, and a review panel for suggestions. It is designed to
feel calm, private, and useful without requiring an account or a cloud writing
service.

## Download

Download the installer for your device from the
[latest GitHub release](https://github.com/AashishH15/Lexicon/releases/latest).

### Windows

- **x64** - most modern Intel and AMD PCs
- **ARM64** - Windows ARM devices
- **x86** - older 32-bit Windows systems

The Windows installer bundles the app backend and its runtime. You do not need
Python, Node.js, or Java to use the installed application.

### macOS

- **Apple Silicon / arm64** - M-series Macs
- **Intel / x64** - Intel Macs

The macOS build is currently unsigned and not notarized. If macOS blocks the
first launch, Control-click the app and choose **Open**, or use
**System Settings > Privacy & Security > Open Anyway**. Only download builds
from this repository's releases page.

Linux installers are not packaged yet.

## First launch

1. Open Lexicon and choose whether to download a local AI model.
2. Choose **Light** for the smaller, faster model (about 0.8 GB), or
   **Standard** for the larger model (about 1.4 GB).
3. Wait for the download progress to finish. The model is stored in your local
   app data and does not need to be downloaded again after a restart.
4. The first AI action may briefly warm up the local model. Proofread uses the
   separate LanguageTool engine and does not require the AI model.

The editor and proofreading tools work without downloading an AI model. The AI
tools can also use an existing local Ollama server when one is available.

## Updates

Lexicon checks for new releases when it starts and provides **Check for
updates** in Settings. Updates install over the app while keeping downloaded
models and other app data in the user profile, so models do not need to be
downloaded again after an update.

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

With a downloaded bundled model, Lexicon provides:

- Rewrite and Concise
- Friendly, Professional, Academic, Formal, Casual, Playful, Empathetic,
  Persuasive, and Humorous tone tools
- Summary, Key Points, List, and Table transforms
- Whole-document transforms with chunk progress for longer drafts

AI transforms run locally through the bundled llama.cpp backend. Ollama is an
optional alternative for users who already run it on their machine.

### Import and export

- Import `.txt`, `.md`, `.markdown`, `.html`, and `.htm` files
- Export HTML, plain text, Markdown, or PDF
- PDF export produces a clean manuscript-style document with app chrome and
  proofreading marks removed

## Privacy and local data

Lexicon is local-first:

- Your writing is not sent to Lexicon's servers.
- Documents are auto-saved locally in the app's browser storage.
- Downloaded models remain in your platform's Lexicon app-data directory.
- The initial model download connects to Hugging Face only to retrieve the
  selected model file.
- Ollama, when selected, is a local server you run yourself.

## Developer setup

The packaged desktop app is the recommended experience for regular users. To
run the project from source, you need Python 3, Node.js with npm, and Java for
the LanguageTool development backend. The packaged application includes its
own Java runtime.

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

## Platform and release status

The release workflow builds desktop installers for Windows x86, x64, and
ARM64, plus macOS Intel and Apple Silicon. Builds are triggered from version
tags and attached to GitHub Releases.

## Technology

- React, Vite, Tailwind CSS, and TipTap
- FastAPI and Uvicorn
- LanguageTool for rule-based proofreading
- llama.cpp and quantized GGUF models for bundled local AI
- Tauri for the cross-platform desktop shell

## Acknowledgements

Lexicon is built with:

- [TipTap](https://tiptap.dev/) and [ProseMirror](https://prosemirror.net/)
- [KaTeX](https://katex.org/)
- [lowlight](https://github.com/wooorm/lowlight)
- [marked](https://marked.js.org/) and [Turndown](https://github.com/mixmark-io/turndown)
- [Phosphor Icons](https://phosphoricons.com/)
- [LanguageTool](https://languagetool.org/)
- [React](https://react.dev/), [Vite](https://vite.dev/), and
  [Tailwind CSS](https://tailwindcss.com/)
- [FastAPI](https://fastapi.tiangolo.com/) and
  [Uvicorn](https://www.uvicorn.org/)

See [LICENSE](LICENSE) for licensing information.
