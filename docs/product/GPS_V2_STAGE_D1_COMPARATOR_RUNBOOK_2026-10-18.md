# GPS Detection 2.0 — Stage D1 offline benchmark runbook

**Status: experimental research; owner-local targeted 39/39 and TypeScript PASS; real KML/ADS-B corpus NOT RUN.**
**Branch:** research/gps-v2-stage-d-comparator-20261018 (based on the Stage D PR #364 head).
**Scope:** FlyTally Logbook only. The Training repository is excluded.

## Purpose and trust boundary

This research CLI compares the current **legacy** touchAndGoEvents() proposals
with the separately staged **GPS V2 horizontal-only** inspectGpsV2HorizontalTrack()
review points using exactly the same local, user-selected KML, GPX or CSV source.

- Neither detector proves wheels-on-runway, true touchdown, low pass, or logbook movement count.
- A V2 empty review-point list is **zero qualifying V2 proposals**, **not** zero actual T&Gs.
- A V2 UNAVAILABLE result is **missing usable evidence**, **not** zero proposals.
- Legacy confidence values are not pilot-verified truth.
- The tool reads only an explicitly provided local file and outputs JSON to stdout. No HTTP, DB, server API, logbook write, saved-track extraction, flight certification or browser flag.
- No raw coordinates, absolute timestamps, registration, original file name, file path, flight/user ID or original bytes are returned.
- A relative-time/sample-count summary is still potentially correlatable data. Keep reports private unless reviewed and approved for sharing. Never commit personal GPS tracks or identifying metadata.

## Usage (owner-local, Node 24)

From the FlyTally Logbook repository on the research branch:

    git fetch origin
    git switch research/gps-v2-stage-d-comparator-20261018
    git pull --ff-only

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-compare.mjs --file "C:\Users\filip\Downloads\example.kml" --id sample01

Optional manual split boundaries use canonical normalized point indices:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-compare.mjs --file "C:\Users\filip\Downloads\example.kml" --id sample02 --cuts 200,450

Pipe stdout to a **local private** JSON only if needed, and never commit the source/report.
Source limit 2 MB (2,000,000 bytes); supported extensions KML, GPX and CSV only.
ADS-B Exchange's raw JSON is **not** KML and currently needs a separately reviewed
source-preserving adapter. Do not rename JSON to .kml to bypass format validation.

### What to inspect in the output

1. DIAGNOSTIC_ONLY means the comparison executed, not that any detector is accurate.
2. summary shows normalized fixes, valid time fixes and elapsed time. It does **not** verify completeness or sampling/sensor accuracy.
3. legacy.parts[].reviewPoints lists legacy signal/confidence and offsets relative to first valid source timestamp; no authenticated touchdown.
4. v2.status and v2.reason state whether source was compatible; v2.reviewPoints=null means unavailable, [] means no horizontal hypotheses. V2 kinds are DEPARTURE_REVIEW_POINT, ARRIVAL_REVIEW_POINT and STOP_GO_REVIEW_POINT.
5. actualTouchAndGoes, actualFullStops remain UNKNOWN and groundTruthComparison stays NOT_EVALUATED until independent owner/observer ground truth is attached outside this tool.
6. physicalContact=UNRESOLVED and canAffectCanonicalFlight=false are invariant.

### Pilot labels — keep private

For each event record locally: anonymous sample ID, class (T&G, FULL_STOP,
LOW_PASS, OTHER, UNKNOWN), relative elapsed time, explicit ±uncertainty,
label source (PILOT_RECALLED, OBSERVED_VIDEO, FLIGHT_LOG etc.) and certainty.
Missing labels stay UNKNOWN; never interpret a random ADS-B arrival as a
confirmed full stop or T&G. Define matching tolerances **before** scoring,
using actual ground-truth precision. No global precision/recall is computed from
the two initial handpicked flights.

### Suggested corpus

- **Positive controls:** prior locally owned 121001.kml / 121002.kml with
  owner-confirmed approximate labels; others with known repeated T&G.
- **Negative controls:** known no-T&G normal flights, genuine observed low passes,
  taxi-only/short tracks, takeoff followed by go-around, if independently verified.
- **Adversarial/availability:** ADS-B barometric vs geometric altitude ambiguity,
  duplicate/same-millisecond fixes, gaps, abnormal position jumps, sparse samples,
  wrong extension, truncated track, multiple imported segments, unsupported source.
- Public ADS-B data without ground-truth may be used for robustness and
  disagreement **discovery**, not T&G correctness scores.

### Gate and stop conditions

1. Read the Stage D source-of-truth doc and repo current SHA before execution.
2. Run Node 24 targeted tests and typecheck on **the exact current branch head**:

       npm run test:target -- tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
       npm run typecheck
       npm run verify:plan -- --base origin/main

3. Only after tests pass, compare the two already labeled private tracks locally.
4. Record *relative-time* disagreement and source-unavailable cases, without raw routes in git.
5. Draft a diagnosis of legacy FP and V2 FN; request independent DeepSeek read-only review after hypotheses and synthetic falsification cases exist.
6. No detector threshold tuning, feature ON, merge, deploy, or D3 policy change in this batch. No claims of production validity.
7. Update ROADMAP, FEATURES and CHANGELOG with **actual**, not assumed, test/corpus results before closeout.

## Current verification ledger

- Owner-local Windows PowerShell (Node 24.19.0): targeted comparator/advisory/import-lineage tests **39/39 PASS**; `npm run typecheck` **PASS**. The shared terminal log does not include `git rev-parse HEAD`; report is grounded to an up-to-date checkout of the research branch before this documentation update, not a claimed later exact commit SHA.
- New documentation commits follow this result. Full suite, build, Playwright, verification planner: **NOT RUN**.
- Local KML, ADS-B corpus, pilot-label scoring: **NOT RUN** on this new branch.
- DB access/migration: N/A; no DB change.
- Production flag: OFF by default in PR #364, unchanged.
- Merge/deployment: NOT RUN.

The prototype is a reproducible research tool, not a released detector.
