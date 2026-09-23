# README screenshots

Documentation screenshots live here rather than under `public/` so Vite does not
include them in the application bundle.

## Current capture

Captured on 2026-09-23 from the running KesVio 0.5.4 application, built from the
release change set that introduces these images on top of revision `63dde23`. The window
was rendered at a 1600 × 900 viewport through the WebView2 debugging protocol, so
the images are native size rather than downscaled. The catalog counts, categories
and application names come from a real Windows installation rather than fixtures.
Scenario names are presentation-ready, saved filters were hidden for the capture
and restored afterwards, and the application details use a standard Program Files
path without account or machine identifiers.

All six application screenshots are 1600 × 900 and use the same dark theme; five
are below 500 KB and `catalog.png`, the densest view, is about 565 KB. The Social
Preview is 1280 × 640 and reuses the previous layout with the new catalog capture
in its frame.

| File                 | Content                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `catalog.png`        | Main catalog with the logo and version, sidebar, categories and cards. |
| `favorites.png`      | Favorite applications and two saved scenarios.                         |
| `more.png`           | Auxiliary tools, Scenarios, Hidden and Installers & Docs previews.     |
| `scenarios.png`      | Configured scenarios with their launch and close lists.                |
| `app-info.png`       | Application information, installation path, status and detection.      |
| `settings.png`       | Density, startup and tray behavior, shortcut and Windows apps.         |
| `social-preview.png` | 1280 × 640 repository preview built from the icon and catalog capture. |

## Refresh guidance

- Capture the current interface whenever branding or the pictured controls change.
  A release that changes nothing visible keeps these images, even though the
  version under the logo then trails the release; the version recorded above is
  the one pictured.
- Keep these filenames synchronized with the root README and verify all seven files.
- Use a desktop viewport with the sidebar visible and one consistent theme.
- Save PNG files under roughly 500 KB each and inspect every image before publishing.
- Use an isolated example catalog. Exclude personal folder paths, machine names,
  account names and private software from public screenshots.
- Keep demonstration fixtures separate from application source and user preferences.
- Update the capture date, application version and source revision here.
- Upload `social-preview.png` through the repository's Social Preview setting after
  every approved replacement; adding the file to Git does not change that setting.
