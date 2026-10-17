# GPS Detection 2.0 — R2.1a offline falsification/regression contract (implementation proposal only)

**Status:** R2.1a CONTRACT REVISION / OWNER APPROVAL REQUIRED; **NO IMPLEMENTATION / NO TEST RUN**. The filename retains the earlier *benchmark* term for link/history stability; this document is **NOT an empirical benchmark**, nor evidence of accuracy or superiority.  
**Date:** 2026-10-17  
**Scope:** `flytally-logbook` only, [Issue #348](https://github.com/filipto861/flytally-logbook/issues/348), [Draft PR #349](https://github.com/filipto861/flytally-logbook/pull/349).  
**Input:** [R1 data/label feasibility](GPS_DETECTION_2_0_R1_FEASIBILITY_BENCHMARK_2026-10-17.md), [R2 architecture](GPS_DETECTION_2_0_R2_PROPOSED_ARCHITECTURE_2026-10-17.md), [source-backed first review reconciliation](GPS_DETECTION_2_0_R2_INDEPENDENT_REVIEW_RECONCILIATION_2026-10-17.md) and [second, full-document DeepSeek review reconciliation](GPS_DETECTION_2_0_R2_1_SECOND_REVIEW_RECONCILIATION_2026-10-17.md).

## 1. Narrow objective

In an **offline, pure TypeScript, fixture-only falsification harness**, compare current legacy T&G advisory behavior with a quality-masked, time-windowed phase/pattern candidate. It is **not** a representative measurement of event precision/recall or model superiority because the synthetic and checked-in regression scenarios are not an untouched independent holdout. No external training data, model training, production DB access, UI, airport lookup, feature-flag rollout, logbook save or any mutation to finalized/certified records. Research code must never be imported by `components/kml-import-form.tsx`, `lib/civil-twilight.ts`, `lib/data/flight-track-review.ts`, routes, APIs, server actions, persistence or other production modules.

**Primary question:** Can a quality-aware advisory detector preserve useful T&G *pattern* candidates on existing evidence while reducing explicitly known legacy false-positive failure modes and returning real uncertainty on insufficient evidence?

**NOT asked or measured now:** Are wheel contacts correctly classified with validated probability, precision, recall or superiority against real flights? The fixtures do not support those claims. Passing tests means **regression/falsification only**, not validation. A candidate must meet **both** safety gates and an explicit *utility* gate: a universal all-`UNAVAILABLE` predictor FAILS usefulness, even if it asserts no false contact.

## 2. Proposed minimum implementation shape (not authorized yet)

```text
research/gps-detection-r21/
  observation-types.ts       // source order, raw time, alt/datum/mode, missingness
  quality.ts                 // separate valid islands; invalid dt/gap/uncertainty
  temporal-features.ts       // safe within-island speed/vertical trend
  candidate-detector.ts      // advisory patterns; NO physical contact assertions
  legacy-shadow-adapter.ts   // production-equivalent legacy path on same fixture
  falsification.ts           // fixture output comparison and evidence scorecard
tests/gps-detection-r21-*.test.ts
docs/product/GPS_DETECTION_2_0_R2_1_FALSIFICATION_EVIDENCE.md // only if executed
```

Names are provisional. Keep research under a top-level `research/` directory, **never** `lib/` or a normal app import tree. The eventual experiment PR must enforce a CI/source-contract rule that *no production imports* of `research/` exist (including barrel/re-export or dynamic imports); no runtime/DB code may depend on it. Research computations must not reuse unsafe legacy `seconds()`, `speeds()`, `normalize()`, `trackStats()` or map `decodePoints()`. The **legacy comparator alone** may call the exact unchanged production parse/normalize/detect path, and must record its preprocessing provenance. Reuse test infrastructure and vetted shared math where appropriate; no new dependencies, HMM/HSMM or ML in R2.1a.

### Input and output contract

- `SourceObservation`: source lat/lon and ordinal order, raw timestamp, explicit UTC/offset or `UNAVAILABLE`; timestamp precision `KNOWN(value) | UNKNOWN`; altitude `number | null`, altitude unit `KNOWN(value) | UNKNOWN`, altitude mode `KNOWN(absolute | relativeToGround | clampToGround | other) | UNKNOWN`, vertical datum `KNOWN(value) | UNKNOWN`; horizontal and vertical accuracy `KNOWN(value + units) | UNKNOWN`; source format, producer/generator and sensor origin each `KNOWN(value) | UNKNOWN`. Preserve uncertainty and raw-order provenance, never silently fill metadata based on file extension, known airport, default sensor or historical KML assumptions. These are **source facts**, not claims that historical records contain them.
- `QualityInterval`: `VALID` or `UNAVAILABLE(reason)` with temporal/spatial support; zero/negative/missing dt never produces valid 0 km/h. Preserve raw order and normalization decisions. Partition each track into **contiguous supported signal islands**. A gap is an explicit `GAP_UNKNOWN` boundary: no candidate's evidence/support window may span it. Any gap-adjacent candidate must have `GAP_ADJACENT`, contact unresolved and event timestamp `UNAVAILABLE` when exact timing would rely on the gap.
- `PhaseCandidate`: `POSSIBLE_GROUND`, `POSSIBLE_AIRBORNE`, `APPROACH`, `CLIMB`, `DESCENT`, `GAP_UNKNOWN`, `UNCERTAIN`. Never equate POSSIBLE_GROUND with wheels on runway.
- `EventHypothesis`: `T_G_PATTERN_CANDIDATE`, `LOW_APPROACH_PATTERN_CANDIDATE`, `GO_AROUND_PATTERN_CANDIDATE`, etc.; **support interval confined to one valid island** (never spanning a gap), supporting/contradictory reason codes and optional gap-adjacent status. **physicalContactStatus always `UNRESOLVED` from track-only input**. No computed `CONTACT_CONFIRMED` or `NO_CONTACT` negative label, including for unlabeled/insufficient data.
- `AdvisoryPatternCount`: separate type/name/namespace from legacy `landingCount` and canonical movements. `AVAILABLE(n)` only for evidence-supported candidate patterns and known scope/coverage, otherwise `UNAVAILABLE(reason)`. No minimum-one assumption. Never assignment-compatible with certified movements, regulatory/recency or `civil-twilight` counters; do not provide a conversion adapter in R2.1a.
- `SourceProvenance`: hash/fingerprint of private input context, algorithm version, source time basis, datum status, reference/effectivity when used; evidence invalidates on changing track/time/airport/algorithm/review context. Never expose stable identity hashes for private flights in public fixtures.
- `PilotEventEvidence` (external and separate): independent accepted/rejected contact evidence, not predicted by this harness. Can be represented as synthetic-only truth in tests but never generated by inference.

**Explicit compatibility requirement:** legacy helpers untouched, live production paths unchanged. The shadow adapter runs the **exact existing production-equivalent parser, normalize, detector and count path** on the **same synthetic/checked-in fixture input** as the research pipeline, with both source-order and transformed-point summaries recorded. Report (1) end-to-end comparison and (2) preprocessing differences as a **confound**. Do **not** attribute a difference to a superior event algorithm unless preprocessing effects can be separated. No suggestion flows to `civil-twilight`, regulatory currency, certification or production imports.

## 3. Predeclared synthetic/adverse fixtures and expected assertions

| Fixture ID | Scenario | Required assertion (new research detector) |
|---|---|---|
| T01 | Empty / one sample / missing time | `UNAVAILABLE`, no invented count/time or contact |
| T02 | Duplicate timestamp at apparent stop | Invalid derivative, not speed 0; no inferred stop/contact on duplicate edge |
| T03 | Backwards timestamp / reordered acquisition | Reject edge and flag source-order/time inconsistency; no silent chronological healing |
| T04 | Stationary repeated coordinates with increasing valid time | Can indicate possible stationary motion, but not physical contact; no T&G from ground-only record |
| T05 | True altitude 0 m vs missing null altitude | Zero retained as known numeric observation; null unavailable; never coerce |
| T06 | Altitude level shift during climb | No T&G assertion; mark discontinuity and contradicting evidence |
| T07 | Sawtooth during initial climb | No falsely confident descent-to-ground plus climb contact event |
| T08 | Legacy duplicate/stale-fix speed false T&G | No fake stop/contact; quality reason documented |
| T09 | Positive five-pattern circuit from checked-in v351 fixture (**legacy regression positive, not independently labeled contact truth**) | **Utility fixture:** at least one supported `T_G_PATTERN_CANDIDATE` in a valid signal island; record candidate-count denominator, coverage and any missed patterns. All-unknown = utility FAIL. Zero contact confirmations |
| T10 | Known missed short rolling T&G (`+11` shape) | Candidate or explicit **MISS/UNRESOLVED**; never relabel legacy failure as a negative |
| T11 | Flat-altitude stop-and-go (**legacy regression pattern positive, not independently labeled physical contact**) | **Utility fixture:** at least one supported stop/go pattern candidate where valid horizontal evidence exists; a detector returning only `UNAVAILABLE` fails usefulness. Contact remains unresolved |
| T12 | KML altitude mode/datum unknown at high-terrain airport | No computed AGL/touchdown from airport reference; explicit datum unknown |
| T13 | 60- and 120-second gap straddling descent/climb | Explicit `GAP_UNKNOWN`; **no candidate support spanning either gap**, contiguous-island computation; gap-adjacent pattern marked `GAP_ADJACENT` and no precise event time |
| T14 | Cropped beginning/end; track ends in climb | No automatic final landing or `1` default; count `UNAVAILABLE` |
| T15 | Taxi-only, no airborne proof | No new takeoff/landing contact evidence from single speed outlier |
| T16 | Identical sampled GPS, independent truth A = T&G and B = low pass | **Same algorithm output** `CONTACT_UNRESOLVED` for both, with separately stored truth |
| T17 | Resampling same continuous trajectory (half/double density) | Report difference in pattern candidates and abstentions; no new confirmed contacts; flag unsupported windows |
| T18 | UTC explicit offset / midnight | Consistent duration only when offset explicit; ambiguous time `UNAVAILABLE` |
| T19 | Contradictory elevation / quantized altitude | No false AGL contact; explicit vertical evidence weakness |
| T20 | HMM-specific future gap scenario (out of R2.1 scope) | Documentation-only pending comparator; no claims of implementation |

Fixtures T06–T11 should **reuse the semantic pattern** of `tests/v351-gps-tg-reliability.test.ts` with independently authored synthetic positions, or explicitly cite the already checked-in and anonymized existing fixture without copying any private tracks into the new public repo. No exact GPS coordinates or sensitive source data from production.

### Additional adversarial fixtures required by complete independent review (A01–A15)

| ID | Scenario | Predeclared contract / assertion |
|---|---|---|
| A01 | Track has lat/lon/time but **no altitude** | May offer horizontal advisory pattern only with supporting quality evidence; no AGL calculation, no contact claim |
| A02 | Identical altitude numbers but `clampToGround` vs `absolute` | Preserve differing source modes and mark unverified datum; **no invented AGL or physical contact** |
| A03 | Near-runway GPS with explicitly poor horizontal accuracy | No claim that track proves runway vicinity/alignment; contradictory accuracy reason retained |
| A04 | Several takeoffs/landings in one trace | Count **pattern hypotheses only** under a distinct type; no legacy minimum-one final landing or certification count |
| A05 | Takeoff-only or cropped start | No invented landing, missing boundary => advisory count `UNAVAILABLE` when coverage insufficient |
| A06 | Landing-only or cropped end | No invented takeoff, missing boundary => advisory count `UNAVAILABLE` when coverage insufficient |
| A07 | Explicit go-around pattern | May propose `GO_AROUND_PATTERN_CANDIDATE`, **contact unresolved**, no false confirmed T&G |
| A08 | Explicit low pass | `LOW_APPROACH_PATTERN_CANDIDATE` where supported; indistinguishability must not become asserted touchdown |
| A09 | Negative numeric altitude, unknown vertical reference | Preserve negative value (not missing/ground); flag datum/elevation contradiction when appropriate |
| A10 | Horizontal teleport | Invalid edge; do not compute meaningful ground speed or event hypothesis from teleport |
| A11 | Coarse/quantized timestamps causing repeated times | `Δt <= 0` unavailable, never interpreted as measured zero-speed dwell or contact |
| A12 | Valid-time repeated stationary position | Possible stationary phase but **no T&G/landing/contact claim** for ground-only track |
| A13 | Pattern window adjacent to and potentially spanning a gap | Split by valid-island boundaries; never span gap, set `GAP_ADJACENT` and event time `UNAVAILABLE` when affected |
| A14 | All-unknown predictor on checked-in positive-pattern fixtures | **Hard utility FAIL** on T09 or T11; report supported candidates, eligible fixtures, missed hypotheses and abstention separately |
| A15 | Same physical trajectory under benign resampling | Record supported candidate-window overlap/count stability and abstention changes; no new confirmed contacts or false superiority claim |

**Fixture input restrictions:** These are synthetic-only tests or uses of already checked-in anonymized regressions where permission/provenance is explicit. No actual production routes, registrations, identity-linked coordinates, raw database JSON, KML file names, or private owner breakdowns may be copied to the public repo, model provider or review service. HMM-specific T20 is a documented future gate, not executed as an R2.1a model test.

**Coverage/failure semantics:** T09 and T11 are **legacy pattern positives**, not independently proven wheel-contact truths. Their utility assertions are required for this experiment; if a conservative algorithm cannot produce a safe candidate, it must report **utility FAIL**, not relax the fixture or invent a contact. A10–A13 and T02/T13 are safety invariants. Every test status and denominator must be reported separately, with `NOT RUN` when no runnable fixture exists.

## 4. Scorecard (do not conflate truth and suggestions)

For each fixture, record:
- Legacy detected candidate count, new pattern candidate count, quality rejection count and `CONTACT_UNRESOLVED` count.
- Source support and known fixture-grounded expected behavior; `UNKNOWN` is never silently scored as true negative.
- False positive **pattern hypotheses** on known negative fixtures, known-positive pattern detected/missed, abstentions, event-window support and false timestamp claims.
- No (0/0) denominators disguised as 100% accuracy, no uncalibrated probabilities, no cross-validation on generated pseudo-labels. **Report pattern-candidate coverage (eligible positive fixtures, eligible supported events), abstentions, false pattern candidates and exclusions with separate denominators.**
- Existing flight-level count agreement only later, when counts have defensible review provenance and permission; even then it is a weak proxy, never event precision.

**Hard functional safety gates:** any computed bare-track `CONTACT_CONFIRMED` or `NO_CONTACT` label; speed=0 derived solely from invalid dt; event support crossing a gap; precise event time invented from a gap; missing-vs-zero confusion; invalid AGL from unavailable source datum/mode/unit/accuracy; cross-layer research import; or legacy runtime/DB/flight mutation is **FAIL**. True altitude 0 survives; null remains missing. **Independent hard utility floor:** T09 and T11 must each emit at least one supported pattern candidate on their declared valid synthetic evidence, with zero confirmed contacts; universal `UNAVAILABLE` **FAIL**, not a safety PASS promoted as usefulness. T10 stays a known-miss diagnostic, never relabeled negative.

**Evaluation boundary:** T01–T20 and A01–A15 are **predeclared falsification/regression cases**, not an independent holdout; prohibit parameter/threshold optimization against these pass/fail fixtures and do not call their scores validation accuracy. Pre-register any candidate thresholds and reasons **before the first run**. If threshold iteration is needed, use a distinct explicitly identified development set; the fixed falsification matrix remains a red-line regression suite, **never** retrofitted into a purported holdout. No genuine untouched independent labeled holdout exists today, so conclusions remain **synthetic regression evidence**, not validated precision/recall, calibrated probabilities or production superiority.

## 5. Build, verification and scope boundary if owner authorizes implementation

1. Reconstruct actual branch HEAD and docs; check GitHub main and active experiment milestone.
2. Create small branch `test/gps-detection-r21-falsification` (or another appropriately scoped branch), not modify `main` or current docs-only PR without roadmap approval.
3. Implement **fixture harness first** with explicit expected failures, then minimal quality-aware baseline; no broad legacy refactor. No new DB migration, seed/reset, production read or credentials.
4. Run targeted unit tests, relevant `v351` regression tests, TypeScript, and repository-selected verification gates. Record local vs CI exactly; any unrun tests marked `NOT RUN`.
5. Update ROADMAP, FEATURES and CHANGELOG with actual evidence, acceptance and outstanding risks.
6. Obtain independent full-doc critique (R1/R2 supplied in full), reconciled decisions and explicit product owner signoff before advancing to runtime/shadow integration.

## 6. Current gate

- Data-only R1 feasibility complete for structural/timing properties, not event-contact labels.
- Full R1/R2/R2.1 document-only DeepSeek review **RECEIVED**, conditional with the nine contract blockers enumerated in the [second-review reconciliation](GPS_DETECTION_2_0_R2_1_SECOND_REVIEW_RECONCILIATION_2026-10-17.md); reviewer ran **NO source/tests/SQL**, so source verification is ours and empirical evaluation remains NOT RUN.
- R2.1 code/testing permission **NOT YET REQUESTED/GRANTED**.
- Production model benchmark, Node tests, build, browser, Postgres integration **NOT RUN** for this research work.
- **Next product decision:** review this revised R2.1a **offline falsification/regression** scope and explicitly approve/revise *research-only* code in a separate branch. Conditional DeepSeek review is not owner approval and does not authorize production, model training or algorithm rollout.

