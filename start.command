#!/usr/bin/env bash
# macOS convenience wrapper: double-clicking a ".command" file runs it in
# Terminal (a ".sh" file opens in an editor instead). Delegates to start.sh.
cd "$(dirname "$0")"
exec ./start.sh
