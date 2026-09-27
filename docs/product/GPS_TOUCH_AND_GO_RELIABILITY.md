# GPS Touch-and-Go Detection Reliability

**Status:** Priority 1 investigation contract  
**Last reconciled:** 27 September 2026

This document owns the detailed investigation/acceptance contract for the reported GPS landing-count mismatch. `ROADMAP.md` carries only priority and phase status.

## Problem

A real GPS import produced the wrong landing count during touch-and-go operations.

Current landing suggestion is advisory:

`1 final landing + detected touch-and-go events`

The user can review/edit it, but a wrong suggestion can still become incorrect logbook evidence if accepted unnoticed.

## Current detector behavior

Current implementation has two touch-and-go evidence paths.

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

### Known architectural risk to test

Several detector windows and duplicate-suppression rules are currently expressed in **point counts** rather than elapsed time/distance.

That means identical geometry sampled every 1 s, 5 s or 10 s can produce materially different real-time windows.

This is a credible hypothesis, not a declared root cause.

## Investigation sequence

No detector threshold changes before all applicable steps below are complete.

1. Reproduce the exact reported mismatch from the original KML/GPX/CSV.
2. Record the expected real-world take-off / touch-and-go / landing sequence.
3. Measure source sampling interval and any material gaps.
4. Inspect speed, altitude and timing around each expected and detected event.
5. Classify the failure:
   - missed touch-and-go;
   - false touch-and-go;
   - speed threshold / smoothing;
   - altitude quality;
   - point-count/sampling-rate sensitivity;
   - duplicate suppression;
   - track split behavior;
   - another evidence-backed cause.
6. Create the smallest anonymized/minimal regression fixture that preserves the failure shape. Do not commit unnecessary personal route/location history.
7. Design the smallest correction supported by the reproduced evidence.
8. Re-run the complete existing GPS/track regression corpus before release.
9. Where the failure implicates sampling rate, add equivalent-shape fixtures at materially different sample intervals and require stable event classification.

## Fix constraints

- Prefer elapsed-time/distance-normalized windows only when evidence shows point-count dependence is causal or unsafe.
- Do not weaken the altitude-discontinuity protection merely to make one sample pass.
- Do not infer regulatory movements from uncertain geometry.
- Automatic landing count remains advisory and reviewable.
- Manual correction remains available.

## Acceptance

- exact reported failure reproduces before the fix and passes after it;
- existing previously-correct GPS/track regression corpus remains green;
- false-positive behavior is not increased by the correction;
- if sampling-rate sensitivity is confirmed, equivalent event geometry produces stable classification across representative sampling intervals;
- split/quality guards remain intact;
- detector uncertainty stays conservative;
- typecheck, applicable tests/build/browser checks and documentation closeout are reported truthfully.

## Production follow-up

No new user telemetry is required by this milestone.

If a future product decision introduces privacy-safe aggregate quality telemetry, suggestion-correction rate could be useful evidence, but it is not a prerequisite for this fix.
