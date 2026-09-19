KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release teaches search the names of about 7 800 more applications without touching the network, makes it harder for one program to answer to another program's name, tidies **Backup & Restore**, **Catalog Health** and the saved-filter list, and asks before a scan folder is removed.

## Added

- **Search knows far more short names.** Beside the built-in dictionary of about 200 well-known applications, the catalog now carries a compiled index of aliases taken from the public [winget-pkgs](https://github.com/microsoft/winget-pkgs) manifests (MIT): monikers, command names and alternate product names for about 7 800 packages. Type `kubectl`, `nvim`, `protonvpn`, `chrome-beta`, `firefox-esr`, `windowsupdateblocker`, `hddllftool` or `windows sdk` and the matching program answers even when its display name says something else. The index is part of the installer; KesVio never downloads it, never sends a query anywhere, and a program earns an alias only when its executable, publisher or package family agrees with the package — a name alone counts as a hint, not proof.
- **Results catch up on their own.** The alias index is loaded a moment after the window appears; a search typed before it arrives updates itself once it is there, in the catalog, in **Ctrl+K** and in the scenario app picker alike. If the index cannot be loaded, search simply works as before.
- **Removing a scan folder asks first.** Under **Settings → Catalog → Application discovery** the remove button opens a confirmation that shows the folder path before anything changes.

## Changed

- **Backup & Restore has two cards.** **Create backup** saves a JSON backup, and **Recover settings** gathers **Import a backup file** and **Restore the local recovery copy**; the local option is disabled when no valid recovery copy exists, and a confirmation keeps keyboard focus where you were when it closes.
- **Catalog Health is calmer.** The verdict card shows three plain numbers; the duration and the change counts live in the **Last scan** panel, and the sources table stays inside the window at the minimum width.
- **Saved filters fold.** The navigation shows the first six saved filters with **Show all … saved filters** to expand the rest, and each row keeps its delete button.
- **More stays highlighted** in the navigation while Auxiliary tools, Scenarios, Hidden, Installers & Docs, Catalog Health or Backup & Restore is open.

## Fixed

- **A hosted program no longer borrows its host's name.** A launcher that runs through `javaw.exe`, `pythonw.exe` or an Electron shell used to answer to `java`, `python` or `electron`; it now answers only to its own name.
- **Publisher names with a domain suffix** (`Sordum.org` in the manifest, `Sordum` in the file) are recognised as the same publisher, so programs like Wub get their aliases.
- **Generated abbreviations never spell a command word.** A three-word product no longer turns into `scp` or `cmd`, and a name that carries a URL produces no abbreviation at all.

## Install

1. Download `KesVio_0.5.3_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.2 through **Settings → Check updates** keeps every preference and the catalog cache; nothing is migrated, the alias index is a new file inside the application.

## Verification

The installer is not Authenticode-signed, so two things are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.3_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.3_x64-setup.exe --repo keskiyo/KesVio`.