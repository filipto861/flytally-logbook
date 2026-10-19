# GPS V2 — D4.3-R2 altitude-shape / source-quality research design

**Date:** 2026-10-19  
**Status:** DESIGN DRAFT / NO R2 CODE / INDEPENDENT REVIEW AND EXPLICIT OWNER IMPLEMENTATION APPROVAL REQUIRED.  
**Repository:** `filipto861/flytally-logbook`, research PR #366 Draft, base `feat/gps-v2-release-critical-engine` (parent #364 Draft). Main and production are not changed.

## 1. Reconstruction and scope

**Last completed:** D4.3-R1 is **CLOSED, RESEARCH-ONLY**, not released. Exact code/test HEAD `d3b263bb`: owner-local Node v24.19.0 **107/107 targeted PASS**, `npm run typecheck` PASS. Six private KML source coverage summaries successfully ran at docs-only `996abffa`: all `SOURCE_COVERAGE_DIAGNOSTIC_ONLY`, 2/2/3/2/2/2 source blocks, 948/587/893/74/593/1034 canonical fixes, source-block+quality evidence carried separately from velocity edge validity. Sample05 max within-block 491.57s; sample08 94.39s and second-longest 35.35s. *Intervening motion between fixes remains unknown.* These results are not evidence that any landing occurred or did not occur.

**Also complete:** D4.1 source lineage, D4.2A horizontal shadow **bounded engineering experiment**. Six private D4.2A runs gave **zero** horizontal `STOP_GO_REVIEW_POINT` baseline and shadow hypotheses. This proves neither zero rolling T&G nor classifier accuracy; no real baseline STOP_GO candidate exercised the boundary suppression in those files.

**This milestone:** design how to inspect altitude descent/local-minimum/climb *source shapes and their quality* without asserting wheel contact. No new event recognizer, score or production integration authorized by the user's current “pokračuj”. Do not treat a shape as a complete flight, a touchdown, a ground truth label, or an approved/authoritative source.

## 2. Actual code and governing source-of-truth inventory (verified from research branch)

| Concern | Current source / pinned evidence | Consequence for R2 |
| --- | --- | --- |
| Production legacy parser and rolling detector | `lib/track-processing.ts` current blob `ff24b79c1e65ae911c0703ec8b750eb0d488b4d3`; `altitudeTouchAndGoIndices`, `touchAndGoEvents`, `landingCount`, `hasImplausibleAltitudeJumpWithin` | **Read-only comparison only**. Do not edit, import research into it, change flight landing suggestions or redefine pilot movement evidence. |
| Historical legacy predicate | `TOUCH_AND_GO_MIN_SPEED_KMH=28`, `MAX_SPEED_KMH=145`, `ALTITUDE_EVIDENCE_M=30`; source-local ±10-fix altitude search, local minimum, separate intermediate timed climb; candidate grouping at <8 fix indexes | These values are **frozen reference behavior** for a diagnostic comparison, not independently approved physical thresholds or a new R2 detector. Point-count windows do not establish temporal continuity. |
| Legacy altitude jump rejection | `hasImplausibleAltitudeJumpWithin` checks **absolute Δalt/Δt >25 m/s when 0 < Δt <=15s** inside actual qualifying descent/minimum/climb evidence bounds. `hasImplausibleAltitudeJump` remains separate for takeoff | No relaxation of 25 m/s. A >15s gap is **not assessed by that derivative guard**, and is **not evidence of continuity or quality**. A true within-span >25m/s jump yields `INCONCLUSIVE / ALTITUDE_DISCONTINUITY` in an R2 observational report, never “candidate accepted”. Do not globally change the takeoff guard. |
| Existing legacy quality research | `research/gps-detection-r21/stage-d-event-quality.ts` current blob `0eb983e7c6245daf4482af0f1807ab98c151437d`, `STAGE_D_QUALITY_V1` | Already inventories proposed legacy candidates, relative times, approximate shape/quality and ±10-fix contexts. **It does not characterize all rejected minima**. Reuse its conceptual vocabulary, but avoid copying its “legacyConfidence” into validated evidence. |
| Track parser model | `lib/track-processing.ts` `KmlPoint {lat,lon,alt:number|null,time:string|null}` and `parseKml` | Distinguish absent altitude `null` from measured numeric zero. `gx:coord` source height semantics, sensor accuracy, geodetic datum, AGL/MSL, smoothing, integrity and aircraft applicability remain **UNKNOWN unless independently evidenced**. |
| D4.1 hard lineage | `research/gps-detection-r21/multi-gx-track-lineage.ts`, `GPS_D4_MULTI_GX_SIDECAR_V1` | Exact source→canonical index parity; D4.1 blocked source edges (block, cross-block dedup, height conflict, same-JS-ms UTC collision) are hard evidence breaks. |
| D4.3-R1 source coverage | `research/gps-detection-r21/stage-d43-r1-coverage.ts`, `GPS_D43_R1_SOURCE_COVERAGE_V1` | Reports canonical source fix adjacency, V2-invalid >=60s velocity edges and speed anomalies, actual within-block elapsed intervals. An ordinary V2-eligible edge **does not prove continuous motion**. |
| V2 horizontal comparator | `lib/gps-v2-advisory.ts`, `GPS_V2_HORIZONTAL_V3` | Horizontal STOP_GO logic targets low-speed sequence, **not a rolling T&G classifier**. Native multiple gx:Track is `UNAVAILABLE / UNSUPPORTED_SOURCE`, feature flag OFF, D3 pilot candidates HIDDEN. |
| Historical reliability governance | `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md`; `tests/v351-gps-tg-reliability.test.ts`, `tests/track-processing.test.ts` | Legacy's 2026-09 source-backed hotfix limited the altitude-jump guard to the *qualifying evidence span* and preserved old thresholds. Other point-count/one-edge limitations remain research questions, **not permission to relax**. |

## 3. Source limitations and non-authoritative vocabulary

**Observation** = the source contains a time/coordinate and an optional altitude value for a canonical fix; parser parity is **not** authenticity or accuracy. **Observed altitude difference** = numeric subtraction of two source values, not calibrated vertical displacement or descent rate. **Local shape** = a descriptive pattern in an adequately indexed sequence. **Source discontinuity** = known invalid link by provenance or explicit time/collision/altitude evidence. **No shape in analyzed window** is not “no landing”. **No window analyzed** is not “negative”.

**Forbidden false certainty:** Avoid `TOUCHDOWN_CONFIRMED`, `LANDED`, `NO_TOUCHDOWN`, `FALSE_POSITIVE`, `FALSE_NEGATIVE`, altitude `AGL` or `MSL`, runway elevation, “2–5m source noise”, or exact physical contact time unless a named verified independent source supports it. Never describe R2 results as aviation source-backed operational guidance, regulator approved, or a certified EFB.

Always distinguish:
- `SOURCE_PARSED` (syntactic/canonical provenance) from `SOURCE_QUALITY_UNKNOWN` (measurement authenticity/datum/precision not established);
- `OBSERVED_ALTITUDE_SHAPE` / `QUALITY_INCONCLUSIVE` from `PHYSICAL_CONTACT_UNRESOLVED`;
- `NO_RESEARCH_SHAPE_EMITTED` from a verified no-touchdown negative label.

All output modes permanently set `canAffectCanonicalFlight=false`, `physicalContact=UNRESOLVED`, `actualLandings=UNAVAILABLE`, `recencyEvidence=UNAVAILABLE`.

## 4. Design options and tentative recommendation

**A. Legacy-positive-only audit:** annotate the 21 provisional legacy proposals using D4.1/R1 lineage and independent altitude edge-quality. Smallest scope, but cannot inspect rejected/near-miss shapes (notably the owner-reported sample07 missing event) and biases the corpus toward emitted candidates. **Not sufficient alone.**

**B. Recommended *two-pass, observation-only research*** (needs independent review and owner implementation approval):

1. **Source-height evidence inventory, entirely candidate-independent:** per source run and manual flight partition count valid / null / numeric-zero altitude fixes; categorize source edges as D4.1 hard-break, same-ms UTC, alt-conflict, existing V2-invalid timing, 0<Δt<=15 with derivative above legacy 25m/s, Δt>15 unassessed by legacy derivative, and valid endpoint-to-endpoint Δalt. Never connect across hard breaks. Source-local sorted relative fix indices and *durations only* in private memory; output anonymous aggregates. A clean altitude column still has unknown datum/accuracy. Every unobserved interval remains unobserved, irrespective of cadence.
2. **Frozen legacy evidence-shape comparison (read-only, independent disposition):** compare accepted legacy rolling-altitude suggestions and **possible geometry matches rejected by pre-existing conditions**, exposing qualifying descent and climb anchors, intermediate timed climb presence, local minimum source heights relative to that candidate, evidence-edge breaks and exact reason vocabulary. This must not silently introduce a new rolling T&G event selector. Proposed raw-extrema enumerator, if ever added, is **not an event generator**: it returns only `SOURCE_GEOMETRY_WINDOW` with its fixed source-index evidence range and an audit trail of which existing legacy conditions are satisfied, failed, unavailable or not assessed. Source window count != landing count.
3. Never convert “geometry evidence survives exclusions” into `accepted` operational T&G. No algorithm success metric without independent contact-negative examples; no adjusting legacy thresholds to make six flight traces look correct.

**C. Invent a new altitude model / tune shape thresholds or smoothing now:** premature given unknown altitude datum/precision and absent independent ground truth. **Defer.**

**Proposal:** Option B with *separate approval of inventory before an optional geometry comparison*, rather than writing both layers and interpreting all minima as possible landings on day one. R2-0 is DESIGN/REVIEW now; R2-1 inventory and R2-2 comparison require explicit authorization after review.

## 5. Proposed data contracts (DESIGN ONLY; no types implemented)

### R2-1: quality inventory

**Input:** exact original local KML text (bounded to D4.1 limits), optional explicit validated manual split cuts, optional exact source/upload/split revision binding, pinned parser/legacy/reference revisions. **Do not trust caller-provided canonical arrays or pre-validated status.** Recompute D4.1 and R1 (or functionally identical read-only evidence) on exact source and fail closed on any mismatch or unsupported source.

**Output internal:** per-fix index / source block ordinal / split partition, validity of altitude null/numeric zero/finite, time ordering and actual Δt, D4.1 blocked edge reasons, published old V2 time-speed admissibility, historical derivative guard scoped to its explicitly declared window, `observedPairAltitudeDifference` only where both endpoints valid. Do not compute missing data as zero; no interpolated altitude through a gap.

**Output public/redacted CLI:** anonymous sampleNN, document and algorithm revisions, counts of altitude present/null/zero, count of D4.1 hard-break edges, count of legacy-window >25m/s source derivative hits, number of positive intervals *not examined by legacy guard because dt>15s*, source within-block time cadence aggregates, `QUALITY_UNKNOWN` and `CONTACT_UNRESOLVED`. Do not print GPS positions, source altitude values, original UTC, original filename/path, registration, raw track, pilot identifier or raw source fingerprint. Detail-level relative-index output must remain local with explicit privacy controls, not automatic Git output.

**Status:** `SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY` or `UNAVAILABLE` with precise bounded reason, not “VALIDATED_ALTITUDE”.

### R2-2: optional geometry comparison

**Input:** complete verified R2-1 source quality + exact source text, split mapping, same revision binding; optional *independent* pilot assertion supplied separately with provenance, never as model truth. Legacy emitted proposals are recorded separately from R2 geometry-only windows.

**Per-window detail (local-only):** `windowId` derived from canonical index + reference revision, `candidateMinimumIndex`, `descentAnchorIndex`, `climbAnchorIndex`, `intermediateClimbObserved`, `referenceLegacyPredicateChecks` (`PASS/FAIL/NOT_ASSESSED` for 28–145 km/h, 30m descent/climb, local extrema, sustained/intermediate timing, neighbor grouping, within-span >25m/s guard), `sourceQualityReasons`, `coverageEdgeDependencies`, `disposition`.

**Proposed dispositions:** `SOURCE_GEOMETRY_OBSERVED`, `INCONCLUSIVE_SOURCE_QUALITY`, `INSUFFICIENT_OBSERVATIONS`, `NOT_ASSESSED`. They describe *observed source shapes only*; none indicates contact or a positive landing. `NO_GEOMETRY_WINDOW` is distinct from `NO_TOUCHDOWN`.

**Hard-break policy:** geometry evidence spans cannot cross D4.1 block break/cross-block dedup, conflicted altitude, same-JS-ms timestamp collision, manual split, or any explicitly quarantined interval. A 35s endpoint gap may be analyzed only as two endpoints with unknown intervening movement; it never supplies proof of smooth continuous descent/climb. If a 25m/s condition on an applicable 0<dt<=15s pair inside qualifying geometry window is exceeded, return `INCONCLUSIVE_SOURCE_QUALITY / ALTITUDE_DISCONTINUITY`; **do not omit the failing window from diagnostic inspection** and do not count it as a T&G. Missing altitude, absent time, unsupported datum/precision, and insufficient source coverage yield explicit unavailability or inconclusive, not fabricated flat height, negative label or zero.

**Staleness:** local equality token over exact source text, source parser/R1/legacy/R2 revision, uploaded source identity if caller provides it, validated splits. Any changed input or algorithm revision invalidates the analysis. Fingerprint equality is NOT sensor authentication.

## 6. Source-specific review controls (not fitted target labels)

| Anonymous source | Known facts | Design acceptance / DO NOT |
| --- | --- | --- |
| sample03 | Existing legacy 1 provisional altitude T&G, horizontal V2 STOP_GO 0; R1 median 2.01s/max 20.17s | Review actual quality of source shape. Do NOT force `NONE` or an accepted contact. |
| sample04 | Legacy 1 provisional; R1 median 1.6s/max 20.84s, 1 invalid V2 time edge | Do not assume invalid edge is within source block; must trace edge provenance. |
| sample05 | Legacy 10 provisional; 3 blocks; R1 491.57s longest within-block interval | Never bridge missing 491.57s or treat 10 legacy proposals as verified touchdowns. |
| sample06 | Legacy 0; R1 74 canonical fixes, 50.09s longest | Legacy zero is neither an R2 negative control nor proof no altitude minimum. |
| sample07 | Legacy 6 provisional; owner-reported additional rolling maneuver; independently reported in-span `~28.85m/s` height derivative vs legacy 25m/s guard | Retain `INCONCLUSIVE / ALTITUDE_DISCONTINUITY` within specifically evidenced rejected geometry span. Do not relax guard or set fake contact time. |
| sample08 | Legacy 3 provisional; R1 94.39s and 35.35s within-block intervals | Report both interval endpoints and unobservable periods. Do NOT presume any missing rolling event occurred. |

The original source KML remain private owner-local. Pilot labels are `PILOT_REPORTED` without independently verified physical-contact evidence. Do NOT publish precision, recall, sensitivity, false positives or false negatives.

## 7. Required acceptance matrix for any future R2 coding (all PLANNED / NOT RUN)

| ID | Planned test |
| --- | --- |
| R2-01 | Strict source→canonical parity and frozen D4.1/R1/V2/legacy revisions; no trust in supplied canonical |
| R2-02 | A source with valid finite altitudes gives **quality inventory**, not touchdown status |
| R2-03 | Missing/null altitude vs legitimate numeric zero never coalesces |
| R2-04 | Multiple gx:Track blocks and 4.9s boundary never form one altitude evidence span |
| R2-05 | Cross-block collapsed duplicate must quarantine neighboring source evidence edges |
| R2-06 | Duplicate retained height conflict invalidates shape evidence, preserves canonical height |
| R2-07 | Two timestamps differing only below JS ms with different points quarantine motion/altitude |
| R2-08 | Invalid or missing datetime and reversed source order fail closed |
| R2-09 | 35.35s source interval is reported as between-observations UNKNOWN, **not** a new global gap threshold |
| R2-10 | 94.39s and 491.57s intervals visible without extrapolating altitude or movement |
| R2-11 | Existing `>25m/s` applies only when `0<dt<=15s` and relevant window is explicitly bounded |
| R2-12 | A 16s / 35s interval is NOT evaluated by legacy derivative guard, but is not called clean or continuous |
| R2-13 | True in-window 25m/s breach: source-quality INCONCLUSIVE, never automatic contact |
| R2-14 | Legacy out-of-span near-zero-timestamp corruption does not retroactively invalidate unrelated geometry |
| R2-15 | No 30m climb from one isolated post-minimum edge qualifies as established sustained climb |
| R2-16 | sample07 quality anomaly visible under correct evidence-span scoping; no forced positive |
| R2-17 | sample03/sample08 legacy proposals assessed from actual shape; no pre-imposed NONE |
| R2-18 | Taxi-only, high-speed low pass, go-around and normal landing controls never acquire contact authority |
| R2-19 | Missing source accuracy/datum leads explicit UNKNOWN without inventing AGL/MSL/ellipsoid/noise model |
| R2-20 | Zero emitted shapes, unsupported source, non-observable gap, pilot negative and independently corroborated negative remain distinct |
| R2-21 | Explicit manual split cuts independent from source block cuts and stale on edits |
| R2-22 | Local reports redact path, UTC, raw height, coordinates, registration, source hash and pilot identity |
| R2-23 | Batch and seeded synthetic shapes deterministic, counterexamples cannot silently change legacy outputs |
| R2-24 | Static/behavior checks: no imports from research into lib/app/UI/DB; original native V2 multi-block still UNSUPPORTED_SOURCE |
| R2-25 | Prior D4.3-R1 107/107 targeted Node and TypeScript remain unchanged if future code added; no PASS claim before rerun |
| R2-26 | Source source-shape reports do not affect actual landing count, recency, flight splits, aircraft profile or persistence |

**Acceptance for R2-0 design:** actual code inventory, constraints, options and test matrix documented and independently reviewed; product-owner decisions captured BEFORE R2-1 coding. A reviewer approving this design does **not** enable R2-2 geometry generator or production.

## 8. Roadmap, dependencies, risks and owner gates

**R2-0 (NOW):** freeze draft design and send to DeepSeek as a **read-only independent architecture/source-data reviewer**. Address conflicts with actual `lib/track-processing.ts` and evidence documents. Update proposal before implementation.

**R2-1 (PROPOSED, NOT APPROVED):** source-altitude quality inventory, read-only under `research/` with synthetic tests, privacy-safe local CLI and six private KML diagnostic acceptance. No geometric proposal generator. Owner approves R2-1 scope separately.

**R2-2 (FUTURE/CONDITIONAL):** geometry-vs-legacy comparator that can explain *rejected shapes* only when a reviewed evidence-window identity and finite reason vocabulary exists. New owner approval and review after R2-1 corpus. No new touchdown selector.

**D4.3-R3 (PARALLEL PRIVATE EVIDENCE):** collect tiered independently corroborated contact/non-contact examples; make actual sensor/source provenance first-class. Merely more of the same GPS track is not independent touchdown truth. Avoid fake DEVICE_CERTIFIED tier; ADS-B alone cannot prove wheel contact.

**Future product design/integration:** distinct milestone, explicit owner approval, frozen policy changes through roadmap first; full Node/domain/source/browser/flag ON/OFF/DB/migration/deploy prerequisites. No merge/deploy implied by design review.

**Risks:** hidden reuse of legacy absolute `landingCount` authority; counting missing as zero; conflating altitude extrema with runway contact; overfitting six flights; upstream KML datum unknown; source irregular cadence, ±10-point locality, >15s skipped derivative guard and same-ms collisions; unclear independence of pilot labels; privacy exposure from absolute timestamps and GPS height.

## 9. Closing ledger

**This document is a design artifact only** on the research Draft PR, authored after D4.3-R1 closure. R2 source code, CLI, tests, owner-private KML R2 evaluation, TypeScript, full suite, build, Playwright, CI, DB migrations, release, merge and deploy: **NOT RUN / NOT IMPLEMENTED / N/A as applicable**. The prior R1 107/107 PASS and 6/6 source diagnostics refer to earlier verified source HEADs, NOT a claim of R2 detection success. **Current production remains unchanged.**
