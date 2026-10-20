# GPS Detection — accuracy-first D1/D2 program (owner reprioritization)

Date: 2026-10-20
Repository: filipto861/flytally-logbook
Base: canonical main (read-only repository/code reconstruction, 2026-10-20)
Planning branch: docs/gps-detector-accuracy-d1-d2-20261020
Status: DESIGN / ROADMAP REPRIORITIZATION ONLY. NO DETECTOR IMPLEMENTATION. NO RELEASE.
Owner direction: Improve automatic T&G event detection reliability; stop adding source-quality warning cards, prompts and other UI clutter as a substitute for fixing the detector.

## 1. Outcome and explicit non-goals

Product outcome: import produces more accurate and defensible proposed takeoff/landing/T&G events with low false-positive risk, compared against unchanged legacy behavior. An algorithmic estimate is NOT independent evidence of wheels touching the ground, approval of regulatory currency, or authority to silently change protected flight records.

- NO additional warning card, candidate picker, notification, panel, prompt or other pilot-facing UI in D1/D2.
- NO auto-accept or silent correction of landing totals, saved flights, Day/Night, recency or certification.
- NO merging or enabling R3-P1B quality card PR #372; its default-OFF implementation and source research remain historical/optional diagnostics, not the product solution.
- Existing stacked P1C design PR #373 is not authority for additional prompts or contact classification. Its source-lineage findings can be reused read-only when separately validated.
- NO alteration to flytally-training, production DB, migrations, Vercel target, feature flags or deployed app.
- Do not label a missed owner-reported manoeuvre as confirmed contact. No independent wheel-contact truth has been established for sample07. A source discontinuity/gap does not authorize interpolation or a touchdown.

## 2. Reconstructed actual main production contract (code and tests)

- `lib/track-processing.ts` exports `parseTrackFile`, `parseKml`, `inspectTrackFile`, `trackQuality`, `suggestedSplits`, `splitPoints`, `touchAndGoEvents`, `landingCount`, `flightEnvelope`. Parser collects multiple gx:Track blocks; normalization can reorder timestamped points and suppress immediately repeated lat/lon/time samples. Source block boundaries must not be misrepresented as continuous contact evidence.
- `speeds()`: per-edge horizontal speed; a zero or otherwise invalid elapsed-time edge currently produces a numeric zero; five-point median by ARRAY INDEX. A missing/invalid timing edge can thus contaminate apparent slow movement. This is a diagnostic risk, not a proven new real-world misclassification.
- `groundEvents()`: <20 km/h with prior/subsequent >42 km/h movement; fixed ±10-point lookaround. Short duration >5 and <90 seconds enters T&G admission after `credibleTouchAndGoGroundEvent()` screens direct >145 km/h and conflicting >=30m ground interval altitude span.
- `altitudeTouchAndGoIndices()`: candidate speed 28–145 km/h; local minimum around ±2 points; at least three usable altitudes on each side; ±10-point history/future; nearest >=30m descent and climb anchors; intermediate timed positive climb evidence; >25m/s vertical discontinuity within these anchors rejects; <8-index grouping. These are not elapsed-time normalized.
- `touchAndGoEvents()` combines admitted speed events with altitude events, deduping by <=10 index distance; `landingCount(points)` is `max(1,1 + number of returned T&G events)`. `confidence` on the event DTO does not gate the count. Do not modify legacy helper in D1.
- `components/kml-import-form.tsx`: `reviewFor()` seeds movement/takeoff suggestion from `landingCount(part)`; pilot may edit counts in existing form. Source replacement and cut changes reset review state. Existing saved flight business rules and authorizations are out of scope.
- Relevant tests: `tests/v351-gps-tg-reliability.test.ts`, `tests/track-processing.test.ts`, `tests/v1381-gps-detection.test.ts`, `tests/v119-gps-landing-review.test.ts`, `tests/v142-gps-import.test.ts`. Read-only inventory must also check GPS/track test group registry and import/split source contracts before D1 coding.
- Historical production evidence: `docs/product/GPS_TOUCH_AND_GO_RELIABILITY.md` and `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md` record a prior locality false negative and R1/R2 false-altitude, R3 false-speed positives, R4 real-derived five-event positive, R5 known missed event with +30m threshold reached at point +11. Historical fixes and verification must be preserved; do not undo tightening-only 3.5.1 safety invariants.
- Source research in draft PRs #368/#369/#370/#371/#372/#373 is UNMERGED and stacked; no source-only study or pilot testimony upgrades its labels to physical-contact truth.

## 3. Hypotheses and falsification order (not accepted fixes)

H1: fixed-index ±10 qualification excludes a valid descent/climb despite usable, contiguous additional samples. Check the R5 known +11 crossing and adversarial varying-density clones.
H2: speed median's invalid-time-as-zero and duplicate/stale fixes can manufacture a stop. Use explicit missing/invalid status in shadow diagnostics, not automatic speed=0.
H3: an edge discontinuity or >15s gap inside the required physical manoeuvre envelope destroys trustworthy continuity. Distinguish continuity unavailable from genuine geometric evidence; never bridge an unobserved interval or waive the >25m/s source guard simply to recover sample07.
H4: index-based candidate grouping/dedup (<8, <=10) can merge distinct manoeuvres or double-count one during resampling. Need demonstrated counterexample before changing merge contract.
H5: multi-gx source parsing, timestamp ordering and split boundaries may alter the apparent flight evidence. Compare exact source/canonical/split lineage; no implicit stitching across unsupported gaps.
H6: the last +1 landing assumption is only a legacy suggestion shortcut; do not turn it into a certified count when a flight is incomplete or source quality fails.

## 4. Milestone D1 — read-only decision/rejection inventory (first implementation to propose)

Scope: research/test-only module, no changes in `lib/`, `components/`, `app/`, persistence or deployment. Shadow-replay the EXACT frozen legacy detector on explicit input partitions, and emit PRIVATE-LOCAL structured reason statistics (not a second detector). Proposed diagnostic statuses: `ADMITTED_LEGACY`, `REJECTED_<explicit predicate>`, `SOURCE_OR_TIME_UNAVAILABLE`, `AMBIGUOUS_OVERLAP`. Vocabulary is design-stage, not frozen API.

- Instrument the accepted and rejected candidate stages WITHOUT changing behavior, source parsing, thresholds, event ordering, counts, grouping or `flightEnvelope`.
- Prove accepted event count, index/time/signal/confidence parity with `touchAndGoEvents()` for every testable accepted shape; reason counts cannot be interpreted as contact counts.
- Separate source-insufficient or unobserved intervals from true predicate failure; retain exact source/cut identity in local process only. Do not print coordinates, UTC, altitude, registration, path, account identity, raw source or per-user records into logs/PR.
- Create synthetic tests for timing collisions, stale identical fixes, inconsistent source gx blocks, long gaps, altitude discontinuity inside/outside candidate span, high-speed low pass, go-around, density changes, manual split/cut invalidation and previously recorded R1–R5/legacy positive controls.
- On six owner-private original KML samples, request **only anonymous counts by diagnostic reason and source eligibility**, after exact local fixture preflight; never commit the originals or generated route traces. No physical-contact accuracy claim without independently eligible reference labels.
- Acceptance D1: zero changes to legacy runtime and event suggestions; targeted source/track contracts pass at an exact code HEAD; diagnostics are deterministic and redact source; unable-to-observe never appears as no-event/zero.

## 5. Milestone D2 — candidate detector design / independent review BEFORE coding

Design a new pure offline/shadow inference engine with (a) continuous evidence islands bounded by validated timestamp/position/altitude discontinuities, (b) time-aware candidate neighbourhoods and sampling-density-resistant smoothing, (c) source-quality status separate from geometry, (d) speed and altitude as mutually cross-checkable evidence rather than standalone touchdown truth, and (e) event de-dup using actual time and manoeuvre envelopes instead of arbitrary index proximity, if supported by tests.

D2 must explicitly derive and justify every window, tolerance and evidence requirement from reviewed corpus or source data; DO NOT invent time limits, generic aircraft envelopes, runway thresholds, ground height, GNSS accuracy or interpolation across gaps. Preserve legacy 28–145 km/h / 30m / 25m/s as **comparison baseline**, not a permanent claim of validity. Any new numeric rule requires falsification and reviewer approval. No hard-coded airframe performance without sourced applicability.

Output must distinguish supported event hypothesis, contradicted hypothesis, and unavailable evidence internally. It may propose a separate *non-counting* hypothesis tier for offline scoring; this is NOT permission to add UI clutter or auto-accept ambiguous events. An accepted automatic count candidate must clear an explicit stricter evidence gate; no attempt to make sample07 show a seventh contact without adequate telemetry.

Adversarial cases: slow/fast low pass; go-around with no contact; stop-and-go; taxi speed stop; take-off and final landing; interrupted descent; teleport; stepped altitude datum; duplicate timestamps/fixes; sparse/dense resampling of the same geometry; split at a candidate; multi-block KML; missing altitude; airport/reference unknown. A known negative changing from 0 to 1 event is a release blocker pending adjudication.

## 6. D3 benchmark + D4 integration gates (planned, NOT AUTHORIZED to implement now)

D3 runs pure offline side-by-side reports legacy vs candidate, stratified by eligible independently adjudicated labels, separately uncorroborated owner reports, and unlabeled tracks. Output counters: TP, FP, FN only where eligible event-level direct reference labels and coverage exist; otherwise label agreement, drift, contradiction and unavailability, not 'accuracy' percentages. Record false-positive and missed candidate deltas; assert no new known corroborated false positives and no regressions in validated R1–R4/high-speed low-pass. Do not tune and score on the same private few-flight corpus without independent holdout.

D4 integrates ONLY after owner approves frozen D2+D3 design and independent review; default-OFF runtime shadow first, then separate UI/release decision if proven helpful. Before changing import suggestions, inspect source selection, `reviewFor`, split, form/save, existing day/night/recency tests, auth and audit boundaries. No automatic correction of finalized/certified flights. Feature flag OFF preserves legacy behavior. Follow candidate-bound planner, targeted/focused/full gates as selected, browser, local Node24/Playwright, DB only if selected by actual touched scope, plus exact-deploy authorization.

## 7. Release, branch, dependencies, DoD

Sequence: Owner reprioritization recorded -> D1 scope/reason taxonomy and offline replay -> D1 evidence + parity tests -> freeze D2 draft -> one independent DeepSeek/Claude read-only review -> reconcile findings -> owner approval of any risk-bearing rule -> small D2 offline implementation -> D3 falsification -> separate D4 go/no-go.

Do NOT merge PR #372/#373 as user-facing solution. Preserve source research and audit provenance. Implementation should be created as a separate small `research/gps-detector-accuracy-d1-...` branch from a freshly reconciled canonical main, not a stacked descendant of P1B.

For this planning-only branch, tests, typecheck, build, Playwright, database and deploy are **NOT RUN / N/A for non-executable docs**. The reviewer is NOT yet consulted. ROADMAP/FEATURES/CHANGELOG must record planning only. Nothing in this plan establishes approved navigation equipment, contact truth, or full regulatory compliance.

## 8. DeepSeek / independent reviewer read-only packet (ready to forward)

ROLE: Independent critical reviewer; READ ONLY. NO code, deployment, DB access or invented thresholds.

Repository: filipto861/flytally-logbook. Canonical baseline: main as reconstructed on 2026-10-20. Work: docs/gps-detector-accuracy-d1-d2-20261020, plan in this file. No runtime changes or tests claimed. Product owner wants reliable T&G inference, explicitly rejects additional warnings/cards as the fix. Draft P1B PR #372 remains OFF/unmerged; P1C PR #373 stacked/unmerged. Legacy production detector lives in lib/track-processing.ts; imported counts are initially seeded through components/kml-import-form.tsx. Review legacy reliability docs and exact tests cited in section 2. Evidence hierarchy: source code/tests and direct contact evidence > owner reports/source geometry; candidate != physical wheel contact.

FROZEN: no silent changes to landings or saved/certified records; no weaker corrupt-data guards to force extra T&G; no private KML in repo; no changes to production, flags or training repository; no new UI. All missing/ambiguous source evidence fails closed; invalid timing != zero speed. No per-aircraft performance assumption.

QUESTIONS:
1. Is D1 source/partition parity achievable without mirroring fragile legacy implementation or creating a de-facto second source of truth? Suggest test seam and safe module boundary.
2. Which existing predicates create the highest demonstrable false-negative/false-positive risk, and how should rejection reasons be assigned without double counting overlapping source windows?
3. Propose safe time-normalized segmentation and continuity architecture WITHOUT new undocumented numeric thresholds; identify where unavailable/unknown must prevail.
4. Identify missing adversarial cases, confounding source-lineage/split assumptions and security/privacy hazards.
5. Define candidate-level go/no-go benchmarks when physical contact labels are missing or only first-party attested, including independent holdout and regression blocker policy.
6. Assess minimal D1 acceptance and any necessary order/dependency corrections before coding.

Respond: APPROVE / APPROVE WITH CHANGES / BLOCK; severity-ordered findings with exact file/function/evidence vs inference; specific minimal corrections; unresolved owner decisions. Do not claim execution, independent physical touchdown verification or approval.
