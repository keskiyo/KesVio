Windows Apps is a fast, private application catalog and launcher for Windows 10 and 11. It gathers Start Menu shortcuts, installed software, Store apps, Steam games, and portable executables into one searchable catalog.

## Highlights

- **Windows owns the startup entry now** — the **Launch when Windows starts** switch is gone, and so is the registry value the running application used to write for it. A fresh install registers an ordinary Startup shortcut instead, so Windows Apps is waiting in the tray after you sign in. Turn it on or off in **Settings → Apps → Startup**, next to every other program; installing an update never overrides that choice, and the registry value left by an earlier version is removed.
- **No more phantom applications from inside Electron bundles** — helper binaries unpacked beside an `.asar` archive were catalogued as installed software, which is where those wrong install locations came from. Run **Settings → Advanced → Catalog maintenance → Force full scan** once after updating to clear them from an existing catalog.

## Install

1. Download `Windows.Apps_0.3.9_x64-setup.exe`.
2. Run it. The installer is not Authenticode-signed, so SmartScreen may show **Windows protected your PC**; choose **More info -> Run anyway**.