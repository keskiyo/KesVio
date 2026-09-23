<p align="center">
  <img src="public/app-icon.png" width="96" height="96" alt="KesVio">
</p>

<h1 align="center">KesVio</h1>

<p align="center">
  <strong>All your Windows apps. One local catalog.</strong>
</p>

<p align="center">
  Find, organize, and launch desktop, Microsoft Store, Steam, and portable apps —<br>
  locally, with no account or telemetry.
</p>

<p align="center">
  <a href="https://github.com/keskiyo/KesVio/releases/latest"><strong>Download for Windows</strong></a>
  ·
  <a href="Documentation.md">Documentation</a>
  ·
  <a href="https://github.com/keskiyo/KesVio/releases">Releases</a>
  ·
  <a href="PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <a href="https://github.com/keskiyo/KesVio/releases/latest"><img src="https://img.shields.io/github/v/release/keskiyo/KesVio?style=flat-square&amp;label=release" alt="Latest release"></a>
  <a href="https://github.com/keskiyo/KesVio/actions/workflows/verify.yml"><img src="https://github.com/keskiyo/KesVio/actions/workflows/verify.yml/badge.svg?branch=master" alt="CI Verify"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?style=flat-square" alt="Windows 10 and 11">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/keskiyo/KesVio?style=flat-square" alt="MIT License"></a>
</p>

![KesVio catalog showing Windows applications grouped into sidebar categories](.github/images/catalog.png)

## Why KesVio?

**One catalog**<br>
Bring Start Menu shortcuts, installed desktop programs, Microsoft Store apps, Steam games, and portable executables together. Duplicate discoveries merge into one application card. Portable apps on a tracked drive keep their category and favorites when its drive letter changes.

**Automatic organization**<br>
Categorize unfamiliar software using Windows registrations, file metadata, and Start Menu structure instead of a hard-coded product list.

**Search beyond app names**<br>
Find software by name, publisher, description, path, or category, or by the short names people actually type: cmd, scode, wt, kubectl,
vim, chrome-beta and thousands more from a built-in dictionary and a bundled, offline index of winget package names. Search tolerates typos, transliteration, and Russian/Latin keyboard-layout mismatches.

**Launch workflows, not only apps**<br>
Use Favorites, saved catalog filters, and Scenarios to keep useful applications together and launch or close groups when needed.

**Local-first by design**<br>
No account, telemetry, application-inventory uploads, or cloud catalog.

## Product tour

### Favorites and Scenarios

![Favorites page with starred applications and saved scenarios](.github/images/favorites.png)

Star applications for quick access. Scenarios let you start one group of applications and close another as a reusable setup; open the launcher with `Ctrl+Shift+K` or keep favorite scenarios in the tray.

> [!WARNING]
> New Scenarios request a graceful close by default. If you enable **Force close after 5 seconds**, save your work first because unsaved changes may be lost.

### Application information

![Application information dialog showing local installation, status, and detection details](.github/images/app-info.png)

Inspect local file details, architecture, signature status, installation state, and the evidence KesVio used to classify an application.

### Settings and maintenance

![KesVio settings showing appearance, startup and tray behavior, and Windows integration](.github/images/settings.png)

Control catalog density, application discovery, startup and tray behavior, updates, and catalog maintenance from one place.

<details>
<summary>More screenshots</summary>

### Scenario editor

![Scenario editor with application launch and close lists](.github/images/scenarios.png)

Choose which applications a Scenario launches or closes and whether closing may be forced.

### More: catalog views and tools

![KesVio More page with Auxiliary tools, Scenarios, Hidden, and Installers and Docs](.github/images/more.png)

Auxiliary tools, hidden applications, installers, and documentation remain available without crowding the main catalog. **Catalog Health** shows whether every source answered, what the last scan changed, and exports a redacted diagnostics log; **Backup & Restore** exports, imports, or recovers your preferences.

</details>

For discovery rules, filters, removable drives, Undo, Scenario behavior, imports, and troubleshooting, read the [Technical Documentation](Documentation.md).

## Install

Download the latest Windows x64 installer from [**Releases**](https://github.com/keskiyo/KesVio/releases/latest).

1. Run the setup executable. It needs no administrator rights and installs for the current user.
2. Choose the installation location if needed.
3. Open KesVio and select **Scan for apps**.

> [!WARNING]
> KesVio releases are not Authenticode-signed yet, so Windows SmartScreen may show **Windows protected your PC**. Download installers only from this repository.

| Requirement  | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| OS           | Windows 10 or 11                                                |
| Architecture | x64                                                             |
| Runtime      | Microsoft Edge WebView2                                         |
| Internet     | Update checks and downloads; WebView2 installation when missing |
| Account      | Not required                                                    |

## Privacy & security

KesVio is local-first:

- no account required;
- no telemetry;
- no application-inventory uploads;
- no online metadata enrichment.

Your catalog remains on your computer. Network access is used for update checks, downloads, and WebView2 installation when required. KesVio does not remove software itself; when Windows has a registered uninstaller, KesVio opens the Windows Apps settings page.

[Privacy Policy](PRIVACY.md) · [Security Policy](SECURITY.md) · [Technical security model](docs/security.md)

### Release verification

KesVio installers are currently not Authenticode-signed. Each release instead includes:

- a SHA-256 checksum;
- a Tauri updater signature;
- GitHub build provenance.

See [Verifying a downloaded installer](docs/development.md#verifying-a-downloaded-installer) for the manual verification commands. These checks verify release integrity but do not suppress SmartScreen.

## Development

Prerequisites: the Node.js version in [`.node-version`](.node-version), the Rust MSVC toolchain pinned in [`rust-toolchain.toml`](rust-toolchain.toml), Microsoft C++ Build Tools, Windows SDK, and the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
npm install
npm run tauri dev
```

See [Verification and releases](docs/development.md#verification-and-releases) for repository checks and release architecture.

## Contributing

Bug reports and pull requests are welcome. Read [Contributing](CONTRIBUTING.md) for setup, required checks, and licensing, and review the [Technical Documentation](Documentation.md) before changing code or workflows.

## Project links

[Documentation](Documentation.md) · [Privacy](PRIVACY.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Releases](https://github.com/keskiyo/KesVio/releases) · [License](LICENSE) · [Third-party licenses](THIRD_PARTY_LICENSES.txt) · [Telegram: @keskiyo](https://t.me/keskiyo)
