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

## Tests / evidence

- GitHub source readback of focused changes: **STATIC ONLY**. Actual `npm run typecheck`, source unit tests, full Node, risk planner, browser fixture/Playwright (desktop 1440/iPad/mobile 320/390 Light/Dark), PostgreSQL, native Safari **NOT RUN** for this implementation SHA in assistant environment.
- Owner can run `npm run verify:plan -- --base origin/main` for candidate-bound matrix, targeted Node `npm run test:target -- tests/n3-m1-entry-readiness.test.ts` and the guarded owner-local fresh-PG16 browser script; store true PASS/FAIL per exact work SHA. Any failed gate is a blocker, no test waivers.
- D0 screenshot baseline 100/100 PASS was prior docs SHA `2fd9ba65f3f7145ba25cfbcb8fa86da7158b6fb9` and **cannot establish after-state M1 UI PASS**.

**ONE NEXT STEP:** run exact-HEAD local TypeScript + targeted tests + isolated browser screenshot/focus acceptance, fix any failures, and obtain owner after-state visual approval before beginning M2 and M3.
