# GPS Detection 2.0 — R2.1c-D2 source provenance and parser falsification plan

**Date:** 2026-10-17  
**Repository:** `filipto861/flytally-logbook`; branch `test/gps-detection-r21-falsification`; Draft PR #350.  
**Owner-approved direction:** inline existing GPS import only; ephemeral unresolved advisory notes; no V2 auto-count or certification; no vertical/metric candidate display without verified source; separate post-flight review deferred. See [frozen D1–D5](GPS_DETECTION_2_0_R2_1C_PILOT_REVIEW_DESIGN_2026-10-17.md).  
**Scope status:** DESIGN / AUDIT PLAN ONLY. No executable code or tests added by this document. Not an approval to change the production parser, UI, data, PostgreSQL, or shipping.  
**Last owner-tested research executable:** `681c62d90d21fdf1efd4aa3ada83383249ea857b`: 83/83 targeted Node PASS + TypeScript PASS **owner-local**, not CI; unrelated to new D2 acceptance.  

## D2-A — Characterization BEFORE modification (RECONSTRUCT + FALSIFY)

Read exact `lib/track-processing.ts` and existing parser/regression tests, then author **new read-only synthetic characterization tests** without modifying `lib/`. Test these independent invariants:

| Case | Input | Required observation / decision |
| --- | --- | --- |
| D2-A01 | CSV with altitude header, one row blank, one explicit `0`, one real nonzero altitude | Distinguish absent source cell from true measured zero. Current `Number("")===0` path is a **source-identified suspect defect**; runtime actual outcome **NOT RUN**. Any discrepancy is a tracked blocker, not a fabricated PASS or a sanctioned default. |
| D2-A02 | CSV `altitudeFt` and `altitudeMeters` | Characterize 0.3048 conversion, original header, normalized unit and **absent** transformation provenance. Never assert a converted number proves source instrument truth. |
| D2-A03 | Three out-of-order explicit UTC timestamps | Prove normalized sorting and that raw indices cannot be reused directly as candidate IDs. |
| D2-A04 | Consecutive duplicate position+timestamp with different altitude | Characterize dedup and loss of one raw sample; make sample-to-source association **UNAVAILABLE** without mapping. |
| D2-A05 | GPX absent `ele`, KML absent third coordinate or altitude mode | Distinguish absent altitude from genuine measured zero; do not silently assert AGL or MSL. |
| D2-A06 | Unknown source/altitude unit/mode/datum and arbitrary caller `KNOWN` | Pure source authority stays **UNVERIFIED**; no code path may claim parser- or sensor-trusted elevation from a forged object. |
| D2-A07 | Missing/ambiguous/nonmonotonic timestamps, corrupted coordinates | Diagnostic-only for unusable spans; not a valid pilot-facing event time or a new landing. |
| D2-A08 | Normalized subset or split-window reindexing | No original-sample identity without a map and revision; invalidate in-memory advice when input/split identity changes. |

Test outputs must explicitly state whether they characterize **existing behavior** or enforce **desired safety behavior**. Never encode the current blank-altitude-to-zero defect as an approved permanent invariant. A deliberate RED test is acceptable in a separately scoped falsification run and must be reported as FAIL, not hidden or counted as PASS. No first-party driver/aircraft measurement claim from synthetic fixtures.

## D2-B — Provenance contract (RESEARCH-ONLY, subject to D2-A evidence)

Define two independent layers, not one overloaded `validated` flag:

1. **Parser observation / transformation:** explicit input format, parser revision, normalized sequence revision, source row/ordinal mapping or `UNAVAILABLE`, dedup/sort/units conversion evidence, missing-cell/null preservation and timestamp parsing assumptions. No trust inferred merely from an input filename or `source` text.
2. **External source fitness/authority:** source unit, altitude mode, reference datum, vertical/horizontal accuracy and sensor provenance, each independently `UNKNOWN` / `SOURCE_DECLARED_UNVERIFIED` / `INDEPENDENTLY_SUPPORTED` only when actual evidence is available. A parser-observed unit is **not** proof that the aircraft/sensor measured accurate MSL/AGL.

The trusted boundary cannot be `SourceMetadata.status="KNOWN"` or a runtime caller-supplied `sourceProvenanceStatus="VALIDATED"`. Use a server-side/isolated parser provenance contract with testable source-byte lineage before any future pilot-facing source approval; this alone still does not satisfy owner/RLS privacy gates. While such provenance is missing, **fail closed for pilot-facing altitude/vertical-rate suggestions**. Horizontal stop/go requires its own verified time/position origin and remains contact-unknown. Do not alter existing R2.1a experimental thresholds to make tests pass.

## D2-C — Smallest legacy parser correction (SEPARATE DECISION)

If D2-A01 demonstrates that a blank CSV altitude becomes 0, propose a **separately reviewed minimal fix** to `lib/track-processing.ts` preserving actual measured zero and mapping blank/malformed altitude to `null`; analyze all consumers (legacy `landingCount`, `trackStats`, aircraft altitude profiles, imports, stored tracks), backward compatibility and whether prior persisted zero values can be corrected **without raw source evidence** (default: no destructive repair or inference). Obtain owner approval for the precise production-parser scope **before modifying `lib/`**. No automatic data migration, raw owner GPS access or retroactive reinterpretation.

Any future renderer fix to null/invalid Δt is **separate** from D2 parser integrity: verify effective runtime and chart behavior first; maintain zero vs unavailable semantics, do not change canonical landings as a side effect.

## Acceptance and next decision point

- D2-A synthetic parser tests **NOT RUN / NOT AUTHORED yet**; produce exact clean SHA, targeted test output, negative results and TypeScript; do not inherit old 83/83 tests after executable changes.
- D2-B pure evidence contract only after D2-A demonstrates actual parser transformations; no `app/`, auth, DB/Neon, GPS-user files or `flytally-training` touched.
- D3 pure offline Pilot Review DTO only after strict evidence admissibility and owner-frozen D1–D5; never a hidden count/certification path.
- Full 35-case GPS detector matrix, actual physical-contact precision/recall, original sensor datum/accuracy, P0-D3 PostgreSQL 16 RLS, strict no-write owner consent, private GPS, browser UX and production release remain **OPEN / NO-GO**.
