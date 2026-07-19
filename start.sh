#!/usr/bin/env bash
# Lexicon quick start — installs both sides (if needed) and launches them.
# macOS / Linux. Requires: Python 3, pip, Node.js + npm, and Java (for LanguageTool).
set -e

cd "$(dirname "$0")"

echo "== Lexicon quick start =="

# --- Backend ---
if [ ! -d "backend/venv" ]; then
  echo ">> Setting up Python backend (venv)..."
  python3 -m venv backend/venv
  # shellcheck disable=SC1091
  source backend/venv/bin/activate
  pip install -r backend/requirements.txt
else
  source backend/venv/bin/activate
fi

echo ">> Starting backend on http://localhost:8000 ..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# --- Frontend ---
if [ ! -d "frontend/node_modules" ]; then
  echo ">> Installing frontend deps (npm install)..."
  (cd frontend && npm install)
fi

echo ">> Starting frontend on http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Lexicon is starting:"
echo "  App:      http://localhost:5173"
echo "  API:      http://localhost:8000"
echo "  Note: Java is required for LanguageTool (downloads on first proofread)."
echo "Press Ctrl+C to stop both."

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT INT TERM
wait
