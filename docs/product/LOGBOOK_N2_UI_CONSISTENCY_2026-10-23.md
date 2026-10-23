# Logbook N2 — visual consistency of cards, typography and actions

**2026-10-23 — first slice N2-A implemented as isolated Draft preview candidate, NOT visually accepted or merged.**

## Source / dependency
- Repository: `filipto861/flytally-logbook`; canonical main `c68e6a2758423ab862cf9b03f5623515d07433e4`.
- **Stacked dependency:** N1 Draft PR #391 on `feat/logbook-n1a-modern-navigation-20261023`, at `acc32605348adae2e4363bcc0829e787cf0d55fe` when this N2 branch was cut. N2 must target that N1 branch first; do not merge N2 to main until N1 is independently accepted and merged. This work does NOT change PR #391.
- Branch `feat/logbook-n2a-surface-consistency-20261023`.
- Owner decision: N1 V2 light/dark adaptive sidebar, improved masthead positively reviewed; owner explicitly asked to proceed straight to N2. This is permission to develop N2 proposal/candidates, not merge/deploy/DB changes.
- Skills: Apple Design V2 full playbook (17 categories), ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit, testing-quality. Source code/actual final cascade outrank older audit docs.

## Intent
Visually connect N1's modern sidebar and protected page masthead to everyday informational surfaces through consistent semantic surfaces, border, card radius, padding, text hierarchy and contextual action affordance, while **not** flattening aviation-specific states, certified records, flight editing or dense data tables into uniform decorative cards.

### Before (source grounded, visually still unverified on N2)
- Main, Stats and Dashboard markup already share `.ui-page-stack`, `.panel`, `.metric`, `.table-panel` and `.section-heading`; final style layer `app/ui-system.css` is imported last.
- `globals.css` has older gradients/panel values, and `v150-ui-system.css` defines theme-aware semantic surface tokens and soft elevation. Legacy CSS includes special hero metric, dense tables and workflow/stateful cards.
- N1 added `shell-workspace` in protected shell and modernized only top-level page mastheads, **not** cards/tabs.
- Current owner screenshots only validate direction of N1 sidebar. Browser computed CSS of N2 is not yet observed.

### N2-A — FIRST PROPOSED/IMPLEMENTED VISUAL SLICE
- **Cards:** top-level `.panel` and `.table-panel`, primary `.metric-grid > .metric`, and direct Dashboard information widgets that are `.metric` or `.panel`, all under the protected `.shell-workspace`. Consistent existing `--surface`, `--line`, `--ui-radius-card`, restrained soft depth, mobile-aware metric padding. No arbitrary palette changes.
- **Information hierarchy:** metric labels/values/notes and first-level panel `.section-heading` titles/description align with N1 masthead (size, weight, readable contrast, spacing) without changing flight/statistics values or tab semantics. Numerics remain tabular.
- **Actions:** only primary content-linked Dashboard `a.panel` gets a discoverable hover/focus affordance, and direct section heading secondary actions gain 44px targets; not a global button rewrite or new behavior.
- **Exceptions preserved:** dashboard hero metric, click-vs-static semantics, flight detail certification/locked/draft states, map/image surfaces, aircraft manager, forms and destructive buttons, flight review cards, credential statuses, embedded control buttons and modal/dialog behavior. No wrappers or new component dependencies.
- **Responsive:** 320/390 phone, 768/1024 iPad Chrome emulation, desktop narrow/wide, light/dark/system, 200% zoom, print and reduced motion. Motion decision **NONE** (no new transition/animation).
- **Code:** only `app/ui-system.css` plus `tests/logbook-n2-surface-consistency.test.ts`, and preview launcher branch allowlist. No route/client/DB code touched.

## Why not style everything immediately?
- Global selectors for every `.panel` can affect nested forms, flight confirmation/review, accordion disclosure semantics and inaccessible scroll heights.
- Uniform cards may be less readable than purpose-built dense ledger/table layouts. N2 must optimize consistency **without** destroying cockpit scanability.
- Existing tests explicitly encode some legacy UI behavior; review and preserve. Do not change tests simply to hide a regression.
- Evaluate a real rendered candidate before widening N2 to additional groups.

## Next possible batches (NOT STARTED)
- **N2-B:** high-frequency form section chrome and action hierarchy, after auditing field semantics/real computed cascade and owner approval of N2-A screenshots. No form logic or autofill.
- **N2-C:** representative settings/aircraft/data panels only when stable N2-A and acceptance. Status/permission variants preserved.
- **N3 separate:** nested navigation/Statistics/Flights tab/filter hierarchy; no combined N2 scope.
- **N2-VERIFY:** candidate-bound tests and real browser screenshots, native Safari explicitly NOT RUN unless actually executed.

## Acceptance & evidence
1. N1 appearance, sidebar state and URLs are unchanged from N1 stacked base; N2 CSS applies only to protected information surfaces.
2. All Light/Dark and system theme controls reuse existing design tokens; labels/notes remain readable, links discoverable without relying on color alone, focus visible.
3. Existing metric data, page headings, flight status/certification, actions, forms, navigation and statistics calculations untouched.
4. No new dependencies, new brand palette, animation library, data migration, automated prefill or structural route refactor.
5. No horizontal overflow, clipping, unscrollable details, card overlap or illegible dense tables at 320/390/768/1024/desktop.
6. Owner sees the local N2-A preview and judges visual direction, BEFORE running full candidate risk-selected tests and discussing merge.
7. Source-only inspection is **not** a browser/test PASS. Mark Node/typecheck/build/Playwright/current screenshots as NOT RUN until genuine exact-SHA results are available.

**ONE NEXT STEP:** present N2-A preview on its stacked branch using the guarded disposable-local-Postgres script and gather Dashboard + Statistics Light/Dark screenshots. Then decide on N2-B scope or refine N2-A; neither N1 nor N2 is authorized to merge/deploy.
