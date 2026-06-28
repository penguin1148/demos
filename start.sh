#!/usr/bin/env bash
# Demos — local launcher (macOS / Linux).
#
# The game uses native ES modules, which browsers refuse to load over the
# file:// protocol. This script serves the folder over HTTP and opens it in
# your browser. No build tools, no dependencies — just Python (or Node).
#
# Usage:  ./start.sh        (or double-click start.command on macOS)
#         PORT=9000 ./start.sh   to choose a port

set -euo pipefail

# Run from this script's own directory, so double-clicking works too.
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

# If the chosen port is busy, walk forward until we find a free one.
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
while port_busy "$PORT"; do PORT=$((PORT + 1)); done

URL="http://localhost:${PORT}/"

# Pick whatever static file server is available.
if command -v python3 >/dev/null 2>&1; then
  SERVE=(python3 -m http.server "$PORT")
elif command -v python >/dev/null 2>&1; then
  SERVE=(python -m http.server "$PORT")
elif command -v npx >/dev/null 2>&1; then
  SERVE=(npx --yes serve -l "$PORT" .)
else
  echo "Could not find Python or Node to serve the game." >&2
  echo "Install Python (python.org) or Node (nodejs.org) and try again." >&2
  exit 1
fi

echo "Serving Demos at ${URL}"
echo "Press Ctrl+C to stop."

# Start the server in the background and make sure it dies when we exit.
"${SERVE[@]}" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Give the server a moment, then open the browser (best-effort per platform).
sleep 1
if command -v open >/dev/null 2>&1; then
  open "$URL"                 # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"             # Linux desktop
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile Start "$URL"   # Git Bash / WSL on Windows
else
  echo "Open ${URL} in your browser."
fi

# Keep the server in the foreground so Ctrl+C stops everything.
wait "$SERVER_PID"
