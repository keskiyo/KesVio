# UI and workflows

**Owns:** Stable interaction contracts for navigation, settings, More, dialogs, scenarios, saved filters, feedback, keyboard use, and accessibility.

**Read this when changing:**

- Settings, More, Catalog Health, or Backup & Restore;
- dialogs, focus restoration, confirmations, or the navigation drawer;
- scenarios, saved filters, command palette, or catalog utility views;
- keyboard, screen-reader, forced-colors, or responsive behavior.

**Main code:**

- `src/pages/`
- `src/widgets/`
- `src/features/`
- `src/shared/ui/` and `src/shared/hooks/`

**Main tests:**

- `tests/frontend/pages/`
- `tests/frontend/widgets/`
- `tests/frontend/features/`
- `tests/frontend/app/App.test.tsx`

**Related:**

- [Architecture](architecture.md)
- [IPC and data](ipc-and-data.md)
- [Search](search.md)
- [Desktop operations](desktop-operations.md)
- [Troubleshooting](troubleshooting.md)

## Scenario editor lists

A scenario's launch and close lists keep one row of tiles on screen and hold the
rest behind a count and a control that opens them. Which tiles fit is read from
where the browser actually placed them rather than calculated from widths, so
the count follows the window as it is resized and the row never wraps to a
second line while collapsed. The list itself never changes size — it always
fills its container — so `useTileRowLimit` observes every tile as well (a tile
taking its styles, an icon arriving, an entry added all move the break) and
keeps a measurement only when it says something new, so the observer cannot
drive a render loop. Every tile stays in the list and stays laid out
whatever is hidden — a reading taken from a list that had already been shortened
would only confirm the shorter list and take another tile away on each pass —
and the ones past the first row are clipped by height and removed from the focus
order rather than unmounted. The run dialog never collapses: it states what is
about to happen, so it may not hide half the answer.

## Catalog density and badges

Catalog tile geometry is owned entirely by the `--app-card-*` tokens in
`src/app/styles/index.css`, never by a size class on a card. `.app-card-grid`
lays out `repeat(auto-fill, var(--app-card-width))`, so the column count follows
the window at any tile size. Settings offers three presets — Comfortable,
Compact and Dense — and `App.tsx` stamps the choice as `data-density` on
`.app-shell`; each preset block redefines the whole token set rather than a
subset, because a partly-defined preset would inherit comfortable sizes and
overflow its own shorter card. Compact and Dense hide the version line through
`--app-card-version-display`, which keeps the element and its tooltip in the
tree. A passive lower-left badge identifies Steam, Battle.net, Microsoft Store
and portable entries; ordinary Windows entries have no badge. Steam games and
the trusted Valve Steam client use the Steam classification. Steam and
Battle.net use a gamepad mark, Microsoft Store uses a shopping-bag mark, and
portable entries use a USB-drive silhouette. Every glyph is monochrome white;
the tooltip retains the specific source identity. Badge artwork performs no
runtime network request. A
same-generation hydration patch carries the derived
platform when executable metadata identifies Battle.net after the initial
snapshot. The density setting keeps its copy beside the icon and aligns its
segmented control to the right on the row below.
`tests/frontend/styles/card-density.test.mjs` holds these geometry contracts.

## Artifact placement

Manual placement into Installers & Docs records the specific installer or documentation bucket. The category menu expands an in-place `ArtifactBranch` with two menu items, and keyboard traversal includes them in document order. Scanner-classified artifacts are not offered a manual move. Documents written before the split keep earlier placements in the installer bucket.

## Category presentation

A category carries an accent colour. The fifteen built-in rows each hold a
distinct hue, except System and Windows Features, which deliberately share one
muted tone to say the software there is not the user's own. A category the user
creates takes a free accent from the same palette and keeps it. The palette was
eight hues and repeated visibly once a machine held more than a handful of
categories, so it is fourteen now; a preference document written before the
palette widened keeps no accent of its own, and every category it holds is
redealt across the full range on first read. The accent is derived from the
category id rather than drawn at random, so the colour a category lands on
survives every later start.

## Catalog Health and Settings

Settings contains two open groups: General and Catalog. Catalog contains Application discovery and Catalog maintenance; unclassified records follow when present.

**Catalog Health** lives under More. Its summary owns the primary **Refresh catalog** action plus Applications, Sources, Last scan, and Duration. Catalog sources show a compact labelled list at narrow widths and a table at wider widths; Source details opens automatically when a source needs attention. Last scan owns added, updated, removed, duration, and optional technical detail without repeating the total application count.

The More preview and full page consume the shared health verdict. Source-state meaning, diagnostic ordering, retry behavior, and silent background deltas are owned by [Catalog](catalog.md#sources-and-scan-modes).

## First-run catalog state

Before the first scan the catalog shows what will be scanned, that nothing runs
automatically at startup, and that the data stays on the device, with the scan
action and a link to folder settings on the same card.

## Scenario picker

A scenario list is filled from a modal picker that searches the catalog and
switches on several applications at once, each row naming the category the
application sits in and carrying its switch on the right. The dialog is portalled
to `document.body` at a fixed size, so a transformed ancestor cannot become its
containing block and push it off the window. It states which list is being
filled — launch or close — and for which scenario, since both lists open the
same dialog. It offers exactly the applications the All apps
view shows: hidden records, installers and auxiliary tools stay out, while an
entry already stored in a scenario still resolves against the whole catalog so
it keeps its name and icon. If an older release changed an application's
preference identity during an update, the saved snapshot restores the entry by
exact name only when the current catalog has one unambiguous match. Candidates
are ordered by name, case-insensitively
and with digits compared as numbers, until a query replaces that order with
relevance ranking; a query that names a category also brings in the applications
of that category, after the entries the query matched by name. Rows arrive a
batch at a time — revealed by scrolling to the end of the list or by a control
that names how many are left — and skip layout and paint off-screen through the
same `content-visibility` mechanism the catalog cards use; the footer counts the
whole result set, not the rendered batch.
Applications the list
already holds are not offered, and an application held by the opposite list of
the same scenario is shown locked with the reason rather than accepted and
rejected afterwards. Confirming adds the whole set in one step; every close
target that carries a risk warning still costs its own separate confirmation,
and declining one leaves the rest of the set intact. Deleting a scenario is
confirmed in its own dialog, since the delete control sits beside rename and the
configuration it removes cannot be recovered.

## Destructive confirmations and focus

Every destructive confirmation — delete category, delete scenario, delete a
saved filter, remove an additional scan folder, or remove an excluded folder —
is the one `shared/ui/ConfirmDialog`: same layout, same wording positions, same
Cancel and named danger action, painted from tokens and portalled to
`document.body`. It dismisses only through Cancel or its close control: neither
Escape nor a click on the backdrop discards it, so a confirmation cannot be lost
to a stray keystroke while it is being read. Cancel takes focus on open, which
keeps the keyboard exit one keystroke away, and focus returns to the control that
opened the dialog. Optional detail renders
in a block between the description and the actions.

Returning focus is not specific to confirmations: every dialog hands it back to
the control that opened it, so closing one never drops the keyboard at the top
of the catalog. The application information dialog goes through the same shared
modal lifecycle as the rest, and a regression test opens it from a control and
asserts the control has focus again after it closes. The navigation drawer restores focus to its
menu button explicitly, because the burger outlives the panel.

The catalog scroll root reserves its vertical scrollbar gutter. The shared
modal lifecycle can therefore lock that root for any drawer or dialog without
changing the width of the obscured page underneath it.

## More and catalog utility pages

The More page ("Catalog views and tools.") holds six cards in two columns:
Auxiliary tools, Scenarios, Hidden and Installers & Docs with their counts and
recently-added previews, then Catalog Health and Backup & Restore, which carry
no count and no preview — a card without a count renders no badge and its
accessible name is the label alone. The Catalog Health card's second line is
the catalog verdict from `assessCatalogHealth`; the Backup & Restore card names
its three actions. The sidebar keeps **More** current on the landing page and on
every destination owned by it, preserving the user's parent location. Both open
pages that render no catalog: `catalog_health` and
`backup_restore` sit in `NON_CATALOG_VIEWS` beside `settings`, `more` and
`scenarios`, so `isCatalogView` keeps them out of the grid, the search scope,
saved-filter application and icon hydration, and their **Back to More** header
returns to More. Neither has a sidebar entry. The **Recently added** section
stays a separate block below the grid. The More page previews every scenario
while they all fit its card and spends the last slot on a "View all" row only
once a scenario is left out of the preview.

The Backup & Restore page states the preferences included in the JSON file,
then separates **Create backup** from **Recover settings**. Recovery groups a
validated file import with the rotating local copy. Local recovery reports
only **Available** or **Not available yet** by parsing the existing backup slot
with the normal preferences reader; it stores no timestamp or extra metadata.

The three catalog views reached from More share `CatalogViewHeader` (back
button, icon, title, count and an optional one-line description) and, when they
have nothing to show, `ViewEmptyState` (icon, title, sentence and a second
**Back to More** button; a fruitless search gets the `SearchX` variant without
the button). All three render `AppRow`, whose surface is neutral at rest —
token border, panel background, neutral icon ring, menu button at reduced
opacity — and takes the accent border only on hover, focus-within or while its
menu is open, so seventy rows do not read as seventy violet outlines.
**Auxiliary tools**, **Hidden** and **Installers & Docs** keep the dense
one-to-three column grid of `AppRow` cards; Installers & Docs splits into
**Installers** and **Documentation** sections whose headings carry an icon, a
rule and the count, and each artifact row shows its middle-ellipsed path as a
tertiary line. A hidden card's menu offers _App info_ and _Restore to catalog_
and nothing that hides or uninstalls. "Nothing is hidden" replaces the grid when it is empty. A
menu opened from a trigger in the right half of the window
hangs from the trigger's right edge (`floatingMenuPosition`), so a row's ⋮
never gets a panel floating off to its side. An artifact row's menu replaces
_Uninstall_ — which Windows cannot do for a file that was never installed —
with **Open folder**, the same `openAppFolder` command the App info dialog
uses, so the installer can be run or deleted by hand from where it lies; a
failure is reported as a toast without the path.

## Scenario launcher

The scenario launcher is a root-level dialog rather than a page detail, reachable
with Ctrl+Shift+K from any view and from that "View all" row. A shortcut nothing
names is a shortcut nobody presses, so the two places that already hold scenarios
name it: the Scenarios page above its list, and the Favorites view beside starred
scenarios, which is the only one of the two a user reaches without going looking
for scenarios in the first place. Neither hint renders when there is no scenario
to run. It searches by
scenario name and by the apps a scenario holds, so an entry the catalog no longer
resolves stays findable by the name stored with it. Filters cover favorites and
scenarios that have run; ordering is by last run, name or creation date, either
way round, and a query orders by relevance instead. The direction control is a
real toggle rather than an arrow that only depicts one: each sort has a natural
order and the toggle reverses it, which is the one rule that reads the same for
a date and for a name. Filters and ordering share one row at the supported
minimum window width, which is what bounds how many filters this bar can hold; a
scenario whose apps no longer resolve is reported on its own row instead, as a
count beside its list sizes.
Arrow keys move between the run buttons so Enter runs the scenario that has
focus, and typing while a row is focused returns to the search field.

## Application information

The application information dialog presents discovery source, effective placement, launch-target status, and the evidence exposed by the classifier. The meaning and precedence of that evidence belong to [Classification](classification.md#explainable-decisions).

## Saved catalog filters

Preferences schema 21 adds `savedFilters`; existing documents upgrade with an empty
list and retain unknown data. Up to 20 named filters store
source, publisher, target availability and added-within criteria, never catalog
IDs or executable expressions. Fields combine with AND; values within a field
combine with OR. Empty criteria preserve the existing view scope. Search remains
an additional condition; hidden apps and artifacts follow the selected view.

A source is where a record was discovered, with one deliberate widening: the
`steam` source also matches a record whose derived `platformKind` is `steam`,
so the Steam client (a Start Menu shortcut) lands in the same filter as the
games of its library; the editor labels the choice `Steam (client and library
games)` and explains what a source is. Saved filters sit above the categories
in the navigation as lightweight pressed presets rather than page destinations.
The first six stay visible and the rest sit behind **Show all**, so a long filter
list does not bury the category list.

Selecting a saved filter opens **All Apps** and closes the navigation drawer; the
header chip edits or clears the active filter. Sidebar and editor deletion both
use the shared confirmation dialog, while the editor exposes a labelled
**Delete** action. Create, edit and delete are undoable. A failed storage write
restores the previous filter state; failed saves leave the editor open. The active
selection is session-only. Filters recompute from live catalog records without scanning.
Date filters use a one-minute clock only on an active catalog screen, with timer
cleanup on navigation and unmount. Unknown or future first-seen dates do not
match a date window. Unknown source and availability values from backups are
ignored by normalization.

## Effective classification and drive placement

App info distinguishes detected installers/documentation, user artifact placement,
user promotion and drive-root grouping. Missing visibility evidence is explicitly
reported as unavailable. Manual category overrides that change the detected
category expose `user=category` in the derived display reasons; raw catalog
records and persisted formats are unchanged. An override equal to the detected
category preserves the original record identity and detector reasons.

The `categorizedApps.ts` entity model owns effective category derivation;
`catalogSelectors.ts` owns visibility, counts and recent/search selections.
Drive-root grouping has priority over manual category and artifact marks.
The action menu explains this constraint and omits category moves for those
records. `moveApp` independently rejects those moves before creating a preference
transaction, covering drag/drop and other callers. Hide remains available.

## Scenario close policy

Preferences schema 22 adds optional scenario `forceClose`. New scenarios store
false. Older scenarios with no field retain their previous force-after-five-seconds
behavior; the editor visibly checks the force option and warns about unsaved work.
Malformed present values normalize to false. Explicit values survive import,
export and restart. Policy changes are undoable and restore the prior state when
storage fails. Editing is disabled while a scenario is running.

The runner maps `forceClose ?? true` to `close_apps`' optional `allowForce` boolean;
the client and backend default a missing IPC argument to false. Catalog-id
resolution, protected-target checks and batch limits are unchanged. Graceful mode
never reaches the termination stage or termination implementation; after the wait
it enumerates matching processes and reports closed, idle or failed targets.
Force mode retains the existing process identity checks and bounded termination
rechecks. Progress events retain their payload; waiting text applies to either
policy. There is no new cancellation API, results screen or execution preview.

Manual verification still required in an isolated Windows profile: accepting and
refusing WM_CLOSE, unsaved-document prompts, both policy settings, forced close,
protected target refusal and restart of migrated scenarios. Automated fixture
checks do not prove native application cooperation or cancellation support.

## Scenario import

Scenarios travel only with the full settings backup under **More → Backup & Restore**. There is no selective scenario-import surface.

## Keyboard, screen reader and forced colors

The interface is English only and has no i18n layer. Copy that the tray shows
and the documentation names is pinned by a test (`the_tray_copy_is_pinned`:
`Open KesVio`, `Search`, `Favorite apps`, `Show all favorites…`, `Scenarios`,
`Force scan`, `Scanning…`, `Quit`); the frontend equivalents (`Refresh catalog`,
`Force full scan`, `Scan for apps`, `Quick launch`, `New
filter`, `Preview redacted log`, `Export log as XML`)
are pinned by the tests of the screens that render them.

Modal layering: every dialog, the navigation drawer included, is
`role="dialog" aria-modal="true"` and runs through `useModalDialog` (initial
focus, focus trap, Escape, focus restoration, scroll lock). Only the **topmost**
modal — the last `aria-modal` element in document order, which is the last one
opened because dialogs portal to `body` — traps Tab or answers Escape
(`shared/lib/modalLayering.ts`), so a filter editor opened over the drawer keeps
Shift+Tab inside itself and one Escape closes only the editor, returning focus
to the drawer's **New filter** button. In the sidebar, **Enter** opens a
category and **Space** picks it up for keyboard reordering (arrow keys move,
Space or Enter drops, Escape cancels); dnd-kit's default, where Enter also
picked the row up, left keyboard users unable to open a category. Decorative
lucide icons carry `aria-hidden="true"`; a source-tree test refuses an icon
rendered without `aria-hidden`, `aria-label` or a role. The redacted
diagnostics preview is a named, focusable `region` so it can be scrolled from
the keyboard and announced by name.

Forced colors (Windows High Contrast): focus rings are outlines, which the
platform repaints in its own colours; text inputs that set `outline-none`
receive an explicit `Highlight` outline under `forced-colors: active`, and the
toggle switch draws its track border and knob in `ButtonText`/`Highlight` so
its state remains visible without colour. Reduced motion is honoured through
`motion.css`. None of this is a WCAG conformance claim: unit tests prove roles,
names, focus order and keyboard paths in jsdom; Narrator, forced colours,
100/150/200 % scaling, the minimum window and long names are checked by hand
as part of the manual accessibility matrix.

## Related documentation

- [Architecture](architecture.md)
- [IPC and data](ipc-and-data.md)
- [Search](search.md)
- [Desktop operations](desktop-operations.md)
- [Troubleshooting](troubleshooting.md)
