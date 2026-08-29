#!/usr/bin/env bash
# Acceptance lane: validate, lint, load, scan fixtures, open, and capture
# Capture Conveyor in the shared production-parity Omarchy shell.
# RTM: REQ-CC-007, REQ-CC-008
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/rig-verify.sh" "$ROOT"
"$ROOT/scripts/rig-render.sh" "$ROOT" "$ROOT/preview.png"
test -s "$ROOT/preview.png"
