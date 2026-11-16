# Security

## Reporting a vulnerability

Use the repository **Security** tab and choose **Report a vulnerability**.
Do not open a public issue first. Expect acknowledgement within a few days.
This is a personal open source project, not a staffed service.

## Runtime boundary

Omarchy plugins run unsandboxed inside the user session and long-lived
Quickshell process. Security-sensitive changes must preserve these rules:

- No credentials in process arguments.
- No shell command assembled from untrusted data.
- Network and local inputs are bounded by count and bytes.
- Untrusted text renders as plain text within explicit bounds.
- Runtime dependencies are limited to software shipped by stock Omarchy.
- Capture Conveyor keeps no persistent state of its own and writes no file. The
  scanner only reads: every directory in the screenshot path and in the config
  path is opened through a held descriptor with `O_NOFOLLOW`, so a symlink or a
  concurrent swap cannot redirect it, and `user-dirs.dirs` and `omasnap.conf`
  are read only when they are regular files owned by the user, at most 8 KiB,
  and are parsed as text, never run.
- The scanner is Perl using core modules only, started by absolute path
  (`/usr/bin/perl`). Perl is on a stock Omarchy install because `git` depends on
  it. No Node.js, Python or Ruby runs.

Passing static gates is not a security audit. Applicable releases also require
review and a clean real-shell verification on the maintainer rig.
