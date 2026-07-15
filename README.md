# Grammar Checker v3

A local-first AI writing assistant that runs entirely on your machine. No
accounts, no cloud, no usage costs. The UI is a web app inspired by the web
versions of Grammarly and Quillbot, with the kind of writing tools Apple
ships in its "Writing Tools" feature.

## Why a v3

The earlier versions were desktop Tkinter apps with weak engines:

- v1 ([GrammarCheck](https://github.com/AashishH15/GrammarCheck)) used LanguageTool for grammar but had no AI rewriting.
- v2 ([Grammar-Checker-v2](https://github.com/AashishH15/Grammar-Checker-v2)) used TextBlob, which is really just a spellchecker.

Both were dated desktop UIs. v3 moves to a browser-based app and pairs a real
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

## Running the frontend

```
cd frontend
npm install
npm run dev
```

The app is then available at http://localhost:5173.
