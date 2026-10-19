# GPS V2 — D4.3-R1 source coverage and evidence gaps (research-only)

**2026-10-19. Current state: D4.3-R1 COMPLETED IN APPROVED RESEARCH-ONLY SCOPE; owner-local 107/107 TARGETED TESTS + TYPECHECK PASS at source HEAD `d3b263bb`; native coverage 6/6 ORIGINAL KML PASS at docs-only `996abffa`. NOT RELEASED / NO PRODUCTION COVERAGE OR CONTACT CLAIM.**
Repo: flytally-logbook, branch research/gps-v2-stage-d-comparator-20261018, PR #366 Draft (base feat/gps-v2-release-critical-engine, PR #364 Draft). No production runtime, lib/ refactor, UI/DB, flight-count or feature-flag authorization.

## Authority and source reconstruction

- Source-of-truth data are original in-memory local KML plus production canonical parseKml, subject to strict D4.1 research source-lineage parity. Source provenance revision pinned to GPS_D4_MULTI_GX_SIDECAR_V1; frozen V2 edge revision GPS_V2_HORIZONTAL_V3. No unsupported multi-block input is enabled in native production V2.
- D4.2A research shadow reached bounded engineering completion: code-HEAD 83635bc4 owner-local Node24 tests 83/83 PASS and typecheck PASS; six owner-KML D4.2A CLI 6/6 at documentation-only c5cd44b2, zero horizontal STOP_GO proposals in each. Zero proposals are NOT no physical touchdowns or adequate sampling.
- Independent DeepSeek post-corpus review and repository reconciliation recorded at docs/product/GPS_V2_STAGE_D42_POST_CORPUS_DEEPSEEK_RECONCILIATION_2026-10-19.md. Owner specifically approved the proposed D4.3-R1 research-only coverage implementation. D4.3-R2 altitude shape and D4.3-R3 evidence acquisition remain separate decisions.

## Implemented batch

1. research/gps-detection-r21/stage-d43-r1-coverage.ts: pure read-only D4.3-R1 source analysis over strictly parsed D4.1 canonical data. It checks supplied local SHA-256 revision binding, validates explicit manual split cuts, records D4 blocked source/collision/height-conflict edges, extends local altitude-quarantine context as in D4.2A, and records independent V2-invalid time (<=0s or >=60s) and speed (>900km/h) edges without modifying any frozen gate. It returns only relative fix ordinal, relative duration and evidence-reason labels, never coordinates/absolute UTC/height/registration/source text.
2. tooling/gps-v2-d43-r1-coverage.mjs: owner-local no-write CLI. Reads only the selected local KML, requires anonymous sampleNN/NNN ID, prints only aggregate counts, source-local median/max interval, top eight within-provenance interval durations, and reasons. No original KML, source path, absolute UTC or SHA-256 fingerprint is printed.
3. tests/gps-v2-d43-r1-coverage.test.ts: 24 AUTHORED regression cases, including uniform clean five-second baseline, 4.9s source boundary, 35.35s / 94.39s / 491.57s within-block intervals, cross-block dedup, conflicting altitude, same-ms UTC collision, manual split independence, exact 60s edge rule, oversized/malformed/unordered sources, >900km/h edge, local staleness, privacy and native V2 unsupported regression.
4. ROADMAP, FEATURES, CHANGELOG updated in this same work cycle. No edits to lib/, app/, production T&G algorithm, flight records, statistics, recency, database, UI, feature flags, migration, deploy or cross-repo flytally-training.

## Frozen research contract

- **Observed fix:** paired source coordinate/UTC accepted by exact D4.1 source-to-canonical equality. **Between fixes:** motion/flight/contact unobserved and unproven regardless of the observed time difference, even if a derived average speed is V2-eligible. The successful result explicitly returns FIX_ENDPOINTS_ONLY_INTERVENING_MOTION_UNKNOWN, unknownManeuvers=UNAVAILABLE, actualLandings=UNAVAILABLE, physicalContact=UNRESOLVED and canAffectCanonicalFlight=false.
- **Source discontinuity:** D4.1 source blocked edges always hard breaks, even only 4.9 seconds apart. Canonical altitude-conflict retained fixes, collapsed cross-block duplicate and same-JS-millisecond timestamp collision retain separate quarantines. Manual flight split is separate and NEVER inferred from a source block.
- **Time/speed restrictions:** the existing >=60s V2 velocity-edge limit and >900km/h plausibility rule are reported as independent invalid-velocity reasons, NOT a universal GPS continuity/gap threshold. A 35.35s pair can remain a mathematically allowable V2 velocity edge but never proves continuous observation; a 491.57s pair is visible and >=60s V2-invalid. No new 15/35/60s source coverage threshold invented.
- **Source cadence summary:** within-provenance positive pair median, maximum, and up to eight longest intervals plus their ratio to the source-local median. This ratio is descriptive; it does not classify a touchdown or generate an inferred event, invalid candidate or threshold-based source break.
- **Candidate independence:** R1 does NOT call the legacy, D4.2A or V2 event recognizer, and cannot decide candidate truth or score TP/FP/FN. A gap exists even when the detector returns no candidates. Candidate-to-gap causal linking is deliberately NOT claimed by this standalone source report; future join requires documented candidate evidence-edge windows and a separate owner gate.
- **Local freshness:** exact source text, manual split cuts, upload/split revision and parser/reference/R1 revision enter a local SHA-256 equality token; no token, UTC, route, source filename, pilot ID or path is included in returned diagnostics or CLI. A changed source/split/revision with stale token yields UNAVAILABLE. An input source that cannot establish D4.1 parity fails closed; missing coverage is not zero.

## Verification and expected corpus behavior (NOT YET VERIFIED)

| Gate | Planned check | Current evidence |
| --- | --- | --- |
| G1 | Owner-local Node24 new R1 test file (24 cases), plus existing 83 D42/D4/D1/D2/V2 targeted tests | NOT RUN for D4.3-R1; expected test total 107 |
| G2 | npm run typecheck exact HEAD | NOT RUN for D4.3-R1 |
| G3 | Six owner-private original KML, read-only R1 CLI, no raw source in outputs | NOT RUN; previously D4.1 proved 2/2/3/2/2/2 blocks and 948/587/893/74/593/1034 canonical points |
| G4 | 491.57s sample05 and 94.39s sample08 longest interval visible; evaluate sample08 35.35s interval without magic threshold | NOT RUN on R1; D4.2A prior output provides known max only |
| G5 | Privacy, source boundary, malformed/unavailable, manual split independence | Authored synthetic tests ONLY, NOT EXECUTED |
| G6 | Production scope and docs consistency | PR diff/code inspection required; no merge/deploy |

## Owner-local gate (Windows PowerShell / Node 24)

    git fetch origin
    git switch research/gps-v2-stage-d-comparator-20261018
    git pull --ff-only
    git rev-parse --short HEAD
    node -v
    npm run test:target -- tests/gps-v2-d43-r1-coverage.test.ts tests/gps-v2-d42-shadow.test.ts tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
    npm run typecheck

**Only after both commands pass:** use the six owner-private original KML paths, never commit or post their full names/registration. Run the following one at a time, substituting the absolute local private path (keep paths only on the owner's machine):

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d43-r1-coverage.mjs --file "<PRIVATE_KML_PATH>" --id sample03

Repeat for sample04..08 with the corresponding original local files. Or use a preexisting explicitly ordered `$files` array in the owner PowerShell session, with sample03..08 matched to their prior D4.1/D4.2A source identities. CLI emits aggregate evidence-only JSON, not raw coordinates or source fingerprints.

## Acceptance/closing policy

Correctness > convenience: do not weaken existing V2/legacy T&G rules for successful output. D4.3-R1 is NOT DONE until current source/tests HEAD targeted Node24 + TypeScript PASS and all six owner-local source CLI reports plus review of gap terminology/privacy and required docs. Targeted local testing is NOT CI. Full tests/build/Playwright/browser/DB/deploy NOT RUN/N/A unless separately done. PR #366 remains Draft, parent #364 Draft; pilot review HIDDEN, feature OFF, production native multi-gx KML still UNAVAILABLE/UNSUPPORTED_SOURCE. No physical contact, movement count, recency or source authentication authority.

**Additional cases:** D43-R1-23 executes the read-only CLI against a deliberately absent synthetic filename to verify no raw local path or unsanitized sample ID is echoed; D43-R1-24 verifies that an observed 100s inter-block pair retains both SOURCE_BLOCK_BOUNDARY and existing V2_TIME_EDGE_INVALID, without counting two physical events. These are authored, NOT RUN. Total new R1 tests: **24**, expected combined targeted tests: **107** (previous 83 + new 24).


## Independent six-source interval check (assistant-local Python — NOT a Node R1 test)

Before the owner-local R1 CLI, a separate read-only Python XML/time inspection of the six private original owner KML files reconstructed adjacent near-position/same-UTC canonical duplicate removal, excluded inter-gx:Track edges, and calculated positive within-block source timestamp differences. This analysis was NOT an invocation of the newly authored research module; it is only independent source-shape evidence. No source filenames, UTC timestamps, aircraft registration, coordinates or raw KML were committed.

| Sample | Blocks | Normalized fixes | Median positive within-block interval (s) | Maximum (s) | Second largest (s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| sample03 | 2 | 948 | 2.010 | 20.17 | 19.93 |
| sample04 | 2 | 587 | 1.600 | 20.84 | 17.41 |
| sample05 | 3 | 893 | 2.685 | 491.57 | 50.17 |
| sample06 | 2 | 74 | 2.795 | 50.09 | 46.32 |
| sample07 | 2 | 593 | 2.510 | 53.06 | 19.64 |
| sample08 | 2 | 1034 | 4.390 | 94.39 | 35.35 |

These values independently match earlier D4.2A source cadence summaries. Crucially sample08 contains both 94.39s and 35.35s *within-source* intervals. The new R1 Node24 implementation must reproduce these after its exact-HEAD tests. **Do not interpret the unobserved intervening motion as no contact, and do not label every below-60s interval fully observed.**


## Owner-local D4.3-R1 first verification — exact source/test HEAD `d3b263bb` (2026-10-19)

Evidence: product owner's Windows PowerShell transcript. `git fetch origin`, `git switch research/gps-v2-stage-d-comparator-20261018`, `git pull --ff-only`, `git rev-parse --short HEAD` printed **`d3b263bb`**, and `node -v` printed **`v24.19.0`**.

Executed:

    npm run test:target -- tests/gps-v2-d43-r1-coverage.test.ts tests/gps-v2-d42-shadow.test.ts tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
    npm run typecheck

Observed targeted Node tests: **107 total / 107 PASS / 0 FAIL / 0 skipped**, including all **24** newly authored D43-R1-01..24 tests. TypeScript `tsc --noEmit` exited without any diagnostic: **PASS**. This is **OWNER-LOCAL testing, NOT CI**, and demonstrates the specific synthetic/adversarial contracts only. No full suite, production runtime, browser, migration or deployment verified.

**Next acceptance gate, still NOT RUN:** owner-local read-only `tooling/gps-v2-d43-r1-coverage.mjs` on the same six original private KML files. Check source block counts `2/2/3/2/2/2`, canonical fixes `948/587/893/74/593/1034` and source interval statistics against previous independent reconstructions; particularly sample05 `491.57s` and sample08 `94.39s` plus second-largest `35.35s` without interpreting any as true touchdown. The summaries are source-quality diagnostics only. No expected invalid edge/reason counts are asserted without observing CLI evidence.

Documentation-only commits after `d3b263bb` contain no research source/test/CLI edits; verify exact diff before accepting its earlier local test evidence for the newest docs HEAD. R1 is NOT DONE pending 6-file corpus and final governance reconciliation; no merge or deployment.
## 2026-10-19 — R1 native six-private-KML corpus acceptance (FINAL CURRENT STATUS)

Owner's Windows PowerShell terminal verified `git pull --ff-only` from `d3b263bb` to docs-only `996abffa`, then `git rev-parse --short HEAD` printed `996abffa`. The same six ordered private KML originals were processed locally with `tooling/gps-v2-d43-r1-coverage.mjs`, with stable anonymous IDs sample03..08. The loop completed with no nonzero exit or missing source and every response status was `SOURCE_COVERAGE_DIAGNOSTIC_ONLY`.

| Sample | Status | gx source blocks | Canonical fixes | D4.1 provenance blocked edges | Invalid V2 time edges | Median positive within-block interval (s) | Max within-block (s) | Second longest (s) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sample03 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 2 | 948 | 1 | 0 | 2.010 | 20.17 | 19.93 |
| sample04 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 2 | 587 | 1 | 1 | 1.600 | 20.84 | 17.41 |
| sample05 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 3 | 893 | 2 | 2 | 2.685 | 491.57 | 50.17 |
| sample06 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 2 | 74 | 1 | 1 | 2.795 | 50.09 | 46.32 |
| sample07 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 2 | 593 | 1 | 0 | 2.510 | 53.06 | 19.64 |
| sample08 | SOURCE_COVERAGE_DIAGNOSTIC_ONLY | 2 | 1034 | 1 | 1 | 4.390 | 94.39 | 35.35 |

**Reconciled acceptance:** All six source block and canonical-fix counts agree with D4.1, all medians/maxima/second-longest within-provenance intervals agree with separate independent offline source inspection, including two distinct sample08 within-block intervals 94.39s and 35.35s. The new R1 output establishes source timing/coverage diagnostics ONLY, not continuous aircraft motion, source altitude validity, landings or observed T&G absence.

**Interpretation of InvalidTime:** the code counts every adjacent canonical fix edge with invalid, nonpositive or >=60s V2 time delta, independently of D4.1 provenance blocking; an edge may carry *both* `SOURCE_BLOCK_BOUNDARY` and `V2_TIME_EDGE_INVALID`. The 0/1/2/1/0/1 aggregate across the six files does NOT establish five telemetry outages *inside* source blocks, and does NOT count physical maneuvers. The 7 provenance blocked edges are a separate dimension; overlap must not be double-counted as events. The printed summary lacks per-edge reason associations, so their exact overlap with time-invalid reasons cannot be inferred from this table alone.

**Verification ledger and decision:** New R1 research/source/test code exact HEAD `d3b263bb` already passed owner-local Node v24.19.0 **107/107 targeted tests**, including all 24 R1 cases, plus `npm run typecheck` PASS. Owner-local R1 native six-KML CLI on `996abffa` (only documentation changed since code HEAD) passed 6/6 and numerically agrees with independent source reconstruction. Therefore **CLOSE D4.3-R1 as a bounded engineering research-only milestone**, without declaring runtime production source eligibility, contact-recognition suitability, regulatory recency or approval. No new numerical threshold invented, no source/production `lib/`, UI, DB, flight, recency, legacy or feature flag modification, no merge/deploy. Full suite/build/browser/CI/prod smoke NOT RUN; DB migration N/A.

**Next potential research work (NOT APPROVED FOR CODING by R1 authorization):** D4.3-R2 altitude-shape / source-height quality DESIGN review, D4.3-R3 independently corroborated labels. Require explicit owner decision and independent source/applicability review before new detector rules. Keep multi-gx production V2 UNSUPPORTED_SOURCE, Pilot Review HIDDEN, experimental flag OFF.

Historical 'pending' statuses and commands above are retained as previous-stage evidence and are superseded by this section and the updated top-level state.
