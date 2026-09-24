KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release turns updating into one click from the sidebar, joins the navigation and the catalog into one window frame, stops the header from jumping when a saved filter is applied, and makes the interface easier to read and to use on a touch screen.

## Added

- **The version sits under the KesVio name.** The sidebar and the navigation drawer show the running version below the logo.
- **Updates install from one pill.** When a new version is available, the version line becomes **Update X available**. One click downloads it, verifies the updater signature, installs it and restarts KesVio. While it runs, the pill turns into a progress bar with the download percentage and then the stage (**Verifying**, **Installing**, **Restarting**); you can keep using the catalog meanwhile. If the update fails, the pill offers **Retry update X** and a notice explains what went wrong, with **Open release** to download the installer by hand.

## Changed

- **No more update banner or update dialog.** The strip above the catalog and the confirmation window with release highlights are gone; the full release notes stay on the GitHub release page. **Settings → Check updates** and the automatic-check switch remain, and a version found there appears in the sidebar pill.
- **Settings looks like the other pages.** Its header now has a gear icon, the title and a short description, like More; the logo and version moved to the sidebar.
- **One window frame.** On wide windows the navigation sidebar no longer floats as a rounded island: it sits flush against the window edge in the same translucent material as the header, and the line under the logo meets the line under the search bar across the whole window.
- **The header keeps its height.** An applied saved filter now appears right after the `apps · tools found` count instead of adding a row, so the catalog no longer shifts down, and the chip is next to what it filters instead of in the far corner.
- **The platform badge sits on the icon.** The Store, Steam or portable mark moved to the corner of the app icon, so it never covers the app name at any card density.
- **Easier to read.** Secondary text, counts and descriptions have more contrast against the dark surfaces.
- **Easier to tap.** On a touch screen buttons and links get a 44 × 44 px target; small controls laid over cards (menu, favourite, remove badges, search clear) keep their size so they never cover the app icon.
- **Thin scrollbars everywhere.** Every scrolling area uses the same 8 px scrollbar without arrow buttons.
- **Unrecognised applications** in Settings stretches its action button across the card on a narrow window like every other card action.

## Fixed

- **Recently added stays recent.** Every start used to move dozens of long-installed programs into **Recently added**; an application is now stamped once, the first time the catalog carries it.
- **A restored window respects the minimum size.** The saved window position could reopen the window a few pixels narrower than the 446 px the interface is designed for; it is now held to the configured minimum.
- **A long saved-filter name no longer widens the sidebar,** and on a 446 px window the scan button stays inside the header.

## Install

1. Download `KesVio_0.5.4_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.3 still happens through that version's update notice or **Settings → Check updates**, and keeps every preference and the catalog cache; nothing is migrated. From 0.5.4 on, later versions install from the sidebar pill.

## Verification

The installer is not Authenticode-signed, so two things are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.4_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.4_x64-setup.exe --repo keskiyo/KesVio`.