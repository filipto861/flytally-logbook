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
