# DeepSeek → independent reviewer: FlyTally GPS V2 D4.3-R2 (READ ONLY)

**Status: independent review request; no R2 implementation authorized.** Reviewer has access only to explicitly supplied files and source-backed anonymous evidence; do not infer that you have checked out the repository or viewed private GPS recordings if you have not.

## Read first (all on flytally-logbook PR #366 research branch)

1. `docs/product/GPS_V2_D43_R2_ALTITUDE_SHAPE_SOURCE_QUALITY_DESIGN_2026-10-19.md` — NEW draft contract and 26 planned tests.
2. `lib/track-processing.ts` — actual legacy rolling altitude code: `altitudeTouchAndGoIndices`, `hasImplausibleAltitudeJumpWithin`, `hasImplausibleAltitudeJump`, `touchAndGoEvents`.
3. `research/gps-detection-r21/stage-d-event-quality.ts` — existing diagnostic for emitted legacy candidate quality. Understand why analyzing ONLY emitted events misses rejected minima.
4. `research/gps-detection-r21/multi-gx-track-lineage.ts` — strict source block and raw-to-canonical evidence; `GPS_D4_MULTI_GX_SIDECAR_V1`.
5. `research/gps-detection-r21/stage-d43-r1-coverage.ts` — bounded source endpoint/cadence coverage, `GPS_D43_R1_SOURCE_COVERAGE_V1`.
6. `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md` — history and prior source-locality fix; optional `tests/v351-gps-tg-reliability.test.ts` and `tests/track-processing.test.ts`.
7. `docs/product/GPS_V2_STAGE_D42_POST_CORPUS_DEEPSEEK_RECONCILIATION_2026-10-19.md` — earlier DeepSeek adjudication and caveats.

## Baseline facts — avoid false equivalences

- D4.1 source-lineage and D4.2A horizontal shadow (research-only) completed. D4.3-R1 synthetic 107/107 targeted local Node24 tests PASS plus TypeScript PASS on source HEAD `d3b263bb`. Six KML native coverage CLI success at docs-only `996abffa`; 2/2/3/2/2/2 gx blocks; 948/587/893/74/593/1034 canonical fixes. These are parsing/coverage verification, NOT GPS altitude accuracy or physical contact evidence.
- Six real sources yielded **ZERO** horizontal D4.2A STOP_GO proposals, but prior legacy altitude proposals 1/1/10/0/6/3 (21 total) are **unverified hypothesis counts**, not known true touchdowns.
- sample07: reported missed rolling manoeuvre and a source altitude derivative ~28.85 m/s in relevant legacy candidate span; frozen 25m/s rejection must stay fail-closed. sample08: 94.39s and 35.35s within-block time intervals; missing motion is UNKNOWN. sample05: 491.57s interval; do not bridge it.
- Actual legacy `>25m/s` height rate rejection only evaluates 0<dt<=15s inside evidence span. For dt>15s that legacy guard **does not assess** the pair; this absence of a triggered guard is NOT quality proof. Existing 28–145 km/h, 30m pre/post, point-count windows and separate intermediate-climb requirement must remain unchanged.
- `gx:coord` altitude numeric values are source input. Exact sensor type, datum, AGL/MSL, uncertainty and authenticity have NOT been evidenced; do not assume ellipsoid altitude or 2–5m noise. `null` altitude != numeric zero.
- Production V2 on multiple gx:Track still `UNAVAILABLE / UNSUPPORTED_SOURCE`; Pilot Review HIDDEN, experimental flag OFF. Neither logbook records nor automatic landings/recency may change.

## What we propose for approval

**R2-0 now:** design review and correction only. **R2-1 later:** independent candidate-free source-altitude quality inventory using exact D4.1/R1 source contexts, no sensor-certification claim. **R2-2 separately conditional:** non-authoritative geometry audit for legacy-emitted and rejected near-miss shapes, with reasons and dependencies, not any physical-contact/event classifier. No new thresholds from six tracks. No code in this review.

## Questions requiring independent adversarial review

1. Does the proposed R2-1 source-altitude inventory sufficiently separate observed numeric values, missing/null/zero, provenance, time/velocity edge validity, and calibrated altitude quality **UNKNOWN**? What is mislabeled as established validity?
2. Does the R2-2 rejected-geometry proposal accidentally become a new rolling T&G detector by enumerating local minima? Recommend a more defensible contract (perhaps limited evidence-window comparator) which still allows examination of missed/rejected sample07 without treating emitted legacy proposals as ground truth.
3. Compare the *actual* two jump guards: bounded `hasImplausibleAltitudeJumpWithin` vs broader `hasImplausibleAltitudeJump` used for takeoff. Are the source-locality and 0<dt<=15s rules preserved correctly? How should a >15s interval be marked without inventing a new discard threshold?
4. How must D4.1 source-block/cross-block dedup/altitude-conflict/same-JS-ms collision and R1 coverage classification compose into R2 evidence windows? Could the proposed hard-boundary rules still allow a false join or double-count an error?
5. Are 28–145km/h and 30m merely frozen comparator constants or would their re-use in R2 accidentally confer fake approved operational authority? How should outputs preserve that distinction?
6. How do we falsify hypotheses on the known real-like low pass, go-around, taxi, sensor shift and benign irregular-sampling controls, without tuning to six private flights? Which test is missing from the proposed 26-case matrix?
7. Review privacy and staleness/DoS budget. Are even relative sample indices/time intervals potentially identifying in publicly committed detailed traces? Should R2-1 aggregate-only output be an explicit gate?
8. Should R2-1 alone be implemented first or should R2-2 require additional independent evidence R3 before coding? Give options/trade-offs and clear owner decision requests.

## Required response format

- Read-only verdict: **approve / approve with changes / reject** for *design*, not production.
- Table: findings ranked P0/P1/P2, concrete code/document evidence, actionable amendments and blocked assumptions.
- Proposed minimal R2-1 immutable input/output contract and acceptance, R2-2 separate gate with rationale.
- DO / DO NOT and exact safety/regression/privacy tests.
- Note what you could not inspect; do not invent pilot truth, sensor calibration, source altitude datum, CI/test success, or raw KML details.
- **Do not write code or suggest changing lib/, UI, DB, flags, legacy thresholds, automatic landing counts or recency.** User is final product decision maker.

Return the review text for ChatGPT to compare against the real current branch and project rules before authorizing any implementation.
