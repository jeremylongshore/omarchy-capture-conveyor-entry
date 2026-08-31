#!/usr/bin/env bash
set -euo pipefail

SHOT_DIR="$HOME/Pictures"
mkdir -p "$SHOT_DIR"

for name in \
  screenshot-launch-dashboard.png \
  screenshot-terminal-proof.png \
  screenshot-bug-reproduction.png \
  screenshot-release-checklist.png \
  screenshot-design-review.png \
  screenshot-customer-note.png
do
  : > "$SHOT_DIR/$name"
done

touch -d '2 minutes ago' "$SHOT_DIR/screenshot-launch-dashboard.png"
touch -d '8 minutes ago' "$SHOT_DIR/screenshot-terminal-proof.png"
touch -d '21 minutes ago' "$SHOT_DIR/screenshot-bug-reproduction.png"
touch -d '47 minutes ago' "$SHOT_DIR/screenshot-release-checklist.png"
touch -d '2 hours ago' "$SHOT_DIR/screenshot-design-review.png"
touch -d '1 day ago' "$SHOT_DIR/screenshot-customer-note.png"

SCAN_RESULT=$("$PLUGIN_DIR/bin/capture-conveyor-scan")
jq -e '.directory | endswith("/Pictures")' <<<"$SCAN_RESULT" >/dev/null
jq -e '.captures | length == 6' <<<"$SCAN_RESULT" >/dev/null
jq -e '.captures[0].path | endswith("screenshot-launch-dashboard.png")' \
  <<<"$SCAN_RESULT" >/dev/null
