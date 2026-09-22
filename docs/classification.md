# Classification

**Owns:** Artifact kind, visibility, category decisions, generic signals, product-specific evidence, and classifier regression governance.

**Read this when changing:**

- application categories or visibility;
- auxiliary tools, installers, or documentation artifacts;
- Windows feature recognition;
- generic classifier signals or the unclassified-record workflow.

**Main code:**

- `src-tauri/src/catalog/classify/`
- `src-tauri/src/catalog/artifact/`
- `src-tauri/src/catalog/visibility/`
- `src-tauri/src/catalog/golden/`

**Main tests:**

- backend classifier and golden tests under `src-tauri/src/catalog/`
- `src-tauri/tests/fixtures/`
- `tests/frontend/features/view-app-details/classification.test.ts`

**Related:**

- [Catalog](catalog.md)
- [UI and workflows](ui-and-workflows.md)
- [Technical decisions](decisions.md)
- [Troubleshooting](troubleshooting.md)

## Explainable decisions

Classification decisions are explainable in the interface, not only in source:
the application information dialog reports the discovery source, where the
record is shown and why, the recorded launch-target check where one applies,
and the signal that chose its category.

## Artifact and visibility rules

An entry that removes software is never an installation artifact, however
generic its target: a shortcut is read as an uninstall action when its first
word says so (`Uninstall …`, `Удалить …`, `Деинсталляция …`) or when its launch
arguments carry an uninstall switch (`/x{…}`, `--uninstall`, `REMOVE=ALL`).
Both checks live in `catalog::filters` beside the uninstall-target path rule,
so the artifact classifier and the visibility rules read the same definition.
Product names built from the same words — Revo Uninstaller, IObit Uninstaller —
stay applications, because only the first word counts.

## Windows feature recognition

Windows built-in tools are recognised by their whole name rather than by a
substring, so a vendor product can never inherit the category by containing the
word. A trailing qualifier does not defeat that rule: the comparison also runs
against the name with its parenthetical suffixes removed, which is what files
`Windows PowerShell (x86)` and `Источники данных ODBC (64-разрядная версия)`
with the tools they are variants of. A name that consists of nothing but a
qualifier matches no rule at all.

Characters that imitate a Latin letter are folded before any signal is read, so
the micro sign in `µTorrent` is compared as `u` and the record reaches the same
rule as its ASCII spelling.

Shell binaries are not category evidence. A Start Menu folder shortcut resolves
to `explorer.exe`, so the executable of a Windows feature is read from the tools
that are only ever themselves; `Проводник` is recognised by its name instead.

An entry generated for a `file://` target is documentation whenever the target
is a document, so a registered `…/doc/index.html` is filed with the other
documentation rather than as an application of the product it documents.

Category rules are applied twice, and the second pass is the one that matters.
A source records a first guess from the name and path it has; assembly re-runs
`classify_app` over the finished record, where the publisher, product name,
description and resolved executable are available and outweigh the name. A rule
that needs vendor evidence therefore belongs on those fields, and measuring a
source's output in isolation understates the result: on a 432-record scan of
three sources, 51 entries carried no category, while the assembled catalog of
217 left 5.

A component shipped as part of Windows is recognised by its publisher, not by
where it is installed. Store packages live under `Program Files\WindowsApps`
whether Microsoft ships them with the operating system or sells them alongside
everyone else's, so treating that tree as evidence swept Xbox, the Game Bar, Dev
Home, To Do and Power Automate into Windows Features. The package publisher id
`cw5n1h2txyewy` is the identity of `CN=Microsoft Windows` and belongs only to
genuine shell components; first-party applications that are still part of a
Windows installation, such as Calculator or Maps, stay on the explicit
package-name list beside it.

## Generic signals

A table of product names can only recognise software it already lists, so three
signals carry records the table has never seen:

- **What the system registered.** `catalog::machine::Associations` reads the file
  types and URL protocols an executable claims — `Applications\<exe>\SupportedTypes`
  and the `Capabilities` of every entry in `RegisteredApplications`. An
  application that owns `.flac` is a player and one that owns `mailto:` is a mail
  client, whatever it calls itself. Extensions are a closed, standardised set,
  unlike product names. The map is a machine fact read once per scan and is never
  persisted, so no cached record can go stale against it.
- **What the vendor wrote about itself.** `catalog::classify::vocabulary` holds
  plain purpose words in Russian and English — `media player`, `графический
редактор`, `terminal emulator` — matched against the description and the
  ProductName of the binary. Its weight sits between the threshold and a
  product-name match: a description alone leaves `Other`, but never outranks a
  named product. Two independent generic matches do.
- **Where the entry lives.** Start Menu groups and vendor folders (`\Игры\`,
  `\Development\`) score at path weight, the weakest evidence of the three.

`WindowsFeatures` is deliberately excluded from the vocabulary: it is recognised
by whole values only, so a third-party shortcut described as «Проводник» cannot
inherit it. Its one substring field is the install path, which carries the two
machine facts that need no product name: a component living under
`\Windows\System32`, `\SysWOW64`, `\Windows\Speech` or `\Windows\SystemApps\`, and
a Store package whose family starts `\WindowsApps\Microsoft.`. A Store package
from any other publisher is untouched by that rule.

Two kinds of reported metadata are treated as no evidence at all rather than as
weak evidence, because scoring them is worse than ignoring them:

- **Localized resource stubs.** Windows reports `MSPAINT.EXE.MUI` as the original
  file name, and dropping only the last extension leaves `mspaint.exe`, which
  matches no executable rule. The `.mui` suffix is removed before the stem is
  taken.
- **Packaging-toolkit metadata.** An InstallShield shortcut reports publisher
  `Acresso Software Inc.`, product and description `InstallShield`, and
  `_IsIcoRes.exe` as the binary — all describing the installer, not the product.
  Those values are blanked, so the product name in the shortcut's own title is
  what the rules read. The same applies to Inno Setup, NSIS and Nullsoft
  defaults.

One more install path carries a product without naming it. An MSI-advertised
shortcut reports the Windows Installer cache — `C:\Windows\Installer\{GUID}` —
instead of a program folder, so neither the name nor the path says what the
product is. Microsoft registers Office under a fixed product-code family, so
`\Installer\{90120000`, `{90140000`, `{90150000` and `{90160000` file the whole
suite at once: `Access 2016` and `Publisher 2016` carry no other evidence and
would otherwise stay unclassified for the same reason as their telemetry and
language companions.

Records that still match nothing are listed at the bottom of Settings with every
signal the classifier read, so a machine with unfamiliar software shows what the
tables are missing rather than a silent pile in `Other`. One action copies the
whole list — signals, source, artifact, visibility and the recorded reason — as
plain text, so an unfamiliar machine can be reported without retyping it.

The golden evidence includes 60 previously unrecognized records from an
unfamiliar Windows installation. Machine facts alone resolve 13 of them:
Windows paths, Store package families, `.mui` normalization and packaging
metadata suppression. Product-family, driver-standard and shared-root signals
resolve the remaining unambiguous records. In total, 48 now receive a category
and four more are recognized as components; ambiguous records deliberately stay
in `Other`. Every record is a positive or negative fixture in
`catalog_categories.json` or `catalog_visibility.json`. The negative guards
prove, among other cases, that a non-Microsoft Store package is not a Windows
feature and a product named after a maintenance verb remains a product.

A second set of 29 records proves three additional shapes. A versioned vendor
tree identifies executables such as `1cestart`, `1cv8`, `1cv8c` and `1cv8s` that
carry no useful product name. A component can inherit identity from a specific
product root, as with tools inside the `Cheat Engine` and `EqualizerAPO` trees.
A localized title can omit every product word, leaving an executable such as
`YandexPin.exe` as the decisive signal while a shared browser folder remains
insufficient.

That last shape is why a shared install root scores below a vendor. A dongle
driver installer ships inside the 1C tree, so the tree would file it as business
software; its own publisher and executable outrank the path and keep it with the
maintenance tools. The reverse guard already existed for Windows features, and
this is the same rule seen from the other side: a path answers only for a record
that has nothing else to say.

A third fixture set covers 13 records from a clinical workstation. Explicit
Store package families identify localized inbox applications without relying on
a blanket Microsoft prefix; this distinguishes opaque identities such as
`Microsoft.549981C3F5F10` and `Microsoft.MSPaint` while keeping packaged games
in their actual category.

The remaining records name a professional domain instead of a vendor. Clinical
software arrives with no publisher at all, so `поликлиника` and
`здравоохранение` are what identify it; a medical image viewer is read from the
DICOM standard it implements and from `Medixant`, never from a product name
unique to one machine. One record stays in `Other` deliberately:
`GreenAPP.Launcher` repeats a single invented name as publisher, product and
description, and its install root adds no domain word — it is a fixture that
asserts no category, so a later rule cannot claim it by accident.

The golden catalog harness under `src-tauri/src/catalog/golden/` protects
identity, launch descriptor, category, visibility and dedup contracts with
fixtures and deterministic generated properties. Recording a new baseline is
deliberate:

```powershell
$env:KESVIO_GOLDEN_UPDATE = "1"; cargo test --manifest-path src-tauri/Cargo.toml golden
```

## Classification precedence

Prefer deterministic generic evidence over a growing table of product names. Machine associations and trustworthy executable metadata outrank vocabulary and paths; a shared install path is evidence only when the record has nothing stronger to say. Product-specific rules remain justified where Windows exposes an opaque family, executable, product code, or localized name that generic evidence cannot recover safely.

Artifact, visibility, and category decisions remain separate even when one UI view presents them together. Drive-root grouping is a presentation override owned by catalog selection, not a rewrite of the backend classifier.

## Related documentation

- [Catalog](catalog.md)
- [UI and workflows](ui-and-workflows.md)
- [Technical decisions](decisions.md)
- [Troubleshooting](troubleshooting.md)
