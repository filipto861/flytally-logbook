# GPS V2 R3-P1C — evidence-first missing rolling T&G: design only

Date: 2026-10-20
Status: DRAFT DESIGN / NO DETECTOR IMPLEMENTATION / INDEPENDENT REVIEW PENDING / OWNER DECISION PENDING.
Repository: flytally-logbook only.
Branch: design/gps-r3-p1c-evidence-advisory-20261020; stacked after GPS P1B Draft PR #372.

## 0. Problem and source truth

Owner-local P1B screenshots show six existing legacy touch-and-go markers on a private multi-gx GPS upload; pilot reports one additional real touch-and-go. That claim is REPORTED_CONTACT_UNCORROBORATED. It is not independent physical ground-contact evidence or a verified label for training/tuning.

Source-quality research on the same original private source established TWO overlapping frozen-legacy rejected altitude geometry windows tied to ONE common implausible observed altitude derivative edge, with an unobserved source-data interval. This is ONE quality issue, NOT two landings. Missing observations are not implied wheel contact.

P1B already shows one accurate source-height quality notice and explicit unknown-motion-gap caveat; it NEVER creates a T&G, changes totals or asserts contact. Native GPS V2 still returns UNAVAILABLE / UNSUPPORTED_SOURCE for multi-gx KML. The separate browser-safe P1A source-quality diagnostic does NOT grant native V2 source eligibility.

No owner-private registration, timestamp, location, raw height, filename or coordinate is incorporated into this doc or review.

## 1. Exact architecture inventory

- lib/track-processing.ts: existing touchAndGoEvents combines low-speed ground intervals and rolling altitude geometry. Rolling check requires speed 28–145 km/h, >=30m descent and climb, a timed intermediate climb fix, and rejects >25m/s source height jumps in the descent/minimum/climb evidence span where observation duration <=15 s. landingCount is max(1,1+detected events). Frozen; no retune approval.
- components/kml-import-form.tsx: original source, canonical points and split cuts; legacy importReviewEvents and pilot-editable review totals, Day/Night and PF fields; separate opt-in R3 P1B warning. No new form count authority.
- components/gps-import-review-player.tsx and mapTrack: displayed visual track may differ in sampling/index from full canonical source; no source-index seeking or marker before mapping parity is proven.
- lib/gps-v2-import-lineage.ts: strict multi-gx native UNSUPPORTED_SOURCE for V2 horizontal review until separately approved adapter/eligibility.
- lib/gps-v2-advisory.ts: departure/arrival/stop-go horizontal REVIEW POINT observations, not contact assertions, not logbook counters.
- research/gps-detection-r21/stage-r3-p1a-source-quality-contexts.ts: pinned D4 lineage and source/canonical/split parity; one quality context per common rejected bad edge; physicalContact=UNRESOLVED, actualLandings=UNAVAILABLE, canAffectCanonicalFlight=false.
- research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts: frozen aggregate evidence and reject taxonomy, not a production detector.

UNKNOWN: exact GPS sensor altitude mode/effectivity, independently verified runway ground contact, exact rejected-window-to-contact association, continuous motion between missing samples, bounded runway geometry reference, reliability of horizontal velocity across gaps.

## 2. Decision options

A. Keep P1B warning plus manual landing-total review. SAFE DEFAULT now; does not improve automatic recognition.
B. Separately gated review-only motion candidates backed by validated source-observed horizontal/temporal patterns and explicit unavailable states. RECOMMENDED FOR DESIGN REVIEW ONLY, NOT IMPLEMENTATION APPROVAL. Candidate is possible movement for human inspection, never confirmed contact, never an automatic count, and must prove incremental value over existing native V2 horizontal STOP_GO_REVIEW_POINT.
C. Change frozen altitude jump filter or trust pilot report to auto-create extra T&G. REJECTED: false-positive risk and missing contact evidence; one anomaly is not one or two source-backed landings.

## 3. Staged implementation gate

C0 DESIGN / READ-ONLY (current branch): reconstruct source/lineage, exact reason for false-negative geometry, all important applicability/failure states and UI boundaries. Record P1B remaining browser acceptance prerequisites. Prepare independent read-only reviewer packet and separate owner decision. NO new algorithm.

C1 SOURCE QUALIFICATION (not approved): Native multi-gx eligibility, if pursued, must be a separate reviewed provenance adapter with strict original-source->canonical equality, ordered gx blocks, collision/duplicate semantics, split bounds, timestamp order, observed interval continuity, sensor variant and explicit unsupported dialects, maximum input length/points. Do not use the lower-authority P1A inspector to bypass native V2 UNSUPPORTED_SOURCE. Block joins may NOT silently stitch missing observations. Fail closed for malformed/ambiguous source.

C2 CANDIDATE RESEARCH (not approved): Synthetic-first non-authoritative horizontal/temporal evidence engine, distinct from old legacy detector. If defensible, proposed typed union status ADVISORY_ONLY / NO_QUALIFYING_PATTERNS / UNAVAILABLE with precise typed failure reasons; observationBasis=HORIZONTAL_TEMPORAL_OBSERVATIONS_ONLY; physicalContact=UNRESOLVED; actualLandings=UNAVAILABLE; canAffectCanonicalFlight=false. Subtypes should mean POSSIBLE_MOVEMENT/INCONCLUSIVE, not touchdown/T&G; candidate output must carry in-memory source/split provenance, never persisted private GPS identifiers. Missing runway/reference information must not be invented or treated as zero. No automatic landing/Day-Night/PF/recency values. If no genuinely independent observable pattern is defensible, choose UNAVAILABLE rather than a guessed review point. Distinguish already existing V2 horizontal STOP_GO_REVIEW_POINT rather than creating duplicate UX.

C3 VERIFIED CONTACT / AUTOMATIC COUNTS (NOT AUTHORIZED): Requires separate evidentiary authority, genuine independently adjudicated contact truth, precision/false-positive controls across flight classes and source qualities, regulatory applicability, downstream flight/certification/audit review and explicit owner release decision. Not part of C0–C2.

## 4. Immutable safety rules

- NEVER reduce or bypass the existing 25 m/s observed-altitude-edge guard, speed/30m/time continuity geometry or the >15s unobserved movement caveat.
- ONE overlapping bad-edge group is one source quality issue and zero independently proven contacts. Pilot report stays REPORTED_CONTACT_UNCORROBORATED.
- Input source dialect, gx block, source point ordering, exact split cuts, altitude origin, duplicate conflicting fixes and timestamps are first-class applicability, never inferred defaults.
- Missing altitude is not zero; unknown runway shape/elevation is not a generic "typical" runway.
- Preserve touchAndGoEvents, landingCount, all flight review defaults, starts, Day/Night, take-offs, PF movement, recency, certification, shared/certified flight and DB state. No algorithm-to-form mutation in C0–C2.
- Explicit UNAVAILABLE when source/time/channel/split/provenance insufficient; NO_QUALIFYING_PATTERNS never means zero actual landings.
- No speculative amber T&G/landing markers, seek or contact time without verified full-canonical-to-player index mapping and UI authority.
- Flag default OFF, no production deployment, no new source data or exact user track committed, no changes to training repo.

## 5. Test/research matrix (hypotheses, not completed results)

C1 synthetic: single vs two-block gx, join anomalies, duplicate timestamp with conflicting positions, same-ms distinct fix, ordered/unordered inputs, dropped source points, conflicting duplicate alt, missing height vs observed zero, 16s/35s/94s/491s source gaps, split straddling source bad edge, file swap/stale analysis, canonical mismatch, unknown format and strict size bounds. All unknown/ambiguous fail closed. Six original private KML anonymous reports only on owner's machine; none may be uploaded to GitHub.

C2 adversarial: taxi/ground turn, go-around with zero physical contact, low approach/overflight, repeated approach geometry, runway-proximity coincidence, single sensor altitude step, implausible rapid vertical jump, sparse speed, time collision, block gap, manual split, near 28 and 145 km/h boundaries, noisy GPS ground speed, wrong airport/unknown runway. Negative cases MUST NOT yield confirmed contact or count changes. Compare candidate observations to existing native V2 to avoid duplication.

Before any UI C2 prototype: source->downsampled display index proof, visually distinct quality/review state, accessibility keyboard/mobile/iPad/night, flag OFF/ON and refiling/split invalidation. Browser test with disposable PG only. Additional DB/migration/integrity checks only if touched. Do not claim PASS from static source review or earlier candidate HEAD.

## 6. Independent second-AI (DeepSeek/Claude) read-only review request

Reviewer instructions: NO CODE, NO SOURCE MODIFICATIONS, NO ASSUMPTION THAT USER REPORTED CONTACT IS PROVEN. Examine code and frozen R2-2/P1A/P1B state. Return:
1. unsupported assumptions/failure modes in horizontal temporal movement research;
2. whether C1 native multi-gx source qualification must be a prerequisite of C2, or can remain research-only without relaxing native V2;
3. provenance and missing-data handling for source block boundaries/speed/gaps/duplicate GPS;
4. whether C2 offers any measurable distinct value over existing V2 STOP_GO_REVIEW_POINT, and if no, recommend NO GO;
5. full source-to-visual-index mapping safety and "do not create fake T&G" UI;
6. ten highest-value synthetic adversarial false-positive cases and falsification tests;
7. disposition GO / DESIGN REVISION / NO GO for C0/C1/C2 separately.

Never recommend treating bad altitude as a landing, broad altitude filter relaxation, silent count changes, manual flight record overwrite, native V2 eligibility bypass or user KML disclosure. Reviewer is not product authority; independent findings must be reconciled against actual code and owner decisions.

## 7. Closing boundary / acceptance

This is only the C0 design hypothesis and review packet on a draft design-only branch. No detector, marker, native source adapter, UI, data, DB, release or production change is implemented. P1B remains Draft/OFF pending local ON/OFF smoke and original source checks. Tests/build/Playwright/DB/deploy for C0 documentation are NOT RUN / N/A; C1/C2/C3 are NOT STARTED. Await external review + explicit owner freeze before implementing C1 or C2.
