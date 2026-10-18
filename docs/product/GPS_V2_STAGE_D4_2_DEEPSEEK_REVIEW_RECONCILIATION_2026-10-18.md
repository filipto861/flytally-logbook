# GPS V2 — D4.2A independent review reconciliation and proposed implementation contract

**Date:** 2026-10-18. **Status:** REVIEW RECEIVED AND RECONCILED; IMPLEMENTATION NOT APPROVED / NOT STARTED.
**Scope:** `flytally-logbook` PR #366 Draft, research-only. Parent PR #364 Draft; main/production not modified.
**Independent reviewer:** DeepSeek. Reviewer had no repository, private KML, production runtime or independent touchdown evidence. Recommendations were independently checked against current repo code by ChatGPT.

## Baseline confirmed directly from repository (read-only)

- `lib/gps-v2-advisory.ts` at blob `a4c422b819c0e37e2fc5eb5cd05f5fdd15d5e23c` exports `GPS_V2_ALGORITHM_REVISION = GPS_V2_HORIZONTAL_V3`. Event kinds are `DEPARTURE_REVIEW_POINT`, `ARRIVAL_REVIEW_POINT`, `STOP_GO_REVIEW_POINT`; always `physicalContact = UNRESOLVED`, `wholeFlightLandings = UNAVAILABLE`, `canAffectCanonicalFlight = false`.
- Existing `edge()` rejects nonpositive or >=60-second intervals and speeds >900 km/h; therefore a 35s gap **can** yield a finite averaged horizontal speed while a 94s gap is blocked. Neither proves uninterrupted tracking. The existing V2 `islands()` are groups of measured-valid edges under those rules, **not** source block partitions or ground-contact evidence.
- Production V2 `inspectGpsV2HorizontalTrack` validates exact source→canonical points and manual `splitCuts`, then quarantines altitude conflicts and same-ms UTC collision-neighbor edges before candidate evaluation. Source block boundaries are **not** an input. Production source reader still rejects multi-`gx:Track` (`UNAVAILABLE / UNSUPPORTED_SOURCE`).
- Research D4.1 sidecar revision `GPS_D4_MULTI_GX_SIDECAR_V1` is separate. Six owner-local KML validations completed on `815c2693` with 13 source blocks / 4148 raw fixes / 4129 canonical / 19 collapsed / 0 dedup altitude conflicts / 7 blocked source edges / 13 provenance runs. D4.1 code targeted tests 63/63 and typecheck PASS on `3fc3cd11`, not CI or production release approval.

## Second-AI adjudication (no unapproved implementation)

| Topic | Disposition | Verified constraint |
| --- | --- | --- |
| Option A: separate research-only shadow detector | **ACCEPT AS PROPOSED D4.2A SCOPE** | Pure `research/` + synthetic tests + local redacted CLI; no `lib/` refactor or runtime integration. Owner approval before coding still required. |
| Option B: refactor/extend production V2 | **REJECT FOR D4.2A** | Higher blast radius and unresolved D3 HIDDEN flag policy. Requires separate owner decision, design review and full regression proof later. |
| Option C: production multi-block unsupported | **PRESERVE** | Existing `UNAVAILABLE / UNSUPPORTED_SOURCE` stays correct; a research sidecar success does not enable production V2. |
| Pinned revision + one-block differential test | **ACCEPT** | Pin `GPS_V2_HORIZONTAL_V3` and source code/blob baseline, compare event set exactly; mismatch stops D4.2A validation, not silently reinterpreted. |
| 35s gap should be inconclusive if it supplies critical missing continuity | **ACCEPT WITH PRECISION** | No universal threshold invented. Base V2 mathematical candidate and research disposition are distinct; require transparent, source-supported cadence/context classification and explicit dependent-edge explanation. |
| 94s gap / 4.9s source boundary | **ACCEPT** | Existing invalid long edge and hard source-block boundary both split evidence; even 4.9s does NOT authenticate continuity. |
| Exact source+split+revision binding | **ACCEPT** | Identity via local SHA-256 of exact source bytes and revision/split contract; equality/staleness only, not sensor authentication. Never emit hash if it can enable sensitive correlation without a demonstrated need. |
| Pilot owner labels vs independent corroboration | **QUALIFY** | Pilot firsthand reports remain valid labeled `PILOT_REPORTED` evidence with approximate timing; independently corroborated contact/no-contact is a higher tier. Do not treat owner labels as device-certified wheel contact or pool tiers for population precision/recall. |
| Preserve current T&G vertical thresholds | **ACCEPT** | Current legacy >25m/s height-rate guard and historical speed/altitude predicates remain unchanged; no rolling-T&G/vertical rework in D4.2A. |

## Proposed D4.2A input/output contract (design, NOT code)

**Input:** bounded exact original local gx:Track KML source text; declared format; explicit optional strictly validated manual split cuts; pinned `GPS_D4_MULTI_GX_SIDECAR_V1` + `GPS_V2_HORIZONTAL_V3` revisions; optional upload/split revision if caller handles local freshness. Internal source verification must invoke D4.1 using this exact source and verify canonical equality against existing `parseKml`. Never trust caller-supplied mapping, source classification or `status:'VALIDATED'`.

**Derived immutable evidence:** `canonicalIndex` to original (block,fix) and collapsed-duplicate references; blocked canonical edges with causal reasons; separate invalid velocity edges (UTC nonincreasing/same-ms collision, implausible speed, >=60s current-rule gap); explicit manual split boundaries. Reconstruct research shadow candidate contexts only within these constraints. **D4.1 provenance runs are NOT timed motion islands.**

**Two-layer output, strictly diagnostic:**

1. **Base candidate set**: the V2 horizontal hypotheses under the pinned existing candidate logic, preserved for differential comparison on clean one-block inputs. Event identities must match exactly: `kind`, `normalizedIndex`, `splitIndex`, `utc` internally; reasons/status must match the reference module on the one-block equivalence gate. Absolute UTC is INTERNAL only and never printed to CLI/Git.
2. **Research disposition and evidence window**: a separate `RESEARCH_HYPOTHESIS` / `INCONCLUSIVE` / `SOURCE_UNAVAILABLE` classification with fixed audit reason vocabulary such as `SOURCE_BLOCK_BOUNDARY`, `SOURCE_QUALITY_CONFLICT`, `UTC_COLLISION`, `UNOBSERVED_CONTINUITY`. Reason must be justified by the edges actually needed for that candidate and any missing coverage; never infer a missing event or call a suppressed candidate a negative. `physicalContact=UNRESOLVED`, `actualLandings=UNAVAILABLE`, `canAffectCanonicalFlight=false` always.

**Coverage policy:** First measure source cadence and candidate edge-dependency distributions. A 35s edge within otherwise much denser source sampling is an evidentiary *gap candidate*, not proof that T&G happened or did not happen. A disposition `INCONCLUSIVE / UNOBSERVED_CONTINUITY` must be backed by a declared and testable comparison method (source-local empirical cadence, explicit gaps, edge dependency) and must not silently turn all ordinary sparsely sampled observations into rejected landings. If there is insufficient cadence evidence to classify a gap, return `COVERAGE_UNDETERMINED`/inconclusive, not a fabricated clean/continuous measurement. Do **not** introduce a global >15s / >35s / other magic threshold; never change production `edge()` or its <60s limit as part of D4.2A.

**No implicit event from absence:** a no-candidate interval, any unsupported source and a manually confirmed no-touchdown event are three distinct things. No events across a blocked source edge; if an alleged maneuver is only inside an unobservable gap, report interval-level uncertainty without inventing candidate indices.

**Fingerprint/staleness:** Bind comparisons locally to exact source-text SHA-256, parser/algorithm revisions and validated split cuts; changing any invalidates previous run. This fingerprint proves **input equality only**, no authenticated sensor fidelity; no durable user notes or persistence in this milestone.

**Privacy:** CLI may output anonymous sample ID, numeric relative seconds, proposed kind, research disposition/reason, aggregate edge quality. Never emit geographic coordinates, source filename/path, registration, literal UTC, sensor altitude, identifiable flight ID or full route. No files written, external requests, DB reads or flight mutation. Only anonymized, synthetic unit fixtures may be committed.

## Proposed bounded milestones (each requires fresh acceptance)

- **D4.2A-0 contract freeze (NOW):** incorporate independent reviewer corrections, explicit one-block reference equivalence and gap-uncertainty model into documents; product-owner approval gate. No code.
- **D4.2A-1 research consumer:** separate file under `research/gps-detection-r21/`, with existing D4.1 sidecar input, no `lib/` changes. First implement exact one-block parity and explainable hard-edge break behavior; no floating inference from labels.
- **D4.2A-2 differential + adversarial tests:** 15+ D42 cases, deterministic seeded synthetic one-block fuzz; compare reference `inspectGpsV2HorizontalTrack` event set and reasons to shadow. All unapproved divergences **FAIL** the test. Event sets must not be compared solely by count.
- **D4.2A-3 cadence sensitivity and private six-KML CLI:** capture anonymous source interval histograms / candidate dependency on suspicious unobserved spans without changing thresholds, then read-only compare potential source-aware event profiles. Empty hypotheses cannot be relabeled as zero landings.
- **D4.2A-4 independent results review:** inspect false positives, missed rolling owner-reported T&G, gaps, source-boundary cases, privacy, and robustness. **No Option B, production ON, merge or deploy without separate owner decision.**

## Acceptance matrix — mandatory

| ID | Required outcome |
| --- | --- |
| D42-01 | Clean one-block output exact event `kind/index/split/utc` and reference reason/status equivalence; source remains non-contact |
| D42-02 | Two blocks, 4.9s join with fast/slow/fast context: no candidate spans join; control within one block retains baseline |
| D42-03 | Three blocks with malformed/single-fix middle: strict fail closed or nonbridging inconclusive |
| D42-04 | Cross-block same-time near-location collapsed duplicate: both-neighbor boundary quarantine propagated |
| D42-05 | Altitude-conflicting duplicate: canonical retained value unchanged, event evidence quarantined |
| D42-06 | Same-ms UTC distinct coordinate: affected velocity edges and near context quarantined |
| D42-07 | 35s within one block: base calculation unchanged; any candidate dependent on unobserved continuity INCONCLUSIVE, no auto-count |
| D42-08 | >=60s, e.g. 94s: invalid reference edge; no candidate bridges |
| D42-09 | Low-pass/go-around/taxi synthetic: only hypotheses, never contact/landing authority |
| D42-10 | sample07 in-span source-alt anomaly: no legacy threshold change or automatic missed-event addition |
| D42-11 | Manual split and block cut meet; edited source/revision: both boundaries enforced, stale binding unavailable |
| D42-12 | Anonymous six-private-KML research output (owner-local) with no route, UTC, filename or GPS height |
| D42-13 | Production module revision and source behavior remain untouched; multi-block V2 still UNSUPPORTED_SOURCE, flag OFF/HIDDEN |
| D42-14 | Deterministic clean one-block seeded differential fuzz, exact event-set equivalence; unexplained drift fails |
| D42-15 | Empirical source cadence sensitivity and isolated unobserved intervals reported without inventing a fixed global gap threshold |
| D42-16 | Clean uniformly sparse source/control: do not falsely assert source continuity nor fabricate a deterministic cutoff or physical contact |
| D42-17 | Unsupported, zero hypotheses, owner-reported zero T&G, independently corroborated negative: four distinguishable states and label tiers |
| D42-18 | Unsafe/unpaired or oversized KML: UNAVAILABLE, no raw-source echo or implicit fallback |
| D42-19 | Same input/different split/upload/algorithm revision: no stale candidate reuse, no write/persistence |

## Release/verification ledger

- DeepSeek D4.2 review received and assessed against actual repository source; **reviewer had no repo/raw source/production execution**.
- D4.1 passed owner-local research verification on earlier stated SHAs. No additional tests run for this document-only review.
- D4.2A design contract is **PROPOSED, NOT APPROVED FOR CODING**. The 19 D42 entries above are planned, not implemented or tested.
- CI/full suite/typecheck on post-review docs HEAD, browser/DB/migration/production smoke: NOT RUN or N/A; no deployment, no merge, no feature enabling.
