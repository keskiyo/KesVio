KesVio is a fast, private application catalog and launcher for Windows 10 and 11. It gathers Start Menu shortcuts, installed software, Store apps, Steam games, and portable executables into one searchable catalog.

## Highlights

This is a bug-fix release. If your catalog ever came up empty, this is the one to install.

- **Fixed: the catalog could stay empty and never recover.** On some computers a scan crashed part-way through reading an application's file details, and the catalog stayed at **0 apps** with _Could not refresh the application list_. It happened when an installed program's file details contained non-Latin characters, so Russian and other non-English systems were the ones affected.
- **A crashed scan says so.** It now reports its own code instead of looking identical to a scan you cancelled yourself.
- **Diagnostics are more useful when something does go wrong.** The exported log states up front whether the session crashed, and the scan log names the application it was processing rather than only the stage it was in.

## Install

1. Download `KesVio_0.5.1_x64-setup.exe`.
2. Run it. The installer needs no administrator rights and installs for the current user into `%LOCALAPPDATA%\KesVio`; you can pick another folder on the install page. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

## Verifying this download

The installer is not Authenticode-signed, so two things are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.1_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.1_x64-setup.exe --repo keskiyo/KesVio`.