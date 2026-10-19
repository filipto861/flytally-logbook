# GPS V2 D4.3-R2-1 — Candidate-independent altitude quality inventory

**Date:** 2026-10-19
**Scope:** research-only implementation in child branch research/gps-v2-d43-r2-quality-20261019 (parent PR #366 Draft).
**Production authority:** NONE. No detector, landing count, recency, persistence, aircraft configuration, UI, feature flag, schema or deployment.
**Review:** Owner elected to skip optional DeepSeek consultation to expedite R2-1; verification and separately approved R2-2 remain mandatory.

## Delivered
- research/gps-detection-r21/stage-d43-r2-altitude-quality.ts — immutable candidate-free quality summary; original source D4.1/R1 recomputation, revision and private local binding.
- tooling/gps-v2-d43-r2-quality.mjs — owner-local aggregate-only CLI, anonymous sampleNN and optional explicit validated manual cuts.
- tests/gps-v2-d43-r2-quality.test.ts — **21 AUTHORED, NOT EXECUTED** synthetic/adversarial regressions, including null versus zero, source boundaries, dedup, height conflict, same-ms collisions, irregular cadence, reference derivative, overlapping failures, split, staleness, privacy and native V2 unchanged.
- Existing lib/ detection, parser and GPS source acceptance unchanged.

## Contract and uncertainty
**Input:** Exact original local KML source text, optional validated canonical split cuts and optional upload/split revisions with local equality binding. No caller-provided canonical array. Existing D4 input limits: 2,000,000 characters, 25,000 source fixes, 19 split cuts.

**Returned:** SOURCE_ALTITUDE_QUALITY_DIAGNOSTIC_ONLY or bounded UNAVAILABLE. Counts: finite/null/zero height (zero subset of finite), source boundaries, overlapping issue reason counts and unique affected edges, positive source intervals, finite/missing endpoint pairs, within-reference derivative comparisons and >15s unassessed endpoint pairs, source cadence maximum. No raw source, UTC, GPS positions/heights, registration, path, filename, source digest or detailed candidate indexes in output. Parsed syntactic height is not calibrated accuracy.

**Reference:** The frozen historical 25 m/s threshold is compared on EVERY in-boundary, previously unflagged, finite-height source edge with positive elapsed time up to 15s. This global source-edge diagnostic does NOT mean a legacy candidate-specific rejection; R2-1 never produces a T&G hypothesis, local minimum, ranking or score.

**Independent evidence dimensions:** D4.1 provenance boundaries, cross-block duplicate adjacency, altitude conflict contexts, same-JS-ms timestamp collisions, manual cuts, R1 V2 time/speed invalidity. R1 reason counts can overlap on a single unique source edge. Pairs over 15s are skipped by the old derivative guard (even if a V2 >=60s invalid edge) and are NOT quality-approved. Even a 5s pair contains unobserved intervening motion.

**All outputs always:** physicalContact=UNRESOLVED, actualLandings=UNAVAILABLE, recencyEvidence=UNAVAILABLE, canAffectCanonicalFlight=false, sourceAltitudeDatum/Accuracy/Authenticity=UNKNOWN.

## Owner-local verification (pending)
Use Node.js 24, exact child branch HEAD. Run these in PowerShell from the repo root:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/gps-v2-d43-r2-quality.test.ts
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test tests/gps-v2-d43-r1-coverage.test.ts tests/gps-v2-d43-r2-quality.test.ts tests/v351-gps-tg-reliability.test.ts tests/track-processing.test.ts
    npm run typecheck

Then run each of the six original PRIVATE KMLs strictly owner-local (never copy original path into a published report):

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d43-r2-quality.mjs --file "C:\PRIVATE\sample.kml" --id sample03

Optional pre-validated canonical split cuts:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d43-r2-quality.mjs --file "C:\PRIVATE\sample.kml" --id sample03 --cuts 123,456

Only anonymous, privacy-reviewed aggregate reports may be shared. Source identities / heights / raw UTC / GPS track must remain private. Existing six-file R1 success does not count as an R2 run.

## Status, scope and gates
R2-1 **STAGED; tests/typecheck/private six-KML acceptance NOT RUN**. Full suite/build/browser/CI/production smoke NOT RUN; DB/migration N/A, merge/deploy NOT DONE, feature OFF, Pilot Review HIDDEN, native multi-block V2 UNSUPPORTED_SOURCE.

R2-1 closure requires exact-head local Node24 tests/typecheck, owner-local six KML diagnostic review, consistency/privacy check and aligned roadmap/features/changelog. R2-2 accepted/rejected geometry is separate, still NOT APPROVED; do not silently create a new detector. R3 independent contact evidence remains required before actual detector accuracy claims. Prior 26 proposed tests cover future R2-2/R3 too; the 21 new R2-1 tests do not imply all 26 are implemented.

## 2026-10-19 first owner-local verification and TypeScript fix

User-provided PowerShell log on tracked R2-1 research branch reports four targeted test files **79/79 PASS** (21 R2-1, 24 R1 and 34 existing parser/legacy cases), 0 failures, total 894.5585ms. Exact local commit SHA was not printed in the log. `npm run typecheck` **FAILED** with two TS2345 nullable GPS timestamp argument errors in `stage-d43-r2-altitude-quality.ts` lines 143–144. Follow-up commit `b22439ca` captures nullable timestamp strings into local variables before Date.parse, preserving runtime semantics and fail-closed behavior. **Post-fix tests and typecheck NOT RUN**; local rerun is required. Six private KML R2 CLI evaluations are still NOT RUN. This is not R2-1 closure evidence yet.

## 2026-10-19 second owner-local verification (post TypeScript fix)

User ran `git status --short` (clean), `git pull --ff-only` (fast-forward `4cbe7365..129fa308`) on tracked `research/gps-v2-d43-r2-quality-20261019`, followed by targeted four-file Node tests and `npm run typecheck`. **79/79 targeted tests PASS, 0 failures, 0 skipped, duration 879.9284 ms; TypeScript PASS (`tsc --noEmit` completed without diagnostics)**. This is **owner-local evidence at checked-out code HEAD `129fa308`**, not CI and not evidence of GPS physical contact. Of 79 tests, 21 are new R2-1 cases and 24 are R1 cases; remaining 34 are relevant existing track-processing/legacy tests. R2-1 still awaits six **owner-private** native CLI reports and privacy review; merge/deploy/full suite/build/browser/CI NOT RUN, DB/migration N/A. Subsequent documentation-only commits do not retroactively invalidate that code/test evidence, but are not reruns on their own exact HEAD.
