# Privacy

KesVio has no telemetry, no account, and no server of its own. Nothing it learns about your machine
is sent anywhere. This file states exactly what it stores and what it sends, so the claim can be
checked rather than trusted.

## What KesVio stores, and where

KesVio keeps its files in a `KesVioData` folder beside the executable whenever that location accepts
writes, and falls back to your Windows user profile when it does not.

| Data                                                                                           | Location                                                         |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Application catalog cache: names, executable and shortcut paths, icons, categories, your marks | `KesVioData\data\apps-cache.json`, or `%APPDATA%\keskiyo.kesvio` |
| Window size and position                                                                       | `KesVioData\data\`, or `%APPDATA%\keskiyo.kesvio`                |
| Interface preferences: theme, card density, sorting, scenarios, update preferences             | WebView2 local storage for the application                       |
| Diagnostics log                                                                                | `KesVioData\logs\`, or `%LOCALAPPDATA%\keskiyo.kesvio`           |

The catalog describes software installed on the machine. It is ordinary personal data in the sense
that it says something about you, which is why it stays on the machine.

Uninstalling always removes the application, its Startup shortcut, its registry state and the
diagnostics logs. Your catalog and preferences are removed only if you tick **Delete application
data** in the uninstaller.

## What leaves the machine

Three things, all of them visible in the interface before they happen:

- **Update checks and downloads.** The updater requests
  `https://github.com/keskiyo/KesVio/releases/latest/download/latest.json` and, if you accept an
  update, downloads the installer from the same repository. GitHub sees and logs the request the
  way it logs any download: your IP address, the time, and the user agent. The request carries no
  catalog data, no machine identifier, and no account.
- **The WebView2 runtime.** If Microsoft Edge WebView2 is missing during installation, the
  installer downloads it from Microsoft.
- **Diagnostics you export yourself.** **Settings → Advanced → Diagnostics log** writes a file
  where you choose. Nothing is uploaded; the file goes wherever you send it. It contains
  application names and local file paths, so read it before sharing.

Automatic update checks can be turned off in **Settings → Updates**. With them off, KesVio makes no
network request at all until you check manually.

## What KesVio does not do

- No telemetry, analytics, crash reporting, or usage counting.
- No account, sign-in, or licence check.
- No upload of your application inventory, and no online metadata or artwork enrichment.
- No advertising or tracking identifiers, and no third-party SDK inside the application.
- No reading of documents, browser data, or credentials. KesVio reads what it needs to find and
  launch applications: the registry uninstall keys, Start Menu shortcuts, the Steam library files
  and the folders you list for portable applications.

Folders you add for portable scanning are yours to choose. A network location works, and if you add
one, KesVio reads it over your network like any other folder.

## Children and legal basis

KesVio is a local tool with no service behind it. It processes no data on the maintainer's behalf,
so there is no controller to contact and no data subject request to make: the data is on your
machine and under your control.

## Questions

Open an issue at <https://github.com/keskiyo/KesVio/issues>. For anything security-sensitive, follow
[SECURITY.md](SECURITY.md) instead of a public issue.
