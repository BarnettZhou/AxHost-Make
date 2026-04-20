#!/bin/bash
# Axhost-Make Serve Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$WORKSPACE_ROOT"

PORT=3820

if ! command -v node &> /dev/null; then
    echo "[Error] Node.js not found. Please install Node.js >= 22."
    read -p "Press Enter to exit"
    exit 1
fi

echo "========================================"
echo "  Axhost-Make Serve"
echo "  Workspace: $WORKSPACE_ROOT"
echo "  Port:      $PORT"
echo "========================================"
echo ""
echo "Starting server... (Ctrl+C to stop)"
echo ""

node axhost-make/bin/axhost-make.js serve --port "$PORT"

echo ""
echo "Server stopped."
read -p "Press Enter to exit"
