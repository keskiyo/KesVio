# Backend test map

The Rust backend has no external integration-test crate. Tests live next to the
modules they exercise in `#[cfg(test)]` blocks so they can validate private and
`pub(crate)` behaviour without widening production APIs.

- Rust: colocated `#[cfg(test)]` modules; `cargo test --manifest-path
src-tauri/Cargo.toml` is the count, and the script at the end prints the
  per-module numbers when they are wanted. One developer-only test is ignored
  in the normal run. The ignored case is `catalog/golden/timings.rs`, which prints stage medians instead of
  asserting a threshold. Removing the uninstall feature deleted
  `platform/windows/uninstall/`, `commands/uninstall.rs` and
  `app_state/uninstall.rs` along with their cases, and left one invariant behind
  that is now guarded on purpose: `can_uninstall` is the evidence that an entry
  is a registered product, worth 35 points in `visibility/mod.rs`, so
  `sync/document.rs` proves it survives a cache round trip with its score intact
  and `storage/cache/` proves the cumulative cache migrations preserve supported
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
  `lifecycle/window_state/store.rs` each prove that rewriting the stored value is a
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
  and window geometry in `lifecycle/window_state/geometry.rs`, where a window from a
  disconnected monitor, one hanging off an edge, one larger than its screen and
  a maximized one each have a named case, and a resize reaches the stored state
  without a close, because an update, a shutdown or a kill ends the process
  without one. `lifecycle/window_state/mod.rs` proves the restore clamps to the
  minimum the window configuration declares, converted to the physical pixels a
  geometry is stored in, that a missing or impossible minimum clamps nothing
  away, and that `tauri.conf.json` still declares the 446 × 529 minimum the
  interface is built for — a second constant in the restore path had drifted
  to 430 × 520. `lifecycle/presentation.rs` keeps ordinary startup hidden until
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
fixed-drive walk found on its own — and `storage/cache/` proves a document
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

- [`catalog/artifact/documentation.rs`](../../src-tauri/src/catalog/artifact/documentation.rs)
- [`catalog/artifact/installer.rs`](../../src-tauri/src/catalog/artifact/installer.rs)
- [`catalog/classify/mod.rs`](../../src-tauri/src/catalog/classify/mod.rs)
- [`catalog/classify/signals.rs`](../../src-tauri/src/catalog/classify/signals.rs)
- [`catalog/classify/tables.rs`](../../src-tauri/src/catalog/classify/tables.rs)
- [`catalog/close.rs`](../../src-tauri/src/catalog/close.rs)
- [`catalog/dedup/merge/tests.rs`](../../src-tauri/src/catalog/dedup/merge/tests.rs)
- [`catalog/dedup/mod.rs`](../../src-tauri/src/catalog/dedup/mod.rs)
- [`catalog/details/cache.rs`](../../src-tauri/src/catalog/details/cache.rs)
- [`catalog/details/read.rs`](../../src-tauri/src/catalog/details/read.rs)
- [`catalog/details/target.rs`](../../src-tauri/src/catalog/details/target.rs)
- [`catalog/display.rs`](../../src-tauri/src/catalog/display.rs)
- [`catalog/filters.rs`](../../src-tauri/src/catalog/filters.rs)
- [`catalog/golden/mod.rs`](../../src-tauri/src/catalog/golden/mod.rs)
- [`catalog/golden/properties.rs`](../../src-tauri/src/catalog/golden/properties.rs)
- [`catalog/golden/timings.rs`](../../src-tauri/src/catalog/golden/timings.rs) (ignored)
- [`catalog/identity.rs`](../../src-tauri/src/catalog/identity.rs)
- [`catalog/machine.rs`](../../src-tauri/src/catalog/machine.rs)
- [`catalog/mod.rs`](../../src-tauri/src/catalog/mod.rs)
- [`catalog/model.rs`](../../src-tauri/src/catalog/model.rs)
- [`catalog/naming.rs`](../../src-tauri/src/catalog/naming.rs)
- [`catalog/place.rs`](../../src-tauri/src/catalog/place.rs)
- [`catalog/platform_kind.rs`](../../src-tauri/src/catalog/platform_kind.rs)
- [`catalog/product_duplicates.rs`](../../src-tauri/src/catalog/product_duplicates.rs)
- [`catalog/registry_enrichment.rs`](../../src-tauri/src/catalog/registry_enrichment.rs)
- [`catalog/scan/coordinator.rs`](../../src-tauri/src/catalog/scan/coordinator.rs)
- [`catalog/scan/hydration/icon.rs`](../../src-tauri/src/catalog/scan/hydration/icon.rs)
- [`catalog/scan/hydration/mod.rs`](../../src-tauri/src/catalog/scan/hydration/mod.rs)
- [`catalog/scan/hydration/queue.rs`](../../src-tauri/src/catalog/scan/hydration/queue.rs)
- [`catalog/scan/hydration/sources.rs`](../../src-tauri/src/catalog/scan/hydration/sources.rs)
- [`catalog/scan/incremental/mod.rs`](../../src-tauri/src/catalog/scan/incremental/mod.rs)
- [`catalog/scan/incremental/walk.rs`](../../src-tauri/src/catalog/scan/incremental/walk.rs)
- [`catalog/scan/settings.rs`](../../src-tauri/src/catalog/scan/settings.rs)
- [`catalog/sources/installer_cache.rs`](../../src-tauri/src/catalog/sources/installer_cache.rs)
- [`catalog/sources/portable.rs`](../../src-tauri/src/catalog/sources/portable.rs)
- [`catalog/sources/portable_candidate.rs`](../../src-tauri/src/catalog/sources/portable_candidate.rs)
- [`catalog/sources/registry.rs`](../../src-tauri/src/catalog/sources/registry.rs)
- [`catalog/sources/source.rs`](../../src-tauri/src/catalog/sources/source.rs)
- [`catalog/sources/start_apps/package.rs`](../../src-tauri/src/catalog/sources/start_apps/package.rs)
- [`catalog/sources/start_apps/tests.rs`](../../src-tauri/src/catalog/sources/start_apps/tests.rs)
- [`catalog/sources/steam.rs`](../../src-tauri/src/catalog/sources/steam.rs)
- [`catalog/start_menu.rs`](../../src-tauri/src/catalog/start_menu.rs)
- [`catalog/storage/cache/mod.rs`](../../src-tauri/src/catalog/storage/cache/mod.rs) and [`cache/migrations.rs`](../../src-tauri/src/catalog/storage/cache/migrations.rs)
- [`catalog/storage/icon_cache.rs`](../../src-tauri/src/catalog/storage/icon_cache.rs)
- [`catalog/sync/delta.rs`](../../src-tauri/src/catalog/sync/delta.rs)
- [`catalog/sync/document.rs`](../../src-tauri/src/catalog/sync/document.rs)
- [`catalog/sync/health.rs`](../../src-tauri/src/catalog/sync/health.rs)
- [`catalog/sync/hydration.rs`](../../src-tauri/src/catalog/sync/hydration.rs)
- [`catalog/sync/mod.rs`](../../src-tauri/src/catalog/sync/mod.rs)
- [`catalog/sync/portable/tests.rs`](../../src-tauri/src/catalog/sync/portable/tests.rs)
- [`catalog/sync/scan.rs`](../../src-tauri/src/catalog/sync/scan.rs)
- [`catalog/sync/scan_control.rs`](../../src-tauri/src/catalog/sync/scan_control.rs)
- [`catalog/sync/scan_guard.rs`](../../src-tauri/src/catalog/sync/scan_guard.rs)
- [`catalog/sync/scan_sources/portable_sources/roots/tests.rs`](../../src-tauri/src/catalog/sync/scan_sources/portable_sources/roots/tests.rs)
- [`catalog/sync/scan_sources/portable_sources/tests.rs`](../../src-tauri/src/catalog/sync/scan_sources/portable_sources/tests.rs)
- [`catalog/sync/scan_sources/selection.rs`](../../src-tauri/src/catalog/sync/scan_sources/selection.rs)
- [`catalog/sync/scan_steps/tests.rs`](../../src-tauri/src/catalog/sync/scan_steps/tests.rs)
- [`catalog/sync/retry.rs`](../../src-tauri/src/catalog/sync/retry.rs)
- [`catalog/sync/volumes.rs`](../../src-tauri/src/catalog/sync/volumes.rs)
- [`catalog/sync/watch_paths.rs`](../../src-tauri/src/catalog/sync/watch_paths.rs)
- [`catalog/sync/watch_scope.rs`](../../src-tauri/src/catalog/sync/watch_scope.rs)
- [`catalog/sync/watcher.rs`](../../src-tauri/src/catalog/sync/watcher.rs)
- [`catalog/target_availability.rs`](../../src-tauri/src/catalog/target_availability.rs)
- [`catalog/tree.rs`](../../src-tauri/src/catalog/tree.rs)
- [`catalog/visibility/markers/rules.rs`](../../src-tauri/src/catalog/visibility/markers/rules.rs)
- [`catalog/visibility/mod.rs`](../../src-tauri/src/catalog/visibility/mod.rs)
- [`catalog/visibility/report.rs`](../../src-tauri/src/catalog/visibility/report.rs)
- [`catalog/volumes.rs`](../../src-tauri/src/catalog/volumes.rs)
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

- [`platform/windows/apps_folder/tests.rs`](../../src-tauri/src/platform/windows/apps_folder/tests.rs)
- [`platform/windows/change_watcher.rs`](../../src-tauri/src/platform/windows/change_watcher.rs)
- [`platform/windows/drives.rs`](../../src-tauri/src/platform/windows/drives.rs)
- [`platform/windows/execution/closer/finish.rs`](../../src-tauri/src/platform/windows/execution/closer/finish.rs)
- [`platform/windows/execution/closer/graceful.rs`](../../src-tauri/src/platform/windows/execution/closer/graceful.rs)
- [`platform/windows/execution/closer/frames.rs`](../../src-tauri/src/platform/windows/execution/closer/frames.rs)
- [`platform/windows/execution/closer/identity.rs`](../../src-tauri/src/platform/windows/execution/closer/identity.rs)
- [`platform/windows/execution/closer/mod.rs`](../../src-tauri/src/platform/windows/execution/closer/mod.rs)
- [`platform/windows/execution/closer/processes.rs`](../../src-tauri/src/platform/windows/execution/closer/processes.rs)
- [`platform/windows/execution/exec_target.rs`](../../src-tauri/src/platform/windows/execution/exec_target.rs)
- [`platform/windows/execution/executable_metadata.rs`](../../src-tauri/src/platform/windows/execution/executable_metadata.rs)
- [`platform/windows/execution/folder.rs`](../../src-tauri/src/platform/windows/execution/folder.rs)
- [`platform/windows/execution/launcher.rs`](../../src-tauri/src/platform/windows/execution/launcher.rs)
- [`platform/windows/execution/pe.rs`](../../src-tauri/src/platform/windows/execution/pe.rs)
- [`platform/windows/execution/protected.rs`](../../src-tauri/src/platform/windows/execution/protected.rs)
- [`platform/windows/execution/signature.rs`](../../src-tauri/src/platform/windows/execution/signature.rs)
- [`platform/windows/icon_extractor/app_id.rs`](../../src-tauri/src/platform/windows/icon_extractor/app_id.rs)
- [`platform/windows/icon_extractor/gdi.rs`](../../src-tauri/src/platform/windows/icon_extractor/gdi.rs)
- [`platform/windows/icon_extractor/mod.rs`](../../src-tauri/src/platform/windows/icon_extractor/mod.rs)
- [`platform/windows/icon_extractor/shell.rs`](../../src-tauri/src/platform/windows/icon_extractor/shell.rs)
- [`platform/windows/known_folders.rs`](../../src-tauri/src/platform/windows/known_folders.rs)
- [`platform/windows/locale.rs`](../../src-tauri/src/platform/windows/locale.rs)
- [`platform/windows/process_priority.rs`](../../src-tauri/src/platform/windows/process_priority.rs)
- [`platform/windows/registry/associations.rs`](../../src-tauri/src/platform/windows/registry/associations.rs)
- [`platform/windows/registry/install_registry.rs`](../../src-tauri/src/platform/windows/registry/install_registry.rs)
- [`platform/windows/registry/package_registry.rs`](../../src-tauri/src/platform/windows/registry/package_registry.rs)
- [`platform/windows/registry/registered_targets.rs`](../../src-tauri/src/platform/windows/registry/registered_targets.rs)
- [`platform/windows/registry/startup_approval.rs`](../../src-tauri/src/platform/windows/registry/startup_approval.rs)
- [`platform/windows/registry/uninstall_registry.rs`](../../src-tauri/src/platform/windows/registry/uninstall_registry.rs)
- [`platform/windows/shortcuts/global_shortcut.rs`](../../src-tauri/src/platform/windows/shortcuts/global_shortcut.rs)
- [`platform/windows/volume_watcher.rs`](../../src-tauri/src/platform/windows/volume_watcher.rs)
- [`platform/windows/volumes.rs`](../../src-tauri/src/platform/windows/volumes.rs)

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

- [`app_state/catalog_memory.rs`](../../src-tauri/src/app_state/catalog_memory.rs)
- [`app_state/catalog_generation.rs`](../../src-tauri/src/app_state/catalog_generation.rs)
- [`app_state/launch_waits.rs`](../../src-tauri/src/app_state/launch_waits.rs)
- [`app_state/mod.rs`](../../src-tauri/src/app_state/mod.rs)
- [`commands/catalog.rs`](../../src-tauri/src/commands/catalog.rs)
- [`commands/close.rs`](../../src-tauri/src/commands/close.rs)
- [`commands/contract.rs`](../../src-tauri/src/commands/contract.rs)
- [`commands/details.rs`](../../src-tauri/src/commands/details.rs)
- [`commands/diagnostics.rs`](../../src-tauri/src/commands/diagnostics.rs)
- [`commands/launch.rs`](../../src-tauri/src/commands/launch.rs)
- [`commands/mod.rs`](../../src-tauri/src/commands/mod.rs)
- [`commands/settings.rs`](../../src-tauri/src/commands/settings.rs)
- [`commands/tray.rs`](../../src-tauri/src/commands/tray.rs)
- [`diagnostics/export.rs`](../../src-tauri/src/diagnostics/export.rs)
- [`diagnostics/log_collection.rs`](../../src-tauri/src/diagnostics/log_collection.rs)
- [`diagnostics/log_sink.rs`](../../src-tauri/src/diagnostics/log_sink.rs)
- [`diagnostics/operation.rs`](../../src-tauri/src/diagnostics/operation.rs)
- [`diagnostics/panic_log.rs`](../../src-tauri/src/diagnostics/panic_log.rs)
- [`diagnostics/redaction.rs`](../../src-tauri/src/diagnostics/redaction.rs)
- [`diagnostics/redaction_paths.rs`](../../src-tauri/src/diagnostics/redaction_paths.rs)
- [`diagnostics/retention.rs`](../../src-tauri/src/diagnostics/retention.rs)
- [`diagnostics/retention_worker.rs`](../../src-tauri/src/diagnostics/retention_worker.rs)
- [`diagnostics/segment_writer.rs`](../../src-tauri/src/diagnostics/segment_writer.rs)
- [`error.rs`](../../src-tauri/src/error.rs)
- [`lifecycle/mod.rs`](../../src-tauri/src/lifecycle/mod.rs)
- [`lifecycle/presentation.rs`](../../src-tauri/src/lifecycle/presentation.rs)
- [`lifecycle/quiet_start.rs`](../../src-tauri/src/lifecycle/quiet_start.rs)
- [`lifecycle/state.rs`](../../src-tauri/src/lifecycle/state.rs)
- [`lifecycle/tray/menu/tests.rs`](../../src-tauri/src/lifecycle/tray/menu/tests.rs)
- [`lifecycle/tray/model.rs`](../../src-tauri/src/lifecycle/tray/model.rs)
- [`lifecycle/tray/search.rs`](../../src-tauri/src/lifecycle/tray/search.rs)
- [`lifecycle/window_state/mod.rs`](../../src-tauri/src/lifecycle/window_state/mod.rs), [`window_state/geometry.rs`](../../src-tauri/src/lifecycle/window_state/geometry.rs) and [`window_state/store.rs`](../../src-tauri/src/lifecycle/window_state/store.rs)
- [`paths/adopt.rs`](../../src-tauri/src/paths/adopt.rs)
- [`paths/mod.rs`](../../src-tauri/src/paths/mod.rs)
- [`paths/portable.rs`](../../src-tauri/src/paths/portable.rs)

## Refreshing this map

Run this to list the per-module counts when a review wants them; the map above
records which modules carry tests and what they prove, not numbers that drift
with every change. It needs only PowerShell; `rg` is not part of the toolchain.

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
