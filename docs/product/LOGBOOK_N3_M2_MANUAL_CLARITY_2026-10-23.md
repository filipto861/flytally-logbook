# N3-M2 — Manual New Flight clarity (Variant A)

**Status:** implemented as an intentionally small **Draft PR #399** on work branch `feat/logbook-n3-m2-manual-clarity-20261023`; **owner approved M2 implementation scope** after N3-M1 visual audit, **not** merge/deploy. **Full browser/Node/build/PostgreSQL execution NOT RUN** for this new implementation SHA.
**Parent:** stacked Draft #398 `feat/logbook-n3-m1-entry-review-20261023@45a1cbdcbd68cda0fe6c2ea58d1d9a92a58f7900` (under Draft #397 docs); canonical `main@3af54d4f4d0651b430452dd3f5b8513e134f5c6a` unchanged at kickoff.
**Implementation source commit:** `3c4cecfddce5ef12535bbdcf6ea60d11d7d4c52e`, document follow-up commit must not inherit execution evidence.

## What changed (and why)

Original New Manual Flight kept Date/Aircraft/Role (and conditional crew), Route and UTC timeline in a single **Flight essentials** card, and M1 quick review could say `No outstanding form checks` even with time boxes still blank. M2 adopts a more explicit reading order without moving or hiding critical controls:

- **Flight basics**: Date, Registration, Role and conditional DUAL Instructor / Safety Pilot Actual PIC / supervised crew fields remain visually and DOM-adjacent; direct M1 focus links continue to work.
- **Route & UTC times**: a scoped, non-interactive heading and guidance to leave unknown route/times blank rather than invent them; existing Route and Times/UTC subheadings, 4 time inputs, BLOCK/AIR calculation, route hints and manual flight values are unchanged.
- **Flight experience** remains the existing applicability-driven disclosure, preserving conditional sailplane/balloon and regulatory PF evidence; **Aircraft context**, **Optional details** and existing explicit Save draft / Save & certify controls remain present.
- New-only `data-entry-flow="new"` allows scoped separators/type spacing via existing design tokens. `data-entry-flow="edit"` receives no M2 styling. No new component/library/animation/brand changes (motion NONE).
- If the quick status has no flagged item, it now says **No items flagged in quick review** and explicitly clarifies that quick review is not certification; this is UI copy **not** a new validator or claim of completeness.

## Contract freeze / invariants

- `FlightForm` remains the shared New/Edit component; **Edit flight field order, existing label and other styles remain unchanged**; no field `name` additions/removals/renames, no default-value or event handler changes, no new submit input, no buttons or status which fire server-side actions.
- Canonical Manual `parseFlightInput`, `normalizeFlightDraft`, `createFlight`, Edit, RoleCrew, FCL/SFCL/BFCL, billing/expense, GPS import/split and certification server rules unmodified.
- Existing M1 direct-to-field actions, disabled/pending save, error/status, proper unsaved state and explicit actions remain intact. Missing !== zero; no suggested aircraft/airports from last flight, no inferred GPS or regulatory credit.
- **Do not:** alter GPS (M3 separate); add wizard, auto-fill, animation, third-party packages or new CSS tokens; edit Train repository; change DB schema/migrations/production flags; merge, deploy or expose synthetic flight data.

## Files and tests

- `components/flight-form.tsx`: New-only reading order headings and clearer non-certification copy.
- `app/ui-system.css`: M2-specific CSS selectors guarded by `data-entry-flow="new"`, using current tokens and native focus.
- `tests/n3-m2-manual-layout.test.ts`: two source-contract regressions protecting New-only layout and stored field names/legacy Edit semantics. **Execution NOT RUN**, as assistant Node 22/isolated environment cannot provide repo Node24 dependencies/owned Windows PG16.
- `e2e/n3-m1-entry-review.spec.mjs`: extend *already registered* authoritative Manual browser scenario with grouping/empty route/time checks and 320/390/768/1024/1440 Light/Dark responsive/overflow loop. Existing title preserved; four M1 browser target registrations remain in place. GPS test untouched.

**Static-only GitHub verification (2026-10-23):** source readback PASS, existing named JSX controls inventory exact-identical before/after, all existing E2E test titles identical, scoped CSS only targets New, edit branch displays original primary heading. Do not claim any Node/browser run PASS.

### Required after-state evidence

1. Owner fetches exact final work SHA, clean tree and Node 24; targeted source tests include `tests/n3-m2-manual-layout.test.ts`, `tests/n3-m1-entry-readiness.test.ts` and `tests/v330-add-flight-simplicity.test.ts`.
2. `npm run verify:plan -- --base origin/main`, `npm run typecheck`, `npm run build`; satisfy all planner blockers and selected release/PG evidence without bypass.
3. On a NEW physically owned, verified EMPTY local PG16: use the existing authorized browser fixture to execute M2-extended Manual scenario desktop/mobile with 1 worker/0 retries; check focus to DUAL/Actual PIC, responsive and Light/Dark status, Edit unchanged, no horizontal overflow. Capture synthetic screenshots for owner visual review.
4. Native Safari/VoiceOver, actual product theme preference, keyboard overlay and 200% text zoom remain separately **NOT RUN** until real evidence.
5. M1 parent #398 and N3 docs #397 remain Draft; do not merge/deploy any stack without explicit later permission.

**ONE NEXT STEP:** owner executes exact-new-SHA risk planner, Node/typecheck/build and disposable PG16 browser targeting the Manual scenario; inspect results before M2 visual acceptance or M3 planning.
