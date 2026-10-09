KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release adds configurable global shortcuts, richer app actions, launch-aware filters, drive-triggered scenario prompts, and a lighter Windows shell while keeping every privileged or automatic action under user control.

## Added

- **Choose the global shortcut.** Settings now lists all keyboard shortcuts and lets you replace or reset **Win+Shift+Q** with a supported Windows-wide combination. KesVio keeps the previous shortcut if Windows rejects the new one or it cannot be saved.
- **Useful actions on every app.** The app menu now offers **Run as administrator**, **Open folder**, and **Copy path** where they apply. Elevation always goes through the Windows consent prompt, and packaged apps show it only when Windows exposes the same command.
- **Measure an app folder on demand.** App info can calculate folder size and file count without blocking the interface. Large or unreadable trees return a clearly marked partial total.
- **Find apps you have not used.** Saved filters can match apps not launched through KesVio for 30, 90, 180, or 365 days. Successful ordinary and administrator launches are tracked locally; typed search ranking is unchanged.
- **Better empty quick launcher.** Favorites still come first, followed by apps weighted by launch frequency and recency, then recently added apps.
- **Offer scenarios when a drive connects.** A scenario can be linked to a tracked removable drive. Connecting it refreshes the catalog and shows a **Run** action; KesVio never starts the scenario automatically.

## Changed

- **Compact menus on small windows.** App and category menus use tighter type and spacing, stay inside the viewport as their contents change, and scroll the catalog only as far as needed to reveal the full panel.
- **Windows 11 Mica.** The main window uses the native dark Mica backdrop when supported and keeps an opaque fallback on Windows 10, refused effects, and reduced-transparency systems.
- **Lower background memory.** Hiding KesVio to the tray marks WebView2 invisible and requests its low-memory target; reopening restores normal rendering and memory priority.
- **Smaller startup bundle.** Settings, Scenarios, Catalog Health, and Backup & Restore load as secondary chunks and preload after the catalog is ready. CI now enforces the entry-chunk budget.
- **Cleaner catalog controls.** Category edit controls reveal on hover or keyboard focus, while touch layouts keep them visible.

## Fixed

- **Administrator launches count as use.** A successful **Run as administrator** now updates the same local launch history as an ordinary launch, so usage filters and launcher suggestions stay accurate.
- **Menus remain reachable near the bottom.** A menu is repositioned after asynchronous actions appear, preventing its lower items from being clipped.
- **Shortcut conflicts are recoverable.** Invalid or occupied bindings report a stable error without dropping the working shortcut.

## Security

- The webview sends only a bounded catalog id for elevation and folder measurement; the backend resolves every path and launch verb from trusted catalog state. Every Rust `unsafe` block, function, and implementation is now checked in CI for an adjacent `SAFETY` rationale.

## Install

1. Download `KesVio_0.5.6_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.5 takes one click on **Update 0.5.6 available** under the KesVio name, or **Settings → Check updates**. Preferences and the catalog cache are kept; the preferences document upgrades in place.

## Verification

The installer is not Authenticode-signed, so these are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.6_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.6_x64-setup.exe --repo keskiyo/KesVio`.
- `KesVio_0.5.6_sbom.cdx.json` — the inventory of every third-party component in the installer.
