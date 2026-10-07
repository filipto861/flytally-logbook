# 3.5.1 — GPS Touch-and-Go Reliability

**Status:** ACTIVE — regression-first implementation  
**Date:** 7 October 2026  
**Scope:** advisory GPS T&G inference only

## Problem

Additional real SkyDemon tracks reproduced three false-positive touch-and-go suggestions in the current detector. Because `landingCount(points)` is `1 + touchAndGoEvents(points).length`, HIGH/MEDIUM confidence does not alter the automatic landing count. Unsupported events therefore present a data-integrity risk if accepted unnoticed.

A fourth observation is a real T&G that the current ±10-point rolling-altitude qualification misses. That is a confirmed defect, but recovering it can add events and is deliberately separated into 3.5.2.

## Real-track evidence

Full personal KML routes are analysis-only and must not be committed. Regression fixtures must be anonymized/minimal.

### R1 — false altitude T&G after a level shift

Current detector reports an altitude T&G near 14:40:49. A prior ~152 m altitude level shift occurs in ~5 s, after which the shifted data form an apparent descent/minimum/climb. The current nearest-30 m evidence span does not include that earlier jump. The candidate's entire +30 m climb is then supplied by the first timed edge after the minimum.

Expected 3.5.1: no T&G.

### R2 — false altitude T&G during climb-out

Current detector reports an altitude T&G near 15:26:50 from an oscillating sequence approximately 456.5 → 413.9 → 445.2 m. The +30 m climb is supplied by one timed edge.

Expected 3.5.1: no T&G.

### R3 — false speed T&G from duplicate/stale fixes

Current detector reports HIGH speed T&G near 16:01:48. Repeated coordinates collapse the 5-point median speed to zero even though the event endpoints imply roughly 176 km/h motion and altitude rises by more than 30 m.

Expected 3.5.1: no T&G.

### R4 — positive control

A separate real track currently produces five correct altitude T&Gs.

Expected 3.5.1: exactly five events, same order, altitude signal, MEDIUM confidence.

### R5 — known real T&G missed near 15:59

The minimum is about 224.35 m. Point +10 reaches only ~254.08 m, ~0.27 m short of the existing +30 m rule; point +11 reaches ~271.29 m. This proves the ±10 array-point qualification defect.

However the approach also contains a gross altitude discontinuity. 3.5.1 therefore does not auto-count this event.

Expected 3.5.1: remains non-auto-counted. 3.5.2 owns the add-event/review-tier design.

## Independent review and reconciliation

Claude returned APPROVE WITH CHANGES:
- prefer a shared evidence layer over a full state machine;
- keep 28/145 km/h and 30 m thresholds;
- contain false positives before attempting recovery;
- do not use spatial clustering as a hotfix rescue;
- treat duplicate/stale-fix behavior as an evidence-quality problem;
- separate the known missed real T&G into an evidence-limited follow-up.

Repository reconciliation adds:
- confidence is not a count gate, so a contradicted speed event must be excluded from `touchAndGoEvents()`, not merely downgraded;
- aircraft-performance / flight-path-angle limits are not acceptable in generic Logbook detection because applicability/source-backed envelopes are not available for all supported aircraft;
- rejection reasons may be internal diagnostics but the public `TouchAndGoEvent` DTO remains unchanged.

## Frozen 3.5.1 invariants

1. **Tightening only.** Runtime changes may remove unsupported automatic T&G suggestions but may not add a new auto-counted T&G.
2. **Existing thresholds stay frozen.**
   - rolling speed: 28–145 km/h;
   - altitude evidence: 30 m;
   - gross altitude discontinuity: 25 m/s.
3. **No aircraft-performance inference.**
4. **No spatial/repeated-runway rescue.**
5. **Takeoff behavior stays unchanged.**
6. **No schema/certification/history change.**
7. **Full private routes are not fixtures.**
8. **Rejected speed candidates cannot suppress an accepted altitude candidate.**

## Detector change

### Rolling altitude admission

Retain current candidate/local-minimum/±10 qualification and 30 m evidence for 3.5.1.

Add one conservative persistence requirement:

A +30 m post-minimum climb anchor is not sufficient when it is the very first usable timed altitude sample after the minimum. At least one intermediate usable timed altitude sample must exist between the minimum and the +30 m anchor, and it must show altitude above the candidate minimum.

Rationale:
- a T&G requires evidence of a climb away from the minimum, not a single GPS edge;
- R1 and R2 are single-edge false climbs;
- existing real positive controls and the previous sparse real-derived regression contain intermediate climb evidence;
- sparse tracks may degrade to manual review rather than generate an unsupported event.

No corresponding new descent rule is introduced in 3.5.1 because the previous real-derived sparse regression has a valid +30 m descent crossing on the final pre-minimum edge while the broader descent trend is well supported. Symmetric point-count tightening would regress a previously validated real shape.

### Speed / ground-event admission

Keep `groundEvents()` unchanged for existing split semantics. Apply T&G-only admission before converting a short ground event into `TouchAndGoEvent`.

A short speed event is rejected as T&G when either:
- direct endpoint groundspeed across the event exceeds the existing 145 km/h rolling-T&G ceiling; or
- at least two usable altitude samples exist during the alleged ground interval and their altitude range is at least the existing 30 m T&G evidence threshold.

This avoids changing shared speed calculation, takeoff inference or split behavior while preventing a point-median collapse from becoming landing evidence.

## Explicitly deferred to 3.5.2

- replacing ±10 altitude qualification with elapsed-time/physical windows;
- auto-recovering the known 15:59 event;
- a non-counted `possible T&G` review tier;
- global stale-fix / duplicate timestamp normalization;
- time-normalized candidate grouping/dedup;
- spatial clustering or ground-reference assistance.

## Regression contract

Before runtime correction, anonymized regressions must reproduce:
- R1 false altitude event;
- R2 false climb-out altitude event;
- R3 false HIGH speed event.

After correction:
- R1/R2/R3 return no T&G;
- R4 remains exactly five T&Gs;
- previous sparse real-derived rolling T&G remains detected;
- previous in-span near-zero timestamp corruption remains rejected;
- high-speed low pass remains rejected;
- genuine flat-altitude stop-and-go speed event remains HIGH;
- rejected speed event next to an accepted altitude event cannot suppress it;
- takeoff regression output remains unchanged;
- R5 remains non-auto-counted.

Density transformations may reduce evidence to insufficient, but must never create a new false-positive event.

## Verification

Required before merge:
- targeted 3.5.1 regressions;
- complete GPS/track regression corpus;
- complete unit/regression suite;
- TypeScript;
- production build;
- GPS import/review browser smoke if available;
- ROADMAP / FEATURES / CHANGELOG / GPS reliability docs reconciled;
- no DB migration.

A check is PASS only when actually executed.
