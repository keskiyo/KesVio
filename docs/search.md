# Search

**Owns:** Query variants, searchable fields, ranking, category matches, view scopes, and shared search presentation.

**Read this when changing:**

- token normalization, layout conversion, or transliteration;
- ranking or fuzzy matching;
- category-aware search;
- search behavior across catalog views, Ctrl+K, or scenario pickers.

**Main code:**

- `src/entities/app/lib/search/`
- `src/shared/lib/searchQueryVariants.ts`
- `src/widgets/catalog-content/model/useCatalogView.ts`
- `src/features/command-palette/`

**Main tests:**

- `tests/frontend/entities/app/search/`
- `tests/frontend/features/command-palette/`
- `tests/perf/`

**Related:**

- [Search aliases](search-aliases.md)
- [Catalog](catalog.md)
- [UI and workflows](ui-and-workflows.md)
- [Troubleshooting](troubleshooting.md)

## Query variants

A query token expands into variants before matching: the literal token, the
token remapped between the English and Russian keyboard layouts, and a
Cyrillic-to-Latin transliteration. Ranking keeps the literal variant above the
rest, so a transliterated hit never displaces an exact one. Transliteration is
letter-for-letter and does not resolve loanwords whose spelling diverges. The
scenario launcher expands its query the same way and over the same helpers, so
finding a scenario costs no more layout awareness than finding an application.

## Ranking

Scoring (`search/scoring.ts`, constants in `SEARCH_SCORE`) keeps the literal
query variant above the layout-corrected and transliterated ones and orders
direct hits: exact name 100, name prefix with an exact strong alias 95, name
prefix 90, strong alias 88, normal alias 80, strong-alias prefix 76, name-word
prefix 70, normal-alias prefix 66, weak alias 58 (exact only), name/product
substring 50, publisher 30, secondary 10 (path, install location, version,
description — not `originalFilename`). A multi-word alias matches only as a
**phrase**: the whole query, in any single variant, equal to the alias or a
prefix of it (`vs code`, `vs co`, `pg admin`, `мы сщву`); its words never
satisfy tokens one by one, so `vs net` cannot be assembled from `vs code` and
`battle net`. Only single-word strong aliases of five characters or more join
the one-edit typo pool (`vscde` → `vscode`); normal aliases match exactly or
by prefix, weak aliases exactly. `cmd` (and `сьв`, which `queryTokenVariants`
remaps to it) ranks Command Prompt first, Git CMD below it because CMD is in
its name, and Windows Terminal answers to `wt`, `windows terminal` and
`terminal`; `OpenConsole.exe` is excluded from the Windows Terminal entry.

## Category matching

A query that names a category also returns the applications filed under it, after the entries matched by name. Catalog search and the scenario picker share the implementation so both surfaces answer the same query consistently.

## Search scopes and surfaces

Search stays inside the active view, and a query that also matches records
outside it reports those counts with a direct link to the owning view, rather
than leaving the matches invisible. Every catalog view answers this way, not
only the main one: the whole catalog, Favorites, Tools, Hidden and Installers &
docs are each a scope, and a view offers every scope except the one being read.
Searching inside Favorites therefore points back at the rest of the catalog
instead of ending at an empty grid. Each count equals what the destination will
show once opened, so the number never disagrees with the view it leads to.
Typing into search from Settings, More or Scenarios switches to the catalog.
Empty user categories are not rendered while a query is active. The command
palette opened with an empty query lists favorites first, then recently added
applications.

## Aliases

Built-in aliases are another searchable source. Their identity matching, confidence, external corpus, governance, and diagnosis workflow are owned by [Search aliases](search-aliases.md); ordinary ranking only consumes the resolved aliases and their confidence.

## Saved filters

A saved filter narrows the active catalog scope before the query is ranked. Criteria combine with the stored AND/OR contract, while text search remains an additional condition. Filter persistence and interaction behavior are documented in [IPC and data](ipc-and-data.md) and [UI and workflows](ui-and-workflows.md).

## Related documentation

- [Search aliases](search-aliases.md)
- [Catalog](catalog.md)
- [UI and workflows](ui-and-workflows.md)
- [Troubleshooting](troubleshooting.md)
