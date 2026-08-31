# Requirements Traceability Matrix: Capture Conveyor
<!-- Managed by audit-tests. MoSCoW decisions are hash-pinned after review. -->

| Req ID | MoSCoW | Source | Description | Layers | Test files | Status |
|---|---|---|---|---|---|---|
| REQ-CC-001 | MUST | README.md | Inventory at most 24 recent top-level Omarchy screenshots | L3, L4 | tests/scanner.test.js, tests/model.test.js | Covered |
| REQ-CC-002 | MUST | README.md | Never upload, inspect image contents, or run OCR without an explicit new selection | L2, L5 | tests/smoke.test.js, scripts/gates | Covered |
| REQ-CC-003 | MUST | Marketplace #2900 | Bound all directory work and resist config/capture path replacement, symlink, FIFO, and oversized input | L3, L5 | tests/scanner.test.js, tests/fixtures | Covered |
| REQ-CC-004 | MUST | Panel.qml | Parse scanner output fail-closed and clear stale selections before actions | L3, L5 | tests/model.test.js | Covered |
| REQ-CC-005 | MUST | manifest.json | Run on stock Omarchy without Node or Python at runtime | L2, L6 | tests/smoke.test.js, scripts/rig-verify.sh | Covered |
| REQ-CC-006 | MUST | Panel.qml | Expose named button roles and keyboard activation for rows and actions | L5, L6 | tests/a11y.test.js | Covered |
| REQ-CC-007 | MUST | submission process | Validate, load, scan, open, and render in the production-parity Buzz shell | L6, L7 | e2e/buzz.sh | Pending live proof |
| REQ-CC-008 | SHOULD | marketplace presentation | Show a visibly selected inbox row and clear action hierarchy | L3, L6 | tests/model.test.js, tests/contract.test.js, e2e/buzz.sh | Pending hash-bound inspection |
