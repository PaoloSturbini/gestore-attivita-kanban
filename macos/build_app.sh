#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Gestore attività Kanban"
BUILD_DIR="${KANBAN_BUILD_DIR:-$ROOT_DIR/dist}"
DIST_APP_DIR="$BUILD_DIR/$APP_NAME.app"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kanban-app-build.XXXXXX")"
APP_DIR="$STAGING_DIR/$APP_NAME.app"
INSTALL_APP="${KANBAN_INSTALL_APP:-1}"
UPDATE_DIST="${KANBAN_UPDATE_DIST:-1}"
APPLICATIONS_DIR="${KANBAN_APPLICATIONS_DIR:-/Applications}"
INSTALLED_APP_DIR="$APPLICATIONS_DIR/$APP_NAME.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
WEB_DIR="$RESOURCES_DIR/Web"
DIST_UPDATED=0
trap 'if [ "${KEEP_STAGING:-0}" != "1" ]; then rm -rf "$STAGING_DIR"; fi' EXIT

mkdir -p "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$WEB_DIR"

if [ -f "$ROOT_DIR/generated-assets/AppIcon.icns" ]; then
  ICON_PATH="$ROOT_DIR/generated-assets/AppIcon.icns"
else
  python3 "$ROOT_DIR/macos/create_icon.py" >/dev/null
  ICON_PATH="$ROOT_DIR/macos/Assets/AppIcon.icns"
fi

cp "$ROOT_DIR/macos/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$ICON_PATH" "$RESOURCES_DIR/AppIcon.icns"
cp "$ROOT_DIR/assets/index.html" "$WEB_DIR/index.html"
cp "$ROOT_DIR/assets/styles.css" "$WEB_DIR/styles.css"
cp "$ROOT_DIR/assets/sample-data.js" "$WEB_DIR/sample-data.js"
cp "$ROOT_DIR/assets/pouchdb.min.js" "$WEB_DIR/pouchdb.min.js"

# Rigenera il bundle JS direttamente dentro la app, senza creare temporanei nel progetto.
KANBAN_BUNDLE_OUT="$WEB_DIR/app.bundle.js" bash "$ROOT_DIR/macos/bundle_app_js.sh" >/dev/null

xcrun swiftc \
  -framework Cocoa \
  -framework EventKit \
  -framework UniformTypeIdentifiers \
  -framework WebKit \
  "$ROOT_DIR/macos/GestoreKanban/main.swift" \
  -o "$MACOS_DIR/GestoreKanban"

chmod +x "$MACOS_DIR/GestoreKanban"
codesign --force --deep --sign - "$APP_DIR" >/dev/null

if [ "$UPDATE_DIST" != "0" ]; then
  DIST_STAGE_PARENT="$(mktemp -d "${TMPDIR:-/tmp}/kanban-dist-stage.XXXXXX")"
  DIST_STAGE_APP="$DIST_STAGE_PARENT/$APP_NAME.app"
  if ditto "$APP_DIR" "$DIST_STAGE_APP" 2>/dev/null && rm -rf "$DIST_APP_DIR" 2>/dev/null && mv "$DIST_STAGE_APP" "$DIST_APP_DIR" 2>/dev/null; then
    codesign --verify --deep --strict "$DIST_APP_DIR" >/dev/null
    DIST_UPDATED=1
  else
    echo "Avviso: non posso aggiornare $DIST_APP_DIR; continuo con /Applications." >&2
  fi
  rm -rf "$DIST_STAGE_PARENT"
fi

if [ "$INSTALL_APP" != "0" ]; then
  rm -rf "$INSTALLED_APP_DIR"
  ditto "$APP_DIR" "$INSTALLED_APP_DIR"
  codesign --verify --deep --strict "$INSTALLED_APP_DIR" >/dev/null
fi

if [ "$DIST_UPDATED" = "1" ]; then
  echo "$DIST_APP_DIR"
else
  KEEP_STAGING=1
  echo "$APP_DIR"
fi
if [ "$INSTALL_APP" != "0" ]; then
  echo "$INSTALLED_APP_DIR"
fi
