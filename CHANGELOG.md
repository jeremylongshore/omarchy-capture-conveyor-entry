# Changelog

Notable changes to this plugin.

Entries are derived from this repository's commit history, so every line
corresponds to a real change. The format follows Keep a Changelog and the
project uses Semantic Versioning.

Add a section by hand for each release, from the merged pull requests. Write it
without em or en dashes, because a changelog is shipped prose and gate c28
refuses them.

## [Unreleased]

Nothing yet.

## [0.2.2] - 2026-11-16

### Fixed

- List the folder Omasnap actually saves to. Current Omarchy takes screenshots
  with Omasnap, which writes to `~/Pictures/Screenshots`, but the scanner listed
  `~/Pictures`, so on a stock install the inbox was always empty. The folder is
  now resolved in Omasnap's own order: `OMASNAP_SCREENSHOT_DIR`, then
  `OMARCHY_SCREENSHOT_DIR`, then `[output] directory` in
  `~/.config/omasnap/omasnap.conf`, then `XDG_PICTURES_DIR` plus `/Screenshots`,
  then `~/Pictures/Screenshots`. The `XDG_PICTURES_DIR` environment variable is
  no longer read, because Omasnap and Qt do not read it. `user-dirs.dirs` is now
  read the way Qt reads it, so unquoted and absolute paths work.
- Stop calling a partial list the newest captures. The scan limit is now
  reported separately from the 24-row cap, and the panel says "Scan limit
  reached" instead of "Showing the newest". The limit is 2048 entries and 256
  KiB of names, up from 512 entries, so a folder has to be much larger before it
  applies.
- Show why the inbox is empty. A missing folder, a symlink in the path (which is
  refused, not followed), an unreadable or invalid path, and a folder that
  changed during the scan are each named in the panel with the folder that was
  tried.
- Emit non-ASCII folder and file names as the real path. They were double
  encoded, so copy path and reveal acted on a path that did not exist. A name
  that is not valid UTF-8 is left out.
- Wire the panel's keys through PanelKeyCatcher's signals, as the first-party
  panels do, instead of overriding its key handler. Enter now copies the
  selected path, and Ctrl, Alt and Meta chords no longer trigger the letter
  shortcuts.
- Strip bidirectional override, isolate and Unicode tag characters from
  displayed file names, bound the scanner's output before it is parsed, and
  never cut a surrogate pair at the length cap.
- Take text colours from the theme palette instead of fixed-lightness colours
  that were unreadable on light themes.
- Correct the security notes: the plugin keeps no persistent state, so the
  descriptor-bound lifecycle claim is removed. Refresh the test audit,
  traceability matrix and testing notes to match the current runs, and stop
  claiming CRAP is enforced (intent-audit-harness#248).

### Changed

- Resolve the dev-dependency advisories in brace-expansion, fast-uri, glob,
  minimatch, qs and zod. The overrides now pin qs 6.16.1, glob 14.0.4 and
  minimatch 11.0.5, and `osv-scanner` reports none.
- Re-sync the vendored gate lane to contributing-clanker f79d8c7, whose C42
  reads the Perl scanner and finds its scan budget.
- `scripts/rig-render.sh` takes `OMARCHY_RIG_THEME` to render on another theme,
  so the panel can be checked on a light one.
- Record the Omarchy revision and Qt version in the rig receipts.
- The rig fixture seeds `~/Pictures/Screenshots` with valid PNG files named the
  way Omasnap names them, and the render scans with no folder override.

## [0.2.1] - 2026-11-15

### Fixed

- Qualify Omarchy's palette as `Commons.Color`, as the shell contract requires
  now that Qt 6.12 has its own `Color` type. A contract test fails on any bare
  `Color.` in the shipped QML.

### Changed

- Seed the rig render's isolated home with the current-theme state a real
  Omarchy install has, so first-party shell plugins on current Omarchy do not
  log warnings the render would read as plugin warnings.
- Bump `actions/setup-node` to 7.1.0 and the MiniMax review action to the
  fork's current main (`cfb2c72`), with the audit harness re-pinned.

## [0.2.0] - 2026-08-29

### Added

- Keyboard selection, named accessibility roles, visible action failures, and
  theme-derived capture rows.
- Full audit, mutation, adversarial race, stock-runtime smoke, and Buzz E2E
  lanes.

### Changed

- Removed the non-stock existing-file annotation command; new captures continue
  through Omarchy's native capture flow.

### Fixed

- Bound every directory entry and filename byte before sorting.
- Retain complete config and capture directory descriptor chains.
- Reject nested model paths and prove config/capture racers actually execute.

## [0.1.0] - 2026-08-25

### Added

- Initial Capture Conveyor plugin.
