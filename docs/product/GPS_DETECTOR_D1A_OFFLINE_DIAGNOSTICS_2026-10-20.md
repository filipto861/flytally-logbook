# GPS detector accuracy D1-A — frozen legacy altitude decision diagnostics

Date: 2026-10-20. Repo: filipto861/flytally-logbook.
Branch: research/gps-detector-accuracy-d1a-20261020 (based on canonical main, not P1B).
Planning PR: #374. Status: RESEARCH IMPLEMENTATION STAGED — ALL NEW TESTS NOT RUN.
Owner expressly waived a second-AI review for this initial research-only batch.

## Purpose
Improve T&G detection by discovering precise missed/rejected shapes before algorithm changes. No new warning card, UI, suggested count or saved record changes.

## Implementation
- research/gps-detector-accuracy/d1-altitude-diagnostics.ts: read-only rolling-altitude first-failing-gate mirror pinned to production track-processing.ts Git blob ff24b79c1e65ae911c0703ec8b750eb0d488b4d3.
- Frozen predicates: five-index speed median (including invalid time => 0), 28–145 km/h, ±10 index side windows, ±2 local minimum, 30m before/after evidence, intermediate timed climb, >25m/s within accepted evidence span.
- Orthogonal bad timestamp / >15s unobserved window flags do NOT override existing detector or infer touchdown.
- Candidate outcome counts are NOT event counts: production touchAndGoEvents() remains the exclusive source of legacy accepted counts.
- tooling/gps-d1-local-altitude-summary.mjs: local-only KML/GPX/CSV analysis, aggregate redacted output, no raw source/path/time/coordinate/registration printed and no network, database or file writes.
- tests/gps-d1-altitude-diagnostics.test.ts: source Git blob drift guard, +11 missed climb, clean positive, low-pass, corrupt jump, invalid time, gap, no-data, parity and privacy cases.

## Known limits and explicit refusals
- Only altitude admission diagnosis is implemented. The speed-event admission, <8-index altitude grouping and <=10-index speed-altitude dedup rejection explanations are deferred to D1-B.
- NOT_ATTESTED source and UNRESOLVED wheel contact at all times. Source gap and altitude discontinuity are NOT landings.
- Private owner KML must stay only on owner's PC. No raw KML, exact UTC, GPS, registrations, track identities or per-candidate indices in GitHub reports.
- Multi-gx block parsing via current legacy parser does not establish actual physical continuity or native V2 source eligibility.
- Existing legacy 25m/s discontinuity guard and prior 3.5.1 false-positive protections stay unchanged.
- Explicitly no modifications to lib/, app/, components/, saved flight, certification, recency, DB, production flags, branch main, Vercel or flytally-training.

## Owner verification (Node 24; required before accepting any PASS)

Run on Windows owner checkout after stopping disposable P1B server and confirming its owned-cluster cleanup:

    git fetch origin
    git switch --track origin/research/gps-detector-accuracy-d1a-20261020
    git status --short
    git rev-parse --short HEAD
    npm run test:target -- tests/gps-d1-altitude-diagnostics.test.ts
    npm run test:target -- tests/v351-gps-tg-reliability.test.ts tests/track-processing.test.ts
    npm run typecheck

Optional owner-private local report (substitute a real private local path; NEVER commit source):

    node tooling/gps-d1-local-altitude-summary.mjs "C:\private\flight.kml"

Copy ONLY the aggregate JSON output into discussion. Do not interpret candidate reasons as known physical landings. Do not fill landingCount from D1.
After exact-head local verification, select next D1-B diagnostic scope, then frozen D2 design/testing; no prototype runtime event write.

## Evidence and closeout
Authored and committed: module, tests, local CLI, runbook and roadmap/feature/changelog changes.
Targeted tests/TypeScript: NOT RUN at authorship. Build/browser/CI: NOT RUN/N/A for this bounded research-only scope.
DB/migration/deploy/production smoke: NOT RUN. No confirmed new detection accuracy improvement.
Second AI review: WAIVED by owner for this bounded read-only implementation, not falsely recorded as performed.
## 2026-10-20 owner-local first run and Windows portability correction

- Owner Windows test run of initial D1-A targeted suite: **9 PASS / 1 FAIL** (10 total); failure was the frozen source Git-blob identity test. Local TypeScript `npm run typecheck`: **PASS**. Neither build nor full/legacy suite shown.
- GitHub source blob for `lib/track-processing.ts` on research branch verified as `ff24b79c1e65ae911c0703ec8b750eb0d488b4d3`; the initial test hashed checkout bytes, which differ on Windows when LF is checked out as CRLF. **Test-only** correction canonicalizes CRLF to LF before the Git blob calculation and adds an adversarial equivalence/drift test. The pinned blob still rejects substantive source changes.
- Corrected HEAD test execution **NOT RUN** yet; rerun targeted test (now 11 cases expected) plus targeted legacy regressions and TypeScript after fetching. The unrelated generated `next-env.d.ts` worktree modification must be inspected, not silently discarded.

## 2026-10-20 owner-local verified D1-A test gates (exact executable HEAD)

Owner confirmed `git pull --ff-only` to `c46b5441` and ran corrected targeted D1 suite **11/11 PASS**, existing track + 3.5.1 GPS regressions **34/34 PASS**, and `npm run typecheck` **PASS**. This is **45/45 local Node PASS and local TypeScript PASS**, not CI. Frozen production source blob identity test now PASS on Windows; no runtime modification. Native local aggregate CLI on six private KML files remains **NOT RUN**. Full app release risk gate, build, browser, DB and production deploy **NOT RUN / N/A** for bounded research-only source. Subsequent doc commits do not alter the executed source, but are not independently retested. No contact truth established or detector accuracy improvement claimed.

## 2026-10-20 owner-private sample07 aggregate observation (D1-A; LOCAL ONLY)

Owner executed local CLI on sample07; no route was sent. Output: 593 recorded canonical legacy points, 6 accepted production legacy T&G (0 speed, 6 altitude), 144 sampled altitude local minima. First-failure outcomes across those *points*: 107 speed outside legacy range, 12 no >=30m descent, 3 no >=30m climb, 2 in-evidence-span height discontinuity, and 20 altitude shape admissible. Source-time observations: 0 sampled-minimum scan windows with invalid time edge and 54 scan windows overlapping >15s unobserved interval. These are **overlapping sampled-point/windows counts**, not 54 separate GPS gaps; 20 accepted candidate points are not 20 events; two rejected candidate points do not prove two missed landings. Prior D4.3-R2-2 evidence attributed two overlap windows to ONE bad source edge; this fresh anonymous summary neither corroborates physical contact nor links windows to a particular maneuver. Contact remains UNRESOLVED / owner report REPORTED_CONTACT_UNCORROBORATED. Node MODULE_TYPELESS_PACKAGE_JSON warning was nonfatal and unrelated to GPS validity.

Next D1-B milestone: explain raw altitude candidate 20 -> six deduplicated legacy events, separately diagnose speed/ground admission, require strict event-level parity against unmodified touchAndGoEvents(), and output only aggregate counts (no index/UTC/route). Do NOT tune thresholds or promote rejected source geometry to real touchdown.

## D1-B staged 2026-10-20 — grouping and speed admission, still research-only

New code at `research/gps-detector-accuracy/d1-legacy-admission-diagnostics.ts` shadows only frozen `groundEvents()` speed admission, `altitudeTouchAndGoIndices()` <8-index altitude grouping and `touchAndGoEvents()` <=10-index speed/altitude overlap suppression. It runs D1-A frozen per-index gate predicates to gather raw altitude candidates. **No outcome is published unless the complete reconstructed ordered event list matches production touchAndGoEvents() exactly by index, time, signal and confidence**. On parity mismatch, empty input or >2048-point research limit it returns UNAVAILABLE with no accepted movement count, and the CLI refuses to output a misleading partial report.

Revised owner-local CLI appends a top-level `admission` aggregate object to the previous D1-A output. Key fields: rawAltitudeAdmissiblePoints, altitudeGroupedEvents, altitudeGroupingSuppressedPoints, altitudeSuppressedBySpeedOverlap, speedGroundEvents, speedDurationRejected, speedDirectMotionRejected, speedAltitudeRangeRejected, speedAdmitted, legacyEventCount. These are candidate/window counts **not physical contacts**. No private route/timestamps/indexes/filenames in report. >2048-point records fail closed for bounded research implementation cost, not as an aircraft/GPS validity rule.

New tests: `tests/gps-d1-admission-diagnostics.test.ts` (8 authored, **NOT RUN**) compare exact event parity on five rolling T&G synthetic events, genuine stop/go, known +11 false negative, high-speed low pass, duplicate timestamps, time gap, invalid/oversized input and redacted output. Previously observed D1-A 45/45 local PASS is on code HEAD `c46b5441`; it is **not** evidence that new D1-B code passed.

Verify after fetch on owner PC:

    git pull --ff-only
    git rev-parse --short HEAD
    npm run test:target -- tests/gps-d1-admission-diagnostics.test.ts
    npm run typecheck

If both PASS, rerun owner-local sample07 using unchanged CLI filename and share only aggregate JSON; expect production legacyEventCount=6 if same source/splits, but **do not predict grouping/suppression values**. Any parity mismatch is a blocker requiring research investigation, not a reason to weaken legacy guards.

No production detector/save/auth/recency/DB/UI changed. No merge/deploy or new T&G accuracy achieved.

## 2026-10-20 owner-local D1-B acceptance + sample07 complete parity

At Windows research code HEAD `93b05c3c`, the new D1-B targeted Node suite passed **8/8**, local `npm run typecheck` **PASS**. The sample07 local KML CLI completed successfully and returned admission status `PARITY_MATCHED`; `legacyEventCount=6`, `legacySpeedEvents=0`, `legacyAltitudeEvents=6`, `speedGroundEvents=0`, `speedAdmitted=0`, `rawAltitudeAdmissiblePoints=20`, `altitudeGroupedEvents=6`, `altitudeGroupingSuppressedPoints=14`, `altitudeSuppressedBySpeedOverlap=0`, `recomputedLegacyCount=6`. Earlier D1-A aggregate on same file showed `DISCONTINUITY_IN_EVIDENCE_SPAN=2` rejected sample indices. Interpret all these as **GPS sample/index/shape diagnostics**, not actual maneuvers or confirmed wheel contact. A single source bad edge can affect multiple overlapping windows. Current record is one of six original KML sources; other five D1-B local aggregates are **NOT RUN**. Source attributes/movement identity not attested. Prior 45/45 D1-A and legacy tests PASS on source HEAD `c46b5441`; do not re-attribute them to later new D1-B HEAD. D1-B new 8/8 PASS at `93b05c3c` and TypeScript PASS. CI/build/browser/DB/deploy NOT RUN/N/A for offline research-only scope. Next: anonymous comparison across other five original KMLs to avoid optimizing for sample07 and then D2 safety-first pure offline algorithm.
