# R2.1c-D2-B2 — bounded CSV source-lineage prototype

**Date:** 2026-10-17  
**Branch:** `test/gps-detection-r21-falsification`, [Draft PR #350](https://github.com/filipto861/flytally-logbook/pull/350).  
**Status:** **SOURCE AND TEN SYNTHETIC TESTS AUTHORED; NOT RUN.** Previous exact owner-tested research code SHA `d4f1d7bf626f8b55e6d9d21c73f528faf6fbbf64`: 120/120 targeted Node + TypeScript PASS. This evidence **does not cover D2-B2**.

## Explicit scope — small, release-directed

New `research/gps-detection-r21/csv-lineage.ts` is an in-memory **research-only**, strict single-file CSV **subset** analyzer. It accepts **text**, not a normalized, caller-labeled `TrackInspection` or forged `validated` object. It never accesses DB/Neon, private GPS, disk, auth or network and is **not imported by production**. It does **not** attest which original instrument recorded the data.

Accepted grammar is deliberately narrow, **not legacy parser parity**:
- Plain, unquoted comma-delimited CSV only, exactly four columns in this order: `lat,lon,altitudeM,time` or `lat,lon,altitudeFt,time`.
- Source rows must contain finite, nonempty lat/lon inside geographic bounds; altitude is nullable **only when truly empty**; numeric `0` remains a real numeric `0`, and negative altitudes are supported. No silent `Number("")=>0`.
- Time must be an explicit, canonical `YYYY-MM-DDTHH:mm:ssZ` UTC instant. No timezone-less, offset, invalid date, or subsecond syntax **in this prototype**: those formats are `UNAVAILABLE`, not misinterpreted or assumed local.
- Valid points are sorted by explicit UTC. **All** accepted points are retained; duplicate timestamps, ambiguous columns, blank rows, unknown dialect, excessive input or unparseable values **fail closed**. We never deduplicate or drop a row to manufacture a valid flight.
- Results contain `sourceLine` (1-based original text line), `normalizedIndex`, unit-header evidence and conversion `0.3048` factor, together with parser revision `R21_D2B2_CSV_SUBSET_V1`. The mapping exists only **for this exact in-memory original text**; no cross-file/cross-split identity, no certified persisted row mapping, no authentication.
- Source `ft` header is **only a source-text declaration**, not independently proven sensor units/datum. Altitude mode, datum, accuracy and instrument identity all remain `UNKNOWN`. Even when exact-row conversion succeeds, `pilot.status="UNAVAILABLE"`, `physicalContact="UNRESOLVED"`, `wholeFlightLandings="UNAVAILABLE"`, `canAffectCanonicalFlight=false`.
- Returned in-memory `samples` contain synthetic coordinate/time/height data when tested. **Do not serialize to logs, external reviews or public UI.** Unlike privacy-limited D2-B1 aggregate diagnostics, this is an offline raw-lineage experiment and is not approved for real user GPS.

## 10 test cases

`tests/gps-detection-r21-d2b2-csv-lineage.test.ts`:
1. Blank vs measured zero altitude are distinguishable.
2. Header-declared feet→metres factor is preserved but never promoted to sensor authority.
3. Out-of-order UTC yields explicit raw line to normalized index mapping.
4. Duplicate same-time points rejected (including exact duplicate).
5. Missing/out-of-bounds coordinates rejected, not coerced to zero.
6. Invalid altitude rejected, real negative and zero heights retained.
7. Timezone-less/offset/invalid calendar date rejected, not silently corrected.
8. Unsupported dialect, quotes, caller-forged `validated` rejected.
9. Blank/malformed rows and single-point sources refused.
10. No pilot count/certification/flight/user/runway ID authority in result.

**Expected owner-local targeted tests: 130** (prior D2-B1 clean 120 + 10 new D2-B2) plus `npm run typecheck`. **NOT RUN** on the new executable source. Run exact clean HEAD, 14 named GPS/parser suites, exit guards, and record actual result; expected count is not PASS evidence.

## Scope of next work — fastest safe critical path

**D2-B2.1 (NOW):** exact-source local tests, reconcile failures. No more speculative format expansion before proven need.

**D2-C (NEXT production blocker, separate owner approval):** minimal canonical `lib/track-processing.ts` change to preserve blank/invalid altitude/coordinates as unavailable, plus `trackStats` zero-alt semantics and explicit source transformation metadata. Must audit all consumers, redefine unsafe characterization expectations, add end-to-end regression and get independent actual-source review. **Do not silently replace the legacy parser with this narrow prototype.**

**D3 (AFTER D2 evidence/review):** pure advisory Pilot Review DTO and existing-import UI behind default-OFF flag, with explicit owner-approved no auto-count/no certification; no new stored-flight review. Source parser correctness is necessary but not enough for operational/physical touchdown truth.

**P0 security separately:** native PG16 RLS, strict owner consent and no-write evidence remain NO-GO for any real saved/private GPS integration. Do not use PG16/PG18/Neon, migrations or production until authorized and tested.

**No claims:** no source-sensor accuracy, no real ground contact, no source file signature, no KML/GPX support from this prototype, no browser/CI/full suite/build/deploy. Product choices D1–D5 remain frozen.
