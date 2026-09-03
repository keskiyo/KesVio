AppNook is a fast, private application catalog and launcher for Windows 10 and 11. It gathers Start Menu shortcuts, installed software, Store apps, Steam games, and portable executables into one searchable catalog.

## Windows Apps is now AppNook

The project has been renamed. The application, the installer, the window, the tray entry and the repository all carry the new name, and the icon is now the one the README has always shown.

**This release installs alongside Windows Apps.** The rename changes the application identity Windows uses to recognise it, so AppNook does not replace the old **Windows Apps** installation or automatically inherit its data.

1. In **Windows Apps**, open **Settings → Advanced → Backup & restore → Export settings**. Note any folders you added for scanning.
2. Install AppNook and import that file from the same section.
3. Add your scan folders under **Settings → Advanced → Application discovery**, then run **Catalog maintenance → Force full scan**.
4. Check your Favorites, categories and Scenarios after restarting AppNook. Once they are saved, uninstall **Windows Apps** from **Windows Settings → Apps → Installed apps**.

Export transfers preferences, including Favorites, categories and Scenarios. The catalog cache and scan folders are not included; AppNook rebuilds the catalog by scanning. Keep the export until you have confirmed the restored settings persist. If the **Your changes are not being saved** banner appears, an import can still show **Settings imported.** even though its changes may be lost after restart.

## Highlights

- **Windows Apps is now AppNook** — this installs the renamed app beside the old one. Export and import your settings, rebuild the catalog, and confirm the settings persist before uninstalling Windows Apps.
- **Scans find your applications again** — fixed-drive discovery is on by default, Force full scan has its three-minute budget back, and a scan stopped by a limit keeps what it found instead of discarding the whole run.
- **A diagnostics log you can hand to someone** — AppNook records what every scan does and writes it out as XML from **Settings → Advanced → Diagnostics log**.
- **Closing the window is your choice** — decide whether the close button leaves AppNook in the notification area or quits it.
- **The window comes back where you left it** — size, position and maximized state are restored on the monitor they were on, and the window returns to the middle of a remaining monitor when that display is gone.

## Install

1. Download `AppNook_0.4.0_x64-setup.exe`.
2. Run it. The installer is not Authenticode-signed, so SmartScreen may show **Windows protected your PC**; choose **More info -> Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.