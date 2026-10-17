# GPS Detection 2.0 — R2.1a Batch 4: landing-count integrity and T10 comparison

**Status:** IMPLEMENTED IN RESEARCH BRANCH / NEW TESTS **NOT RUN**.  
**Date:** 2026-10-17  
**Owner decision:** user delegated resolution of T10/T14 contract ambiguity to the assistant. Resolved under project fail-closed and certified-record integrity rules.  
**Branch:** `test/gps-detection-r21-falsification`, Draft PR #350. Source baseline unchanged production `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.  
**Dependencies:** PR #349 R2.1a contract, [coverage audit](GPS_DETECTION_2_0_R2_1A_COVERAGE_AUDIT_2026-10-17.md), existing prior [Batch 3 verification](GPS_DETECTION_2_0_R2_1A_BATCH3_2026-10-17.md).

## 1. Final product/engineering decision — two different counts

1. `AdvisoryPatternCount` counts **candidate motion patterns inside observed, valid GPS islands only**. It can be `AVAILABLE(0)` even when a track ends during climb or starts during approach. This is **not** zero takeoffs/landings and is never a full-flight movement count. The scope `OBSERVED_VALID_ISLANDS_ONLY` stays explicit and distinct from logbook/recency facts.
2. **Whole-flight physical landing count is `UNAVAILABLE` from bare GPS.** If the track is known cropped/incomplete, reason `INCOMPLETE_TRACK`; if source coverage is unproven, `COVERAGE_UNVERIFIED`. Even externally verified complete source coverage cannot prove gear contact and yields `PHYSICAL_CONTACT_UNVERIFIED`. This is not an assertion that no landing occurred.
3. A human/independent evidence record may confirm movement counts through canonical logbook workflows with server-side validation, owner scope, review and certified-record audit rules. **The research engine has no implicit conversion or write path for that evidence**; confirmation is separate. Do not invent such a record from sparse timestamps or airport MSL elevation.
4. Continue emitting useful `T_G_PATTERN_CANDIDATE` / `STOP_GO_PATTERN_CANDIDATE` as motion evidence, with `physicalContactStatus=UNRESOLVED`. `UNAVAILABLE` for whole-flight count does **not** suppress these advisory pattern hypotheses.
5. The initial R2.1a experiment is not permitted to change existing production `landingCount()`, GPS import, `civil-twilight`, recency, certified records or aircraft Training. Legacy continues unchanged and is not called authoritative evidence of real contact.

This reconciles T14: `PATTERN_ONLY AVAILABLE(0)` can be correct for an observed quality island; a complete-flight `LANDING_COUNT=0` cannot be justified and remains absent/`UNAVAILABLE`.

## 2. Code and test additions

### `research/gps-detection-r21/flight-count-contract.ts`

Pure source-only contract `FlightCoverageEvidence` and `WholeFlightLandingCountFromGps`; `separateGpsCounts()` exposes different tagged `observedPatterns` and `wholeFlightLandings`. `WHOLE_FLIGHT_LANDING_COUNT` offers only `status: UNAVAILABLE`; deliberately **no numeric `value` property**, preventing accidental reuse as a certified movement count. Even `COMPLETE_INDEPENDENTLY_VERIFIED` coverage does not infer physical touchdown.

### `research/gps-detection-r21/legacy-pattern-comparison.ts`

Read-only fixture comparison invokes `shadowComparePoints` on the exact same already-normalized `KmlPoint[]`, and compares research `T_G_PATTERN_CANDIDATE` / `STOP_GO_PATTERN_CANDIDATE`. Each row retains `legacyTouchAndGoCount`, **legacy suggested landing count** separately, research pattern counts, `PATTERN_ONLY` availability, and `preprocessingConfound: NOT_ISOLATED`. The top-level type states `FIXTURE_ONLY_PATTERN_DIAGNOSTIC_NOT_EVENT_ACCURACY`, no independent holdout, no contact truth. Totals separate synthetic pattern-positive, synthetic no-pattern, historically documented legacy-miss shape, and unlabeled fixtures. These are **not** flight-level event precision/recall metrics.

The known historical `+11` rolling T&G shape is reconstructed from the already checked-in, documented [v351 regression fixture](../../tests/v351-gps-tg-reliability.test.ts). The v351 regression proves **legacy does not report a T&G for that shape**; the new experiment now has a test that requires **at least one research T&G motion-pattern hypothesis** on that same shape. This is a meaningful falsification of the old missed-pattern behavior, **not proof of touchdown timing or real-world model sensitivity**.

### `tests/gps-detection-r21-batch4.test.ts`

**Seven new authored synthetic regression tests, unexecuted at time of writing**:
1. Incomplete trace: observed-island pattern count may be available 0; whole-flight landing count unavailable with incomplete reason and no `value`.
2. Unknown coverage: cannot manufacture landing count.
3. Explicit independently verified complete coverage: GPS still cannot prove physical contact.
4. T10: legacy must report zero T&G for the known missed shape while new research provides >=1 *unresolved* T&G pattern. This assertion must **not** silently be weakened to `island length > 0` if it fails.
5. Structured fixture comparison: positive/no-pattern/known miss/unlabeled denominators and `NOT_ISOLATED` preprocessing confound.
6. Empty GPS: old `landingCount([])=1` must remain solely a legacy suggestion and is not new evidence; research count is unavailable.
7. Duplicate fixture IDs rejected to avoid favorable double counting.

No new thresholds and no changes to prerecorded pattern-positive / pattern-negative fixture expectations. The experimental model selection remains **NOT FROZEN**.

## 3. Evidence status and next verification

**Previously owner-local verified** on exact clean SHA `9c0f423f1f924b40ded62f198226b338db91aa48`: **48/48 targeted Node tests PASS, 0 failed/skipped**, `npm run typecheck` PASS. Source/existing tests were rechecked through GitHub; this is **owner-local, not CI**.

**Current Batch 4 HEAD:** code and 7 added tests are committed but **targeted tests and TypeScript NOT RUN on this new HEAD**. Anticipated test total: **55** (48 prior + seven newly authored), conditional on successful test collection. No full Node build/Playwright/Postgres acceptance test, no real event truth, no private source export or model training.

Before any follow-up changes:
```powershell
git fetch origin
git switch test/gps-detection-r21-falsification
git pull --ff-only
$expected = "<BATCH4_HEAD_SHA_FROM_PR350>"
if ((git rev-parse HEAD).Trim() -ne $expected) { throw "Unexpected HEAD" }
if (git status --porcelain) { throw "Working tree not clean" }
npm run test:target -- tests/gps-detection-r21.test.ts tests/gps-detection-r21-batch2.test.ts tests/gps-detection-r21-scorecard.test.ts tests/gps-detection-r21-batch4.test.ts tests/gps-detection-r21-shadow.test.ts tests/gps-detection-r21-boundary.test.ts tests/v351-gps-tg-reliability.test.ts
if ($LASTEXITCODE -ne 0) { throw "GPS targeted tests FAILED" }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "TypeScript FAILED" }
```

On test failure: inspect exact fixture and code semantics. **Do not change the T10 pattern assertion, safety invariants or preregistered thresholds merely to manufacture PASS.** Classify `MISS` honestly if the model does not recover this shape; no retroactive accuracy claim.

## 4. Remaining scope / conditions

- Contract gaps A07/A08 (go-around/low-approach classification) and full source accuracy/elevation/reference proof are **NOT IMPLEMENTED**. T19, full sampling-stability metric and genuine independent event truth remain **OPEN**; T20 HMM **N/A** to R2.1a.
- End-to-end parser preprocessing cannot be isolated through stored normalized points; the shadow comparator remains labeled `NOT_ISOLATED`.
- GPS Detection R2.1a is an offline-only experiment. No merging PR #349/#350 or production deployment without another owner decision and verified whole-repo gating.
- Supplied per-owner/cross-user raw GPS records were **NOT accessed, exported or trained upon** in this batch.
