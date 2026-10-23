# FlyTally Logbook — N1 Modern Navigation & Shell: design proposal

**Date:** 2026-10-23  
**Status:** OWNER APPROVED design direction on 2026-10-23; N1-A implementation candidate staged on independent feature branch. **Not browser-tested, merged or deployed.**  
**Canonical source:** `filipto861/flytally-logbook` main `c68e6a2758423ab862cf9b03f5623515d07433e4`; current docs-only branch `docs/logbook-navigation-design-audit-20261023`.  
**Supporting audit:** [LOGBOOK_NAVIGATION_UI_AUDIT_2026-10-23.md](LOGBOOK_NAVIGATION_UI_AUDIT_2026-10-23.md) — code audit plus qualitative owner-provided mobile/dark screen recording. Do NOT commit that private recording or frames.

## 1. Frozen objective

Deliver an **obviously more modern, restrained, premium, Apple-influenced** FlyTally Logbook navigation and global shell, not a new brand or a competing visual system. Priorities: cockpit/iPad legibility, instant wayfinding, clean hierarchy, clear primary action, predictable touch/keyboard interaction and accessible light/dark presentation.

**Hard in-scope:** global sidebar/drawer, mobile top bar, collapsed desktop rail, notification-bell chrome *styling only*, Add flight CTA, navigation hierarchy/active/hover/focus states, limited adjacent shell spacing when required.  
**Out-of-scope:** navigation routes/group membership, page-internal tabs, page/card/form redesign (N2/N3), alert delivery, actual notifications logic, aviation workflows, data/status semantics, GPS/map runtime, auth, schema/DB, training, deploy, unrelated bugs and cleanup. Distinguish design from feature change.

**Design approach:** “Modern Aviation Utility” — dark navy/neutral app surfaces, restrained emerald primary action, blue/green brand accents where they already exist, quieter secondary navigation, near-flat materials, consistent glyphs, spacious but efficient rhythm. A premium feel should come from precision rather than glassmorphism.

## 2. Source-grounded existing behavior to preserve

- `components/sidebar.tsx`: Add flight /flights/new; primary Dashboard, Flights, Map, Statistics; secondary “Pilot & records” Licences & recency, Aircraft & airports, Connections, Print & data, Settings; Administration for admin; Sign out; notification bell. **Keep exact labels/order/routes/grouping for N1.**
- Flights parent active for `/flights/*` and `/fstd`; `aria-current="page"`; notification/attention count semantics. Keep.
- Sidebar desktop expanded 248px, collapsed about 78px in early CSS (later rules may override); collapsed choice `localStorage("logbook-sidebar")`; `<=820px` fixed header and drawer, Escape, tab trapping, focus return, body scroll lock, overlay close and route close. At `>820px` with coarse pointer, dedicated iPad edge toggle. Preserve behavior and breakpoint; verify **computed** widths, not just declarations.
- CSS import chain in `app/layout.tsx`: globals + theme/versioned layers + last `app/ui-system.css`. Module styles in `components/sidebar.module.css`. **Never assume changing an early CSS declaration changes effective style.**
- Existing [design language](../design-language.md): 4/8/12/16/20/24/32/40 spacing, 11px controls, 17px cards (do not impose card radius on rail), 20px-ish existing line SVG, current typography stack, dark/light semantic colors, reduced-motion/focus baselines. No brand retokenization.
- Existing tests `tests/v300-navigation-hierarchy.test.ts`, `tests/v300-sidebar-polish.test.ts`, `tests/v355-ipad-sidebar-toggle.test.ts`, `tests/v320-ui-consistency.test.ts` encode parts of this contract.

## 3. Visual design specification — proposed, not yet runtime verified

### 3.1 Desktop expanded sidebar

**Structure:** existing logo + “FlyTally / LOGBOOK” at top; notification bell remains header utility. A clearly distinguished Add flight CTA follows. Existing four primary destinations read as one scan-friendly group; one quiet separator; “Pilot & records” group remains subordinate; Admin and Sign out remain segregated as existing.

**Geometry:**
- Preserve current expanded/collapsed rail widths and desktop/mobile breakpoint. Target navigation row height **44px** wherever space allows (currently desktop ~40px), with ~20px existing SVG icons and 12px-ish icon/label gap. Avoid unbounded density growth in 768px-high desktop; allow scrolling as already supported.
- Padding and row gaps use existing spacing tokens. Typical surface radius **11px (control)**; no unapproved giant rounded cards, side rail stays structurally flush.
- Align nav labels, icons, badge and CTA along one shared start axis in both themes. Decorative headings should not compete with destinations.

**Visual priority (highest to lowest):**
1. **Add flight** — a true *single prominent primary* CTA, solid semantic accent treatment rather than today's subtle accent-tinted outline. On light background use the **stronger** accessible green token for fill/text contrast rather than white on `--accent` by assumption; on dark, use brand accent and an appropriately contrasting dark foreground. Validate contrast with actual computed colors.
2. **Active destination** — clear but quiet persistent state: slightly elevated/toned surface + narrow accent rail/edge and semibold label. Reduce duplicated gradient/shadow/border emphasis from legacy CSS only after final-cascade evidence; do not make active item visually compete with Add flight.
3. **Normal destination** — legible, calm neutral text/icons; hover and focus add readable feedback, not scale/bounce.
4. **Section title / secondary destinations** — visible and scannable, not so faint that users cannot discover Settings or Print & data. Prefer font/weight/spacing hierarchy over reducing contrast.
5. **Sign out / Admin** — correctly separated, lower visual priority unless focus/hover.

**Collapsing behavior:** icon rail retains current storage semantics; logo/bell/toggle do not overlap; icon-only destinations maintain accessible name and a discoverable title or focus cue. Keep same active semantics and group ordering; avoid animating width before measured keyboard/focus tests.

### 3.2 Mobile header and drawer

- Retain existing compact fixed top chrome (currently CSS sets a 58px shell plus safe-area inset), brand on left and notification bell + 44px menu control on right. Align baselines, control sizes and gaps; do not create a competing second action in the header.
- Drawer remains **left anchored**, same source button, overlay outside, scrollable nav including sign out, same `<=820px` breakpoint and safe-area behavior. Existing CSS establishes width up to `min(340px,88vw)`; inspect final actual width on 320/390px.
- N1 visually polishes the panel with one coherent surface/elevation, consistent row height at least 44px, quiet group separator and strong Add flight CTA. Avoid double framing and multiple colorful pills.
- Keep tap-to-open, tap-outside-to-close, Escape, Tab cycling, focus return, route-change close, body scroll lock, no hidden inaccessible route controls. Long labels must not clip at 320px/browser zoom.
- **Motion policy:** SIMPLE only if implementation can preserve mountedness, pointer cancellation and focus behavior. Target a subtle ~140–180ms drawer enter/exit (small horizontal shift or fade), not momentum physics, not bounce or heavy blur. If correct exit/interruptible behavior needs a larger refactor, choose **NONE** rather than broad code changes. `prefers-reduced-motion` gets immediate/static feedback. No animation library.

### 3.3 Light/dark theme

- Keep FlyTally dark navy and light off-white surfaces, green and blue existing brand accents, current font/brand logo.
- Semantic tokens only, no novel theme palette. Prefer legible `--text` / `--text-soft` for navigation and stronger contrast for compact text; no unverified translucent glass over aircraft images.
- Motion, focus and active UI must communicate state beyond color alone (label weight/rail/position). Check forced-colors and text zoom.

## 4. Interaction contracts

| Scenario | Trigger / expected response | Preserve / test |
| --- | --- | --- |
| Go to page | Activating destination navigates immediately; current link remains marked | routes, accessible name, `aria-current`, hover/focus |
| Add flight | Persistent high-salience CTA takes user to existing New Flight | /flights/new, no auto-prefill or new Quick Add |
| Open mobile nav | Menu button opens drawer, establishes focus inside, blocks background scroll | existing toggle/ARIA/focus semantics |
| Close drawer | Menu button, backdrop, Escape or destination; focus restores when appropriate | source focus + close logic; no inert overlay |
| Collapse desktop | Toggle shrinks/expands existing rail; saved preference respected | no change to localStorage key |
| Touch iPad | Existing pointer-coarse edge toggle accessible; menu items >=44px targets | no false claim of native Safari from Chromium |
| Notifications | Bell opens same existing inbox, same count meaning; only chrome aesthetics may change | no changes to notification state/delivery |
| Reduced motion | State still evident without movement | CSS media preferences and no hidden focus |

## 5. Candidate files and guarded implementation batches

**Batch N1-A (minimum visual):** `components/sidebar.module.css` + only necessary localized selectors in `app/globals.css` or `app/ui-system.css` / `app/theme.css` after computing final cascade; `components/sidebar.tsx` only when precise markup/accessible names require it. Keep `app/(protected)/layout.tsx` and business/API code unchanged. Target: CTA, row rhythm, active/inactive/group hierarchy, theme.

**Batch N1-B (only after N1-A visually accepted):** mobile header/drawer polish and optional SIMPLE transition, preserve focus/scroll/escape and collapsed/iPad behavior. May still be CSS-only. No new dependency. Do not add a new top nav component or redesign page content.

**Batch N1-C (verification/close):** focused tests and screenshots for nav states, accessibility/focus, light/dark, 320/390 mobile, 768/1024 iPad Chrome touch emulation, desktop expanded/collapsed, reduced motion and long labels. Separate native Safari **NOT RUN** unless actually inspected. Update current roadmap/change log/project memory strictly for implemented results, not an anticipated feature.

**Do not broaden the scope because a nearby stylesheet contains unrelated issues.** Old UX PRs #377–#380/#389 stay independent.

## 6. Proposed acceptance criteria

1. All existing navigation destinations, order, labels, routes, active/badge logic and roles remain unchanged; none lost at narrow widths.
2. Add flight reads as the primary action on mobile open drawer and desktop expanded/collapsed (icon+accessible label when collapsed). Only one globally dominant accent action in the menu.
3. Active page can be distinguished independent of color; clear keyboard focus; navigation typography and contrast readable in both themes (WCAG AA target for normal text).
4. Desktop sidebar and iPad edge toggle never cover content; header/drawer respects safe-area/scroll; 320px and 390px screens have no unintended root horizontal scroll or truncated functional item.
5. Mobile drawer close/open and Escape/focus handling are preserved, including repeated quick toggles and route navigation. Reduced-motion variant works.
6. Animations are either NONE or SIMPLE, purposeful and interruptible; no dependencies, heavy glassmorphism or layout performance regression.
7. No changes to flights, certification, data model, database, auth, notifications logic, Training or deployment configuration; targeted regression set remains green on **exact future implementation SHA**.
8. Compare captured before/after against the same routes/states and explain actual changes; do not call static source checks visual PASS.

## 7. Evidence and approval boundary

**Currently verified:** Main SHA, active docs branch, source file layout, current routing, CSS import sequence, existing design-language contract, test filenames, full relevant Logbook skills including Apple Design V2 17-domain playbook, and qualitative owner phone/dark recording.

**Not yet verified:** exact computed CSS in browser, current authenticated desktop/iPad/light screenshots, real Safari accessibility/gesture behavior, final candidate tests, actual design implementation.

**Owner decision:** Explicitly approved **Modern Aviation Utility** visual direction and preservation of current menu structure/labels/routes on 2026-10-23. This authorizes a narrowly scoped N1-A implementation *candidate* for review, **NOT merge, deploy, production DB or feature flags**. If desired, request independent read-only DeepSeek review of this frozen design before implementation, with exact main SHA and DO/DO NOT constraints.

**ONE NEXT STEP:** Verify N1-A candidate against browser-computed CSS, mobile/desktop light/dark screenshots and targeted tests, then owner reviews the visual result before merging or starting N1-B.
