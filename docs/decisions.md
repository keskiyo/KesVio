# Technical decisions

**Owns:** Historical rationale and rejected approaches that explain current non-obvious technical and product constraints.

**Read this when changing:**

- a behavior that looks unnecessarily restrictive;
- a withdrawn UI or workflow;
- search-alias trust, offline operation, or ranking policy;
- native trust boundaries, uninstall, or startup registration.

**Main code:**

- no single owner; each decision links to its current domain reference

**Main tests:**

- the domain tests named by the linked reference

**Related:**

- [Architecture](architecture.md)
- [Search aliases](search-aliases.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)

Domain documents describe current behavior. This document retains only history that explains why a current rule exists; it is not a changelog.

## Search aliases are built in, not user-editable

**Context:** Preferences schema 20 once exposed a `searchAliases` map and a Search aliases settings action.

**Decision:** The editable surface was withdrawn on 15 September 2026. Aliases are built-in search metadata assembled from curated rules, safe record-derived values, and an offline package corpus.

**Reason:** A local override could bypass the identity and collision rules that keep an alias attached to the correct product. One governed implementation is testable across every search surface.

**Current consequence:** Older preference documents preserve the unknown field but the runtime ignores it. Current behavior is owned by [Search aliases](search-aliases.md).

## The alias corpus is offline

**Context:** Broad product coverage benefits from upstream package metadata, but runtime enrichment would disclose queries or the installed catalog and make search depend on a network service.

**Decision:** A pinned `microsoft/winget-pkgs` snapshot is parsed during development and compiled into the application. The runtime performs no alias-network request.

**Reason:** Search remains local-first, deterministic, reviewable, and available offline. Untrusted manifests are handled by bounded build tooling rather than the desktop process.

**Current consequence:** Corpus updates are deliberate generated diffs with audit, provenance, quarantine, size, accuracy, and performance gates. See [Alias sources](search-aliases.md#alias-sources).

## Search prefers precision over coverage

**Context:** Short, generic, vendor, category, host, and helper terms can make unrelated applications appear correct on one machine while producing false positives elsewhere.

**Decision:** Curated identity outranks external and generated metadata; strong aliases require strong evidence; helpers are vetoed; external name-only identity is weak; scoring changes require a reproduced realistic failure.

**Reason:** A missed nickname can be diagnosed and added safely. A confident false match teaches the user that search cannot be trusted.

**Current consequence:** Real reports enter the search-gap corpus before implementation changes. See [Search gap triage](search-aliases.md#search-gap-triage).

## Catalog IDs are resolved natively

**Context:** Catalog records contain executable paths, arguments, shortcuts, registry-derived data, and URIs. The webview is not a trusted command source.

**Decision:** IPC accepts catalog IDs and bounded intent data. Rust resolves native targets from `AppState`; display paths never return as action inputs.

**Reason:** A compromised or malformed webview payload cannot turn an arbitrary path or command into native execution.

**Current consequence:** IPC changes synchronize both typed clients, Rust transport, the recorded wire fixture, fakes, safe errors, and tests. See [IPC and data](ipc-and-data.md) and [Security model](security.md).

## Uninstall remains a Windows handoff

**Context:** Starting registered uninstall commands would add the highest-consequence catalog action, require trusting registry command strings, and make KesVio responsible for removal state.

**Decision:** KesVio never removes software and starts no uninstaller. `canUninstall` remains discovery evidence; the UI opens Windows Apps settings.

**Reason:** Windows already owns removal and its confirmations. Removing the process-spawn capability also reduces the static and behavioral risk profile of an unsigned binary.

**Current consequence:** There is no arbitrary child-process helper or removal history. See [Uninstall handoff](desktop-operations.md#uninstall-handoff).

## Startup registration belongs to the installer

**Context:** A running unsigned application creating its own persistence through the Run key was flagged by proactive antivirus defenses.

**Decision:** The installer creates one Startup shortcut and registers it disabled. The running application may only flip the corresponding Windows `StartupApproved` value.

**Reason:** Installation is the expected time to declare startup integration, and Windows remains the visible owner of the switch.

**Current consequence:** The program cannot create, move, repair, or delete its startup shortcut. Boundary scripts enforce the restriction. See [Windows integration and updates](desktop-operations.md#windows-integration-and-updates).

## Background catalog changes are quiet

**Context:** A per-scan change section and a toast after every watcher or startup delta were implemented. Routine background scans made the notification area noisy without requiring a user decision.

**Decision:** The change section and background-change toast were withdrawn on 15 September 2026. Manual refresh still reports once; Catalog Health retains diagnostic counts.

**Reason:** Background synchronization should update the catalog without competing for attention.

**Current consequence:** `catalog://delta` updates the grid silently. See [Catalog](catalog.md) and [Catalog Health and Settings](ui-and-workflows.md#catalog-health-and-settings).

## Undo has one entry point

**Context:** Per-change toasts with an Undo action and a Last change card were tried for preference transactions.

**Decision:** Both were removed on 16 September 2026 because editing scenario membership produced a toast for every click. Keyboard Undo remains the single surface.

**Reason:** The transaction model is useful; repeated notification chrome was not.

**Current consequence:** The last eligible transaction is reversed with `Ctrl+Z` outside text fields. The persisted-data contract remains in [IPC and data](ipc-and-data.md).

## An update installs from one pill

**Context:** An available version was announced by a dismissible banner above the catalog, and its action opened a modal with release highlights, package size and an **Update & restart** button. The logo and the version were also repeated in the Settings header.

**Decision:** The banner, the dialog, the dismiss and the logo and version in the Settings header were withdrawn on 23 September 2026. The version lives under the KesVio name in the sidebar and the drawer, and an available update replaces it with a pill that installs on one click and shows the progress in place.

**Reason:** Two surfaces and a confirmation step said the same thing three times; the pill is always visible where the version already is.

**Current consequence:** Release notes are read on the GitHub release page, reachable from the failure toast. On a narrow window the pill is inside the drawer. See [Windows integration and updates](desktop-operations.md#windows-integration-and-updates).

## Artifact placement expands in place

**Context:** Choosing Installers or Documentation once opened a third floating panel beside the category menu.

**Decision:** On 18 September 2026 the floating panel was replaced by an indented two-item branch inside the existing menu.

**Reason:** At narrow widths the extra panel was clamped over the category list and hid valid choices.

**Current consequence:** Keyboard navigation walks both branch items in document order. See [Artifact placement](ui-and-workflows.md#artifact-placement).

## More views share one catalog-row language

**Context:** Hidden applications temporarily used a dedicated list with a visible Restore button, unlike Auxiliary tools and Installers & Docs.

**Decision:** On 18 September 2026 it returned to the shared `AppRow` grid and a constrained action menu.

**Reason:** The three catalog utility views represent the same kind of record and should scan and respond consistently.

**Current consequence:** Hidden rows offer App info and Restore to catalog; destructive or inapplicable actions stay absent. See [More and catalog utility pages](ui-and-workflows.md#more-and-catalog-utility-pages).

## Scenario import is part of full backup recovery

**Context:** A selective Import scenarios picker was built for the Scenarios page.

**Decision:** It was withdrawn before release on 16 September 2026.

**Reason:** The supported portability contract is the full preferences backup, which validates one versioned document and restores related state together.

**Current consequence:** Scenarios travel through **More → Backup & Restore** only. See [Scenario import](ui-and-workflows.md#scenario-import).

## Classification generalizes before adding product tables

**Context:** Reports from several unrelated Windows installations exposed records with localized names, missing publishers, packaging-toolkit metadata, vendor folders, and opaque Store identities.

**Decision:** Machine associations, executable metadata normalization, vocabulary, path evidence, and precedence rules were added before narrowly naming products. Product-specific entries remain only where the available identity is genuinely opaque.

**Reason:** A rule derived from a stable signal helps unfamiliar machines; a table copied from one machine only memorizes its catalog.

**Current consequence:** Unknown-software reports become positive and negative golden fixtures, and ambiguous records deliberately remain in Other. See [Classification](classification.md).

## Related documentation

- [Architecture](architecture.md)
- [Search aliases](search-aliases.md)
- [Security model](security.md)
- [UI and workflows](ui-and-workflows.md)
