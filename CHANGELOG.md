# Changelog

Notable changes to this plugin.

Entries are derived from this repository's commit history, so every line
corresponds to a real change. The format follows Keep a Changelog and the
project uses Semantic Versioning.

Regenerate after a release with:

```bash
Use the repository's release tooling to add a version section.
```

The generator normalises em and en dashes, because a changelog is shipped prose
and gate c28 refuses them.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-08-29

### Added

- Keyboard selection, named accessibility roles, visible action failures, and theme-derived capture rows.
- Full audit, mutation, adversarial race, stock-runtime smoke, and Buzz E2E lanes.

### Changed

- Removed the non-stock existing-file annotation command; new captures continue through Omarchy's native capture flow.

### Fixed

- Bound every directory entry and filename byte before sorting.
- Retain complete config and capture directory descriptor chains.
- Reject nested model paths and prove config/capture racers actually execute.

## [0.1.0] - 2026-08-25

### Added

- Initial Capture Conveyor plugin.
