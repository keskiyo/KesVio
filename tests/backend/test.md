# Backend test map

The Rust backend has no external integration-test crate. Tests live next to the
modules they exercise in `#[cfg(test)]` blocks so they can validate private and
`pub(crate)` behaviour without widening production APIs.

Snapshot: `v0.5.1` plus the working tree after it.

- Rust: **856 test entries** in **136 source files**; one developer-only test is
  ignored in the normal run, so a green suite reports 855 passed. The ignored
  case is `catalog/golden/timings.rs`, which prints stage medians instead of
  asserting a threshold. Removing the uninstall feature deleted
  `platform/windows/uninstall/`, `commands/uninstall.rs` and
  `app_state/uninstall.rs` along with their cases, and left one invariant behind
  that is now guarded on purpose: `can_uninstall` is the evidence that an entry
  is a registered product, worth 35 points in `visibility/mod.rs`, so
  `sync/document.rs` proves it survives a cache round trip with its score intact
  and `storage/cache.rs` proves the cumulative cache migrations preserve supported
  documents through schema 11 while dropping the legacy stored command
  without touching the flag. Moving every store beside the executable added
  `paths/`, where `portable.rs` proves that a root is created and probed once and
  adopted without probing afterwards, that a debug build creates none, and that
  an occupied name is declined; `adopt.rs` proves the one-way copy never refills
  a destination that already exists; and `mod.rs` proves an unmanaged or
  unresolved location defers to the Tauri per-user folder.
  `catalog/platform_kind.rs` maps a source or its Battle.net evidence to the
  badge the card shows. Several modules became directories and carry their
  cases in a `tests.rs` beside the code: `catalog/dedup/merge/`,
  `catalog/sources/start_apps/`, `catalog/sync/portable/`,
  `catalog/sync/scan_sources/portable_sources/` (root selection, with the
  fixed-drive rules under `roots/`), `catalog/sync/scan_steps/` (the stall
  watchdog: the threshold, the repeat interval, the reused detail buffer, and a
  thread that stops before its next poll rather than after it) and
  `platform/windows/apps_folder/`. `catalog/scan/settings.rs` and
  `lifecycle/window_state.rs` each prove that rewriting the stored value is a
  no-op while a malformed or unsupported document is still replaced.
  `diagnostics/export.rs` holds the XML document together — a plugin-formatted
  line becomes a structured entry, a line the logger did not write is kept
  verbatim, markup and control characters cannot escape their element, the
  export keeps only the newest lines, an event older than two hours is dropped
  even from a file written a moment ago, the `@seconds` prefix is stripped from
  an entry while a malformed one is kept verbatim, segments are read in
  time order, and the document is redacted before it is escaped so a private
  location keeps one correlated token; `diagnostics/redaction.rs` proves a
  path, a URL, a quoted or multi-line secret and a bearer credential leave no
  fragment, a repeated location keeps one token across lines and letter case,
  and a short account name from the environment is matched only as a whole
  word, while `diagnostics/redaction_paths.rs` proves where an unquoted
  location ends and `diagnostics/log_collection.rs` proves the export reads a
  bounded window of files — `diagnostics/retention.rs` proves a segment expires only once its
  last possible event is two hours old, a segment dated ahead of the clock is
  kept inside the window and dropped beyond it, legacy files keep the
  modification-time rule, the folder cap removes the oldest segments first, a
  locked file is reported as failed rather than counted as removed, and a
  missing directory is not an error; `diagnostics/segment_writer.rs` proves
  ten-minute buckets, the four-megabyte roll to a numbered file, the eight-
  kilobyte single-line bound and the process id in the name;
  `diagnostics/log_sink.rs` proves lines logged before the folder is known are
  flushed first and in order from a bounded buffer; `diagnostics/retention_worker.rs`
  proves the worker prunes at once, keeps its interval and stops promptly.
  `app_state/catalog_generation.rs` proves a cache reset cannot reuse a
  published generation, a restart continues from the stored one and exhaustion
  never wraps. `diagnostics/panic_log.rs` proves a panic is recorded
  with its location and stack but never its payload, and
  `diagnostics/operation.rs` proves an operation's timing line names it.
  The lifecycle module keeps the close-to-tray decision in `lifecycle/state.rs`,
  which now also proves the two rules behind settled persistence — every
  geometry change advances a generation, and only one persist waits at a time —
  and window geometry in `lifecycle/window_state.rs`, where a window from a
  disconnected monitor, one hanging off an edge, one larger than its screen and
  a maximized one each have a named case, and a resize reaches the stored state
  without a close, because an update, a shutdown or a kill ends the process
  without one. `lifecycle/presentation.rs` keeps ordinary startup hidden until
  the frontend readiness event while tray-backed autostart remains hidden.
  `lifecycle/state.rs` also proves the quiet-start rules — a fresh session is
  not one, it ends exactly once, and ending it releases a deferred startup scan
  — while `lifecycle/quiet_start.rs` proves the gate itself: an unwoken wait
  returns at the timeout, a wake from another thread ends it early, and a wake
  issued before the wait is not lost. `platform/windows/process_priority.rs`
  proves each own-priority level maps to its Windows class, and
  `platform/windows/registry/startup_approval.rs` proves the `StartupApproved`
  byte rule (absent or even first byte is enabled, odd is disabled), that the
  payload written matches Explorer's and the installer's, that the value name is
  the shortcut file name, and that the state serializes as a lowercase word.
  `lifecycle/tray/menu/` proves the tray menu: every static id maps to one
  explicit action while the withdrawn status and pause ids map to nothing, a
  `scenario:<id>` or `favorite:<id>` menu id carries the id it runs and rejects
  an empty or over-long one, two favorites with the same name stay
  distinguishable, a label reaches the native menu with control characters
  stripped, `&` escaped and a long name truncated, a starred entry keeps its
  mark through truncation, a hollow star fills the column only when something
  is starred, an entry that omits the flag parses as unstarred, and the menu
  copy the user learned is pinned word for word;
  `lifecycle/tray/model.rs` proves the model reports only real changes;
  `lifecycle/tray/search.rs` proves a search intent raised before the listener
  existed is taken exactly once; `commands/tray.rs` proves the commands cap the
  scenario and favorite lists, drop blank or over-long ids, clear the tooltip
  for a blank label and bound the running label before any of that.
  `commands/contract.rs`
  serializes every IPC payload and event and compares the shape against a
  recorded fixture, so a renamed or retyped field is reported as a contract
  change rather than reaching the webview; the recorded settings sample carries
  a fixed `0.0.0-sample` version so a release bump never leaves the fixture
  stale. The same fixture records `errorCodes` from `AppError` itself, which is
  what the frontend holds `APP_ERROR_CODES` against.
- Frontend: **1035 Vitest tests** in **133 files**; it is documented here only to
  distinguish the two suites.
- Two fixture corpora carry the catalog rules rather than the test bodies:
  **250 records** in `catalog_categories.json` and **30** in
  `catalog_visibility.json`. Both include negative guards, so a rule that starts
  matching too much fails a named case instead of silently widening. Two guards
  earned their keep the day they were written. The Realtek digital-output record
  rejected a rule that read a bare vendor name as evidence, and the Windows SDK
  record — a Start Apps entry whose target resolves to `explorer.exe` — rejected
  a rule that would have believed a name over the evidence behind it.
- Backend tests must be deterministic. Filesystem/cache tests use
  `tempfile::tempdir()` and never inspect real user directories, registry data,
  network state, or installed applications.

## Run

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

```powershell
cargo test --manifest-path src-tauri/Cargo.toml catalog::dedup::tests
```

The second form runs one module's tests. Add `--no-fail-fast` to report every
failure. The release gate also runs `cargo fmt --check` and Clippy with
`-D warnings`.

## Catalog

The catalog suite protects source discovery, installer/document separation,
classification, conservative visibility, duplicate merging, trusted target
resolution, cache migration, bounded scans, source-snapshot retention, icon
hydration and deterministic catalog output. `catalog/mod.rs` keeps the model and
assembly; Start Menu traversal, close-scope classification and stable identity
moved to `catalog/start_menu.rs`, `catalog/close.rs` and `catalog/identity.rs`,
and their tests moved with them. Cache tests also cover refusing to overwrite a
document written by a newer schema version.

The walk skips three kinds of folder that hold executables nobody installed —
the Windows side of a Wine build, browser-automation caches and package-manager
interpreters — and `sources/portable.rs` names each with the folder that must
still be walked beside it. `tree.rs` holds the two companion rules: a portable
executable nested below a folder that holds a same-publisher executable, and a
sibling of a Start Menu target inside a folder named after that target's product,
with the shared downloads folder and the subfolder case as the named negatives.
`scan_sources/portable_sources/roots/` also proves the scan-folder stamp every
portable record carries — the deepest added folder that contains it, matched
without regard to case or a trailing separator, and nothing for a record a
fixed-drive walk found on its own — and `storage/cache.rs` proves a document
written before that field loads with it absent. The same module separates a
missing folder from a missing drive: a folder that is gone from a mounted drive
stays retained in every scan mode, a scan folder whose letter is not mounted is
neither scanned nor retained in any of them, the rule that retains previous
non-fixed roots skips that letter as well, and a drive that has come back is
walked again. `sync/volumes.rs` proves which volume letters matter — the letter
of any configured folder, whatever its case or depth, and nothing for another
letter, a UNC path or an empty list — and that an arriving letter holding a
tracked volume or a removed letter where one was mounted refreshes too, while
a configured letter never needs an identity read. `catalog/volumes.rs` proves
how a configured folder follows its volume: the volume at the configured
letter is learned, a tracked volume mounted at one other letter is followed
there, the same serial at two letters is an ambiguity that is not remapped, a
reformatted or foreign volume at the letter gets its own key while the tracked
entry is kept, an absent volume leaves the folder unmounted, a letter whose
identity cannot be read is scanned without a volume, UNC and relative folders
are never volumes, an entry for a folder that left the settings is dropped,
and folders and letters match regardless of case; the roots tests add that a
followed folder is walked at its new letter while the old letter's records
drop, and that a record under it is stamped with the place it is and its
volume. `dedup/mod.rs` proves the preference identity follows a tracked volume
across drive letters while another volume or an untracked copy stays
distinct, and that a target on another letter keeps its letter.
`sync/retry.rs` proves the bounded recovery after a failed scan: only a
provider that did not answer, a stage that timed out or a configured folder
that could not be reached asks for a retry (a cancelled stage and a hit entry
bound do not), several failed sources share one watch scope, the budget grants
three attempts at 5, 20 and 60 seconds and then waits for a successful scan,
a reset or a cancel invalidates the planned attempt, a scheduled retry fires
once after its delay only while its generation is current, and dropping the
guard stops a pending retry without waiting out the delay; the roots tests
add that only a retained folder counts as unreachable.
`product_duplicates.rs` proves one row per portable
product: helpers stamped with the product name collapse to the executable named
after it, the sanitized catalog keeps one row per product and does not change
under a second sanitize, architecture variants keep the 64-bit build, the
executable whose description is the product name outranks its helpers, an
executable a shortcut or an App Paths registration points at is never
rejected, a primary build outranks an auxiliary one, two unpublished builds
side by side whose stems differ only by the architecture marker collapse while
an unpublished stranger in another folder or with another stem does not, and
different versions, publishers, installers and unversioned names are all kept;
the marker split reads `DiskInfo64A`, `gpushark_x64` and `wish86` and leaves
`x64` alone.
`scan/incremental/mod.rs` proves that a
directory record reused from the index takes its display name from the current
naming rules rather than from the name cached with it, without reading the
executable again, and that the rebuilt index carries the corrected name.

Classification is proved by the fixture corpus rather than by hand-written
cases, so a new rule is a data change with a named record behind it.
`classify/signals.rs` covers the inputs that must count as _no_ evidence —
a `.mui` resource stub standing in for the real executable, and packaging-toolkit
publisher/product/description — because those are unit-level facts that no
corpus entry can pin down on its own.

| Module                                                                                                                                       |     Tests |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------: |
| [`catalog/artifact/documentation.rs`](../../src-tauri/src/catalog/artifact/documentation.rs)                                                 |         7 |
| [`catalog/artifact/installer.rs`](../../src-tauri/src/catalog/artifact/installer.rs)                                                         |        18 |
| [`catalog/classify/mod.rs`](../../src-tauri/src/catalog/classify/mod.rs)                                                                     |        15 |
| [`catalog/classify/signals.rs`](../../src-tauri/src/catalog/classify/signals.rs)                                                             |         5 |
| [`catalog/classify/tables.rs`](../../src-tauri/src/catalog/classify/tables.rs)                                                               |         5 |
| [`catalog/close.rs`](../../src-tauri/src/catalog/close.rs)                                                                                   |         6 |
| [`catalog/dedup/merge/tests.rs`](../../src-tauri/src/catalog/dedup/merge/tests.rs)                                                           |         7 |
| [`catalog/dedup/mod.rs`](../../src-tauri/src/catalog/dedup/mod.rs)                                                                           |        78 |
| [`catalog/details/cache.rs`](../../src-tauri/src/catalog/details/cache.rs)                                                                   |         1 |
| [`catalog/details/read.rs`](../../src-tauri/src/catalog/details/read.rs)                                                                     |         4 |
| [`catalog/details/target.rs`](../../src-tauri/src/catalog/details/target.rs)                                                                 |         6 |
| [`catalog/display.rs`](../../src-tauri/src/catalog/display.rs)                                                                               |         2 |
| [`catalog/filters.rs`](../../src-tauri/src/catalog/filters.rs)                                                                               |         2 |
| [`catalog/golden/mod.rs`](../../src-tauri/src/catalog/golden/mod.rs)                                                                         |         5 |
| [`catalog/golden/properties.rs`](../../src-tauri/src/catalog/golden/properties.rs)                                                           |         7 |
| [`catalog/golden/timings.rs`](../../src-tauri/src/catalog/golden/timings.rs)                                                                 | 1 ignored |
| [`catalog/identity.rs`](../../src-tauri/src/catalog/identity.rs)                                                                             |         4 |
| [`catalog/machine.rs`](../../src-tauri/src/catalog/machine.rs)                                                                               |         2 |
| [`catalog/mod.rs`](../../src-tauri/src/catalog/mod.rs)                                                                                       |        55 |
| [`catalog/model.rs`](../../src-tauri/src/catalog/model.rs)                                                                                   |         1 |
| [`catalog/naming.rs`](../../src-tauri/src/catalog/naming.rs)                                                                                 |         2 |
| [`catalog/place.rs`](../../src-tauri/src/catalog/place.rs)                                                                                   |         4 |
| [`catalog/platform_kind.rs`](../../src-tauri/src/catalog/platform_kind.rs)                                                                   |         6 |
| [`catalog/product_duplicates.rs`](../../src-tauri/src/catalog/product_duplicates.rs)                                                         |         9 |
| [`catalog/registry_enrichment.rs`](../../src-tauri/src/catalog/registry_enrichment.rs)                                                       |         4 |
| [`catalog/scan/coordinator.rs`](../../src-tauri/src/catalog/scan/coordinator.rs)                                                             |         9 |
| [`catalog/scan/hydration/icon.rs`](../../src-tauri/src/catalog/scan/hydration/icon.rs)                                                       |         4 |
| [`catalog/scan/hydration/mod.rs`](../../src-tauri/src/catalog/scan/hydration/mod.rs)                                                         |         2 |
| [`catalog/scan/hydration/queue.rs`](../../src-tauri/src/catalog/scan/hydration/queue.rs)                                                     |         3 |
| [`catalog/scan/hydration/sources.rs`](../../src-tauri/src/catalog/scan/hydration/sources.rs)                                                 |         3 |
| [`catalog/scan/incremental/mod.rs`](../../src-tauri/src/catalog/scan/incremental/mod.rs)                                                     |        16 |
| [`catalog/scan/incremental/walk.rs`](../../src-tauri/src/catalog/scan/incremental/walk.rs)                                                   |         1 |
| [`catalog/scan/settings.rs`](../../src-tauri/src/catalog/scan/settings.rs)                                                                   |         5 |
| [`catalog/sources/installer_cache.rs`](../../src-tauri/src/catalog/sources/installer_cache.rs)                                               |         3 |
| [`catalog/sources/portable.rs`](../../src-tauri/src/catalog/sources/portable.rs)                                                             |        12 |
| [`catalog/sources/portable_candidate.rs`](../../src-tauri/src/catalog/sources/portable_candidate.rs)                                         |         2 |
| [`catalog/sources/registry.rs`](../../src-tauri/src/catalog/sources/registry.rs)                                                             |        11 |
| [`catalog/sources/source.rs`](../../src-tauri/src/catalog/sources/source.rs)                                                                 |         4 |
| [`catalog/sources/start_apps/package.rs`](../../src-tauri/src/catalog/sources/start_apps/package.rs)                                         |         4 |
| [`catalog/sources/start_apps/tests.rs`](../../src-tauri/src/catalog/sources/start_apps/tests.rs)                                             |        10 |
| [`catalog/sources/steam.rs`](../../src-tauri/src/catalog/sources/steam.rs)                                                                   |         7 |
| [`catalog/start_menu.rs`](../../src-tauri/src/catalog/start_menu.rs)                                                                         |         7 |
| [`catalog/storage/cache.rs`](../../src-tauri/src/catalog/storage/cache.rs)                                                                   |        23 |
| [`catalog/storage/icon_cache.rs`](../../src-tauri/src/catalog/storage/icon_cache.rs)                                                         |        13 |
| [`catalog/sync/delta.rs`](../../src-tauri/src/catalog/sync/delta.rs)                                                                         |         2 |
| [`catalog/sync/document.rs`](../../src-tauri/src/catalog/sync/document.rs)                                                                   |         7 |
| [`catalog/sync/health.rs`](../../src-tauri/src/catalog/sync/health.rs)                                                                       |         7 |
| [`catalog/sync/hydration.rs`](../../src-tauri/src/catalog/sync/hydration.rs)                                                                 |         1 |
| [`catalog/sync/mod.rs`](../../src-tauri/src/catalog/sync/mod.rs)                                                                             |         3 |
| [`catalog/sync/portable/tests.rs`](../../src-tauri/src/catalog/sync/portable/tests.rs)                                                       |        10 |
| [`catalog/sync/scan.rs`](../../src-tauri/src/catalog/sync/scan.rs)                                                                           |         2 |
| [`catalog/sync/scan_control.rs`](../../src-tauri/src/catalog/sync/scan_control.rs)                                                           |         5 |
| [`catalog/sync/scan_guard.rs`](../../src-tauri/src/catalog/sync/scan_guard.rs)                                                               |         2 |
| [`catalog/sync/scan_sources/portable_sources/roots/tests.rs`](../../src-tauri/src/catalog/sync/scan_sources/portable_sources/roots/tests.rs) |        18 |
| [`catalog/sync/scan_sources/portable_sources/tests.rs`](../../src-tauri/src/catalog/sync/scan_sources/portable_sources/tests.rs)             |         5 |
| [`catalog/sync/scan_sources/selection.rs`](../../src-tauri/src/catalog/sync/scan_sources/selection.rs)                                       |         4 |
| [`catalog/sync/scan_steps/tests.rs`](../../src-tauri/src/catalog/sync/scan_steps/tests.rs)                                                   |        11 |
| [`catalog/sync/retry.rs`](../../src-tauri/src/catalog/sync/retry.rs)                                                                         |         7 |
| [`catalog/sync/volumes.rs`](../../src-tauri/src/catalog/sync/volumes.rs)                                                                     |         5 |
| [`catalog/sync/watch_paths.rs`](../../src-tauri/src/catalog/sync/watch_paths.rs)                                                             |         1 |
| [`catalog/sync/watch_scope.rs`](../../src-tauri/src/catalog/sync/watch_scope.rs)                                                             |         1 |
| [`catalog/sync/watcher.rs`](../../src-tauri/src/catalog/sync/watcher.rs)                                                                     |         1 |
| [`catalog/target_availability.rs`](../../src-tauri/src/catalog/target_availability.rs)                                                       |        12 |
| [`catalog/tree.rs`](../../src-tauri/src/catalog/tree.rs)                                                                                     |        13 |
| [`catalog/visibility/markers/rules.rs`](../../src-tauri/src/catalog/visibility/markers/rules.rs)                                             |         5 |
| [`catalog/visibility/mod.rs`](../../src-tauri/src/catalog/visibility/mod.rs)                                                                 |        38 |
| [`catalog/visibility/report.rs`](../../src-tauri/src/catalog/visibility/report.rs)                                                           |         1 |
| [`catalog/volumes.rs`](../../src-tauri/src/catalog/volumes.rs)                                                                               |         9 |

Fixture corpora in `src-tauri/tests/fixtures/` anchor category, visibility and
foreign-machine decisions. They are regression data, not claims of real-world
coverage.

## Windows platform boundary

These tests validate the only layer that calls Windows APIs: executable and
folder target validation, launch/close process identity, PE metadata,
signatures, icons, registry, drive discovery, global shortcut and
watcher lifecycle. `volume_watcher.rs` drives its hidden window with a real
`WM_DEVICECHANGE` sent from the test thread: a volume removal and an arrival
reach the callback with the letters decoded from the unit mask, a null payload,
a non-volume device, a header too short for a volume, an empty mask and an
unrelated event are all ignored, and dropping the guard ends the message loop
promptly. `volumes.rs` proves a volume name buffer ends at its first NUL and,
live, that the system drive reports a serial and a filesystem and appears in
the mounted-volume enumeration.

| Module                                                                                                                       | Tests |
| ---------------------------------------------------------------------------------------------------------------------------- | ----: |
| [`platform/windows/apps_folder/tests.rs`](../../src-tauri/src/platform/windows/apps_folder/tests.rs)                         |     3 |
| [`platform/windows/change_watcher.rs`](../../src-tauri/src/platform/windows/change_watcher.rs)                               |     4 |
| [`platform/windows/drives.rs`](../../src-tauri/src/platform/windows/drives.rs)                                               |     2 |
| [`platform/windows/execution/closer/finish.rs`](../../src-tauri/src/platform/windows/execution/closer/finish.rs)             |     6 |
| [`platform/windows/execution/closer/graceful.rs`](../../src-tauri/src/platform/windows/execution/closer/graceful.rs)         |     2 |
| [`platform/windows/execution/closer/frames.rs`](../../src-tauri/src/platform/windows/execution/closer/frames.rs)             |     2 |
| [`platform/windows/execution/closer/identity.rs`](../../src-tauri/src/platform/windows/execution/closer/identity.rs)         |    14 |
| [`platform/windows/execution/closer/mod.rs`](../../src-tauri/src/platform/windows/execution/closer/mod.rs)                   |     6 |
| [`platform/windows/execution/closer/processes.rs`](../../src-tauri/src/platform/windows/execution/closer/processes.rs)       |     3 |
| [`platform/windows/execution/exec_target.rs`](../../src-tauri/src/platform/windows/execution/exec_target.rs)                 |     5 |
| [`platform/windows/execution/executable_metadata.rs`](../../src-tauri/src/platform/windows/execution/executable_metadata.rs) |     7 |
| [`platform/windows/execution/folder.rs`](../../src-tauri/src/platform/windows/execution/folder.rs)                           |     3 |
| [`platform/windows/execution/launcher.rs`](../../src-tauri/src/platform/windows/execution/launcher.rs)                       |     9 |
| [`platform/windows/execution/pe.rs`](../../src-tauri/src/platform/windows/execution/pe.rs)                                   |     3 |
| [`platform/windows/execution/protected.rs`](../../src-tauri/src/platform/windows/execution/protected.rs)                     |     9 |
| [`platform/windows/execution/signature.rs`](../../src-tauri/src/platform/windows/execution/signature.rs)                     |     1 |
| [`platform/windows/icon_extractor/app_id.rs`](../../src-tauri/src/platform/windows/icon_extractor/app_id.rs)                 |     1 |
| [`platform/windows/icon_extractor/gdi.rs`](../../src-tauri/src/platform/windows/icon_extractor/gdi.rs)                       |     1 |
| [`platform/windows/icon_extractor/mod.rs`](../../src-tauri/src/platform/windows/icon_extractor/mod.rs)                       |     3 |
| [`platform/windows/icon_extractor/shell.rs`](../../src-tauri/src/platform/windows/icon_extractor/shell.rs)                   |     9 |
| [`platform/windows/known_folders.rs`](../../src-tauri/src/platform/windows/known_folders.rs)                                 |     1 |
| [`platform/windows/locale.rs`](../../src-tauri/src/platform/windows/locale.rs)                                               |     1 |
| [`platform/windows/process_priority.rs`](../../src-tauri/src/platform/windows/process_priority.rs)                           |     1 |
| [`platform/windows/registry/associations.rs`](../../src-tauri/src/platform/windows/registry/associations.rs)                 |     3 |
| [`platform/windows/registry/install_registry.rs`](../../src-tauri/src/platform/windows/registry/install_registry.rs)         |     5 |
| [`platform/windows/registry/package_registry.rs`](../../src-tauri/src/platform/windows/registry/package_registry.rs)         |     1 |
| [`platform/windows/registry/registered_targets.rs`](../../src-tauri/src/platform/windows/registry/registered_targets.rs)     |     1 |
| [`platform/windows/registry/startup_approval.rs`](../../src-tauri/src/platform/windows/registry/startup_approval.rs)         |     5 |
| [`platform/windows/registry/uninstall_registry.rs`](../../src-tauri/src/platform/windows/registry/uninstall_registry.rs)     |     2 |
| [`platform/windows/shortcuts/global_shortcut.rs`](../../src-tauri/src/platform/windows/shortcuts/global_shortcut.rs)         |     3 |
| [`platform/windows/volume_watcher.rs`](../../src-tauri/src/platform/windows/volume_watcher.rs)                               |     5 |
| [`platform/windows/volumes.rs`](../../src-tauri/src/platform/windows/volumes.rs)                                             |     2 |

## Core, IPC and lifecycle

The core suite checks that webview requests remain ID-only, blocking work leaves
the IPC caller thread, errors never expose local internals, interface-failure
reports stay bounded and free of control characters, the IPC wire shape matches
its recorded contract, closing the window follows the tray setting, the restored
window lands on a monitor that still exists, a settled resize reaches disk
without a close, the tray menu never receives more entries than it shows nor
a label it cannot render, a tray search click raised before the interface
listened is honoured once, the diagnostics export stays well-formed and bounded,
autostart hides only after tray setup succeeds, an exact `--autostart` argument
is required, and every store beside the executable is created, adopted and
declined by the rules `paths/` names.

| Module                                                                                   | Tests |
| ---------------------------------------------------------------------------------------- | ----: |
| [`app_state/catalog_memory.rs`](../../src-tauri/src/app_state/catalog_memory.rs)         |     7 |
| [`app_state/catalog_generation.rs`](../../src-tauri/src/app_state/catalog_generation.rs) |     3 |
| [`app_state/launch_waits.rs`](../../src-tauri/src/app_state/launch_waits.rs)             |     1 |
| [`app_state/mod.rs`](../../src-tauri/src/app_state/mod.rs)                               |     1 |
| [`commands/catalog.rs`](../../src-tauri/src/commands/catalog.rs)                         |     6 |
| [`commands/close.rs`](../../src-tauri/src/commands/close.rs)                             |     6 |
| [`commands/contract.rs`](../../src-tauri/src/commands/contract.rs)                       |     2 |
| [`commands/details.rs`](../../src-tauri/src/commands/details.rs)                         |     1 |
| [`commands/diagnostics.rs`](../../src-tauri/src/commands/diagnostics.rs)                 |     3 |
| [`commands/launch.rs`](../../src-tauri/src/commands/launch.rs)                           |     5 |
| [`commands/mod.rs`](../../src-tauri/src/commands/mod.rs)                                 |     1 |
| [`commands/settings.rs`](../../src-tauri/src/commands/settings.rs)                       |     3 |
| [`commands/tray.rs`](../../src-tauri/src/commands/tray.rs)                               |     5 |
| [`diagnostics/export.rs`](../../src-tauri/src/diagnostics/export.rs)                     |    13 |
| [`diagnostics/log_collection.rs`](../../src-tauri/src/diagnostics/log_collection.rs)     |     1 |
| [`diagnostics/log_sink.rs`](../../src-tauri/src/diagnostics/log_sink.rs)                 |     3 |
| [`diagnostics/operation.rs`](../../src-tauri/src/diagnostics/operation.rs)               |     1 |
| [`diagnostics/panic_log.rs`](../../src-tauri/src/diagnostics/panic_log.rs)               |     2 |
| [`diagnostics/redaction.rs`](../../src-tauri/src/diagnostics/redaction.rs)               |     5 |
| [`diagnostics/redaction_paths.rs`](../../src-tauri/src/diagnostics/redaction_paths.rs)   |     3 |
| [`diagnostics/retention.rs`](../../src-tauri/src/diagnostics/retention.rs)               |     9 |
| [`diagnostics/retention_worker.rs`](../../src-tauri/src/diagnostics/retention_worker.rs) |     2 |
| [`diagnostics/segment_writer.rs`](../../src-tauri/src/diagnostics/segment_writer.rs)     |     4 |
| [`error.rs`](../../src-tauri/src/error.rs)                                               |     8 |
| [`lifecycle/mod.rs`](../../src-tauri/src/lifecycle/mod.rs)                               |     3 |
| [`lifecycle/presentation.rs`](../../src-tauri/src/lifecycle/presentation.rs)             |     2 |
| [`lifecycle/quiet_start.rs`](../../src-tauri/src/lifecycle/quiet_start.rs)               |     3 |
| [`lifecycle/state.rs`](../../src-tauri/src/lifecycle/state.rs)                           |    11 |
| [`lifecycle/tray/menu/tests.rs`](../../src-tauri/src/lifecycle/tray/menu/tests.rs)       |    12 |
| [`lifecycle/tray/model.rs`](../../src-tauri/src/lifecycle/tray/model.rs)                 |     1 |
| [`lifecycle/tray/search.rs`](../../src-tauri/src/lifecycle/tray/search.rs)               |     1 |
| [`lifecycle/window_state.rs`](../../src-tauri/src/lifecycle/window_state.rs)             |    17 |
| [`paths/adopt.rs`](../../src-tauri/src/paths/adopt.rs)                                   |     5 |
| [`paths/mod.rs`](../../src-tauri/src/paths/mod.rs)                                       |     5 |
| [`paths/portable.rs`](../../src-tauri/src/paths/portable.rs)                             |     9 |

## Refreshing this map

Run this after backend test changes, then update the affected module count and
the snapshot totals. It needs only PowerShell; `rg` is not part of the toolchain.

```powershell
$files = Get-ChildItem src-tauri\src -Recurse -Filter *.rs |
  Where-Object { Select-String -Path $_.FullName -Pattern '^\s*#\[test\]' -Quiet }
$files | ForEach-Object {
  $count = (Select-String -Path $_.FullName -Pattern '^\s*#\[test\]').Count
  "{0}: {1}" -f ($_.FullName -replace '.*src-tauri\\src\\',''), $count
}
"Files: $($files.Count)"
"Tests: $(($files | ForEach-Object { (Select-String -Path $_.FullName -Pattern '^\s*#\[test\]').Count } | Measure-Object -Sum).Sum)"
```

Use `cargo test --manifest-path src-tauri/Cargo.toml` as the execution source
of truth. Run `npm test` separately for the frontend suite.
