# Test Audit: Capture Conveyor

Date: 2026-11-16
Version audited: 0.2.2
Classification: frontend + cli Omarchy plugin
Audit harness: 1.4.0 (pinned; not bumped here)

## Result

Grade: not re-scored for 0.2.2. The last scored audit was A (96/100) on
2026-08-30 against 0.2.0 with harness 1.3.1. This file records the evidence for
0.2.2 and makes no new score, because the scoring skill was not re-run.

What changed the evidence in 0.2.2:

- The scanner listed `~/Pictures`, but current Omarchy saves screenshots with
  Omasnap to `~/Pictures/Screenshots`, so a stock install showed an empty inbox
  forever. The old rig fixture and tests encoded the old folder, so every
  earlier receipt was green while the plugin did nothing. The scanner now
  resolves the folder in Omasnap's own order, the fixture seeds
  `~/Pictures/Screenshots`, and the scanner tests fail against the 0.2.1 scanner
  (26 of 31 scanner tests fail on it).
- The scan limit is reported separately from the 24-row cap, so a partial list
  is no longer described as the newest captures.

## Layer coverage

| Layer | Status | Evidence |
|---|---|---|
| L1 hooks and CI | Implemented | pre-push gate lane; `npm test`, race, mutation, audit, ShellCheck, actionlint in Actions |
| L2 static | Implemented | Perl compile, ShellCheck, actionlint, gitleaks, osv-scanner (0 advisories), vendored gates at contributing-clanker f79d8c7 |
| L3 unit | Implemented | node:test, c8 on Model.js, Stryker on Model.js, three-run race stability |
| L4 integration | Implemented | real scanner subprocesses and filesystem fixtures |
| L5 system/security/a11y | Implemented | path chains, ready/attacked racers (capture dir, config dir, config file, omasnap.conf), FIFO, oversize, entry and byte bounds, key-catcher wiring, plain-text assertions |
| L6 smoke/E2E/visual | Implemented on a headless sway rig | stock-runtime smoke with node, python and ruby shadowed by stubs; rig-verify and rig-render receipts; one-off key-injection run |
| L7 acceptance | Mapped | two critical journeys in tests/JOURNEYS.md |

## Traceability

Eleven requirements are mapped: ten MUST and one SHOULD, all covered. Three were
added in 0.2.2 (REQ-CC-009 folder precedence and reasons, REQ-CC-010
partial-scan honesty, REQ-CC-011 path and name encoding). No tests are orphaned.

## Final evidence (0.2.2)

- 63 of 63 tests pass: 31 scanner, 15 model, 7 contract, 6 a11y, 4 smoke.
- Model.js is at 100% statements, branches, functions and lines under c8. c8 and
  Stryker cover Model.js only, so the QML and the Perl scanner get no coverage
  or mutation signal from them; their evidence is the scanner and contract
  tests.
- Mutation score 97.79% (303 killed, 7 timed out, 7 survived) with a 90%
  blocking floor. The seven survivors are equivalent mutants that were already
  present or are unreachable: the `String(raw || "")` fallback literal, an
  emptied `catch` that falls through to the same fail-closed result, two
  loop-bound mutants that read one `undefined` record past the end and skip it,
  the `captureHue` arithmetic, and the module-export guard.
- Race suite: three consecutive passes of the 31 scanner tests with no flake.
- `osv-scanner --lockfile package-lock.json` reports no issues across 203
  packages.
- Perl syntax, ShellCheck, actionlint and gitleaks are clean.
- Vendored gate lane re-synced to contributing-clanker f79d8c7, lane freshness
  exit 0. C42 now opens `bin/capture-conveyor-scan` and passes on the scan
  budget it finds.
- crap-score is not enforced: under harness 1.4.0 it scores zero functions for a
  root-level Model.js and still reports PASS
  (jeremylongshore/intent-audit-harness#248).

## Rig acceptance

REQ-CC-007 and REQ-CC-008 are covered by `.rig-proof.json` and
`.render-proof.json`, written by `scripts/rig-verify.sh` and
`scripts/rig-render.sh` on the rig. Both receipts record the Omarchy revision
and the Qt, Quickshell and Hyprland package versions the run used. The rig has
no Hyprland compositor, so Hyprland behaviour is proven from source only.
Omasnap is not installed on the rig, so the preview shows fixture files named
the way Omasnap names its captures, found at `~/Pictures/Screenshots` with no
folder override; it is not a live capture session.

## Not proven

- Behaviour under a live Hyprland session and with a live Omasnap writing the
  folder.
- That a filesystem such as btrfs returns directory entries oldest first. The
  scan limit text does not depend on it: past the limit the list is whatever the
  filesystem returned first, and the panel says so.
- Custom `filename` patterns in `omasnap.conf` that do not start with
  `screenshot-` are not listed. This is documented in the README, not handled.
