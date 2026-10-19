# GPS V2 D4.2A — Six real KML shadow results and post-corpus review

**Review reconciliation (2026-10-19):** DeepSeek independent read-only response has now been received and independently checked against current source and anonymous corpus evidence. **D4.2A bounded research engineering experiment may be marked COMPLETE**, with rolling T&G recognition **NOT DEMONSTRATED** and production still unsupported. The previous 'review pending' language below is retained as historical evidence, not current status. Corrected overclaims (one slow sample07 edge is not mathematically impossible if it lasts >=5s; sample05 491s gap breaks only its local speed edge; ellipsoid/2–5m accuracy not proven; source 60s edge rule is not a universal coverage threshold). Proposed coverage-only next stage is design only and awaits owner implementation approval; old 'D4.2B/production integration' designation is not silently reused. See `docs/product/GPS_V2_STAGE_D42_POST_CORPUS_DEEPSEEK_RECONCILIATION_2026-10-19.md`.

**Status (2026-10-18): Native 6/6 D4.2A CLI execution PASS. Rolling T&G recognition fitness NOT DEMONSTRATED. Independent post-corpus review PENDING.**
**Scope:** flytally-logbook, research PR #366 Draft, parent PR #364 Draft. No production or aircraft-training changes.

## Native shadow evidence, exact scope

Owner ran the local research CLI tooling/gps-v2-d42-shadow.mjs on six private original KMLs after fast-forward from verified code HEAD 83635bc4 to documentation-only HEAD c5cd44b2. All returned RESEARCH_DIAGNOSTIC_ONLY with no CLI error.

| Anonymous ID | gx blocks | Baseline horizontal STOP_GO | Boundary-aware STOP_GO | Suppressed STOP_GO | Inconclusive emitted candidates | Median sample interval (s) | Max sample interval (s) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sample03 | 2 | 0 | 0 | 0 | 0 | 2.01 | 20.17 |
| sample04 | 2 | 0 | 0 | 0 | 0 | 1.6 | 20.84 |
| sample05 | 3 | 0 | 0 | 0 | 0 | 2.685 | 491.57 |
| sample06 | 2 | 0 | 0 | 0 | 0 | 2.795 | 50.09 |
| sample07 | 2 | 0 | 0 | 0 | 0 | 2.51 | 53.06 |
| sample08 | 2 | 0 | 0 | 0 | 0 | 4.39 | 94.39 |

These particular CLI fields count only STOP_GO_REVIEW_POINT. Do NOT infer other event kinds (departure/arrival) are zero. Zero suppressed is vacuous because there were no hypothetical baseline STOP_GO candidates spanning any blocked source boundary. Zero inconclusive does NOT imply adequate continuous telemetry, or absence of potentially unobserved events. A missing event inside a source coverage gap does not become TP, FP, FN, TN or negative evidence.

Previously verified native legacy rolling-altitude proposals: sample03..08 = 1/1/10/0/6/3, total 21. These are not independently confirmed physical wheel contacts and are NOT comparable with horizontal STOP_GO as accuracy or recall scores.

## Separate offline speed-predicate inspection (Python, not native Node shadow)

The private original six KML sources were read independently with standard XML parsing: pair each gx:Track time with coordinate, mirror adjacent same-UTC and near-position (<1e-7 degrees) canonical deduplication, chronological order; spherical great-circle horizontal speed per successive observed pair. Exclude cross-block edges, nonpositive intervals, intervals >=60s and impossible speed >900 km/h in the current V2 horizontal edge envelope. This is a **separate reconstruction**, not native V2 test evidence or sensor/contact truth.

| Anonymous ID | Eligible timed horizontal edges | Eligible speed edges <=20 km/h | Fraction |
| --- | ---: | ---: | ---: |
| sample03 | 946 | 0 | 0.0% |
| sample04 | 585 | 3 | 0.5% |
| sample05 | 889 | 11 | 1.2% |
| sample06 | 72 | 4 | 5.6% |
| sample07 | 591 | 1 | 0.2% |
| sample08 | 1031 | 0 | 0.0% |

The pinned GPS_V2_HORIZONTAL_V3 requires fast (> or equal 45 km/h), sustained slow (<=20 km/h with >=5s duration), then fast for a horizontal STOP_GO proposal. In sample03 and sample08 no eligible low-speed edge exists; sample07 has only one. This strongly supports a domain mismatch between a low-speed stop/go classifier and rolling T&G while not proving the precise gating reason in every candidate region. Do NOT tune the frozen thresholds from six selected sources.

Owner-reported extra rolling touch-and-go on sample07 was rejected by the **legacy** 25m/s source altitude discontinuity guard due to an observed in-span approx 28.85m/s height jump; do not relax the guard to force a positive. Sample08 has an unobservable possible event in missing GPS data; no inferred candidate may be constructed in the gap.

## Actual engineering acceptance and unresolved validation

- Owner-local exact source/test HEAD 83635bc4 on Node v24.19.0: 83/83 targeted Node tests PASS and TypeScript PASS, including 20 D42 tests and 36 deterministic clean single-block differential cases against existing V2. This is local evidence, not CI, full test suite, browser or production.
- Owner-local D4.2A read-only CLI on documentation-only c5cd44b2: six of six sources parsed and reported; all baseline and shadow STOP_GO counts zero. The six KMLs **do not** validate real positive rolling-T&G recognition or source-boundary suppression effects.
- D4.2A status: research implementation SYNTHETICALLY VERIFIED and CORPUS EXECUTED, but post-corpus independent review PENDING. Do not close overall recognition suitability or permit production expansion. Source runs are NOT flight splits or proof of temporal continuity. No explicit independent physical-contact positives/negatives were acquired.
- Production V2 still UNAVAILABLE/UNSUPPORTED_SOURCE for multiple gx:Track blocks, Pilot Review HIDDEN, experimental flag OFF, no automatic landing count or recency claims. No lib, app, schema, DB, legacy changes, merge or deploy.
- No further coding or threshold changes authorized on the strength of these zero outputs. First seek independent research/evidence review.

## DeepSeek independent post-corpus handoff — READ ONLY / DO NOT CODE

**Observed facts:** D4.1 source lineage passed 6/6 private KML. D4.2A source-segmentation shadow (research only, no lib refactor) passed 83/83 targeted tests, TypeScript, and executed on six KMLs. All six returned 0 base and 0 shadow horizontal STOP_GO, and 0 suppressed/inconclusive emitted candidates. Original selected pilot-reported legacy T&G hypothesis counts 1/1/10/0/6/3, not wheel-contact truth. Median source time intervals approximately 1.6 to 4.39 seconds, but max intervals up to 491.57 seconds. Separate private offline speed analysis shows only 0/3/11/4/1/0 eligible <=20 km/h edges among 946/585/889/72/591/1031 eligible within-block V2-style edges. No independent touchdown sensors. sample07 has pilot-reported missed rolling T&G and 28.85m/s in-span altitude discontinuity; sample08 may have an unobservable maneuver in a long GPS gap.

**Frozen decisions:** Option B production V2 refactor not approved. Legacy 25m/s discontinuity and performance/flight-count rules unchanged. No guessed timestamps in missing spans; no raw KML, GPS positions, registrations or UTC in repository; no physical-contact authority. Production native V2 multi-track UNSUPPORTED_SOURCE, flag OFF, pilot candidates HIDDEN. Owner controls further priorities.

**Please assess:** (1) whether six zero STOP_GO reflects horizontal stop/go vs rolling T&G domain mismatch, without falsely assuming algorithm defect or verified landings; (2) distinction between successful research engineering execution and unproven recognition utility; (3) potential source-backed *future research-only* rolling candidate model using altitude descent/local minimum/climb shape with altitude-quality quarantine versus hybrid horizontal context, keeping 25m/s and other frozen legacy guards unchanged; (4) candidate-independent telemetry coverage/gap UNKNOWN reporting, not generating missing maneuver hypotheses; (5) independent positive/negative evidence tiers and realistic controls; (6) minimal safe roadmap with acceptance tests, confidentiality and clear DO/DO NOT. No code changes, threshold inventing, production acceptance, or accuracy claims. State explicitly if lacking repo/raw KML.

**Requested response:** independent verdict, risks/tradeoffs, review of false-certainty potential, stage sequence and measurable research acceptance gates. No code.
