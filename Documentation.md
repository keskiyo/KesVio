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
project links, update release links, stale-copy handling, and bounded
interface-failure reporting. Commands return
`Result<T, AppError>`; errors expose stable `SCREAMING_SNAKE` codes and static
safe messages. Internal paths, commands, registry values and upstream errors
never reach the webview.

`open_startup_settings` opens the Windows Startup apps page without exposing a
shell or arbitrary URI to IPC. No IPC command creates, changes or removes
startup registration.

Scenario close actions accept catalog IDs only. The trusted catalog classifies
close targets; only `Safe` targets may be added or executed. Critical Windows
processes and session components are counted as blocked rather than terminated.

A close asks every matching window to shut down, waits five seconds, then ends
whatever stayed open; unsaved work in those processes is lost. The wait is
reported to the interface as coarse stages over `close://progress` — asking,
a per-second countdown, then terminating — so the pause reads as deliberate
rather than as a hang. A scenario run ends in a single summary notice counting
launches, failures, closures and refusals; nothing is discarded silently.

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
| Preferences   | `src/app/store/preferences.ts` | Versioned `localStorage` document (schema 18) for categories, marks, scenarios, first-seen data, catalog density and unknown fields. |
| Window state  | `lifecycle/window_state.rs`    | Versioned `window-state.json`; position, size, maximized flag and the close behaviour, written atomically.                           |

Window state is presentation-only and deliberately disposable: a missing,
malformed or newer-versioned document restores nothing, the window opens at the
configured 1250×720, centered, and closing hides to the tray. It is the one
store whose loss costs the user nothing, so it never falls back to a backup copy
and never blocks startup. Geometry is optional inside the document, because the
close setting has to survive a session in which the window was never moved.

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
(`%APPDATA%\dev.neiroslop.kesvio` and `%LOCALAPPDATA%\dev.neiroslop.kesvio\logs`)
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
back to `%LOCALAPPDATA%\dev.neiroslop.kesvio`, never to a folder named after the
product: the per-user installer occupies `%LOCALAPPDATA%\KesVio`, so a report
written there would land inside the install directory and survive the
non-recursive `RMDir "$INSTDIR"` that ends an uninstall.

Because that folder sits inside the install directory, uninstalling has to reach
it: Tauri's own uninstall section clears `%APPDATA%\dev.neiroslop.kesvio` and
`%LOCALAPPDATA%\dev.neiroslop.kesvio` when the user ticks **Delete app data**,
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
`%LOCALAPPDATA%\dev.neiroslop.kesvio\EBWebView` whenever a window declares no
`dataDirectory`; the configuration file accepts only a relative path resolved
under the same local-data root, so no configuration change can move it beside the
executable. Relocating it would mean building the main window in Rust instead of
from configuration and copying a live browser profile on first run. Preference
export and import remain the supported way to carry that store between machines.

The diagnostics log is a fourth store and is not user data. `diagnostics/` owns
it: `tauri-plugin-log` writes `kesvio.log` to the resolved log folder at
`Info`, rotates at four megabytes keeping eight dated archives, and
`prune_expired_logs` deletes any `*.log` older than six hours. Age is the file's
modification time measured against `SystemTime::now`, so it follows the Windows
system clock the machine is set to, and a file stamped in the future is never
treated as expired. Six hours is short on purpose: the log answers "what is this
scan doing right now", it is read while the problem is still happening, and a
scan that finished yesterday explains nothing about one that is stuck today. A
tray application left open accumulates archives faster than anyone reads them,
so the window is the useful one rather than the generous one. Pruning runs at
startup and again after every completed scan, because that application can stay
open for days and a startup-only sweep would keep far more than the window on
exactly the machines that need diagnosing.
The active file is held open by the plugin, so failing to delete it is expected
and ignored. `export_diagnostics_log` renders the whole directory as one XML
document — the newest twenty thousand lines, each parsed into a dated `entry`
element and anything else preserved as a `line` element — and writes it wherever
the save dialog points. Losing the whole directory costs nothing but the ability
to explain the last few scans.

The scan writes one line per run, two lines per source and one per portable root,
never per catalogued application. Root paths are recorded deliberately: a scan
that stops is diagnosed by knowing which location it was walking. Each source
logs `Source <key> starting` before it runs and its outcome the moment it
finishes, rather than every outcome after the whole scan: a source that never
returns must not hide the sources that already answered. Three lines split the
Windows sources further, because each has a cheap half and a half that touches
the filesystem — the registry entry count separates reading the hives from
resolving every entry's target, the start-menu roots separate the folders chosen
from the walk, and the apps-folder entry count separates the Shell enumeration
from the package lookup. A run that stops between two of these lines names the
call that blocked.

Those lines bound a stage, not a call, so `sync/scan_steps.rs` adds the item.
Every per-item loop records the step it is about to attempt into one slot whose
detail buffer is reused, which costs an uncontended lock and a copy rather than an
allocation. A watchdog thread, owned by `scan_all` and joined when it returns,
reads that slot once a second and logs one `warn` line when the same step has been
current for ten seconds, repeating at most every thirty. A healthy scan logs
nothing, and the line arrives while the application is still hung instead of after
it is killed. Stage budgets are checked between items, so a single blocking Win32
or COM call inside one item can outlast every deadline; this is what names it.
`--verbose-scan` on the command line additionally logs one `info` line per item,
for a diagnostic run only.

The watchdog is owned by `synchronize`, not by source scanning, so it also covers
assembly: merging sources, attaching registry metadata, checking that every target
still exists, sanitizing and deduplicating, demoting console applications,
attaching category reasons and close risk, and retaining cached details. Target
availability is the reason that matters — it stats every catalogued path, so a
target on an unreachable share blocks there rather than in a source. The
instrumented loops are the registry entries, the Start Menu walk, the
installer-cache walk, the AppsFolder items, the Steam libraries and every
directory the portable walk enters.

Preferences preserve unknown root fields, which is also how a field this version
stopped reading survives: scenario run history is no longer collected or parsed,
and the records an earlier version wrote are carried through the document
untouched rather than dropped. Invalid primary data falls back to a
one-step backup. A document written by a newer preference schema is never
overwritten. Import and local-backup restore reject unsupported/newer documents
and also refuse replacement when the installed app is older than the current
local schema. Export contains preference-backed data only: never the catalog
cache, executable paths, catalog icons, or scan folders. Each Scenario also
retains a bounded 32 KiB name/icon snapshot per app identity so unavailable
entries remain identifiable and removable; it is presentation data, never a
launch target.

Import applies preferences in memory before attempting to persist them. If the
write fails, `preferencesPersisted` becomes false and the shell displays the
unsaved-changes banner. The import action still returns success, so the settings
panel can show **Settings imported.** while those changes remain unsaved.

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

The document a load hands back carries no icons, because hydration owns them and
fills them in afterwards. The copy on disk keeps them. Sanitizing a loaded
document writes it back only when sanitizing actually changed something, so a
catalog that has settled is read and never rewritten; stripping the icons before
that comparison made every load look like a change and rewrote the whole file to
throw away the icons hydration had just persisted.

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

Normal startup is cache-first. Background validation and incremental scans keep
the UI usable while source work runs. Startup, watchers and ordinary refreshes
scan only explicitly configured portable folders. Fixed-drive discovery is on
by default and runs during **Force full scan**. An ordinary
refresh retains already discovered fixed-drive portable applications while the
option remains enabled, but drops their large directory index; disabling the
option removes those retained records on the next refresh. A force scan bypasses
the previous filesystem index and shares the same three-minute cooperative
traversal budget across portable roots that a refresh uses. Only cancellation
discards a portable run: a run stopped by
the time or entry bound still adopts what it found, because an incompletely
walked root keeps its previously known applications. Scan work is cancellable and generation-aware; no
stale result may overwrite a newer generation. The rule holds in both
directions, so a scan hands its records and the generation that produced them
back as one value: the interface adopts that generation with the records, and
hydration patches from the same generation cannot be mistaken for stale work.

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

| Stage          | Invariant                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Traversal      | Explicit folders on routine scans; fixed drives on forced scans; shared time, depth, entry and cancellation bounds; no reparse-point recursion. |
| Classification | Artifact, visibility and category decisions are deterministic and explainable.                                                                  |
| Deduplication  | Canonical identity and launch evidence prevent unrelated same-name applications from merging.                                                   |
| Install root   | A record keeps an install location only while that location contains its own launch target.                                                     |
| Cache          | Source-aware generation document; invalid data degrades safely.                                                                                 |
| Hydration      | Icons/details are lazy, size-limited, trusted-ID-only and processed in bounded batches.                                                         |
| Search         | Current view/category only; literal matches rank above corrected, transliterated and fuzzy matches.                                             |

A query token expands into variants before matching: the literal token, the
token remapped between the English and Russian keyboard layouts, and a
Cyrillic-to-Latin transliteration. Ranking keeps the literal variant above the
rest, so a transliterated hit never displaces an exact one. Transliteration is
letter-for-letter and does not resolve loanwords whose spelling diverges.

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

- Tray, global shortcut and window lifecycle are backend-owned.
- A fresh direct installation registers startup and leaves it **switched off**.
  Windows lists nothing it has no entry for, so the installer creates
  `$SMSTARTUP\KesVio.lnk` and, in the same guarded block, writes a
  `StartupApproved\StartupFolder` payload whose first byte is `0x03` — the value
  Explorer itself writes for a disabled entry. The result is a row under
  **Settings → Apps → Startup** that the user can switch on. The Settings page
  has no application-owned switch; **Manage** only opens that Windows page.
- Once the user flips that switch, Explorer owns the value. Both installer hooks
  are guarded on `$UpdateMode <> 1`, so an update neither recreates the shortcut
  nor resets the choice; only a normal uninstall removes the shortcut and its
  approval value.
- The running executable still has no startup-registration API of any kind.
  `scripts/verify-platform-boundaries.ps1` fails the build if `CurrentVersion\Run`,
  `FOLDERID_Startup`, `shell:startup` or `SMSTARTUP` appears anywhere in Rust.
  Registration is the installer's job precisely because a running unsigned binary
  writing its own persistence is what Kaspersky scored as
  `PDM:Trojan.Win32.Generic`.
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
  while the window moves and written once, when the window closes or the tray
  quits. The stored size is the inner size, because `set_size` restores an inner
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
  and restart are indeterminate stages. Update failures retain a safe retry UI.
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
  former **Launch when Windows starts** toggle wrote, and returned
  `PDM:Trojan.Win32.Generic` for an unsigned binary with no reputation. The Run
  value is gone and the executable has no startup-registration API at all;
  `scripts/verify-platform-boundaries.ps1` forbids Run values, Startup-folder
  APIs and shell indirection throughout the backend. The installer still creates
  a Startup shortcut, because that is ordinary installer behaviour and is what
  makes the entry appear in Windows' own Startup apps page — but it registers it
  disabled, so nothing runs at logon until the user says so. What was scored was
  a _running_ program writing its own persistence, not an installer declaring an
  entry the user controls.
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

| Capability                                                       | When it runs                                                        | Bound                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Read the uninstall registry hives, Start Menu, AppsFolder, Steam | Startup, refresh, watcher, Force full scan                          | Read-only. Stage budgets and cancellation bound every loop.                                                                        |
| Walk fixed drives for portable executables                       | **Force full scan only**, and only while the discovery toggle is on | `roots_for` retains fixed drives on refresh and walks them only on `SyncRequest::Force`.                                           |
| `ShellExecuteExW` / `ShellExecuteW`                              | Launching or opening a catalogued entry                             | Target resolved from a catalog id held in trusted state, never from the webview.                                                   |
| `CreateToolhelp32Snapshot`, `OpenProcess`, `TerminateProcess`    | The explicit close action of a scenario                             | `WM_CLOSE` first; terminate only on refusal; batch capped; protected processes and this process excluded.                          |
| Remove installed software                                        | Never                                                               | There is no such capability. No code path starts a removal; the card menu opens the Windows page instead.                          |
| Write one `HKCU` value (`Software\keskiyo\KesVio`)               | Startup, only when the install directory changed                    | Read before write; the running program writes nothing else in the registry, ever.                                                  |
| Register a disabled Startup entry                                | The installer, on a fresh install only                              | Shortcut plus a `StartupApproved` value marked disabled. Never on update; the running program cannot.                              |
| Write files                                                      | Catalog cache, scan settings, window state, logs                    | Only under the resolved data root. Atomic replace; identical values are not rewritten.                                             |
| Network                                                          | The update check, and a download the user starts                    | GitHub release endpoint only. Automatic checks are throttled to one per four hours, and back off to a day after repeated failures. |

There is no telemetry, no account and no background upload. The one persistence
entry is the Startup shortcut the installer registers **disabled**, which exists
so Windows can offer the choice; the running program can neither create it nor
change it, and **Manage** only opens the Windows page where the user decides.

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
  fixtures.

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

| Problem                        | First action                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Catalog empty                  | Use **Scan for apps**; the first complete scan is explicit.                                                     |
| Duplicate or stale entries     | Refresh; then use **Settings → Advanced → Catalog maintenance → Reset catalog cache**.                          |
| Missing application            | Run **Force full scan**, or add its folder under **Application discovery** when it lives outside a fixed drive. |
| Old version or icon            | Refresh; clear the icon cache if needed. Visible icons are rebuilt without losing preferences.                  |
| Global shortcut fails          | Windows policy or another process can already own Win+Shift+Q; Settings reports the reason.                     |
| Uninstall unavailable          | Windows has no registered uninstaller for the entry, so there is nothing to open.                               |
| Catalog stays on placeholders  | The event connection failed; use **Retry** in the notice. Refresh and launch keep working without it.           |
| A panel closes by itself       | That dialog failed to render; the failure is in the application log and the catalog is unaffected.              |
| Search finds nothing here      | Check the counts under the results; a match may live in Tools, Hidden or Installers & docs.                     |
| Update/download failure        | Retry from the update dialog or use the linked GitHub release.                                                  |
| SmartScreen warning            | Expected for the unsigned NSIS installer; verify the release source and updater signature.                      |
| Window opens off-screen        | Geometry that no longer fits a connected monitor is discarded; delete `window-state.json` to reset.             |
| A scan never finishes          | Open `KesVioData\logs\kesvio.log` beside the executable; `Scan stalled … in <stage>: <item>` names the item.    |
| A stall must be traced further | Start the application with `--verbose-scan`; every scanned item is logged until the run is over.                |
| Closing the window hides it    | That is the default; turn **Keep running in the tray** off in Settings to quit on close instead.                |
| Scrolling or dragging stutters | Turn off **Settings → Personalization → Colors → Transparency effects**; the blurred surfaces become opaque.    |
