# Capture Conveyor

![Capture Conveyor banner](assets/banner.svg)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U5S225PTME)

Capture Conveyor turns saved Omarchy screenshots into a small, safe local inbox.
It shows the newest 24 screenshots and provides explicit actions for a new
capture, annotation, path copy, reveal, and a fresh OCR selection.

It follows Omarchy's `omarchy capture` interface and directory precedence:
`OMARCHY_SCREENSHOT_DIR`, then `XDG_PICTURES_DIR`, then `user-dirs.dirs`, then
`~/Pictures`. It inventories only top-level `screenshot-*.png` files. Stored
images are never OCRed or uploaded automatically.

All actions use fixed argv arrays. The scanner bounds its output, ignores
symlinks, resolves returned paths under the configured directory, and the QML
model validates paths again before an action can receive one.

## Install

```bash
omarchy plugin add https://github.com/jeremylongshore/omarchy-capture-conveyor-entry --enable
```

Click a row to select it; middle-click annotates and right-click copies its path.

## Verify

```bash
npm test
bash scripts/run-plugin-gates.sh
bash scripts/check-lane-freshness.sh
bash scripts/rig-verify.sh .
bash scripts/rig-render.sh . preview.png
```

## License

MIT
