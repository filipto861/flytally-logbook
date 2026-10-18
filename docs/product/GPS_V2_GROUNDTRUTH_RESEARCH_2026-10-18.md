# GPS Detection 2.0 — Ground-truth and saved-track research M0
**Date:** 2026-10-18  
**Repository:** `filipto861/flytally-logbook` only  
**Branch:** `docs/gps-v2-groundtruth-research-20261018` (documentation-only, from current `main`)  
**Implementation:** NOT STARTED. **Tests / build / browser / DB / deploy:** NOT RUN / N/A for this documentation-only analysis.  
**Related:** Draft PR #364, candidate `f151176730991085ef28a35b0a7a2931d691c61b` (not merged); frozen R2.1c-D3 offline privacy/source policy; historical 3.5.1 reliability design. **This research document does not approve PR #364 for merge or pilot release.**

## 1. Problem and verified evidence

We now have the first **pilot-labeled actual physical events**, rather than merely detector outputs. Counts and minute-level event alignments are private-owner testimony; their confidence does not certify aircraft operation or UTC timestamps to a second.

| Private test alias | Pilot-labeled actual events | Legacy suggestion comparison | Experimental V2 (PR #364) |
| --- | --- | --- | --- |
| A | 2 T&G, 1 full stop; 1 low pass with NO contact | two altitude T&G suggestions each approximately align with confirmed T&G; no T&G at the low pass | 0 STOP_GO; 2 earlier ARRIVAL hints that are *not* verified contacts |
| B | 1 T&G, 1 full stop | two altitude T&G suggestions: one matches actual T&G at approximately minute accuracy, the other is a **false suggestion** ~30 minutes earlier | 0 STOP_GO |
| C/D/E | physical-event ground truth **NOT PROVIDED** | no T&G hypotheses observed | accepted original-source formats, 0 STOP_GO |
| F | physical-event ground truth **NOT PROVIDED** | one unverified legacy T&G hypothesis | V2 **UNSUPPORTED_SOURCE** on a KML variant, so NOT scored |

The six privately compared original KMLs yielded V2 source acceptance on five and explicit unavailability on one; approximately 3,115 normalized fixes among the five accepted tracks. No route geometry, original timestamp, exact filename, registration, source samples, other users' flight IDs or original KML will be committed as fixtures.

Owner-local code evidence for Draft #364 exact candidate:
- focused targeted Node 66/66 PASS, TypeScript PASS; iterative source 257/257 and GPS domain 54/54 PASS;
- first original-file test: V2 `ADVISORY_ONLY`, parser `GPS_V2_IMPORT_LINEAGE_V3`, 1,088 canonical normalized fixes;
- **full new-HEAD ON and OFF release-risk gates not run**; no ground-truth accuracy generalization or production approval.

**Interpretation:** on A and B, current horizontal-only V2 misses all three actual rolling T&G as review hints. Legacy counts happen to match A but include one known false T&G on B; correct aggregate count on A does NOT alone prove event correspondence, whereas approximate pilot timing gives stronger event-level corroboration. These cases justify research, not new auto-count logic or threshold fitting.

## 2. Actual repository data-flow audit

- Original-file import: `lib/track-processing.ts` parses KML/GPX/CSV and normalizes; Draft #364 `lib/gps-v2-import-lineage.ts` requires exact original **source text** and normalized canonical equality before issuing any experimental horizontal review point.
- Saved tracks: `flight_tracks.coordinates_json` stores canonical coordinates/optional altitude/timestamps, **not a guaranteed retrievable original KML/GPX source**. An actual original-source provenance check **cannot be recreated by serializing saved points into a fake source**.
- Saved track review: `lib/data/flight-track-review.ts` reads owner-scoped `flight_tracks` joined to `flights`, computes a *legacy* advisory using its raw saved point payload and displays `landingCount(points)`; it is not pilot-labeled touchdown proof and can differ from data presented in the player.
- Authenticated route: `GET /api/flights/[id]/tracks` calls `requireUser()`, queries by `userId` and `flightId`, responds private/no-store; no POST label endpoint is present.
- `lib/data/tracks.ts::getFlightTracks()` feeds display with `decodePoints(coordinates_json,2500)`. `decodePoints()` may **select the longest contiguous segment and resample**: the map/player data must NOT be reused as exhaustive algorithm/evidence input or treated as absence-of-contact evidence.
- `components/lazy-flight-track-review.tsx` already offers on-demand saved values versus legacy GPS inference and a detailed player; `components/flight-track-player.tsx` replays map/altitude/speed. This is suitable for human review when accompanied by the user's other knowledge, but does not authenticate sensor provenance and does not currently persist pilot ground-truth labels.
- Historical `docs/product/3_5_1_GPS_TOUCH_AND_GO_RELIABILITY.md` already documents real false positives due to altitude level shift, one-edge `+30 m` climb and stale-fix speed median; do not assume the specific newly labeled B false positive has one of those causes until locally reproduced.
- Current legacy rolling event requires `28–145 km/h` and at least `30 m` descent/climb within fixed ±10 sampled points and a post-minimum intermediate climb; ground-event path uses transient low speed. Horizontal-only V2 currently requires actual low-speed edges between fast edges; continuous-speed rolling T&G will frequently lack that signature. This is **code-based hypothesis**, not proof for A/B without local per-event measurements.
- **Frozen D3 policy conflict:** approved research DTO keeps `horizontalCandidates=HIDDEN` unless independent provenance authorizes pilot display; Draft #364 has experimental UI flag. Do NOT treat optional test flag, source-equal parsing, or `ADVISORY_ONLY` as approval to show source-unverified hints in production. Resolve explicitly before promotion.

## 3. Scope and constraints

### M0 — NOW: study protocol and read-only UX use (this branch)
No production source edits, no source-file upload, no direct Neon SQL, no new DB access, no schema/RLS changes, no new role, no export of live user track contents, no storage of personal event times/registration or raw GPS in repo.

Pilot can already open owned historical Flight → GPS review → GPS player and inspect suggested landings, timeline and map. Pilot labels are collected **out-of-band for research only** as pseudonymous cases, e.g. one T&G, one full stop, no low pass. Existing certified flight fields remain unchanged; an apparent stored flight count is NOT proof of physical contact.

### M1 — OWNER-AUTHORIZED DATA INVENTORY (future separate scope)
Require explicit target/account/role confirmation, **native owner-scoped/RLS and strict read-only proof** before any postflight database scan. If these are unavailable, remain in owner-opened UI only. No connector SQL on production-owner data merely because connection credentials exist. Read only selected owner-owned flights with a track and minimal metadata needed to choose cases. No other user's flights; hard cap pilot review sample count; do not fetch original coordinate arrays to assistant/cloud or commit them. Preserve no-write/certification/audit state invariants. Review the existing API semantics and whether in-memory owner-local analysis of full `coordinates_json` is possible without a new route or file exposure. A rendered/decimated array cannot satisfy that requirement.

### M2 — PILOT EVIDENCE LABELS
For each deliberately selected owner's flight, maintain a **private, user-held label manifest** separate from certified records:
- pseudonymous alias / local-only track reference and optional manual aircraft-type note;
- event `TOUCH_AND_GO | FULL_STOP | LOW_PASS_NO_CONTACT | UNKNOWN`;
- pilot UTC clock estimate OR elapsed offset from first fix, explicitly recording `EXACT | APPROX_MINUTE | UNKNOWN` precision and timezone authority;
- whether observation is pilot memory, independent contemporaneous log/record, or imported saved logbook number (the last does **not** confirm an event);
- ground truth `PILOT_CONFIRMED`, `UNCERTAIN`, or `NOT_EVALUABLE` per event, **never implicit zero** for unlabeled intervals;
- original-source availability `ORIGINAL_FILE_VERIFIED | CANONICAL_PERSISTED_ONLY | RENDERED_SUBSAMPLED | UNKNOWN`; source parser and detector revisions;
- any manually established split or missing-coverage intervals, never presumed single flight from one saved track row;
- legacy proposal kind and relative offset, experimental horizontal proposal kind and relative offset, no internal scores confused with authority.

No persistent label model, server action, public sharing or in-app edit in this phase. Even a pilot-confirmed event in this *study* does not change logbook audit/certification/recency.

### M3 — INDEPENDENT EVALUATION
Before modifying thresholds, run frozen, one-to-one temporal matching of proposals against pilot-labeled actual physical events with a predeclared matching tolerance based on label accuracy and sampling resolution (do not tune tolerance to the output). Report event-level TP/FP/FN only in **fully labeled intervals**, separately by source/recording type, event class and algorithm revision. `UNSUPPORTED_SOURCE`, missing provenance, unsampled intervals, and unlabeled contact states are **UNAVAILABLE/NOT SCORED**, not true negatives. An arrival hint is NOT a T&G prediction, and a `STOP_GO_REVIEW_POINT` is NOT a verified T&G/contact. Treat results from saved-point-only legacy review separately from exact-original-source V2.

Maintain existing invariants: low pass without touch must not become T&G; retain two positive rolling T&G in A and one in B as private-event test labels, but do not overfit to these three. A known B legacy false positive is an explicit negative. Do not modify legacy counts or the shared flight model based on review suggestions.

### M4 — DESIGN AND SECOND-AI REVIEW BEFORE CODE
Investigate missing rolling T&G in V2 and early false positive in legacy using minimal anonymized synthetic patterns **derived from evidence**, not original coordinates. Evaluate whether an optional `POSSIBLE_TG_REVIEW` research-only, non-counted event type could be safe, and require independent evidence plus D3 owner policy reconciliation before any pilot UI. Compare conservative false-positive and missed-event handling. Produce DeepSeek independent review; weigh advice against repo/current source invariants, then freeze actual design and acceptance gates. Implement later in a separate small feature branch only on explicit design approval.

## 4. Acceptance / verification

For this M0 documentation-only branch: correctness of repo paths/surface/data-shape findings verified read-only; no tests/build/CI/browser/DB actions performed or claimed. Check ROADMAP, FEATURES, CHANGELOG all updated same work cycle. Future milestones must prove exact candidate SHA, stable fixture privacy, D3 provenance policy, auth/RLS/no-write boundaries, synthetic positive and negative regressions, legacy-off behavior, no count/cert/recency modification; then targeted/aggregate/typecheck/build/Playwright as scoped. Current PR #364 still Draft and may not be merged because M0 exists.

## 5. Independent review brief (DeepSeek, read-only only)

**Task:** Critique this M0 protocol from repo source; no code edits, no Neon queries, no owner-track upload. Identify subtle provenance/RLS, sparse/unsorted timestamp, segment selection, label precision and eval leakage risks. Specific questions:
1. Does the use of persisted `coordinates_json` versus rendered `decodePoints(...,2500)` create another silent event-classification mismatch? Propose a read-only owner-local evaluation boundary, not a production API rollout.
2. Could missing continuous-speed rolling T&G be reviewed without generating contact or landing-count authority? Compare status `UNAVAILABLE` vs a non-persistent, hidden research hypothesis.
3. For the B false positive, which existing 3.5.1 evidence checks can be tested *without* weakening them? What synthetic falsifying cases would rule out each candidate cause?
4. Is the temporally labeled two-flight corpus sufficient for design? What minimum stratification and withheld cases would prevent overfitting?
5. How do we explicitly reconcile D3 frozen `horizontalCandidates=HIDDEN` with experimental PR #364 flag before any production pilot display?

**Return:** APPROVE / APPROVE WITH CHANGES / BLOCK, specific counterexamples, proposed acceptance tests, open product decisions and no fabricated flight/DB evidence. Owner is final authority.
