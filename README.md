# Capture Conveyor

A local Omarchy bar widget that turns saved screenshots into a small, safe
inbox. It shows the newest 24 screenshots, lets you choose one, and exposes
explicit actions for a new capture, annotation, copying its path, revealing
the folder, or beginning a fresh OCR selection.

## Contract

Capture Conveyor follows Omarchy's current `omarchy capture` interface and
directory precedence: `OMARCHY_SCREENSHOT_DIR`, then `XDG_PICTURES_DIR`, then
the Pictures setting in `user-dirs.dirs`, then `~/Pictures`. It only inventories
top-level regular `screenshot-*.png` files. Clipboard-only captures therefore
do not appear, and no stored image is OCRed or uploaded automatically.

All actions are fixed argv arrays. The scanner bounds its output, ignores
symlinks, resolves every returned path under the configured directory, and the
QML model rejects malformed paths again before an action can receive one.

## Install

Install this directory as an Omarchy bar-widget plugin, then add `Capture
Conveyor` to the bar. Click a row to select it; middle-click annotates and
right-click copies its path.

## Verification

```bash
npm test
bash scripts/run-plugin-gates.sh
bash scripts/check-lane-freshness.sh
bash scripts/rig-verify.sh .
bash scripts/rig-render.sh . preview.png
```

The test suite covers the pure model and a real temporary-directory scanner
fixture, including directory precedence, symlink exclusion, hostile paths, and
the bounded partial-inventory case. The rig validates and loads QML on Buzz;
an interactive screenshot remains a user-session action by design.

## License

MIT
