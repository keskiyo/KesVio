# Troubleshooting

**Owns:** Task-oriented diagnosis routes and the first safe action for common failures.

**Read this when changing:**

- user-facing recovery guidance;
- diagnosis routes between catalog, classification, search, UI, and desktop behavior;
- first actions for common operational failures.

**Main code:**

- no single owner; follow the domain links below
- `src-tauri/src/diagnostics/`
- `src/pages/catalog-health/`

**Main tests:**

- domain tests linked from the relevant document
- diagnostics and error-state tests

**Related:**

- [Catalog](catalog.md)
- [Classification](classification.md)
- [Search](search.md)
- [UI and workflows](ui-and-workflows.md)
- [Desktop operations](desktop-operations.md)

## Quick reference

| Problem                        | First action                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog empty                  | Use **Scan for apps**; the first complete scan is explicit.                                                                                                 |
| Duplicate or stale entries     | Refresh; then use **Settings → Catalog → Reset catalog cache**.                                                                                             |
| Missing application            | Run **Force full scan**, or add its folder under **Application discovery** when it lives outside a fixed drive.                                             |
| Old version or icon            | Refresh; clear the icon cache if needed. Visible icons are rebuilt without losing preferences.                                                              |
| Global shortcut fails          | Windows policy or another process can already own Win+Shift+Q; Settings reports the reason.                                                                 |
| Uninstall unavailable          | Windows has no registered uninstaller for the entry, so there is nothing to open.                                                                           |
| Catalog stays on placeholders  | The event connection failed; use **Retry** in the notice. Refresh and launch keep working without it.                                                       |
| A panel closes by itself       | That dialog failed to render; the failure is in the application log and the catalog is unaffected.                                                          |
| Search finds nothing here      | Check the counts under the results; a match may live in Tools, Hidden or Installers & docs.                                                                 |
| Update/download failure        | Press **Retry update** under the KesVio name, or **Open release** in the error toast to download the installer.                                             |
| SmartScreen warning            | Expected for the unsigned NSIS installer; verify the release source and updater signature.                                                                  |
| Window opens off-screen        | Geometry that no longer fits a connected monitor is discarded; delete `window-state.json` to reset.                                                         |
| A scan never finishes          | Open the newest `KesVioData\logs\kesvio-<start>-<pid>.log` beside the executable; `Scan stalled … in <stage>: <item>` names the item.                       |
| A stall must be traced further | Detailed scan steps are always logged; use **More → Catalog Health → Diagnostics log → Export log as XML** and read the `Scan step` lines around the stall. |
| Closing the window hides it    | That is the default; turn **Keep running in the tray** off in Settings to quit on close instead.                                                            |
| Scrolling or dragging stutters | Turn off **Settings → Personalization → Colors → Transparency effects**; the blurred surfaces become opaque.                                                |

## Search result is wrong

Start with [Search](search.md) for query variants, scopes, and ranking. If the query depends on a product nickname, command, moniker, or package identity, follow [Search gap triage](search-aliases.md#search-gap-triage) and preserve the reported record as a regression fixture.

## Application is missing

Check the source and last scan under **More → Catalog Health**. Use [Catalog](catalog.md) for scan modes, retention, retries, exclusions, and removable volumes. If the record exists but is hidden, auxiliary, or an artifact, use [Classification](classification.md).

## Category or visibility is wrong

Use the Application information dialog to capture the source, effective placement, and classifier evidence. Compare it with [Classification](classification.md); product-specific fixes require positive and negative fixtures rather than a broad name rule.

## Saved filter behaves unexpectedly

Use [UI and workflows](ui-and-workflows.md#saved-catalog-filters) for selection and navigation behavior. Use [IPC and data](ipc-and-data.md#persisted-stores) for schema, normalization, import, recovery, and failed-write behavior. Filters never trigger a scan.

## Scenario close is blocked

Protected and unsafe targets are refused by design. Use [Desktop operations](desktop-operations.md#native-launch-and-close) for native close behavior and [UI and workflows](ui-and-workflows.md#scenario-close-policy) for the saved policy and interaction contract.

## Keyboard or accessibility issue

Use [UI and workflows](ui-and-workflows.md#keyboard-screen-reader-and-forced-colors). Automated tests cover roles, names, focus order, and keyboard paths; Narrator, Windows High Contrast, scaling, minimum-window layout, and long names still require manual verification.

## Update or installer verification issue

Use [Desktop operations](desktop-operations.md#windows-integration-and-updates) for runtime update behavior. Use [Development and releases](development.md#verifying-a-downloaded-installer) for checksum, signature, and provenance verification.

## Related documentation

- [Catalog](catalog.md)
- [Classification](classification.md)
- [Search](search.md)
- [UI and workflows](ui-and-workflows.md)
- [Desktop operations](desktop-operations.md)
