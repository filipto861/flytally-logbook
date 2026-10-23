# N3-M2 — Manual New Flight visual after-state review

**Date:** 2026-10-23; independent verification of recovered owner-local screenshots.
**Scope:** N3-M2 Manual New Flight only. **Draft PR #399**, stacked on Draft #398 (N3-M1) and Draft #397 (N3-D0). Owner approved implementation of bounded M2 Variant A; **owner visual acceptance still PENDING**, merge/deploy/production DB actions NOT AUTHORIZED.
**Evidence source candidate:** `106eeddb3b691a769696908cb85a4c6e135c917d` documentation-only checkpoint over identical M2 UI implementation at `3c4cecfddce5ef12535bbdcf6ea60d11d7d4c52e`; baseline M1 capture `97f67c08b25312c9af07948a489b0a02e6167579`; canonical main at audit `3af54d4f4d0651b430452dd3f5b8513e134f5c6a`. A new docs-only checkpoint will follow; do not imply its runtime was independently tested.
**Owner file:** `FlyTally-N3-M2-Afterstate-RECOVERED-e057e55e35ea42a99b69491e11b4cf67.zip`. Synthetic local screenshots, not private real pilot/flight data. Retained in ChatGPT session; **not committed**.

## Evidence integrity

- ZIP independently inspected: **42 entries**, 40 JPEGs + **unchanged** `n3-m2-manual-visual-manifest.json` + `n3-m2-recovery-attestation.json`; archive CRC ZIP integrity PASS. All 40 independently recomputed SHA-256 digests match the per-image attestation; original manifest SHA-256 `D42C074C15FFFCAD07CDF7AFBE23B89FADD74FE0B4F732F91F0D0AFB04BB2977` matches unchanged contents.
- Manifest `screenshots=40`, `expectedScreenshots=40`, 4 states (`manual-blank`, `manual-aircraft`, `manual-dual-focus`, `manual-safety-pilot`) × 5 viewports (1440×900 desktop, 1024×768 iPad landscape, 768×1024 iPad portrait, 390×844 phone, 320×800 narrow phone) × 2 forced Light/Dark themes. All listed files exist, JPEG intrinsic dimensions agree with recorded `viewportWidth` and `pageHeight`. Manifest `failures=[]`; `horizontalOverflowPx=0` in **40/40**; Entry Review `exists=true` in **40/40**; `manualM2.flow=new`, `basics="Flight basics"`, `routeTimes` present in **40/40**.
- The original manifest's `status=PARTIAL_OR_FINDINGS` is retained *as originally written*. Source Playwright capture script incorrectly required `data.rows.length===90` for M2's declared **40** pictures. Owner's first run Playwright diagnostic **1/1 PASS** and preserved all screenshot/manifest data, but post-run PowerShell validation **FAILED** (correct fail-closed response to status). **Read-only** recovery attestation independently validates 40/40; it does not rewrite the original manifest or rerun software. Tooling defect, not proven app failure.
- Screenshot review: M1/M2 same four scenarios/widths/themes compared directly. Full-page images sampled visually for first screen, inputs, group hierarchy, light/dark, desktop/tablet/mobile, focused DUAL and Safety Pilot; manifest metrics verified across all 40. Actual supported user theme preference, natively rendered iPad Safari/VoiceOver, scroll-and-keyboard occlusion, Edit Flight screenshot, and certification server-side end-to-end behavior **NOT RUN**.

## Observations

| ID | Evidence and finding | Classification |
| --- | --- | --- |
| M2-V01 | Compared M1 and M2 `manual-blank`/`manual-aircraft` screenshots at 390 and 320, plus tablet and desktop: **Flight basics** with short neutral instruction precedes Date/Registration/Role; **Route & UTC times** is separated by a subtle divider and explicit do-not-guess note before existing route and off/on block times; existing **Flight experience** visible as a disclosure. No extra wizard, new autofill control or missing visible role/crew field. | **PASS** for intended hierarchy, sampled visuals. |
| M2-V02 | M1 ambiguous `No outstanding form checks` is now `No items flagged in quick review` plus **the quick review does not certify the flight**. Screenshot shows route and UTC values remain blank/placeholder when quick review has no flagged issues. | **PASS** clearer truth-in-UI copy, **not** proof that a record can/cannot be certified without times. |
| M2-V03 | Manifest horizontalOverflowPx=0 all 40; four sets of new heading/guidance adapt without observed clipping at 320/390, iPad 768/1024, desktop 1440, in forced Light and Dark; new review copy has legible foreground on panels in samples. | **PASS** within synthetic Chromium; native Safari, real theme-preference switch and zoom NOT RUN. |
| M2-V04 | `manual-dual-focus`: manifest `activeElement=INPUT[name=instructor]` all 10 viewport/theme cases and visible focus ring in screenshots. Safety Pilot has visible Actual PIC prompt, but its direct-link click was not part of this four-state capture; the M1/D2 source still contains the focus method. | **PASS** DUAL tested focus; broader keyboard/assistive and other direct-link actions NOT RUN. |
| M2-V05 | Compared exact matching four scenarios at five widths/two themes: **all 40 M2 documents are taller by 84–178px** vs M1. E.g. manual-aircraft 390 **2415→2556 (+141)**; 320 **2685→2863 (+178)**; desktop 1440 **1711→1800 (+89)**. New explanatory hierarchy deliberately consumes space. | **P2 visual trade-off**, not layout overflow/functional regression. Owner to judge density vs clarity. |
| M2-V06 | Existing sticky Manual save actions appear mid-document in full-page screenshot at desktop/iPad (including at 768 dark), across M1 *and* M2. Full-page capture of a sticky element may visually appear over content during stitching. Neither screenshot capture nor manifest prove actual keyboard/finger obstruction. | **Carry-forward N3-V06, verification needed**: reproduce viewport scroll, hit testing and keyboard overlay before any sticky-bar fix. Do not claim this is M2-introduced. |
| M2-V07 | Existing opt-in `Continue from LKPR?` / `Use LKPR` route assistant in screenshots remains a user-activated suggestion. No automatically applied prior airport/aircraft value is evident in these fixtures. | **No newly observed auto-prefill**; separate underlying feature governance unchanged. |

### Full-page height: M1 → M2 (Light; px)

| State | Desktop 1440 | iPad portrait 768 | Phone 390 | Phone 320 |
| --- | --- | --- | --- | --- |
| Manual blank | 1899 → 1988 (+89) | 2285 → 2374 (+89) | 2626 → 2747 (+121) | 2886 → 3044 (+158) |
| Manual aircraft | 1711 → 1800 (+89) | 2099 → 2207 (+108) | 2415 → 2556 (+141) | 2685 → 2863 (+178) |
| Manual DUAL focus | 1821 → 1906 (+85) | 2196 → 2281 (+85) | 2514 → 2631 (+117) | 2769 → 2923 (+154) |
| Manual Safety Pilot | 1909 → 1994 (+85) | 2394 → 2479 (+85) | 2730 → 2847 (+117) | 2998 → 3152 (+154) |

Dark capture heights agree with Light for all matched cases. Numerical heights are full-document estimates in synthetic Chromium, not measured scroll time or proof of obstructed content.

### Follow-up approved: header scroll/focus verification only

The owner reported the mobile FlyTally shell bar in the *middle* of a stitched dark full-page comparison and approved an independent runtime/viewport-only scroll and focus investigation before any CSS edits. This is not evidence that the header actually jumps at runtime, and not final approval of M2 visual density. Detailed [probe plan](docs/product/LOGBOOK_N3_M2_STICKY_SHELL_INTERACTION_PROBE_2026-10-23.md); execution **NOT RUN** at this checkpoint. Existing M2 screenshots remain evidence of the static hierarchy only.

## Verification boundaries and next action

Previously owner-executed exact M2 source candidate `5c349a422222b91aa6d25c241282c947fd55ca5a`: TypeScript PASS, Node targeted **11/11 PASS**, risk planner 22 browser targets/zero blockers, Next build PASS, isolated owned PG16 schema-first v20/v21 PASS, targeted desktop+mobile Manual browser **2/2 PASS**, cluster cleanup PASS. Later screenshot capture on `106eeddb3b691a769696908cb85a4c6e135c917d` with identical runtime source: TypeScript PASS, Node **11/11 PASS**, build PASS, protected PG16 PASS, diagnostic Playwright **1/1 PASS**, diagnostic manifest 40/40 recovery integrity PASS but original post-run PowerShell wrapper **FAIL** due to 90/40 check. Do not label wrapper PASS or full release PASS.

**NOT RUN**: remaining 20 of 22 selected risk browser targets, full Node/source/domain, full PG integration/release evidence, actual native Safari and assistive accessibility, real theme preference, Edit after-state screenshot, physical scroll/keyboard obstruction, owner visual sign-off, production authenticated/public smoke.

Production Vercel previously independently read-only observed READY `dpl_EkZZoHyWoYZsfp4AzubGBcziXUVz` source `3def2c3618d1b2a185d39b15df69c1613180751b`, not M1/M2. No database migrations or feature flags touched, production DB status UNKNOWN. No merges and no Training changes.

**ONE NEXT STEP:** present side-by-side M1/M2 mobile/tablet screenshots plus measured density trade-off to the owner for explicit M2 visual acceptance (or a request to condense); only then plan bounded remaining UX verification or move to separately scoped M3. No merge/deploy authorization implied.
