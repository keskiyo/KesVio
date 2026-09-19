---
target: left sidebar navigation and saved filters
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
timestamp: 2026-09-19T17-21-43Z
slug: ebar-navigation-ui-appnavigation-appnavigation-tsx
---

# Sidebar navigation critique

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                                                                                           |
| --------- | ------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     |         3 | View state is clear, but a selected filter uses the same grammar and nested More pages lose their parent highlight. |
| 2         | Match System / Real World       |         3 | Labels and icons are familiar; a filter still reads like a destination instead of a modifier.                       |
| 3         | User Control and Freedom        |         3 | Filters toggle off and deletion confirms.                                                                           |
| 4         | Consistency and Standards       |         2 | View and filter both claim the current-page treatment; More does not remain current on child pages.                 |
| 5         | Error Prevention                |         3 | Delete confirms, but the destructive action is too prominent.                                                       |
| 6         | Recognition Rather Than Recall  |         2 | Long names truncate and full text depends on a native title.                                                        |
| 7         | Flexibility and Efficiency      |         2 | Keyboard basics work; saved filters lack compact edit/reorder controls.                                             |
| 8         | Aesthetic and Minimalist Design |         2 | Uniform boxed rows and a persistent red action create visual noise.                                                 |
| 9         | Error Recovery                  |         3 | Confirmation and undo messaging are clear.                                                                          |
| 10        | Help and Documentation          |         2 | Empty-state help exists, but the filter/view relationship is unexplained.                                           |
| **Total** |                                 | **25/40** | **Acceptable; hierarchy needs correction.**                                                                         |

## Design Specificity Verdict

The sidebar is partly authored for KesVio. Category accent rails, counts and reorder behavior are specific and useful. Saved filters feel attached afterward: they reuse a generic page row, have no supporting metadata, and make Delete their strongest secondary signal.

The automated detector returned zero findings for `AppNavigation.tsx`. That is useful evidence that the component avoids its mechanical anti-pattern rules, but it does not invalidate the semantic and hierarchy problems visible across imported child components. Source inspection also found 28–32 px icon controls and inconsistent accessible-current semantics that the target-only scan could not see.

## Overall Impression

Top-level navigation is calm and readable. The hierarchy deteriorates at Filters: a tiny heading, a destination-like active row, and an exposed red trash button make the section both visually weak and destructively loud. The biggest opportunity is to separate “where I am” from “what is applied.”

## What Works

- Saved filters appear before a potentially long category list.
- Full-row semantic buttons, focus styles and delete confirmation provide a solid interaction base.
- Category accents and count badges make the taxonomy fast to scan.

## Priority Issues

### [P1] Filters look like destinations

**Why it matters:** A filter can coexist with All Apps or Favorites, but both states use the same selected-row grammar and `aria-current`. Users cannot distinguish location from applied criteria.

**Fix:** Rename the section to `Saved filters`; keep the strongest fill and `aria-current` for page location; show an applied filter as a quieter pressed/preset state with a check or criteria/result summary.

**Suggested command:** `$impeccable distill`

### [P1] Delete dominates every filter row

**Why it matters:** In the narrow drawer the red trash button is permanently visible and becomes more prominent than the filter name.

**Fix:** Replace it with a neutral overflow action containing Edit and Delete. Keep red for the destructive menu item and confirmation only.

**Suggested command:** `$impeccable quieter`

### [P1] More loses parent location on child pages

**Why it matters:** Auxiliary tools, Scenarios, Hidden, Installers & Docs, Catalog Health and Backup & Restore are entered through More. Removing the More highlight breaks the location trail.

**Fix:** Treat the More landing page and all six destinations as one navigation subtree. Keep `More` current while any subtree view is active; keep Settings independent.

**Suggested command:** `$impeccable clarify`

### [P2] Large filter lists bury Categories

**Why it matters:** Up to 20 filters can push the taxonomy far below the fold in the shared scroll region.

**Fix:** Show 4–6 filters and a `Show all` control, or make the group collapsible with a visible count.

**Suggested command:** `$impeccable layout`

### [P2] Long names become anonymous ellipses

**Why it matters:** The icon, reserved action area and persistent delete button consume width; native `title` is weak for touch and keyboard discovery.

**Fix:** Provide a focusable full-name disclosure and a short criteria/result summary. Test 64-character Latin, Cyrillic, emoji and RTL names at minimum width.

**Suggested command:** `$impeccable harden`

## Persona Red Flags

**Alex (Power User):** No direct edit or reorder path for saved filters; 20 filters require linear scrolling; More child pages lose the parent navigation cue.

**Sam (Accessibility-Dependent):** View and active filter can both announce current-page semantics; 28–32 px icon actions are weak motor targets; tiny subtle uppercase section labels are difficult at low vision and zoom.

**Riley (Stress Tester):** Twenty long filter names can bury Categories and become indistinguishable; touch users cannot reliably inspect truncation; the fixed action background breaks the selected filter surface.

## Minor Observations

- `Filters` and `Categories` have identical headings and plus buttons despite different roles.
- The purple scrollbar is visually stronger than the section labels.
- Category rows communicate identity through accents and counts; saved filters rely only on a funnel icon.
- The detector's empty result is expected because most concerns live in imported children and cross-component semantics.

## Questions

- Is a saved filter a place or an applied reusable query?
- Why is Delete persistent while Edit is absent?
- Which 4–6 filters deserve immediate access when the user reaches the limit?
- Should the sidebar explicitly separate location state from applied-filter state?
