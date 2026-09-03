AppNook is a fast, private application catalog and launcher for Windows 10 and 11. It gathers Start Menu shortcuts, installed software, Store apps, Steam games, and portable executables into one searchable catalog.

## Windows Apps is now AppNook

The project has been renamed. The application, the installer, the window, the tray entry and the repository all carry the new name, and the icon is now the one the README has always shown.

**This release does not update an existing installation.** The rename changes the application identity Windows uses to recognise it, so an installer for this version installs AppNook alongside the old **Windows Apps** entry rather than replacing it.

1. Install AppNook.
2. Get BACKUP **Settings → Advanced → Backup & restore → Export settings**
3. Uninstall **Windows Apps** from **Settings → Apps → Installed apps**.
4. Run **Settings → Advanced → Catalog maintenance → Force full scan**.

Favorites, categories, scenarios and the catalog cache belong to the old identity and do not carry over. To keep them, use **Settings → Advanced → Backup & restore → Export settings** in the old version before uninstalling it, then import that file in AppNook.

## Highlights

- **A scan that runs out of time keeps what it found** — previously any bound reached during a portable scan threw the whole run away and left the old catalog in place. Now only cancelling a scan discards its results; a run stopped by the time or entry bound adopts everything it managed to reach.
- **A diagnostics log you can hand to someone** — AppNook records what every scan does: the sources it asked, how long each took, every drive it walked and every bound it hit. **Settings → Advanced → Diagnostics log → Export log as XML**
- **Closing the window is your choice** — decide whether the close button leaves AppNook in the notification area or quits it.
- **The window comes back where you left it** — size, position and maximized state are restored on the monitor they were on, and the window returns to the middle of a remaining monitor when that display is gone.

## Install

1. Download `AppNook_0.4.0_x64-setup.exe`.
2. Run it. The installer is not Authenticode-signed, so SmartScreen may show **Windows protected your PC**; choose **More info -> Run anyway**.
