# IPC and data

**Owns:** Native transport contracts, events, safe errors, persisted stores, backups, and migration compatibility.

**Read this when changing:**

- Tauri commands or events;
- request, response, or error payloads;
- preferences, catalog-cache, scan-setting, or window-state formats;
- backup, recovery, migration, and reconciliation behavior.

**Main code:**

- `src/entities/app/api/` and `src/entities/system/api/`
- `src-tauri/src/commands/` and `src-tauri/src/app_state/`
- `src/app/store/preferences/`
- `src-tauri/src/catalog/storage/`

**Main tests:**

- `tests/frontend/entities/ipcContract.test.ts`
- `src-tauri/tests/fixtures/ipc/contract.json`
- `tests/frontend/app/store/`
- backend storage and command tests

**Related:**

- [Architecture](architecture.md)
- [Catalog](catalog.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)

## IPC

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

## Error model

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

## Events

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

## Persisted stores

Three stores contain user data:

| Store         | Owner                          | Rules                                                                                                                                |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog cache | `catalog/storage/cache/`       | Versioned, atomic, cache-first, backup-aware; corrupt primary data falls back safely.                                                |
| Preferences   | `src/app/store/preferences.ts` | Versioned `localStorage` document (schema 22) for categories, marks, scenarios, first-seen data, catalog density and unknown fields. |
| Window state  | `lifecycle/window_state/`      | Versioned `window-state.json`; position, size, maximized flag and the close behaviour, written atomically.                           |

Window state is presentation-only and deliberately disposable: a missing,
malformed or newer-versioned document restores nothing, the window opens at the
configured 446×740, centered, and closing hides to the tray. It is the one
store whose loss costs the user nothing, so it never falls back to a backup copy
and never blocks startup. Geometry is optional inside the document, because the
close setting has to survive a session in which the window was never moved.

`firstSeenAt` maps a preference identity to the moment the catalog first
carried it, and **Recently added** reads nothing else, so a stamp is written
once and never rewritten. An identity that is absent from the catalog the
frontend currently holds keeps its stamp: the startup snapshot is cache-first
and the scan delta arrives after it, so treating that gap as a removal dropped
stamps and re-issued them at `Date.now()` when the delta brought the records
back — every start moved dozens of long-installed applications into Recently
added. Only a completed scan prunes the map, because its output is the catalog
rather than a moment in the middle of one, and that keeps the document bounded
by the catalog size.

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
interface offers it one way: **Ctrl+Z** undoes while focus is outside a text
field and only while something can be undone (a text field keeps its own undo),
and answers with one **Undone** notice. A transaction itself raises no notification.

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

## Compatibility and migrations

Persisted-format compatibility is cumulative. A changed format increments its owner version, upgrades every supported predecessor, defaults additive fields, preserves unknown data where required, rejects unsupported newer data without overwriting it, and keeps regression coverage for the old-to-new path.

Transport changes remain additive where practical and keep Rust, TypeScript, the recorded fixture, full-interface fakes, event teardown, and stale-generation behavior synchronized.

## Related documentation

- [Architecture](architecture.md)
- [Catalog](catalog.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)
