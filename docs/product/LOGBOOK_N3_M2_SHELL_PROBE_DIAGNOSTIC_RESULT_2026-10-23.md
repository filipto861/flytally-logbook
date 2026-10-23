# N3-M2 shell scroll probe — owner-local diagnostic result

**Date:** 2026-10-23. **Classification: probe assertion defect; actual shell movement regression NOT OBSERVED in submitted log, screenshot ZIP still pending.**
**Owner-local tested source:** `a0a5dc6831042f595711dbae44fb1382139a0f25`; branch `feat/logbook-n3-m2-manual-clarity-20261023`, stacked Draft PR #399 -> #398 -> #397; canonical `main@3af54d4f4d0651b430452dd3f5b8513e134f5c6a`. Owner's PowerShell log `Vložený text(20261023-183155).txt` in ChatGPT conversation (not committed).
**Diagnostic owner artifact:** `C:\\Users\\filip\\Downloads\\FlyTally-N3-M2-Shell-Probe-7b67363611e945e3910e0ce13b9e6b96.zip` — produced locally after failed probe, **not uploaded or independently inspected at this checkpoint**.

## Exact executed gates and safe cleanup

- Git origin and branch/HEAD confirmed `a0a5dc6831042f595711dbae44fb1382139a0f25`, initially clean; isolated unique local-owned, physically verified **EMPTY PostgreSQL16** `flytally_currency_test|flytally|127.0.0.1|62944|160015`, schema-first v20/v21 bootstrap PASS. Cluster stopped and unique data directory deleted PASS. No production or remote DB touched.
- `npm run typecheck` **PASS**, targeted Node `tests/n3-m2-manual-layout.test.ts`, `tests/n3-m1-entry-readiness.test.ts`, `tests/v330-add-flight-simplicity.test.ts` **11/11 PASS**, canonical `verify:plan -- --base origin/main` PASS, 22 selected browser targets / 0 blockers, Next.js 16.3.2 build PASS.
- The temporary Playwright `N3-M2 sticky shell viewport interaction probe` ran on desktop Chromium project with an internal 5-width × 2-theme matrix. **Playwright outcome: FAIL 1/1**, triggered by `expect(manifest.findings).toEqual([])`. Do not relabel it PASS without corrected validated diagnostic. Local spec cleanup and Pg16 cleanup both completed.
- Console exhibits `Internal error: step id not found: fixture@437` while serializing large failure details; this by itself does not establish an app error.

## Why the assertion failed

The submitted console contains **exactly 42** `findings`, all `code=NOT_STICKY`, all reason `Computed position=fixed; top=0px`. Six viewport/theme combinations at width 320, 390 and 768 (Light/Dark), each with seven phases: `top`, `middle-scroll`, `bottom-scroll`, `instructor-focus`, `menu`, `escape-close`, `button-close`. The other tested 1024/1440 widths had no reported `findings`.

GitHub read-only source inspection confirms `app/globals.css` includes the legacy **`Source: app/v1131-mobile.css`** mobile hotfix, whose `@media screen and (max-width:820px)` sets `.sidebar,.sidebar.collapsed {position:fixed;inset:0 0 auto 0;...}`. This overrides the older `position:sticky` rule. Accordingly, the probe's assertion that only computed `sticky` is acceptable is objectively invalid for the existing production-intended mobile shell layout. *Do not change app CSS to satisfy that invalid assertion.*

As independent measurements in the same Playwright log: on each reported mobile/tablet-portrait phase, `sidebar.y=0`, `sidebar.bottom=64`, `height=64`, `stickyTop=0px`, `shellHitWithinSidebar=true`, and `overflowPx=0`. For all six `instructor-focus` phases `activeElement=INPUT[name=instructor]` and `focusedHitActualInput=true` with the input bounding boxes below the 64px navigation bar. Open menu reports `menuDisplay=grid`, `menuExpanded=true`, `bodyOverflow=hidden`; Escape close reports `menuDisplay=none`, `menuExpanded=false`, active focus returned to the `Open navigation` button; button close also returns to closed state. Thus, **no actual header jump or focused-input obstruction is evident in the submitted measurements**, despite the failed strict style-only assertion. Viewport-only JPEG integrity and visual overlap must still be confirmed from uploaded diagnostic ZIP.

## Boundary and one next step

This evidence supports interpreting M1/M2 full-page stitched screenshot's centered header as a **capture artifact**, not proof of real movement. It does not prove Native Safari, iPad keyboard handling, pinch zoom, actual theme preference, mobile gesture interactions or all-risk release. The target Playwright diagnostic remains FAIL and its archive **NOT INSPECTED**. Previous M2 source targeted Node/browser/build passes remain historical. No app code, CSS, external script, schemas, feature flags, production systems, or Training project modified here.

**ONE NEXT STEP:** owner uploads the existing ZIP `FlyTally-N3-M2-Shell-Probe-7b67363611e945e3910e0ce13b9e6b96.zip`; independently validate original manifest and viewport-only screenshots. If they corroborate stable top header and absence of focus occlusion, close the false-positive investigation as a test assertion defect, leaving CSS unchanged. A corrected test (accepting either `sticky` or `fixed` *when top position and hit tests pass*) can follow if necessary, but do not rerun PG unnecessarily.
