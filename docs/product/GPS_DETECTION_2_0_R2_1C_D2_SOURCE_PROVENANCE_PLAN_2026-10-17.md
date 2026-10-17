# GPS Detection 2.0 — R2.1c-D2 source provenance and parser falsification plan

**Date:** 2026-10-17  
**Repository:** `filipto861/flytally-logbook`; branch `test/gps-detection-r21-falsification`; Draft PR #350.  
**Owner-approved direction:** inline existing GPS import only; ephemeral unresolved advisory notes; no V2 auto-count or certification; no vertical/metric candidate display without verified source; separate post-flight review deferred. See [frozen D1–D5](GPS_DETECTION_2_0_R2_1C_PILOT_REVIEW_DESIGN_2026-10-17.md).  
**Scope status:** D2-A **OWNER-LOCAL EXACT-SHA CHARACTERIZATION PASS: 110/110 targeted Node + TypeScript PASS** (clean 80581f5bdd1311090e15fe5dce83c16ab37afe87). **Three known unsafe parser behaviors reproduced; safety acceptance remains FAILED/OPEN for those behaviors.** These are regression observations, not parser safety acceptance. Production parser, UI, DB and deployment are unchanged.  
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
| D2-A09 | CSV blank latitude/longitude vs actual coordinate 0 | CURRENT potentially unsafe `Number("")===0` path; do not treat blank source latitude/longitude as verified equator/Greenwich coordinate. |
| D2-A10 | Truly measured altitude 0 in track statistics | CURRENT `trackStats` filters numeric zero from min/max altitude; this may be an intentional legacy sentinel but loses zero-vs-absent provenance; do not silently change production metrics. |

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

- D2-A **10 synthetic parser tests AUTHORED but NOT RUN** in `tests/gps-detection-r21-d2a-parser-characterization.test.ts`; produce exact clean SHA, targeted test output, negative results and TypeScript; do not inherit old 83/83 tests after executable changes.
- D2-B pure evidence contract only after D2-A demonstrates actual parser transformations; no `app/`, auth, DB/Neon, GPS-user files or `flytally-training` touched.
- D3 pure offline Pilot Review DTO only after strict evidence admissibility and owner-frozen D1–D5; never a hidden count/certification path.
- Full 35-case GPS detector matrix, actual physical-contact precision/recall, original sensor datum/accuracy, P0-D3 PostgreSQL 16 RLS, strict no-write owner consent, private GPS, browser UX and production release remain **OPEN / NO-GO**.

## D2-A authored-test verification checkpoint — 2026-10-17

**Test source:** `tests/gps-detection-r21-d2a-parser-characterization.test.ts` (10 `node:test` cases, no production source changes). **Status: NOT RUN**, exact new test SHA to be captured by owner checkout. These are deliberately **CHARACTERIZATION** tests, with explicit `KNOWN UNSAFE` labels for missing altitude/coordinates and zero-height statistics; a passing test reproducing a defect is **not** a safety PASS. After a separately approved source fix, replace these assertions with desired invariants and report the changed behavior.

D2-A reuses the actual existing `parseTrackFile`, `inspectTrackFile`, `splitPoints` and `trackStats` from `lib/track-processing.ts` **read-only**, plus the separate research-only `assessSourceQuality` and `analyzeResearchTrack`. Inputs are synthetic and do not depend on actual private tracks, DB, network, PostgreSQL services or browser.

**Expected owner-target test inventory (count pending actual execution):** historical GPS R2.1a/R2.1b targeted **83** + existing `tests/track-processing.test.ts` source-listed **17** + 10 newly authored characterization tests = **110 expected**. TypeScript `npm run typecheck` separately. Historical 83/83 is from clean `681c62d9` and cannot be presented as test proof for the new HEAD. The number 110 is a source-count **expectation, NOT RUN evidence**.

**No release approval:** Current parser ambiguities (empty altitude → 0; empty coordinates → 0; zero excluded in `trackStats`) remain **OPEN**. Do not merge production GPS parser fix, migrate stored GPS, read owner tracks, or build pilot-facing V2 candidate UI before source semantics/owner approval are independently established. D2-B and D3 remain **NOT STARTED**.

## D2-A owner-local exact-SHA verification — 2026-10-17

**Execution:** owner clean `test/gps-detection-r21-falsification` checkout at exact tested executable SHA `80581f5bdd1311090e15fe5dce83c16ab37afe87`. Fetch and fast-forward completed, clean `git status --porcelain`, strict HEAD guard matched. Twelve targeted GPS/legacy/parser Node files: **110/110 PASS**, **0 fail, 0 skipped, 0 cancelled, 0 todo** (83 GPS/legacy + 17 existing track parser + 10 new D2-A). `npm run typecheck` / `tsc --noEmit` **PASS** with explicit exit guard. PowerShell final `GPS D2-A LOCAL TESTS PASS` marker printed. **Owner-local, NOT CI.** Subsequent docs-only commits are not new tested code SHAs.

**Critical distinction:** D2-A01 **KNOWN UNSAFE** reproduces blank CSV altitude -> numeric 0, indistinguishable from explicit 0 after parsing. D2-A09 **KNOWN UNSAFE** reproduces blank CSV latitude/longitude -> coordinate 0. D2-A10 **KNOWN SEMANTIC LOSS** reproduces exclusion of actual altitude 0 in `trackStats` min/max. A green characterization test **demonstrates a hazard; it does not certify data integrity**. D2-A02–A08 additionally establish observed feet conversion, sorting/deduplication without source-row mapping, GPX/KML absent vs zero semantics, untrusted caller `KNOWN`, missing time/bad coordinates, split-local reindexing.

**D2-A CLOSEOUT:** bounded synthetic parser characterization **CLOSED** on exact tested SHA. **D2-B NEXT:** define a strict research-only source/provenance contract separating parser observation, normalization/transforms and independently supported sensor/units/mode/accuracy. A caller-provided `validated:true` cannot approve V2 vertical display. **D2-C OPEN / SEPARATE APPROVAL REQUIRED:** minimal canonical parser corrections for missing vs zero and raw-source lineage; first inventory affected consumers and get an independent code-level review. Do not overwrite or reinterpret persisted records without original source evidence.

**Still NOT RUN / NO-GO:** full Node suite/build/browser, production parser fix, independent physical touchdown, real GPS/Neon/PG16 RLS/consent and no-write, migrations, merge/deploy. Approved D1–D5 product direction stays frozen; no authority to use private GPS.


## D2-B1 research untrusted-inspection model — 2026-10-17 (NEW TESTS NOT RUN)

**Code authored:** `research/gps-detection-r21/source-provenance.ts` and `tests/gps-detection-r21-d2b-provenance.test.ts` (10 synthetic cases). [Exact source design and falsification contract](GPS_DETECTION_2_0_R2_1C_D2B_UNTRUSTED_PROVENANCE_CONTRACT_2026-10-17.md). Source parser `lib/track-processing.ts` remains unchanged. The last clean **owner-tested** source stays `80581f5b` (110/110 Node PASS + TS PASS, characterization NOT parser-safety acceptance). **D2-B1 new Node/TS NOT RUN**, expected next targeted total **120**.

**Safety semantics:** caller-provided normalized `TrackInspection` can expose counts only as `DIAGNOSTIC_ONLY`; invalid inspection fails closed `UNAVAILABLE`. All possible pilot-facing vertical/horizontal/time/sample identity use remains `UNAVAILABLE` and physical contact `UNRESOLVED`, regardless of forged `validated:true`, favorable parser quality or source label. No approval path exists in D2-B1. A trusted source-byte lineage and transform mapper is separate **D2-B2**, NOT IMPLEMENTED. D2-C legacy parser fixes still require separate product scope/independent review.

**NEXT:** owner clean exact HEAD tests (previous 110 + 10 new), strict TypeScript and source/no-production-import check; reconcile failures before claiming bounded D2-B1 acceptance. No private GPS/DB, P0-D3 native RLS, real-data analytics, canonical flight writes, migration, merge or deploy.