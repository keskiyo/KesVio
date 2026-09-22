# Desktop operations

**Owns:** Native launch and close behavior, Windows uninstall handoff, tray, startup, window lifecycle, WebView2, and runtime updater behavior.

**Read this when changing:**

- application launch or scenario close;
- tray menus, global shortcuts, or startup integration;
- window geometry, hide/quit behavior, or single-instance handling;
- update checks, downloads, installation, restart, or WebView2 setup.

**Main code:**

- `src-tauri/src/platform/windows/`
- `src-tauri/src/lifecycle/`
- `src-tauri/src/commands/`
- `src/features/update-app/`
- `src/entities/system/`

**Main tests:**

- backend lifecycle, platform, process, and updater tests
- `tests/frontend/features/update-app/`
- `tests/frontend/entities/system/`
- installer configuration tests under `tests/frontend/config/`

**Related:**

- [IPC and data](ipc-and-data.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)
- [Development and releases](development.md)

## Native launch and close

Launch uses a trusted catalog target through the Windows shell. Launch feedback
clears from a backend input-idle signal when available, otherwise from a bounded
client fallback. A launch action does not expose arbitrary command execution.

Close operates on trusted process identities, not visible windows alone. It
first requests normal close, then performs a bounded recheck before terminating
survivors. The application process, Windows-critical images and unsafe process
groups are excluded. Store/URI entries without a safe executable close target
are reported unavailable. Steam closes by its exact `steam.exe` target, never
by the Steam installation directory, so games remain explicit Scenario entries.

Termination revalidates identity on the handle that performs it. A pid names a
process only while that process lives; between enumeration and termination the
target can exit and Windows can reissue the number. `processes::terminate_matching`
therefore opens one handle with `PROCESS_QUERY_LIMITED_INFORMATION |
PROCESS_TERMINATE`, reads the image back through that same handle, and calls
`TerminateProcess` only when the image still matches the `CloseTarget` the pid
was selected for. A handle pins one process, so an image read through it cannot
describe a different one, and a reused pid is refused rather than killed.

## Uninstall handoff

KesVio does not uninstall anything, and deliberately never will: removing
software is the highest-consequence code a catalog could carry, it would mean
keeping a persisted record of what the user had removed from their PC, and
Windows already does the job. What exists instead is `canUninstall`, which
reports that Windows has a registered
uninstaller for the entry and earns it 35 visibility points as a registered
product, plus a menu item that opens the Windows page. Reading the
`…\CurrentVersion\Uninstall` hives continues, because that is how installed
software is discovered.

The product no longer starts `powershell.exe` anywhere. `cargo clippy` enforces
it: removing the last call site left `exec_target::system_powershell` unused and
failed the build under `-D warnings`, so the helper is gone and a new caller
would have to reintroduce it deliberately.

## Windows integration and updates

- Tray, global shortcut and window lifecycle are backend-owned. The tray menu is
  the one part rebuilt at runtime: the icon keeps its `kesvio` id, and a scenario
  update reaches it through `tray_by_id` on the main thread. A failure there is
  logged and leaves the previous menu standing rather than surfacing an error the
  user cannot act on.
- A fresh direct installation registers startup and leaves it **switched off**.
  Windows lists nothing it has no entry for, so the installer creates
  `$SMSTARTUP\KesVio.lnk` and, in the same guarded block, writes a
  `StartupApproved\StartupFolder` payload whose first byte is `0x03` — the value
  Explorer itself writes for a disabled entry. The result is a row under
  **Settings → Apps → Startup** that the user can switch on. Both installer hooks
  are guarded on `$UpdateMode <> 1`, so an update through the updater neither
  recreates the shortcut nor resets the choice. A `setup.exe` run by hand over
  an existing copy is not an update: there the install hook writes the disabled
  payload only when no `KesVio.lnk` value exists yet (NSIS has no `ReadRegBin`,
  so it enumerates the key's value names), and the uninstall hook keeps the
  shortcut and the value when the installer itself runs the uninstaller — that
  run carries `_?=<dir>`, which a user-started uninstall from Apps & features
  never does. So a fresh install lands switched off, a reinstall or manual
  upgrade keeps the choice, and only a real uninstall removes the entry.
  Uninstallers shipped with 0.5.1 and earlier still delete it on the "uninstall
  first" path, after which the new installer registers the entry disabled again.
- **Launch when Windows starts** on the Settings page flips that same value and
  nothing else: `platform/windows/registry/startup_approval.rs` writes the
  twelve-byte payload with `0x02` (on) or `0x03` (off) under
  `HKCU\…\Explorer\StartupApproved\StartupFolder\KesVio.lnk`, and reads the state
  back from Windows every time `get_system_settings` runs — an absent value or an
  even first byte is on, an odd one is off. Windows Settings, Task Manager and
  KesVio therefore always agree. The shortcut itself is never created, moved or
  deleted by the program: when `Startup\KesVio.lnk` is missing (another user on a
  per-machine install, or a hand-deleted file) the switch is disabled and the row
  says to reinstall. No window opens.
- A launch from that shortcut (`--autostart`, tray ready) is a **quiet start**:
  the process lowers itself to `BELOW_NORMAL_PRIORITY_CLASS` before the window is
  prepared, and `start_background_sync` waits up to 60 seconds on a `Condvar`
  gate (`lifecycle/quiet_start.rs`) before the startup scan; the cached catalog,
  the tray and the global shortcut are live immediately. The first
  `show_main_window` — tray click, Win+Shift+Q or a second launch — ends the quiet
  start: priority returns to normal and the gate releases the scan at once.
  Watcher and volume scans are never deferred.
- The running executable still has no startup-registration API.
  `scripts/verify-platform-boundaries.ps1` fails the build if `CurrentVersion\Run`,
  `FOLDERID_Startup`, `shell:startup`, `SMSTARTUP` or `StartupApproved` appears
  in any Rust file other than `startup_approval.rs` (and `FOLDERID_Startup` in
  `known_folders.rs` for its read-only lookup), and fails again if
  `startup_approval.rs` itself names `IShellLink`, the Run key, a file write, a
  file copy or removal, `Command::new` or `ShellExecute`. What Kaspersky scored as
  `PDM:Trojan.Win32.Generic` was a running unsigned binary writing its own
  persistence; flipping the approval bit of an entry the installer declared is
  the one write the program keeps.
- The main window is created hidden and painted with the canvas colour, and it
  is shown only after saved geometry has been applied. A window created visible
  first flashed white and then jumped to its restored position; there is nothing
  to see between those two moments, so it is not shown.
- Position, size and the maximized flag are remembered per user. The window is
  restored onto whichever connected monitor holds most of it, clamped inside
  that monitor and to the minimum window size; geometry that no longer overlaps
  any monitor — the second display was unplugged — is discarded and the window
  opens at its configured default instead. A minimized window keeps the last
  geometry it had, and a maximized one keeps the rectangle it will restore to
  rather than the screen it currently fills. The geometry is tracked in memory
  while the window moves and written when the window closes, when the tray
  quits, and half a second after a move or resize has stopped. The settled write
  exists because an update, a Windows shutdown or a kill ends the process with
  no close event: with the close as the only write, the next start restored the
  size from the last close rather than the size the window had, which read as
  the window reopening larger than it was left. One waiter serves a burst of
  events, it gives up after ten seconds of continuous movement, and the write
  is the same no-op-when-unchanged write the close performs, so a drag costs one
  file write at its end. Both the restore and each write are logged with the
  geometry they saw. The stored size is the inner size, because `set_size` restores an inner
  size: storing the outer one instead added the invisible resize border —
  sixteen pixels wide, nine tall — back on every start, and the window grew by
  that much each time it was reopened. The position is the outer position, which
  is what `set_position` takes.
- Closing the window hides KesVio in the notification area, and
  **Settings → Keep running in the tray** turns that into an ordinary quit. The
  flag lives in `LifecycleState`, so the close handler reads it without touching
  the disk; `set_close_behavior` writes the document and restores the previous
  value if that write fails, because a setting the interface shows and the disk
  does not hold is worse than a refused change. Quitting from the tray still
  quits whatever the setting says.
- Startup does no discovery work on the main thread. Tray creation and the
  window are the only things `setup` performs; global-shortcut registration,
  the cached catalog, the change watcher and the installed-copy registry sync
  run on one background task afterwards. Settings therefore reports the shortcut
  as unregistered for the moment before that task completes.
- When WebView2 is missing, the installer runs Tauri's embedded bootstrapper
  (`embedBootstrapper`). The bootstrapper downloads the runtime from Microsoft,
  so this installation step requires internet access. A machine with WebView2
  already installed can use the local catalog offline.
- The updater fetches the release manifest over HTTPS on startup. An available
  version is announced by a dismissible banner in the shell notice area beside
  the stale-copy and preference-write notices; it never opens a dialog by
  itself. The update dialog opens only from the banner's action, and download,
  verification, installation and restart remain modal from that point.
- Installer verification follows the trust contract in
  [Security model](security.md#update-and-release-integrity) before installation.
- Download progress reports real bytes/percentage; verification, installation
  and restart are indeterminate stages. Manifest checks have a thirty-second
  request timeout and user-started downloads have a fifteen-minute timeout.
  Update failures retain a safe retry UI.
- The downloaded installer runs in NSIS passive mode: non-interactive, but with
  a visible progress window. An unsigned installer that runs itself with no
  window at all is the shape of behaviour that heuristics score, and the user
  has no way to tell the update apart from something else starting.
- Update checks are silent offline, when current, and outside the desktop
  runtime used by browser development/tests.
- The automatic check runs at most once every four hours, and the clock is
  recorded whether the check succeeded or failed. Recording only successes would
  leave the throttle disengaged wherever the release endpoint is unreachable, so
  a managed network that blocks GitHub would see a blocked outbound connection
  from an unsigned binary on every single launch. Consecutive failures then
  double the interval — four hours, eight, sixteen — capped at a day, and one
  success resets the count. **Automatic update checks** in Settings turns the
  automatic check off entirely; it is on by default, persists in
  `kesvio.automatic-update-checks`, and survives restarts and updates. The
  switch lives in the updater slice rather than the preferences document because
  the slice already owns its own storage keys and the answer is per-machine: a
  managed workstation that must not reach GitHub should not carry that setting
  into a backup restored on a personal one. **Check for updates** ignores all of
  it, so a reader who has turned the automatic check off can still ask. The check
  is
  triggered by application start rather than by a running timer, so the interval
  is a floor between attempts and never a fixed period on the wire.

## Tray behavior

The backend owns the tray model and rebuilds the native menu only when its stored model changes. The stable layout is **Open KesVio**, **Search**, optional **Favorite apps**, optional **Scenarios**, **Force scan**, and **Quit**. Labels are presentation only; static or checked IDs decide actions.

The frontend sends bounded, sanitized IDs and labels for favorites and scenarios, and native clicks return only IDs or fixed events. Search and force-scan intents survive listener registration races through one-shot backend intent state. Force scan reuses the ordinary store action and is disabled before listener readiness and while startup or scanning is busy. Tray startup stays hidden; the first explicit show restores normal priority and releases the deferred startup scan.

Detailed tray payload and event contracts are recorded in [IPC and data](ipc-and-data.md#ipc). Interaction copy and scenario behavior are recorded in [UI and workflows](ui-and-workflows.md).

## Related documentation

- [IPC and data](ipc-and-data.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)
- [Development and releases](development.md)
