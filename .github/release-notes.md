KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

KesVio 0.5.9 makes missing applications easier to investigate, keeps update notices visible in compact windows, and improves catalog navigation, application groups, and scan feedback.

## Added

- **Find missing app.** When a search has no matches, open Catalog Health or scan-folder settings and review the latest health or scan status and learn how exclusions and scan limits affect discovery.
- **Scan change details.** Open application information directly from added and updated entries in the latest scan changes when the entry is still available.

## Changed

- **Update notice in compact windows.** The update control appears in the title bar when the navigation drawer is closed; wider windows keep it in the sidebar. Download progress remains clear when the total size is unknown.
- **Search and navigation.** Empty search results offer matches in other catalog sections and allow clearing an active filter. The Enter target is displayed above the results, and keyboard launch skips disconnected applications when another match is available.
- **Application groups.** Mozilla publisher variants are grouped together, and portable Firefox is distinguished when names repeat.
- **Back to top.** The control has a clearer boundary and a subtle hover animation that respects reduced-motion settings.

## Fixed

- App info opens above an application group, with focus returned to the group when it closes.
- Previously cached icons can remain visible for applications on disconnected drives.
- Scan feedback and Catalog Health provide clearer information about unavailable sources, disconnected folders, and recent changes.
- Scenario results report configured applications that could not be resolved for launching or closing.
- Catalog and Settings navigation, focus restoration, and narrow-window layouts receive reliability improvements.

## Maintenance

- Updated the locked Rust dependencies cookie, url, and form_urlencoded and refreshed bundled license records.

## Install

1. Download `KesVio_0.5.9_x64-setup.exe` after this version is published.
2. Run the installer. It installs for the current user and allows another destination. It is not Authenticode-signed, so Windows SmartScreen may show a reputation warning.
3. If Microsoft Edge WebView2 is missing, its bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.8 is available through the update notice or **Settings → Check updates** after publication. Preferences and the saved catalog are preserved.

## Verification

Release assets include `SHA256SUMS.txt`, the updater signature, provenance attestation, and `KesVio_0.5.9_sbom.cdx.json`. Compare the installer hash with `Get-FileHash KesVio_0.5.9_x64-setup.exe -Algorithm SHA256`. Verify provenance with `gh attestation verify KesVio_0.5.9_x64-setup.exe --repo keskiyo/KesVio`.