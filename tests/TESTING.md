# Testing Context: Capture Conveyor
<!-- TESTING.md schema v1. Policy defaults were scaffolded by implement-tests for engineer review. -->

## Classification (policy)

Repo type: frontend + cli (Omarchy QML plugin with a stock-Perl screenshot inventory helper)
Primary language(s): QML, JavaScript ES5, Perl, Bash
Applicable layers: L1, L2, L3, L4-integration, L5-security, L5-a11y, L6-smoke, L6-e2e, L6-visual, L7-UAT
Waived layers: L4-contract (no network or API), L4-migration (no schema migration), L5-perf (strict entry and byte budgets), L5-chaos (single-user desktop plugin)
Compliance overlay: none

## Thresholds (policy, hash-pinned)

coverage.line: 95
coverage.branch: 90
coverage.function: 95
mutation.kill_rate: 90
crap.prod_max: 30
crap.test_max: 15
crap.project_avg: 10
# crap.* are the intended policy, not an enforced gate. Under audit-harness 1.4.0, crap-score
# scores zero functions for a root-level Model.js and still reports PASS
# (jeremylongshore/intent-audit-harness#248), so nothing here enforces them. CRAP is
# measured separately by the fleet coordinator.
flaky.tolerance: 0/3runs
test.complexity_ceiling: 15
personas.flow_coverage_min: 100
journeys.step_coverage_min: 100

## Installed gates (observational)

L0: @intentsolutions/audit-harness 1.4.0
L1: pre-push gate lane + GitHub Actions test/gates workflows
L2: Perl syntax, ShellCheck, actionlint, vendored Omarchy gates, gitleaks, osv-scanner
L3: node:test + c8 coverage (Model.js only) + Stryker mutation (Model.js only) + three-run race stability; CRAP is not enforced (see the note under Thresholds)
L4-integration: real scanner subprocesses and directory/config filesystem fixtures
L5-security: complete path confinement, ready/attacked config and capture racers, symlink/FIFO/oversize/entry/byte bounds
L5-a11y: QML accessibility names/roles, key-catcher signal wiring, and bounded plain-text assertions
L6-smoke: stock Perl startup with node, python and ruby shadowed by stubs that exit 127, action contract, and QML-to-Model contract tests
L6-e2e: rig-verify (Omarchy validator, qmllint) and rig-render (fixture scan of ~/Pictures/Screenshots, live shell load, IPC open, screenshot) on intent-ops-buzz/omarchy-rig, a headless sway rig with no Hyprland compositor
L6-visual: 1280x720 render of the selected-inbox panel, inspected by an agent and bound to the preview hash by scripts/approve-preview.sh
L7-UAT: primary capture and hostile-directory journeys mapped in tests/JOURNEYS.md

## Frameworks (observational)

unit: node:test
coverage: c8 12
mutation: Stryker 10
policy: @intentsolutions/audit-harness 1.4.0
e2e: scripts/rig-verify.sh + scripts/rig-render.sh on intent-ops-buzz/omarchy-rig

## Rig (observational)

host: container omarchy-rig on intent-ops-buzz, headless sway, no Hyprland compositor
omarchy: 74de10479d3bf7aa7865408e33219064cfe45432
qt6-base: 6.12.0-5
quickshell: 0.3.2-1
hyprland package: 0.57.2-1 (installed; not running)
omasnap: not installed on the rig
receipts: .rig-proof.json and .render-proof.json record omarchySha, qtVersion, quickshellVersion and hyprlandVersion

## Last audit (observational)

date: 2026-11-16 (evidence refreshed for 0.2.2; the grade was not re-scored)
grade: last scored A (96/100) on 2026-08-30 against 0.2.0 with audit-harness 1.3.1
auditor: audit-tests + omarchy-ship for the grade; evidence for 0.2.2 is in TEST_AUDIT.md
p0_gaps: 0
p1_gaps: 0
p2_gaps: 0

## Traceability (observational, updated by audit-tests)

rtm.total_requirements: 11
rtm.by_moscow:
  must: 10 (10 covered, 0 uncovered)
  should: 1 (1 covered, 0 uncovered)
  could: 0
  wont: 0
rtm.orphaned_tests: 0
personas.declared: 2
personas.under_threshold: 0
journeys.declared: 2
journeys.fully_covered: 2
journeys.partial: 0

## Hash manifest

version: 1
last_init: 2026-11-16 after the 0.2.2 folder, scan-limit and key-handling changes
protected_files:
  - tests/TESTING.md policy sections
  - tests/RTM.md MoSCoW tiers
  - tests/JOURNEYS.md criticality
  - stryker.config.json thresholds
