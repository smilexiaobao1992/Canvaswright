#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CALLER_DIR="$PWD"
PORT="${CANVASWRIGHT_PORT:-43218}"
PROJECT_DIR="${CANVASWRIGHT_PROJECT_DIR:-${1:-$CALLER_DIR}}"
CANVAS_DIR="${CANVASWRIGHT_CANVAS_DIR:-$PROJECT_DIR/canvas}"

export CANVASWRIGHT_PROJECT_DIR="$PROJECT_DIR"
export CANVASWRIGHT_CANVAS_DIR="$CANVAS_DIR"

cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  npm install
fi

echo "Canvaswright canvas: http://127.0.0.1:${PORT}"
echo "Canvaswright scene: ${CANVAS_DIR}/pages/main/excalidraw-scene.json"
echo "Canvaswright assets: ${CANVAS_DIR}/pages/main/assets"
exec npm run dev -- --host 127.0.0.1 --port "$PORT"
