# GPS 2.0 — R2.1c-D2-B1 Unattested Legacy Inspection Contract

**Date:** 2026-10-17  
**Repo / branch:** `filipto861/flytally-logbook`, `test/gps-detection-r21-falsification`, Draft PR #350.  
**Status:** RESEARCH-ONLY source + **10 NEW TESTS AUTHORED**, **NEW NODE + TYPESCRIPT NOT RUN**. No production code, real track read or database.  
**Last owner-tested source:** clean `80581f5bdd1311090e15fe5dce83c16ab37afe87` (110/110 targeted Node tests + TypeScript PASS, owner-local). This does **not** certify D2-B1 source.

## D2-B1 — strict, limited evidence model

A `TrackInspection` produced by the **existing** production parser contains normalized points and aggregated quality; it does **not** establish original raw-record identity, line/sample mapping, transformations, source-sensor accuracy or independently validated units/mode/datum. D2-A has proven that blank CSV altitude/coordinate cells may become numerical zero, raw-order points may be sorted and deduplicated, CSV feet may be converted silently and `trackStats` may exclude legitimate zero altitude.

New *standalone research-only* `research/gps-detection-r21/source-provenance.ts` exports `characterizeUnattestedLegacyInspection(input: unknown): LegacyInspectionProvenance`. No parser or network is invoked in this function. It accepts an **untrusted, caller-provided** `TrackInspection`-shaped object only for shape validation and **normalized-array diagnostic counts**, never independent raw-source attestation.

- Strictly inspect input shape: top-level `format/source/points/quality`; known format/source/quality enums; finite in-range latitude/longitude; finite or null altitude; string or null timestamps; no extra fields on normalized points. Malformed -> `UNAVAILABLE(MALFORMED_INSPECTION)`.
- Well-shaped input -> **`DIAGNOSTIC_ONLY(SOURCE_LINEAGE_NOT_ATTESTED)`**. Counts may describe normalized rows with null altitude, numeric zero altitude, null timestamp or exact-zero latitude/longitude. These diagnostics cannot disambiguate genuine zero from an upstream parser-coerced blank.
- Every raw-source identity and transform remains `UNAVAILABLE`: original order, normalized→raw index mapping, deduplication lineage, altitude-unit conversion provenance.
- Every external/source authority fact remains `UNKNOWN`: source unit, altitude mode, vertical datum, vertical/horizontal accuracy, sensor provenance, parser revision. Filename or source brand hints cannot elevate trust.
- **ALL pilot-facing evidence is `UNAVAILABLE`**, even for a superficially `good` track: vertical, horizontal, event time, normalized-to-raw support, GPS-only whole-flight landing count. Physical gear contact remains `UNRESOLVED`; `canAffectCanonicalFlight=false`. This is intentionally a **no-positive-authorization contract**, not a complete trusted parser.
- Return data contain **only aggregate diagnostics**, not coordinates, timestamps, source filename, registrations, participant identities, original route, raw altitude values or legal flight counts.
- Caller `validated:true` / `sourceProvenanceStatus:"VALIDATED"` injection adds unexpected fields and is rejected as malformed; a forged `good` quality object remains diagnostic-only. No source data, developer flags or metadata can make it `APPROVED` with current code.

This is **not** the Pilot Review DTO and is never mounted in `app/`, `components/`, canonical `lib/`, server actions, GPS import or stored-flight review. Research-to-production import remains forbidden.

## Source relationship and nonclaims

`research/gps-detection-r21/detector.ts::assessSourceQuality` retains older experiment-only caller-declared `Known` values and T09 utility; **not** an input capability for D2-B1 approval. `lib/track-processing.ts` and `components/gps-import-review-player.tsx` are unchanged. Existing parser's purported `good` quality rating is not a guarantee of source accuracy, runway alignment or contact.

**Important limitation:** D2-B1 validates a caller-supplied *normalized inspection shape*, not its origin. It cannot verify whether the original file was KML, GPX or CSV if the caller lies about the `format` value. Even with a valid input shape, `sourceClaims` must remain `UNKNOWN` and all pilot-facing access must remain unavailable. A real trusted source parser (D2-B2), including source-byte provenance and normalized sample identity, is **NOT IMPLEMENTED**.

## Test plan and evidence

New file `tests/gps-detection-r21-d2b-provenance.test.ts`, **10** synthetic negative tests:

1. Normalized parser inspection is diagnostic-only, not trusted ingestion.
2. CSV feet-to-meters and `SkyDemon` source label cannot prove original unit or parser version.
3. Caller `validated`/claimed approval is rejected.
4. `good` quality cannot unlock pilot access.
5. Missing/invalid coordinate, nonfinite altitude, wrong timestamp and unexpected point fields fail closed.
6. Genuine or coerced zero lat/lon stays untrusted.
7. Sorted/deduplicated arrays have no raw-index mapping.
8. JSON output does not leak coordinates, timestamps, filenames or identifiable flight fields.
9. Missing time/altitude remains unavailable, never promoted to measured zero by this model.
10. CSV/GPX/KML labels independently yield only diagnostic status.

**Expected new owner-local target: 120 Node tests** = previously tested 110 + 10 new D2-B1 cases, plus `npm run typecheck`. This is **EXPECTED, NOT EXECUTED**. If a test fails, repair the exact research code/test precondition with evidence; do not alter the canonical parser to make the new tests pass.

**DoD for D2-B1:** owner clean exact SHA, 120/120 targeted PASS, strict TypeScript PASS, source/no-production-import check and docs/PR reconciliation. **DoD does not certify parser safety**, source authority, physical contact, real tracks or release. Full suite/build/Playwright/PG16 native SQL/RLS, owner consent, DB schema, merge and deploy remain NOT RUN/NO-GO.

## Next: D2-B2 independently trusted ingestion design, not silently implemented

D2-B1 is only the **untrusted diagnostic side** of D2-B. D2-B2 needs a separate source-verified design with a first-party parser revision, raw bytes/record reference, explicit original-to-normalized sample mapping or `UNAVAILABLE`, dedup/sort/ft→m provenance, timestamp and coordinate-presence fidelity. It cannot simply add `sourceProvenanceStatus="VERIFIED"` or trust a `KNOWN` enum. External sensor accuracy/datum remains a different claim even after correct parsing. Conduct independent actual-source review before implementing privileged/trusted capability.

**D2-C still OPEN, separate owner-scope decision:** actual correction to legacy `lib/track-processing.ts` for missing altitude/coordinates and zero-vs-null/metrics. No destructive rewrite of stored GPS or automatic pilot counts. **D3 Pilot Review research DTO only after D2-B evidence/review and frozen owner D1–D5.**
