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
flaky.tolerance: 0/3runs
test.complexity_ceiling: 15
personas.flow_coverage_min: 100
journeys.step_coverage_min: 100

## Installed gates (observational)

L0: @intentsolutions/audit-harness 1.3.1
L1: pre-push gate lane + GitHub Actions test/gates workflows
L2: Perl syntax, ShellCheck, actionlint, vendored Omarchy gates, gitleaks, npm audit
L3: node:test + c8 coverage + Stryker mutation + CRAP + three-run race stability
L4-integration: real scanner subprocesses and directory/config filesystem fixtures
L5-security: complete path confinement, ready/attacked config and capture racers, symlink/FIFO/oversize/entry/byte bounds
L5-a11y: QML accessibility names/roles, keyboard actions, and bounded plain-text assertions
L6-smoke: stock Perl startup, action contract, and QML-to-Model contract tests
L6-e2e: Buzz Omarchy validator, qmllint, fixture scan, live shell load, IPC open, and screenshot
L6-visual: curated 1920x1200 selected-capture render inspected before submission
L7-UAT: primary capture and hostile-directory journeys mapped in tests/JOURNEYS.md

## Frameworks (observational)

unit: node:test
coverage: c8 12
mutation: Stryker 10
policy: @intentsolutions/audit-harness 1.3.1
e2e: scripts/rig-verify.sh + scripts/rig-render.sh on intent-ops-buzz/omarchy-rig

## Last audit (observational)

date: 2026-08-29
grade: A (96/100)
auditor: audit-tests + omarchy-ship
p0_gaps: 0 after implementation
p1_gaps: 0 after QML-specific adaptation
p2_gaps: 0

## Traceability (observational, updated by audit-tests)

rtm.total_requirements: 8
rtm.by_moscow:
  must: 7 (7 covered, 0 uncovered)
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
last_init: 2026-08-29 during the requested test-system implementation
protected_files:
  - tests/TESTING.md policy sections
  - tests/RTM.md MoSCoW tiers
  - tests/JOURNEYS.md criticality
  - stryker.config.json thresholds
