# N3-M1 — Contextual flight-entry review strip (Variant A)

**Date:** 2026-10-23  
**Status:** Implemented on a feature branch; browser and Node execution **NOT RUN** in assistant's environment. Design direction Variant A was owner approved. Owner explicitly declined independent DeepSeek review. No merge/deploy permission.  
**Parent:** N3 docs Draft #397 `docs/logbook-n3-flight-entry-ux-discovery-20261023`, base HEAD `22aeb50845e4db89eb6eb1f1addb19246cf37fd0` at branch creation.

## Problem / desired interaction

On New Flight Manual, the prior actionable `missing[]` labels were only near the bottom of the form, sometimes beside an enabled Save draft. On GPS, several independent readiness flags and per-part evidence issues were surfaced largely as generic "Needs attention" in a long page. D0 synthetic evidence captured 390px phone Manual all-open 4796px and GPS two-part 6144px.

**M1 implementation is not a redesign of the form order.** It places a common **non-sticky** review strip at the beginning of each displayed form. It shows specific issues and *buttons* that open the correct details or focus a field/part. Manual derives labels from its existing `missing[]` and calls existing `focusMissing`. GPS reuses existing `analysis`, `sourceRequirements`, `roleCrewBufferReady`, `gpsSourceReviewReady`, `hasAirborneMovement`, `billing` and `ready` state, without creating a second persistence validator or applying inferred values.

### Before → after

- Manual incomplete: bottom "Complete before save" misleading with a draft button → "Review before finishing" in footer plus exact missing-item actions near form start; draft and certify remain separate existing explicit actions.
- GPS no data: "Upload track" source action near top; GPS malformed/too few points: "Choose a GPS source with usable flight data" rather than positive ready language in the new strip; per-part date/evidence, selected aircraft, operation/engine, instructor/Actual PIC, quality warning and billing have direct-to-context actions.
- "No outstanding form checks" is displayed only when existing relevant flag checks are satisfied; the copy still explicitly says the server validates the final action. Do not claim a flight certified/approved from this client summary.
- New `EntryReviewSummary` reuses FlyTally UI tokens and native focus-visible, touch targets ≥44px; motion NONE; no sticky overlay. It has no submit inputs/automatic effects.
- Shared Manual `FlightForm` is also used by Edit: new summary is guarded by `!editing`; existing Edit save messaging is preserved.

## Files

- `components/entry-review-summary.tsx`: new reusable non-submit, accessible section/buttons.
- `components/flight-form.tsx`: source-of-truth `missing[]` mapped to visible top actions and small non-misleading footer copy change for New only.
- `components/kml-import-form.tsx`: flagged GPS review reasons and open/focus jump actions, strictly UI-only; original submit/readiness logic unchanged.
- `app/ui-system.css`: appended scoped responsive token-based styles, no brand/global changes.
- `tests/n3-m1-entry-readiness.test.ts`: source/DOM contract checks.
- `e2e/n3-m1-entry-review.spec.mjs`: authenticated synthetic browser coverage for manual required crew + GPS invalid/valid source and focus, viewport overflow.

## DO NOT

No GPS parser, date/time math, split algorithm, certification, RoleCrew persistence, flight schema, migrations, production DB, feature flags, last-flight auto-prefill, GPS auto-apply, packages, brand, animation or Training changes. Do not retarget standalone Draft #396 or merge/deploy without new owner approval. Do not treat Chromium emulation as native iOS Safari.

## M1 after-state audit (2026-10-23)

Owner-provided new guarded local PG16 capture at `97f67c08b25312c9af07948a489b0a02e6167579`: synthetic visual 90/90 (9 states × five widths × Light/Dark) and Chromium capture 1/1 PASS, 0 manifest failures or horizontal overflow, after-state screenshot archive retained in chat, not repository. Full analysis and M2 bounded recommendation: [N3-M1 visual after-state review](docs/product/LOGBOOK_N3_M1_VISUAL_AFTERSTATE_REVIEW_2026-10-23.md). This new capture **does not complete the 22 selected release browser targets, native Safari or owner visual acceptance**. UI observation: GPS 0 points still says 1 suggested flight, and Manual no-outstanding copy can coexist with blank times; neither alone establishes server-side invalid save. M2/M3 changes remain separately gated.

## Tests / evidence

- **Owner-local, exact app/source candidate `d323da4524d24b6835f272d9d47baadb65d4a305` — TARGETED GATES PASS (2026-10-23):** clean source SHA; `npm run test:target -- tests/browser-risk-selection.test.ts tests/browser-suite-structure.test.ts` **33/33 PASS**; risk planner `npm run verify:plan -- --base origin/main` **PASS**, candidate ID `fb341d7bc18ed3f28e49ea1a30dbbaaf06095903eb6f5d83bda031ac6968aa80`, 22 selected target IDs, `blocked_evidence=none`; guarded fresh-owned loopback PostgreSQL16 empty physical cluster preflight/cleanup PASS; `npm run typecheck` **PASS**, N3-M1 Node contracts **3/3 PASS**, Next production build **PASS**; schema-first v20/v21 browser bootstrap PASS, targeted authenticated `desktop-chromium` Manual+GPS **2/2 PASS**, 1 worker and 0 retries; temporary owned PG16 server stopped and its unique temp directory deleted. The default locale notice that Czech fulltext config fell back to `simple` was emitted during successful local-only initdb and is not an application failure. No explicit M1 after-state screenshot evidence or production smoke supplied.
- **Remaining evidence on exact `d323da4524d24b6835f272d9d47baadb65d4a305`:** all 22 risk-selected browser targets (only two targeted desktop tests executed), mobile/iPad/light/dark captured UX matrix, GPS multi-part, full application source/domain/Node and full PostgreSQL integration gates, `verify:release:risk`, native Safari/accessibility and owner visual acceptance **NOT RUN**. Existing successful D0 100 screenshots predate M1. Targeted PASS must not be interpreted as release PASS. Later documentation-only commits do not change the tested runtime code; new full candidate SHA still needs explicit verification accounting.

- **Owner Windows at old `ff7ec9a71e591fbcb961349943ecf68df77f89af` (2026-10-23):** clean checked-out branch, protected physical isolated PG16 init/probe/stop/delete PASS; `npm run typecheck` PASS; `npm run test:target -- tests/n3-m1-entry-readiness.test.ts` 3/3 PASS. `npm run verify:plan -- --base origin/main` returned exit 3 because new E2E spec lacked an authoritative browser target. PostgreSQL integration, build, and Playwright were **NOT RUN** because runner stopped before them. This is a test ownership blocker, not evidence of a UI regression.
- **Registration repair on work branch (new SHA required):** added exact two N3-M1 logical tests to browser inventory and four desktop/mobile authoritative target declarations, harness inclusion, narrow entry component owner paths, and browser registry/structure regression assertions. Existing protocol `selectionVersion=2`, historical `expectedFullGate` and other legacy targets remain unchanged. Exact-new-SHA Node/browser/PG/build execution is **NOT RUN** until owner-local guarded rerun.

- GitHub source readback of focused changes: **STATIC ONLY**. Actual `npm run typecheck`, source unit tests, full Node, risk planner, browser fixture/Playwright (desktop 1440/iPad/mobile 320/390 Light/Dark), PostgreSQL, native Safari **NOT RUN** for this implementation SHA in assistant environment.
- Owner can run `npm run verify:plan -- --base origin/main` for candidate-bound matrix, targeted Node `npm run test:target -- tests/n3-m1-entry-readiness.test.ts` and the guarded owner-local fresh-PG16 browser script; store true PASS/FAIL per exact work SHA. Any failed gate is a blocker, no test waivers.
- D0 screenshot baseline 100/100 PASS was prior docs SHA `2fd9ba65f3f7145ba25cfbcb8fa86da7158b6fb9` and **cannot establish after-state M1 UI PASS**.

**ONE NEXT STEP:** use the guarded disposable-PG16 synthetic browser fixture to capture M1 after-state Manual/GPS screenshots and focus behavior across 320/390/768/1024/1440 and Light/Dark, compare D0 findings and request owner visual acceptance before M2.
