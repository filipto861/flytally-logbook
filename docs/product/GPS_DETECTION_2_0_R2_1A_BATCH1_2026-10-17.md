# GPS Detection 2.0 — R2.1a implementation: Batch 1 / offline-only

**Date:** 2026-10-17  
**Authorization:** Owner approved **isolated synthetic-only R2.1a implementation**. This does **not** authorize production integration, database reads/writes, use of third-party private GPS data for model training, model promotion, or deployment.  
**Repository:** `flytally-logbook` only; **branch:** `test/gps-detection-r21-falsification` from `main@6a67a02475ab09c3271f8646427f7956ed6e590a`.  
**Roadmap dependency:** [Issue #348](https://github.com/filipto861/flytally-logbook/issues/348), [R2.1a approved research contract in Draft PR #349](https://github.com/filipto861/flytally-logbook/blob/docs/gps-detection-2-research-r0-r1/docs/product/GPS_DETECTION_2_0_R2_1_OFFLINE_BENCHMARK_CONTRACT_2026-10-17.md). PR #349 remains separate and unmerged; it retains the complete R0/R1/R2 design history. This branch independently records implementation reality.

## 1. Batch 1 scope implemented

- `research/gps-detection-r21/detector.ts` — pure TypeScript, isolated under top-level `research/`, with explicitly **predeclared experimental parameters**, strict UTC/offset time handling, quality-masked edges, gap/discontinuity segmentation, and unsupported edges represented as `UNAVAILABLE`, never speed=0.
- Preserves observation order and distinction between missing altitude (`null`) and a genuine numeric altitude `0`. Metadata type accommodates `KNOWN(value)` / `UNKNOWN` altitudeMode, vertical units/datum, source/generator, accuracy and timestamp precision. These metadata are **not necessarily present in historical records**. No AGL or runway contact is derived.
- Processes contiguous valid signal islands and generates only `T_G_PATTERN_CANDIDATE` (altitude reversal + supported movement) or `STOP_GO_PATTERN_CANDIDATE` (speed dip with timed support). Candidate `physicalContactStatus` is **always `UNRESOLVED`**. No negative contact label, confirmed touchdown or automatic saved landing count.
- `AdvisoryPatternCount` is distinctly tagged `PATTERN_ONLY`, scoped to **observed valid islands**; insufficient points/span result in `UNAVAILABLE`. It is not a certified or regulatory movement count.
- `research/gps-detection-r21/legacy-shadow.ts`: calls the **actual unchanged production** `inspectTrackFile` / `touchAndGoEvents` / `landingCount` for comparison with research candidates, using the same production-preprocessed fixture. It explicitly reports `preprocessingConfound=NOT_ISOLATED` and `rawAcquisitionOrderRecovered=false`; therefore **no end-to-end preprocessing improvement is claimed**.
- `tests/gps-detection-r21.test.ts`: 21 synthetic falsification/contract tests against research detector, including known-shape positive circuits and stop/go patterns. `tests/gps-detection-r21-shadow.test.ts`: two additional legacy comparison checks (not yet run in full repository). `tests/gps-detection-r21-boundary.test.ts`: checks production source for static/dynamic literal imports from `research/gps-detection-r21`; it deliberately fails if the expected application source tree is missing.

**Explicitly deferred:** Full T01–T20/A01–A15 matrix (T20 HMM remains future N/A); threshold-independent development/untouched holdout; independent preprocessing ingest comparison; any ML/HMM/HSMM; model calibration, event-level contact metrics; source sensor accuracy extraction; runway/airport proximity; runtime UI; legacy behavior changes. This is Batch 1, **not completion of R2.1a**.

## 2. Parameter and source interpretation caveats

All research parameters were chosen **before the first local test execution** and are experimental hypotheses, not AFM limitations or approved aircraft limits: `gapSeconds=60`, `maxSpeedKmh=900`, `maxVerticalRateMps=25`, `altitudeReversalM=30`, `altitudeWindowSeconds=90`, `altitudeMinSpeedKmh=28`, `altitudeMaxSpeedKmh=145`, `mergeSeconds=40`, `lowSpeedKmh=20`, `fastSpeedKmh=45`, `speedWindowSeconds=60`, `minLowDurationSeconds=5`. They are frozen for this test batch; **do not tune against the fixed adverse fixtures and later call their results independent accuracy validation**.

An altitude reversal plus horizontal movement is not proof of gear contact. Horizontal speed dip may reflect taxi/ground behavior, not T&G. True contact vs low pass can be observationally indistinguishable. Candidate outputs are intentionally advisory only, with no simulated contact probabilities or automatic flight revisions.

## 3. Verification evidence (exactly what ran)

| Gate | Status | Evidence |
|---|---|---|
| Isolated local Node 22 TypeScript-stripping `node --test` | **PASS 21/21** | Run against local authored copies of `detector.ts` and `gps-detection-r21.test.ts` matching the published UTF-8 file lengths; 0 failed, 0 skipped |
| Isolated local TypeScript 5.8 strict `tsc --noEmit` of detector | **PASS** | Standalone source file only; does **not** substitute for repository `npm run typecheck` |
| Synthetic five-circuit diagnostic | **5 T_G_PATTERN_CANDIDATE** | Valid islands, still all `UNRESOLVED`; synthetic expected shape only |
| Known-missed short rolling-T&G-shaped synthetic diagnostic | **1 T_G_PATTERN_CANDIDATE** | Exploratory observation; physical-contact truth not established by this run |
| Legacy `v351` compatibility + new `shadow` tests | **PASS, owner-local full checkout** | 6 legacy regression tests + 2 shadow tests on exact PR #350 HEAD `eb5cde7c` |
| Production import boundary test in full checkout | **PASS, owner-local full checkout** | 1/1 boundary test on exact PR #350 HEAD `eb5cde7c` |
| Repository TypeScript | **PASS, owner-local full checkout** | `npm run typecheck`, `tsc --noEmit`, exit 0 on exact SHA `eb5cde7c` |
| Full Node suite, build, Playwright, PostgreSQL, CI | **NOT RUN** | No claims of whole-repo or CI success; DB/browser may be N/A after scope review |
| AI training / real-data accuracy benchmark / production smoke | **NOT RUN / NOT APPLICABLE** | No independent event-level labels, not a deployed feature |

**Additional owner-local full-checkout evidence (2026-10-17):** exact clean branch HEAD `eb5cde7c91683bd23dafd0a179b8b7f237ace46f`; `npm run test:target` for 3 R2.1a test files plus `tests/v351-gps-tg-reliability.test.ts` **PASS 30/30, fail 0, skipped 0**, including 21 detector, 2 shadow, 1 import boundary, 6 legacy v351. `npm run typecheck` **PASS** with PowerShell exit-code assertions. All results are **owner-local**, not CI. Full Node suite, production build, Playwright/Postgres and full T/A falsification coverage remain **NOT RUN**. This verifies Batch 1 required local gates only; no model-superiority claim, no merge/deploy approval.

## 4. Next small batches, Do / Do Not

**Batch 2 (next):** Run `tests/gps-detection-r21*.test.ts` alongside `tests/v351-gps-tg-reliability.test.ts` on owner workstation, fix any actual compiler or runtime failure. Finish contract cases for gap-adjacent timestamps, absent altitude, source order and all positive/negative fixture coverage, and record explicit comparison/preprocessing-confound matrix. Report untested T/A fixtures as NOT RUN, never implicit PASS.

**Batch 3 (conditional):** Compare detector usefulness, false pattern hypotheses and abstention *within preregistered synthetic fixtures only*. Distinguish model error from preprocessing differences. No physical-contact precision/recall or performance claim until independently reviewed event-level truth and data permission.

**Do NOT:** wire research module into production code; train ML on user records; modify/auto-save any flight; change `civil-twilight` or recency; issue uncalibrated probabilities; deploy; replace the legacy detector; touch `flytally-training`.

## 5. Draft PR acceptance before merge

- Explicit source import boundary holds in full repository.
- All targeted R2.1a and legacy regression tests **PASS**, repository TypeScript/typecheck **PASS**; no third-party usage or production read/writes.
- Any new research fixtures are genuinely synthetic or already authorized public regressions.
- ROADMAP/FEATURES/CHANGELOG updated within same branch with actual results and remaining NO-GO conditions.
- Independent full-document review completed on R2.1a design in PR #349; owner approved *experiment scope only*. Runtime integration and promotion would require separate approval, privacy/label/evidence gates and feature flag.
- PR remains Draft until full owner-side verification; neither source nor docs branch is automatically merged into `main`.
