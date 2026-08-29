# Personas: Capture Conveyor
<!-- Managed by audit-tests. -->

## Keyboard-first capture worker

Tier: local desktop user
Permissions: local plugin and Omarchy capture commands
Key flows: open inbox, select a recent capture, copy its path, start a new capture or OCR selection
Test coverage:
  - open and select: tests/a11y.test.js and e2e/buzz.sh
  - copy selected path: tests/smoke.test.js and tests/model.test.js
  - new capture and OCR: tests/a11y.test.js and tests/smoke.test.js
Coverage: 3/3 flows (100%)

## Privacy-conscious Omarchy operator

Tier: local desktop user
Permissions: local screenshot metadata only
Key flows: avoid automatic content access, bound hostile directories, reject replaced config paths
Test coverage:
  - metadata-only contract: tests/smoke.test.js and bin/capture-conveyor-scan
  - hostile directory bounds: tests/scanner.test.js
  - config and capture replacement: tests/scanner.test.js and tests/fixtures
Coverage: 3/3 flows (100%)
