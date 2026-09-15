# KesVio Technical Documentation

Technical reference for maintainers. [README](README.md) is the user-facing
overview; source and tests are the detailed implementation reference.

## 1. Product scope and environment

KesVio is a local Windows catalog, launcher, and organization layer. It
discovers applications, sanitizes and deduplicates results, persists a compact
cache, and launches applications through a React desktop UI. It cannot remove
software: uninstalling is handed to Windows. It updates only itself from signed
GitHub Releases; it never updates cataloged third-party applications.

Out of scope: cloud sync, telemetry, metadata uploads, online enrichment,
arbitrary frontend command execution, VPN control, and direct deletion of
program directories.

| Area            | Supported implementation                              |
| --------------- | ----------------------------------------------------- |
| OS              | Windows 10 and Windows 11, x64                        |
| Desktop runtime | Tauri 2 and Microsoft Edge WebView2                   |
| Frontend        | React 18, TypeScript, Vite 6, Tailwind CSS 4, Zustand |
| Backend         | Rust 2021 and Windows APIs                            |
| Package         | NSIS setup executable                                 |
| Tests           | Vitest/Testing Library and Rust unit tests            |

## 3. Architecture and ownership

Frontend dependencies follow `app → pages → widgets → features → entities →
shared`. Slices are entered through their root `index.ts`; sibling slices do
not import one another except entity public APIs. `shared` has no catalog,
settings, or update knowledge. `scripts/verify-frontend-boundaries.ps1`
enforces the frontend boundary contract.

| Owner                | Responsibility                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| React                | Presentation, navigation, search, dialogs, feedback, and user preferences in the root Zustand store |
| `entities/*` clients | Typed seams between UI and Tauri IPC                                                                |
| Rust commands        | Validate transport input, resolve trusted targets, delegate, and map safe errors                    |
| `catalog/*`          | Discovery, classification, deduplication, cache and incremental synchronization                     |
| `platform/windows/*` | Registry, filesystem, shell, COM, Windows handles, launch and shortcut APIs                         |
| `AppState`           | Process-wide trusted catalog targets, lifecycle and watcher ownership                               |

Runtime path:

```text
UI → model/store → entity client → Tauri IPC → command → catalog → platform/windows
```

The webview sends catalog IDs, never executable paths, registry keys, shell
commands, or uninstall commands. Rust resolves each ID from `AppState` before
any native action.

Main source areas:

| Path                                          | Owns                                                          |
| --------------------------------------------- | ------------------------------------------------------------- |
| `src/app/`                                    | Composition root, shell and root store                        |
| `src/pages/`, `src/widgets/`, `src/features/` | Screens, interface areas and user scenarios                   |
| `src/entities/`                               | App, category, scenario and system contracts/clients          |
| `src/shared/`                                 | Domain-independent UI, hooks and Tauri transport helpers      |
| `src-tauri/src/catalog/`                      | Catalog model, scanning, sources, storage, sync and decisions |
| `src-tauri/src/commands/`                     | Tauri transport adapters                                      |
| `src-tauri/src/platform/windows/`             | Windows-native boundary                                       |
| `tests/frontend/`                             | Frontend tests mirroring source ownership                     |

Store assembly stays in `src/app/store/`. Action factories live in `actions/`;
preference schema, normalization and storage live in `preferences/`, behind the
existing `preferences.ts` facade. Component-only props stay with their component.
The stylesheet entry `src/app/styles/index.css` imports tokens, navigation, base,
notifications, surfaces, theme, catalog and motion in cascade order. Theme rules
match whole class tokens rather than arbitrary substrings.

The frontend boundary checker builds a TypeScript-resolved import graph, including
type imports, re-exports and literal dynamic imports. It rejects forbidden layer
edges, private slice entry points and cycles. Its regression fixtures run with
`node --test scripts/test-frontend-import-graph.mjs`.

Updater orchestration lives in `features/update-app/model/useUpdater.ts`;
checking, installation, preferences and native-resource ownership have separate
modules. Concurrent checks share one request. Dismissed, replaced and late results
close their native Update resource once; an active download/install retains its
handle until the operation settles. Unmount prevents starting the next installation
or relaunch step. Release metadata and errors are sanitized before presentation.

Catalog record creation lives in `catalog/app_record.rs`, registry enrichment in
`registry_enrichment.rs`, source candidates in `sources/`, watcher roots in
`sync/watch_paths.rs`, and icon-source selection in `scan/hydration/sources.rs`.
The catalog root coordinates these owners without duplicating their rules.

Local launchers live in `scripts/run-dev.ps1` (development) and
`scripts/run-dev-hidden.vbs` (launch the newest existing local executable).
Both resolve the repository from their script location, independently of the
caller's working directory. Build and tool configuration stays at the root where
the corresponding tools expect it.

Two shared pieces own behaviour that used to be copied per call site, so a
change to either is a change everywhere it applies:

| Owner                                                        | Owns                                                                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/hooks/useModalDialog.ts`                         | Modal lifecycle: body-scroll lock, focus trap, initial focus, focus restoration, and the optional Escape listener. Composes `useBodyScrollLock` and `useFocusTrap` rather than reimplementing them |
| `src/pages/settings/ui/components/SettingsSectionHeader.tsx` | The icon tile, heading and description shared by every settings card                                                                                                                               |

`useModalDialog` captures the opening element once, on mount, so a dialog that
re-renders mid-flight — an installer that starts, an update that begins
downloading — still returns focus to the control the reader came from. A dialog
passes `onDismiss` only when the shared hook should own Escape; the command
palette, app picker and scenario-run dialog keep Escape in their own key
handler because it belongs to the same arrow-key navigation contract, and
`ConfirmDialog` deliberately has no Escape at all: a destructive confirmation
dismisses only through a control the reader aimed at.

The backend groups each large module by reason to change rather than by file
size. `catalog/sync/` splits source scanning (`scan_sources/`), per-source
health (`health.rs`), the catalog delta (`delta.rs`) and cache assembly
(`assemble.rs`), leaving `synchronize` as orchestration. `catalog/scan/`
separates the filesystem walk from the index model and executable fingerprints,
and hydration from icon extraction. `app_state/` separates catalog memory,
launch-wait limiting. `platform/windows/icon_extractor/`
separates image decoding, GDI bitmap encoding, shell icons and AppUserModelId
lookups, so each `unsafe` block sits next to the ownership rules it depends on.
There is deliberately no module that turns a registry-supplied command into a
process: the safest version of that boundary is not having the capability behind
it.

## 4. IPC, events, and errors

Command families cover catalog reads and scans, icon hydration, launch/close,
details/folder, system settings, settings backup export,
project links, update release links, stale-copy handling, tray menu contents,
and bounded interface-failure reporting. Commands return
`Result<T, AppError>`; errors expose stable `SCREAMING_SNAKE` codes and static
safe messages. Internal paths, commands, registry values and upstream errors
never reach the webview.

`set_startup_enabled` takes one boolean and answers with the startup state
Windows now holds (`enabled`, `disabled` or `missing`), which
`get_system_settings` also reports as `startupEntry`. It flips only the
`StartupApproved` value of the shortcut the installer registered; no IPC command
creates or removes startup registration, and a missing shortcut is answered with
`STARTUP_ENTRY_UPDATE_FAILED` rather than repaired.

Scenario close actions accept catalog IDs only. The trusted catalog classifies
close targets; only `Safe` targets may be added or executed. Critical Windows
processes and session components are counted as blocked rather than terminated.

A close asks every matching window to shut down and waits five seconds. Remaining processes are terminated only when `allowForce` is explicitly true; otherwise they remain open and count as failed closures. The wait is
reported to the interface as coarse stages over `close://progress` — asking,
a per-second countdown, then terminating — so the pause reads as deliberate
rather than as a hang. A scenario run ends in a single summary notice counting
launches, failures, closures and refusals; nothing is discarded silently.

The tray offers up to five favorite scenarios, and `set_tray_scenarios` is how the window
says which. The scenario itself never crosses to Rust: an entry is an opaque id
and a display label, the backend stores neither, and picking one emits
`tray://run-scenario` carrying that id back so the window runs it with the data
it already owns. The command is a transport adapter and treats both fields as
untrusted — the list is capped, a blank or over-long id is dropped, and a label
is stripped of control characters, collapsed, truncated and has `&` escaped
before it can reach a native menu as a mnemonic. An entry carries whether it is
starred rather than a label that already shows it, so the marker stays a menu
decision: the submenu prefixes a filled star to starred rows and a hollow one to
the rest, which are a matched pair of the same width and therefore start every
name at one column. It marks nothing when no offered scenario is starred, where
a column of hollow stars would carry no information, and the mark is applied
after truncation so a long name can never lose it. `set_tray_running` names the
running scenario in the tooltip, which is the only feedback a run started from
the tray gets while the window is hidden; the tray never shows the window by
itself. Selection filters by favorite membership before ranking by last run,
then fills remaining slots with the newest unrun favorites. It never includes
nonfavorites; stale favorite ids are ignored. Removing the last favorite sends
an empty list and the native menu hides the scenarios submenu.

The whole menu is rebuilt from one model. `lifecycle/tray/model.rs` holds the
scenarios and the favorite apps with a "more" flag behind `TrayModelState`;
every `set_tray_*` command updates one field and the menu is rebuilt only when
the model actually changed, so a list that reads the same never touches the
native menu. The layout is **Open KesVio**, **Search**, **Favorite apps** (only
when there are any), **Scenarios** (only when there are any), a separator,
**Force scan**, a separator and **Quit**. The menu deliberately carries no scan
status line and no pause: the catalog's state lives in Settings (Catalog
sources), and background scans are not pausable. Menu ids are static or carry a
checked id (`favorite:<id>`, `scenario:<id>`); a label never decides an action.

**Search** shows the window and emits `tray://search`. The click can land before
the window has a listener, so the backend also raises a one-shot intent that the
window takes with `take_tray_search_intent` when its listener registers and
clears again after handling the event; one click is one focus request whichever
path delivers it. `useTraySearch` focuses and selects the existing search field,
switches to the catalog only when another screen is open, and never changes the
query.

**Favorite apps** lists the first five favorites in their stored order as
`{ id, label }` through `set_tray_favorites`, pushed by `useTrayFavorites` only
when that list changes, with `more` adding **Show all favorites…** when the
user has more than five. The command caps the list, drops a blank or over-long
id and sanitizes labels the way scenario labels are sanitized; identical labels
get a position suffix so two rows stay tied to their own targets. A click emits
`tray://launch-app` with the id alone; the window resolves it against the
catalog it holds and launches through the ordinary path with its feedback, and
an id that has left the catalog is refused with a notice. **Show all
favorites…** shows the window and opens the Favorites view (`tray://show-favorites`).
Favorite scenarios stay in their own submenu.

The tray's **Force scan** opens the main window and emits
`tray://force-full-scan` with a null payload. `useTrayCatalogScan` calls the same
store action used by catalog maintenance, so it preserves scan settings,
exclusions, cancellation, catalog reconciliation and diagnostics. Safe completion,
cancellation and failure messages appear in the window. The menu item is disabled
until the frontend listener is registered and while startup or scanning is busy;
the hook reports that with `set_tray_scan_state { busy }`, the only state the
tray keeps about scanning. Pending requests are guarded against duplicate
clicks, and listener cleanup disables the item. Its native handle belongs to
app-managed `TrayScanState`; every rebuild creates a fresh native item from the
stored enabled state, so it retains no references to destroyed parent menus.

No command removes software. The catalog reports whether Windows has a registered
uninstaller for an entry, and **Uninstall** opens
`ms-settings:appsfeatures` through `open_apps_settings`. The removal itself, its
confirmation and its consequences belong to Windows.

The native logger starts before application setup and retains `Info`-level
production diagnostics in the log folder `paths/` resolved for this process. A
root React error
boundary replaces render failures with a static recovery screen; exception
details are not displayed in the webview. The boundary reports the failure kind
and a truncated stack to the native log through `log_client_error`, which strips
control characters and bounds both fields. Dialogs sit behind their own boundary
so a failing panel closes instead of replacing the whole interface.

Catalog reads, refreshes and catalog-update events use a display DTO. The DTO
excludes launch arguments, resolved execution
targets and shortcut icon paths. Rust retains those values only in the catalog
cache and trusted `AppState`; every native action still resolves the catalog ID
there. The DTO derives `platformKind` for Steam, Battle.net, Microsoft Store and
portable entries without persisting a second source field; it is `null` for an
ordinary Windows entry rather than absent, so a client fake cannot drop it
without failing the compiler. Hydration recomputes it from the metadata it read
and carries it in the patch, and because hydration writes that metadata back into
the cache document, the next start derives the same answer without the patch.
Display paths can be shown to the user but never return as action input.

IPC changes update all of these together:

1. Rust request/response type and `#[serde(rename_all = "camelCase")]`;
2. command registration in `src-tauri/src/lib.rs`;
3. owning entity TypeScript type, public API and client method;
4. every complete client fake used by tests;
5. event listener teardown and stale-generation behavior where applicable;
6. the recorded wire contract, `src-tauri/tests/fixtures/ipc/contract.json`.

The sixth point is what makes the other five checkable. Both sides described the
same payloads in two languages and nothing compiled them together, so a scan
command could change the shape of its answer while the typed fake kept returning
the old one — which is how a build shipped with every icon in the catalog blank.
The fixture is serialized from the Rust types themselves; a Rust-side test
compares the wire shape against it and names each added or removed field, and a
frontend test reads the same file and holds it against the interfaces through
`Required<T>` literals the compiler checks. Fields that legitimately live on one
side only — the store's own marks, the backend's rollback switches — are listed
by name in the frontend test rather than passed over in silence. Record a new
contract with `KESVIO_CONTRACT_UPDATE=1` and review the diff before
committing it.

The same fixture carries `errorCodes`, the full list `AppError::code` can return.
Payload shapes were compared across the boundary and error codes were not, so a
code could exist in Rust and be unknown to the webview — which is not a compile
error on either side. `readAppErrorPayload` rejects an unrecognized code and
`toAppClientError` collapses the envelope to `INTERNAL`, so the branch the
backend meant to offer disappears silently. Two codes were in exactly that state,
`SAVE_WINDOW_SETTINGS_FAILED` from `set_close_behavior` and
`EXPORT_DIAGNOSTICS_FAILED` from the diagnostics export. The frontend test now
holds the recorded list against `APP_ERROR_CODES` and allows only the two codes
the client raises without the backend, `DESKTOP_RUNTIME_UNAVAILABLE` and
`INTERNAL`.

Events use `namespace://name`. Catalog synchronization emits full updates,
deltas, change counts, hydration patches, diagnostics and coarse scan progress.
Progress is coalesced; icon and metadata patches are emitted in bounded batches.
The synchronization lock is released before any event leaves the backend, so a
listener that calls back into the catalog cannot meet a writer still holding it.
Startup uses the payload-free frontend-to-backend `app://frontend-ready` event.
Tauri restores geometry while the configured window remains hidden, and normal
startup registers a one-shot listener before background initialization begins.
After the React shell commits, a readiness gate waits two animation frames and
emits the event; only then does the backend show and focus the window. StrictMode
cleanup suppresses the discarded effect. Tray-backed autostart registers no
listener and remains hidden until the user opens KesVio from the tray, shortcut
or a second ordinary launch.

## 5. Persisted data

Three stores contain user data:

| Store         | Owner                          | Rules                                                                                                                                |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog cache | `catalog/storage/cache.rs`     | Versioned, atomic, cache-first, backup-aware; corrupt primary data falls back safely.                                                |
| Preferences   | `src/app/store/preferences.ts` | Versioned `localStorage` document (schema 22) for categories, marks, scenarios, first-seen data, catalog density and unknown fields. |
| Window state  | `lifecycle/window_state.rs`    | Versioned `window-state.json`; position, size, maximized flag and the close behaviour, written atomically.                           |

Window state is presentation-only and deliberately disposable: a missing,
malformed or newer-versioned document restores nothing, the window opens at the
configured 446×740, centered, and closing hides to the tray. It is the one
store whose loss costs the user nothing, so it never falls back to a backup copy
and never blocks startup. Geometry is optional inside the document, because the
close setting has to survive a session in which the window was never moved.

Schema 19 adds `lastRunAt` to a scenario. Documents written before it upgrade
unstamped rather than being stamped with the migration time, which would claim
every scenario ran at once and reorder the tray and the Recent filter around a
fiction. A stamp that is not a positive finite number degrades to none.

Persisted-format changes must bump the appropriate version, upgrade every
supported version, default new fields, preserve unknown data, safely handle
malformed input, and test migration paths.

`catalogDensity` arrived with schema 18 and holds `comfortable`, `compact` or
`dense`. It needs no version gate, because no earlier schema gave the field a
different meaning: a document written by any older version simply lacks it and
normalizes to `compact`, and an unrecognized or non-string value does the
same rather than throwing.

Everything KesVio writes itself lives beside the executable. `paths/` resolves
`<install folder>\KesVioData` once per process: when that directory accepts a
write, `KesVioData\data` holds the catalog cache, scan settings and window
state, and `KesVioData\logs` holds the diagnostics log. A root that already
contains `data` or `logs` is one this copy has written before, so it is adopted on
sight without any probe. A binary that repeatedly writes and deletes a file inside
its own install directory is a dropper pattern, and the answer to "may I write
here" does not change once the copy has written there successfully. A root that
exists but holds neither folder was created by somebody else — a deployment
script, an administrator's first run, an installer laying out a shared directory —
so it is probed once before it is trusted. That case is why the check is not a
plain `is_dir`: a standard domain user must fall back to a writable location
rather than adopt a folder whose ACLs deny them, and fail every write in silence.
A debug build never creates the folder at all, so a development run leaves nothing
in `target\debug`. When it cannot be written — an installation under
`Program Files`, a read-only medium — every store falls back to the Tauri
per-user locations
(`%APPDATA%\keskiyo.kesvio` and `%LOCALAPPDATA%\keskiyo.kesvio\logs`)
and nothing else about the stores changes. The resolved root is managed state, so
every caller asks `paths::data_dir` or `paths::log_dir` instead of Tauri
directly, and the startup log names the data folder actually in use. The first
run that resolves a folder beside the executable copies the documents from the
previous per-user folder once and leaves the originals in place; a destination
that already exists is never refilled, and icon caches are rebuilt rather than
copied because they are derived data. The debug-only dedup and visibility reports
resolve the same folder through `paths::report_dir`, which reads the root without
creating one because those writers have no application handle. When no root
exists — a debug build, or a first run before the folder is created — it falls
back to `%LOCALAPPDATA%\keskiyo.kesvio`, never to a folder named after the
product: a per-user install occupies `%LOCALAPPDATA%\KesVio`, so a report written
there would land inside the install directory and survive the non-recursive
`RMDir "$INSTDIR"` that ends an uninstall.

The installer is per user. It sets no `installMode`, so NSIS defaults to
`currentUser`, installs into `%LOCALAPPDATA%\KesVio` without elevation and still
lets the user choose another directory. That keeps the data root beside the
executable reachable: the install directory belongs to the user running KesVio,
so it accepts writes. A per-machine install would not — an unelevated process
cannot write under `%ProgramFiles%`, the root would silently fall back to
`%APPDATA%\keskiyo.kesvio`, and the `KesVioData` cleanup below would have nothing
to remove. KesVio is built for one user per computer, so the per-user install is
the model that matches it. Uninstalling
has to reach it either way: Tauri's own uninstall section clears
`%APPDATA%\keskiyo.kesvio` and
`%LOCALAPPDATA%\keskiyo.kesvio` when the user ticks **Delete app data**,
and finishes with a `RMDir "$INSTDIR"` that is not recursive. Neither touches
`KesVioData`, so `nsis/autostart-shortcut.nsh` does. On a normal uninstall it
always removes `KesVioData\logs`, which is diagnostics rather than user data;
with the box ticked it removes the whole `KesVioData` folder, and then the
install directory itself once nothing is left in it. Every branch is guarded on
`$UpdateMode <> 1`, because an update runs the previous uninstaller before the
new installer: without that guard a version bump would delete the catalog,
the scan settings and the catalog. `tests/frontend/config/installerHooks.test.mjs`
holds that contract.

A small store also refuses to rewrite itself with the value it already holds.
`scan-settings.json` and `window-state.json` compare the parsed document against
what is about to be written and return early when they match, so toggling a
setting back and forth, or closing a window that never moved, leaves the file and
its timestamp alone. A document that is missing, malformed or written at an
unsupported version never counts as a match, so recovery still replaces it.

Preferences are the exception KesVio cannot place. They live in `localStorage`,
which belongs to the WebView2 user-data folder, and Tauri forces that folder to
`%LOCALAPPDATA%\keskiyo.kesvio\EBWebView` whenever a window declares no
`dataDirectory`; the configuration file accepts only a relative path resolved
under the same local-data root, so no configuration change can move it beside the
executable. Relocating it would mean building the main window in Rust instead of
from configuration and copying a live browser profile on first run. Preference
export and import remain the supported way to carry that store between machines.

The diagnostics log is a fourth store and is not user data. `diagnostics/` owns
it. `tauri-plugin-log` still formats every record at `Info` with the local
date and time, but the file target is the application's own sink: each line is
written as `@<unixSeconds> [date][time][LEVEL][target] message` into a
ten-minute segment file named `kesvio-<segmentStartUnix>-<pid>.log`, with a
`-<n>` suffix once a segment passes four megabytes and a line bounded at eight
kilobytes. The log folder is known before the first record when the store beside
the executable resolves it; otherwise the sink keeps the last 256 lines in
memory until `setup` attaches the per-user log folder and flushes them first.

The retention promise is an exact two-hour window measured on the events, not
on the files. The XML export drops every line whose recorded time is more than
two hours before the export time and reports the window as `windowSeconds` in
its header, so a file the application keeps writing to cannot smuggle old
events into a report. On disk, `prune_expired_logs` removes a segment once its
last possible event is two hours old — a delay of at most one segment plus the
worker interval behind the window — and applies the old modification-time rule
to files from earlier builds (`kesvio.log`, `kesvio_*.log`) until they age out;
a thirty-two megabyte cap on the folder removes the oldest segments first. It
runs at startup, every sixty seconds on a retention thread owned as managed
state, after each committed scan and before an export. A file that cannot be
removed — open by another process — is counted, reported once by the worker
when the count changes, and retried on the next pass; physical removal of a
locked file is not promised. A segment dated in the future is kept while it is
less than two hours ahead of the clock and removed beyond that, so a clock moved
back cannot pin files forever. A line whose prefix does not parse is exported as
a bare `<line>` and lives as long as its segment.

Detailed scan steps are enabled by default, including normal launches and
autostart. The former `--verbose-scan` flag is no longer needed. Source outcomes,
counts, portable roots, and assembly steps remain recorded. Per-step lines carry
the worker thread id; untrusted detail is limited to 512 characters and control
characters are removed from these lines. Existing scan paths identify the
location being walked. Start-apps conversion records use the entry index and
hashed identity, with package/target presence and conversion outcome. The
conversion loop also marks each entry with its index and display name, so an
unwind or a stall inside conversion names the entry it stopped on instead of the
whole stage. The display name is bounded and control-stripped like every other
step detail, and is less exposing than the shortcut paths the same log already
records.

`sync/scan_steps.rs` owns the watchdog. `sync/commit.rs` starts it, so it covers
the whole persistence transaction rather than `synchronize` alone: the earlier
placement ended the moment scanning returned, which left the lock wait, the
cached-details merge, the delta and the cache write with no stall reporting at
all — exactly the window a scan was observed to hang in.
It checks the current step once a second, reports a ten-second stall, and repeats
at most every thirty seconds until progress advances. It joins its thread on
exit and reports failure to start the watchdog. Blocking Win32 and COM calls can
outlast cooperative deadlines. Marks before package-registry reads and machine
facts separate these calls from Shell enumeration. Timed operation scopes log
start, ordinary return, or panic with duration and thread id. Ordinary return
means control returned, not necessarily success; explicit outcome records carry
availability and scan errors. Known-folder calls record folder GUIDs, HRESULTs,
and whether the resolved folder is a network path. Registry diagnostics record
counts and numeric OS error codes. They do not dump registry values.

`sync/commit.rs` owns the persistence transaction. Its steps — lock acquisition,
previous-document and settings loading, cached-details merge, delta, cache write,
in-memory publication, and icon/log pruning — are watchdog marks rather than
plain log lines, so a stall inside any of them names the step it stopped on.

A caller that waits for another scan's result waits in `await_scan_result`, not
on a bare `recv()`. It reports the outstanding request every five seconds, so an
unanswered wait is visible in the log while it happens instead of only through a
missing line. A sender the coordinator dropped without answering ends the wait
with `OPERATION_INTERRUPTED` rather than blocking forever. Scan submission
records whether work starts, waits, or is coalesced, and failed synchronization
records the stable error code beside the safe application error. The frontend
appends that code to the refresh failure toast, so the reader can name the
failure without opening the log. These diagnostics do not change cancellation,
scheduling, cache formats, or IPC payloads.

A scan body that panics is contained rather than allowed to unwind through the
coordinator. The panic still reaches the panic hook and is still recorded, but
the scan fails with `SCAN_FAILED` and the coordinator completes the job
normally: the active slot is released, every waiter is answered, and any pending
request is promoted. The next submitted scan therefore starts, runs and
publishes without restarting the application. `SCAN_FAILED` is distinct from
`OPERATION_INTERRUPTED` so that a crashed scan is not read as a cancelled or
shut-down one. The synchronization lock is acquired through `AppState::lock_sync`,
which recovers a mutex poisoned by such a panic; the lock guards a file
transaction rather than in-memory state, and the on-disk document is replaced
atomically, so a recovered guard cannot expose a half-written catalog.

Application names, paths and file metadata arrive from Windows in the user's
language, so slicing a `&str` by a computed byte index can land inside a
multi-byte character and panic. That is what emptied one catalog: `exe_stem` cut
four bytes off a localized resource stub. `clippy::string_slice` is denied
crate-wide to keep the class closed. Each remaining slice carries an
`#[expect(clippy::string_slice)]` with a one-line reason naming why its index is
a character boundary — a `.get()` guard that already returned `Some`, an index
from `char_indices`, a `find` of a one-byte ASCII character, an explicit
`is_char_boundary` check, or an ASCII byte match. A new slice cannot compile
until its author states which of those applies.

A panic hook installed after logger initialization records Rust panic source
location, thread id, and an explicitly captured backtrace, then flushes the logger
and invokes the previous hook. Panic payloads are excluded from the file log.
Backtrace output is capped at 128 lines of 1024 characters each; every frame line
is a normal timestamped record. Release frames are reported as unknown: the
MSVC toolchain keeps symbol names in a separate `.pdb`, the installer ships no
`.pdb`, and no `strip` setting changes that. The panic source location, the
recorded operation and the current scan step are what identify a release panic;
the backtrace only bounds its depth. This hook cannot diagnose an OS process
kill, power loss, or every native crash.

`export_diagnostics_log` flushes logging and prunes expired files before rendering
the newest twenty thousand lines as XML. Each formatted record becomes a dated
`entry`, and unparsed lines remain `line` elements. The document element carries
a `panics` count alongside `entries`, so a reader sees whether the exported
window contains a crash without searching for it; the count only summarises
records already present and collects nothing new. File rotation and the export
line cap bound the retained diagnostic history; particularly busy scans can
rotate earlier records out before the two-hour age limit. Losing the directory
costs only diagnostic history.

The export is redacted before it is escaped, and there is no raw mode.
`diagnostics/log_collection.rs` bounds what is read first — at most 512 files,
4 MiB per file and 16 MiB in all, 20 000 lines and 4 MiB of selected text,
lines over the writer's 8 KiB bound skipped — and reports `truncated="true"`
on the document element when any bound cut. `diagnostics/redaction.rs` then
walks the selected text once with tokens that are stable within one export:
every absolute Windows path, UNC path and `file:`/`http(s):` URL becomes
`[path-n]` or `[url-n]` — the same value, whatever letter case Windows used,
keeps the same number, so the lines that name one folder stay correlated
without naming it; the current `USERNAME`, `COMPUTERNAME` and `USERDOMAIN` are
replaced as whole words by `[identity-n]`; and a `password`, `token`,
`authorization` (with its `Bearer`/`Basic` credential), `user` or `machine`
key's value, quoted or not, even across a line break inside quotes, becomes
`[private-n]`. A quoted path ends only at its own quote, so an apostrophe or a
semicolon inside a folder name cannot leak the tail; a bare path keeps going
over a space until the next word is a log key, a connective the logger writes
after a location (`finished`, `stopped`, `thread`, …) or the path already ended
in a file name, so `D:\разный хлам\Git finished in 3ms` reads
`[path-1] finished in 3ms`. Source, generation, error code, duration,
timestamps and thread ids survive untouched. This is bounded best-effort
redaction of known shapes, not a proof against arbitrary prose: a folder whose
name ends in a dotted token, a personal name that is not the account name, or
a secret logged without a recognised key would pass through, which is why the
Settings copy still says to read the file before sharing it, and why nothing
personal belongs in a log line in the first place. **Preview redacted log**
(`preview_diagnostics_log`) renders the same document and returns at most the
first 16 KiB with a note that the export holds the rest; the interface shows it
in a scrollable block, discards a result that arrives after a newer request or
after the section unmounted, and never writes anything — the native save dialog
of the export remains the only owner of a path on disk.

Preferences preserve unknown root fields, which is also how a field this version
stopped reading survives: scenario run history is no longer collected or parsed,
and the records an earlier version wrote are carried through the document
untouched rather than dropped. Invalid primary data falls back to a
one-step backup. Stored documents are validated before normalization and backup
rotation: scalar values, arrays, empty objects and invalid version envelopes do
not hide a valid backup. Unversioned legacy documents with recognized preference
fields remain readable. Only a valid primary rotates into the backup, so recovery
followed by a failed primary write keeps the recovered copy intact. A primary
read failure prevents writing over data whose version cannot be checked.
A document written by a newer preference schema is never
overwritten. Import and local-backup restore reject unsupported/newer documents
and also refuse replacement when the installed app is older than the current
local schema. Export contains preference-backed data only: never the catalog
cache, executable paths, catalog icons, or scan folders. Each Scenario also
retains a bounded 32 KiB name/icon snapshot per app identity so unavailable
entries remain identifiable and removable; it is presentation data, never a
launch target.

Catalog initialization owns its subscriptions through background startup. A
failure at either registration or background startup releases every listener and
clears the shared initialization attempt so Retry can reconnect. Each consumer
receives an idempotent release function; releasing one twice cannot tear down a
newer initialization. One failing unlisten does not prevent remaining cleanup.

A scenario keeps one `lastRunAt` stamp, overwritten on every run. That is
ordering data, not the run history this version removed: no per-run record, no
counters, and nothing about what a run did. It is written when the run starts
rather than when it ends, so a run interrupted by a quit or a crash still counts
as the last thing the scenario did.

Import applies preferences in memory before attempting to persist them. If the
write fails, `preferencesPersisted` becomes false and the shell displays the
unsaved-changes banner. The import action still returns success, so the settings
panel can show **Settings imported.** while those changes remain unsaved.

The last user change to preferences can be undone. Hiding or restoring an app,
moving it to a category, renaming a category and every change to a scenario's
definition (create, rename, delete, add or remove an app) run through
`app/store/transaction.ts`: the transaction snapshots the persisted preference
fields, applies the change, and keeps the inverse of what actually changed as
one `UndoEntry` — per list the ids to put back and to take out, per override
map the previous value of each touched key, per category and scenario the
previous record or its absence — together with the preference revision it
produced. Nothing else is copied, and a change that changed nothing records no
entry. `undo()` reverses that patch against the _current_ state, so a scan
delta that reconciled ids or added marks in between is not rolled back; the
catalog generation, the discovered apps and background state are never
touched, and a hidden app that a scan has since removed simply leaves the
hidden lists. A later user transaction replaces the entry; importing or
restoring preferences clears it; favorites, run stamps, collapsing categories,
reordering and density are ordinary persists that neither create nor consume
an entry. A restored category name that another category has taken meanwhile
is refused with a safe message and the entry is kept; an entry whose revision
no longer matches is dropped rather than applied. The undo persists like any
transaction, so a failed write leaves the undone state in memory, sets
`preferencesPersisted` to false and answers with a message that says so. The
interface offers it three ways: the toast every transaction raises
(`useUndoFeedback`, one per revision) carries an **Undo** action, **Ctrl+Z**
undoes while focus is outside a text field and only while something can be
undone (a text field keeps its own undo), and the More page shows the last
change with an **Undo** button until the next change replaces it.

A scenario's launch and close lists keep one row of tiles on screen and hold the
rest behind a count and a control that opens them. Which tiles fit is read from
where the browser actually placed them rather than calculated from widths, so
the count follows the window as it is resized and the row never wraps to a
second line while collapsed. Every tile stays in the list and stays laid out
whatever is hidden — a reading taken from a list that had already been shortened
would only confirm the shorter list and take another tile away on each pass —
and the ones past the first row are clipped by height and removed from the focus
order rather than unmounted. The run dialog never collapses: it states what is
about to happen, so it may not hide half the answer.

Catalog tile geometry is owned entirely by the `--app-card-*` tokens in
`src/app/styles/index.css`, never by a size class on a card. `.app-card-grid`
lays out `repeat(auto-fill, var(--app-card-width))`, so the column count follows
the window at any tile size. Settings offers three presets — Comfortable,
Compact and Dense — and `App.tsx` stamps the choice as `data-density` on
`.app-shell`; each preset block redefines the whole token set rather than a
subset, because a partly-defined preset would inherit comfortable sizes and
overflow its own shorter card. Compact and Dense hide the version line through
`--app-card-version-display`, which keeps the element and its tooltip in the
tree. A passive lower-left badge identifies Steam, Battle.net, Microsoft Store
and portable entries; ordinary Windows entries have no badge. Steam games and
the trusted Valve Steam client use the Steam classification. Steam and
Battle.net use a gamepad mark, Microsoft Store uses a shopping-bag mark, and
portable entries use a USB-drive silhouette. Every glyph is monochrome white;
the tooltip retains the specific source identity. Badge artwork performs no
runtime network request. A
same-generation hydration patch carries the derived
platform when executable metadata identifies Battle.net after the initial
snapshot. The density setting keeps its copy beside the icon and aligns its
segmented control to the right on the row below.
`tests/frontend/styles/card-density.test.mjs` holds these geometry contracts.

Filing an application into Installers & Docs by hand records which half it
belongs to. The category holds one bucket per artifact kind, so a placement that
only said "Installers & Docs" had to pick installer, and a reference document
filed by hand landed beside setup programs with no way back. The menu therefore
opens a third level under that row — Installers or Docs — and the choice is
persisted as its own placement. The scanner's own verdict is unchanged: an entry
it already recognised as an installer or a document is not offered a move, and
upgrading a document written before this split leaves every existing placement an
installer.

A category carries an accent colour. The fifteen built-in rows each hold a
distinct hue, except System and Windows Features, which deliberately share one
muted tone to say the software there is not the user's own. A category the user
creates takes a free accent from the same palette and keeps it. The palette was
eight hues and repeated visibly once a machine held more than a handful of
categories, so it is fourteen now; a preference document written before the
palette widened keeps no accent of its own, and every category it holds is
redealt across the full range on first read. The accent is derived from the
category id rather than drawn at random, so the colour a category lands on
survives every later start.

Marks — favorites, hidden, promoted and manual artifact placements — and category
overrides are reconciled against the catalog on every full replacement, not only
at startup. The initial load, the result a refresh, a forced scan or a cache
reset returns, a `catalog://delta` and a preferences import all run the same
reconciliation. A mark matches a record by catalog ID **or** by its durable
identity, so a rescan that reassigns IDs cannot silently clear favorites or
reveal hidden applications. Reconciliation persists only when a set actually
changed, and an empty catalog leaves the stored sets untouched instead of
treating absence as removal. First-seen timestamps follow the same path, so an
application discovered by a background delta appears in Recently added without
waiting for the next startup.

Deleting a user category removes that category's overrides rather than
rewriting them to another category. The affected applications return to the
category the classifier detected for them.

Catalog writes retain the previous known-good cache as `apps-cache.json.bak` after
an atomic replacement. In-memory catalog state updates only after the replacement
write succeeds. A cache file written by a newer schema version is never
overwritten by an older build: the catalog treats it as absent, scans into
memory, and skips the write so the file survives intact for the newer build.
This mirrors the equivalent preference rule above.

Cache schema 11 adds the optional `scanFolder` origin to catalog records. Schema
10 loads with that value absent and upgrades in memory; older supported schemas
continue through the same cumulative migration path. Within schema 11 two
further additive fields default when absent: `volumeId` on a record and the
document-level `volumes` list of tracked volumes (see _Removable volumes_
below); a document written before them loads with the record field `None` and
the list empty.

The document a load hands back carries no icons, because hydration owns them and
fills them in afterwards. PNG files in the content-addressed icon cache are the
persistent source; `apps-cache.json` does not keep duplicate base64 payloads.
Hydration persists newly learned textual metadata while clearing icon payloads
before the atomic catalog write.

Cards in the active catalog view request priority hydration through IPC batches
of at most 128 IDs. A new catalog generation repeats that request, so a scan
cannot leave the displayed cards without images. Startup, Refresh, Force,
watcher scans, and the former three-hour recovery timer do not enqueue a
whole-catalog pass. Hidden applications and other sections wait until their view
or search makes them active. Hydration reuses scanner metadata instead of
rereading an executable whose descriptive fields are already complete. It reads
the already published current-schema document without rerunning structural
artifact promotion, so its generation check, worker read and metadata write do
not repeat registry discovery.

Resetting the catalog removes every file belonging to the cache, including
siblings left by earlier builds, and leaves scan settings and
the icon store untouched.
Cache/index and generated icons are separate; clearing icons does not remove the
catalog, and resetting the catalog does not remove user preferences.

## 6. Catalog operation

Sources are Start Menu shortcuts, uninstall registry entries, Start Apps and
packaged applications, Steam libraries, explicitly configured portable folders,
optional fixed-drive discovery, and watcher-triggered refreshes. Each source
reports health independently; failed or stale sources retain their last valid
snapshot where safe.

That health reaches the user as the **Catalog sources** section of Settings,
which is visible without opening Advanced. `entities/app/lib/sourceHealth.ts`
turns each `SourceHealth` record of the last diagnostics into a row with a
human source name (Installed programs, Start Menu, Start apps, Installer cache,
Steam, Portable folders) and one of: **Up to date**, **Unavailable** (the
source did not answer; the last successful result is still shown),
**Incomplete** (the stage stopped early — timed out, entry limit or cancelled),
**Failed** (never succeeded, nothing to show), **Not scanned**, or
**Scanning…** while a scan runs. An empty successful answer is **Up to date**
with zero applications, because unavailability and emptiness are different
facts. The section's summary line names the sources that need attention, the
detail table opens on its own when any does, and **Refresh catalog** runs the
ordinary refresh through the store — the same coordinator path as the header
button. It is not a per-source retry: a scoped retry would need a backend
allowlist and a scoped coordinator request, and the button is named for what it
does. The store keeps the newest diagnostics by `completedAt`, so a late event
from an earlier scan cannot make a recovered source read as failed again. The
section lays out like every other Settings card: the icon centred on its text,
**Source details** as a full-width disclosure with the chevron at the right,
and the action row at the bottom — the button fills the width on a narrow
window and sits at the right edge otherwise. There is no per-scan change
report: a **Changes from last scan** section was built and withdrawn at the
user's request, and the toast that used to follow every background scan
(`catalog://changed`, "N applications added") was removed on 15 September 2026
because watcher and startup scans made it spam the notification area. A
background scan now updates the grid silently through `catalog://delta`; the
diagnostics counts remain the only account of what it changed. A manual refresh
still reports once through its own result.

Normal startup is cache-first. Background validation and incremental scans keep
the UI usable while source work runs. Startup, watchers and ordinary refreshes
scan only explicitly configured portable folders. Fixed-drive discovery is on
by default and runs during **Force full scan**. It also runs on a startup or
refresh whose catalog holds no portable snapshot at all — a fresh install or a
reset cache — because "retain what the last walk found" retains nothing there,
and a first scan that returned no portable applications read as a broken
scanner. A snapshot that exists but is empty does not trigger the walk, so a
machine with no portable software keeps its routine scans cheap. Watch-triggered
scans never walk the drives. For the same reason the first-run **Scan for apps**
prompt requests a full scan rather than a refresh: that button is the one place
where the user has asked for everything to be found. An ordinary
refresh retains already discovered fixed-drive portable applications while the
option remains enabled, but drops their large directory index; disabling the
option removes those retained records on the next refresh. A configured portable
folder that is currently unavailable on a mounted drive remains retained rather
than being treated as removed from settings; a configured folder whose drive
letter is not mounted at all — a pulled stick, `F:\` itself or `F:\Apps` while
`F:` is gone — is neither scanned nor retained, so any scan drops its records
and the drive's entries leave the directory index with them. While automatic
drive coverage is enabled, cached local drive roots that are absent from Windows
drive discovery and inaccessible are also retained, except for the letters of
those unmounted configured folders, so the two rules never disagree about one
stick. Root planning probes each cached drive once, does not infer drive
coverage from UNC or relative targets, and never scans an unavailable root. On
return, that drive follows the normal refresh/force policy. Confirmed missing
application targets still follow the existing target-availability filter.
Configured exclusions also remove matching retained applications while their
root is unavailable, for both ordinary refresh and force scan.

The directory index caches the cards a walk built, and an incremental scan
reuses them for a directory whose timestamp and children are unchanged without
reading the executables again. A cached card's display name is not trusted
across builds: it is re-derived from the facts the record carries — path,
parent folder and product name — every time the record is reused, so a naming
rule that changed after the walk, such as `7-Zip SFX` no longer counting as a
product name, reaches every cached card on the next ordinary scan instead of
waiting for a forced walk to rebuild the index.

A volume watcher owns one hidden top-level window on its own thread and receives
the `WM_DEVICECHANGE` volume arrival and removal broadcasts Windows sends to
every top-level window; the window is a stock `STATIC` control subclassed
through `SetWindowSubclass`, so no window class is registered, and the drive
letters come from `dbcv_unitmask`. It starts once at startup, lives in
`AppState`, and reads the scan settings at event time. A change whose letters
touch a configured scan folder runs an ordinary refresh through the scan
coordinator — not a forced walk of the fixed drives — so a pulled stick's
applications disappear within the delta of that scan and a returned stick's
come back; an arrival also restarts the change watcher so the folder is watched
again. A letter that touches no configured folder still refreshes when it holds
a tracked volume (an arrival, identified through `GetVolumeInformationW` at
event time) or when a tracked volume was last mounted there (a removal);
anything else changes nothing.

#### Recovery after a transient failure

A scan that commits with a source that did not answer (`provider_failed`), a
stage that timed out (`timed_out`) or a configured folder that could not be
reached (`unreachableFolders` in the diagnostics: a folder that is missing on
a mounted drive or a UNC share that does not answer, both retained rather
than dropped) schedules one bounded retry through `catalog/sync/retry.rs`: the
first 5 seconds later, then 20, then 60, and after those three attempts only a
manual refresh or a returning volume runs another scan. A retry is a
`SyncRequest::Watch` scoped to the failed sources (start-menu, registry-backed
sources, portable, or every source for Steam), so it never walks the fixed
drives, and it coalesces through the coordinator like any other request. A
scan that commits with no transient failure resets the budget; a cancelled
stage and a hit entry bound are not transient and do not retry; cancelling the
scan or resetting the catalog cancels the pending retry. The pending attempt
lives in `AppState.scan_retry` as a guard whose drop stops the timer at once,
and a superseded attempt (a reset, a cancel, a newer schedule) never fires.
Retained records stay exactly as the source retention policy leaves them; an
unreachable share does not delete anything.

#### Removable volumes

A scan folder's drive letter is where the medium is mounted today, not what it
is. `platform/windows/volumes.rs` reads the volume serial, label and filesystem
of a root through `GetVolumeInformationW` and enumerates the mounted local
letters (fixed and removable; never CD-ROM, network or unreadable ones).
`catalog/volumes.rs` keeps one `TrackedVolume { folder, serial, label,
filesystem, mountedAt }` per configured folder with a drive letter, persisted
in the catalog cache and mirrored in `AppState` for the watcher, and resolves
every configured folder before the portable walk:

- the configured letter is mounted → the folder is scanned where it is and its
  records carry the key (`serial` as eight hex digits) of whatever volume is
  there now; a folder with no entry learns that volume; a folder whose entry
  names another serial (a reformat, or a different stick that took the letter)
  keeps its entry, logs a warning, and lets the new volume start its own
  records and category — trust is never moved automatically, and removing and
  re-adding the folder in Settings is the manual re-map;
- the configured letter is not mounted but the tracked serial is mounted at
  exactly one other letter → the folder follows it (`F:\Apps` scans as
  `G:\Apps`), the stale letter's records drop as an unmounted root, and
  `scanFolder` names the place the record actually is;
- the same serial at two letters (a clone) is an ambiguity: no remap, a warning
  naming both letters, the folder counts as unmounted;
- a UNC or relative folder is never a volume, and a letter whose identity
  cannot be read is scanned without one.

The volume key leaves the letter out of the preference identity: for a record
that carries `volumeId`, every path the identity hashes that starts with the
record's scan-folder letter is anchored to `volume:<key>` instead, so the same
stick at `F:` and at `G:` yields one identity while a shortcut on the stick
that points at `C:\` keeps its letter. Canonical ids stay letter-based on
purpose: the first scan after the update sees the same ids with new
identities, and the frontend carries favorites, hidden marks, overrides and
first-seen stamps over by id (`app/store/identityRekey.ts`);
when the letter changes later, ids change and identities stay, which the
identity-keyed reconciliation already handled. The golden corpora carry no
volume, so their recorded identities are unchanged.

On the frontend a drive category is keyed `drive:<key>` when the record has a
volume and `drive:<letter>` otherwise, labelled `Disk <LETTER>` from the current
letter. `app/store/driveCategories.ts` creates a missing definition, migrates a
legacy `drive:<letter>` definition to the volume key in place (name, accent and
order position kept) the first time a record with a volume arrives for that
letter, and updates a label that still reads `Disk <X>` to the current letter
after a remap while leaving a renamed category alone. Not done by design: no
manual mapping dialog (a reformatted stick is a new category; remove and re-add
the folder to follow it), Settings still lists the configured path (the
resolved letter is in the log and in `scanFolder`), and the directory index is
keyed by path, so a remapped stick is walked once at its new letter.

The Windows change watcher combines registry and directory notifications after
eight quiet seconds and dispatches at most one background scan every thirty
seconds. It retains notifications received during that interval instead of
starting overlapping scans. Known Start Menu and configured portable roots scan
only their affected source group, while registry notifications scan registry,
Start Apps and installer-cache sources. Registry metadata is refreshed for every
classified watcher scan. An unknown or overflowing notification falls back to
all routine sources. Sources outside the selected group keep their cached apps
and health state.

Deduplication applies auxiliary-tool reasons after merging records for the same
executable. A merged card therefore cannot remain primary until the next cache
load merely because a secondary record supplied its tool classification. Reasons
from a different executable still cannot demote the main application. Cache
sanitation and migration remain active.

A force scan bypasses
the previous filesystem index and shares the same three-minute cooperative
traversal budget across portable roots that a refresh uses. Only cancellation
discards a portable run: a run stopped by
the time or entry bound still adopts what it found, because an incompletely
walked root keeps its previously known applications. Scan work is cancellable and generation-aware; no
stale result may overwrite a newer generation. The rule holds in both
directions, so a scan hands its records and the generation that produced them
back as one value: the interface adopts that generation with the records, and
hydration patches from the same generation cannot be mistaken for stale work.

Generations are monotonic for the life of the process. `AppState` keeps the
highest generation it has observed — the cached document `get_apps` loads, the
previous document at each commit, and the stored generation a cache reset reads
before deleting the file — and every commit numbers its document one past the
larger of that and the document on disk, so a reset cannot hand out a number the
interface has already seen. The interface applies one predicate to everything
that carries a generation: an older snapshot, scan result or delta is ignored, a
snapshot or scan result of the same generation keeps the records already held
so hydration patches survive it, a newer one replaces the catalog, and a
hydration patch applies only to the generation currently shown. A refresh that
answers after a delta already moved the catalog on therefore changes nothing,
and `isRefreshing` stays set until the last of several overlapping scan calls
has finished rather than falling when the first one returns.

Scanning starts no interpreter. Start Apps and packaged applications are read
through the shell itself: `platform/windows/apps_folder.rs` enumerates
`shell:AppsFolder` over `IShellItem`/`IEnumShellItems` and reads each entry's
display name, parsing name, `System.Link.TargetParsingPath` and — for packaged
entries — `System.AppUserModel.PackageFullName` and `PackageInstallPath`. The
executable behind a packaged entry comes from the read-only application map in
`platform/windows/registry/package_registry.rs`. Nothing about this path spawns
`powershell.exe`, so a scan no longer looks like a process launching a hidden
interpreter — behaviour that reputation-based antivirus scores against unsigned
binaries. The package map is best-effort: when it cannot be read, packaged
entries keep their name, publisher, version and install location, and lose
only the resolved executable.

| Stage          | Invariant                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Traversal      | Explicit folders on routine scans; fixed drives on forced scans and on the first routine scan of a catalog with no portable snapshot; shared time, depth, entry and cancellation bounds; no reparse-point recursion. |
| Classification | Artifact, visibility and category decisions are deterministic and explainable.                                                                                                                                       |
| Deduplication  | Canonical identity and launch evidence prevent unrelated same-name applications from merging.                                                                                                                        |
| Install root   | A record keeps an install location only while that location contains its own launch target.                                                                                                                          |
| Cache          | Source-aware generation document; invalid data degrades safely.                                                                                                                                                      |
| Hydration      | Icons/details are lazy, size-limited, trusted-ID-only and processed in bounded batches.                                                                                                                              |
| Search         | Current view/category only; literal matches rank above corrected, transliterated and fuzzy matches.                                                                                                                  |

A query token expands into variants before matching: the literal token, the
token remapped between the English and Russian keyboard layouts, and a
Cyrillic-to-Latin transliteration. Ranking keeps the literal variant above the
rest, so a transliterated hit never displaces an exact one. Transliteration is
letter-for-letter and does not resolve loanwords whose spelling diverges. The
scenario launcher expands its query the same way and over the same helpers, so
finding a scenario costs no more layout awareness than finding an application.

User-defined search aliases (preferences schema v20 `searchAliases`, the
**Search aliases** card action) were withdrawn on 2026-09-15 at the user's
request. A stored `searchAliases` map is kept as unknown data by the
preferences normalizer and ignored; the schema version was not bumped because
the document shape only lost an optional field.

Search stays inside the active view, and a query that also matches records
outside it reports those counts with a direct link to the owning view, rather
than leaving the matches invisible. Every catalog view answers this way, not
only the main one: the whole catalog, Favorites, Tools, Hidden and Installers &
docs are each a scope, and a view offers every scope except the one being read.
Searching inside Favorites therefore points back at the rest of the catalog
instead of ending at an empty grid. Each count equals what the destination will
show once opened, so the number never disagrees with the view it leads to.
Typing into search from Settings, More or Scenarios switches to the catalog.
Empty user categories are not rendered while a query is active. The command
palette opened with an empty query lists favorites first, then recently added
applications.

The install location is part of the durable preference identity, so a wrong one
does not merely mislabel a card — it silently rewrites the key that favorites,
hidden state, category overrides and scenario membership are stored under. Two
rules keep it honest. Traversal skips any directory unpacked from an Electron
archive (`*.asar.unpacked`), which is where a vendored helper tree would
otherwise be catalogued as installed software. And a record adopts an install
location only when that location actually contains its own launch target, so a
merge or a registry match cannot attach a nested component's directory to a
product. Without the second rule, an application that updates itself into a
versioned folder produced a new identity on every update.

Traversal also stays out of three kinds of folder that hold executables no one
installed. A Wine build keeps its stub Windows binaries — `wmplayer.exe`,
`taskmgr.exe`, `msiexec.exe` — under `lib/wine/<arch>-windows`, with Microsoft
version resources that read as applications and installers; the `<arch>-windows`
and `<arch>-unix` names and a `wine` folder directly under `lib` are skipped.
Puppeteer, Playwright and editor sandboxes cache one Chrome for Testing per
version under `puppeteer`, `ms-playwright`, `ws-browser` and numbered
`chromium-<n>` and `win64-<version>` folders, a browser nobody launches by hand;
those names are skipped. And uv unpacks interpreters into
`cpython-<version>-windows-<arch>` folders, where `pythonw.exe` is a package
manager's private runtime; a `cpython-` folder naming `-windows-` is skipped. A
folder merely called `Chromium`, `wine` or `cpython` is still walked. Records
these folders already contributed leave the catalog on the next scan that walks
their drive again, which for a fixed drive outside the configured folders is the
next forced scan.

A scan folder that is a whole drive becomes a category. Add `F:\` under
**Additional scan folder**, scan, and every application found on that drive
lands in **Disk F** — a user category with the deterministic id `drive:<volume key>`
(`drive:f` while the volume's identity is unknown), placed
at the top of the sidebar the way a category the user creates is, so it can be
renamed, reordered, collapsed and deleted like any other, and it comes back on
the next scan while the folder is still configured. The backend states
only the fact: every portable record carries `scanFolder`, the deepest added
folder that contains it, or nothing when a forced walk of the fixed drives found
it on its own; the frontend draws the conclusion, and only for a folder that is
a drive root, so `D:\Apps` changes nothing and a fixed drive walked by a forced
scan never becomes **Disk C**. The drive is one exclusive container: whatever
the classifier made of an executable found on it — an installer, a document, an
auxiliary tool, a card with an older "Move to" override — the selector places
it in the drive category as a primary application, so a stick reads as the
whole of what is on it and nothing from it turns up in Installers & Docs or
Tools. The category and the preference identities follow the volume, not the
letter (see _Removable volumes_ above): the same stick mounted under another
letter keeps its category, its name and its favorites, and a
category still called by its default name is relabelled to the new letter. A
stick that is out loses its records on the refresh the volume watcher runs when
the letter goes away. Reconciliation removes an absent drive category whose
name still has the generated **Disk X** form, including its order, collapsed and
override references, so temporary volumes do not accumulate in preferences. A
drive category the user renamed survives while empty and returns under its own
name when the stick is plugged back in and scanned.

One more rule reads the Start Menu as evidence about a folder. A shortcut whose
target sits in a folder named after the shortcut's own product — RivaTuner's
`RTSS.exe` in `RivaTuner Statistics Server\` — marks that folder as the
product's own, and every other portable executable found directly in it that no
shortcut references is that product's companion and moves to Tools:
`EncoderServer.exe` and `RTSSHooksLoader.exe` carry no publisher, so the
publisher-based nested rule could not see them, and they are siblings rather than
descendants. A shared folder that names no product — a downloads folder holding
one shortcut target beside unrelated programs — anchors nothing, and a companion
in a subfolder of its own is left to the nested rule and to its own name.

The last rule keeps one row per portable product. Git for Windows stamps thirty
helpers with the product name **Git**, CrystalDiskInfo ships a 32-bit, a 64-bit
and an ARM build of one program, and each of them used to be its own card or
tool. `catalog/product_duplicates.rs` groups the portable executables that share
a display name, a publisher and a version — applications only; installers with
one product name can be two different downloads, a record without a version is
no evidence of sameness, and one without a publisher joins a group only with
builds in its own folder whose stems differ from its own by nothing but the
architecture marker (`EncoderServer.exe` beside `EncoderServer64.exe`) — and
keeps one of them: a
target some shortcut or App Paths registration points at is never dropped, then
a primary record beats an auxiliary one, an executable named after the product
(`git.exe`, with any architecture marker in the stem set aside) beats a helper,
one whose file description is the product name beats one that describes a
component (`HDSentinel.exe` over `hdsctrl.exe`), the 64-bit build beats an
untagged, a 32-bit and an ARM one in that order, and a shallower or shorter
name settles the rest. The others are rejected with the `product_duplicate`
reason and never reach the catalog, so they also stop counting as Tools. The
rule runs after deduplication on purpose: dedup fills a record's missing version
or publisher from its siblings, and a group decided before that would not be the
group a second sanitize sees. Two versions of one product stay two rows.

Before the first scan the catalog shows what will be scanned, that nothing runs
automatically at startup, and that the data stays on the device, with the scan
action and a link to folder settings on the same card.

A scenario list is filled from a modal picker that searches the catalog and
switches on several applications at once, each row naming the category the
application sits in and carrying its switch on the right. The dialog is portalled
to `document.body` at a fixed size, so a transformed ancestor cannot become its
containing block and push it off the window. It states which list is being
filled — launch or close — and for which scenario, since both lists open the
same dialog. It offers exactly the applications the All apps
view shows: hidden records, installers and auxiliary tools stay out, while an
entry already stored in a scenario still resolves against the whole catalog so
it keeps its name and icon. If an older release changed an application's
preference identity during an update, the saved snapshot restores the entry by
exact name only when the current catalog has one unambiguous match. Candidates
are ordered by name, case-insensitively
and with digits compared as numbers, until a query replaces that order with
relevance ranking; a query that names a category also brings in the applications
of that category, after the entries the query matched by name. Rows arrive a
batch at a time — revealed by scrolling to the end of the list or by a control
that names how many are left — and skip layout and paint off-screen through the
same `content-visibility` mechanism the catalog cards use; the footer counts the
whole result set, not the rendered batch.
Applications the list
already holds are not offered, and an application held by the opposite list of
the same scenario is shown locked with the reason rather than accepted and
rejected afterwards. Confirming adds the whole set in one step; every close
target that carries a risk warning still costs its own separate confirmation,
and declining one leaves the rest of the set intact. Deleting a scenario is
confirmed in its own dialog, since the delete control sits beside rename and the
configuration it removes cannot be recovered.

Every destructive confirmation — delete category, delete scenario —
is the one `shared/ui/ConfirmDialog`: same layout, same wording positions, same
Cancel and named danger action, painted from tokens and portalled to
`document.body`. It dismisses only through Cancel or its close control: neither
Escape nor a click on the backdrop discards it, so a confirmation cannot be lost
to a stray keystroke while it is being read. Cancel takes focus on open, which
keeps the keyboard exit one keystroke away, and focus returns to the control that
opened the dialog. Optional detail renders
in a block between the description and the actions.

Returning focus is not specific to confirmations: every dialog hands it back to
the control that opened it, so closing one never drops the keyboard at the top
of the catalog. The application information dialog used to be the exception and
left focus on `<body>`; it now goes through the same shared modal lifecycle as
the rest, and a regression test opens it from a control and asserts the control
has focus again after it closes. The navigation drawer restores focus to its
menu button explicitly, because the burger outlives the panel.

The catalog scroll root reserves its vertical scrollbar gutter. The shared
modal lifecycle can therefore lock that root for any drawer or dialog without
changing the width of the obscured page underneath it.

The More page previews every scenario while they all fit its card and spends the
last slot on a "View all" row only once a scenario is left out of the preview.

The scenario launcher is a root-level dialog rather than a page detail, reachable
with Ctrl+Shift+K from any view and from that "View all" row. A shortcut nothing
names is a shortcut nobody presses, so the two places that already hold scenarios
name it: the Scenarios page above its list, and the Favorites view beside starred
scenarios, which is the only one of the two a user reaches without going looking
for scenarios in the first place. Neither hint renders when there is no scenario
to run. It searches by
scenario name and by the apps a scenario holds, so an entry the catalog no longer
resolves stays findable by the name stored with it. Filters cover favorites and
scenarios that have run; ordering is by last run, name or creation date, either
way round, and a query orders by relevance instead. The direction control is a
real toggle rather than an arrow that only depicts one: each sort has a natural
order and the toggle reverses it, which is the one rule that reads the same for
a date and for a name. Filters and ordering share one row at the supported
minimum window width, which is what bounds how many filters this bar can hold; a
scenario whose apps no longer resolve is reported on its own row instead, as a
count beside its list sizes.
Arrow keys move between the run buttons so Enter runs the scenario that has
focus, and typing while a row is focused returns to the search field.

Classification decisions are explainable in the interface, not only in source:
the application information dialog reports the discovery source, where the
record is shown and why, the recorded launch-target check where one applies,
and the signal that chose its category.

An entry that removes software is never an installation artifact, however
generic its target: a shortcut is read as an uninstall action when its first
word says so (`Uninstall …`, `Удалить …`, `Деинсталляция …`) or when its launch
arguments carry an uninstall switch (`/x{…}`, `--uninstall`, `REMOVE=ALL`).
Both checks live in `catalog::filters` beside the uninstall-target path rule,
so the artifact classifier and the visibility rules read the same definition.
Product names built from the same words — Revo Uninstaller, IObit Uninstaller —
stay applications, because only the first word counts.

Windows built-in tools are recognised by their whole name rather than by a
substring, so a vendor product can never inherit the category by containing the
word. A trailing qualifier does not defeat that rule: the comparison also runs
against the name with its parenthetical suffixes removed, which is what files
`Windows PowerShell (x86)` and `Источники данных ODBC (64-разрядная версия)`
with the tools they are variants of. A name that consists of nothing but a
qualifier matches no rule at all.

Characters that imitate a Latin letter are folded before any signal is read, so
the micro sign in `µTorrent` is compared as `u` and the record reaches the same
rule as its ASCII spelling.

Shell binaries are not category evidence. A Start Menu folder shortcut resolves
to `explorer.exe`, so the executable of a Windows feature is read from the tools
that are only ever themselves; `Проводник` is recognised by its name instead.

An entry generated for a `file://` target is documentation whenever the target
is a document, so a registered `…/doc/index.html` is filed with the other
documentation rather than as an application of the product it documents.

Category rules are applied twice, and the second pass is the one that matters.
A source records a first guess from the name and path it has; assembly re-runs
`classify_app` over the finished record, where the publisher, product name,
description and resolved executable are available and outweigh the name. A rule
that needs vendor evidence therefore belongs on those fields, and measuring a
source's output in isolation understates the result: on a 432-record scan of
three sources, 51 entries carried no category, while the assembled catalog of
217 left 5.

A component shipped as part of Windows is recognised by its publisher, not by
where it is installed. Store packages live under `Program Files\WindowsApps`
whether Microsoft ships them with the operating system or sells them alongside
everyone else's, so treating that tree as evidence swept Xbox, the Game Bar, Dev
Home, To Do and Power Automate into Windows Features. The package publisher id
`cw5n1h2txyewy` is the identity of `CN=Microsoft Windows` and belongs only to
genuine shell components; first-party applications that are still part of a
Windows installation, such as Calculator or Maps, stay on the explicit
package-name list beside it.

### Signals that do not depend on knowing the product

A table of product names can only recognise software it already lists, so three
signals carry records the table has never seen:

- **What the system registered.** `catalog::machine::Associations` reads the file
  types and URL protocols an executable claims — `Applications\<exe>\SupportedTypes`
  and the `Capabilities` of every entry in `RegisteredApplications`. An
  application that owns `.flac` is a player and one that owns `mailto:` is a mail
  client, whatever it calls itself. Extensions are a closed, standardised set,
  unlike product names. The map is a machine fact read once per scan and is never
  persisted, so no cached record can go stale against it.
- **What the vendor wrote about itself.** `catalog::classify::vocabulary` holds
  plain purpose words in Russian and English — `media player`, `графический
редактор`, `terminal emulator` — matched against the description and the
  ProductName of the binary. Its weight sits between the threshold and a
  product-name match: a description alone leaves `Other`, but never outranks a
  named product. Two independent generic matches do.
- **Where the entry lives.** Start Menu groups and vendor folders (`\Игры\`,
  `\Development\`) score at path weight, the weakest evidence of the three.

`WindowsFeatures` is deliberately excluded from the vocabulary: it is recognised
by whole values only, so a third-party shortcut described as «Проводник» cannot
inherit it. Its one substring field is the install path, which carries the two
machine facts that need no product name: a component living under
`\Windows\System32`, `\SysWOW64`, `\Windows\Speech` or `\Windows\SystemApps\`, and
a Store package whose family starts `\WindowsApps\Microsoft.`. A Store package
from any other publisher is untouched by that rule.

Two kinds of reported metadata are treated as no evidence at all rather than as
weak evidence, because scoring them is worse than ignoring them:

- **Localized resource stubs.** Windows reports `MSPAINT.EXE.MUI` as the original
  file name, and dropping only the last extension leaves `mspaint.exe`, which
  matches no executable rule. The `.mui` suffix is removed before the stem is
  taken.
- **Packaging-toolkit metadata.** An InstallShield shortcut reports publisher
  `Acresso Software Inc.`, product and description `InstallShield`, and
  `_IsIcoRes.exe` as the binary — all describing the installer, not the product.
  Those values are blanked, so the product name in the shortcut's own title is
  what the rules read. The same applies to Inno Setup, NSIS and Nullsoft
  defaults.

One more install path carries a product without naming it. An MSI-advertised
shortcut reports the Windows Installer cache — `C:\Windows\Installer\{GUID}` —
instead of a program folder, so neither the name nor the path says what the
product is. Microsoft registers Office under a fixed product-code family, so
`\Installer\{90120000`, `{90140000`, `{90150000` and `{90160000` file the whole
suite at once: `Access 2016` and `Publisher 2016` carry no other evidence and
would otherwise stay unclassified for the same reason as their telemetry and
language companions.

Records that still match nothing are listed under Settings → Advanced with every
signal the classifier read, so a machine with unfamiliar software shows what the
tables are missing rather than a silent pile in `Other`. One action copies the
whole list — signals, source, artifact, visibility and the recorded reason — as
plain text, so an unfamiliar machine can be reported without retyping it.

That report is how the rules above were derived rather than guessed. A copied
list of 60 unrecognised records from an unfamiliar Windows install was replayed
through the classifier: 13 were reachable from machine facts alone (Windows
paths, Store package families, the `.mui` and packaging-metadata fixes), and the
remaining product names were added only where the record itself carried an
unambiguous signal — a vendor's own product family, a driver standard, a shared
install root. 48 of the 60 now classify and four more are recognised as
components; the rest stay in `Other` on purpose, because a rule that fitted them
would fit only that one machine. Every one of those records is a fixture in
`catalog_categories.json` or `catalog_visibility.json`, including guards that
must **not** match: a Store package from a non-Microsoft publisher is not a
Windows feature, and a product named after a maintenance verb is still a
product.

A second report, 29 records from an unrelated Windows install, was replayed the
same way. Five needed no product name of their own: three Microsoft Store
packages were already answered by their package family, Dev Home is filed by the
`devhome` executable behind its localized title, and the catalog recognised
itself by publisher. The other 24 fell into three shapes. A versioned vendor tree names a
family its executables never do — `1cestart`, `1cv8`, `1cv8c` and `1cv8s` say
nothing, while `\1cv8\` and the publisher spelled in both Cyrillic and Latin say
1C:Enterprise. A component names its own install root instead of itself:
`Unload kernel module` and `Peace` are only a verb and an author until the
`Cheat Engine` and `EqualizerAPO` trees they sit in answer for them. And a
localized name can drop every product word it had — `Кнопки сервисов Яндекса на
панели задач` leaves only `YandexPin.exe` to read, and it must not be read as
the browser whose folder it shares.

That last shape is why a shared install root scores below a vendor. A dongle
driver installer ships inside the 1C tree, so the tree would file it as business
software; its own publisher and executable outrank the path and keep it with the
maintenance tools. The reverse guard already existed for Windows features, and
this is the same rule seen from the other side: a path answers only for a record
that has nothing else to say.

A third report, 13 records from a clinic workstation, closed the loop from the
other direction. Five were inbox Store applications whose localized display name
shares no word with the package identifying them — `Портал смешанной
реальности`, `Советы`, `Средство 3D-просмотра`, `Paint 3D` and `Cortana`. Paint
3D ships as `Microsoft.MSPaint`, which the classic `microsoft.paint` needle does
not cover, and Cortana's family is the opaque `Microsoft.549981C3F5F10`, so its
product name is recognised as well. Naming each family explicitly rather than
through a blanket Microsoft prefix is what lets `Solitaire & Casual Games`, a
packaged game from that same publisher, stay a game.

The remaining records name a professional domain instead of a vendor. Clinical
software arrives with no publisher at all, so `поликлиника` and
`здравоохранение` are what identify it; a medical image viewer is read from the
DICOM standard it implements and from `Medixant`, never from a product name
unique to one machine. One record stays in `Other` deliberately:
`GreenAPP.Launcher` repeats a single invented name as publisher, product and
description, and its install root adds no domain word — it is a fixture that
asserts no category, so a later rule cannot claim it by accident.

A query that names a category also returns the applications filed under it,
after the entries matched by name. The catalog search and the scenario picker
share one implementation so both answer the same question the same way.

The golden catalog harness under `src-tauri/src/catalog/golden/` protects
identity, launch descriptor, category, visibility and dedup contracts with
fixtures and deterministic generated properties. Recording a new baseline is
deliberate:

```powershell
$env:KESVIO_GOLDEN_UPDATE = "1"; cargo test --manifest-path src-tauri/Cargo.toml golden
```

## 10. Desktop operations

### Launch and close

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

### Uninstall

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

### Windows integration and updates

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
  run on one background task afterwards. Cache reading in particular used to
  deserialize the whole catalog, icons included, before the first frame.
  Settings therefore reports the shortcut as unregistered for the moment before
  that task completes.
- When WebView2 is missing, the installer runs Tauri's embedded bootstrapper
  (`embedBootstrapper`). The bootstrapper downloads the runtime from Microsoft,
  so this installation step requires internet access. A machine with WebView2
  already installed can use the local catalog offline.
- The updater fetches the release manifest over HTTPS on startup. An available
  version is announced by a dismissible banner in the shell notice area beside
  the stale-copy and preference-write notices; it never opens a dialog by
  itself. The update dialog opens only from the banner's action, and download,
  verification, installation and restart remain modal from that point.
- The manifest contains a detached signature for the installer. The updater
  verifies the downloaded installer with the public key in `tauri.conf.json`
  before installation; the signature does not cover the manifest itself.
  The private key exists only in CI secrets.
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

## 13. Privacy and security

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

### What KesVio does to this machine

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

### Verifying a downloaded installer

Three independent checks, none of which requires trusting the author:

- `gh attestation verify KesVio_<version>_x64-setup.exe --repo keskiyo/KesVio`
  — GitHub's own record that this file was produced by `release.yml` in this
  repository, at a named commit. `release.yml` attests the assets after
  `verify-release-assets.ps1` has passed and before the release leaves draft.
- `Get-FileHash -Algorithm SHA256` against the published `SHA256SUMS.txt`, which
  the release workflow generates from the collected installer and
  `verify-release-assets.ps1` re-checks against that same file, so a stale or
  mismatched checksum fails the release rather than reaching the release page.
- The detached `.sig`, verified with `minisign` against the public key in
  `tauri.conf.json`. This is the same signature the in-app updater checks.

None of the three suppresses SmartScreen, which only an Authenticode certificate
does. They answer a different question: whether the bytes are the ones this
repository built.

## 14. Repository workflow

Follow existing seams; do not add dependencies, broad package updates, comments
in production source, path aliases, global utility folders, raw Tauri imports
outside the approved integration modules, or relaxed checks without explicit
approval. §3 above states which layer owns what, and the boundary scripts in
`scripts/` fail the `contracts` job when a change crosses one — those two are
the reference a clone actually carries.

New frontend behavior receives a lowest-level regression test. Frontend tests
use typed complete client fakes and query observable behavior. Rust unit tests
remain colocated where private crate contracts require them. Performance tests
assert bounded semantic work rather than wall-clock thresholds.

Development commands are defined by `package.json`:

```powershell
npm run dev
npm run tauri dev
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Formatting is owned by Prettier through `prettier.config.mjs` and `.prettierignore`.
`endOfLine` is `auto` because `core.autocrlf` is enabled on Windows checkouts while
the hosted runners are not; pinning it to `lf` would make `format:check` disagree
with itself across platforms. Generated files — `package-lock.json`, the golden
catalog baselines re-recorded by `serde_json`, `THIRD_PARTY_NOTICES.md`,
`.github/release-notes.md` and the SHA-pinned workflows — stay ignored so their
generators remain the only writers.

## 16. Verification and releases

For frontend production changes run lint, formatting check, typecheck, relevant
tests, the full suite for shared behavior, and production build. For backend
changes run format,
Clippy with warnings denied, and relevant/full Rust tests:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`CI Verify` (`verify.yml`) runs on pull requests and `master`:

- frontend: `npm ci`, lint, formatting check, typecheck, coverage test run and
  production build;
- backend: tests on `windows-latest` and `windows-2022`, plus format and Clippy;
- MSRV: compile at the `rust-version` declared in `src-tauri/Cargo.toml`;
- contracts: frontend/platform boundaries, release-script tests, dependency
  audit gates and the third-party license gate, including updater-signature
  fixtures, and the safety contract of the native smoke harness.

`scripts/run-native-smoke.ps1` is the native smoke run for a built executable
(`npm run tauri build` → `src-tauri/target/release/KesVio.exe`, or a
`cargo build --release --features tauri/custom-protocol` binary; a plain
`cargo build` binary is a dev-mode build that expects the Vite dev server). It
copies the executable into `%TEMP%\kesvio-smoke\<stamp>\App`, pre-creates
`KesVioData\data` and `KesVioData\logs` beside it so the portable data root is
adopted and nothing under the user's profile is written, seeds an empty
catalog so the interface requests the ordinary startup scan, points the scan
settings at a fixture folder of copied System32 executables, and then proves
state from the log and the cache: the data folder beside the executable, the
tray icon, the volume watcher, a published generation with fixture records and
a `portable` snapshot, a visible `KesVio` window that `WM_CLOSE` hides while
the process lives, a second launch that exits and is forwarded to the first
(`Second instance forwarded to this process`), a warm restart that reuses the
cache (`previous generation=N`) with a stable scan, and unchanged per-user
and installed stores (the WebView2 profile under `EBWebView` excepted).
Evidence is written to `.1localDocuments/native-smoke-<stamp>.json`. It stops
only the process it started, after checking its path lies in the workspace,
and deletes only that workspace; `scripts/test-run-native-smoke.ps1` holds it
to that. The installer, the signed update and tray clicks remain manual
(`docs/superpowers/native-smoke.md`).

`scripts/measure-performance.ps1` is the performance baseline protocol: it
records the commit, machine, OS, WebView2, node and rustc versions, runs the
ignored `catalog::golden::timings::stage_timings` (p50/p95 over 11 samples of
the cached-startup pipeline stages on the pinned 2000-record corpus, printed
as one `KESVIO_PERF` JSON line, release profile by default) and
`vitest bench --run tests/perf` (search ranking on a seeded 2000-record
catalog), and writes `.1localDocuments/perf/perf-<stamp>.json`. Bench files
under `tests/perf/` are never part of `npm test` and assert no threshold; a
regression is judged by comparing artifacts of the same profile and machine.
The log line `Frontend ready: N ms after the window was prepared` is the
clock for the native cached-startup measurement
(`docs/superpowers/performance-budgets.md`).

`THIRD_PARTY_LICENSES.txt` is the license text that ships with the installer,
distinct from `THIRD_PARTY_NOTICES.md`, which is the human-readable inventory.
It is generated by `scripts/generate-third-party-licenses.ps1` from
`npm ls --omit=dev --all` and from `cargo tree -e normal,build --target
x86_64-pc-windows-msvc`, takes each package's text from what upstream actually
ships, falls back to `scripts/license-texts/` for the fourteen packages that ship
none, and fails rather than emitting a package with no license at all. Identical
texts are printed once and referenced by id. MPL-2.0 dependencies get a source
availability section naming the repository each one is obtained from, which is
what section 3.2 requires of a distributor of executables.
`scripts/verify-third-party-licenses.ps1` regenerates the file and fails on
drift, so a lockfile change cannot leave the bundled texts describing the
previous dependency graph. `bundle.resources` in `tauri.conf.json` maps the file
into the installed directory.

The signed updater-signature fixtures under `src-tauri/tests/fixtures/` are
byte streams, not text. `.gitattributes` marks that directory `binary` so a
checkout with `core.autocrlf` enabled cannot rewrite line endings and invalidate
the detached signature; `test-verify-updater-signature.ps1` also compares each
fixture against its size in the index and names that failure explicitly.

Node.js `22.22.2` and Rust `1.96.0` are pinned in `.node-version` and
`rust-toolchain.toml`. Cargo verification uses `--locked`; the separate MSRV
job builds with Rust `1.88.0`.

Release preparation also provides `scripts/run-release-soak.ps1`.
It binds to one exact application PID and executable path, records operator-confirmed
Refresh/Cancel outcomes, samples memory during the idle/watcher window, and writes
local evidence under `.1localDocuments`. It never controls or terminates the target
process. This record is reference-machine evidence, not a replacement for CI or the
clean Windows acceptance matrix.

Runtime `npm audit --omit=dev --audit-level=high` admits no exceptions. High or
critical development-only advisories require dated entries in
`.github/npm-audit-exceptions.json`; stale or undocumented exceptions fail CI.

Release is tag-only: a `v*` tag on the exact `master` SHA triggers
`release.yml`. Version values must agree across npm/Cargo manifests, lockfiles
and `tauri.conf.json`. The release workflow reruns critical gates, builds and
signs the NSIS bundle, verifies its detached updater signature against the
configured public key, creates/verifies `latest.json`, then publishes the draft.
Published tags are immutable; corrections use a new patch version. The project
source is MIT-licensed; third-party notices are recorded in
`THIRD_PARTY_NOTICES.md`.

## 17. Troubleshooting

| Problem                        | First action                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog empty                  | Use **Scan for apps**; the first complete scan is explicit.                                                                                               |
| Duplicate or stale entries     | Refresh; then use **Settings → Advanced → Catalog maintenance → Reset catalog cache**.                                                                    |
| Missing application            | Run **Force full scan**, or add its folder under **Application discovery** when it lives outside a fixed drive.                                           |
| Old version or icon            | Refresh; clear the icon cache if needed. Visible icons are rebuilt without losing preferences.                                                            |
| Global shortcut fails          | Windows policy or another process can already own Win+Shift+Q; Settings reports the reason.                                                               |
| Uninstall unavailable          | Windows has no registered uninstaller for the entry, so there is nothing to open.                                                                         |
| Catalog stays on placeholders  | The event connection failed; use **Retry** in the notice. Refresh and launch keep working without it.                                                     |
| A panel closes by itself       | That dialog failed to render; the failure is in the application log and the catalog is unaffected.                                                        |
| Search finds nothing here      | Check the counts under the results; a match may live in Tools, Hidden or Installers & docs.                                                               |
| Update/download failure        | Retry from the update dialog or use the linked GitHub release.                                                                                            |
| SmartScreen warning            | Expected for the unsigned NSIS installer; verify the release source and updater signature.                                                                |
| Window opens off-screen        | Geometry that no longer fits a connected monitor is discarded; delete `window-state.json` to reset.                                                       |
| A scan never finishes          | Open the newest `KesVioData\logs\kesvio-<start>-<pid>.log` beside the executable; `Scan stalled … in <stage>: <item>` names the item.                     |
| A stall must be traced further | Detailed scan steps are always logged; use **Settings → Advanced → Diagnostics log → Export log as XML** and read the `Scan step` lines around the stall. |
| Closing the window hides it    | That is the default; turn **Keep running in the tray** off in Settings to quit on close instead.                                                          |
| Scrolling or dragging stutters | Turn off **Settings → Personalization → Colors → Transparency effects**; the blurred surfaces become opaque.                                              |

### Saved catalog filters

Preferences schema 21 adds `savedFilters`; existing documents upgrade with an empty
list and retain unknown data. Up to 20 named filters store
source, publisher, target availability and added-within criteria, never catalog
IDs or executable expressions. Fields combine with AND; values within a field
combine with OR. Empty criteria preserve the existing view scope. Search remains
an additional condition; hidden apps and artifacts follow the selected view.

A source is where a record was discovered, with one deliberate widening: the
`steam` source also matches a record whose derived `platformKind` is `steam`,
so the Steam client (a Start Menu shortcut) lands in the same filter as the
games of its library; the editor labels the choice `Steam (client and library
games)` and explains what a source is. Saved filters sit above the categories
in the navigation, so they stay reachable when the category list runs past the
fold.

The navigation opens saved filters; the header chip edits or clears the active
filter. Create, edit and delete are undoable. A failed storage write restores the
previous filter state; failed saves leave the editor open. The active selection
is session-only. Filters recompute from live catalog records without scanning.
Date filters use a one-minute clock only on an active catalog screen, with timer
cleanup on navigation and unmount. Unknown or future first-seen dates do not
match a date window. Unknown source and availability values from backups are
ignored by normalization.

### Effective classification and drive placement

App info distinguishes detected installers/documentation, user artifact placement,
user promotion and drive-root grouping. Missing visibility evidence is explicitly
reported as unavailable. Manual category overrides that change the detected
category expose `user=category` in the derived display reasons; raw catalog
records and persisted formats are unchanged. An override equal to the detected
category preserves the original record identity and detector reasons.

The `categorizedApps.ts` entity model owns effective category derivation;
`catalogSelectors.ts` owns visibility, counts and recent/search selections.
Drive-root grouping has priority over manual category and artifact marks.
The action menu explains this constraint and omits category moves for those
records. `moveApp` independently rejects those moves before creating a preference
transaction, covering drag/drop and other callers. Hide remains available.

### Scenario close policy

Preferences schema 22 adds optional scenario `forceClose`. New scenarios store
false. Older scenarios with no field retain their previous force-after-five-seconds
behavior; the editor visibly checks the force option and warns about unsaved work.
Malformed present values normalize to false. Explicit values survive import,
export and restart. Policy changes are undoable and restore the prior state when
storage fails. Editing is disabled while a scenario is running.

The runner maps `forceClose ?? true` to `close_apps`' optional `allowForce` boolean;
the client and backend default a missing IPC argument to false. Catalog-id
resolution, protected-target checks and batch limits are unchanged. Graceful mode
never reaches the termination stage or termination implementation; after the wait
it enumerates matching processes and reports closed, idle or failed targets.
Force mode retains the existing process identity checks and bounded termination
rechecks. Progress events retain their payload; waiting text applies to either
policy. There is no new cancellation API, results screen or execution preview.

Manual verification still required in an isolated Windows profile: accepting and
refusing WM_CLOSE, unsaved-document prompts, both policy settings, forced close,
protected target refusal and restart of migrated scenarios. Automated fixture
checks do not prove native application cooperation or cancellation support.

### Selective scenario import

The Scenarios page offers Import scenarios. The import-scenarios feature reads a
local JSON backup, limits it to 1 MiB and ignores stale reads after another file
or unmount. It uses the root store's existing preference parser; the store checks
UTF-8 size and version again before applying. No IPC or schema change is involved.
The initial selection is empty. Selected entries default to new copies with unique
IDs and case-insensitive name suffixes. Replacing an existing scenario requires
selecting that target explicitly and preserves its local ID/name and favorite
membership. Duplicate sources/targets, missing targets, capacity overflow and ID
allocation failure reject the entire selection.

Only imported scenario definitions are reconciled using the existing catalog
identity/alias/unique-name rules. Ambiguous names remain unresolved. Unrelated
preferences and favorite flags from the backup are never applied. Imported run
history is cleared, and the close policy is preserved and displayed in the picker.
One undoable preference transaction applies the result. A failed storage write
restores previous scenarios and undo state; the modal keeps its selection for
retry. Cancel does not import anything. Import never launches or closes apps.

Existing full-settings import remains a separate operation. File-picker behavior,
keyboard focus restoration and scaling still require native WebView verification;
automated tests cover selection, error states and asynchronous read ownership.

### Keyboard, screen reader and forced colors

The interface is English only and has no i18n layer. Copy that the tray shows
and the documentation names is pinned by a test (`the_tray_copy_is_pinned`:
`Open KesVio`, `Search`, `Favorite apps`, `Show all favorites…`, `Scenarios`,
`Force scan`, `Scanning…`, `Quit`); the frontend equivalents (`Refresh catalog`,
`Force full scan`, `Scan for apps`, `Quick launch`, `New
filter`, `Last change` / `Undo`, `Preview redacted log`, `Export log as XML`)
are pinned by the tests of the screens that render them.

Modal layering: every dialog, the navigation drawer included, is
`role="dialog" aria-modal="true"` and runs through `useModalDialog` (initial
focus, focus trap, Escape, focus restoration, scroll lock). Only the **topmost**
modal — the last `aria-modal` element in document order, which is the last one
opened because dialogs portal to `body` — traps Tab or answers Escape
(`shared/lib/modalLayering.ts`), so a filter editor opened over the drawer keeps
Shift+Tab inside itself and one Escape closes only the editor, returning focus
to the drawer's **New filter** button. In the sidebar, **Enter** opens a
category and **Space** picks it up for keyboard reordering (arrow keys move,
Space or Enter drops, Escape cancels); dnd-kit's default, where Enter also
picked the row up, left keyboard users unable to open a category. Decorative
lucide icons carry `aria-hidden="true"`; a source-tree test refuses an icon
rendered without `aria-hidden`, `aria-label` or a role. The redacted
diagnostics preview is a named, focusable `region` so it can be scrolled from
the keyboard and announced by name.

Forced colors (Windows High Contrast): focus rings are outlines, which the
platform repaints in its own colours; text inputs that set `outline-none`
receive an explicit `Highlight` outline under `forced-colors: active`, and the
toggle switch draws its track border and knob in `ButtonText`/`Highlight` so
its state remains visible without colour. Reduced motion is honoured through
`motion.css`. None of this is a WCAG conformance claim: unit tests prove roles,
names, focus order and keyboard paths in jsdom; Narrator, forced colours,
100/150/200 % scaling, the minimum window and long names are checked by hand
following the matrix in `docs/superpowers/english-copy-and-accessibility.md`.
