# GPS Detection 2.0 — R2.1a Batch 2: gap-adjacent evidence and contract coverage

**Date:** 2026-10-17  
**Status:** IMPLEMENTED IN DRAFT BRANCH / **TARGETED TESTS AND TYPECHECK NOT YET RUN ON NEW HEAD**.  
**Branch:** `test/gps-detection-r21-falsification`; project `flytally-logbook` only.  
**Parent evidence:** owner-local exact clean `eb5cde7c91683bd23dafd0a179b8b7f237ace46f` **30/30 targeted PASS; repository typecheck PASS**. These results **do not** validate subsequent Batch 2 commits.  
**Authority:** owner approved research-only isolated R2.1a experiment; no merge/deploy approval, no alteration of certified flights, GPS import or existing rule engine.

## 1. Implementation

### Research engine: quality-boundary-adjacent candidate timestamps

The prior `gapAdjacent` guard recognized candidates only when their support interval *literally touched* the start/end point of a valid quality island. A supported hypothesis could still lie seconds away from a known broken interval and receive a seemingly precise event timestamp.

Batch 2 adds `nearInvalidBoundary`: flag candidates when their **support edge lies within the already frozen evidence horizon** of an invalid island boundary (`altitudeWindowSeconds=90` for altitude candidates; `speedWindowSeconds=60` for ground-speed candidates). These remain **experimental temporal windows**, not aircraft performance data or a validated event timing uncertainty bound. `gapAdjacent=true` suppresses a precise event time (`time=null`) and still returns `physicalContactStatus=UNRESOLVED`. No proposed candidate may span an invalid quality edge; the island splitter remains authoritative.

**Terminology caveat:** the current experimental `gapAdjacent` Boolean conservatively covers **any invalid quality boundary** (GPS gap, non-monotonic timestamp, teleport, implausible altitude edge), not only strictly `GAP`. It must not be surfaced in user-facing product UX as a verified actual GPS gap without preserving the underlying `QualityEdge.reason`. The experiment must revisit naming and provenance before a runtime contract is approved.

### New tests: `tests/gps-detection-r21-batch2.test.ts`

11 synthetic, offline-only tests added with no DB/aircraft/airport API calls:
- A02 mode/datum, A03 poor horizontal accuracy, A09 negative numeric elevation, A10 invalid coordinate, A11 timestamp quantization;
- A13 gap-adjacent supported horizontal stop/go hypothesis with unavailable precise timestamp;
- T13 exact 60-second gap boundary, T17/A15 resampling diagnostic;
- A05/A06 cropped one-direction trace, T18 ambiguous timezone, A14 useful T&G/stop-go positive controls.

**Important distinction:** mode/accuracy metadata are modeled as `KNOWN | UNKNOWN` but not yet used to infer runway proximity or AGL. Corresponding fixtures verify **absence of unsupported conclusions**, not calibrated source-accuracy gating. Resampling test reports contractual no-confirmed-contact and support validity only; candidate-count stability is not proven by it. A07/A08 go-around/low-approach type differentiation is **not implemented**. A true real-flight dataset holdout is **not available**.

## 2. Scope and invariants

- **No writes to `app/`, `components/`, `lib/`, `pages/`, DB/schema, Vercel or `flytally-training`.** Experimental source remains under `research/gps-detection-r21` only.
- Legacy `lib/track-processing.ts` unchanged; reference comparator available in `research/gps-detection-r21/legacy-shadow.ts`, with `preprocessingConfound=NOT_ISOLATED`.
- No physical wheel contact confirmed/denied from GPS alone; no invented AGL, runway threshold, or pilot-logbook movements.
- R2.1a thresholds originally preregistered in Batch 1 unchanged; gap-adjacency now refers to **the existing fixed evidence windows**, not newly tuned thresholds.
- Synthetic fixture positive controls are not independent physical touchdown truth and do not establish event precision/recall. The benchmark is a falsification/regression suite.
- The full contractual T01–T20/A01–A15 suite is **not yet complete**. T20 HMM is future N/A; do not count unexecuted cases as passes.

## Owner-local Batch 2 verification closeout (tested exact HEAD `862c620a`)

The product owner ran the committed research branch at **`862c620a3b0e3bd6e23753aa1688ac7a9c078268`**, checking expected HEAD and clean worktree after a fast-forward-only pull. Full PowerShell output was supplied.

- Targeted suite `tests/gps-detection-r21.test.ts`, `tests/gps-detection-r21-batch2.test.ts`, `tests/gps-detection-r21-shadow.test.ts`, `tests/gps-detection-r21-boundary.test.ts` and `tests/v351-gps-tg-reliability.test.ts`: **41/41 PASS**, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- `npm run typecheck` (`tsc --noEmit`): **PASS** with PowerShell `$LASTEXITCODE` guard.
- Evidence is **owner-local**, not CI. Full suite / build / production browser / PostgreSQL / model training and event truth scoring: **NOT RUN**.
- This closes **Batch 2 local test gates**, not R2.1a as a whole. The remaining T/A fixture scope and misleading “model superiority” evidence risks are still open.

The original gate table below is preserved as a **pre-test historical snapshot**; the closeout above supersedes the `NOT RUN` assertions **only for the exact previously tested SHA**. Subsequent commits require fresh tests.

## 3. Verification register

| Gate | Result |
|---|---|
| Batch 1 owner-local targeted GPS/legacy/boundary tests on `eb5cde7c` | **PASS 30/30, 0 fail, 0 skip** |
| Batch 1 owner-local repository `tsc --noEmit` on `eb5cde7c` | **PASS** |
| Batch 2 new 11 test cases on new HEAD | **NOT RUN** |
| All targeted R2.1a + legacy regressions on new HEAD | **NOT RUN** |
| Repository typecheck on new HEAD | **NOT RUN** |
| Full Node suite / release build | **NOT RUN** |
| PostgreSQL, Playwright, production runtime | **N/A to this offline experiment; not executed** |
| ML training, private raw-flight export, event-level accuracy scoring | **NOT RUN / NOT APPROVED** |

**Next:** Owner-local checkout exact new HEAD, run all `tests/gps-detection-r21*.test.ts` plus `v351` regression, then typecheck. Any FAIL must be analyzed before coding further; do not change acceptance fixtures/experimental thresholds solely to make a failing test pass. After verified evidence, proceed to the remaining contract cases with explicit labels (implemented vs deferred/blocked), then consider comprehensive release-independent code safety verification for this research-only PR.

## 4. Ownership and release governance

- Issue #348: GPS Detection 2.0 research; PR #349: source/design documents, still Draft; PR #350: isolated code/tests, still Draft.
- R2.1a is **experimentally authorized**, not an endorsed detector replacement.
- No merge, production deploy, migrations, cross-user training, regulatory/recency or saved record changes without separate evidence and owner approval.
