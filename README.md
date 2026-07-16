# Lexicon

A local-first AI writing assistant that runs entirely on your machine. No
accounts, no cloud, no usage costs. The UI is a web app inspired by the web
versions of Grammarly and Quillbot, with the kind of writing tools Apple
ships in its "Writing Tools" feature.

## Why Lexicon

The earlier versions were desktop Tkinter apps with weak engines:

- v1 ([GrammarCheck](https://github.com/AashishH15/GrammarCheck)) used LanguageTool for grammar but had no AI rewriting.
- v2 ([Grammar-Checker-v2](https://github.com/AashishH15/Grammar-Checker-v2)) used TextBlob, which is really just a spellchecker.

Both were dated desktop UIs. Lexicon moves to a browser-based app and pairs a real
grammar engine with a local LLM for rewriting and tone.

## What it does

Pick some text and run one of the tools. Results show up in a side-by-side
output pane.

- **Proofread**: grammar, spelling, and clarity pass with a diff view
- **Rewrite**: neutral rewording
- **Friendly**: warmer, more casual tone
- **Professional**: formal, business tone
- **Concise**: tighter wording, less fluff
- **Summary**: condense to a short paragraph
- **Key Points**: extract the main takeaways as bullets
- **List**: turn prose into a structured list
- **Table**: turn prose into a table

Inline grammar squiggles (from LanguageTool) live in the editor itself, like
real Grammarly.

## How it works

- **Frontend**: React + Vite + Tailwind, with a TipTap editor for rich text
  and Grammarly-style inline suggestions.
- **Backend**: Python FastAPI, serving the frontend and a small REST API.
- **Grammar engine**: LanguageTool (rule-based, runs locally).
- **AI engine**: Ollama running a local model. No internet required.

Everything runs offline. The only setup step is pulling a model once with
`ollama pull <model>`.

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

The app is then available at http://localhost:5173.

## Credits

Lexicon is built on the shoulders of several super awesome open-source projects and tools:

- **[TipTap](https://github.com/ueberdosis/tiptap):** the headless rich-text editor framework
  (built on ProseMirror) that powers the writing canvas, inline grammar
  squiggles, and formatting toolbar.
- **[Phosphor Icons](https://github.com/phosphor-icons/homepage):** the icon set used across
  the tool matrix, format toolbar, settings, and suggestion cards.
- **[LanguageTool](https://github.com/languagetool-org/languagetool):** the rule-based grammar and
  spell-checking engine (`language_tool_python`) that drives inline squiggles
  and the Proofread pass.
- **[React](https://github.com/react/react):** the UI library behind the frontend.
- **[Vite](https://github.com/vitejs/vite):** the build tool and dev server.
- **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss):** the utility-first styling
  layer that implements the Lexicon design system.
- **[FastAPI](https://github.com/fastapi/fastapi):** the Python backend that serves
  the API and the frontend.
- **[Uvicorn](https://github.com/Kludex/uvicorn):** the ASGI server running the backend.
