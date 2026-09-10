#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED_DATA="${KANBAN_IOS_DERIVED_DATA:-$ROOT_DIR/dist/ios-derived-data}"

bash "$ROOT_DIR/macos/bundle_app_js.sh" >/dev/null
xcodebuild \
  -project "$ROOT_DIR/ios/GestoreKanbanIOS.xcodeproj" \
  -target GestoreKanbanIOS \
  -configuration Debug \
  -sdk iphonesimulator \
  SYMROOT="$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  build

echo "$DERIVED_DATA/Debug-iphonesimulator/Gestore attività Kanban.app"
