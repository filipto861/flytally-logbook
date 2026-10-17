# GPS Detection 2.0 — R2.1b authorized real-record observational shadow plan

**Status:** PROPOSED RESEARCH DESIGN ONLY — **NOT RUN**, **NO IMPLEMENTATION AUTHORIZED BY THIS DOCUMENT**.  
**Date:** 2026-10-17  
**Repo/scope:** `flytally-logbook`, Draft PR #350; links to Issue #348 / R1 data/label feasibility and R2.1a falsification contract in Draft PR #349. `flytally-training` out of scope.  
**Evidence baseline:** R2.1a offline synthetic targeted suites 55/55 **owner-local PASS** and TypeScript PASS on exact tested `325fc9216b027e7910b549dfcd72aa43ba4df231`, **not** independently verified real-event classification accuracy.

## 1. Why the next milestone should be observational, not more synthetic "accuracy"

R2.1a has established an isolated research baseline, a failure/abstention scorecard, and a meaningful fixture comparison for the previously missed T10 rolling-T&G-like pattern. It has **not** established whether the detector is better for authentic user data. A large total of correlated GPS fixes is not a large set of independently verified touchdown events; saved/certified landing totals may incorporate prior auto-prefill suggestions and **do not prove contact timing**. Further synthetic cases are useful for critical gaps but cannot remove this central evidence limitation.

**Goal R2.1b:** assess *technical reliability and diagnostic disagreement* on existing authorized stored tracks: ability to process real cadence/missingness, distribution of outputs, frequency of unknowns, pattern disagreements with the legacy detector, and trace/flight-level count consistency where legitimate provenance supports it. **Never** claim event precision, recall, contact accuracy, AI superiority, regulatory evidence or model calibration from model-to-model agreement.

## 2. Privacy, permission and data residency gate — mandatory

- **Only owner-scoped records for which processing is legitimately authorized**. Product-owner approval to perform research on existing data does **not** automatically authorize model training or disclosure of other account holders' GPS tracks.
- Start with **owner authorization resolution**, then a scoped read-only access plan via existing server access controls or an explicitly approved separate local data interface. Do not guess a `user_id`, bypass tenant isolation, select every user's `coordinates_json`, or access another owner's track merely because the database administrator technically can.
- **No new external GPS data** requested. No external AI/model service upload of tracks, coordinates, registrations or individual per-flight identities. No copying personal routes to public GitHub fixtures, comments or source control.
- Prefer **computation within the authorized security boundary**, with **private aggregate-only results** (counts/distributions, no coordinates) returned to the research analysis. Maintain a private audit of access purpose, retention period and who can read outputs; explicit owner decision needed before any raw data copying or training.
- **No production DB writes, migrations, schema/index changes, bulk export or modification of saved/certified flights.** A read-only data assessment does not approve deployment or user-facing behavior.
- Protect low-cardinality breakdowns: do not publish owner/source/airport/route/time combinations from which an individual flight can be reidentified. Public documentation reports only method and status, not user-specific result values.

**R2.1b cannot start on raw user data until this authorization and read-only execution boundary are verified.** If access cannot be proven, remain on the current isolated synthetic/checked-in fixture research track.

## 3. Source and comparison contract

Data input per authorized track:
- Explicit source provenance: `source=flight_tracks.coordinates_json` where truly available; `overview_coordinates_json` is downsampled and **not a substitute** for raw measurement.
- UTC timestamps/offset, acquisition order **as persisted**, lat/lon, altitude, and the missingness/quality markers. Persisted point order may already have been sorted/deduplicated; do **not** claim original acquisition order recoverable.
- Vertical datum, KML altitudeMode, altitude units, sensor origin, time precision and H/V accuracy remain `UNKNOWN` unless independent original-source evidence is available; no assumption of AGL from airport elevation or GPS altitude alone.
- Both legacy and candidate analysis on the **identical available persisted point sequence**, with `comparisonBasis=POST_NORMALIZATION_ONLY` and `preprocessingConfound=NOT_ISOLATED`. Original source file parity can be compared **only** when an authorized original file exists; not invented from DB metadata.

Strict segmentation:
- Reject invalid/nonpositive `Δt` as speed **UNAVAILABLE**, not 0; long time gaps break event support.
- Never interpolate through a gap to create a ground contact or confident event time.
- Record `qualityEdgeReason`, number/length of valid islands, incompleteness and missing source parameters as quality *diagnostics*.
- Research candidate `physicalContactStatus=UNRESOLVED` always. `PATTERN_ONLY` observed-island count is not whole-flight landings; GPS-only whole-flight physical landing count remains `UNAVAILABLE` even with complete recording absent independent contact evidence.
- No import from production runtime into research (the research **shadow** adapter may read unchanged helpers; runtime must not import experimental analysis).

## 4. Predeclared scorecard: report objective, denominator, limitations

| Family | Metrics, with full denominator | Interpretation |
|---|---|---|
| Input eligibility | Authorized tracks examined, rejected/unavailable tracks by reason, raw-vs-overview input status | Data coverage only |
| Temporal quality | Nonpositive dt rate, gaps per track, sampling median/p90, valid-island coverage | Acquisition/data-quality evidence, not ground-contact truth |
| Source limits | Missing/unknown vertical mode/unit/datum and H/V accuracy fractions | Validity restrictions, not reliable runway AGL |
| Output coverage | Tracks with usable quality islands, candidate rates per *eligible track*, count of `PATTERN_ONLY` candidates by type, zero-candidate tracks | Research behavior; zero candidates != zero landings |
| Abstention | Explicit `UNAVAILABLE` for source quality / coverage, rates by quality cohort | Model support, not guaranteed safety |
| Legacy disagreement | Legacy T&G count vs research T&G/stop-go pattern rates on same persisted points, disagreement distribution and missing time windows | Algorithm comparison, **not** which is correct |
| Weak flight-level label consistency | Where source-backed human review provenance and complete flight scope are **verified**, compare recorded total vs suggestion, with caution about auto-prefill | Proxy only, may be omitted entirely |
| Independent event-level metrics | **UNAVAILABLE** without separately observed/confirmed per-event labels | Do not output event precision/recall/F1/contact confidence |

No invented score thresholds, percentages, sample sizes or statistical significance claims. For small eligible cohorts, omit owner-specific subgroup details and do not overfit/tune the fixed synthetic T/A regressions. Do not select a winning detector using its own pseudo-labels.

## 5. Experiment sequence, hard stop and acceptance

**R2.1b-P0 — security/feasibility plan (this document, no execution):**
1. Reconstruct current `main`, authorization/tenant ownership for GPS records, read methods and data-flow boundaries from actual source; review privacy/retention and audit controls.
2. Specify an owner-scoped low-impact read-only execution with no data export (or decline the experiment if no safe path).
3. Define a non-public result store, redaction policy, consent/legal basis, and output aggregation with minimum reporting thresholds; review whether actual records can be examined under existing rights.
4. Present any necessary product/security decision before raw-track analysis. **Status: NOT RUN.**

**R2.1b-P1 — authorized observational diagnostic (conditional):**
1. Freeze the candidate SHA and input cohort and report source/quality coverage and exclusion denominators.
2. Execute comparison strictly read-only inside approved boundary. Do not commit raw track data, identities, coordinates, per-flight event timestamps, or route snippets.
3. Perform provenance/quality and post-normalization confound audit; report only permitted aggregate summary privately.
4. Record actual local evidence, scripts and tool output classification. **Status: NOT RUN.**

**R2.1b-P2 — evidence review and next research milestone (conditional):**
1. Determine whether observed real-data disagreement is informative enough to justify further **pilot review**, or whether independently confirmed event labels remain insufficient.
2. If data are insufficient for truth verification, return `INSUFFICIENT_GROUND_TRUTH` and do **not** train or claim accuracy.
3. If considering a product suggestion UX, require separate reviewed schema, feature flag OFF/legacy fallback, existing canonical flight evidence safeguards and owner approval. **Status: NOT APPROVED / NOT RUN.**

**Hard-stop conditions:** unverified tenant access; raw GPS disclosure to unapproved third-party services; bulk/cross-user use without explicit authorization; unexplained null→zero or mode/unit coercion; events placed across gaps; automated editing of canonical/certified records; any model score promoted as true touchdown accuracy from self-generated evidence.

## 6. Relationship to R2.1a completeness

The R2.1a 35-case [coverage audit](GPS_DETECTION_2_0_R2_1A_COVERAGE_AUDIT_2026-10-17.md) remains partially open. A07/A08 go-around/low approach **not implemented** and HMM T20 N/A. R2.1b observational work **does not close** those case expectations or replace missing synthetic regressions. A conservative model can be evaluated for robustness and disagreement without pretending its 55 unit tests certify full product behavior.

**Decision proposal:** Continue with **R2.1b-P0 authorization/data-flow architecture discovery**, then decide whether owner-scoped, in-boundary read-only observational execution is possible. **Do not start an undisclosed full-database scan or require the user to produce new flight tracks.**
