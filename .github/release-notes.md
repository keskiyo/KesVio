KesVio is a fast, private application catalog and launcher for Windows 10 and 11. It gathers Start Menu shortcuts, installed software, Store apps, Steam games, and portable executables into one searchable catalog.

## Highlights

- **One card per application** — however many sources found it. Shortcuts, registry entries and Store packages for the same program are merged rather than listed side by side.
- **Startup is yours to switch on** — the installer registers a Startup entry and leaves it **off**, so KesVio appears in **Windows Settings → Apps → Startup** for you to enable if you want it.
- **It removes no software** — uninstalling stays with Windows, and the card menu opens the Windows page for it.

## Install

1. Download `KesVio_0.5.0_x64-setup.exe`.
2. Run it. The installer asks for administrator rights and installs to `C:\Program Files\KesVio` by default; the install page lets you choose another folder. Because it is not Authenticode-signed, SmartScreen may show **Windows protected your PC**; choose **More info → Run anyway**.
3. If Microsoft Edge WebView2 is missing, the embedded bootstrapper downloads it from Microsoft and requires internet access.

## Verifying this download

The installer is not Authenticode-signed, so two things are published beside it instead:

- `SHA256SUMS.txt` — compare it with `Get-FileHash KesVio_0.5.0_x64-setup.exe -Algorithm SHA256`.
- A build provenance attestation tying these exact bytes to the workflow run and commit that produced them — `gh attestation verify KesVio_0.5.0_x64-setup.exe --repo keskiyo/KesVio`.
