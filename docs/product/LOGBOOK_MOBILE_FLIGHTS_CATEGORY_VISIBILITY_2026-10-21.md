# Logbook Flights narrow-mobile category reachability — U0-R01 follow-up

**Date:** 2026-10-21  
**Repository:** `filipto861/flytally-logbook` only  
**Base:** `main@8099149f72d493c34dd59babf65bdb064ff99fc9`  
**Scope:** independent small UX change, not a resolution of U2 visual-testing problems. Separate from Draft PRs #377 (U0 screenshot evidence), #378 (U1 focus), and #379 (U2 typography).  
**Status:** Implementation staged on Draft branch; local source tests, typecheck, build and visual/browser test **NOT RUN**. No merge/deploy.

## Source and observed baseline

The U0 evidence report (`docs/product/LOGBOOK_APPLE_UX_U0_VISUAL_EVIDENCE_2026-10-21.md`, source Draft PR #377) records U0-R01: on 320px Flights the logbook-category options extend past a horizontally scrollable strip. The screenshot does **not** prove clipping or inability to scroll: `app/globals.css` explicitly uses `overflow-x:auto`, touch scroll and scroll snap, and U0 measured **no document-root overflow**. The UX improvement is *discoverability*, not a repair of a broken navigation event.

Actual `app/(protected)/flights/page.tsx` renders exactly six options (`All`, `Aeroplane`, `ULL`, `Sailplane`, `Helicopter`, `Balloon`) in `<nav className="period-control" aria-label="Logbook category">`. Visually active selection relied on CSS `className="active"` without an `aria-current` indicator, whereas `components/flight-workspace-nav.tsx` uses `aria-current="page"`.

## Narrow solution

- Preserve all six links, their exact category values, order, query-string preservation and page-reset-to-1 contract. No modified filtering or flight data.
- Add `aria-current="page"` to the active category link and no `aria-current` to inactive links; this uses the same convention as the existing Flight records navigation.
- At viewport width **390px and below only**, `nav.period-control[aria-label="Logbook category"]` becomes a three-column grid with two rows, full-width, zero hidden horizontal scrolling. Every label may wrap instead of being truncated; target chips have `min-height:44px`. Keep existing tokens, colors, active styles and keyboard navigation.
- Above 390px, leave the existing horizontal-scrolling strip, including touch momentum and scroll snap, **unchanged**. Other `.period-control` instances, `.segment-control`, `.scope-links` and Settings/Data tabs are out of scope.
- Late override in `app/ui-system.css` because it is the final stylesheet import in `app/layout.tsx`; do not delete legacy declarations or alter unrelated specificity.

## Acceptance / evidence

1. Source regression test `npm run test:target -- tests/logbook-mobile-flight-categories.test.ts` confirms scoped breakpoint, six preserved links, `aria-current`, 44px minimum and no shared-navigation spillover — **NOT RUN**.
2. `npm run typecheck` and `npm run build` — **NOT RUN**.
3. **Real Chromium/browser visual check NOT RUN:** 320×720 and 390×844, light/dark; confirm two visible rows with six complete labels, no overlap/clipping, clear active category, keyboard focus visible, no root horizontal overflow, and each of six links navigates to the expected category with query parameter preserved. At 768×1024 and 1024×768 confirm legacy single-row horizontal strip remains scrollable and active selection styling intact. Neither U0 capture nor source tests establish these after-change facts.
4. Native Safari/iPadOS and physical touch NOT RUN; no accessibility/WCAG conformance claim.
5. No DB, migration, API, flight model, auth, regulatory/certification logic or flytally-training change.
6. Draft review and owner approval required before merge/deploy. Do not reopen U2 E2E debugging as a prerequisite to this independent UX improvement.

## Subsequent UI/UX milestones

U3 source/visual coverage should next target U0-unsampled interactive workflows (Flight Detail edit/correction and tabs; Aircraft profile/photo/crop/delete; GPS import multi-part review; notification/settings error/pending states), respecting synthetic fixture and avoiding real customer data. U0-R02 touch target candidates and U0-R03 sticky header remain **needs reproduction**, not confirmed defects. U2 typography PR #379 stays open with browser acceptance incomplete; U1 PR #378 stays Draft locally tested. Do not merge them implicitly.
