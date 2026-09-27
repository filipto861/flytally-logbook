# GPS Touch-and-Go Detection Reliability

**Status:** Priority 1 fix-design candidate  
**Last reconciled:** 27 September 2026

This document owns the detailed investigation, fix-design and acceptance contract for the reported GPS landing-count mismatch. `ROADMAP.md` carries only priority and phase status.

## Problem

A real GPS import produced the wrong landing count during touch-and-go operations.

Current landing suggestion is advisory:

`1 final landing + detected touch-and-go events`

The user can review/edit it, but a wrong suggestion can still become incorrect logbook evidence if accepted unnoticed.

## Real-track reproduction — CONFIRMED

Source: user-provided KML, analyzed read-only. The full personal route is not intended to become a committed regression fixture.

Observed real-world sequence:
- high-speed low pass around **15:45:30 UTC** — must **not** be counted as T&G;
- rolling T&G detected around **16:05:53 UTC**;
- real rolling T&G around **16:09:57 UTC** — currently **missed**; altitude minimum in source data is around **16:09:42 UTC**;
- rolling T&G detected around **16:13:26 UTC**;
- final landing.

Current suggestion:
- 2 detected T&Gs + final landing = **3 landings**.

Expected:
- 3 T&Gs + final landing = **4 landings**.

For the missed candidate around 16:09:
- smoothed groundspeed ≈ **101 km/h**;
- descent before minimum ≈ **176 m**;
- climb after minimum ≈ **119 m**;
- existing 28–145 km/h and 30 m descent/climb requirements are therefore satisfied.

The high-speed low pass remains correctly excluded at approximately **209 km/h**, above the existing 145 km/h rolling-T&G ceiling.

## Confirmed root cause

The missed candidate is rejected by `hasImplausibleAltitudeJump()`.

Roughly 50 seconds after the actual candidate minimum, the KML contains two almost simultaneous samples:

- `16:10:32.207...`
- `16:10:32.208...`

with:
- Δt ≈ **0.001 s**;
- altitude ≈ **343.29 → 348.39 m**;
- Δalt ≈ **5.10 m**.

The resulting derivative is numerically extreme:

`5.10 m / 0.001 s ≈ 5100 m/s`

The current guard inspects **±10 array points** around the candidate. Because this track is irregularly sampled, that point-count neighborhood spans roughly **95 seconds** in this region, so the unrelated pair ~50 seconds later is treated as if it were local touchdown evidence.

Control result:
- if only this false discontinuity rejection is removed, the existing detector identifies the three expected rolling T&Gs;
- the high-speed low pass remains excluded without changing speed or altitude thresholds.

Therefore the specific defect is reproduced and the locality failure is confirmed.

## Current detector behavior

### Speed / ground-event path

Current source behavior uses:
- speed below 20 km/h;
- evidence of >42 km/h movement before and after;
- a 5–90 second ground event.

### Rolling altitude path

Current source behavior uses:
- groundspeed 28–145 km/h;
- a local altitude minimum;
- at least 30 m descent before the minimum;
- at least 30 m climb after it;
- rejection around implausible altitude discontinuities.

Current rolling-T&G implementation also contains other point-count windows:
- ±10 points for altitude history/future qualification;
- <8 points for candidate grouping;
- ≤10 points for speed/altitude duplicate suppression.

Those are architectural debt hypotheses only. This real failure does **not** prove they are defective.

## Independent review

Claude independent review returned **APPROVE WITH CHANGES**.

Accepted review conclusions:
- do not change the 28 / 145 km/h speed thresholds;
- do not change the 30 m descent/climb thresholds;
- fix the discontinuity guard locality rather than tuning thresholds to this flight;
- derive the relevant discontinuity region from the candidate's own descent/minimum/climb evidence rather than a fixed global time window;
- leave the other point-count windows unchanged unless new regression evidence implicates them;
- preserve the existing true-altitude-discontinuity regression and run the complete GPS/track regression corpus.

### Repository reconciliation

One additional repository fact materially constrains the implementation:

`hasImplausibleAltitudeJump()` is used by **both**:
1. rolling touch-and-go detection; and
2. take-off evidence detection.

Therefore this milestone must **not** globally change the generic helper's neighborhood semantics in a way that silently changes take-off detection.

The minimal implementation should either:
- introduce a T&G-specific bounded discontinuity helper; or
- parameterize the generic helper with an explicit range while preserving the current take-off call behavior exactly.

### Minimum-dt recommendation — not adopted as a permissive rule in this batch

Claude also recommended ignoring derivative calculations below a minimum meaningful Δt.

That recommendation is **not frozen as part of this fix**.

Reason:
- the proven wrong classification occurs because a timing/altitude anomaly **outside the physical T&G evidence span** is allowed to invalidate the candidate;
- if a near-zero timestamp anomaly occurs **inside** the actual touchdown evidence span, treating that evidence as unreliable and conservatively rejecting the automatic T&G suggestion is acceptable under FlyTally's fail-closed rule;
- globally ignoring very-small-Δt pairs could make both T&G and take-off detection more permissive, and no current repo evidence requires that behavior.

Near-zero timestamp handling remains tracked technical debt. It can be promoted later if a reproduced in-event false rejection or broader track-quality evidence justifies it.

## Frozen fix invariant

A rolling T&G candidate may be invalidated by an altitude discontinuity only when that discontinuity belongs to the **same physical descent → local minimum → climb evidence span** that qualified the candidate.

An anomaly outside that evidence span must not invalidate the candidate merely because it falls within an arbitrary number of array indices.

Uncertain/corrupt timing **inside** the evidence span may still fail closed.

## Candidate evidence bounds

Keep the existing qualification thresholds unchanged.

For a candidate at index `i`:

1. Within the existing left qualification window, identify the **nearest preceding point** whose altitude is at least `candidate + 30 m`.
2. Within the existing right qualification window, identify the **nearest following point** whose altitude is at least `candidate + 30 m`.
3. These two points define the physical descent/climb evidence span already required by the current detector.
4. The T&G discontinuity guard inspects consecutive altitude segments inside that span, plus immediate boundary continuity as required by implementation design.
5. Do not inspect unrelated later/earlier points merely because they are within ±10 indices of the candidate.

This keeps the existing 30 m evidence rule while removing the proven point-index locality defect.

## Scope decision

| Item | Decision |
| --- | --- |
| T&G discontinuity guard locality | **FIX NOW** |
| Preserve take-off guard behavior | **FIX NOW / REQUIRED** |
| Minimum-dt permissive handling | **DEFER** |
| Altitude qualification ±10-point windows | **DEFER** |
| Candidate <8-point grouping | **DEFER** |
| Speed/altitude ≤10-point duplicate suppression | **DEFER** |
| 28 / 145 km/h rolling speed thresholds | **DO NOT CHANGE** |
| 30 m descent/climb thresholds | **DO NOT CHANGE** |

## Regression matrix

Mandatory before merge:

1. **Reported failure shape — anonymized/minimal**
   - preserve irregular timestamps, descent/minimum/climb shape and the distant near-zero-timestamp pair;
   - expected: the middle T&G is detected;
   - combined representative sequence yields 3 T&Gs + final landing = 4 landings.

2. **True nearby altitude discontinuity — existing regression**
   - existing ≈127 m / 2.5 s discontinuity remains rejected;
   - expected: `touchAndGoEvents = []`, `landingCount = 1`.

3. **High-speed low pass**
   - representative ≈209 km/h low pass remains **not T&G**.

4. **Ordinary clean rolling T&G**
   - current clean synthetic rolling event remains detected.

5. **Irregular benign sampling**
   - irregular intervals without relevant corruption do not change classification.

6. **Sampling-density locality variants**
   - equivalent T&G evidence with the unrelated bad pair at different array-index distances must not change candidate classification once that pair is outside the physical evidence span.

7. **Partial/no altitude**
   - existing conservative fallback behavior remains unchanged.

8. **Manual split behavior**
   - existing split/T&G regression remains unchanged.

9. **Take-off guard non-regression**
   - the T&G locality fix must not alter current take-off evidence behavior or the v1.38.2 taxi-spike/take-off regression.

10. **Boundary continuity**
   - a true discontinuity inside the physical evidence span rejects the candidate;
   - a discontinuity outside that span does not reject it solely due to array proximity.

## Implementation plan

### Batch A — regression first

- derive a minimal anonymized fixture from the real failure shape;
- add the missed-middle-T&G regression;
- add/retain the low-pass non-T&G guard;
- add evidence-span inside/outside boundary regressions;
- add explicit take-off non-regression coverage if existing coverage is insufficient.

The reported-case regression must fail against current `main` before runtime logic changes.

### Batch B — minimal detector correction

- keep rolling speed and altitude thresholds unchanged;
- identify nearest left/right points that satisfy the existing 30 m descent/climb evidence;
- evaluate T&G altitude discontinuities only across the physical evidence span;
- keep take-off discontinuity behavior unchanged;
- do not touch unrelated point-count grouping/dedup rules.

### Batch C — verification

Required evidence:
- targeted new GPS tests;
- complete existing GPS/track regression corpus;
- complete unit/regression suite;
- TypeScript;
- production build;
- browser smoke for GPS import/review if the repository gate runs it;
- no DB migration;
- ROADMAP / FEATURES / CHANGELOG / this contract reconciled in the same work cycle.

## Acceptance

- exact reported failure shape fails before the fix and passes after it;
- all three real rolling T&G shapes remain detectable while the high-speed low pass remains excluded;
- existing true-discontinuity protection remains intact;
- the T&G fix does not change take-off inference behavior;
- previously-correct GPS/track regression corpus stays green;
- no unrelated threshold or grouping behavior changes;
- automatic landing count remains advisory and reviewable;
- detector uncertainty remains conservative;
- verification is reported only for checks actually run.

## Deferred technical debt

Track separately; do not silently pull into this milestone without new evidence:

- point-count altitude qualification windows;
- point-count candidate grouping;
- point-count speed/altitude duplicate suppression;
- explicit near-duplicate timestamp quality classification;
- broader time-normalized detector refactor.

## Production follow-up

No new user telemetry is required by this milestone.

If a future product decision introduces privacy-safe aggregate quality telemetry, suggestion-correction rate could be useful evidence, but it is not a prerequisite for this fix.
