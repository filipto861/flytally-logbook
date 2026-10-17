# GPS Detection 2.0 — R2.1a Batch 5: invalid-boundary provenance

**Date:** 2026-10-17. **Repository:** `filipto861/flytally-logbook`.
**Branch:** `test/gps-detection-r21-falsification`, [Draft PR #350](https://github.com/filipto861/flytally-logbook/pull/350), unmerged.
**Status:** OWNER-LOCAL BOUNDED ACCEPTANCE: **69/69 Node PASS + TypeScript PASS** on exact clean `b6af89d586cd6264ff2549a29e80333b80c50e9b`; historical pre-execution NOT RUN snapshot remains in earlier sections.

## Goal and frozen design

Close one known A13/T13 evidence gap without inventing flight-event facts. In previous versions, candidate `gapAdjacent` was true near **any** invalid signal island edge, conflating actual time `GAP` with `POSITION_JUMP`, `ALTITUDE_DISCONTINUITY`, `NON_MONOTONIC_TIME`, `MISSING_TIME`, or `BAD_COORDINATES`. That is a provenance/diagnostic hazard before pilot-reviewed UI use.

- `PatternCandidate.invalidBoundaryEvidence` is a typed ordered list of exact observed invalid edge references (`from/to` sample indices), `BEFORE_ISLAND` or `AFTER_ISLAND` side, and original `EdgeReason`. It contains **only** edges returned as `UNAVAILABLE` by the existing quality engine. No new threshold, physical ground-contact sensor or inferred event type.
- The old `gapAdjacent` Boolean stays for compatibility and means **near any invalid boundary**, not only `GAP`. `invalidBoundaryEvidence.length > 0` is the canonical reason-coded evidence for this research experiment.
- If the candidate's evidence window is close to such an invalid edge (existing, frozen time horizon), `time=null`. If time distance cannot be established, also suppress exact time, not silently treat as safe. `physicalContactStatus="UNRESOLVED"` remains mandatory.
- Candidate support stays within a single quality `SignalIsland`; no interpolation through an invalid edge. An altitude-candidate merge must recompute both invalid-boundary provenance and time from the **updated** support and candidate index, rather than inherit stale confidence.
- `createFalsificationScorecard` rejects contradictory `gapAdjacent` vs evidence, fabricated `reason/edge` not actually present in the input quality edges, and a side/edge inconsistent with the candidate's island. Precise time next to an invalid edge remains a safety violation.
- `AdvisoryPatternCount` continues to count only observed candidate patterns, **never verified landings**. A07/A08 go-around and low-approach classification remain separately deferred; no release claims.

## Exact change scope

- `research/gps-detection-r21/detector.ts`: additive reason-coded candidate provenance, merge-time recalculation.
- `research/gps-detection-r21/falsification-scorecard.ts`: fail-closed provenance consistency checks.
- `tests/gps-detection-r21-batch5-provenance.test.ts`: six synthetic tests for no-edge source, actual gap, five distinct non-gap invalid reasons, legitimate scorecard, fabricated reason/side/precision, cropped valid data.
- This document and ROADMAP / FEATURES / CHANGELOG / preexisting coverage audit status update.
- No production `lib/track-processing.ts`, app, auth, API, data/Neon, DB migration, training, or external GPS tracks. No dependency added or threshold tuning. Historical research tests remain unchanged.

## Verification / acceptance

**Prior owner-local baseline:** exact clean `8b410f32d207adab54d3b84b340275153d4b1731`: 63/63 targeted GPS/legacy tests PASS + TypeScript PASS. This **does not certify Batch 5**.

**New expected target:** 69 Node cases (previous 63 + six Batch 5 tests), 0 skipped/failures, repository `npm run typecheck` PASS, exact clean SHA, and source-diff inspection. The target count is an expectation, not a reported execution result. Full Node suite/build/Playwright/CI/DB and real GPS tests are NOT RUN. If any fixture fails, preserve the original parameter/utility contracts and classify the failure rather than changing expectations to fabricate an apparent pass.

**Recommended owner-local commands** (separate PR #350 topic branch; these do not access any DB):

```powershell
git fetch origin
git switch test/gps-detection-r21-falsification
git pull --ff-only
git status --short
git rev-parse HEAD
npm run test:target -- tests/gps-detection-r21.test.ts tests/gps-detection-r21-batch2.test.ts tests/gps-detection-r21-scorecard.test.ts tests/gps-detection-r21-batch4.test.ts tests/gps-detection-r21-batch5-provenance.test.ts tests/gps-detection-r21-observational.test.ts tests/gps-detection-r21-shadow.test.ts tests/gps-detection-r21-boundary.test.ts tests/v351-gps-tg-reliability.test.ts
npm run typecheck
```

**Next after PASS:** review reason-coded provenance against the frozen R2.1a contract, then address one of the remaining T/A falsification gaps and specify pilot-review DTO without authority promotion. `A07/A08` classification needs separate approved design; no real private track access until P0-D3 RLS and owner/driver/consent gate proven. No merge or deploy.

## Owner-local Batch 5 closeout — exact tested source (2026-10-17)

**ACCEPTED for BOUNDED OFFLINE SYNTHETIC RESEARCH.** Owner Windows clean `test/gps-detection-r21-falsification` at exact SHA `b6af89d586cd6264ff2549a29e80333b80c50e9b`. `git fetch` and `git pull --ff-only` completed; empty `git status --porcelain` and exact SHA guard passed. All nine named GPS/legacy targeted test files ran through `npm run test:target`: **69/69 PASS**, **0 fail**, **0 skipped**, **0 cancelled**, **0 todo**. Included all six new Batch 5 A13 provenance cases and pre-existing T09/T11 utility/legacy regressions. `npm run typecheck` / `tsc --noEmit` completed with no diagnostics and the explicit PowerShell exit check passed. This is **owner-local**, not CI.

The original authored-only `NOT RUN` statements above describe the earlier pre-execution snapshot and are **superseded only for this exact tested SHA**. Subsequent docs-only commits do not constitute execution at a new SHA.

**Scope of acceptance:** quality-edge index/side/reason provenance for synthetic motion-pattern candidates, protected event-time uncertainty near invalid boundaries, negative scorecard checks against fabricated evidence, and no regression in the targeted legacy comparison. Passing six A13 regressions does not prove all A13/T13 contract conditions or every T01–T20/A01–A15 scenario. Event truth/physical gear contact, independent holdout, source-native provenance, real-world accuracy/precision/recall, production performance, full test suite, build, Playwright, PostgreSQL RLS and real owner GPS remain **UNVERIFIED / NOT RUN**. `physicalContactStatus=UNRESOLVED`, GPS-only whole-flight landings `UNAVAILABLE`; no user/private-track read or write.

**Next:** one bounded source-only synthetic falsification batch targeting previously open T19 and source-quality A02/A03 without tuning thresholds to fixed regression fixtures; separately design pilot-confirmation UI contracts. A07/A08 require separate product decision. No DB/Neon/PG16 access, deployment, release, merge or `flytally-training` changes.
