# Logbook navigation and global UI/UX — scoped redesign audit (2026-10-23)

**Status:** DISCOVERY + OWNER VIDEO REVIEW COMPLETE / DESIGN PROPOSAL UNDER REVIEW. No approved solution, implementation, browser acceptance, PR merge, production change or release.

## Frozen owner objective

Review **main menu, wayfinding and overall visual consistency of FlyTally Logbook** with the merged Logbook Agent Skills V1 and Apple Design V2. Work toward this goal in small milestones; DO NOT detour into unrelated bugs, flight-domain behavior, Training, database, migrations, auth, GPS/performance, infrastructure or other draft PRs. Unrelated findings may be recorded separately as deferred, never fixed incidentally. Preserve approved FlyTally identity, existing behavior and aviation evidence unless the owner explicitly approves a scoped change.

## Source authority and verified repository

- Repository: `filipto861/flytally-logbook`, canonical `main` full SHA `c68e6a2758423ab862cf9b03f5623515d07433e4` at discovery.
- PR #388 Agent Skills V1 merged into `f1052cac8d518342bfdf10c6f03b51199d78ad69`; PR #390 Apple Design V2 merged into the above `main` SHA. Loaded full `.agents/skills/README.md`, `apple-design/SKILL.md`, its entire 17-section `references/APPLE_DESIGN_PLAYBOOK.md`, `ui-ux-design`, `design-engineering`, `mobile-ipad`, `ui-quality-audit`, `testing-quality` skills from exact `main`.
- Existing separate Draft PRs #377 (U0 browser baseline), #378 (Flight tab focus), #379 (text legibility), #380 (narrow Flights categories) and #389 (skills docs checkpoint). DO NOT combine or rebase them into this effort without explicit scoped decision.
- Vercel project `filipito/logbook`: latest inspected READY production deployment `dpl_4XGBawGy187VyJpG5nyRFe2p2fKW` from Git SHA `34b865bb0ced1222945cecb107589826890ee31a`; this is not the latest docs-only `main`. Live authenticated UI/screenshot/browser verification NOT RUN.

## Current navigation inventory — code evidence, NOT visual observation

- `components/sidebar.tsx`: primary **Add flight** action `/flights/new`; core destinations Dashboard `/dashboard`, Flights `/flights`, Map `/map`, Statistics `/statistics`.
- “Pilot & records” group: Licences & recency `/credentials`, Aircraft & airports `/database`, Connections `/connections`, Print & data `/data`, Settings `/profile`. Admin role additionally sees Administration `/admin`; Sign out separately; notification bell in header.
- Flights remains the active parent for `/flights/*` and `/fstd`; active location uses `aria-current="page"`. Existing `tests/v300-navigation-hierarchy.test.ts` and `tests/v300-sidebar-polish.test.ts` freeze some intentional grouping decisions. Any regrouping requires explicit design review and adjusted tests, not an incidental rename.
- Desktop sidebar can collapse; preference uses `localStorage("logbook-sidebar")`. At `<=820px`, the header is fixed and nav opens as a scrollable left drawer with backdrop, Escape, focus trap and scroll lock. A coarse pointer at `>820px` can use a centered 44px edge handle. Do not assume emulated iPad behavior equals native Safari.
- `app/layout.tsx` imports many historical CSS layers, finally `app/ui-system.css`. Navigation selectors are also split between `app/globals.css`, `app/theme.css`, `components/sidebar.module.css`, `app/v300-u6-acceptance.css` and `app/ui-system.css`. Computed final styles, screenshots and responsive runtime remain UNVERIFIED.
- Existing `docs/design-language.md` describes frozen brand (colors, logo, typography direction), token spacing/card geometry, 24px SVG icon language; use current code/cascade over historic written assumptions.

## Focused design investigation (questions, NOT claimed defects)

1. **Wayfinding & IA:** Is it instantly clear where the user is and how to reach common destinations? Is “Pilot & records” the best grouping without altering domain workflow or existing task-oriented intent?
2. **Hierarchy & visual rhythm:** Do Add flight, current location, section headings and tertiary options have the correct visual weight across desktop/expanded/collapsed and narrow navigation?
3. **Cross-page consistency:** Inspect shared tokens, effective cascade, headers, cards, spacing, controls, states; identify only app-wide design differences that materially affect this redesign.
4. **Mobile/iPad usability:** Examine drawer width, discoverability, scrolling, focus return, safe areas and coarse-pointer edge handle with actual video/real browser; no assumptions from source alone.
5. **Feedback & access:** Keyboard/focus, touch target, disabled/loading/error states where directly linked to menu or shared chrome; reduced motion/contrast. Motion decision: **NONE by default**, switch to SIMPLE only if a demonstrable navigation clarity benefit.
6. **Adversarial content:** Long translated labels, very narrow 320px width, browser zoom, collapsed navigation, empty/notification count, multiple themes; synthetic only.

## Acceptance and DO NOT

- Audit output: observed vs source-inferred vs unverified finding, location, severity, affected component, minimal in-scope fix, test, deferred items; avoid a speculative redesign or shotgun refactor.
- Video and preferably matched screenshots are required before making claims about current visual or interaction defects. Owner video **REVIEWED** (observations below); still no automated browser/native Safari acceptance.
- Preserve current color/font/logo and operational semantics; no new libraries, gratuitous glass/blur/animation, auto-prefill/auto-apply, unrelated CSS cleanup, altered records or schema.
- No merge, deploy, production DB migration/restore/delete or feature flag change without explicit approval.
- Verification so far: GitHub source/files/branch/PR/skills read **PASS (inspection)**. Typecheck/Node/build/Playwright/native Safari/visual regression **NOT RUN**. Database/migrations/flags **UNKNOWN / NOT TOUCHED**. Production READY verified as historical deployment metadata only.

**ONE NEXT STEP:** Present this bounded video-derived design proposal to the owner, obtain explicit scope/IA approval, then inspect effective browser cascade and implement the first small UI slice only.


## Video review — 23 October 2026, 56.73 seconds (owner-provided, private)

**Observation limits:** Screen recording approx. 512x1112 encoded pixels at 30 fps. It shows **phone-sized dark-mode** navigation and screen browsing only, NOT desktop, iPad, light theme, keyboard focus, reduced motion, real accessibility tree, computed browser styles, network latency or production DB correctness. Frame capture was examined only within the current session; DO NOT commit images, audio, account names, emails, flight details, flight registrations or other personal/private values. Evidence below uses anonymized UI descriptions and approximate elapsed times. This is a qualitative visual audit, not a quantitative accessibility PASS.

### Visual / interaction evidence

| ID | Recording evidence | Evidence class | Interpretation | Scoped proposal / caution |
| --- | --- | --- | --- | --- |
| NAV-V01 | ~00:02 and ~00:48: left drawer exposes Add flight, four primary destinations, separate 'Pilot & records' group, administrative/exit actions; active destination has accent border/background | OBSERVED | Navigation exists and marks selected destination; no broken menu transition seen | Keep canonical Sidebar, active indication, labels, routes, overlay, safe-area/focus contract. Compare subtle active emphasis before altering. |
| NAV-V02 | ~00:48: 'Pilot & records' contains Licences & recency, Aircraft & airports, Connections, Print & data, Settings, with admin separate | OBSERVED | Group mixes credential, assets, network, export and preferences; cognitive grouping could be made clearer | Compare a **minimal regrouping** versus keeping current links. Never change destination paths/actions as a visual cleanup; existing `v300-navigation-hierarchy` tests encode current intent. |
| NAV-V03 | ~00:48 menu vs ~00:46 Connections in-page Find pilot: Add flight uses a restrained tinted outline while in-page primary CTA uses a saturated accent | OBSERVED | A hierarchy choice, not a broken control; principal global creation action has less salience | Review whether Add flight deserves clearer primary-action treatment, without making the drawer visually loud. Test contrast, focus and theme. |
| UI-V04 | ~00:24–00:28 Statistics: category filters, time range controls and local section tabs stack in multiple rows above metric cards/graphs | OBSERVED | Multiple navigation/filter layers make scanning and current context harder | Clarify hierarchy/spacing/labeling of **existing** controls; do not change statistical data or filtering semantics. Check actual content responsive layout before implementation. |
| UI-V05 | ~00:30–00:36 Licences & recency: Overview / Recency / Records, then more detailed local category tabs under Records | OBSERVED | Two navigation levels are visibly present and need distinct hierarchy | Harmonize global vs workspace vs in-card tab design; preserve existing status interpretation/evidence, never collapse regulated semantics for style. |
| UI-V06 | ~00:10–00:20 Flight detail: tab row, record workflow/status card, share action and read-only record details/track views; panels differ in density and CTA emphasis | OBSERVED | Recurrent badge/CTA/highlight density merits common hierarchy review | Unify surface/badge/CTA presentation only; flight certification, sharing, GPS suggestions and data remain out of scope. |
| UI-V07 | ~00:40–00:55 Aircraft, Connections, Print & data and Settings: persistent compact shell, cards/forms with different internal densities | OBSERVED | Strong existing global visual identity; not all content can or should have identical card structure | Review shared heading/type/spacing/primary-vs-secondary action contracts, not per-feature rewrite. |
| NAV-V08 | Header remains visible as pages change; notification bell and menu button appear consistently in the top chrome | OBSERVED | Existing successful behavior | Preserve shell layout and direct navigation. |
| NAV-S09 | Sidebar source provides Escape/focus cycling, backdrop, route-close, body scroll lock, preference persistence and coarse-pointer edge handle | SOURCE-INFERRED ONLY | Semantics wired in code, but video does **not** exercise keyboard, native iPad or measured focus behavior | Keep behavior unchanged until scoped browser tests can prove effects; do not claim runtime PASS. |

### Bounded design recommendation for owner review (NOT approved)

**Option A — preferred: incremental hierarchy and consistency pass** keeping existing IA and link URLs. Improve active/primary distinction, typography/spacing and global-vs-workspace tab hierarchy only if actual browser observation and existing tokens support it. **Option B — optional:** minimal separation of utility destinations within the current drawer, with explicit owner approval since changing labels/grouping touches frozen navigation tests and user habits. Neither option alters workflows or adds new dependencies.

**Suggested milestone sequence:**
1. **N1 Navigation visual hierarchy:** Owner chooses A vs B and exact grouping; then selected CSS/component changes only. Verify mobile drawer, desktop expanded/collapsed, coarse-pointer iPad, keyboard and themes. Motion decision: **NONE** unless a short reversible transition demonstrably aids orientation.
2. **N2 Global style contract:** Across representative routes inspect effective CSS cascade and align only shared headings, typography, panels, section gaps and CTA levels. No cross-product stylesheet rewrite.
3. **N3 Nested navigation pattern:** Shared/route-local tabs for Statistics and Licences & recency; improve scanability/level distinction while preserving filters and status logic.
4. **N4 Acceptance:** Candidate-selected source/browser tests, touch/accessibility/keyboard, 320/390, 768/1024, desktop light/dark, reduced motion and native Safari marked NOT RUN until genuinely exercised. No deployed changes without separate owner approval.

### Out-of-scope / deferred by owner instruction

No investigation or fix of aviation calculations, licensing validity, record content, GPS handling, aircraft profile fields, data migration, auth, notifications delivery, map engine behavior, currency/report content, unrelated visual-only page redesign, old Draft UX PRs or infrastructure. Observations on these screens are used solely to establish common visual patterns. 
