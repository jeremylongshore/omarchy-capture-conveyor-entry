# Marketplace contract

Capture Conveyor ships one bar widget whose listing copy and runtime behavior
tell the same product story.

- Root and bar-widget descriptions are identical and exactly 500 characters.
- Copy names the capture count, newest-24 panel, keyboard selection, screenshot
  and OCR-region actions, path copy, folder reveal, and 20-second refresh.
- `assets/banner.svg` identifies Capture Conveyor and depicts a local capture
  moving through a keyboard-first inbox.
- `preview.png` is accepted only with current-tree Buzz provenance, exact
  1280x720 dimensions, a clean shell-log hash, and visual approval.
- The bounded scanner reads only top-level screenshot PNG metadata. It never
  reads pixels, OCRs existing files, watches the clipboard, uploads data, opens
  an account, or uses the network.

`tests/contract.test.js`, scanner tests, and gate C43 enforce the
machine-checkable portions.
