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