# FlyTally Logbook — GPS Detection 2.0 expedited release track

**Date:** 2026-10-18
**Owner request:** expedite release of the actual improved GPS detection. User-facing behavior over further isolated research.
**Repo:** `filipto861/flytally-logbook`
**Branch:** `feat/gps-v2-release-critical-engine`, from merged D3 `main@0fb33a88eb1335d712073f2a76238b52fb641e2a`.
**State:** FIRST FUNCTIONAL PREVIEW IMPLEMENTED IN TOPIC BRANCH; **ALL NEW TESTS/TYPECHECK/BUILD/BROWSER/DB NOT RUN** until owner executes. Default flag OFF. No PR merge, production deploy or release approval.

## What has actually been implemented (bounded first vertical slice)

- `lib/gps-v2-source-lineage.ts`: isolated strict in-memory source/text parser, ported from exact owner-tested D2-B2 research `research/gps-detection-r21/csv-lineage.ts`. Preserves original-to-normalized index mapping, explicit valid UTC times, strict positions, optional alt missing vs numeric zero, header-declared feet→metres. Source header does not authenticate device altitude accuracy, datum or units.
- `lib/gps-v2-advisory.ts`: pure read-only horizontal pattern analysis. Requires exact equality between original strict CSV parser output and production `parseTrackFile` normalized coordinates, time and alt; strict ascending split boundaries; invalid/gap/teleport legs break evidence; proposes only bounded `DEPARTURE_REVIEW_POINT`, `ARRIVAL_REVIEW_POINT`, `STOP_GO_REVIEW_POINT` inside contiguous valid islands. No altitude-derived proposals, physical contact determination, count suggestion, regulatory/certification writes or landing total. Heuristics 20/45 km/h, 5 s dwell, 60 s inter-sample and 900 km/h corruption bound are *experimental detection filters*, not aircraft limitations or approved performance thresholds.
- `components/kml-import-form.tsx`: client-only analysis of newly uploaded raw source text, within the **existing** `Review GPS track` disclosure; in-memory ephemeral V2 panel; candidate notes default **unresolved**. No new submitted FormData, count prefill, no DB API, no per-event retained note. `NEXT_PUBLIC_FLYTALLY_GPS_V2_ADVISORY=1` is the **only build-time ON**, missing => OFF preserving legacy. V2 shows explicit unverified sensor/source limitation and never claims touch-and-go contact. Split and new file cause pure recomputation, no stale notes retained. New V2 event cards do not reuse existing legacy marker kinds.
- `app/v142-gps-import.css`: V2-only responsive preview styles without modifying existing GPS player/legacy marker styles.
- `tests/gps-v2-advisory.test.ts`: 10 new fail-closed/source/split/false-positive tests; `tests/gps-v2-ui-contract.test.ts`: 4 new first-party source-contract parity/flag/no-write tests.

## Release-realism and blocking scope

1. **Supported V2 input is only strict four-column in-memory CSV** (`lat,lon,altitudeM,time` or `lat,lon,altitudeFt,time`, strict UTC second timestamps). Existing KML/GPX/SkyDemon CSV legacy importer stays functional but V2 panel reports `UNAVAILABLE` until independent exact normalization/lineage evidence for those formats. THIS IS A MATERIAL INITIAL COVERAGE LIMITATION, NOT YET RELEASE QUALITY FOR THE COMPLETE REQUEST.
2. Raw-file syntax and transformation are not independent sensor accuracy or true wheel contact. Horizontal speed dip could mean taxi, low approach, position artefact. No V2 label can certify takeoff, landing or T&G. Existing reviewed values remain pilot authoritative; existing v1 suggestions continue unchanged while this flag is off or on.
3. Current V2 review points have UTC time and split index, but no clickable map/profile placement. A pilot-facing release must test usable field behavior and address this carefully (avoid unproven indexed-to-decimated-track identity).
4. **Fast next engineering steps after targeted tests:** source lineage support for real KML/GPX/SkyDemon samples; horizontal pattern false-positive/false-negative fixture matrix incl. real-derived observed shapes; meaningful chart interaction and pilot-proposed corrections without automatic counts; Playwright desktop/iPad/mobile/light/dark and default flag OFF-on acceptance; performance and source/certification boundary.
5. **Only after source and UX readiness:** canonical `verify:plan -- --base origin/main` then every declared gate, production candidate build (including flag OFF and controlled flag ON), explicit product-owner feature/release approval and manual production deployment. DB migrations absent in current diff, but if planner selects PG/browser use isolated **owned disposable localhost** clusters; never production/Neon smoke reset. CI unavailable may be substituted by observed owner-local evidence, labeled as such.

## Explicit release acceptance (not achieved)

- No duplicate/time discontinuity or inferred zero; no proposed stop-go across disconnected islands or split boundaries; low pass not marked as stop-go; no false positive caused by a position teleport.
- V2 suggestions visibly distinct from v1 legacy and not stored/serialized; default OFF identity confirmed at runtime. Manual landing/day-night/PF input remains unchanged across file, split, review and submission.
- Realistic pilot sample sources (original bytes) and comparison against known real T&G/low passes with empirical FP/FN classification; no fake confidence labels.
- Actual browser/iPad/mobile/night focus and layout, save/certification unaffected, clean fail-closed states; typecheck/test/build and risk-candidate release PASS.
- Security: no new server path or private saved GPS read; P0-D3 native RLS gate still blocks postflight user-track analysis.
- No production deploy or flag enablement without separate owner approval.

**Immediate next:** owner-local targeted Node + TypeScript + planner on exact new topic HEAD, fix failures, then prioritize actual common GPS source coverage and pilot UX (not another generic research phase). No claim that this is already released.
