# Architecture

**Owns:** Runtime shape, frontend layers, backend boundaries, composition roots, and source ownership.

**Read this when changing:**

- layer responsibilities or imports;
- application composition and root state;
- backend module ownership;
- source-directory boundaries.

**Main code:**

- `src/app/`, `src/pages/`, `src/widgets/`, `src/features/`, `src/entities/`, `src/shared/`
- `src-tauri/src/`
- `scripts/verify-frontend-boundaries.ps1`

**Main tests:**

- `scripts/test-frontend-import-graph.mjs`
- `tests/frontend/`
- backend unit tests beside their owners

**Related:**

- [IPC and data](ipc-and-data.md)
- [Development and releases](development.md)
- [Security model](security.md)

## Product scope and environment

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

## Architecture and ownership

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

Frontend slices and what each owns:

| Slice                        | Owns                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/model`                  | One hook per concern: bootstrap and re-hydration, dialogs, global shortcuts, search access, scenario/tray integration, navigation props, brand identity (version and update pill), update-failure notice, activity status, derivations                                                                                                                                                       |
| `app/layout`                 | Title bar, activity bar, banners, the four view branches (`AppViews`), dialogs host, toaster                                                                                                                                                                                                                                                                                                 |
| `app/store`                  | `appStore.ts` assembly; `actions/*` per owner; `catalogGeneration.ts` (generation order, held records, diagnostics); `reconciliation.ts` (marks, first-seen); `driveCategories.ts`; `identityRekey.ts`; `transaction.ts`/`undo.ts`; `preferences/*`                                                                                                                                          |
| `pages/*`                    | Catalog, Settings (`ui/sections`, page-local `ui/components`), Scenarios, More, Catalog Health (`catalog-health`: source health, last scan, diagnostics log), Backup & Restore (`backup-restore`: preferences export, import and local recovery)                                                                                                                                             |
| `widgets/app-header`         | Header, search field, scan button, active-filter chip                                                                                                                                                                                                                                                                                                                                        |
| `widgets/catalog-content`    | Grids and rows (`AppRow` shared by Auxiliary tools, Hidden and Installers & Docs), `useCatalogView`, More previews                                                                                                                                                                                                                                                                           |
| `widgets/sidebar-navigation` | Sidebar, drawer, saved-filter list, category reordering                                                                                                                                                                                                                                                                                                                                      |
| `features/*`                 | `app-actions`, `command-palette`, `edit-settings`, `launch-app`, `manage-category`, `manage-filters`, `manage-scenarios` (editor, picker, run dialog with `launcherKeys.ts`, filters via `useScenarioFilters`), `run-scenario`, `stale-copy`, `update-app` (`useUpdateCheck`, `useUpdateInstall`, `updateResource`, `updatePreferences`, `updateTimeouts`, `UpdatePill`), `view-app-details` |
| `entities/*`                 | `app` (records, clients, search, selectors, `isCatalogView`, metadata and file-detail labels, `AppCard`), `category` (definitions, accents, `driveCategoryFor`), `scenario` (model, resolution, order, search, filters, tray entries), `system` (settings, `SystemClient`, tray)                                                                                                             |
| `shared`                     | `ui` primitives, DOM hooks, `lib` (clipboard, positioning, `dates`, `bytes`, `text`, search variants, modal layering), Tauri transport                                                                                                                                                                                                                                                       |

Store assembly stays in `src/app/store/`. Action factories live in `actions/`;
preference schema, normalization and storage live in `preferences/`, behind the
existing `preferences.ts` facade (`preferencesFields.ts` keeps `custom:*` and
`drive:*` category ids as user-defined). Component-only props stay with their
component.
The stylesheet entry `src/app/styles/index.css` imports tokens, navigation, base,
notifications, surfaces, theme, catalog and motion in cascade order. Theme rules
match whole class tokens rather than arbitrary substrings.

The frontend boundary checker builds a TypeScript-resolved import graph, including
type imports, re-exports and literal dynamic imports. It rejects forbidden layer
edges, private slice entry points and cycles. Its regression fixtures run with
`node --test scripts/test-frontend-import-graph.mjs`.

Updater orchestration lives in `features/update-app/model/useUpdater.ts`;
checking, installation, preferences and native-resource ownership have separate
modules, and `ui/UpdatePill.tsx` is its only surface. Concurrent checks share one
request. Replaced and late results close their native Update resource once; an
active download/install retains its handle until the operation settles. Unmount
prevents starting the next installation or relaunch step. Only the version
reaches the interface, and errors are sanitized before presentation.

Catalog record creation lives in `catalog/app_record.rs`, registry enrichment in
`registry_enrichment.rs`, source candidates in `sources/`, watcher roots in
`sync/watch_paths.rs`, and icon-source selection in `scan/hydration/sources.rs`.
The catalog root coordinates these owners without duplicating their rules.

Local launchers live in `scripts/run-dev.ps1` (development) and
`scripts/run-dev-hidden.vbs` (launch the newest existing local executable).
Both resolve the repository from their script location, independently of the
caller's working directory. Build and tool configuration stays at the root where
the corresponding tools expect it.

Shared owners centralize behavior that applies across several call sites:

| Owner                                                        | Owns                                                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/hooks/useModalDialog.ts`                         | Shared modal lifecycle primitive; [UI and workflows](ui-and-workflows.md#destructive-confirmations-and-focus) owns the interaction contract                                           |
| `src/pages/settings/ui/components/SettingsSectionHeader.tsx` | The icon tile, heading and description shared by every settings card; `src/shared/ui/PanelHeader.tsx` is its token-coloured twin for the Catalog Health and Backup & Restore surfaces |
| `src/shared/ui/buttonVariants.ts`                            | `ACTION_BUTTON` and its primary, quiet, neutral and danger variants plus `ACTION_ROW`; Settings, Catalog Health and Backup & Restore all derive their card actions from it            |

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

## Related documentation

- [IPC and data](ipc-and-data.md)
- [Catalog](catalog.md)
- [UI and workflows](ui-and-workflows.md)
- [Development and releases](development.md)
