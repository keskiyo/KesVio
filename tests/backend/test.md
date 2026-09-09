# Backend test map

The Rust backend has no external integration-test crate. Tests live next to the
modules they exercise in `#[cfg(test)]` blocks so they can validate private and
`pub(crate)` behaviour without widening production APIs.

Snapshot: `v0.5.1`.

- Rust: **677 test entries** in **100 source files**; one developer-only test is
  ignored in the normal run, so a green suite reports 676 passed. The ignored
  case is `catalog/golden/timings.rs`, which prints stage medians instead of
  asserting a threshold; its former companion, the `msix.rs` case that drove the
  real deployment API, went with the uninstall feature. Removing that feature
  deleted `platform/windows/uninstall/`, `commands/uninstall.rs` and
  `app_state/uninstall.rs` along with their cases, and left one invariant behind
  that is now guarded on purpose: `can_uninstall` is the evidence that an entry
  is a registered product, worth 35 points in `visibility/mod.rs`, so
  `sync/document.rs` proves it survives a cache round trip with its score intact
  and `storage/cache.rs` proves the v9 to v10 migration drops the stored command
  without touching the flag. Moving every store beside the executable added `paths/`, where
  `portable.rs` proves that a root is created and probed once and adopted without
  probing afterwards, that a debug build creates none, and that an occupied name
  is declined; `adopt.rs` proves the one-way copy never refills a destination
  that already exists; and `mod.rs` proves an unmanaged or unresolved location
  defers to the Tauri per-user folder. `catalog/platform_kind.rs` maps a source
  or its Battle.net evidence to the badge the card shows, and
  `catalog/sync/scan_steps.rs` covers the stall watchdog: the threshold, the
  repeat interval, the reused detail buffer, and a thread that stops before its
  next poll rather than after it. `catalog/scan/settings.rs` and
  `lifecycle/window_state.rs` each prove that rewriting the stored value is a
  no-op while a malformed or unsupported document is still replaced. The
  diagnostics log added `diagnostics/export.rs`, whose cases
  hold the XML document together — a plugin-formatted line becomes a structured
  entry, a line the logger did not write is kept verbatim, markup and control
  characters cannot escape their element, and the export keeps only the newest
  lines — and `diagnostics/retention.rs`, where pruning leaves fresh logs alone
  and treats neither a missing directory nor a future timestamp as an error.
  Splitting the lifecycle module put the close-to-tray decision in
  `lifecycle/state.rs` and window geometry in `lifecycle/window_state.rs`, which
  is where a window from a disconnected monitor, one hanging off an edge, one
  larger than its screen and a maximized one each have a named case.
  `lifecycle/presentation.rs` keeps ordinary startup hidden until the frontend
  readiness event while tray-backed autostart remains hidden.
  `commands/contract.rs` serializes every IPC payload and event and compares the
  shape against a recorded fixture, so a renamed or retyped field is reported as
  a contract change rather than reaching the webview. The same fixture records
  `errorCodes` from `AppError` itself, which is what the frontend now holds
  `APP_ERROR_CODES` against; the previous frontend guard compared that map to a
  hand-copied list and so agreed with itself while two real codes were missing. Splitting scan sources per
  source kind moved portable root selection into
  `catalog/sync/scan_sources/portable_sources.rs`, where retaining fixed drives
  across a refresh and discarding only a cancelled scan are proved.
- Frontend: **759 Vitest tests** in **96 files**; it is documented here only to
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

Classification is proved by the fixture corpus rather than by hand-written
cases, so a new rule is a data change with a named record behind it.
`classify/signals.rs` covers the two inputs that must count as _no_ evidence —
a `.mui` resource stub standing in for the real executable, and packaging-toolkit
publisher/product/description — because those are unit-level facts that no
corpus entry can pin down on its own.

| Module                                                                                                               |     Tests |
| -------------------------------------------------------------------------------------------------------------------- | --------: |
| [`catalog/mod.rs`](../../src-tauri/src/catalog/mod.rs)                                                               |        64 |
| [`catalog/artifact/documentation.rs`](../../src-tauri/src/catalog/artifact/documentation.rs)                         |         7 |
| [`catalog/artifact/installer.rs`](../../src-tauri/src/catalog/artifact/installer.rs)                                 |        18 |
| [`catalog/classify/mod.rs`](../../src-tauri/src/catalog/classify/mod.rs)                                             |        15 |
| [`catalog/classify/signals.rs`](../../src-tauri/src/catalog/classify/signals.rs)                                     |         3 |
| [`catalog/classify/tables.rs`](../../src-tauri/src/catalog/classify/tables.rs)                                       |         5 |
| [`catalog/close.rs`](../../src-tauri/src/catalog/close.rs)                                                           |         6 |
| [`catalog/dedup/merge.rs`](../../src-tauri/src/catalog/dedup/merge.rs)                                               |         4 |
| [`catalog/dedup/mod.rs`](../../src-tauri/src/catalog/dedup/mod.rs)                                                   |        74 |
| [`catalog/details/cache.rs`](../../src-tauri/src/catalog/details/cache.rs)                                           |         1 |
| [`catalog/details/read.rs`](../../src-tauri/src/catalog/details/read.rs)                                             |         4 |
| [`catalog/details/target.rs`](../../src-tauri/src/catalog/details/target.rs)                                         |         6 |
| [`catalog/filters.rs`](../../src-tauri/src/catalog/filters.rs)                                                       |         2 |
| [`catalog/golden/mod.rs`](../../src-tauri/src/catalog/golden/mod.rs)                                                 |         5 |
| [`catalog/golden/properties.rs`](../../src-tauri/src/catalog/golden/properties.rs)                                   |         7 |
| [`catalog/golden/timings.rs`](../../src-tauri/src/catalog/golden/timings.rs)                                         | 1 ignored |
| [`catalog/identity.rs`](../../src-tauri/src/catalog/identity.rs)                                                     |         4 |
| [`catalog/machine.rs`](../../src-tauri/src/catalog/machine.rs)                                                       |         2 |
| [`catalog/model.rs`](../../src-tauri/src/catalog/model.rs)                                                           |         1 |
| [`catalog/place.rs`](../../src-tauri/src/catalog/place.rs)                                                           |         4 |
| [`catalog/scan/coordinator.rs`](../../src-tauri/src/catalog/scan/coordinator.rs)                                     |         5 |
| [`catalog/scan/hydration/icon.rs`](../../src-tauri/src/catalog/scan/hydration/icon.rs)                               |         4 |
| [`catalog/scan/hydration/queue.rs`](../../src-tauri/src/catalog/scan/hydration/queue.rs)                             |         3 |
| [`catalog/scan/incremental/mod.rs`](../../src-tauri/src/catalog/scan/incremental/mod.rs)                             |        14 |
| [`catalog/scan/incremental/walk.rs`](../../src-tauri/src/catalog/scan/incremental/walk.rs)                           |         1 |
| [`catalog/scan/settings.rs`](../../src-tauri/src/catalog/scan/settings.rs)                                           |         2 |
| [`catalog/sources/installer_cache.rs`](../../src-tauri/src/catalog/sources/installer_cache.rs)                       |         3 |
| [`catalog/sources/portable.rs`](../../src-tauri/src/catalog/sources/portable.rs)                                     |         9 |
| [`catalog/sources/registry.rs`](../../src-tauri/src/catalog/sources/registry.rs)                                     |        10 |
| [`catalog/sources/source.rs`](../../src-tauri/src/catalog/sources/source.rs)                                         |         4 |
| [`catalog/sources/start_apps.rs`](../../src-tauri/src/catalog/sources/start_apps.rs)                                 |        10 |
| [`catalog/sources/start_apps/package.rs`](../../src-tauri/src/catalog/sources/start_apps/package.rs)                 |         4 |
| [`catalog/sources/steam.rs`](../../src-tauri/src/catalog/sources/steam.rs)                                           |         7 |
| [`catalog/start_menu.rs`](../../src-tauri/src/catalog/start_menu.rs)                                                 |         7 |
| [`catalog/storage/cache.rs`](../../src-tauri/src/catalog/storage/cache.rs)                                           |        19 |
| [`catalog/storage/icon_cache.rs`](../../src-tauri/src/catalog/storage/icon_cache.rs)                                 |        13 |
| [`catalog/sync/delta.rs`](../../src-tauri/src/catalog/sync/delta.rs)                                                 |         2 |
| [`catalog/sync/document.rs`](../../src-tauri/src/catalog/sync/document.rs)                                           |         7 |
| [`catalog/sync/health.rs`](../../src-tauri/src/catalog/sync/health.rs)                                               |         7 |
| [`catalog/sync/hydration.rs`](../../src-tauri/src/catalog/sync/hydration.rs)                                         |         1 |
| [`catalog/sync/mod.rs`](../../src-tauri/src/catalog/sync/mod.rs)                                                     |         3 |
| [`catalog/sync/portable.rs`](../../src-tauri/src/catalog/sync/portable.rs)                                           |         9 |
| [`catalog/sync/scan_control.rs`](../../src-tauri/src/catalog/sync/scan_control.rs)                                   |         5 |
| [`catalog/sync/scan_sources/portable_sources.rs`](../../src-tauri/src/catalog/sync/scan_sources/portable_sources.rs) |         4 |
| [`catalog/target_availability.rs`](../../src-tauri/src/catalog/target_availability.rs)                               |        12 |
| [`catalog/tree.rs`](../../src-tauri/src/catalog/tree.rs)                                                             |         8 |
| [`catalog/visibility/markers/rules.rs`](../../src-tauri/src/catalog/visibility/markers/rules.rs)                     |         5 |
| [`catalog/visibility/mod.rs`](../../src-tauri/src/catalog/visibility/mod.rs)                                         |        38 |
| [`catalog/visibility/report.rs`](../../src-tauri/src/catalog/visibility/report.rs)                                   |         1 |

Fixture corpora in `src-tauri/tests/fixtures/` anchor category, visibility and
foreign-machine decisions. They are regression data, not claims of real-world
coverage.

## Windows platform boundary

These tests validate the only layer that calls Windows APIs: executable and
folder target validation, launch/close process identity, PE metadata,
signatures, icons, registry, drive discovery, global shortcut and
watcher lifecycle.

| Module                                                                                                                       | Tests |
| ---------------------------------------------------------------------------------------------------------------------------- | ----: |
| [`platform/windows/apps_folder.rs`](../../src-tauri/src/platform/windows/apps_folder.rs)                                     |     3 |
| [`platform/windows/change_watcher.rs`](../../src-tauri/src/platform/windows/change_watcher.rs)                               |     3 |
| [`platform/windows/drives.rs`](../../src-tauri/src/platform/windows/drives.rs)                                               |     2 |
| [`platform/windows/execution/closer/frames.rs`](../../src-tauri/src/platform/windows/execution/closer/frames.rs)             |     2 |
| [`platform/windows/execution/closer/identity.rs`](../../src-tauri/src/platform/windows/execution/closer/identity.rs)         |    14 |
| [`platform/windows/execution/closer/mod.rs`](../../src-tauri/src/platform/windows/execution/closer/mod.rs)                   |    11 |
| [`platform/windows/execution/closer/processes.rs`](../../src-tauri/src/platform/windows/execution/closer/processes.rs)       |     1 |
| [`platform/windows/execution/exec_target.rs`](../../src-tauri/src/platform/windows/execution/exec_target.rs)                 |     6 |
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
| [`platform/windows/registry/associations.rs`](../../src-tauri/src/platform/windows/registry/associations.rs)                 |     3 |
| [`platform/windows/registry/install_registry.rs`](../../src-tauri/src/platform/windows/registry/install_registry.rs)         |     5 |
| [`platform/windows/registry/package_registry.rs`](../../src-tauri/src/platform/windows/registry/package_registry.rs)         |     1 |
| [`platform/windows/registry/registered_targets.rs`](../../src-tauri/src/platform/windows/registry/registered_targets.rs)     |     1 |
| [`platform/windows/registry/uninstall_registry.rs`](../../src-tauri/src/platform/windows/registry/uninstall_registry.rs)     |     2 |
| [`platform/windows/shortcuts/global_shortcut.rs`](../../src-tauri/src/platform/windows/shortcuts/global_shortcut.rs)         |     3 |

## Core, IPC and lifecycle

The core suite checks that webview requests remain ID-only, blocking work leaves
the IPC caller thread, errors never expose local internals, interface-failure
reports stay bounded and free of control characters, the IPC wire shape matches
its recorded contract, closing the window follows the tray setting, the restored
window lands on a monitor that still exists, the diagnostics export stays
well-formed and bounded, autostart hides only after tray setup succeeds, and an
exact `--autostart` argument is required.

| Module                                                                           | Tests |
| -------------------------------------------------------------------------------- | ----: |
| [`app_state/catalog_memory.rs`](../../src-tauri/src/app_state/catalog_memory.rs) |     7 |
| [`app_state/launch_waits.rs`](../../src-tauri/src/app_state/launch_waits.rs)     |     1 |
| [`commands/catalog.rs`](../../src-tauri/src/commands/catalog.rs)                 |     6 |
| [`commands/close.rs`](../../src-tauri/src/commands/close.rs)                     |     6 |
| [`commands/contract.rs`](../../src-tauri/src/commands/contract.rs)               |     2 |
| [`commands/details.rs`](../../src-tauri/src/commands/details.rs)                 |     1 |
| [`commands/diagnostics.rs`](../../src-tauri/src/commands/diagnostics.rs)         |     3 |
| [`commands/launch.rs`](../../src-tauri/src/commands/launch.rs)                   |     5 |
| [`commands/mod.rs`](../../src-tauri/src/commands/mod.rs)                         |     1 |
| [`commands/settings.rs`](../../src-tauri/src/commands/settings.rs)               |     3 |
| [`diagnostics/export.rs`](../../src-tauri/src/diagnostics/export.rs)             |     8 |
| [`diagnostics/retention.rs`](../../src-tauri/src/diagnostics/retention.rs)       |     4 |
| [`error.rs`](../../src-tauri/src/error.rs)                                       |     6 |
| [`lifecycle/mod.rs`](../../src-tauri/src/lifecycle/mod.rs)                       |     4 |
| [`lifecycle/presentation.rs`](../../src-tauri/src/lifecycle/presentation.rs)     |     2 |
| [`lifecycle/state.rs`](../../src-tauri/src/lifecycle/state.rs)                   |     6 |
| [`lifecycle/window_state.rs`](../../src-tauri/src/lifecycle/window_state.rs)     |    14 |

## Refreshing this map

Run this after backend test changes, then update the affected module count and
the snapshot totals:

```powershell
$files = rg -l '^\s*#\[test\]' src-tauri/src -g '*.rs'
$files | ForEach-Object {
  $count = (Get-Content $_ | Select-String -Pattern '^\s*#\[test\]').Count
  "{0}: {1}" -f $_, $count
}
"Files: $($files.Count)"
"Tests: $((rg '^\s*#\[test\]' src-tauri/src -g '*.rs' | Measure-Object).Count)"
```

Use `cargo test --manifest-path src-tauri/Cargo.toml` as the execution source
of truth. Run `npm test` separately for the frontend suite.
