# Security Policy

## Reporting a vulnerability

Report privately through GitHub, not in a public issue: open the
[Security tab](https://github.com/keskiyo/KesVio/security) and choose **Report a vulnerability**.
That opens a private advisory visible only to you and the maintainer.

Please include the KesVio version, your Windows build, what you did, what happened, and what you
expected. A crash needs the steps that reproduce it; a data-handling issue needs the file or
registry path involved. Diagnostics from **Settings → Advanced → Diagnostics log** help, but read
the export first and remove anything you do not want to share.

Expect a first reply within a week. If a report is confirmed, the fix ships in a new patch release,
because published tags are never moved or replaced. You will be credited in the advisory unless you
ask otherwise.

## Supported versions

Only the latest release receives fixes. KesVio is a single-branch desktop application with an
in-app updater; there are no maintained release lines behind the current one.

## In scope

- Code execution, privilege escalation, or persistence caused by KesVio.
- Anything that lets a value KesVio reads — a registry entry, a shortcut, a filename, an update
  manifest — reach execution as a command, path, or argument.
- Bypassing update signature verification, or any path that installs an unverified package.
- Leaking file paths, command lines, credentials, or user data through the webview, logs, exported
  diagnostics, or the network.
- Loss or corruption of the catalog cache or of saved preferences.

## Out of scope

These are known properties of the project, documented in
[README](README.md#code-signing-policy) and [Documentation.md](Documentation.md). Reports about
them will be closed as intended behaviour:

- **The installer is not Authenticode-signed.** There is no code signing certificate behind this
  project, so SmartScreen warns on first run. Verify a download with `SHA256SUMS.txt` and the build
  provenance attestation published with every release instead.
- **Antivirus engines flag the unsigned binary on machine-learning heuristics.** Unsigned desktop
  applications start with no reputation. This is a false positive to be reported to the vendor, not
  a vulnerability in KesVio.
- **KesVio enumerates and can terminate processes**, and launches applications and installers
  through the shell. Both are documented features the user triggers.
- **Scenario close force-terminates applications that ignore a close request after five seconds**,
  which can discard unsaved work. This is stated in the interface before the action runs.
- Findings that require an attacker who already has code execution or administrator rights on the
  machine.

## What the project already does

- The webview is untrusted: IPC accepts catalog IDs only, and the Rust side resolves every target
  from trusted state. Internal paths, command lines and upstream errors never cross IPC.
- KesVio cannot remove software: there is no uninstall capability, and no code path starts a removal.
- Windows APIs live behind `src-tauri/src/platform/windows/`, enforced by
  `scripts/verify-platform-boundaries.ps1`.
- Releases are built by `.github/workflows/release.yml` on GitHub-hosted runners, and each installer
  is published with a minisign updater signature, a SHA-256 checksum, and a build provenance
  attestation. The updater verifies the signature against the public key in `tauri.conf.json`
  before installing anything.
- GitHub Actions are pinned by commit SHA, secret scanning and push protection are enabled, and
  dependency advisories are triaged by `.github/workflows/security-audit.yml`.

KesVio is local-first: no telemetry, no accounts, and no catalog uploads. The only network requests
it makes are update checks and downloads against this repository's Releases.
