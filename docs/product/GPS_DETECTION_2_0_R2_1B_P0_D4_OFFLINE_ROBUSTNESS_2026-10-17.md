# GPS Detection 2.0 - R2.1b-P0-D4 offline robustness/falsification

**Status:** D4 TARGETED OWNER-LOCAL VERIFICATION PASS on pinned source SHA / DRAFT and NOT RELEASED.
**Repository:** `filipto861/flytally-logbook`; isolated branch `test/gps-r21-p0-d4-offline-robustness` based on research Draft PR #350 (`test/gps-detection-r21-falsification`).
**Decision:** Product owner directed continuation of the previously proposed offline synthetic milestone. No approval for real GPS retrieval or production changes.
**Dependency boundary:** P0-D3 synthetic PostgreSQL security proof remains independently OPEN (16/16 mock/static tests and TypeScript passed on an earlier D3 exact SHA; Postgres RLS NOT RUN). D4 cannot close or bypass that gate.

## Acceptance evidence - owner-local, exact revision (2026-10-17)

**D4 offline verification: PASS for the targeted acceptance scope at clean source SHA `749dc45932df462e37b3c34cbd50db04c9661bec`.** Owner ran from `C:\\Users\\filip\\Documents\\GitHub\\Logbook` after `git fetch origin`, checking out `test/gps-r21-p0-d4-offline-robustness`, `git pull --ff-only` (up to date), empty `git status --short`, and exact SHA confirmation.

- `npm run test:target -- tests/gps-detection-r21-d4-offline-robustness.test.ts tests/gps-detection-r21-observational.test.ts tests/gps-detection-r21-boundary.test.ts`: **17 tests, 17 PASS, 0 FAIL, 0 SKIP, 0 CANCELLED** (8 new D4 + 8 observational + 1 import boundary). This confirms controlled source-shape failure cases, resources and temporal quality evidence on synthetic fixtures only.
- `npm run typecheck` (`tsc --noEmit`): **PASS**, no TypeScript diagnostics.
- GitHub branch source diff was independently inspected against research base `test/gps-detection-r21-falsification`; changed paths restricted to research aggregator, independent synthetic tests and D4 governance documentation; no production files modified.
- **NOT RUN:** full Node suite, production build, Playwright, CI, PostgreSQL RLS/driver/DB operations, Neon, deployment, production smoke. No claims of a complete release gate. This is **local**, not CI.
- **P0-D3 security remains OPEN:** 16/16 historical Node/mock checks were separately verified, but actual PostgreSQL RLS was not exercised. No real owner GPS access, authorized subject identity, full-fidelity source quality or physical wheel-contact truth has been demonstrated. D4 does not unblock real data.
- Documentation amendments after this exact source SHA do **not** inherit fresh exact-head runtime test evidence; source-code diffs remain unchanged. PR #352 stays DRAFT, not merged or deployed.

**Disposition:** D4 research-only negative-test/TypeScript acceptance is CLOSED at `749dc45932df462e37b3c34cbd50db04c9661bec`; downstream security, provenance and empirical validation are DEFERRED / NO-GO. The original planning/checklist below is retained as preregistered scope and historical status.

## Reconstructed source inventory

- `research/gps-detection-r21/detector.ts`: quality edges, valid islands, unresolved movement candidates; never authoritative touchdown.
- `research/gps-detection-r21/observational-aggregate.ts`: in-memory bounded comparison only, requires preauthorized input and is **not** an authorization boundary.
- `lib/track-processing.ts`: existing production legacy heuristic, imported for *comparison* by isolated research; production source remains unchanged.
- `tests/gps-detection-r21-observational.test.ts`, `tests/gps-detection-r21-batch4.test.ts`, `tests/gps-detection-r21-boundary.test.ts`: current contract and source exclusion.

## D4 small-batch contract

**Permitted:** new independent synthetic-only offline Node test file; a minimal fail-closed shape/preflight correction in research aggregator if proven necessary. Run explicit targeted Node and repository `npm run typecheck` on the exact checked-out revision.

**Out of scope:** production `app/`, `components/`, `lib/`, DB/Neon/API, authentication/session, source import/persisted GPS data, real track files, labels/ML training, actual touchdown count, broad algorithm parameter tuning, `flytally-training`, merge and deploy.

### Intended negative cases and acceptance

| Case | Adversarial synthetic input | Required behavior |
| --- | --- | --- |
| D4-01 | NaN/Infinity coordinate or altitude | Whole aggregate `UNAVAILABLE / INVALID_INPUT` before candidate evaluation |
| D4-02 | Sparse array hole or malformed/coercible point | `UNAVAILABLE / INVALID_INPUT`; no implicit imputation |
| D4-03 | Oversized aggregate (5-50 tracks, max 20k each but >100k total) | `UNAVAILABLE / TOTAL_POINTS_EXCEEDED`; no partial aggregate |
| D4-04 | Malformed timestamp, repeated timestamp and 60-second gap | Reason-coded invalid edges, no claimed speed on invalid edge or physical contact |
| D4-05 | Legitimate `alt:0` and `alt:null` in same sample | Distinct observations, no fabricated AGL/contact |
| D4-06 | Broken island and noisy but syntactically sound tracks | Candidate support cannot cross invalid quality edge, and physical contact always unresolved |
| D4-07 | Unknown/empty cohort and partial failure | No detailed route/coordinates/time or exception leakage; no inferred whole-flight count |
| D4-08 | Boundary source contract | No new research import in production; legacy source unchanged |

**Compatibility:** Keep out-of-range but finite coordinates as a reason-coded `BAD_COORDINATES` quality edge (existing R2.1b contract); reject non-finite numbers at the aggregate ingestion boundary. Do not turn absent/malformed *timestamp strings* into fabricated times or falsely claim a complete track. Keep the aggregate-only, post-normalization, no-independent-contact-truth contract and existing 5-50/20k/100k workload limits.

**Evidence/DoD:** Node targeted tests and TypeScript PASS on one exact clean SHA, no skipped tests; static source diff restricted to this research module/tests/docs; documentation reconciled with observed outcomes. Until executed, all new gate results are `NOT RUN`. Even after success, operational GPS and P0-D3 RLS remain blocked. No new fixture counts may be presented as physical landing accuracy.

## Roadmap disposition

1. DISCOVER / source audit - performed read-only against research Draft PR #350.
2. DESIGN/ROADMAP - freeze bounded D4 negative test matrix here.
3. IMPLEMENT SMALL BATCH - research-only validation guard and independent regression tests.
4. VERIFY - request owner-local exact SHA targeted tests and `npm run typecheck`, inspect output.
5. DOCUMENT/CLOSE - update ROADMAP/FEATURES/CHANGELOG **without** upgrading RLS/prod states.

### Deferred

- Any substantive changes to the temporal detector or thresholds.
- Trusted real-data ingress, owner consent, RLS/driver permissions, and full-fidelity stored-data correctness.
- Precision/recall, verified touchdown events, real-aircraft/source applicability.
