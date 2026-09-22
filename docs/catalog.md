# Catalog

**Owns:** Application discovery, source synchronization, scan coordination, retries, watchers, volumes, generations, cache use, hydration, and deduplication.

**Read this when changing:**

- catalog sources or scan modes;
- watcher, retry, cancellation, or bounded work;
- generations, deltas, hydration, or cache use;
- removable drives, install roots, or deduplication.

**Main code:**

- `src-tauri/src/catalog/`
- `src-tauri/src/app_state/`
- `src/app/store/actions/catalogSyncActions.ts`
- `src/app/store/catalogGeneration.ts`

**Main tests:**

- backend catalog and golden tests under `src-tauri/src/catalog/`
- `tests/frontend/app/store/`
- `tests/frontend/entities/app/catalogSelectors.test.ts`

**Related:**

- [IPC and data](ipc-and-data.md)
- [Classification](classification.md)
- [Search](search.md)
- [Troubleshooting](troubleshooting.md)

## Sources and scan modes

Sources are Start Menu shortcuts, uninstall registry entries, Start Apps and packaged applications, Steam libraries, explicitly configured portable folders, optional fixed-drive discovery, and watcher-triggered refreshes. Each source reports health independently; failed or stale sources retain their last valid snapshot where safe.

`SourceHealth` distinguishes **Up to date**, **Unavailable**, **Incomplete**, **Failed**, **Not scanned**, and **Scanning…**. A successful empty result is up to date, not unavailable. The store keeps the newest diagnostics by `completedAt`, so a late result cannot replace a newer recovery. Manual refresh uses the ordinary coordinator path; scoped retries are reserved for the retry scheduler.

Background deltas update the catalog silently. Manual refresh reports its own result, while Catalog Health owns the durable source and last-scan account presented by the interface. The page layout is documented in [UI and workflows](ui-and-workflows.md#catalog-health-and-settings).

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

## Recovery after a transient failure

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

## Removable volumes

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

## Install roots and portable products

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
helpers with the product name **Git**, and CrystalDiskInfo ships a 32-bit, a 64-bit
and an ARM build of one program. `catalog/product_duplicates.rs` groups the portable executables that share
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

## Cache and hydration

Startup is cache-first. Catalog persistence owns the source-aware generation document and keeps its previous known-good copy; the detailed format, migration, backup, and overwrite rules live in [IPC and data](ipc-and-data.md#persisted-stores). Runtime catalog code owns when a cache is reused, when the directory index may be reused, and when records or icons must be hydrated again.

Hydration is lazy, generation-checked, trusted-ID-only, and batched. Visible views request priority work; background scans do not enqueue an unbounded whole-catalog hydration pass. Catalog reset, icon-cache clear, and preference reset remain separate operations.

## Related documentation

- [IPC and data](ipc-and-data.md)
- [Classification](classification.md)
- [Search](search.md)
- [Troubleshooting](troubleshooting.md)
