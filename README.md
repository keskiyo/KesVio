<p align="center">
  <img src="public/app-icon.png" width="88" height="88" alt="AppNook logo">
</p>

<h1 align="center">AppNook</h1>

<p align="center">A local catalog for the Windows software you already use.</p>

<p align="center">
  AppNook finds Start Menu shortcuts, installed desktop programs, Microsoft Store apps, Steam games and portable executables.<br>
  It brings them together in one searchable catalog and merges duplicate entries into a single application card.
</p>

<p align="center">
  <a href="https://github.com/keskiyo/AppNook/releases/tag/v0.4.0"><img src="https://img.shields.io/badge/version-0.4.0-7C3AED?style=flat-square" alt="Version"></a>
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-0078D4?style=flat-square&amp;logo=windows11&amp;logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/architecture-x64-334155?style=flat-square" alt="Architecture">
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/catalog-local--first-16A34A?style=flat-square" alt="Local first">
</p>

<h2 align="center"><a href="https://github.com/keskiyo/AppNook/releases/latest">⬇ Download AppNook</a></h2>

<p align="center">Windows 10/11 · x64 · Local-first</p>

![AppNook catalog with categories, search and application cards](.github/images/catalog.png)

## One catalog for Windows software

Windows keeps applications in several places. AppNook combines:

- Start Menu shortcuts
- installed desktop programs
- Microsoft Store apps
- Steam games
- portable executables in folders you choose

When the same application is discovered from more than one source, it appears once rather than as a collection of duplicates.

## From discovery to launch

1. **Discover** Windows software, Steam games and selected portable-app folders.
2. **Organize** the catalog with categories, Favorites, Auxiliary tools and Scenarios.
3. **Launch** applications through their native Windows, Steam or executable path.

## Built for everyday use

### Search the catalog

Find applications by name, publisher, description or path, including typo-tolerant search.
Typing a name in Russian letters finds the Latin one, naming a category returns everything
filed under it, and when a match sits in another section the results say so and link
straight to it.

### Sort software it has never seen

Categories do not rely on a list of known products. AppNook reads the file types and
protocols an application registered with Windows, the purpose the vendor wrote into the file
description, and the Start Menu group the shortcut lives in — so an unfamiliar player, editor or
mail client still lands where it belongs.

### Keep one card per application

Shortcuts, registry entries, Store packages and other representations of the same program are merged into one card.

### Launch through the right system path

Steam games open through Steam, packaged apps through Windows and executables directly.

### Save useful setups

Favorites, categories and Scenarios let you keep common applications and launch-and-close setups close at hand.

## Favorites and Scenarios

![Favorites page with starred applications and run-ready scenarios](.github/images/favorites.png)

Star applications for quick access, or run a Scenario that opens one group of applications and closes another.

## Scenario details

![Scenarios page with launch and close lists](.github/images/scenarios.png)

Each Scenario shows the applications it will launch and the applications it will close before you run it.
Applications are added from a searchable picker that names the category of every entry and
takes the whole selection in one pass. While a Scenario runs it reports each step — asking
applications to close, counting down the five seconds before anything is forced — and ends
with one summary of what launched, closed and refused. Closing is not a polite request
only: whatever ignores it is ended, and unsaved work in those applications is lost.
If an application later disappears from Windows, its saved name and icon remain visible as
**Unavailable** so it can be removed without deleting the whole Scenario.

## More catalog views

![More page with Auxiliary tools, Scenarios, Hidden and Installers and Docs](.github/images/more.png)

Auxiliary tools, hidden applications, installers and documentation stay available without crowding the main catalog.

## Application details

![App information dialog with file and launch details](.github/images/app-info.png)

Inspect local file details, architecture, signature status and installation state for an application card.

## Settings and maintenance

![Settings page with shortcut, Windows apps, updates and Advanced controls](.github/images/settings.png)

Everyday settings stay visible. Scanning, backups and maintenance live under Advanced, together
with the applications no rule recognised: each one lists the signals the classifier read, can be
moved to a category on the spot, and the whole list copies as plain text. Settings
export contains preferences only, and import reports an error if AppNook cannot persist the
restored data. Normal refreshes scan Windows sources and portable folders you add. Optional
fixed-drive discovery runs through **Force full scan**, on by default, with a bounded traversal time. The
installer adds AppNook to startup once, so it is already in the system tray
after you sign in; choose **Open AppNook** there when you need the window. Turn it off the
same way as any other program, in **Settings → Apps → Startup**. Closing the window leaves Windows
Apps in the notification area; **Keep running in the tray** turns that into a normal quit. The window
reopens at the size,
position and maximized state you left it in, on the monitor it was on; unplug that monitor and it
comes back to the middle of the one you still have.

## Install

1. Download [**`AppNook_0.4.0_x64-setup.exe`**](https://github.com/keskiyo/AppNook/releases/latest).
2. Run the installer.
3. Start AppNook and choose **Scan for apps**.

> [!WARNING]
> Released installers are not Authenticode-signed yet, so SmartScreen may show **Windows protected your PC**. Choose **More info → Run anyway** and download only from this repository's Releases. See [Code signing policy](#code-signing-policy).

| Requirement  | Value                   |
| ------------ | ----------------------- |
| OS           | Windows 10 or 11        |
| Architecture | x64                     |
| Runtime      | Microsoft Edge WebView2 |
| Internet     | Only for update checks  |
| Account      | Not required            |

## Privacy

AppNook is local-first. It has no telemetry, cloud account, application-inventory uploads or online metadata enrichment; catalog data remains on your machine. The one request it makes is the update check against this repository's Releases, which sends nothing about your catalog.

For implementation and security details, see [Technical Documentation](Documentation.md#13-privacy-and-security). AppNook is available under the [MIT License](LICENSE).

## Known limitations

- Windows 10/11 and x64 only.
- Released installers are not Authenticode-signed yet; SmartScreen may appear.
- Microsoft Edge WebView2 is required.

## Development

Prerequisites: Node.js 22, Rust 1.88+ with the MSVC toolchain, Microsoft C++ Build Tools, Windows SDK and the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
npm install
npm run tauri dev
```

See [Technical Documentation](Documentation.md#16-verification-and-releases) for verification and release commands.

## Contributing

Bug reports and pull requests are welcome. Read [Technical Documentation](Documentation.md) before changing code or workflows.

## Code signing policy

AppNook uses free code signing provided by [SignPath.io](https://signpath.io), with a certificate issued by the [SignPath Foundation](https://signpath.org).

Releases published so far predate that setup and are not signed; the SmartScreen warning above applies until the first signed release.

| Role     | Person                     |
| -------- | -------------------------- |
| Author   | Maksim Makhilin (@keskiyo) |
| Reviewer | Maksim Makhilin (@keskiyo) |
| Approver | Maksim Makhilin (@keskiyo) |

Every release is built from this repository by the GitHub Actions workflow in `.github/workflows/release.yml`, on GitHub-hosted runners, and each signing request is approved manually.

AppNook collects no personal data: it has no telemetry and no account, and the catalog it builds stays on the local machine. Its only network request is the update check against this repository's Releases, which GitHub serves and logs like any other download. See [Privacy](#privacy).

## Links

[Documentation](Documentation.md) · [Releases](https://github.com/keskiyo/AppNook/releases) · [Telegram: @keskiyo](https://t.me/keskiyo)
