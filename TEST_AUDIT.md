# Test Audit: Capture Conveyor

Date: 2026-08-29
Classification: frontend + cli Omarchy plugin
Audit harness: 1.3.1
Registry: `sha256:ffbc75700fb5eb501cb47f1e4038f47ab95ae1fba534b38095e1fe7820c80ed1`

## Result

Grade: A (96/100)

The initial deterministic audit found incomplete directory budgets, nondeterministic
race evidence, an unsupported annotation runtime, accessibility, action-failure,
E2E, smoke, and presentation gaps. Those paths now have implementation evidence.
The web-contract heuristic is not applicable because Capture Conveyor has no API
or network boundary.
Accessibility is implemented with QML roles, names, keyboard handling, and static
assertions; audit-harness 1.3.1 still reports it as advisory because its presence
detector recognizes browser axe packages.

## Layer coverage

| Layer | Status | Evidence |
|---|---|---|
| L1 hooks and CI | Implemented | pre-push gates; exact npm test, race, mutation, audit, and ShellCheck in Actions |
| L2 static | Implemented | Perl compile, ShellCheck, actionlint, npm audit, gitleaks, vendored gates |
| L3 unit | Implemented | node:test, c8, Stryker, CRAP, race stability |
| L4 integration | Implemented | real scanner subprocesses and filesystem fixtures |
| L5 system/security/a11y | Implemented | full path chains, active racers, all-entry bounds, QML keyboard/accessibility contract |
| L6 smoke/E2E/visual | Implemented | stock runtime smoke plus Buzz validator, fixture scan, IPC open, screenshot |
| L7 acceptance | Implemented | two critical journeys, both 100% mapped |

## Gaps

P0: 0 after implementation
P1: 0 after QML-specific adaptation
P2: 0

## Traceability

Eight requirements are mapped: seven MUST and one SHOULD. All are covered.
Both personas and both critical journeys have 100% mapped coverage. No tests are
orphaned.

## Final evidence

- 27/27 tests and 100% Model.js statements, branches, functions, and lines
- Three consecutive active-racer scanner-suite passes with zero flake
- 95.65% mutation score with a 90% blocking floor
- 11/11 canonical Omarchy gates and a current vendored lane
- Zero npm vulnerabilities; actionlint, ShellCheck, Perl syntax, and gitleaks clean
- Buzz: validator 0, qmllint 0, fixture scan, live load clean, IPC panel open, selected-row render inspected

The harness's optional OSV and markdownlint executables are not installed in the
local environment. Dependency authority is enforced by npm audit, and this repo
has fewer than 50 Markdown files with no documentation corpus, so the doc-lint
overlay is not applicable. The harness link check passes.
