# Search aliases

**Owns:** Built-in aliases, identity matching, confidence, the offline Winget package corpus, governance, performance budgets, and search-gap diagnosis.

**Read this when changing:**

- curated, generated, or external aliases;
- identity clauses, helper vetoes, or alias confidence;
- the Winget snapshot, generator, quarantine, or provenance;
- diagnosis and regression handling for a reported search gap.

**Main code:**

- `src/entities/app/lib/search/`
- `scripts/search-aliases/`
- `data/search-aliases/`

**Main tests:**

- `tests/frontend/entities/app/search/`
- `tests/search-aliases/`
- `tests/audit/`
- `tests/perf/externalAliases.bench.ts`

**Related:**

- [Search](search.md)
- [Catalog](catalog.md)
- [Development and releases](development.md)
- [Troubleshooting](troubleshooting.md)

User-defined search aliases are not supported. Older preference documents may contain the schema-v20 `searchAliases` field, but the normalizer preserves it only as unknown data and the runtime ignores it. The schema version was not bumped because the document shape only lost an optional field.

## Runtime alias resolution

Built-in search aliases are search metadata only: nothing is persisted, nothing reaches `AppInfo`, and no UI shows or edits them.
`entities/app/lib/search/` resolves them once per `AppInfo` object when
`fieldsFor` builds the cached `SearchFields` (a `WeakMap` keyed by the record
object; the store replaces a patched record with a new object, which is what
invalidates the entry — `searchFieldsCache.test.ts` pins that from both sides):

- `knownAliasMatch.ts` reads the identity facts of a record
  (`appMatchFacts`: NFKC-normalised name and versionless name, product name,
  publisher, the executable basename of a real filesystem launch path, the
  `originalFilename`, the AUMID package family, the Steam app id, whether the
  record is an installer or documentation artifact) and matches a dictionary
  entry against them with a **declarative clause model**, not a score:
  `anyOf` clauses each yield a strength — `packageFamily`, `steamAppId` and
  `executable` (launch path only) are **strong** identity, `productName` and
  `name` (exact) are **normal**, `nameStartsWith` / `productNameStartsWith`
  are family rules with no strength of their own, and `publisherContains` /
  `originalFilename` are **supporting** evidence that never matches alone. An
  `allOf` takes the best member strength and is promoted one level when a
  supporting member also matched (`name` + `originalFilename` → strong,
  `productName` + `publisherContains` → strong, `nameStartsWith` +
  `publisherContains` → normal). `exclude` clauses veto the entry on any
  match. A **helper record** never matches any entry: an installer or
  documentation artifact, a launch or original file name that is a known host
  or helper (`update.exe`, `setup.exe`, `chrome_proxy.exe`,
  `msedgewebview2.exe`, any stem containing `setup`/`install`/`updat`/`svc`, a
  release file name such as `ProtonVPN_v4.2.1_x64.exe` that carries an
  architecture token and digits), or a name carrying a helper word (`update`,
  `helper`, `agent`, `service`, `webview2`, `bootstrapper`, `add-in`, `tunnel`,
  `proxy`, «деинсталлировать», «обновление», …; `sdk` is not one, because
  Google Cloud SDK and Android SDK are products). The granted confidence is
  capped by the match strength: a
  strong alias rides only on strong identity and is demoted to normal when
  only a name matched (a Start Menu shortcut before hydration).
  `knownAliasIndex.ts` keys entries by their exact values and by the first two
  characters of their prefix rules, so a record is tested against a handful
  of entries (cold resolution of 2000 records: 11 ms).
- `generatedAliases.ts` derives conservative aliases from the record itself:
  the versionless name (`stripTrailingVersion`: `PostgreSQL 17` →
  `postgresql`, `7-Zip` stays `7-Zip`); and, for non-helper records only, the
  product name (never an operating-system product name, never when the launch
  path or the `originalFilename` is an interpreter, Electron or browser host,
  because that metadata belongs to the host), the executable file name
  and stem of a real filesystem launch path and the stem without a
  `32`/`64`/`x86`/`x64` suffix (`obs64.exe` → `obs64`, `obs`; never a generic
  or host stem, never a numeric stem, never a `.lnk` basename or an AUMID),
  the name without a known vendor prefix when a single specific word remains
  (`Google Chrome` → `chrome`; `NVIDIA Control Panel` yields nothing) and, as
  **weak** aliases only, three-to-eight-letter single-script acronyms of a
  name with at least three words and no generic word (`World of Warcraft` →
  `wow`; `SQL Server Management Studio` yields none — `ssms` is curated). No
  derived value may be a semantic category word from `aliasPolicy.ts`
  (`FORBIDDEN_ALIAS_VALUES`: `vpn`, `ssh`, `scp`, `notes`, …) and no acronym
  may be a host stem (`cmd`, `py`). **`originalFilename` never creates an
  alias on its own**: it is host metadata for every Electron app and PWA
  (`electron.exe`, `chrome.exe`).
- `knownAppAliases.ts` is the curated dictionary assembled from the domain
  files under `search/dictionary/` (about 190 entries after the 19 September
  audit). Aliases name a product, never a category, format or vendor: the
  audit removed `torrent`, `vpn`, `консоль`, `магазин`, `обои`, `mail`,
  `почта`, `pdf`, `office`, `screenshot`, `антивирус`, `архиватор`, `mods`,
  `llm`, `ssh`, `scp`, `ftp`, `linux`, `security`, `музыка`, `телефон`,
  `notes`, `заметки`, `feedback`, `blizzard`, `anthropic`, `openai`,
  `logitech`, `rar`, `ppt`, `ps1`, `calc` / `writer` / `draw` / `impress` of
  LibreOffice, `ps`, `ai`, `tv`, `py`, `d4`, `pad` and the like. Windows tools
  match their Russian display names («Командная строка», «Диспетчер задач»,
  «Блокнот», «Ножницы»…) because a Russian Windows names them so. The registry
  is `rule → aliases`, never `alias → app`.
- `knownPackageIndex.ts` holds the **external known-package index** described
  under _Alias sources_ below: a generated, read-only corpus of about 7 800
  winget packages decoded into the same `KnownAppAliasEntry` shape with
  `source: 'external'`, loaded once at startup through a lazy chunk and
  merged into the reverse index behind a generation counter. `SearchFields`
  are rebuilt when the generation changes, and `useSearchIndex()` (the
  entity-level hook every search surface ranks through) re-runs the memoised
  ranking of an open view, so a query typed before the chunk arrived shows
  the external hits on its own — no extra keystroke, no reopen.
  `knownPackageIndexStatus()` reports `idle | loading | ready | failed`; a
  missing, malformed or differently versioned chunk installs an empty tier
  and search continues with the curated and generated aliases.
- `resolveSearchAliases.ts` merges the three sources in trust order. A curated
  match decides every value it names (`aliases` and `blockedAliases`); an
  external match may add values the curated entry did not decide, capped at
  **normal** — and at **weak** when the record was recognised by its name
  alone (`match.nameOnly`), until hydration brings the publisher that turns
  the match into `name + publisherContains`; generated values fill in last.
  Values equal to the name are dropped and the highest confidence wins when a
  value comes from two sources of the same tier.

## Alias sources

| Tier | Source                                                               | Highest confidence                                                   | Identity                                                                                                                                                                                                 | Owner                                                                                                  |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | curated dictionary (`search/dictionary/*.ts`)                        | strong                                                               | any clause, including `executable`, `packageFamily`, `steamAppId`                                                                                                                                        | hand-written, governed by `dictionaryGovernance.test.ts`                                               |
| 2    | external known-package index (`search/generated/knownPackages.json`) | normal (weak when shared by two or three packages, or by name alone) | `packageFamily`; `executable` + `publisherContains`; `name` + `publisherContains`; a `nameOnly` fallback that grants weak when a specific, corpus-unique name matches without any corroborating evidence | generated from a pinned `microsoft/winget-pkgs` snapshot, governed by `knownPackageGovernance.test.ts` |
| 3    | generated from the record (`generatedAliases.ts`)                    | normal (acronyms weak)                                               | the record itself                                                                                                                                                                                        | derived at resolve time                                                                                |

The external index is built offline by `scripts/search-aliases/` from the
manifests of [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs)
(MIT licence; only `PackageIdentifier`, `PackageName`, `Publisher`, `Moniker`,
`Commands`, `PackageFamilyName`, `NestedInstallerFiles`, `PortableCommandAlias`
and `AppsAndFeaturesEntries` are read — never tags, descriptions or URLs). The
application performs **no network access** for aliases: the corpus is a
compiled asset, pinned by `data/search-aliases/winget.lock.json` (`commit`,
`archive`, `generatorVersion`, `pinnedAt`) and stamped into the generated
module header. Manifests are untrusted build input: they are parsed by the
`yaml` dev dependency in its default safe mode (core schema, no custom tags,
no code), every field is read through a typed accessor that bounds string and
list length, nothing from a manifest is executed or used as a file path, and
`update-source` accepts only a full commit sha, downloads only from
`codeload.github.com/microsoft/winget-pkgs/…` and refuses redirects. Update
procedure, expected about quarterly or when a golden query names a package the
corpus lacks:

```bash
npm run aliases:update-source
```

downloads the current default-branch commit as a tarball into
`%LOCALAPPDATA%\kesvio-dev\winget-pkgs` (override with `KESVIO_ALIAS_CACHE`)
and rewrites the lock;

```bash
npm run aliases:generate
```

reads the pinned snapshot, keeps the newest version of every package, merges
locale and installer variants (`Mozilla.Firefox.en-US`, `Foo.Bar.MSI`) into one
canonical record, and merges a numeric or `LTS` identifier suffix into its
family only with evidence — the manifest version starts with the suffix
(`OpenJS.NodeJS.22` at 22.23.2, `Python.Python.3.12` at 3.12.10), or sibling
identifiers form a family while the display name does not carry the number
(`Vendor.Product.7` named "Product 7" at 2.0.0 stays its own product); a merged
version variant contributes no versioned name form or moniker, so Node.js owns
`corepack`, not `nodejs-4` … `nodejs-23`. Aliases come from the moniker, the
portable command aliases, the commands, alternate name forms and the
product-side identifier token, in that priority, and pass the policy in
`scripts/search-aliases/lib/policy.mjs`: one or two characters dropped; three
characters only when unique; semantic, generic, host, helper, installer-switch,
URL, path and other invalid-character values dropped; a value carried by more
than three packages dropped, by two or three demoted to weak; any value the
curated dictionary grants as strong, owns, or uses as an identity name
quarantined; an alias equal to the only name a record has dropped as useless;
at most ten aliases per record (the rest quarantined as `over_limit`). A record
ships only with corroborating identity (`packageFamily`, executable +
publisher or name + publisher) or a name that `isSafeSoloExternalName` accepts
— four or more characters with letters, not generic, category-only, helper,
host, high-risk (`setup`, `driver`, `beta`…), URL-like, curated or equal to the
publisher, and unique across the corpus — and only if at least one alias
survives; packages whose name ends in a helper word (`Google Update`, `Figma
Agent`) are not shipped. The run writes `knownPackages.json` (string table +
compact records), the typed wrapper `knownPackages.ts`,
`data/search-aliases/report.json` (counts, identity kinds, alias kinds, alias
distribution, drop reasons, collision histogram, size) and the git-ignored
`quarantine.json` (every dropped alias with its reason) and `provenance.json`
(every shipped alias with its package, kind and confidence);

```bash
npm run aliases:audit -- --baseline <previous knownPackages.json>
```

prints the size budget check (1 MiB gzip), the worst collisions, a suspicious
report (short values, weak collisions, version or architecture tokens,
installer terminology, consonant-only abbreviations, derived tokens, values
equal to the publisher — review, not failures) and the diff against a previous
index with the byte and percent delta, so a regenerated corpus is reviewed,
not merged blind. `--show <PackageIdentifier>` prints decoded records and
`--explain <alias>` answers "where did this alias come from" (package, kind,
confidence, match evidence). The generated files, `data/search-aliases/` and
the fixture corpus are excluded from Prettier and ESLint; anything hand-edited
there is overwritten by the next run.

The generator has its own tests under `tests/search-aliases/`: unit tests for
the policy (`normalizePublisherIdentity`, `isSafeSoloExternalName`,
`forbiddenReason`, `confidenceFor`), the records (`canonicalIdentifier`,
`isVersionFamilyMember`, `mergeVariants`, `nameForms`, candidate priority),
the manifest reader (safe parsing, anchors, folded scalars, unicode,
`__proto__`, field extraction, version selection) and the archive pinning, plus
a snapshot test over `tests/search-aliases/fixtures/manifests` (29 upstream
packages copied verbatim and four synthetic ones covering awkward YAML and
version families) whose recorded output `expected-index.json` is re-recorded
only with `KESVIO_ALIAS_FIXTURE_UPDATE=1` and reviewed as a diff.

Runtime cost of the external tier (`tests/perf/externalAliases.bench.ts` and
`scripts/search-aliases/measure-webview.mjs`, a developer-only CDP benchmark
against the dev app started with `--remote-debugging-port`): the lazy chunk is
1.16 MB raw / 343 KB gzip; in Node 22 `JSON.parse` + decode take about 19 ms
cold and 2.7 ms warm, the reverse index build about 2 ms, and a warm keystroke
over 2000 records stays at 0.9–1.4 ms. Inside the WebView2 of the running
application the index import starts right after the store exists, decodes
about 45–55 ms later and never blocks first paint (first paint 212 ms, decode
done 255 ms after navigation); the decoded entries plus the reverse index hold
5.6 MB and the raw module 2.7 MB after garbage collection, about 8 MB in all;
the first alias search builds the reverse index within 13–16 ms of the
keystroke; and keystroke-to-grid latency is unchanged with the tier installed or
removed (15 ms median, 30 ms for a full grid, no long task). That is the price
of resolving without a network and is bounded by the size budget in
`audit.mjs`.

External governance (`knownPackageGovernance.test.ts`) pins the snapshot
header, forbids any strong or non-normalised external alias, any forbidden,
generic, host, URL-like, path-like, switch-like or two-character value, any
external alias equal to a curated strong alias or a curated identity name, more
than ten aliases per record, more than three owners for one value and any
collision among normal aliases, allows only the identity clauses the runtime
model accepts, and resolves a deterministic 10 % holdout (FNV-1a of the package
id) as the record its installer would register — no strong outside the curated
dictionary, no semantic or host value, at least 90 % of the records that carry
an alias beyond their own name resolving one of them, every one that does not
being a helper record by name, and a name-only match never reaching normal. The
external golden corpus (`fixtures/externalAliasGoldenQueries.ts`, 123 queries
over `fixtures/catalogs/externalOnly.ts`, at least 80 of them values the
curated dictionary never had) must rank its app first with top-1 accuracy of
97 % or better, `externalAliasNegativeQueries.test.ts` proves that hosted,
helper, runtime, installer and sibling records never borrow a package's alias,
and `tests/frontend/features/command-palette/CommandPalette.test.tsx` proves
that a query typed before the index lands updates on its own once it does.

## Search gap triage

The alias engine is frozen for release: `SEARCH_SCORE`, the fuzzy and phrase
rules, the helper veto, the external cap at normal and the
`curated > external > generated` order change only for a reproduced real query,
never on suspicion. Nothing records user queries and nothing leaves the machine;
a developer investigates a report by hand:

```bash
npm run aliases:diagnose -- "vscode"
```

prints the query variants (layout-corrected and transliterated), the ranked
results with the total score from the real scorer and, per token, the field
that matched (exact name, name prefix, alias exact/prefix with its confidence,
source — curated entry id, external package or generated — and whether the
literal or a corrected variant hit). A miss prints `NO MATCH` with the variants
tried, the curated entries and external packages that carry the value and
which local records matched them, quarantine rows for the value, helper-vetoed
records that resemble the query, and the likely gap class.

```bash
npm run aliases:diagnose -- --app "Wub"
```

prints the identity facts of a local record (name, product name, publisher,
executable, original file name, package family, Steam id), its generated
aliases, every curated and external entry it matched with the strength, the
final aliases with confidence and source, and whether the helper veto applied
and why. Both commands read the live catalog cache
(`%APPDATA%\keskiyo.kesvio\apps-cache.json`, `KESVIO_ALIAS_AUDIT` or
`--catalog <file>`) and the shipped index; `npm run aliases:audit -- --explain
<alias>` answers the same question from the package side.

Every real failure is filed under one class:

| Class                      | Meaning                                                                                                     | Usual fix                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `MISSING_CURATED_ALIAS`    | the record is identified correctly but a popular name for it exists nowhere                                 | one curated alias with a golden and a negative row                                                  |
| `EXTERNAL_PACKAGE_MISSING` | the product is known but the pinned winget snapshot has no package for it                                   | wait for the next corpus update or add a curated entry if the query is common                       |
| `EXTERNAL_IDENTITY_FAILED` | the package and its alias exist but the local record did not corroborate the package                        | a publisher or executable normalisation rule with a fixture from the real record                    |
| `GENERATED_ALIAS_MISSING`  | software unknown to both dictionaries whose metadata allows a safe alias the generated tier does not derive | a rule in `generatedAliases.ts` proven by an invented-app row                                       |
| `HELPER_FALSE_VETO`        | a real product is treated as a helper                                                                       | a curated exception with a positive and a negative test; never a weaker global veto                 |
| `FALSE_POSITIVE_IDENTITY`  | a record received another product's aliases                                                                 | tighten the identity clause; the row pins the value the record must never own (`mustNotOwn`)        |
| `RANKING_ERROR`            | the right record is found but ranks too low in Ctrl+K or the picker                                         | only with a failing realistic test, an explanation of why identity cannot solve it, and a benchmark |
| `EXPECTED_BEHAVIOR`        | the query is generic or ambiguous, the software is not installed, or the ladder behaves as designed         | no change; document the row                                                                         |
| `UI_SEARCH_PRESENTATION`   | the engine ranks correctly but the main catalog shows matches grouped by category, so the hit is not on top | not an alias problem; Ctrl+K and the scenario picker show the global order                          |

The workflow for one report: save a minimal record as the scanner saw it and
the query as a row of `tests/frontend/entities/app/search/fixtures/realWorldGaps.ts`
(`query`, `catalog`, `expectedTop` or `mustNotOwn`, `classification`, `why`);
run `realWorldGaps.test.ts` and watch it fail; make the smallest change that
turns it green; run the sibling, negative, golden and holdout suites; re-run
`tests/perf/*.bench.ts` if the scorer or the index changed; regenerate the
index and review `aliases:audit --baseline` when the generator changed; keep
the row with a one-line `why`. The corpus already holds the cases found on the
first machine (`windows sdk`, `windowsupdateblocker`, `java` on a hosted jar,
a publisher-less `youtubedownloader`, a generic `agent`).

Findings of the release audit that were classified and deliberately left as
they are: short external publisher keys (`box`, `hp`, `arm`, 114 keys of three
characters or fewer) satisfy `publisherContains` by substring, which can only
matter when a local record also carries the identical name — no real case;
versioned name forms of uncollapsed families (`azul zulu jdk 17`,
`ares-commander-2024`, 477 aliases) are the products' own names or monikers
and equal the local name when it matters; 5 458 derived identifier tokens
(`visualstudiocode`, `adguardhome`) are exact-only and unique; "Geek
Uninstaller", "Advanced Installer", "Datadog Agent" and other products whose
name ends in a helper word are not shipped by the generator and get no
external aliases locally, but every one of them is still found by its own name
(`geek`, `advanced`, `datadog`).

## Curated dictionary governance

Dictionary governance (`tests/frontend/entities/app/search/dictionaryGovernance.test.ts`
fails the build on a violation):

1. An alias identifies a product or application; category words, file formats
   and vendor names are denylisted.
2. No keyboard-layout variants and no transliteration twins — the query
   normaliser produces them.
3. Every strong alias needs a clause that can yield a strong match.
4. Publisher-only, `originalFilename`-only and bare-prefix identity are
   forbidden; a supporting clause lives only inside an `allOf` with an identity
   clause.
5. Strong alias collisions are forbidden; a normal or weak collision must be
   listed in `KNOWN_ALIAS_COLLISIONS` with a reason (today: `powershell`,
   `mysql`, `nvidia`).
6. Every alias of three characters or fewer has a row in the golden query
   corpus (`fixtures/aliasGoldenQueries.ts`, 280+ queries over six synthetic
   catalogs: Windows EN/RU, developer, gaming, creative, helper-heavy); a strong
   alias must rank its app first, a weaker one within the top three.
7. Every new entry needs a positive row there and a negative row in
   `fixtures/aliasNegativeQueries.ts` (a host, helper, installer or sibling
   that must not own the alias); `knownAliasSiblingSafety.test.ts` holds the
   sibling matrix (Visual Studio / VS Code, Edge / WebView2, Chrome / PWA,
   Terminal / OpenConsole, Command Prompt / Git CMD, PowerShell / ISE, Steam,
   Battle.net, PostgreSQL / psql / pgAdmin / Stack Builder, MySQL, Photoshop,
   Java, Discord, Telegram, NVIDIA, Control Panel, Notepad, Paint, Word).
8. A live catalog can be audited with
   `KESVIO_ALIAS_AUDIT=<apps-cache.json> npx vitest run tests/audit` — it
   writes `.1localDocuments/perf/alias-audit-<stamp>.json` and lists records
   with many aliases, several matched entries, name-only identity or short
   aliases.

## Related documentation

- [Search](search.md)
- [Catalog](catalog.md)
- [Development and releases](development.md)
- [Troubleshooting](troubleshooting.md)
