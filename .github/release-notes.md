KesVio is a local-first Windows app catalog for finding, organizing, and launching desktop, Microsoft Store, Steam, and portable apps.

## Highlights

This release turns KesVio into a keyboard launcher — press the shortcut, type, press Enter — adds recently used apps to the tray, and makes the global shortcut easier to choose and harder to break. Notices raised while KesVio waits in the tray now stay until you see them.

## Added

- **Launch from the keyboard.** **Win+Shift+Q** opens KesVio with the search field ready. **Enter** opens the best match, which the line under the search field names (`Enter opens …`), because results are grouped by category and the best match is not always the first card. **↓** moves into the cards, arrow keys move between them, and **↑** from the top row returns to search.
- **Run as administrator from the keyboard.** **Ctrl+Enter** in the search field, on a selected card, or in Quick launch runs the app as administrator through the Windows consent prompt — only where the app menu offers it; otherwise KesVio says why not.
- **Recent apps in the tray.** The tray menu lists your five most recently launched apps under **Recent**; a click launches without opening the window. Hidden apps are left out.
- **The tray names your shortcut.** Hovering the tray icon shows `KesVio — Win+Shift+Q` (or your own combination).
- **A warning when the shortcut is taken.** If Windows or another program already holds your saved shortcut when KesVio starts, a notice says so and **Choose another** opens Settings, instead of the shortcut silently doing nothing.

## Changed

- **Choosing a global shortcut.** Press **Change**, hold the modifiers, and press a key. Combinations Windows keeps for itself (such as Win+E) and everyday app shortcuts (such as Ctrl+C) are refused right in the row, with a free alternative suggested where one exists. Before saving, a confirmation lists what the new shortcut opens, what it stops doing elsewhere, and that the previous one is released; harmless choices get a calm confirmation, risky ones a warning.
- **Ctrl+F only.** In-app search answers **Ctrl+F**; **Ctrl+Shift+F** is now free for other use.
- **Ordinary launch over special modes.** When several shortcuts open the same program, its card launches the ordinary one rather than a special mode such as remote or startup.

## Fixed

- **Notices wait while KesVio is in the tray.** A drive prompt or the summary of a scenario started from the tray used to time out before the window was opened; notices now pause while the window is hidden.
- **Drive prompts stay until answered.** A **Drive connected: run …?** prompt waits for your answer, reconnecting the drive no longer stacks copies, and **Run** starts the scenario as it is at that moment.
- **Readable shortcut settings.** The keyboard focus outline of the shortcut buttons is no longer clipped to a stripe, and shortcut warnings use a readable color on the dark theme.

## Security

- Keyboard elevation reuses the exact rule of the app menu: never for hidden apps or links, and Windows is asked first for Store apps. The webview still sends only a bounded catalog id; the backend resolves every target.

## Install

1. Download `KesVio_0.5.7_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

Updating from 0.5.6 takes one click on **Update 0.5.7 available** under the KesVio name, or **Settings → Check updates**. Preferences, the saved shortcut and the catalog cache are kept.

## Verification

The installer is not Authenticode-signed, so these are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.7_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.7_x64-setup.exe --repo keskiyo/KesVio`.
- `KesVio_0.5.7_sbom.cdx.json` — the inventory of every third-party component in the installer.