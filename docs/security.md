# Security model

For reporting vulnerabilities, see [SECURITY.md](../SECURITY.md). For the user privacy policy, see [PRIVACY.md](../PRIVACY.md).

**Owns:** The webview/native trust boundary, trusted-ID resolution, native restrictions, diagnostics safety, network boundaries, and update integrity.

**Read this when changing:**

- IPC inputs or native actions;
- path, process, registry, shell, or logging behavior;
- CSP, Tauri capabilities, updater endpoints, or signing;
- privacy-relevant storage or network behavior.

**Main code:**

- `src-tauri/src/commands/`
- `src-tauri/src/platform/windows/`
- `src-tauri/src/diagnostics/`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`

**Main tests:**

- command and platform security tests under `src-tauri/`
- `tests/frontend/entities/ipcContract.test.ts`
- `scripts/verify-platform-boundaries.ps1`
- updater-signature and release-contract tests

**Related:**

- [IPC and data](ipc-and-data.md)
- [Desktop operations](desktop-operations.md)
- [Development and releases](development.md)
- [Troubleshooting](troubleshooting.md)

## Trust boundary

- Catalog discovery, classification and preferences are local; no telemetry,
  catalog upload or online metadata lookup is configured.
- CSP and Tauri capabilities are least-privilege. Do not widen capabilities,
  CSP, updater keys/endpoints, bundle identifier or publisher without explicit
  approval.
- Inbound IDs and payload sizes are validated before lookup, filesystem work or
  memory allocation. The backend resolves display data separately from command
  targets.
- Folder actions accept only existing trusted local folders. UNC, device,
  relative and packaged-app paths are refused.
- Native process execution uses a fixed executable plus argument vector, never
  a shell string. Registry, shortcuts, filesystem entries and IPC payloads are
  untrusted.
- A launched executable starts in its own directory, the way Explorer starts it.
  Leaving the shell's working directory unset handed the child this process's
  own directory, so anything it wrote relative to it landed in the catalog's
  folder — Rufus dropped its `rufus.com` console companion there. Shortcuts keep
  the working directory recorded in the `.lnk`; AppUserModelIds and `steam://`
  URIs have no directory of their own and pass none.
- Signature checks do not show Windows UI or fetch network data. Logs and
  diagnostics exclude credentials, file contents and unnecessary personal paths.
- Unsafe Windows code is confined to `platform/windows`; every unsafe block has
  an adjacent `// SAFETY:` rationale.
- The installer is not Authenticode-signed and can show SmartScreen; updater
  package integrity is protected by its separate signature.
- Because the binary is unsigned and every release starts at zero reputation,
  behaviour that reputation-based antivirus scores heavily is avoided on
  purpose: no interpreter is started, and `mainBinaryName` ships the executable
  as `KesVio.exe` rather than the Cargo package's generic `app.exe`. The
  NSIS template records `MainBinaryName` in the uninstall key and deletes the
  previously installed binary when the name changes, so an update from a build
  that shipped `app.exe` leaves nothing behind.
- Kaspersky's proactive defence module scored the `HKCU` Run value that the
  0.3.8 **Launch when Windows starts** toggle wrote, and returned
  `PDM:Trojan.Win32.Generic` for an unsigned binary with no reputation. The Run
  value is gone; `scripts/verify-platform-boundaries.ps1` forbids Run values,
  Startup-folder APIs and shell indirection throughout the backend. The
  installer creates a Startup shortcut, because that is ordinary installer
  behaviour and is what makes the entry appear in Windows' own Startup apps
  page, and registers it disabled. The one startup write the program still
  performs is today's **Launch when Windows starts** switch, which changes the
  `StartupApproved` byte of that installer-owned shortcut — the value Explorer
  writes — and never the shortcut, the Run key or a task. What was scored was a
  _running_ program creating its own persistence, not a program toggling an
  entry the installer declared and the user controls.
- The critical and session process tables that protect Windows from a close
  scenario are stored as digests of the process names. A release binary
  therefore does not carry `lsass.exe`, `csrss.exe` or `winlogon.exe` as
  literals beside its `TerminateProcess` import, which static classifiers read
  as a credential-dumper signature. The readable names live in test code only.
- The application spawns no child process at all. Running a registered
  uninstaller was the only one, and it went with the uninstall feature; a process
  that starts another process to remove installed software is a scored behaviour,
  and the strongest version of not being scored for it is not doing it.
- A copy that has already resolved its data folder never probes it again. The
  earlier build created and deleted `KesVioData\write-probe.tmp` on every start;
  an unsigned binary repeatedly testing whether it can write into its own install
  directory is a dropper pattern, and the answer cannot change between launches.

## Native capabilities

Every capability the program uses, when it runs, and what bounds it. Nothing here
is discretionary: each row is enforced by the boundary scripts, the capability
file or a named test.

| Capability                                                       | When it runs                                                             | Bound                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Read the uninstall registry hives, Start Menu, AppsFolder, Steam | Startup, refresh, watcher, Force full scan                               | Read-only. Stage budgets and cancellation bound every loop.                                                                                                                                      |
| Walk fixed drives for portable executables                       | Force full scan, plus the first routine scan without a portable snapshot | Requires the discovery toggle. Later startup, refresh and watcher scans retain fixed-drive results instead of walking those drives.                                                              |
| `ShellExecuteExW` / `ShellExecuteW`                              | Launching or opening a catalogued entry                                  | Target resolved from a catalog id held in trusted state, never from the webview.                                                                                                                 |
| `CreateToolhelp32Snapshot`, `OpenProcess`, `TerminateProcess`    | The explicit close action of a scenario                                  | `WM_CLOSE` first; terminate only on refusal; batch capped; protected processes and this process excluded.                                                                                        |
| Remove installed software                                        | Never                                                                    | There is no such capability. No code path starts a removal; the card menu opens the Windows page instead.                                                                                        |
| Write one `HKCU` value (`Software\keskiyo\KesVio`)               | Startup, only when the install directory changed                         | Read before write. Together with the row below, the only registry writes the running program performs.                                                                                           |
| Register a disabled Startup entry                                | The installer, on a fresh install only                                   | Shortcut plus a `StartupApproved` value marked disabled. Never on update; the running program cannot.                                                                                            |
| Flip the Startup entry on or off                                 | The **Launch when Windows starts** switch                                | One `REG_BINARY` under `HKCU\…\Explorer\StartupApproved\StartupFolder`; refused when the shortcut is absent; never the shortcut, `Run`, a task or a service.                                     |
| Write files                                                      | Catalog cache, scan settings, window state, logs                         | Only under the resolved data root. Atomic replace; identical values are not rewritten.                                                                                                           |
| Network                                                          | The update check, and a download the user starts                         | GitHub release endpoint only. Checks time out after 30 seconds; downloads after 15 minutes. Automatic checks are throttled to one per four hours, and back off to a day after repeated failures. |

There is no telemetry, no account and no background upload. The one persistence
entry is the Startup shortcut the installer registers **disabled**, which exists
so Windows can offer the choice; the running program cannot create it, and the
Settings switch changes only its on/off approval value — the same value Windows
Settings changes.

KesVio also cannot remove software. There is no uninstall surface at all: no
command, no `Management_Deployment` WinRT feature, no stored record of removals,
and `AppInfo` carries no uninstall command. `git grep Command::new src-tauri/src`
returns nothing, which is the whole point: the claim is checkable rather than
trusted. What exists is `canUninstall`, a boolean that means "Windows has a
registered uninstaller for this entry". It is evidence, not a capability, and it
is load-bearing: `visibility/mod.rs` gives a registry entry 35 points and the
`RegisteredProduct` reason for it, so removing it would quietly change which
applications the catalog shows. The card menu turns that flag into **Uninstall**,
which opens `ms-settings:appsfeatures` rather than removing anything; an entry
Windows cannot uninstall shows a disabled **Uninstall unavailable** instead. The registry
`…\CurrentVersion\Uninstall` hives are still read, because they are how installed
software is discovered in the first place.

## Diagnostics and redaction

Diagnostics are local and bounded. Export and preview share the same collection and redaction path; there is no raw-export mode. Paths, URLs, recognized identities, and recognized private-key values are replaced with stable tokens within one export, while source, generation, error code, duration, timestamps, and thread IDs remain useful. The exact storage, retention, collection limits, and compatibility behavior are owned by [IPC and data](ipc-and-data.md#persisted-stores).

## Update and release integrity

The runtime updater accepts only the configured GitHub release endpoint and verifies the downloaded installer with the public key in `tauri.conf.json`. The private key exists only in CI. Architectural integrity rules live here; operator commands and the tag-only release pipeline live in [Development and releases](development.md).

## Related documentation

- [IPC and data](ipc-and-data.md)
- [Desktop operations](desktop-operations.md)
- [Development and releases](development.md)
- [Troubleshooting](troubleshooting.md)
