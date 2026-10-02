KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release reopens KesVio where you left it, makes Favorites compact, gives Hidden, Auxiliary tools and Installers & Docs a one-click main action, tells you which installers are already outdated, and tightens accessibility, data safety and the release itself.

## Added

- **KesVio reopens where you left it.** The window opens on the view that was open when you closed it — Favorites, Scenarios, Settings or any other — instead of always on All Apps.
- **One-click actions on the utility pages.** Hidden and Auxiliary tools show **Restore** on every row, and Installers & Docs shows **Folder**; the ⋮ menu no longer repeats them. **Restore all** on Hidden asks for confirmation, lists the apps it will bring back, and can be undone in one step with **Ctrl+Z**.
- **Outdated installers stand out.** An installer older than the version of the same program you already have installed says **Installed X is newer**, so it is safe to delete.
- **Why a tool is auxiliary.** Every row in Auxiliary tools names its reason (for example *Runtime directory* or *Maintenance executable*), and chips — a single list on a narrow window — narrow the page to one reason.
- **Versions fold together.** Several versions or copies of one program (same name and publisher) show as one row with the newest in front and a **+N** toggle that opens the others smoothly.

## Changed

- **Favorites is compact.** The title counts applications and scenarios in one line, starred scenarios are small cards two to a row even on the smallest window, and expanding one shows its apps as compact icons.
- **Installers show their folder.** Installers & Docs names the folder an installer sits in instead of printing the whole path; the full path is in the tooltip.
- **Wider lists on large screens.** Hidden, Auxiliary tools and Installers & Docs line their title up with the list and fill the window with as many columns as fit.
- **Keyboard focus stays in place.** Hiding, restoring or moving an app back keeps focus on the neighbouring row instead of dropping it to the top of the window.
- **Shortcuts wait for open dialogs.** While a dialog is open, **Ctrl+F**, **/** and **Ctrl+Z** do nothing, and **Ctrl+K** / **Ctrl+Shift+K** only close their own launcher, so Undo never reverts a change hidden behind a confirmation.
- **Quieter scan log.** A routine scan no longer writes one line per file of the installer cache; the diagnostics log keeps the first steps of each stage and at most one line a second after that.

## Fixed

- **A removable drive no longer refills Recently added.** Plugging a USB stick back in used to list every program on it as new; programs on a drive that is away keep their first-seen date. Your preferences upgrade automatically.
- **App icons in the scenario picker.** Adding apps to a scenario right after KesVio opened on Scenarios showed placeholder icons; they now load.
- **Safer catalog cache writes.** A damaged cache file never replaces the good backup copy it was recovered from.
- **Uninstalling removes the logs.** The uninstaller always deletes KesVio's diagnostics logs, including the per-user fallback folder.

## Security

- The window can call only the individual system permissions it uses, scan settings and close requests have upper bounds, and every release now publishes a CycloneDX software bill of materials (`KesVio_0.5.5_sbom.cdx.json`) beside the installer.

## Install

1. Download `KesVio_0.5.5_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.4 takes one click on **Update 0.5.5 available** under the KesVio name, or **Settings → Check updates**. Every preference and the catalog cache are kept; the preferences document upgrades in place.

## Verification

The installer is not Authenticode-signed, so these are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.5_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.5_x64-setup.exe --repo keskiyo/KesVio`.
- `KesVio_0.5.5_sbom.cdx.json` — the inventory of every third-party component in the installer.