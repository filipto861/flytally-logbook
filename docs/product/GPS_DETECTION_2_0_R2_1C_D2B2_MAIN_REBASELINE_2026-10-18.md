# GPS Detection 2.0 — D2-B2 lineage rebaseline onto merged main

**Date:** 2026-10-18
**Repository:** `filipto861/flytally-logbook`
**Branch:** `test/gps-r21-d2-lineage-main-rebaseline` based on `main@83a26ca6aa28ee9af378900557ef17f68f09d8ac`
**Status:** RESEARCH-ONLY IMPLEMENTED IN TOPIC BRANCH; new exact-head targeted Node, TypeScript, planner/full acceptance **NOT RUN**. No merge/deploy/DB.

## Purpose and evidence already held

PR #360 merged the production D2-C.1 CSV missing-data and real-zero corrections as `beef98053e141f99fd7844fb7c02702b43107fda`; owner-local candidate `ee585f0d97c23f9b355aae3c362685b60ed8c0c2e5fc92d12963213f971fa31f` had canonical `release_status=PASS` (1650/1650 Node, 163/163 native isolated PostgreSQL, 24/24 browser, source/domain/build/typecheck). Documentation closeout PR #361 merged as `83a26ca6aa28ee9af378900557ef17f68f09d8ac`. **Those results do NOT assert a new test run on this topic branch.**

Old experimental PR #350 (`test/gps-detection-r21-falsification`) is Draft/stale and includes three `KNOWN UNSAFE` characterization expectations matching pre-D2-C CSV defects. DO NOT wholesale merge/rebase #350 or silently preserve those obsolete assertions.

## Changes / minimal scope

- Copied `research/gps-detection-r21/csv-lineage.ts` byte-identically from the **previously owner-tested research executable** `25d0efdb9b46cf096b01f7191ed645d7a09d620b` (source blob `c501cad704981cdc1e19f892dc4e605c4daf1105`).
- Copied the exact original 10-case research test `tests/gps-detection-r21-d2b2-csv-lineage.test.ts` from the same old tested SHA (source blob `c6d02386e1379e74fd66b3c12aa4280699989752`). Historical old source 130/130 targeted Node and TypeScript PASS are evidence for the original SHA only.
- Added `tests/gps-r21-d2c-main-lineage-bridge.test.ts` (3 new cases) comparing the **merged** current canonical `lib/track-processing.ts::parseTrackFile` against the strict diagnostic parser for blank vs real zero, invalid coordinates and feet conversion without source/landing authority.
- **No `app/`, `components/`, production `lib/` changes, no GPS algorithm threshold or regulatory/certification edits.** No RLS, route read, personal GPS, migration, server action or feature toggle change.

The deliberately narrow research subset accepts **only** unquoted `lat,lon,altitudeM,time` or `lat,lon,altitudeFt,time` CSV with exact explicit UTC second timestamps and source-line mapping. Other valid production KML/GPX/CSV dialects are not silently rejected in the existing app. Research output is **SOURCE_PARSED_DIAGNOSTIC_ONLY**, not trusted altitude mode/datum/accuracy, runway contact or approval. `pilot.status=UNAVAILABLE`, `physicalContact=UNRESOLVED`, `wholeFlightLandings=UNAVAILABLE`, `canAffectCanonicalFlight=false`.

## Acceptance and next

1. Owner-local clean exact branch HEAD and `npm run test:target -- tests/gps-detection-r21-d2b2-csv-lineage.test.ts tests/gps-r21-d2c-main-lineage-bridge.test.ts tests/track-processing.test.ts`; capture actual TAP rather than invent 13 + existing results.
2. `npm run typecheck` and `npm run verify:plan -- --base origin/main`; inspect required source/domain/full evidence and run the appropriate gate. Use no PostgreSQL/bootstrap unless a verified plan actually requires it.
3. Code review that pure offline subset was faithfully carried, and no production import or privacy/write authority is introduced. Reconcile any failure before merge.
4. **After** this research-only source gate: next approved analytical milestone is D3 **pure offline advisory DTO** with source/split/algorithm invalidation and strict no-flight-count/certification fields. Pilot-facing altitude/vertical motion remains hidden unless separate trusted sensor/unit/mode/datum provenance is proven. **P0-D3 native RLS/consent/strict no-write** must be independently verified before any saved-flight/private-owner GPS read. The owner-frozen D1–D5 prohibit new standalone workflow, automatic count changes, durable note persistence, and post-flight saved-track review in initial release.

**Not done:** GPS Detection 2.0 live UI, detector integration, real-source vertical eligibility, final private GPS security authorization, production rollout. Keep the release timeline honest; a clean research baseline enables but does not equal the first production GPS 2.0.
