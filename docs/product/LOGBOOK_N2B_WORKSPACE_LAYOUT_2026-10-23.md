# Logbook N2-B — Dashboard + Statistics workspace composition

**Status:** owner-authorized implementation candidate. **NOT browser-tested, NOT visually accepted, NOT merged/deployed.**

## Frozen chain and scope

- Canonical repository `filipto861/flytally-logbook`, `main=c68e6a2758423ab862cf9b03f5623515d07433e4`.
- N1 Draft PR #391 branch `feat/logbook-n1a-modern-navigation-20261023` -> main, SHA `acc32605348adae2e4363bcc0829e787cf0d55fe`.
- N2-A2 Draft PR #392 branch `feat/logbook-n2a-surface-consistency-20261023`, stacked on N1. Starting SHA for this branch `6ec4babde20f4914bfeffba206b6be9ac5ae4b46`.
- N2-B branch `feat/logbook-n2b-dashboard-statistics-layout-20261023` stacked on N2-A2 (do not target main until parents are independently reviewed and merged).
- Owner feedback: N2-A initial screenshots showed minimal difference; N2-A2 improved visible hierarchy but user wanted a greater redesign of actual screen structure. On 2026-10-23 owner explicitly approved moving to N2-B (“ok, dej se do toho”). This is permission for UI implementation, **not merge, deploy or production DB/flags**.

## Scenario and Apple Design

Pilot on desktop/iPad wants to identify total time quickly, inspect category totals, jump to needed work, and filter Statistics without hunting through three disconnected tab rows. The interaction must work for keyboard, mouse and touch with focus, horizontal scroll for long tabs, deterministic URL-driven selection and no silent data changes. Escape/cancel is native page navigation; no new gestures.

Apple Design V2 full 17-area playbook used with ui-ux-design, design-engineering, mobile-ipad, ui-quality-audit and testing-quality. **Motion decision: NONE.** Existing brand, theme tokens and components stay canonical. No new font, external library, gradient palette, icons or overlay behavior.

## N2-B implementation — meaningful structural change

### Dashboard

- `app/(protected)/dashboard/page.tsx`: group `dashboard-layout-grid` and any computed recency link inside `dashboard-main-column`; position unchanged `dashboard-quick-actions-panel` beside this column via new `dashboard-home-layout`. The widget iteration `visibleLayout.map(item=>...data-dashboard-size={item.size}...)` and `DashboardEditor layout={layout}` remain untouched.
- `app/ui-system.css`: wide desktop workspace is **main instruments + right-side utility rail** instead of serial full-width sections. Quick actions become separated list rows without another nested card border for each action. The existing **inner links only** remain clickable; no fake card-wide hit targets or new UI actions. At viewport <=1499px the workspace stacks naturally and quick links return to a space-efficient responsive grid.
- Avoid changing user-selected widget order, widget sizes or defaults; geometry inside existing `dashboard-layout-grid` remains controlled by existing `dashboard-customization.css`.

### Statistics

- `app/(protected)/statistics/page.tsx`: replace three disconnected first-level filter strips with ONE `statistics-explorer` section that groups Category, Period (hidden for Career as before) and Analysis, with explicit visible headings and retained names. Existing `categories`, `periods`, `sections`, `statisticsHref(...)` and input normalization remain unchanged. Three semantic `nav` landmarks keep distinct `aria-label` and active state links additionally carry `aria-current`.
- `app/ui-system.css`: wide viewport uses a three-column filter station; <=1499px two columns with Category full row, <=700px one column; each nav scrolls horizontally if long labels cannot fit. Touch targets >=44px in coarse pointer environments; keyboard focus visible. No automatically applied filter and no tab/button that changes its underlying destination.
- Overview metrics, current scope and monthly charts, Career and every other Statistics subsection retain their existing values, calculations and order. No recency validity changes.

## Hard boundaries / risk

DO NOT touch flight domain/validation, status/certification/locked records, Flights table, aircraft/airport records, maps, GPS, shared records, auth, DB, flags, Training, production or the user’s local ZIP files. No form auto-prefill; no unapproved action or navigation changes. Preserve all N1 and N2-A2 visual work.

N2-B's layout uses scoped selectors `.app-grid .shell-workspace`, so public and login views remain unchanged. `tooling/run-n1-preview-local.ps1` branch allowlist now permits exact N1/N2-A2/N2-B branches while retaining the local temporary PostgreSQL physical identity checks. Do not run the destructive fixture against an existing database.

## Verification and acceptance

- 25/25 GitHub **source-only** invariant checks PASS before documentation commit. Source checks are **NOT** Node test execution.
- `tests/logbook-n2b-workspace-layout.test.ts` is new, designed to guard structure, selection, responsive rules, style scope and the existing dashboard preferences/links.
- **NOT RUN** at candidate SHA: Node targeted tests, typecheck, build, project risk test planner, Playwright authenticated browser, actual computed style, mobile 320/390, iPad emulation 768/1024, keyboard/focus, contrast, forced colors, print output, native iOS Safari.
- Desktop acceptance: Dashboard main/utility rail clear with long labels and saved custom widget order; Stats all filters in one panel, URLs and active selections preserved; light/dark available, no clipping or horizontal page overflow.
- Mobile/iPad acceptance: neither right rail nor filter station blocks content; all pills reachable; no action obscured by sticky nav; keyboard focus and 200% zoom usable. Emulation is not a native Safari PASS.
- Production deployment last verified read-only READY `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` at `34b865bb0ced1222945cecb107589826890ee31a`, **not N2-B**; production runtime verification for N2-B N/A.

**ONE NEXT STEP:** owner checks N2-B via guarded local disposable-Postgres preview, sends Dashboard + Statistics screenshots in Light/Dark before any further N2-B visual expansion or release verification.
