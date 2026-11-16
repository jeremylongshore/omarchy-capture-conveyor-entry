# Requirements Traceability Matrix: Capture Conveyor
<!-- Managed by audit-tests. MoSCoW decisions are hash-pinned after review. -->

| Req ID | MoSCoW | Source | Description | Layers | Test files | Status |
|---|---|---|---|---|---|---|
| REQ-CC-001 | MUST | README.md | Inventory at most 24 recent top-level Omarchy screenshots (the newest 24 whenever the scan limit is not reached) | L3, L4 | tests/scanner.test.js, tests/model.test.js | Covered |
| REQ-CC-002 | MUST | README.md | Never upload, inspect image contents, or run OCR without an explicit new selection | L2, L5 | tests/smoke.test.js, scripts/gates | Covered |
| REQ-CC-003 | MUST | Marketplace #2900 | Bound all directory work and resist config/capture path replacement, symlink, FIFO, and oversized input | L3, L5 | tests/scanner.test.js, tests/fixtures | Covered |
| REQ-CC-004 | MUST | Panel.qml | Parse scanner output fail-closed and clear stale selections before actions | L3, L5 | tests/model.test.js | Covered |
| REQ-CC-005 | MUST | manifest.json | Run on stock Omarchy without Node or Python at runtime | L2, L6 | tests/smoke.test.js, scripts/rig-verify.sh | Covered |
| REQ-CC-006 | MUST | Panel.qml | Expose named button roles and keyboard activation for rows and actions | L5, L6 | tests/a11y.test.js | Covered |
| REQ-CC-007 | MUST | submission process | Validate, load, scan, open, and render in the production-parity Buzz shell | L6, L7 | e2e/buzz.sh, scripts/rig-verify.sh, scripts/rig-render.sh | Covered (.rig-proof.json and .render-proof.json, regenerated for 0.2.2) |
| REQ-CC-008 | SHOULD | marketplace presentation | Show a visibly selected inbox row and clear action hierarchy | L3, L6 | tests/model.test.js, tests/contract.test.js, e2e/buzz.sh | Covered (agent inspection bound to the preview hash) |
| REQ-CC-009 | MUST | Omarchy 74de104 manual/12 and omasnap src/capture.cpp | List the folder Omasnap saves to, in its precedence: OMASNAP_SCREENSHOT_DIR, OMARCHY_SCREENSHOT_DIR, omasnap.conf directory, user-dirs Pictures plus /Screenshots, then ~/Pictures/Screenshots, and name the reason when it cannot be listed | L3, L4, L6 | tests/scanner.test.js, tests/model.test.js, tests/contract.test.js, e2e/rig-before-shell.sh | Covered |
| REQ-CC-010 | MUST | PR review rule: a bound applied silently is a defect | Report a partial scan as such and never call a partial list the newest captures | L3, L4 | tests/scanner.test.js, tests/model.test.js | Covered |
| REQ-CC-011 | MUST | Panel.qml | Carry the real path for non-ASCII names, drop names that are not UTF-8, and strip markup, control, bidi and tag characters from displayed names | L3, L4 | tests/scanner.test.js, tests/model.test.js | Covered |
