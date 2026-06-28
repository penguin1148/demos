@echo off
REM Demos - local launcher (Windows).
REM
REM The game uses native ES modules, which browsers refuse to load over the
REM file:// protocol. This script serves the folder over HTTP and opens it in
REM your browser. No build tools, no dependencies - just Python.
REM
REM Usage: double-click start.bat, or run it from a terminal.

setlocal
cd /d "%~dp0"

if "%PORT%"=="" set PORT=8000
set URL=http://localhost:%PORT%/

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "%URL%"
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "%URL%"
  python -m http.server %PORT%
  goto :eof
)

echo Could not find Python to serve the game.
echo Install Python from https://www.python.org/ and try again.
pause
