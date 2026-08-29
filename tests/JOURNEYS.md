# User Journeys: Capture Conveyor
<!-- Managed by audit-tests. Journey criticality is hash-pinned after review. -->

## Journey: triage the recent screenshot inbox

Personas: keyboard-first capture worker
Trigger: operator opens Capture Conveyor from the Omarchy bar
Critical: true
Linked RTM: REQ-CC-001, REQ-CC-004, REQ-CC-006, REQ-CC-007, REQ-CC-008

| # | Step | Layer | Test file | Status |
|---|---|---|---|---|
| 1 | Plugin loads and scans fixture captures in the stock shell | L6 | e2e/buzz.sh | Covered |
| 2 | Panel opens through IPC with a visibly selected row | L5, L6 | tests/a11y.test.js, e2e/buzz.sh | Covered |
| 3 | Up and Down move only through current captures | L3, L5 | tests/model.test.js, tests/a11y.test.js | Covered |
| 4 | Copy, new capture, OCR, and reveal use fixed argv actions | L4, L5 | tests/smoke.test.js | Covered |
| 5 | A failed action becomes visible instead of silently disappearing | L5 | tests/smoke.test.js | Covered |

Coverage: 5/5 steps (100%)

## Journey: scan a hostile local screenshot tree safely

Personas: privacy-conscious Omarchy operator
Trigger: config or screenshot directory entries are oversized, special, numerous, or concurrently replaced
Critical: true
Linked RTM: REQ-CC-002, REQ-CC-003, REQ-CC-005

| # | Step | Layer | Test file | Status |
|---|---|---|---|---|
| 1 | Traverse every config and capture path component without following symlinks | L5 | tests/scanner.test.js | Covered |
| 2 | Reject FIFO, oversized, symlink, or non-image inputs without reading image bytes | L4, L5 | tests/scanner.test.js | Covered |
| 3 | Bound all names and entries before sorting or buffering results | L3, L5 | tests/scanner.test.js | Covered |
| 4 | Prove final, parent, and capture-directory racers actually attacked | L5 | tests/scanner.test.js, tests/fixtures | Covered |
| 5 | Emit no victim records and continue with stock Perl only | L2, L6 | tests/scanner.test.js, tests/smoke.test.js | Covered |

Coverage: 5/5 steps (100%)
