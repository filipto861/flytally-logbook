# Flight Detail F3 — UI/UX audit, implementation and acceptance

Date: 2026-10-26. Repository: `filipto861/flytally-logbook`. Canonical baseline: `main@4aa4f2aba72c3ec71e9c0eeb83ee2b7ac8854e6c`.
Work branch: `feat/logbook-flight-detail-f3-20261026`. This document describes a **proposed unreleased candidate**, not production UX acceptance.

## Owner scope and sequencing
Owner approved complete implementation of the opened single-flight detail `/flights/[id]` after Flights F2.1; **skip independent AI review**; perform automated tests **only after** the complete implementation is written. No merge/deploy/production DB/schema/migrations/feature flags authorization. Training and `/flights` list are out of scope. GPS Save First for New Flight remains a separate pre-existing decision.

## Source audit (not observed in browser)
| Finding | Severity | Evidence | Candidate resolution |
| --- | --- | --- | --- |
| The identity header prioritizes registration/date; route is relegated to muted subtitle | UX major / CODE-INFERRED | `app/(protected)/flights/[id]/page.tsx` | Route as primary h1, record metadata and revision badge explicit |
| Five similarly sized Overview metrics compete with two exact pilot time values | UX major / CODE-INFERRED | Legacy `flight-summary detail-summary` | Independent two-column BLOCK/AIR cards, OFF/ON and TAKEOFF/LANDING pairs visible with labels; other data secondary |
| Missing or malformed source clocks render a plausible zero through existing SQL `ELSE 0` | Domain presentation / CODE-INFERRED | `lib/data/flights-fast.ts` and prior Overview | UI renders `—` unless both raw clock values are valid HH:mm; valid recorded zero remains distinct; **no calculation/storage/export changes** |
| FCL/crew/certification workflow visually competes with basic flight info | UX major / CODE-INFERRED | `components/flight-workflow-progress.tsx`, `app/v300-u4-flight-workflow.css` | Condense workflow and direct editing CTA, preserve all stages, safety states, correction, sharing, audit and signatures |
| Canceled unsaved tab switch moves keyboard focus to another, unselected tab | Accessibility major / CODE-INFERRED, older Draft PR #378 | `components/flight-detail-workspace.tsx` | Switch returns success boolean; focus only on accepted tab change; preserve original confirm and form |
| GPS missing state and expense/crew data can be visually subordinate | UX minor / CODE-INFERRED | Flight detail `gps`, expense panels | Preserve existing GPS review, attachment/actions and expenses; clarify no-track/secondary hierarchy without touching inference or authorizations |

**Evidence labels:** all observations above are based on verified GitHub source only. No initial authenticated live screenshots, computed CSS, native iPad/iPhone interaction or screen-reader run was available in this session. Prior owner iPhone F2.1 screenshot is a *different screen* and is not evidence for F3.

## Implementation boundaries
- Added `components/flight-detail-overview.tsx`, rendering precise recorded clock pairs with separate prominent BLOCK and AIR duration; zero is displayed only when both HH:mm values exist.
- Refocused route/registration/date/aircraft/role/evidence hierarchy in the existing server page. Existing Previous/Next/Back/More query-context navigation and record badges remain.
- Added `app/flight-detail-f3.css` as a **last-import scoped stylesheet** to avoid changing existing global themes, components or CSS cascade outside Flight Detail; responsive 320/360/390/700/768/900/1024/1440, print/forced-colors/coarse-pointer accommodations.
- Kept `FlightForm` with its current draft vs Save & certify behavior, protected `ReadonlyLogbookEntry`, GPS player/import, currency calculations, lock/correction, instructor/PIC signature, crew sharing and authorization paths unchanged.
- Client tab focus fix accepted locally instead of merging stale independent Draft #378. Reconcile that draft before any unrelated merge.
- Motion decision: **NONE**. No new dependency, brand asset, effect, inferred source, silent field prefill, SQL/DB schema, auth or automatic user data modification.

## Verification plan after implementation completion
1. Read-only source contract + changed-scope audit: `npm run scope:changed -- app/(protected)/flights/[id]/page.tsx components/flight-detail-overview.tsx components/flight-detail-workspace.tsx components/flight-workflow-progress.tsx app/flight-detail-f3.css app/layout.tsx tests/v354-ipad-flight-detail-ux.test.ts` (quote the parenthesized path in PowerShell), `npm run audit:design` (advisory), `npm run test:target -- tests/v354-ipad-flight-detail-ux.test.ts`.
2. `npm run verify:plan -- --base origin/main`, then `npm run verify:release:risk -- --base origin/main` on the exact final commit with Node 24 and physically verified locally owned disposable PostgreSQL as required by the risk planner. No remote DB tests.
3. Authenticated synthetic desktop/iPad/mobile Chromium check: 1440/1024/768/390/320px, light/dark, long route/registration, missing and genuine zero clocks, zero/multiple GPS tracks, zero/large cost, certified R1, correction R2, draft, role variation, locked and unavailable edit, crew verification, keyboard ArrowLeft/Right/Home/End, cancel unsaved tab change, focus visible, loading/duplicate submit, no horizontal overflow.
4. Real native Safari iPhone/iPad, VoiceOver, light/dark, keyboard safe area and touch remain `NOT RUN` until actual hardware evidence. Emulated Chromium is not a substitute.

## Release guards
- Targeted/risk/full/PG/browser/typecheck/build: **NOT RUN for this F3 candidate** until the implementation freeze.
- Browser-computed CSS, native Safari, user visual acceptance: **NOT RUN**.
- Production: latest *read-only* Vercel check on 26 Oct confirmed `fly-tally.com` READY `dpl_8ePTCJZrUZUeACo67WBwAuSsdzgi` from older F2.1 runtime SHA `1cca51c24325cb5dfe0bde3b0d595895e76a7987`, **not this F3 branch**. Production DB/flags currently UNKNOWN, no mutations attempted.
- No merge or deployment. One next step: execute the exact-head owner-local risk-selected test suite and review synthetic flight-detail screenshots, then request visual feedback before any release decision.
