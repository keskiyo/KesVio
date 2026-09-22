# Development and releases

**Owns:** Local development, repository workflow, verification gates, CI, performance checks, installer verification, and tag-only releases.

**Read this when changing:**

- development commands or toolchain pins;
- tests, boundary checks, CI, or audit gates;
- release workflows, versions, installers, or provenance;
- performance and native-smoke procedures.

**Main code:**

- `package.json` and `src-tauri/Cargo.toml`
- `scripts/`
- `.github/workflows/`
- `tests/`

**Main tests:**

- frontend and backend suites named below
- release-contract and boundary tests under `scripts/` and `tests/frontend/config/`
- native smoke and performance harness tests

**Related:**

- [Architecture](architecture.md)
- [Search aliases](search-aliases.md)
- [Security model](security.md)
- [Troubleshooting](troubleshooting.md)

## Verifying a downloaded installer

Three independent checks, none of which requires trusting the author:

- `gh attestation verify KesVio_<version>_x64-setup.exe --repo keskiyo/KesVio`
  — GitHub's own record that this file was produced by `release.yml` in this
  repository, at a named commit. `release.yml` attests the assets after
  `verify-release-assets.ps1` has passed and before the release leaves draft.
- `Get-FileHash -Algorithm SHA256` against the published `SHA256SUMS.txt`, which
  the release workflow generates from the collected installer and
  `verify-release-assets.ps1` re-checks against that same file, so a stale or
  mismatched checksum fails the release rather than reaching the release page.
- The detached `.sig`, verified with `minisign` against the public key in
  `tauri.conf.json`. This is the same signature the in-app updater checks.

None of the three suppresses SmartScreen, which only an Authenticode certificate
does. They answer a different question: whether the bytes are the ones this
repository built.

## Repository workflow

Follow existing seams; do not add dependencies, broad package updates, comments
in production source, path aliases, global utility folders, raw Tauri imports
outside the approved integration modules, or relaxed checks without explicit
approval. [Architecture](architecture.md) states which layer owns what, and the boundary scripts in
`scripts/` fail the `contracts` job when a change crosses one — those are
the reference a clone actually carries.

New frontend behavior receives a lowest-level regression test. Frontend tests
use typed complete client fakes and query observable behavior. Rust unit tests
remain colocated where private crate contracts require them. Performance tests
assert bounded semantic work rather than wall-clock thresholds.

Development commands are defined by `package.json`:

```powershell
npm run dev
npm run tauri dev
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

`npm run verify` runs that whole frontend gate in order and adds the two
repository checks below, so a contributor needs one command before opening a
pull request; `npm run verify:rust` is its backend counterpart (format, Clippy
with warnings denied, tests, all `--locked`). The parts are also available on
their own as `npm run verify:docs` and `npm run verify:boundaries`.

Formatting is owned by Prettier through `prettier.config.mjs` and `.prettierignore`.
`endOfLine` is `auto` because `core.autocrlf` is enabled on Windows checkouts while
the hosted runners are not; pinning it to `lf` would make `format:check` disagree
with itself across platforms. Generated files — `package-lock.json`, the golden
catalog baselines re-recorded by `serde_json`, `THIRD_PARTY_NOTICES.md`,
`.github/release-notes.md` and the SHA-pinned workflows — stay ignored so their
generators remain the only writers.

## Verification and releases

For frontend production changes run lint, formatting check, typecheck, relevant
tests, the full suite for shared behavior, and production build. For backend
changes run format,
Clippy with warnings denied, and relevant/full Rust tests:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`CI Verify` (`verify.yml`) runs on pull requests and `master`:

- frontend: `npm ci`, lint, formatting check, typecheck, coverage test run and
  production build;
- backend: tests on `windows-latest` and `windows-2022`, plus format and Clippy;
- MSRV: compile at the `rust-version` declared in `src-tauri/Cargo.toml`;
- contracts: frontend/platform boundaries, the documentation gate, release-script
  tests, dependency audit gates and the third-party license gate, including
  updater-signature fixtures, and the safety contract of the native smoke
  harness.

### Documentation gate

`scripts/verify-docs-links.mjs` reads this documentation set — the entry
documents plus the domain documents allow-listed in `.gitignore` — and fails the
`contracts` job on four things: a relative link whose target is missing, an
anchor no heading produces, a quoted `src/…`, `src-tauri/…`, `scripts/…` or
`tests/…` path that does not exist, and a link that would send a reader to a
git-ignored working file such as `.1localDocuments` or `docs/superpowers`. It
also checks that every `npm run …` named in the documentation exists in
`package.json`, and that the index routes to every allow-listed document. Its
own behaviour is pinned by `scripts/test-verify-docs-links.mjs`, which builds
throwaway repositories for each failure mode.

`scripts/run-native-smoke.ps1` is the native smoke run for a built executable
(`npm run tauri build` → `src-tauri/target/release/KesVio.exe`, or a
`cargo build --release --features tauri/custom-protocol` binary; a plain
`cargo build` binary is a dev-mode build that expects the Vite dev server). It
copies the executable into `%TEMP%\kesvio-smoke\<stamp>\App`, pre-creates
`KesVioData\data` and `KesVioData\logs` beside it so the portable data root is
adopted and nothing under the user's profile is written, seeds an empty
catalog so the interface requests the ordinary startup scan, points the scan
settings at a fixture folder of copied System32 executables, and then proves
state from the log and the cache: the data folder beside the executable, the
tray icon, the volume watcher, a published generation with fixture records and
a `portable` snapshot, a visible `KesVio` window that `WM_CLOSE` hides while
the process lives, a second launch that exits and is forwarded to the first
(`Second instance forwarded to this process`), a warm restart that reuses the
cache (`previous generation=N`) with a stable scan, and unchanged per-user
and installed stores (the WebView2 profile under `EBWebView` excepted).
Evidence is written to `.1localDocuments/native-smoke-<stamp>.json`. It stops
only the process it started, after checking its path lies in the workspace,
and deletes only that workspace; `scripts/test-run-native-smoke.ps1` holds it
to that. The installer, the signed update and tray clicks remain manual.

`scripts/measure-performance.ps1` is the performance baseline protocol: it
records the commit, machine, OS, WebView2, node and rustc versions, runs the
ignored `catalog::golden::timings::stage_timings` (p50/p95 over 11 samples of
the cached-startup pipeline stages on the pinned 2000-record corpus, printed
as one `KESVIO_PERF` JSON line, release profile by default) and
`vitest bench --run tests/perf` (search ranking on a seeded 2000-record
catalog), and writes `.1localDocuments/perf/perf-<stamp>.json`. Bench files
under `tests/perf/` are never part of `npm test` and assert no threshold; a
regression is judged by comparing artifacts of the same profile and machine.
The log line `Frontend ready: N ms after the window was prepared` is the
clock for the native cached-startup measurement.

`THIRD_PARTY_LICENSES.txt` is the license text that ships with the installer,
distinct from `THIRD_PARTY_NOTICES.md`, which is the human-readable inventory.
It is generated by `scripts/generate-third-party-licenses.ps1` from
`npm ls --omit=dev --all` and from `cargo tree -e normal,build --target
x86_64-pc-windows-msvc`, takes each package's text from what upstream actually
ships, falls back to `scripts/license-texts/` for the fourteen packages that ship
none, and fails rather than emitting a package with no license at all. Identical
texts are printed once and referenced by id. MPL-2.0 dependencies get a source
availability section naming the repository each one is obtained from, which is
what section 3.2 requires of a distributor of executables.
`scripts/verify-third-party-licenses.ps1` regenerates the file and fails on
drift, so a lockfile change cannot leave the bundled texts describing the
previous dependency graph. `bundle.resources` in `tauri.conf.json` maps the file
into the installed directory.

The signed updater-signature fixtures under `src-tauri/tests/fixtures/` are
byte streams, not text. `.gitattributes` marks that directory `binary` so a
checkout with `core.autocrlf` enabled cannot rewrite line endings and invalidate
the detached signature; `test-verify-updater-signature.ps1` also compares each
fixture against its size in the index and names that failure explicitly.

Node.js `22.22.2` and Rust `1.96.0` are pinned in `.node-version` and
`rust-toolchain.toml`. Cargo verification uses `--locked`; the separate MSRV
job builds with Rust `1.88.0`.

Release preparation also provides `scripts/run-release-soak.ps1`.
It binds to one exact application PID and executable path, records operator-confirmed
Refresh/Cancel outcomes, samples memory during the idle/watcher window, and writes
local evidence under `.1localDocuments`. It never controls or terminates the target
process. This record is reference-machine evidence, not a replacement for CI or the
clean Windows acceptance matrix.

Runtime `npm audit --omit=dev --audit-level=high` admits no exceptions. High or
critical development-only advisories require dated entries in
`.github/npm-audit-exceptions.json`; stale or undocumented exceptions fail CI.

Release is tag-only: a `v*` tag on the exact `master` SHA triggers
`release.yml`. Version values must agree across npm/Cargo manifests, lockfiles
and `tauri.conf.json`. The release workflow reruns critical gates, builds and
signs the NSIS bundle, verifies its detached updater signature against the
configured public key, creates/verifies `latest.json`, then publishes the draft.
Published tags are immutable; corrections use a new patch version. The project
source is MIT-licensed; third-party notices are recorded in
`THIRD_PARTY_NOTICES.md`.

## Search-alias maintenance

The alias corpus has its own generation, audit, diagnosis, and benchmark workflow. Follow [Search aliases](search-aliases.md#alias-sources) rather than duplicating those commands here.

## Related documentation

- [Architecture](architecture.md)
- [Search aliases](search-aliases.md)
- [Security model](security.md)
- [Troubleshooting](troubleshooting.md)
