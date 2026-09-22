# KesVio Technical Documentation

Technical reference for maintainers and coding agents. [README](README.md) is the product and user overview. Current source and tests remain the implementation truth when prose is stale.

## Start here

KesVio is a local-first Windows 10/11 x64 catalog, launcher, and organization layer. The desktop application uses Tauri 2 and WebView2, a React/TypeScript frontend, and a Rust backend over Windows APIs.

Frontend dependencies point downward only:

```text
app → pages → widgets → features → entities → shared
```

The webview sends bounded intent and catalog IDs. Rust resolves native targets from trusted process state before launch, close, folder, or other Windows operations.

## Documentation map

| If you are changing…                              | Read                                             | Main code                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| layers, ownership, or module boundaries           | [Architecture](docs/architecture.md)             | `src/`, `src-tauri/src/`                                                                                  |
| commands, events, errors, or stored data          | [IPC and data](docs/ipc-and-data.md)             | `src/entities/*/api/`, `src-tauri/src/commands/`, stores                                                  |
| discovery, scans, watchers, cache, or volumes     | [Catalog](docs/catalog.md)                       | `src-tauri/src/catalog/`                                                                                  |
| categories, visibility, tools, or artifacts       | [Classification](docs/classification.md)         | `src-tauri/src/catalog/classify/`, `src-tauri/src/catalog/artifact/`, `src-tauri/src/catalog/visibility/` |
| query variants, ranking, or search scopes         | [Search](docs/search.md)                         | `src/entities/app/lib/search/`                                                                            |
| aliases, Winget corpus, or search-gap diagnosis   | [Search aliases](docs/search-aliases.md)         | `src/entities/app/lib/search/`, `scripts/search-aliases/`                                                 |
| Settings, More, dialogs, scenarios, or filters    | [UI and workflows](docs/ui-and-workflows.md)     | `src/pages/`, `src/widgets/`, `src/features/`                                                             |
| launch, close, tray, startup, windows, or updater | [Desktop operations](docs/desktop-operations.md) | `src-tauri/src/lifecycle/`, `src-tauri/src/platform/windows/`, `src/features/update-app/`                 |
| trust boundaries, redaction, or update integrity  | [Security model](docs/security.md)               | `src-tauri/src/commands/`, `src-tauri/src/diagnostics/`, `src-tauri/capabilities/`                        |
| tests, CI, tooling, installer checks, or releases | [Development and releases](docs/development.md)  | `scripts/`, `.github/workflows/`, `tests/`                                                                |
| a failure or unexpected user-visible result       | [Troubleshooting](docs/troubleshooting.md)       | follow the routed domain                                                                                  |
| why a restrictive or withdrawn design exists      | [Technical decisions](docs/decisions.md)         | linked current owner                                                                                      |

## Using this documentation

1. Start with the row matching the task.
2. Read that domain document's ownership block and current contract.
3. Follow its Main code and Main tests entry points instead of searching the whole repository first.
4. Read linked domains only when the change crosses their boundary.
5. Update the owner document when behavior changes; use cross-links instead of copying its detailed rule elsewhere.

Historical rationale belongs in [Technical decisions](docs/decisions.md). Operational diagnosis starts in [Troubleshooting](docs/troubleshooting.md). Repository-wide contributor floors remain in [CONTRIBUTING.md](CONTRIBUTING.md) and the applicable `AGENTS.md` files.

## Core invariants

- KesVio is local-first: no account, telemetry, catalog upload, or online catalog enrichment.
- Frontend layers depend downward and slices are entered through their public root.
- The webview never supplies an executable path, registry key, shell command, or uninstall command for native execution.
- Native actions resolve trusted catalog IDs from `AppState`; display paths never return as command targets.
- There is no arbitrary command execution and no direct software-removal capability.
- Catalog and preference data are versioned production data; migrations preserve supported data and reject unsupported newer formats without overwriting them.
- Catalog generations are monotonic in one process, and stale snapshots, deltas, and hydration patches cannot replace newer state.
- Search aliases are built-in local metadata. The external package corpus is generated offline and bundled with the application.
- Classification prefers stable generic evidence over product tables where possible.
- Release tags are immutable; a `v*` tag on `master` is the only publication path.

## Project documents

- [README](README.md) — product overview, installation, and user-facing behavior.
- [Contributing](CONTRIBUTING.md) — contributor setup and required repository rules.
- [Security Policy](SECURITY.md) — private vulnerability reporting and supported scope.
- [Privacy Policy](PRIVACY.md) — user-facing storage and network behavior.
- [Third-party notices](THIRD_PARTY_NOTICES.md) and [license bundle](THIRD_PARTY_LICENSES.txt).
- [License](LICENSE).

## Legacy links

These short compatibility sections preserve public anchors used by older issues, pull requests, bookmarks, and external links. New repository links point to the canonical domain documents.

## 13. Privacy and security

Moved to the [technical security model](docs/security.md). Vulnerability reporting remains in [SECURITY.md](SECURITY.md), and user-facing data handling remains in [PRIVACY.md](PRIVACY.md).

## Verifying a downloaded installer

Moved to [Development and releases](docs/development.md#verifying-a-downloaded-installer).

## 16. Verification and releases

Moved to [Development and releases](docs/development.md#verification-and-releases).
