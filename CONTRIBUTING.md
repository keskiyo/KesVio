# Contributing to KesVio

Bug reports, reproduction steps and focused pull requests are welcome. KesVio is a Windows-only
Tauri 2 desktop application maintained by one person, so the rules below exist to keep review short
rather than to make contributing hard.

## Bug reports and feature requests

Open [a new issue](https://github.com/keskiyo/KesVio/issues/new/choose) and choose **Bug report** or
**Feature request**. You can fill out either form in English or Russian. Search open and closed
issues first; add details to an existing report when it already covers your problem or idea.

For bugs, include your KesVio and Windows versions, reproduction steps, expected behavior and
actual behavior. If specific apps are affected, include their names and installation sources if
known. If KesVio cannot open or install, use the installer filename for its version or write
"Unknown"; a log is not required. Screenshots and diagnostics are optional. Issues are public, so remove personal
or sensitive information before attaching anything. Report security vulnerabilities privately as
described in [SECURITY.md](SECURITY.md).

## Licensing of contributions

By submitting a contribution to KesVio, you agree that your contribution is licensed under the MIT
License of this repository, and that you have the right to license it that way.

Third-party code needs its provenance stated in the pull request: where it came from, under which
license, and what changed. Code you cannot license under MIT cannot be merged, and neither can code
produced by copying from an incompatible project.

Adding, replacing or upgrading a dependency needs agreement first. Open an issue saying why the
standard APIs and the installed dependencies are not enough, and what the addition costs in size,
maintenance and license terms. A pull request that arrives with a new dependency and no prior
discussion will be asked for that discussion before anything else.

## Before you open a pull request

Read [Documentation.md](Documentation.md). It is the technical record for this repository:
architecture layers, IPC and event contracts, persisted formats, the security boundary around the
webview, and how the pieces fit together.

Two conventions catch people out:

- **The source carries no comments.** Names and tests do the explaining. The only exceptions are
  `// SAFETY:` above an `unsafe` block, a one-line reason above a suppression, tooling directives,
  and third-party license headers.
- **Frontend imports are relative and layers depend downward only**
  (`app → pages → widgets → features → entities → shared`). There is no path alias, and
  `scripts/verify-frontend-boundaries.ps1` fails CI on a violation.

## Development setup

Requires Windows 10 or 11 on x64, the Node.js version in `.node-version`, the Rust toolchain in
`rust-toolchain.toml`, and the Microsoft C++ build tools that Tauri needs.

```bash
npm ci
npm run tauri dev
```

## What has to pass

Run the gates for the layers you touched, and say in the pull request which ones you ran.

```bash
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
```

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`.github/workflows/verify.yml` runs the same gates plus the boundary and release-contract checks.
Do not weaken a check to make it pass — a rule that is wrong is worth an issue, not a suppression.

Every fixed bug needs a regression test that fails without the fix. New behaviour is tested at the
lowest level that proves it.

## Pull requests

One intent per pull request. Do not reformat files the change does not touch. Say what the change
does, why, and how you verified it; name any check you skipped and why.

Commits use English [Conventional Commits](https://www.conventionalcommits.org/) with an imperative
subject and no trailing period, for example `fix: keep the scan cancel token alive across retries`.

Releases are not part of a contribution. Tags, published releases and version bumps are made by the
maintainer.

## Security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md) and report privately through the
repository's Security tab.
