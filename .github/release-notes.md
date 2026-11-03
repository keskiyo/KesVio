KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

KesVio 0.5.8 makes large catalogs easier to browse with automatic application groups, offers to scan newly connected removable drives, and keeps saved portable catalogs available while a drive is disconnected. Settings, scrolling, scan progress, and diagnostics receive focused reliability fixes.

## Added

- **Application groups in All Apps.** Applications from the same publisher share a compact group card within their category. Open it to see the applications and their usual actions. Product names such as LibreOffice and Battle.net identify supported groups. Other catalog views keep their existing organization.
- **Removable-drive discovery.** Connecting an untracked removable drive offers to choose a folder for application scanning. The offer also appears for drives already connected when KesVio starts. Choosing **Not now** explains how to add the folder later in Settings.
- **Last-scan changes.** Catalog health shows applications added, removed, or updated by the latest scan.
- **Back to top.** A compact **Top** control appears in the catalog header after scrolling and returns smoothly to the beginning.

## Changed

- **Disconnected portable catalogs stay visible.** A saved drive category remains available for browsing while its drive is absent. One status beside the category identifies the disconnected drive; its applications cannot launch and it cannot receive moved applications until it returns.
- **Disconnected drives in navigation.** The sidebar and drawer mark disconnected drive categories with a muted accent and a status label. Their position can still be reordered, including with the keyboard.
- **Clearer settings and recent activity.** Settings navigation stays within its own scroll area, shortcut controls adapt to narrow windows, and related recent entries are collected together.
- **Calmer application groups.** Groups use compact icon previews and smooth opening and closing. Clicking outside a group closes it.

## Fixed

- Long scan-folder paths and drive labels stay within Settings panels and scenario cards at narrow window widths. Recently added entries use spacing instead of repeated horizontal dividers.

- Escape dismisses a card's menu before its application group, preserving the group and returning focus to the menu trigger.
- An open Settings page receives folder changes saved through removable-drive offers, preventing a later discovery change from overwriting the added folder.

- Category delete controls follow the Edit button's hover and keyboard-focus reveal, keeping category headers quieter without shifting their layout.

- Moving an application from a group no longer sends the catalog back to the top through focus restoration. Opening its action menu no longer scrolls the catalog behind the dialog.
- Group dialogs no longer briefly show a scrollbar caused by individual card entrance animations.
- Portable scans report visited folders during a long root scan instead of leaving progress unchanged at the initial root count. Diagnostics include portable-root work counters.
- Diagnostic log segments are collected in numeric sequence within each process.
- Window-state persistence, shutdown coordination, and catalog refresh handling have additional regression coverage.

## Maintenance

- Updated the previously selected frontend and Tauri dependencies, refreshed the Windows dependency license inventory, and retained the existing updater verification and security boundaries.
- Updated the README and technical guidance for application groups, removable-drive scanning, disconnected catalogs, diagnostics, and release verification.

## Install

1. Download `KesVio_0.5.8_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; another folder can be selected. The installer is not Authenticode-signed, so Windows SmartScreen may show a reputation warning.
3. If Microsoft Edge WebView2 is missing, its bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.7 is available through the update notice or **Settings → Check updates** once this release is published. Preferences and the saved catalog are preserved.

## Verification

Release assets include `SHA256SUMS.txt`, the updater signature, provenance attestation, and `KesVio_0.5.8_sbom.cdx.json`. Compare the installer hash with `Get-FileHash KesVio_0.5.8_x64-setup.exe -Algorithm SHA256`. Verify provenance with `gh attestation verify KesVio_0.5.8_x64-setup.exe --repo keskiyo/KesVio`.