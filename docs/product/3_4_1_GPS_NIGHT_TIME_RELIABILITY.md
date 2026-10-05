# 3.4.1 — GPS Night-time reliability

**Status:** ACTIVE — PHASE 1 REPRODUCTION / DIAGNOSTICS  
**Owner:** Filip Točík  
**Date:** 5 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.4.1-gps-night-time-reliability`  
**Production baseline:** `3.4.0` / `76b57c5674ffcc8c62bfbe73c59974cfde341a7a`

## Trigger

Production use exposed a GPS-review state where a landing was confidently suggested as **NIGHT** while **Night time** stayed blank/manual.

That state is not itself contradictory:

- landing Day/Night is an event-level classification using the detected landing event's timestamp and position;
- Night time is a whole-track accumulation and currently fails closed if any required segment cannot be classified.

The current leading hypothesis is the Night-time helper's blanket ten-minute segment cap, but the original failing EHAM → LKPR track has not yet been captured as a repository fixture. The exact production failure mechanism therefore remains **unproven** and must not be guessed.

## Verified current implementation

Relevant runtime: `lib/civil-twilight.ts`.

### Day/Night event classification

- SERA civil twilight remains geometric solar-centre altitude **-6°**.
- Confidence guard remains **±0.5°** around the -6° boundary.
- Unsupported/ambiguous event evidence returns `UNAVAILABLE`.
- Landing suggestion classifies only detected landing events.

### Night-time accumulation

`gpsNightMinutesSuggestion()` currently:

- requires explicit UTC/offset timestamps;
- requires monotonic segment time;
- skips zero-duration segments;
- rejects any segment longer than **600 seconds**;
- rejects unsupported solar-envelope input;
- rejects a segment when either endpoint is inside the ±0.5° confidence guard;
- linearly interpolates timestamp + lat/lon and uses bisection for a detected civil-twilight crossing;
- returns only either:
  - `AVAILABLE { minutes }`, or
  - `UNAVAILABLE` with no reason.

The E2 regression currently freezes the existing cutoff:

- exactly 10:00 → `AVAILABLE`;
- 10:01 → `UNAVAILABLE`;
- timestamp without explicit UTC/offset → `UNAVAILABLE`.

### Existing track-integrity context

`lib/track-processing.ts` already owns product-level track-quality and implausible-position-jump semantics. 3.4.1 must not invent a second unrelated generic speed/discontinuity heuristic inside civil-twilight logic.

## Independent review reconciliation

Independent second-AI review verdict: **APPROVE WITH CHANGES**.

### Accepted

- the fixed 600-second cutoff is an opaque sampling-density proxy, not a source-derived universal aviation/astronomical threshold;
- structured unavailable reason codes are required;
- UI must explain why automatic Night time is unavailable;
- adaptive subdivision of an already-safe interpolation can improve numerical evaluation, but subdividing a long two-endpoint gap does **not** create new evidence and must not be treated as making that gap safe;
- Night landing must never imply a Night-time duration;
- manual Night-time edits remain authoritative/sticky;
- IFR remains pilot-entered;
- regression coverage must include sparse tracks, real discontinuities, ambiguous timestamps, confidence-boundary cases and a real-like twilight-crossing route.

### Modified / rejected

1. **No PARTIAL value is auto-applied in 3.4.1.**  
   A lower-bound or partially covered Night duration is not the recorded total. Missing evidence must not become zero, and a partial number must not be presented as an exact logbook suggestion. The public result remains fail-closed: exact/full `AVAILABLE`, otherwise `UNAVAILABLE` with structured reasons/diagnostics.

2. **No new arbitrary “plausible ground speed” threshold inside `civil-twilight.ts`.**  
   If track-continuity evidence is required, reuse or extract the existing canonical track-integrity contract from `track-processing.ts`.

3. **Do not remove or relax the 600-second guard before reproducing the actual failure reason.**  
   Phase 1 first adds diagnostic reason semantics and captures/characterizes the failing shape. Numerical relaxation is allowed only if evidence shows the cutoff is the blocker and the replacement has an explicit conservative contract.

4. **A confidence-guard hit remains fail-closed for the exact total.**  
   Other segments may be diagnosed internally, but the UI may not auto-fill a full Night-time value while an unresolved segment can contain unknown Night time.

## Frozen product decisions

- GPS remains advisory/editable.
- SERA boundary remains geometric Sun centre = **-6°**.
- Confidence guard remains **±0.5°** unless authoritative evidence later justifies a change.
- Manual Night-time edit wins and is never overwritten by later GPS recomputation.
- IFR remains manual.
- Night landing does not imply Night time.
- Missing/ambiguous evidence does not become zero/default.
- No historical flight/certification/audit rewrite.
- No DB migration is expected.
- Certification payload remains v8.
- Existing 3.4.0 save/certify semantics remain unchanged.

## Result / reason-code contract

Target public result:

```ts
type NightTimeUnavailableReason =
  | "INSUFFICIENT_POINTS"
  | "MISSING_OR_AMBIGUOUS_TIMESTAMP"
  | "NON_MONOTONIC_TIMESTAMP"
  | "INVALID_OR_UNSUPPORTED_POSITION"
  | "UNSUPPORTED_SOLAR_ENVELOPE"
  | "ZERO_DURATION_CONFLICT"
  | "SEGMENT_GAP_TOO_LARGE"
  | "TRACK_DISCONTINUITY"
  | "TWILIGHT_CONFIDENCE_GUARD"
  | "CROSSING_UNRESOLVED";

type CivilTwilightNightTimeSuggestion =
  | {
      status: "AVAILABLE";
      minutes: number;
    }
  | {
      status: "UNAVAILABLE";
      reasons: NightTimeUnavailableReason[];
      firstAffectedSegment?: number;
      largestGapSeconds?: number;
    };
```

Reason metadata is advisory diagnostic state only. It is not persisted into certified flight evidence in 3.4.1.

UI maps internal reasons to concise human copy. Raw enum names are not shown.

Examples:

- `SEGMENT_GAP_TOO_LARGE` → “GPS Night-time suggestion unavailable — track coverage gap is too large for an exact result.”
- `TWILIGHT_CONFIDENCE_GUARD` → “GPS Night-time suggestion unavailable — the track is too close to the civil-twilight boundary for a confident automatic result.”
- `MISSING_OR_AMBIGUOUS_TIMESTAMP` → “GPS Night-time suggestion unavailable — some track times are not explicit UTC/offset timestamps.”
- `TRACK_DISCONTINUITY` → “GPS Night-time suggestion unavailable — track continuity is insufficient for an exact result.”

Manual input remains available in every unavailable case.

## Phase 1 — Reproduction and diagnostics — ACTIVE

Before numerical behavior changes:

1. Add structured reason classification to the current helper without weakening fail-closed semantics.
2. Preserve the existing 600-second cap during this phase.
3. Add focused tests proving each reason path.
4. Add UI reason mapping while preserving sticky manual edits.
5. Obtain the original/anonymized failing EHAM → LKPR track if available, or characterize an equivalent fixture without claiming it is the original production reproduction.
6. Record the actual blocker for the failing shape.

**Phase 1 acceptance:**

- no Night-time number changes solely because diagnostics were added;
- 10:00 / 10:01 legacy behavior remains unchanged;
- unavailable UI names the real reason instead of showing only a generic manual fallback;
- manual Night-time remains sticky;
- landing NIGHT + unavailable Night time remains a valid explicit state;
- focused tests pass.

## Phase 2 — Segment-policy correction — GATED BY PHASE 1 EVIDENCE

Only if Phase 1 proves the fixed gap rule or another segment policy causes false-unavailable results:

- define the replacement continuity/interpolation contract before code;
- prefer shared track-integrity evidence over new heuristics;
- do not treat subdivision of invented intermediate points as additional evidence;
- if a segment cannot be proven safe enough for an exact total, return `UNAVAILABLE`;
- no extrapolation outside supported solar/time/position envelope.

A fixed replacement threshold may be used only if its derivation and acceptance boundary are documented and test-backed. Otherwise the existing fail-closed cap remains.

## Required regression matrix

At minimum:

| Case | Required result |
| --- | --- |
| Dense all-day track | AVAILABLE, 0 Night minutes |
| Dense all-night track | AVAILABLE, full covered Night minutes |
| Dense civil-twilight crossing | AVAILABLE, expected crossing-derived minutes |
| Exactly 10:00 segment | Characterization preserved in Phase 1 |
| 10:01 segment | UNAVAILABLE + `SEGMENT_GAP_TOO_LARGE` in Phase 1 |
| Sparse continuous twilight-crossing fixture | Exact result only if later Phase 2 contract proves interpolation safe |
| Genuine GPS position discontinuity | UNAVAILABLE + continuity reason |
| Non-monotonic timestamp | UNAVAILABLE + timestamp reason |
| Timestamp without UTC/offset | UNAVAILABLE + timestamp reason |
| Unsupported latitude/year/position | UNAVAILABLE + envelope/position reason |
| Endpoint inside ±0.5° guard | UNAVAILABLE + `TWILIGHT_CONFIDENCE_GUARD` |
| Identical zero-duration duplicate | No invented duration |
| Conflicting zero-duration positions | UNAVAILABLE + `ZERO_DURATION_CONFLICT` |
| Night landing + Night-time unavailable | No Night-time inference from landing |
| Manual Night-time edit after suggestion | Manual value remains sticky |
| EHAM → LKPR real/anonymized or real-like twilight fixture | Cause is explicit and regression-locked |

## Verification plan

For Phase 1:

- targeted civil-twilight/night tests;
- GPS UI/source-contract tests;
- TypeScript;
- production build;
- targeted authenticated GPS-review browser acceptance;
- full unit/regression gate before merge.

PostgreSQL/DB migration testing is **N/A** unless scope changes.

For any Phase 2 numerical change:

- rerun the full GPS/track regression corpus;
- add before/after fixture evidence;
- prove no new false exact Night minutes;
- run the normal release gate before merge/deploy.

## Do not

- infer Night time from landing classification;
- auto-apply partial/lower-bound Night minutes as the total;
- silently bridge a long or discontinuous GPS segment;
- introduce a second arbitrary track-speed quality model;
- weaken UTC/offset requirements;
- change IFR behavior;
- persist diagnostic reason codes into certified records without a separate data-model decision.

## Closeout definition

3.4.1 is DONE only when:

- the real/representative failure mechanism is identified;
- diagnostics are explicit;
- any numerical change is evidence-backed and fail-closed;
- tests/build/browser evidence pass;
- ROADMAP / FEATURES / CHANGELOG are reconciled;
- production deployment and runtime smoke are verified.
