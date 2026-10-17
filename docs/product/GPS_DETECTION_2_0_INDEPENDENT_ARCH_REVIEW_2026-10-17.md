# FlyTally GPS Detection 2.0 — independent AI research/architecture challenge

**Audience:** independent reviewer (DeepSeek/Claude). **Mode:** READ-ONLY / adversarial review; **do not implement or alter branches, DB or deployments**.
**Repo:** `filipto861/flytally-logbook`, current research in Draft PR #349, source snapshot `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.
**Issue:** #348. **Only existing, legitimately usable GPS/flight data**; user has no external training dataset. No personal routes, account IDs, precise location, source files or production credentials are supplied in this handoff.
**Requested outcome:** critique the approach independently and suggest measurable alternatives; do not rubber-stamp HMM.

## Grounded implementation facts (verify against repo)

- Track sample contract `KmlPoint`: lat, lon, nullable altitude, nullable time, no guaranteed accuracy/datum/ground-contact sensor.
- `lib/track-processing.ts` uses deterministic speed/altitude windows to derive advisory T&G and `landingCount = 1 + T&G` (minimum 1); candidate windows are partly `±10` points. Speed rolling event vs altitude local minimum, heuristic high/medium `confidence` not a calibrated probability.
- `components/kml-import-form.tsx::reviewFor` pre-populates starts/takeoffs from `landingCount`. Saved flight totals are thus potentially legacy-suggestion contaminated even after review.
- The saved flight record has takeoff/landing counts and certification metadata; there is **no demonstrated independent per-event timestamp/contact label** in existing schema. Recomputed `getFlightTrackReview` is not ground truth.
- Time-series audit (read-only **anonymous dataset aggregate only**) confirms heterogeneous sampling, duplicate/nonpositive time deltas, substantial missing intervals and steep altitude steps. Exact private stats and tracks are intentionally omitted.
- Existing `tests/v351-gps-tg-reliability.test.ts` contains anonymized false-event and positive controls and a deliberately documented known missed real T&G; these do not form a representative multi-user ML holdout.
- Airport MSL elevation now exists, but its relationship to source GNSS altitude and runway threshold is not guaranteed.
- `lib/civil-twilight.ts` downstream depends on event timing and may affect regulatory/recency suggestions. Certified and owner records must not be silently changed.

## Frozen constraints

1. Source/evidence correctness > plausible guesses; ambiguities return `CONTACT_UNRESOLVED/NEEDS_REVIEW`, **not** `TOUCH_AND_GO`. Aircraft takeoff and runway touchdown have different evidence conditions; flight-phase output never automatically supplies positive wheel contact.
2. No raw GPS export, external model uploads or training on other users' data solely by virtue of DB admin access. Public repo issue must not include private traces/users/flight statistics.
3. No production DB writes, migrations, detector changes or deployment in R0/R1. The legacy inference remains authoritative until separately accepted, feature-flagged and tested.
4. New AI accuracy claims require independent event-level labels; certification and autopopulated counts do not create such labels. No blanket 97% claim from external HMM literature.
5. Scope only `flytally-logbook`, not Training.

## Proposed design (challenge it)

A. Pure time-based + quality-aware deterministic baseline with physically plausible *advisory* phases, robust velocity/elevation continuity and structured abstention, offline against real-derived regression fixtures.

B. Exploratory HMM/HSMM for phase continuity and possible candidate windows, not automatic contact classification. Model evaluation against coarse flight counts is a proxy only; labels may have leakage.

C. Conditional candidate-level supervised boosting/temporal ML *only if* a permitted independent positive/negative contact dataset can be demonstrated. Otherwise no supervised training or production model promotion.

A data contract should expose evidence intervals, source/datum quality, uncertainty and **explicit unresolved contact**; avoid uncalibrated percentages.

## Specific independent review questions

1. Is the **NO-GO supervised ground-contact model** justified given the current data and no external labels? Can weak supervision/multiple-instance learning use known flight landing counts without circularity? What can and cannot be validated if training and evaluation labels come from the same logbook entry?
2. Can an **unsupervised or physics-informed HMM/HSMM** learn from sparse/irregular GPS while avoiding spurious state assignments at track gaps? What would robust model comparison and falsification tests look like?
3. Is a rule/state-machine baseline preferable in a small heterogeneous dataset? Are there lower-complexity robust changepoint, Bayesian filtering, semi-Markov, anomaly-detection or sequence-alignment approaches we neglected? Prioritize the top 2-3.
4. What are the minimum source metadata requirements (horizontal/vertical reference, accuracy, interval, sensor origin, aircraft config) for any form of `near-ground` inference? What if all we ever have is KML lat/lon/alt/time?
5. Can truly indistinguishable go-around/low-pass vs T&G sequences be detected and **abstained** without contradicting a user-provided ground truth? Define counterexamples.
6. Identify hidden GPS technical hazards: zero or negative `Δt`, embedded UTC offsets, altitude quantization/jumps, KML generator differences, stationary duplicated fixes, missing start/end, runway alignment, landing at high terrain, crosswind, low-speed helicopters, taxi or snow-covered ground.
7. What exact **leakage-safe benchmark split and metric** should govern promotion? Should loss be asymmetric (penalize false logged touchdowns more than abstention)? If so, how calibrate when labels are weak?
8. What is the right interface boundary to avoid silently changing certified history and `civil-twilight`/regulatory recency? Describe event-suggestion contract, source provenance, invalidation and review semantics.
9. Identify at least five concrete adverse scenarios where the proposed approach might confidently hallucinate events, and provide executable synthetic fixtures (without private routes).
10. Challenge the method claims in the referenced HMM/LSTM literature: clarify transfer limitations and potential domain shift from FDR/ADS-B to FlyTally KML.
11. Identify conflicts between current repo, this handoff and `docs/product/GPS_DETECTION_2_0_R1_FEASIBILITY_BENCHMARK_2026-10-17.md` and report evidence gaps. Do not assume the docs are correct if the source disagrees.

## Requested deliverable structure

- **Disagreement first:** 5 most consequential risks/faulty assumptions.
- **Evidence matrix:** claim, source/code location, confirmed/uncertain/unsupported, counterexample.
- **Alternative algorithms:** objective, labels needed, hardware/data demands, likely runtime/complexity, weakest assumption.
- **Revised candidate ranking:** Go/conditional/no-go; explain trade-offs without invented performance claims.
- **Minimal experiment matrix:** synthetic tests and permitted real-data checks, no direct production writes.
- **Recommended next design milestone**, risks and acceptance gates.

Do not run code or SQL. This is not product-owner approval for implementation.
