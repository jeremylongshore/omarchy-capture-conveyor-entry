#!/usr/bin/env bash
set -euo pipefail

# Seed the folder Omasnap saves to, ~/Pictures/Screenshots, with PNG files named the
# way Omasnap names them: screenshot-<date>_<time>[-<app>].png. The names carry the
# fixture's own timestamps, so each name agrees with the age the panel shows.
# The files are fixtures, not captures from a live Omasnap: Omasnap is not installed
# on the rig, and the plugin reads only names, sizes and times, never pixels.
SHOT_DIR="$HOME/Pictures/Screenshots"
mkdir -p "$SHOT_DIR"

# One valid 1x1 PNG, so every file is a real PNG.
PNG_BASE64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOQUzAAAADOAG9+RBkvAAAAAElFTkSuQmCC'

seed() {
  local ago="$1" app="${2:-}" name
  name="screenshot-$(date -d "$ago" +%Y-%m-%d_%H-%M-%S)${app:+-$app}.png"
  base64 -d <<<"$PNG_BASE64" > "$SHOT_DIR/$name"
  touch -d "$ago" "$SHOT_DIR/$name"
}

seed '2 minutes ago' firefox
seed '8 minutes ago' ghostty
seed '21 minutes ago' nautilus
seed '47 minutes ago' obsidian
seed '2 hours ago'
seed '1 day ago' signal

# Scan with no folder override anywhere: the scanner has to find the folder itself.
SCAN_RESULT=$(env -u OMASNAP_SCREENSHOT_DIR -u OMARCHY_SCREENSHOT_DIR -u XDG_CONFIG_HOME \
  "$PLUGIN_DIR/bin/capture-conveyor-scan")
jq -e '.directory | endswith("/Pictures/Screenshots")' <<<"$SCAN_RESULT" >/dev/null
jq -e '.reason == "" and .budget_hit == false' <<<"$SCAN_RESULT" >/dev/null
jq -e '.captures | length == 6' <<<"$SCAN_RESULT" >/dev/null
jq -e '.captures[0].path | endswith("-firefox.png")' <<<"$SCAN_RESULT" >/dev/null
