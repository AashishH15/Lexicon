@echo off
REM Lexicon quick start - installs both sides (if needed) and launches them.
REM Windows. Requires: Python 3, pip, Node.js + npm, and Java (for LanguageTool).
setlocal

cd /d "%~dp0"

echo Lexicon quick start

if not exist "backend\venv" call :setup_backend
if exist "backend\venv" call backend\venv\Scripts\activate.bat

echo Starting backend on http://localhost:8000
start "Lexicon Backend" cmd /k "cd /d %~dp0backend & call venv\Scripts\activate.bat & uvicorn main:app --reload --port 8000"

if not exist "frontend\node_modules" call :setup_frontend

echo Starting frontend on http://localhost:5173
start "Lexicon Frontend" cmd /k "cd /d %~dp0frontend & npm run dev"

echo.
echo Lexicon is starting in separate windows:
echo   App:  http://localhost:5173
echo   API:  http://localhost:8000
echo   Note: Java is required for LanguageTool (downloads on first proofread).
echo Close the two opened windows to stop.

REM Give the dev server a few seconds to boot, then open the app.
timeout /t 1 /nobreak >nul
start "" http://localhost:5173
goto :eof

:setup_backend
echo Setting up Python backend (venv)
py -m venv backend\venv
call backend\venv\Scripts\activate.bat
pip install -r backend\requirements.txt
goto :eof

:setup_frontend
echo Installing frontend deps (npm install)
cd frontend
call npm install
cd ..
goto :eof
