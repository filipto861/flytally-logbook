# GPS Detection 2.0 — R2 architecture candidate and falsification plan

**Date:** 2026-10-17  
**Status:** PROPOSED FOR INDEPENDENT REVIEW — NOT FROZEN / NOT IMPLEMENTED  
**Related:** [Issue #348](https://github.com/filipto861/flytally-logbook/issues/348), [Draft PR #349](https://github.com/filipto861/flytally-logbook/pull/349), [R1 feasibility](GPS_DETECTION_2_0_R1_FEASIBILITY_BENCHMARK_2026-10-17.md)  
**Source:** read-only inspection of `main@6a67a02475ab09c3271f8646427f7956ed6e590a`, existing regression fixtures, OGC KML 2.3 standard, Journal of Open Aviation Science HMM paper.  
**Frozen boundaries:** no production detector/UI change, no new DB schema/writes, no use of other owners' tracks for model training without authorization, no raw GPS to external reviewers, no changes to training repo. Second-AI independent review NOT RUN.

## 1. Design decision: two separate inference questions

**Question A: What does the observed movement support?** Possible stationary/ground roll, acceleration, climb, airborne, descending, approach, continuation/go-around, possible ground turnaround. This can be assessed from position/time/relative-altitude trends, but only if their source quality and time support it.

**Question B: Did the aircraft actually contact the runway?** With only sampled KML lat/lon/alt/time and no independently verified physical contact signal, this can be **not identifiable**, even with sophisticated AI. Two flights can produce the *same sampled observations* when one makes a very brief rolling touchdown and the other conducts a low pass. A model can offer `CONTACT_CANDIDATE` but must not turn it into `CONTACT_CONFIRMED` without pilot/independent evidence. `UNKNOWN` is not proof of `NO_CONTACT`.

The system must **not** determine takeoff/landing counts in a finalized logbook by silently adding a simulated event. Advisory count estimates are not authoritative record facts; flight-local pilot review and existing certification controls remain independent.

## 2. Concrete source audit: risks newly identified

| Source location | Observed behavior | R2 design implication |
|---|---|---|
| `lib/track-processing.ts::seconds` | Returns **0** for missing, invalid, zero or negative elapsed time | Do not conflate physical zero velocity with invalid derivative; represent invalid time separately |
| `lib/track-processing.ts::speeds` | Converts invalid elapsed-time edges to **0 km/h**, then 5-point median smooths | Quality mask must precede smoothing; a false zero can create fake ground-stop evidence |
| `lib/track-processing.ts::normalize` | De-duplicates adjacent exact-ish positions/timestamps and sorts by parsed timestamps when enough exist | Preserve raw sequence order, source timestamps, reorder/dedup flags and detection provenance in a separate research representation; no mutation to legacy parser in this milestone |
| `lib/track-processing.ts::trackStats` | Filters altitude **0 m** out of min/max | Missing != zero; do not copy this behavior into the proposed research model. Record as an unrelated legacy fix candidate, separately scoped |
| `lib/data/tracks.ts::decodePoints` | `Number(item?.alt)` maps `null` to `0` in the **map DTO** | The map track DTO can make unknown altitude appear as zero; do not feed this DTO into detector quality evaluation. Investigate separately before any map-data refactor |
| `lib/track-processing.ts::touchAndGoEvents` | Merges speed and altitude candidates; `confidence` values `high/medium` are heuristic categories | Avoid uncalibrated probability claims, always retain supporting edge/time spans and contradictory quality evidence |
| `lib/track-processing.ts::landingCount` | Minimum `1` final landing even for incomplete track coverage | R2 event-count estimate must support `UNAVAILABLE`; do not assume final landing on cropped or missing-end GPS |
| `components/kml-import-form.tsx::reviewFor` | Pre-fills starts/takeoffs from `landingCount(part)` | Stored count labels may inherit old detector biases. Cannot automatically use them as independent supervised truth |
| `lib/data/flight-track-review.ts` | Re-derives suggestions from first stored track | Recomputed result is a legacy prediction, not independent pilot-contact annotation |
| `lib/civil-twilight.ts` | Uses event times for day/night suggestion downstream | R2 proposals must never automatically alter movement evidence, regulation/recency results or existing certified flights |

**Altitude mode hazard:** OGC KML 2.3 `altitudeMode` can be `clampToGround` (**default**), `relativeToGround`, or `absolute`; behavior differs fundamentally. Current `KmlPoint` does not retain mode, vertical datum, sensor origin or per-point accuracy. Even if a stored altitude is numeric and airport MSL elevation is populated, its compatibility with a reference datum is **UNVERIFIED**. For historical already persisted points with no metadata, mark vertical reference `UNKNOWN` rather than infer from file extension or geographic proximity. [OGC standard](https://docs.ogc.org/is/12-007r2/12-007r2.html), [Google KML altitude modes](https://developers.google.com/kml/documentation/altitudemode).

**Generalization hazard:** The published multivariate HMM paper reports ~97% *median global flight-phase* accuracy from FDR-scale datasets, **not** GPS touchdown accuracy. Transferring that figure to FlyTally KML is invalid. [Perrichon, Gendre & Klein (2024)](https://journals.open.tudelft.nl/joas/article/view/7269).

## 3. Proposed internal research contract (not yet public TypeScript API)

```text
SourceTrack
  - sourceTrackIdentity: opaque, private; owner access explicitly checked
  - sourceFormat + sourceProvenanceStatus: KNOWN | UNKNOWN
  - sourceOrder + timestampsRaw + timestampsNormalized (only if unambiguous)
  - position samples with missing flags; altitude samples with unit/datum/mode provenance
  - raw sequence preserved for diagnostics; never coerce NULL to zero

EdgeQuality
  - VALID | UNAVAILABLE(reason: missing time, nonpositive dt, gap, invalid coordinate,
                         position teleport, altitude discontinuity, unknown datum)
  - spatial/temporal span support, number of independent valid fixes
  - no speed/vertical-rate derived from invalid edges; no interpolation over unsupported gaps

PhaseSegment
  - phaseCandidate: POSSIBLE_SURFACE | ACCELERATION | AIRBORNE | DESCENT |
                    APPROACH | CLIMB | UNCERTAIN
  - intervalUtc: [start,end] | UNAVAILABLE
  - supporting observations and contradictory observations
  - model identity/version, applied quality masks, source provenance
  - phase != runway contact

ContactHypothesis
  - CONTACT_CANDIDATE | NO_CONTACT_EVIDENCE | CONTACT_UNRESOLVED
  - supporting runway-context optional and explicitly source-backed
  - NEVER CONTACT_CONFIRMED from track alone
  - no negative assertion if coverage gaps can conceal contact

EventSuggestion
  - TAKEOFF_CANDIDATE | FINAL_LANDING_CANDIDATE | T_G_CANDIDATE |
    STOP_GO_CANDIDATE | GO_AROUND_CANDIDATE | LOW_APPROACH_CANDIDATE |
    UNKNOWN_EVENT
  - window: [lowerTime,upperTime] | UNAVAILABLE; not invented point timestamp
  - reason codes and evidence spans; explicit conflicting hypotheses
  - confidenceCategory: HEURISTIC | UNCALIBRATED | CALIBRATED (only with evidence)
  - reviewStatus: UNREVIEWED | PILOT_ACCEPTED | PILOT_REJECTED
  - review must never silently rewrite past certified/canonical flight facts

AdvisoryCount
  - AVAILABLE(value, scope, reason/evidence, version) | UNAVAILABLE(reason)
  - never `1` by default for a track without supported final-landing coverage
  - applies only to draft review after owner interaction, no global auto-apply
```

The enum names and thresholds are **design candidates, not frozen persisted/API contracts**. A future type/schema/design review must verify backward compatibility and exact UX before implementation. Source data, computed phases and confirmed logbook facts are separate.

## 4. Computational stages and design alternatives

**Stage 0 — private authorized source access.** All research uses approved records or synthetic fixtures. The production aggregate inventory is sufficient to characterize shape/cadence, but does not authorize downloading/training on others' private routes. A future offline harness should run on synthetic/anonymized fixtures by default and keep any authorized raw data out of repo and third-party model calls.

**Stage 1 — time/source quality first.** Validate strictly monotonic timestamp intervals, original ordering, coordinates, sampling gaps and altitude sample consistency. Do **not** treat `Δt <= 0` as 0 km/h. Do not smooth a gap into a fake observation; split valid signal islands at unresolved edges. Source altitude in metres is usable for *relative* comparisons only where source and time continuity support them; absolute AGL is unavailable if datum mismatch is unresolved.

**Stage 2A — deterministic temporal state baseline.** Candidates based on physically coherent speed/vertical trend and minimum sustained time, with hysteresis and completeness constraints; use elapsed-time windows rather than fixed N-point slices. Hard cutoff/duration parameters are **TBD by evidence and test design**, not invented here. Conservative `CONTACT_UNRESOLVED` in ambiguous cases.

**Stage 2B — changepoints / robust temporal signal segments.** Compare robust changepoint or segmented regression proposals for altitude slope/groundspeed trend; explicit missingness and outlier masks; still no contact certainty.

**Stage 2C — HMM/HSMM as comparator.** Only if a defensible set of phase semantics and time-sampled feature emissions can be established. Track irregular `Δt` explicitly or work in validated temporal bins with unknown gaps; never trivially interpolate past gaps. Phase decoding can hypothesize landing/approach; no touch contact label without independent truth. HSMM duration handling is research, not guaranteed superiority.

**Stage 3 — candidate adjudication.** Combine multiple hypotheses and contradictory evidence, suppress impossible sequences, provide `CONTACT_UNRESOLVED` rather than a false strong assertion. Run in read-only shadow mode comparing to legacy on synthetic/approved fixtures. Never change canonical flight data or `civil-twilight` evidence as a side-effect.

## 5. Falsification experiment matrix (source-owned synthetic fixtures)

| Scenario / prior fixture | What R2 must demonstrate |
|---|---|
| v351 level-shift false altitude T&G | No contact claim; discontinuity included in evidence mask |
| v351 climb-out sawtooth altitude | No fabricated descent-touch-climb sequence |
| v351 duplicate/stale fix speed T&G | Invalid edge/zero speed not treated as a ground-stop event |
| v351 positive five-T&G circuit | T&G candidate evidence retained **or** explicit unresolved; abstention counted (not hidden as successful detection) |
| v351 flat-altitude true stop-and-go | Distinguish speed-pattern *candidate* from **proven contact**; preserve uncertainty |
| v351 known missed +11-point rolling T&G | Propose temporal candidate or explicitly report unresolved/missed (never silently relabel as negative) |
| Same physical timestamps/positions with sampling density ×0.5 / ×2 | No new confirmed events under benign resampling; degraded data may increase abstention |
| Single edge time=duplicate, backwards or missing | Velocity and vertical rate UNAVAILABLE; no false stopped-flight inference |
| 60s / 120s gap around runway vicinity | Continuity unknown; no interpolated touchdown |
| KML `relativeToGround` vs `absolute`, identical numbers | Without mode evidence, no made-up AGL/radial threshold inference |
| Complete descent + climb at runway but known low-pass | Possible event, `CONTACT_UNRESOLVED`; never counted as proven T&G |
| Same sampled trace, two truths (brief contact vs no contact) | Formal non-identifiability; both must remain unresolved absent further evidence |
| Ground-only taxi segment or airport turnaround | No airborne assertion from one corrupted fix; preserve ground/uncertain |
| Incomplete tail missing final landing | Advisory `UNAVAILABLE`, never legacy minimum-one reused as event proof |
| Track crossing UTC offset / midnight, nonmonotonic source order | Same physical time reasoning where explicit offset valid, else refuse |

Known fixtures are **existing regression evidence**, not new private flight dumps. Synthetic fixtures should avoid matching real personal coordinates/routes. No empirical results are claimed for the R2 candidate today.

## 6. Measurement and promotion contract

Separate (a) phase and quality-diagnostic performance, (b) weak flight-level count consistency and (c) *verified* event-level performance; never combine them into one magic accuracy number.

- **Existing regression suite:** count known false positives (zero allowed), known positives, known misses, abstentions/coverage and data quality transitions separately.
- **Authorized weak labels:** `flight-level exact count agreement` is a *proxy*; `landings_day/night` may be copied from old auto-prefill. Do not use it as independent proof of contact class or timing. Report track completeness and review provenance.
- **Independent contact labels absent:** event precision/recall, classification F1, calibrated confidence, event-time error, probabilistic touchdown certainty are **UNAVAILABLE**. Do not report 97%/99% without applicable held-out truth.
- **Validation design:** split by complete flight, source, user and near-duplicate recording group as permission/data allow; reserve untouched holdout before threshold choice. Symmetric train/test metrics alone cannot ensure avoiding fake logbook entries; track false asserted touchdowns, false contact vs abstention and impact on certified-history evidence.
- **Promotion:** no production rollout on synthetic PASS alone. Require independent reviewer acceptance, permission/legal gate, sufficient applicable ground-truth evidence or an expressly *uncertainty-first* advisory-only UX, and owner approval. Feature flag defaults OFF, legacy unchanged when OFF. No automatic application to certified records or day/night recency.

## 7. R2 milestones, decisions and explicit No-Go

1. **R2-DESIGN (this doc):** audited differences + proposed contract/algorithms/falsification; docs-only. Verification: source analysis, no test execution. **Status: DRAFT / IN REVIEW**.
2. **R2-REVIEW:** independent DeepSeek/Claude read-only critique using anonymized packet; record disagreements and reconcile against actual repo. **Status: NOT RUN**.
3. **R2-EXPERIMENT approval:** owner explicitly chooses a minimal offline pure TypeScript harness on synthetic/known anonymized fixtures, without DB, no UI and no persisted changes; predeclare scoring, freeze datasets, run old baseline vs candidate. **Status: NOT APPROVED**.
4. **R2-MEASURE:** baseline and experiments must show evidence, missingness behavior, known misses and regressions; ineligible metrics marked N/A. **Status: NOT RUN**.
5. **R3 integration design** only after demonstrated improvement and proof/no-go assessment. No cross-repo edits, no production changes in R2.

**Open product decision for owner (after external review):** Is user-reviewed `CONTACT_UNRESOLVED` preferable to a speculative positive T&G suggestion in the new review UX? This design recommends yes for integrity but does not change current behavior without approval.
