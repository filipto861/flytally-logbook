# GPS Detection 2.0 — R2.1a falsification contract coverage audit

**Date:** 2026-10-17  
**Tested SHA:** `9c0f423f1f924b40ded62f198226b338db91aa48`; **owner-local** 48/48 targeted tests PASS and `npm run typecheck` PASS; clean worktree and exact-SHA verified.  
**Audit status:** Read-only source/test/spec reconciliation after tests. **This document is not itself an additional executed test or an assertion that all fixture acceptance clauses passed.** Later documentation-only commits do not inherit an unexplained new execution claim.  
**Scope:** `flytally-logbook` Draft PR #350; base contract from Draft PR #349 [R2.1a falsification](https://github.com/filipto861/flytally-logbook/blob/docs/gps-detection-2-research-r0-r1/docs/product/GPS_DETECTION_2_0_R2_1_OFFLINE_BENCHMARK_CONTRACT_2026-10-17.md). No writes/exports of production GPS data.

## How to interpret coverage

- **COVERED (synthetic)** means a named test verifies the *material* required behavior on a generated scenario. It **does not** mean event-level aircraft truth or real-world superiority.
- **PARTIAL** means tests exist but one or more contract expectations are not asserted, some metadata are ignored, or the fixture is not the independent source scenario specified.
- **OPEN** means missing executable test/logic for the required behavior.
- **N/A** means explicitly deferred outside R2.1a.
- Test cases can cover multiple scenario IDs; **48 passing Node tests is not 48 independently validated aviation cases**, and a contract row may still be partial.
- **NOTE:** The research detector currently outputs only `T_G_PATTERN_CANDIDATE` and `STOP_GO_PATTERN_CANDIDATE`. It never yields a confirmed ground contact, go-around or low-approach type. `SourceMetadata` is accepted by type but the implementation does not yet use its quality fields in pattern inference.

## T01–T20 contract matrix (actual implementation/fixture coverage)

| ID | State | Evidence and gap |
|---|---|---|
| T01 | PARTIAL | Empty/single samples correctly unavailable; explicit multi-point missing time also tested in T18, but no combined fixture coverage of every edge-case subcondition |
| T02 | COVERED | Duplicate time yields `NON_MONOTONIC_TIME`, no fabricated speed=0 |
| T03 | PARTIAL | Backward source timestamps flagged; acquisition order origin and end-to-end source parser normalization provenance not recoverable from normalized tracks |
| T04 | COVERED | Valid-time stationary points, no false T&G |
| T05 | COVERED | Numeric altitude zero is retained; nullable altitude remains null in research model |
| T06 | COVERED | Altitude step marks unusable edge; no candidate in tested regression |
| T07 | COVERED | Sawtooth altitude edge rejection on synthetic climb |
| T08 | PARTIAL | Duplicate/stale fix quality check and retained legacy v351 regression; candidate-level comparison with identical original track conditions not scored |
| T09 | PARTIAL | Synthesized five-pattern circuit emits advisory candidate(s) and T09 utility passes; test does not independently establish touchdown, score event-time accuracy, or verify all five pattern events against independent truth |
| T10 | **OPEN (meaningful usefulness assertion)** | Named test checks only that returned candidates (if any) are unresolved and at least one island exists; it does **not** assert that the documented missed rolling T&G is recovered, counted as a miss or abstained for a specific reason. Avoid treating this test as a new-recovery PASS |
| T11 | PARTIAL | Synthetic horizontal stop/go yields a typed supported candidate; not independent runway contact proof |
| T12 | PARTIAL | No `AGL` returned, datum unknown retained by type; actual source altitude-mode parser preservation, airport/reference applicability and contradictions not implemented |
| T13 | PARTIAL | Gap split and no support spanning gap are tested; no exported explicit `GAP_UNKNOWN` phase segments, gap-adjacent provenance is generic invalid-edge Boolean |
| T14 | **OPEN (count/coverage semantics)** | Cropped climb/end has no fake landing candidate; however `AdvisoryPatternCount` can be `AVAILABLE(0)` over valid islands rather than `UNAVAILABLE` for incomplete **flight** coverage. The current type is **pattern count scoped to observed valid islands**, not a full-flight landing count. Reconcile contract wording and coverage state before runtime use |
| T15 | PARTIAL | Ground-only taxi trace yields no candidate; isolated high-speed outlier branch needs its own explicit fixture |
| T16 | PARTIAL | Identical copied GPS yields identical unresolved hypotheses; independently distinct contact/no-contact truths are not represented in fixture data |
| T17 | PARTIAL | Resampling invariants and no contact confirmation tested; count/window-overlap/abstention differences are **not explicitly scored** |
| T18 | PARTIAL | Explicit UTC offset and timezone-less input tested; UTC midnight transition fixture remains open |
| T19 | OPEN | Quantized/contradictory altitude and datum/reference weakness not directly exercised as specified |
| T20 | N/A | Future HMM gap-specific test, no HMM implemented |

## A01–A15 contract matrix

| ID | State | Evidence and gap |
|---|---|---|
| A01 | PARTIAL | Missing-altitude straight motion yields no vertical claim; horizontal-only speed-dip utility scenario with null alt is not directly covered |
| A02 | PARTIAL | `KNOWN/UNKNOWN` mode/datum metadata modeled; detector does not process metadata for quality policy, tests assert only no AGL/contact output |
| A03 | PARTIAL | Poor H accuracy represented in metadata but not used in runway-context gating; no runway assertion exists, so limited negative invariant holds |
| A04 | PARTIAL | Pattern-only count tagged and separate; multievent *flight-scoped count* and completeness validation not implemented |
| A05 | PARTIAL | Cropped takeoff-like trace has no invented landing candidate; see T14 coverage/count distinction |
| A06 | PARTIAL | Cropped landing-like trace has no invented takeoff candidate; see T14 coverage/count distinction |
| A07 | OPEN | `GO_AROUND_PATTERN_CANDIDATE` type/phase classifier not implemented; no case of differentiated go-around |
| A08 | OPEN | `LOW_APPROACH_PATTERN_CANDIDATE` type/phase classifier not implemented; ambiguity remains unresolved but not classified |
| A09 | PARTIAL | Negative numerical altitude preserved; explicit vertical-datum contradiction reason not implemented |
| A10 | COVERED | Horizontal teleport/bad coordinates yield invalid speed edge |
| A11 | COVERED | Repeated/quantized times yield invalid dt, no false zero-speed evidence |
| A12 | COVERED | Genuine stationary positions with valid time do not invent T&G |
| A13 | PARTIAL | No support over split island and conservative near-invalid-boundary `time=null`; Boolean `gapAdjacent` conflates actual time gap with teleport/altitude/time errors, lacks reason-coded boundary provenance |
| A14 | COVERED | T09/T11 pattern class pinned; all-abstain utility FAIL even if contact safety PASS |
| A15 | PARTIAL | Same synthetic trajectory with resampling produces no physical contact claim; detailed overlap/coverage/stability reporting absent |

## Batch 4 resolution to this earlier audit — code committed, NOT YET TESTED (2026-10-17)

The user delegated the T10/T14 decision. Under the fail-closed project contract, `AdvisoryPatternCount` remains **strictly observed-island motion-pattern count**, which may be `AVAILABLE(0)` for a cropped track. It is **not** a whole-flight count. `WholeFlightLandingCountFromGps` is a separately tagged, **always `UNAVAILABLE`** GPS-only assessment: incomplete track, unknown coverage, or independently verified complete coverage without observed gear contact. No numerical `value` is exposed for this latter assessment, and no bridge to persisted certified counts exists.

The previous **OPEN T10/T14** findings remain accurate **as of the tested Batch 3 SHA**, but a new untested [Batch 4 implementation and test package](GPS_DETECTION_2_0_R2_1A_BATCH4_2026-10-17.md) addresses them explicitly: the T10 test now requires legacy `0` T&G and at least one new unresolved T&G *pattern* candidate on the same historically documented synthetic +11 shape. It must not be confused with independent touchdown verification. The T14 tests assert separate pattern vs whole-flight count contracts with incomplete, unknown and independently verified full track coverage.

**Verification:** the previously executed Batch 3 owner-local 48/48 PASS and typecheck PASS remains valid for its exact SHA only. **New Batch 4 added tests, comparison totals and typecheck NOT RUN** at this documentation update. Update coverage status only after execution evidence; no code is production-integrated.

## High-risk gaps prioritized for subsequent decisions

1. **Correct label and assertion for T10.** Existing v351 fixture retains a *known missed* genuine T&G in legacy. Current new T10 test can pass even if the new detector emits zero T&G candidates. This cannot support a statement that R2.1a recovered the known miss.
2. **Pattern count vs complete-flight count.** `AdvisoryPatternCount` is intentionally distinct from `landingCount`; clarify whether `AVAILABLE(0)` for observed valid islands with a cropped flight is acceptable only as a **pattern count**, or whether count must fail closed when full-flight boundaries are missing. No silent conversion to certified landings.
3. **Explicit ambiguity classes.** No go-around/low-approach recognition; do not claim those features. The initial R2.1a experiment is primarily time/quality processing + T&G/stop-go pattern falsification. A07/A08 either need an approved extension or must be declared deferred.
4. **Source-accuracy provenance and origin.** Historical `SourceMetadata` fields are often unavailable and currently not used. A `KNOWN` struct in synthetic tests is not evidence that actual KML files contain usable source mode, precision or positional accuracy.
5. **Candidate timing semantics.** `gapAdjacent` currently means close to **any invalid signal-island edge**, not necessarily a GPS time gap. Before a public DTO, replace with reason-coded boundary evidence; supported time interval does not equal wheel-contact instant.

## Proposed next experimental decision (not implemented here)

- First settle strict semantics for **flight completeness vs observed-island pattern counts** and freeze any revised contract; owner remains final product decision maker.
- Then perform a *measured, fixture-only* **legacy vs R2.1a comparison** that records raw/normalized source scope, per-pattern support/false-positive and explicit abstention, including the documented T10 **known miss**, without editing test expectations to create success.
- Add negative controls and provenance conditions for missing/poor altitude metadata and position accuracy. No training of AI or assertion of physical contact from trajectory alone.
- Keep go-around/low approach as **separately reviewed additional scope**, rather than quietly expanding two-event research detector.
- **NO production deployment/merge** or model precision claims from this audit. Passing 48 tests and a clean TypeScript check are valid exact-SHA regression evidence, not a proof of full 35-case contract or external reliability.

**Source/evidence status:** source/test/contract review = **COMPLETED**; owner-local 48/48 and typecheck on `9c0f423f` = **PASS**; new code benchmark, real-event accuracy and production smoke = **NOT RUN / N/A**.

## Batch 5 status amendment — A13 reason-coded boundary evidence (2026-10-17; NOT YET EXECUTED)

The T/A matrix above preserves its historically verified state. Subsequently Batch 4 T10/T14 landed with owner-local 55/55 targeted PASS on exact `325fc921`; Batch R2.1b in-memory observational research landed with owner-local **63/63 targeted PASS + TypeScript PASS** at clean exact `8b410f32d207adab54d3b84b340275153d4b1731`. None of these old tests establishes physical gear contact, independent holdout, source-native altitude datum or real data-access security.

Batch 5 [source and 6-test contract](GPS_DETECTION_2_0_R2_1A_BATCH5_BOUNDARY_PROVENANCE_2026-10-17.md) is now authored on this research branch, **not yet run**. It directly targets previously **PARTIAL A13/T13** (distinct invalid-edge reason/side/index, candidate time suppression, island confinement, negative evidence forgery) and the documented concern that `gapAdjacent` could be misread as an actual time gap. Continue to mark full A13/T13 as **PARTIAL, pending exact-SHA test evidence**, and do not imply source acquisition provenance or independent event accuracy from this improvement.

**Remaining material gaps unchanged:** A07/A08 go-around/low-approach classification (separate approval), A02/A03 source metadata applicability, A15 resampling stability, T19 contradictory/quantized altitude, full-source provenance and real-event holdout. **Actual PG16 RLS / real owner GPS still NO-GO.** No unapproved production code/UI, DB, merges or deployment.
