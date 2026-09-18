KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release brings back **Launch when Windows starts** as a switch inside KesVio, makes an autostart launch quiet, follows portable apps on a USB stick when its drive letter changes, and adds saved catalog filters, undo, tray favorites and search, a gentler scenario close policy, and a redacted diagnostics export.

## Added

- **Launch when Windows starts is a switch again.** It lives under **Settings → Startup & window**, is off after a fresh install, and shows the same state as **Windows Settings → Apps → Startup** — flip it in either place and the other follows. KesVio changes only the on/off state of the startup entry the installer registered; it never creates a startup entry of its own. If that entry is missing, the switch is disabled and the row says to reinstall.
- **Quiet start at sign-in.** When Windows starts KesVio, it stays in the tray at below-normal priority and waits up to a minute before its first background scan, so it does not compete with everything else that is starting. Opening the window ends the quiet start immediately.
- **Removable drives.** Add a drive root such as `F:\` under **Settings → Catalog → Application discovery** and its applications land in one **Disk F** category. The category follows the stick, not the letter: the same drive mounted as `G:` keeps its category, its name and its favorites, and a stick that is out simply hides its category until it returns.
- **Search knows the short names.** Type `cmd`, `vscode`, `vs code`, `wt`, `obs`, `ssms`, `psql`, `tg` or `7z` and the catalog answers with Command Prompt, Visual Studio Code, Windows Terminal, OBS Studio and the rest: a built-in dictionary of about 180 well-known applications, games and Windows tools — in English and Russian (`командная строка`, `ворд`, `фотошоп`, `стим`, `вов`) — plus aliases derived from each record's own executable, product name and version-free name. Nothing to configure; a wrong keyboard layout (`сьв` for `cmd`) and transliteration keep working on top of the aliases.
- **Saved catalog filters.** Up to 20 named filters by source, publisher, availability and "added within" sit above the categories in the navigation; the header chip shows which one is active and lets you edit or clear it.
- **Undo the last change.** Hiding or restoring an app, moving it to a category, renaming a category and editing a scenario can be undone with **Ctrl+Z** while focus is outside a text field. The change itself raises no notification.
- **Tray: search and favorites.** The tray menu gains **Search**, the first five **Favorite apps** with **Show all favorites…**, and keeps **Scenarios** and **Force scan**.
- **Scenario close policy.** New scenarios close applications gracefully and leave a program that refuses open; the editor offers **force after five seconds** for scenarios that need it. Scenarios created earlier keep the behaviour they had.
- **Catalog Health and Backup & Restore under More.** More now holds six cards. **Catalog Health** opens with a plain verdict — everything looks good, needs attention, refreshing, or no scan data yet — and a **Refresh catalog** button, then lists each source (Installed programs, Start Menu, Start apps, Installer cache, Steam, Portable folders) as **Up to date**, **Unavailable**, **Incomplete**, **Failed** or **Not scanned**, shows the last scan in plain numbers with the technical counts behind **Technical details**, and keeps the diagnostics log preview and export. **Backup & Restore** gathers **Export settings**, **Import settings** and **Restore local backup** as three cards with the same confirmation before anything replaces your preferences. Settings no longer has a collapsed Advanced section: Application discovery and Catalog maintenance sit in an open **Catalog** block below the general settings.
- **Redacted diagnostics export.** **Export log as XML** replaces every path, URL, account and machine name and any credential-looking value with stable placeholders before the file is written; **Preview redacted log** shows exactly what would be exported.

## Changed

- **Background scans are quiet.** A watcher or startup scan updates the catalog in place without raising a notification; only a refresh you start reports back.
- **One card per portable product.** Helpers that carry the product's own name and version — the thirty tools Git for Windows ships as _Git_, or the 32-bit, 64-bit and ARM builds of one program — collapse into the one entry you would launch.
- **A scan that hits a temporary problem retries on its own.** A source that did not answer or a folder that could not be reached is retried after 5, 20 and 60 seconds, scoped to that source; nothing already in the catalog is dropped meanwhile.
- **Reinstalling keeps your startup choice.** Running a newer installer over an existing copy no longer resets **Launch when Windows starts**; only a real uninstall removes the entry.
- **Hidden looks like Auxiliary tools.** Hidden applications are the same cards as auxiliary tools — name, publisher and version, **Restore to catalog** in each card's menu — and an empty view says so instead of showing an empty grid. An installer's menu offers **Open folder** instead of an Uninstall that Windows could never perform for a file. Auxiliary tools, Hidden and Installers & Docs share calmer rows — neutral at rest, accented only under the pointer or keyboard — a one-line description under the title, and Installers & Docs names its second group **Documentation**.
- **Installers & Docs read like Auxiliary tools.** Installers and documentation are listed as rows with the full name, publisher, version and the file's own location instead of compact tiles, so two downloads of the same setup can be told apart before you run one.
- **Keyboard and screen readers.** In the sidebar **Enter** opens a category and **Space** picks it up for reordering; only the topmost dialog answers **Escape** or traps **Tab**; decorative icons are hidden from assistive technology, and focus and toggle states stay visible under Windows High Contrast.

## Fixed

- **Icons of programs found through the Windows registry stayed blank.** Their catalog ids contain `|`, and the icon request split on that character, so those entries were asked for in pieces the catalog did not recognise. They now load like every other card.
- **Catalog source details fit the minimum window width.** Catalog Health presents source health as compact labelled rows on narrow windows instead of clipping the last columns of the table.
- **Publisher filters stay stable while selecting values.** The search field and list no longer jump or gain a horizontal scrollbar as publishers are selected.
- A refresh that finished after a background scan had already moved the catalog on could roll the catalog back to older data; every result now carries its generation and an older one is ignored.

## Install

1. Download `KesVio_0.5.2_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.1 through **Settings → Check updates** keeps every preference: saved filters start empty, existing scenarios keep their close behaviour, and the catalog cache upgrades in place.

## Verification

The installer is not Authenticode-signed, so two things are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.2_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.2_x64-setup.exe --repo keskiyo/KesVio`.
