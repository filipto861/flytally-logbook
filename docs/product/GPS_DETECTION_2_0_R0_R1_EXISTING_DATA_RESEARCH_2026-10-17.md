# GPS Detection 2.0 — R0/R1 existing-data-only research

**Status:** OPEN — RESEARCH / DOCUMENTATION ONLY (2026-10-17). **No detector changes, no model training, no deployment.**
**Owner direction:** Use only flight and GPS data *already stored* in FlyTally; do not request new tracks or assume access to independent event-level labels.
**Issue:** [#348](https://github.com/filipto861/flytally-logbook/issues/348)
**Repository:** `flytally-logbook` only. Initial read-only analysis baseline: `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.
**Source status:** Repository inspection and read-only production-schema/aggregate inventory; **algorithm benchmark and model training NOT RUN**.

## Product contract and why this exists

The objective is robust, explainable **advisory** recognition of takeoff, final landing, rolling touch-and-go (T&G), stop-and-go/full stop, low approach, go-around and flight splitting from imperfect imported GPS traces. An observed low pass or height minimum must **not** be silently upgraded to positive runway-contact evidence. Ambiguous contact = `UNKNOWN_CONTACT / NEEDS_REVIEW`, not a fabricated landing. Preserve pilot review, existing certified/finalized flight records and legacy GPS behavior unless a separate, reviewed and tested release explicitly changes it.

Airport Elevation Phase 1 has enabled nullable airport reference elevation `elevationFt` / `ft MSL`. This is **not a GPS detection implementation**. Source altitude may use a different vertical datum; airport MSL reference is not runway threshold, end elevation or a contact sensor. Never compute an authoritative AGL or infer touchdown without validated provenance and uncertainty.

## Verified current app inventory

- `lib/track-processing.ts`: parses KML / GPX / CSV into `KmlPoint {lat,lon,alt,time}`; derives speeds and GPS quality; infers `suggestedSplits`, `flightEnvelope`, `touchAndGoEvents`; and calculates `landingCount(points) = 1 + touchAndGoEvents(points).length` in current advisory flow.
- Existing rolling altitude candidate uses a local minimum and 30 m descent/climb anchors with positional `±10` point neighborhoods and 28–145 km/h speed window. The speed path has separate quality checks. These are **legacy facts**, not proposed GPS 2.0 defaults.
- `lib/civil-twilight.ts` uses takeoff and landing event time/coordinates downstream. Detection changes can affect day/night suggestions and movement evidence and need regression coverage.
- `components/kml-import-form.tsx` / `app/(protected)/flights/actions.ts`: GPS import/review flows consume the helper and save canonical, pilot-reviewed flight entries.
- `lib/data/tracks.ts`: retained track samples are decoded from stored JSON for maps/review. Full raw track and overview are distinguished. The minimal point schema has **no guaranteed horizontal/vertical accuracy, source-native GNSS datum, or touchdown sensor**.
- `public.flight_tracks`: user-owned track `flight_id`, `file_name`, `point_count`, `start_utc/end_utc`, `min_alt_m/max_alt_m`, `coordinates_json`, `overview_coordinates_json`.
- `public.flights`: separate recorded `landings_day/night`, `takeoffs_day/night`, `movement_evidence_recorded`, `certified_at`, and revisions. **Pilot/certification record != independently verified T&G event-time ground truth**.
- Documented real-track regressions: `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md` and `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md` identify altitude discontinuity, duplicate/stale fixes, single-edge false climbs and at least one genuine missed T&G. Preserve historical decisions and explicit negative controls.

**Private evidence handling:** A **read-only production inventory** confirms stored GPS tracks with timestamps and altitude bounds, including flight-level records with more than one landing; the storage spans multiple users. Exact account counts, identifiers, per-user samples, file names and private routes are *deliberately omitted* from this public document. Aggregated metadata are not proof of point-level sampling quality, independent labels or training consent.

## R0 — discovery / source and inference contract

1. Map all producers, parser source variants, normalizers, downstream GPS consumers, release flags, schemas, auth and certified-history boundaries. Recheck actual `main` before any future coding.
2. Formalize event taxonomy and ground-contact epistemics: `TAKEOFF`, `LANDING`, `TOUCH_AND_GO`, `STOP_AND_GO`, `GO_AROUND`, `LOW_APPROACH`, `FULL_STOP`, `UNKNOWN_CONTACT`. Distinguish a phase (possible ground/air) from independently confirmed touchdown.
3. Separate observed signals, derived statistics and reference facts; retain original timestamps, source identity, datum/accuracy when genuinely provided, missingness, coverage gaps and lineages. Never treat `null` as zero.
4. Define an explainable `EventSuggestion` schema with `eventType`, `timeInterval` or unavailable time, evidence spans / reason codes / contradictory evidence, provenance, algorithm version, review status and confidence only if empirically calibrated. Do not make an incompatible public DTO change in R0.
5. Inventory all tests and deliberately difficult cases: jump/teleport, duplicated fixes, near-zero/ambiguous timestamps, altitude level shift, uneven point density, no altitude, taxi, low pass, missed T&G, long pause on ground, air gaps and wrong airport/datum.

## R1 — feasibility with the existing data, no new data required

1. Begin with private, low-impact **read-only metadata**; then evaluate point-level sampling/time/altitude **only within lawfully authorized owners' records** and approved processing limits. No production mutation, raw track export to public GitHub or third-party AI, or other-account training without appropriate permission.
2. Establish a label hierarchy:
   - **Independent event ground truth**: verified contact/event time from a legitimately available independent source (currently **not proven available**).
   - **Pilot-reviewed flight-level totals**: possible `landings_day + landings_night` coarse label after provenance checks; **not** exact contact timing.
   - **Current detector outputs**: **pseudo-labels only** and never ground-truth evaluation labels.
   - **Unconfirmed segments**: unknown/unlabeled; do not pretend `UNKNOWN` means `NO LANDING`.
3. Divide permitted data by entire flight, with grouping by owner/source/aircraft/airport where available. Avoid leaking nearly identical track portions across train/validation/test. Certified records are not permission to retrain or to change record history.
4. Benchmark an explainable deterministic, time-windowed baseline first; test HMM/HSMM phase segmentation and candidate ranking/gradient boosting **only if labels are adequate for the intended supervised task**. Temporal neural networks remain optional research, not a promised feature.
5. Score flight-level landing-count agreement only on independently reviewed trustworthy totals; score event precision/recall and event-time error **only** when verified event annotations exist. Include false events per flight, missed events, abstention, confidence calibration when applicable, and source/sampling stratification. Document limitations and label bias.
6. Gate: explicitly decide `SUPERVISED_EVENT_TRAINING_FEASIBLE` or `INSUFFICIENT_EVENT_LABELS`. If insufficient, **do not train a deceptive event classifier**; continue with deterministic sequence inference, anomaly detection and optional, clearly labeled event review.

## Scope / privacy / safety freeze

- R0/R1 are **research only**; no changes to detector, GPS review UX, canonically saved/certified records, regulatory/recency evidence, source-track files, server actions, migrations or production state.
- No use of another user's private records as model training data without a valid permission basis. Product ownership/DB administration != blanket training consent.
- Do not export raw geographic traces, names, IDs, registrations, coordinates, credentials or precise private counts to public repo/issues, external model services or review handoffs.
- Work with current data only, preserve provenance and be explicit when source data cannot prove runway contact.
- No changes to `flytally-training`. Old detector stays canonical until a separate reviewed, feature-flagged and benchmarked replacement, if any.
- New development requires explicit product decision, isolated experiments, independent second-AI architecture review, versioned evidence, acceptance gates and ROADMAP / FEATURES / CHANGELOG reconciliation.

## R1 feasibility checkpoint — empirical metadata audit (2026-10-17)

A read-only, privacy-minimizing assessment of the existing production track store is complete at the **aggregate/data-structure** level; the new findings and benchmark proposal are recorded in [R1 feasibility & benchmark design](GPS_DETECTION_2_0_R1_FEASIBILITY_BENCHMARK_2026-10-17.md). Raw routes, precise sample locations, user IDs and individual flight records were not retrieved or committed.

**Decision:** existing data support quality-aware time-series research and controlled offline comparisons, **not currently a supervised physical-ground-contact classifier with proven independent event labels**. The current import form initializes starts/takeoffs using `landingCount`, which creates potential circularity if recorded flight totals are treated as ground-truth labels.

Time interval analysis found both duplicate/nonpositive deltas and heterogeneous cadence; index-based `±10 points` evidence neighborhoods cannot represent a uniform elapsed-time span. Database JSON shape/field completeness alone does not verify GNSS accuracy/datum or runway contact. Calibration of confidence and event-level precision/recall remain **NOT RUN / UNAVAILABLE** without independent labels.

Independent read-only adversarial review handoff: [GPS Detection 2.0 architecture challenge](GPS_DETECTION_2_0_INDEPENDENT_ARCH_REVIEW_2026-10-17.md). DeepSeek response received, **PARTIAL ONLY** because the reviewer did not receive the complete R1/R2 documents or access the repo; source hazard claims were separately verified and decisions recorded in [R2 reconciliation](GPS_DETECTION_2_0_R2_INDEPENDENT_REVIEW_RECONCILIATION_2026-10-17.md). That was the **first, partial** review; a second DeepSeek review of the full R1/R2/R2.1/reconciliation documents is now **RECEIVED and conditionally approved for an offline falsification-only design**, with **no source inspection/tests by the external reviewer**. See [second-review reconciliation](GPS_DETECTION_2_0_R2_1_SECOND_REVIEW_RECONCILIATION_2026-10-17.md). The revised [R2.1a falsification/regression contract](GPS_DETECTION_2_0_R2_1_OFFLINE_BENCHMARK_CONTRACT_2026-10-17.md) remains **PROPOSED / UNIMPLEMENTED**, pending product owner authorization. No production code or saved-flight mutations.

## Deliverables, acceptance and status

- R0 output: verified source and consumer inventory, event taxonomy, ambiguity contract and risks. **PARTIAL: preliminary source inventory done; full contract pending.**
- R1 output: private read-only aggregate timestamp/altitude/cadence assessment and reproducible benchmark/label-risk contract. **DESIGN CHECKPOINT COMPLETE: structural and timing audit performed; supervised label gate NO-GO; independent annotation validation and actual model benchmark NOT RUN.**
- **Second complete-document AI review RECEIVED (no code/SQL execution, conditional design only)**. Model comparison, empirical accuracy, calibrated thresholds, runtime rollout, tests, build, browser, PostgreSQL mutation tests, PR merge and deploy: **NOT RUN / NOT APPROVED**. Full-document review is not source validation, test evidence or implementation permission.
- This document is a scoped research draft; it **does not** assert completed model research, successful training or accuracy gains.
