# GPS Detection 2.0 — R2.1b authorized real-record observational shadow plan

**Status:** PROPOSED RESEARCH DESIGN ONLY — **NOT RUN**, **NO IMPLEMENTATION AUTHORIZED BY THIS DOCUMENT**.  
**Date:** 2026-10-17  
**Repo/scope:** `flytally-logbook`, Draft PR #350; links to Issue #348 / R1 data/label feasibility and R2.1a falsification contract in Draft PR #349. `flytally-training` out of scope.  
**Evidence baseline:** R2.1a offline synthetic targeted suites 55/55 **owner-local PASS** and TypeScript PASS on exact tested `325fc9216b027e7910b549dfcd72aa43ba4df231`. R2.1b on exact `54146357`: **63/63 targeted owner-local PASS, but TypeScript FAIL (two TS7006 errors)**, so full gate FAIL; a minimal typed-callback fix was committed afterward and **NOT YET VERIFIED**. **Independent DeepSeek security review received (document-only),** see [reconciliation](GPS_DETECTION_2_0_R2_1B_INDEPENDENT_SECURITY_REVIEW_RECONCILIATION_2026-10-17.md). **Current verified closeout supersedes the prior failure:** on exact clean `8b410f32d207adab54d3b84b340275153d4b1731`, owner-local **63/63 targeted tests PASS** (0 failed/skipped) and **repository `tsc --noEmit` PASS**, with a single guarded PowerShell block. The earlier `54146357` TypeScript failure and correction remain documented as historical evidence. **Only the isolated offline code gate is now PASS; real-record access is NOT authorized or executed.** No independent touchdown truth.

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

## R2.1b-P0 source-path reconnaissance — read-only GitHub audit complete (2026-10-17)

Verified against unchanged `main@6a67a024`:

- `app/(protected)/flights/actions.ts` uses `requireUser()` for authenticated flight/import operations, and its flight track inserts include `user_id`. That supports a feasible tenant-scoped design, **but does not confer permission to export or train**.
- `lib/data/tracks.ts::getFlightTracks(userId,flightId)` has an owner predicate `t.user_id=${userId}` and joins flights under matching user IDs. **It returns map-oriented data via `decodePoints(...,2500)`**, which may thin raw samples and maps nullable altitude through `Number(null) -> 0`; it must **not** be reused as a full-fidelity scientific input.
- `lib/data/flight-track-review.ts::getFlightTrackReview(userId,flightId)` reads `coordinates_json` with the same owner predicate and `LIMIT 1` for the first track only; `rawPoints()` preserves nullable altitude more accurately than the map decoder. The function produces an existing **legacy re-inference**, not independent contact labels. **This first-track-only API cannot establish exhaustive per-flight multisource coverage**.
- `lib/track-processing.ts` currently has `KmlPoint` with position, nullable altitude and time only; format/source labels and `TrackQuality` do not establish original KML altitudeMode, GNSS vertical datum or per-fix accuracy.
- `lib/db.ts` is `server-only` and obtains a production Neon SQL client from `DATABASE_URL`; a new **unapproved** public route or export action must not be added solely for research.

**P0 finding:** the existing app proves **owner-scoped access patterns exist**, but does **not** expose a verified, full-resolution, research-authorized in-boundary aggregation endpoint. The map DTO and first-track review helper are **not suitable shortcuts**. A new minimal authorized read-only processing path would require a separately reviewed security contract and owner signoff **before** any private track data retrieval. **No owner identity guessed, no raw GPS selected, no database query executed in this P0 source audit.**

## R2.1b-P0 critical discovery — authentication is NOT strictly read-only (2026-10-17)

Verified directly against unchanged `main`:

- `lib/auth/require-user.ts` delegates to `lib/auth/session.ts::getSession()`.
- `getSession()` **calls `ensureDatabaseOptimizations()`** before fetching a valid session. The implementation in `lib/db-optimization.ts` may create or update schema and migration registry when a migration is pending, even if the caller intended only to read.
- `getSession()` also schedules **`UPDATE auth_sessions SET last_seen_at=NOW()`** when its 15-minute recency condition is met. Therefore ordinary app `requireUser()` cannot currently be described as a **strictly zero-write** authentication path. This is an existing runtime behavior, not an R2.1b defect or authorization to change the app.
- Using the existing authenticated app UI may incidentally update session metadata even if our analytic query is read-only. A future research workflow must distinguish **(a) absolutely no database writes in its whole request** from **(b) no writes to flight/track/user evidence**. These are not equivalent. This milestone currently requires **(a)** for research execution unless the owner explicitly approves a narrower definition and verifies consequences.
- **FAIL CLOSED:** do not launch a production session-backed research endpoint on the assumption that calling `requireUser()` is SELECT-only. Do not disable auth, bypass tenant access, forge session or guess user identity to avoid this complication.

**Required architecture/security decision before any private trace scan:**

1. Choose a source of verified owner identity whose security properties match or exceed the current session model, and account for incidental auth/migration writes. An authorized server-side, explicitly reviewed **strict-read-only identity resolver** or an independently proven scoped subject with scoped read-only credentials are design candidates only.
2. Enforce owner scoping in each query (`flight_tracks.user_id = verified_subject` **AND** same-owner flight join), including authorization of any shared-flight evidence. Never trust an arbitrary client-provided user ID even if it happens to match.
3. Execute data access under PostgreSQL **SELECT-only privileges** and read-only transaction/session settings where the connector supports them, with no opportunistic migrations, no stored procedure mutations, no production seed/reset and no implicit flight writes. Validate actual driver/Neon transaction semantics; do not assume `sql.transaction` always applies a single read-only transaction across all statements.
4. Separate public production app code from the experiment and require an owner-approved deployment/security review for any production endpoint. Never write a live route merely to expose research summaries without approval.

**P0 determination:** a safe source code path for ownership-filtered reads exists, but **a proven strictly read-only, identity-authorized full-resolution execution path does NOT yet exist**. No such execution has been performed.

## R2.1b-P0 pure in-memory aggregate prototype (security boundary still missing)

An isolated, dependency-minimal `research/gps-detection-r21/observational-aggregate.ts` now supports processing **already authorized in-memory** sequences with unchanged legacy and research phase/pattern algorithms. No DB, auth, file, network or user lookup calls exist in the module.

Its result carries **aggregate-only** track and point counts, invalid-edge reasons, available-island coverage and a **four-way legacy-versus-research T&G-pattern disagreement breakdown**. It never returns coordinates, routes, users, timestamps, per-flight IDs, event windows, physical-contact predictions or inferred landing totals. `physicalContactTruth=UNAVAILABLE`, `independentEventLabels=false`, `preprocessingConfound=NOT_ISOLATED` are explicit.

**Research guardrails:** bounded cohort (5–50 tracks), capped individual/total points, suppression of smaller cohort outputs and rejection of malformed inputs. **The cohort floor is a provisional minimization measure, NOT a privacy-anonymization guarantee**; an authorized analyst could still reidentify sparse or unique trajectories by context. No public output is authorized. Caller must establish owner authorization before passing input; this module itself **does not authenticate or authorize users**. These are testable building blocks, **not** proof R2.1b real-data execution is approved.

Eight new isolated synthetic tests in `tests/gps-detection-r21-observational.test.ts` exercise suppression, limits, missing/null altitude, invalid time/location, reporting denominators and the absence of raw route metadata. **New tests/typecheck NOT RUN** on latest branch HEAD; earlier 55/55 evidence applies only to Batch 4 SHA `325fc921`. Implementation remains research-only, with zero live-data access.

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
