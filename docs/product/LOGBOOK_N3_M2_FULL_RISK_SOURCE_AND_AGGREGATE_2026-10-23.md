# N3-M2 — exact candidate full risk release failures and bounded regression resolution

**Date:** 2026-10-23, **Draft PR #399**, work branch `feat/logbook-n3-m2-manual-clarity-20261023`, canonical `main@3af54d4f4d0651b430452dd3f5b8513e134f5c6a`. No merge/deploy/production DB operations. Owner's Windows log `Vložený text(20261023-192223).txt` is a private local evidence artifact (not committed), tested `d63184c15428100ccf1927e0e72f52c0b607633d`. Risk candidate `b0fd5d6c6d2409ed438e598315a912c3640814475b2a056ac700964d874e4b51`, base `3af54d4f4d0651b430452dd3f5b8513e134f5c6a`.

## Real owner-executed evidence at the old SHA

- Preflight `npm run test:target -- tests/development-scope.test.ts`: **25/25 PASS** after prior audited inventory 400→401 fix.
- Safeguarded runner validated GitHub identity/clean exact pinned branch, physically unique owned **EMPTY localhost PG16**, own physical data directory, v16.0.15 identity. Cluster stopped and its unique directory removed after the run (**PASS**; browser/PG release execution still NOT RUN).
- Risk planner **PASS** with 22 authoritative browser targets, 0 blockers; source contract **261/261 PASS**, domain unit **19/19 PASS**, `tsc --noEmit` **PASS**.
- Full `npm test` **FAIL**: 1684/1686 PASS and **2 FAIL** with no skips, no retries: `tests/logbook-n2b-workspace-layout.test.ts` and `tests/v125-guided-flight-entry.test.ts`. Canonical `verify:release:risk` emitted `release_status=FAIL`, `source=PASS`, `domain=PASS`, `typecheck=PASS`, `aggregate=FAIL`. Aggregate failure stopped build, six isolated PG16 partitions (164 expected cases), and all 22 Chromium risk browser cases. They are **NOT RUN**, not implied PASS.

## Investigation — why both tests failed

1. **N2-B regression assertion exceeded historical feature scope.** The old helper read `app/ui-system.css` from its `/* N2-B — ...` marker **to end of CSS file**, including the later separately labeled N2-C, N3-M1 and N3-M2 sections. New M1/M2 `.flight-form` rules are valid independently reviewed additions but erroneously triggered the legacy negative assertion. Actual N2-B region, bounded by the next `/* N2-C — native calendar range ...` marker, is 7,709 bytes and independently statically confirmed to retain the expected responsive breakpoints 1499, 700, coarse pointer, print, focus colors, tokens and **no forbidden flight selectors, no animation/transition:all/filter or hardcoded palette**.
2. **v1.25 regression assertion banned a mere identifier newly reused for different UX.** The old `assert.doesNotMatch(source,/Review before save|entry-review-summary|Ready to save|Save and add another/)` matched `import {EntryReviewSummary}` from approved N3-M1. Unlike the former unwanted duplicate guided save workflow, N3-M1 adds a **read-only, New-only** informational direct-to-field section. Dedicated `tests/n3-m1-entry-readiness.test.ts` and `tests/n3-m2-manual-layout.test.ts` already require new-only `EntryReviewSummary`, direct-to-field focus and unchanged Edit/Save. Existing application source retains `Save draft` and `Save & certify flight` as its singular submit actions.

## Bounded corrections committed

Source commit `ef06949a03df6028da9bae30996dd124473abccd` modifies **exactly two test files**:

- `tests/logbook-n2b-workspace-layout.test.ts`: bounded historical `n2b()` to existing N2-B start **and** N2-C start, fails closed if either marker absent. Every prior negative style check and positive responsiveness/accessibility assertion remains unchanged.
- `tests/v125-guided-flight-entry.test.ts`: preserves negative checks on obsolete `Review before save`, `Ready to save`, `Save and add another`, and progress copy; removes the inappropriate ban on the new component's identifier and **replaces it with positive assertions** that `EntryReviewSummary` is New-only and its links are `type=button`, with **no `type=submit`**. Existing 1.25 save/certify/pending action assertions remain unchanged.

No changes to JS/TSX components, runtime CSS, database migrations, feature flags, analytics, GPS, aviation decisions, authorization or certification. No test was skipped or marked N/A to hide a red state. Repository read-only source-level predicate validation was performed against exact existing CSS/component files, **but actual Node tests / full release on the corrected commit are NOT RUN**. Previous FAIL is preserved.

## Acceptance and next step

Re-run the same **canonical exact-SHA** risk gate from a fresh, physically confirmed empty localhost PG16 cluster, with a preflight of the three relevant Node tests before touching the DB. Require source/domain/typecheck/full Node/build/6 PG16 partitions/22 Playwright targets PASS and their candidate-bound ledgers; no silent fallback, no remote DB. Native Safari/actual iPad and production smoke remain NOT RUN even if Chromium passes. Production currently previously verified READY `3def2c3618d1b2a185d39b15df69c1613180751b` (not M2). PR #397/#398/#399 remain Draft; no merge/deploy approval.

**ONE NEXT STEP:** owner executes a new hash-pinned safety-preserving risk rerun on final docs-only SHA and supplies log and generated summary. If a new independent failure occurs, investigate exact evidence rather than loosening tests.
