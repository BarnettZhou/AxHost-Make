#!/bin/bash
# Axhost-Make Serve Launcher

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$SCRIPT_DIR"
cd "$WORKSPACE_ROOT"

PORT=3820
ACCESS="local"
HOST="127.0.0.1"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --access)
      if [[ -n "$2" && "$2" != --* ]]; then
        ACCESS="$2"
        shift 2
      else
        echo "[Error] --access requires a value (lan|local)"
        read -p "Press Enter to exit"
        exit 1
      fi
      ;;
    --access=lan|--access=local)
      ACCESS="${1#*=}"
      shift
      ;;
    --help|-h)
      echo "Usage: start.sh [--access lan|local]"
      exit 0
      ;;
    *)
      echo "[Warning] Unknown argument: $1"
      shift
      ;;
  esac
done

if [[ "$ACCESS" == "lan" ]]; then
  HOST="0.0.0.0"
elif [[ "$ACCESS" != "local" ]]; then
  echo "[Warning] Unknown access mode: $ACCESS, defaulting to local"
  ACCESS="local"
fi

if ! command -v node &> /dev/null; then
    echo "[Error] Node.js not found. Please install Node.js >= 22."
    read -p "Press Enter to exit"
    exit 1
fi

echo "========================================"
echo "  Axhost-Make Serve"
echo "  Workspace: $WORKSPACE_ROOT"
echo "  Port:      $PORT"
echo "  Access:    $ACCESS ($HOST)"
echo "========================================"
echo ""
echo "Starting server... (Ctrl+C to stop)"
echo ""

node axhost-make/bin/axhost-make.js serve --port "$PORT" --access "$ACCESS"

echo ""
echo "Server stopped."
read -p "Press Enter to exit"
