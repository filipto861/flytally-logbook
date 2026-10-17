# GPS Detection 2.0 — R2 second-AI review reconciliation

**Date:** 2026-10-17  
**Scope:** `flytally-logbook` / [Issue #348](https://github.com/filipto861/flytally-logbook/issues/348) / [Draft PR #349](https://github.com/filipto861/flytally-logbook/pull/349).  
**Evidence baseline:** source read-only `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.  
**Reviewer:** user-provided independent DeepSeek review (2026-10-17), *text only*.  
**Review status:** **PARTIAL EXTERNAL REVIEW + SOURCE RECONCILIATION**, **NOT** a full R1/R2 document review. DeepSeek explicitly reported **R1 and R2 documents absent** and **no repo access**. This limitation is neither resolved nor hidden by ChatGPT inspecting the documents afterward. A complete independent R1/R2 document review is still **PENDING**.  
**Implementation state:** research/documents only, no code/test/DB/schema/AI model changes and no deploy.

## 1. Outcome

**ACCEPT** a gap-aware deterministic time-series baseline and its falsification harness as the first candidate.  
**CONDITIONAL / RESEARCH ONLY** changepoint segmentation and HMM/HSMM for movement phases, not verified ground contact.  
**NO-GO** supervised touchdown/T&G event classification, event precision/recall and numerical confidence calibration on unlabeled/suggestion-contaminated GPS alone.  
**CONFIRMED DISTINCTION:** motion-phase or T&G-*pattern* candidate ≠ independently supported touchdown. Pilot-confirmed event evidence is recorded with separate provenance and cannot be silently overwritten by detection.

This review is **not** an empirical accuracy test or acceptance of a new runtime detector.

## 2. Review findings reconciled with actual source

| Review claim | Direct repo evidence | Decision | Remaining concern |
|---|---|---|---|
| Zero/invalid elapsed time can masquerade as stopped movement | `lib/track-processing.ts:68-69`: `seconds` returns 0 on invalid/nonpositive; `speeds` maps zero duration to speed 0 then median-smoothed | **CONFIRMED, ACCEPT** time-quality mask before feature derivation | Actual error frequency per authorized owner/source and effect on detections not measured |
| Parser can erase source-order clues | `lib/track-processing.ts:17-18`: adjacent dedup + time sort when >=2 parsed times | **CONFIRMED, ACCEPT** separate raw-order preservation in research pipeline | Source order reconstruction from *already persisted normalized* JSON may be impossible |
| Valid 0 m altitude can disappear | `lib/track-processing.ts:233`: `trackStats` filters `value!==0` | **CONFIRMED, ACCEPT** null vs zero strict separation in new research code | Legacy fix is a separately scoped potential defect; do not silently change it |
| Map altitude can replace null by 0 | `lib/data/tracks.ts:23-25`: `Number(item?.alt)` before finite check | **CONFIRMED, ACCEPT** do not use map DTO as research source | Null-to-zero only proven for map decoder; not claimed for all stored points |
| Count labels potentially circular | `components/kml-import-form.tsx:64-66`: `starts`, `takeoffs` default from `landingCount(part)`; `lib/track-processing.ts:231` minimum final count 1 | **CONFIRMED, ACCEPT** count-only weak proxy, require human correction provenance | There may be stronger labels in particular accounts; not verified |
| Ground/contact timestamp not independently present | `KmlPoint` `lib/track-processing.ts:1`, `lib/data/flight-track-review.ts:52-64` recomputes suggestions | **NO EVENT GROUND TRUTH DEMONSTRATED**, not proof it never exists anywhere | Pilot-adjudicated evidence not established |
| Gaps may cause an HSMM to hallucinate intermediate phases | Plausible algorithmic risk, **no HSMM implemented or tested** | **ACCEPT AS DESIGN HAZARD**, not verified bug | Require explicit gap semantics / emissions / state resets and falsification |
| Missing vertical datum / KML altitude mode | `KmlPoint` lacks datum/mode fields (`track-processing.ts:1`); legacy parser extracts numbers (`track-processing.ts:20-38`) | **CONFIRMED LOSS OF PROVENANCE**; do not treat airport elevation as source-compatible AGL | Historical stored track cannot necessarily recover mode; source-file metadata absent |
| Uncalibrated `high/medium` | `lib/track-processing.ts:209,226-229` enum/type and heuristic ranking | **CONFIRMED, ACCEPT** no output percentages from heuristic confidence | Feature wording and UI should avoid implying contact certainty |
| R1/R2 reviewed by DeepSeek | Review plainly says R1 and R2 were not supplied | **REJECT** any claim of a completed independent full-doc approval | Re-send both actual docs for another read-only independent review |

No live route samples or identity data were transmitted to the second AI. No private GPS files were exported to the public repository.

## 3. What is already handled in R2, and what must be strengthened

**Previously covered by R2:** temporal quality masks, zero/null separation, source/datum uncertainty, distinct phase vs contact, incomplete-final-track `UNAVAILABLE`, no model/DB mutation, time-based windows, legacy shadow comparison. Review validates priority, rather than inventing all of these requirements anew.

**Strengthen explicitly:**
1. Replace `NO_CONTACT_EVIDENCE` (ambiguous as a negative class) with a contract that makes **contact status `UNRESOLVED` by default**, including `CONTACT_PATTERN_CANDIDATE` as an *advisory hypothesis*, not proof. Confirmed contact must originate from a separate authorized pilot/external evidentiary record. **No `NO_CONTACT` label from mere absence of observed contact.**
2. Explicit `GAP / UNKNOWN` phase is mandatory for any HMM/HSMM comparator. Do not decode transition paths over gaps as if observations existed. Run each supported contiguous island independently, or use missing-data emissions that preserve an unobserved span as **UNKNOWN**. Any inferred transition inside a gap must be withheld.
3. Introduce explicit `SourceObservation` vs `DerivedPhase` vs `PilotAcceptedEvent` separation. Run-time suggestions have versioned provenance and invalidation on track content, time reference, airport reference, algorithm-version or reviewed-event changes.
4. Never use new phase suggestions as automatic input to `civil-twilight`, regulatory/recency or certified history. Existing legacy downstream consumption is a fact and must remain unchanged in an R2 offline experiment.
5. Keep **candidate recognition useful**: a sequence matching touch-and-go can be shown as `T_G_PATTERN_CANDIDATE / NEEDS_PILOT_REVIEW`. The strict requirement is **zero algorithmically asserted/confirmed physical contacts**, **not zero hypotheses**; the latter would make an advisory detector useless.
6. Under sparse evidence, avoid a precise invented event time; return a supported time interval, or `UNAVAILABLE`, not a false sample-level contact point.

**Review interpretation caution:** `CONTACT_UNRESOLVED` from bare GPS is not proof that contact did not occur. A pilot-provided true T&G annotation may coexist with algorithmic unresolved contact, with separate provenance. Do not train negatives by taking unannotated tracks.

## 4. Revised algorithm candidate order

| Candidate | Decision | Preconditions / reject condition |
|---|---|---|
| A. Gap-aware, quality-masked, temporal deterministic baseline | **GO to isolated synthetic experimental design after owner approval** | Fail closed on invalid dt, unknown datum and gaps; no persisted changes |
| B. Robust changepoint / segmented regression | **SECOND comparator / CONDITIONAL** | Must beat A on predefined regressions, no hallucinations at gaps |
| C. HMM/HSMM with explicit UNKNOWN and missing-data model | **EXPLORATORY only** | No bridging gaps, no false contact, no transfer of FDR accuracy claims |
| D. Sequence template matching using runways | **DEFER** | Runway geometry and source location accuracy/effectivity not yet guaranteed |
| E. Supervised boosting / MIL for physical contact | **NO-GO** | Missing independent labels/permission; counts possibly contaminated |
| F. LSTM / temporal CNN / Transformer for contact | **NO-GO now** | No credible held-out event labels or applicable evidence |

This order is an **architecture candidate**, not a production model-selection verdict.

## 5. Evidence-first acceptance for R2.1

**Proposed isolated milestone (requires owner approval; not implemented):**

- Static research types distinguish `INVALID_TIME`, `MISSING_POSITION`, `GAP`, `ALTITUDE_DATUM_UNKNOWN`, `VALID_ZERO_ALTITUDE`, phase and contact hypothesis separately, and preserve point order.
- Unit fixtures derived from source-owned synthetic trajectories, plus existing tests from `tests/v351-gps-tg-reliability.test.ts` where reusable without copying private coordinates. No production SQL writes/read path in harness.
- All bare-track scenarios yield **zero algorithmically `CONTACT_CONFIRMED` outputs**; T&G-*pattern* candidates allowed if marked unconfirmed. This is a contract test, **not** physical-contact classifier quality evidence.
- Explicit counterfactual pair: identical sampled GPS points, distinct external truth (brief T&G vs low pass) must both return identical unresolved algorithm evidence; the independent pilot truth remains separate.
- Duplicate `Δt=0` must not create a `STATIONARY` phase; missing dt must not be replaced by a numeric speed; gap spans must not produce events or times.
- Unknown datum must not produce derived AGL/touchdown. True altitude `0` and null remain distinct.
- Benign resampling should not invent *confirmed* events. If it affects pattern candidates, count as reproducibility variance/uncertainty, not automatically PASS.
- Progress must be measured without circular event labels. Known positives/misses, regression false positives, abstention and supported count agreement have separate denominators and provenance.
- `npm` / targeted test / typecheck/build status remains `NOT RUN` until an experiment branch is approved and executed.
- Independent reviewer must receive **the actual R1 and R2 text**, or the final reviewer report must state that its review is incomplete.

**Proposed gate:** require R2.1 experiment scope + tests and non-mutation/no-leakage controls to be approved by product owner before writing code. After measured evidence, independent review and acceptance, decide whether R2 is suitable for a feature-flagged integration roadmap.

## 6. External-review coverage / remaining discrepancy list

DeepSeek supplied: substantive challenge, evidence matrix, alternatives, 10 synthetic fixture outlines and 11 answers. That is useful independent architecture feedback.

DeepSeek **did not supply**: actual source verification, R1/R2 full-document comparison, executable fixtures, model metrics, benchmark execution or test results. Calling it `FULL R2 REVIEW PASS` would be misleading. ChatGPT source comparisons above resolve the *source-hazard fact checks*, **not** missing independent review.

**Decision checkpoint:** **R2 independent review = PARTIAL**, **source hazards reconciled = YES**, **R2.1 offline benchmark design = PROPOSED**, **R2.1 implementation authorization = NO**, **GPS Detection 2.0 production change = NO**.
