@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python not found. Install Python or add it to PATH.
  pause
  exit /b 1
)

echo Starting local server on http://localhost:8787
echo Press Ctrl+C to stop.
python -m http.server 8787
pause
