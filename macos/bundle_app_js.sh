#!/usr/bin/env bash
# Concatena i moduli sorgente in src/ nell'unico app.js servito dalla WebView.
# La WebView carica i file via file:// e quindi NON puo' usare <script type="module">
# (bloccato dalla CORS): per questo i sorgenti vengono uniti in un singolo file classico.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
OUT="${KANBAN_BUNDLE_OUT:-$ROOT_DIR/assets/app.bundle.js}"
TMP="$(mktemp "${TMPDIR:-/tmp}/kanban-app-bundle.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

if [ ! -d "$SRC_DIR" ]; then
  echo "Cartella sorgente non trovata: $SRC_DIR" >&2
  exit 1
fi

{
  echo "// =================================================================="
  echo "// FILE GENERATO AUTOMATICAMENTE - NON MODIFICARE A MANO."
  echo "// Modifica i moduli in src/*.js e rigenera con: macos/bundle_app_js.sh"
  echo "// =================================================================="
  for f in "$SRC_DIR"/[0-9][0-9]_*.js; do
    cat "$f"
  done
} > "$TMP"

cat "$TMP" > "$OUT"

echo "$OUT"
