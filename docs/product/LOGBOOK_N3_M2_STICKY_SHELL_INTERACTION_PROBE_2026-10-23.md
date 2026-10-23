# N3-M2 — sticky shell interaction investigation

**Owner approval:** 2026-10-23. Owner agrees to validate the existing top mobile FlyTally shell at scroll/focus/menu states **before changing CSS**. This is approval for **read-only diagnostic evidence**, not a redesign, a CSS fix, M3 implementation, merger or production deployment.

**Source status:** canonical `main@3af54d4f4d0651b430452dd3f5b8513e134f5c6a`, active M2 Draft #399 `feat/logbook-n3-m2-manual-clarity-20261023@67c19ef882d1e80b76d08f66e1acee28736807a6`, stacked on Draft #398 / Draft #397. Production Vercel last observed READY `3def2c3618d1b2a185d39b15df69c1613180751b`; M2 unmerged/undeployed. This documentation-only checkpoint will move the work HEAD and does **not** add runtime changes.

## What prompted the investigation

The owner provided a cropped M1/M2 full-page dark mobile comparison image showing the FlyTally top navigation drawn halfway down the stitched screenshot, apparently over the Entry Review and Flight Basics. The screenshots were generated via Playwright `page.screenshot({fullPage:true})`, sometimes **after** user-driven or programmatic focus/scroll. The Nav itself is `components/sidebar.tsx` and CSS `app/globals.css` / `app/ui-system.css`. GitHub read-only source inspection at exact source SHA shows a 2-column sticky left sidebar on desktop (`.sidebar {position:sticky;top:0;height:100vh}`) and a single-column top nav under `@media(max-width:820px)` (`.sidebar,.sidebar.collapsed {position:sticky;width:100%;height:70px;...}`). The later N1 shell theme styles do not remove this sticky layout. The focus target in `FlightForm` uses 2 requestAnimationFrame callbacks; new review is not sticky. This strongly suggests a **full-page stitched screenshot artifact** rather than a navigation jump, but live viewport position and focus occlusion have not been demonstrated.

## Diagnostic scenario (synthetic / non-production)

Use a fresh, strictly owned and physically validated empty local PostgreSQL 16 cluster; do not use or modify remote data. Invoke the existing authenticated Playwright runner, one worker and zero retries, against an **untracked, temporary JS test** copied from an integrity-pinned local companion. Scope:

1. New Flight Manual, 320 / 390 / 768 / 1024 / 1440 px; synthetic Light/Dark and touch pointer where appropriate. No submitted flight.
2. Normal top, mid and bottom scroll: inspect `window.scrollY`, header/side bounding rectangle, effective `position:sticky` / `top:0`, and ensure the mobile shell remains attached to **viewport y≈0**, not arbitrary document y; save **viewport-only** (not full-page) screenshots.
3. Choose explicit aircraft then DUAL and click M1 `Instructor / PIC` issue. Verify actual focus and **input position/hit testing relative to the sticky header**, with screenshot evidence.
4. On widths ≤820, open mobile navigation, inspect displayed `nav` position, scroll-lock, Escape close/focus return and menu close button. Verify focus isn't trapped after close.
5. Record measured data in a manifest and preserve failure findings rather than labeling a layout hypothesis as a runtime regression. No CSS changes before actual evidence.

### Results

**2026-10-23 resolution:** uploaded original 28-member ZIP reviewed. All 26 viewport JPEG sha/dimension/size checks PASS; all 58 browser-phase geometry measurements report top y=0 and horizontal overflow=0. Header rendered `fixed` at 320/390/768, `sticky` at 1024/1440, per effective CSS. No actual motion/focus obstruction reproduced. Historical Playwright **FAIL** for 42 incorrect style-only `NOT_STICKY` checks retained, not rewritten as PASS. Chromium shell investigation CLOSED as diagnostic false-positive, no CSS changes; see [full analysis](docs/product/LOGBOOK_N3_M2_SHELL_PROBE_DIAGNOSTIC_RESULT_2026-10-23.md). Native Safari/real keyboard unverified.


**TEST RAN, ASSERTION FAILED (not runtime PASS).** 2026-10-23 owner-local Chromium probe produced 42 false-positive `NOT_STICKY` findings because effective mobile `position:fixed` from legacy v1131 mobile CSS was not accepted. All recorded viewport geometry shows shell at y=0 despite scroll; focused Instructor visible and menu state correct. Detailed [readout](docs/product/LOGBOOK_N3_M2_SHELL_PROBE_DIAGNOSTIC_RESULT_2026-10-23.md). Diagnostic ZIP is retained locally but not yet independently inspected. Prior state was: **PENDING / NOT RUN.** A screenshot alone cannot prove fixed/sticky behavior at runtime. If the live test passes, classify owner's stitched image as capture artifact and keep CSS unchanged. If it fails, investigate exact DOM/CSS cascade and reproduce with a minimal responsive fixture before proposing a scoped fix. Native Safari/real iPad and soft-keyboard behavior remain **NOT RUN** until separate device evidence.

No design-library/brand/nav behavior changes or test registry modifications permitted in this diagnostic batch; no merging/release/production DB/flags changes.

**ONE NEXT STEP:** owner runs safeguarded exact-SHA viewport-only shell interaction probe and supplies ZIP/console log; inspect recorded scroll/focus/menu measurements.
