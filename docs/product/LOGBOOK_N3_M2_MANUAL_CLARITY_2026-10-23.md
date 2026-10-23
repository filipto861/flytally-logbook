# N3-M2 — Manual New Flight clarity (Variant A)

**2026-10-23 continuation decision:** Owner agreed to continue after visual review of M2 and the corrected shell-header diagnosis. Proceed to full exact-candidate risk verification; this is **not** permission to merge, deploy or implement M3. Previous targeted manual/source/browser checks PASS for earlier SHAs, while release-level 22-risk-browser, full Node and 6-part PG integrations **NOT RUN**. No runtime source edits in this checkpoint.

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

## Recovered visual after-state (2026-10-23)

[Independent N3-M2 visual report](docs/product/LOGBOOK_N3_M2_VISUAL_AFTERSTATE_REVIEW_2026-10-23.md): 40/40 original JPEG/manifest evidence checks PASS after read-only recovery; original capture-manifest `PARTIAL_OR_FINDINGS` and original wrapper FAIL retained verbatim because external capture used a mistaken 90-screenshot completion threshold instead of 40. No app defect inferred. All 40 synthetic views report zero horizontal overflow and M2 labels; DUAL Instructor input focused in all sampled viewports. Manual New is easier to scan, but every matched screenshot's document height increased by 84–178 px, so owner visual approval remains PENDING. Existing sticky save bar is visible on screenshot stitching in M1 and M2, real scroll/keyboard obstruction NOT RUN. No production changes or approval to merge.

## 2026-10-23 — owner-local release gate PASS (exact tested SHA, not shipped)

Final owner-run clean Windows verification on source `0e8b3f8787d6d55d1db6846d5a43f79e2a11f8f2` and risk candidate `d1e9dba3b762544687cb2a8562fe514a870f62f7b2acdbc5c4f85e9420d4f125`: targeted preflight 33/33, source 261/261, domain 19/19, TypeScript PASS, Node 1686/1686, build PASS, six owned PG16 partitions 164/164 PASS and risk-selected desktop/mobile Chromium 22/22 PASS with no retries/skips; browser PG16 cleanup verified. Canonical `release_status=PASS` for this **exact tested candidate only**. Earlier FAIL and repairs remain in historical sections below. [Exact evidence](docs/product/LOGBOOK_N3_M2_LOCAL_RELEASE_PASS_2026-10-23.md). Unmerged Draft PR #399; native Safari and production smoke NOT RUN; no merge/deploy/production DB action authorized. New documentation checkpoint HEAD not separately executed.

## 2026-10-23 — next full risk attempt: legacy regression boundary correction, exact SHA rerun pending

Owner repeated risk gate after inventory repair on `d63184c15428100ccf1927e0e72f52c0b607633d`: source 261/261 PASS, domain 19/19 PASS, TypeScript PASS, Node **1684/1686 FAIL**, hence build/PG/browser NOT RUN. Both failures have exact historical-test scoping cause; test-only source commit `ef06949a03df6028da9bae30996dd124473abccd` retains relevant negative assertions and enforces new-only non-submit review; no runtime edit. [Full evidence](docs/product/LOGBOOK_N3_M2_FULL_RISK_SOURCE_AND_AGGREGATE_2026-10-23.md). New SHA execution **NOT RUN**; no release PASS or approval to merge.

## 2026-10-23 — full risk run blocked by stale audited source inventory (resolved in source, new gate NOT RUN)

Owner ran the full local safe risk runner on **exact `ce13535f943c165935c2a33bae4abca3d60b61bd`**, risk candidate `6c5b225ce086de9a3979ae78aae216a734428c516384e441b9a855abe27e4d3c`. `verify:plan` PASS, 22 browser targets selected with zero blockers; script verified a physically owned unique **EMPTY localhost PG16** browser cluster, removed it after failure. **Canonical release FAIL:** initial application-source group 260/261 PASS, 1 FAIL (`tests/development-scope.test.ts:228`, 401 actual runtime files vs 400 declared). Remaining direct domain, aggregate full Node, build, six PG16 partitions, 22 Playwright targets **NOT RUN** because the release orchestrator correctly stopped at the first failed source gate. Not a proven runtime/flight bug.

GitHub full-tree comparison independently verified main 400 and M2 401 runtime files, with exactly **one** new file `components/entry-review-summary.tsx` in M2, already explicitly owned by `flight-records` in the registry. Ownership computation: stable 383/401 (95.5%), explicit shared 18, uncovered 0. Source fix `6cb490808379e7cbc53bb43dfcc03619b610b580` updates **only** `tooling/development-modules.json#ownership.auditedTotal` 400 → 401, preserving `baselineStableOwned=121` and `minimumStableCoverage=0.9`; no tests, UI, flight logic or release gates were weakened. Next docs-only checkpoint SHA may differ. **Static GitHub source inspection PASS; new SHA actual Node/release test NOT RUN**. The previous Windows run remains FAIL; rerun canonical release required.

## Owner-local targeted verification (2026-10-23)

Owner-local Windows verification on **exact source HEAD `5c349a422222b91aa6d25c241282c947fd55ca5a`**: clean repository and HEAD/remote branch match PASS; TypeScript `npm run typecheck` PASS; targeted `npm run test:target -- tests/n3-m2-manual-layout.test.ts tests/n3-m1-entry-readiness.test.ts tests/v330-add-flight-simplicity.test.ts` **11/11 PASS**; `npm run verify:plan -- --base origin/main` PASS candidate `e5650e7d7fa2dd5e3fe38ab3bc8e4c1f50e5c5be496ac84ecdac60c4e4a150b6`, 22 authoritative browser targets selected, `browser_blockers=none`, `blocked_evidence=none`; Next.js 16.3.2 `npm run build` PASS; physically verified **new empty, loopback-only, owned PostgreSQL16** server `flytally_currency_test|flytally|127.0.0.1|59002|160015` with exact data directory PASS; browser bootstrap/rehearsal schema-first v20/v21 21 registry/12 columns/4 CHECKs PASS; Manual existing authoritative `N3-M1 Manual shows existing missing details at the top and focuses them` scenario **desktop Chromium 1/1 PASS + mobile Chromium 1/1 PASS**, each one worker and no retries, covering 320/390/768/1024/1440 widths in forced Light/Dark, layout/focus/empty route/time and horizontal overflow; PostgreSQL stopped and its unique temporary directory deleted PASS. **No runtime blockers found by targeted tests.**

**NOT RUN** on this candidate: remaining 20/22 selected browser executions, complete Node/source/domain suite, full PostgreSQL integration, full risk release evidence, real iPad/native Safari, supported account preference Light/Dark, actual screenshot after-state, keyboard overlay/text zoom, owner visual sign-off, production smoke. The screenshot-free responsive browser pass alone cannot establish visual acceptance. No merge/deploy/production DB/flags authorization.

This execution supports **only** the targeted M2 scope on `5c349a422222b91aa6d25c241282c947fd55ca5a` and does not supersede the older static-only implementation checkpoint. Final current work HEAD after documentation may differ; recheck SHA and execute any new gates against the intended source candidate without claiming documentation-only followups were retested.

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
