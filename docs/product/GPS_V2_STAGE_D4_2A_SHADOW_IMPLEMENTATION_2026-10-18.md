# FlyTally GPS V2 — Stage D4.2A research shadow implementation

**Date:** 2026-10-18. **Current status: OWNER-LOCAL NODE24 TARGETED TESTS 83/83 PASS + TYPECHECK PASS ON `83635bc4`; SIX-KML D4.2A SHADOW CORPUS NOT RUN; MILESTONE NOT DONE / NOT SHIPPED.**
**Approval:** Product owner explicitly approved D4.2A Option A as an isolated research-only shadow consumer after the independent DeepSeek review.
**Repo:** flytally-logbook, branch research/gps-v2-stage-d-comparator-20261018, PR #366 Draft (parent PR #364 Draft). No flytally-training changes.

## Implemented surface — frozen boundaries

1. research/gps-detection-r21/stage-d42-shadow.ts — independent research mirror of the horizontal V2 candidate algorithm, pinned to GPS_V2_HORIZONTAL_V3. It uses D4.1 source-to-canonical proof (GPS_D4_MULTI_GX_SIDECAR_V1), retains manual split cuts independently of source blocks and masks hard source boundary / collision / altitude-conflict edges before making velocity islands. No production V2 module refactor or extension.
2. tests/gps-v2-d42-shadow.test.ts — 20 AUTHORED D42 tests (not executed), including clean one-block differential equivalence vs actual production V2, 4.9s across-block and one-block controls, 35s/94s gap, duplication/collision, split/stale binding, security, low-pass and deterministic 36-case synthetic differential fuzz.
3. tooling/gps-v2-d42-shadow.mjs — local read-only KML CLI outputs only anonymous source ID, block/point counts, source-aware vs hypothetical baseline candidate counts grouped by type, inconclusive candidate counts and aggregate source cadence. Original raw KML/UTC, GPS coordinates, registration, altitude, filenames, local paths and input fingerprint are NEVER printed.
4. No files under production lib/, app/, components/ or DB have been modified. Existing legacy T&G rules, physical landing count, Pilot Review HIDDEN policy, experimental flag OFF, and native multi-block V2 UNAVAILABLE/UNSUPPORTED_SOURCE remain unchanged.

## Recognition and evidence semantics

The hypothetical baseline mirrors frozen V2 horizontal edge/candidate calculations WITHOUT the D4.1 source hard-edge masking. It is a research comparator only; for multiple gx:Track blocks, this hypothetical baseline is NOT native production V2 (which still says source unsupported).

The source-aware shadow uses D4.1 blocked edges, expands height-conflict quarantine to match the native V2 surrounding-edge rejection, and retains the same <=20 km/h slow, >=45 km/h fast, >=5s slow duration, <=120s context, <60s edge, <=900 km/h plausibility logic. Those values are PINNED FROM THE EXISTING V2 and were not tuned to pilot KMLs. A 4.9s block boundary stays blocked despite passing the time-edge validity rule.

A low-speed STOP_GO candidate depending on just one averaged low-speed edge (including a 35s edge) is labeled INCONCLUSIVE / UNOBSERVED_CONTINUITY. This is a research-only evidence disposition, not a new universal time threshold or negative landing label. All other results remain RESEARCH_HYPOTHESIS and never carry contact authority. A source gap with no observations can never be interpreted as an actual T&G, negative, or zero movement.

D4.1 unblockedSourceRuns are provenance runs, not established continuous motion or independent flight records. The shadow reports source median/maximum observed interval and edges exceeding the EXISTING V2 60s edge ceiling; no new gap threshold is authorized. Manual flight splits and source segments remain independent.

Local SHA-256 binding covers exact source text, optional split cuts and upload/split revision, shadow revision, source revision and pinned V2 algorithm revision; a mismatch fails as STALE_CONTEXT. The binding proves local equality only and is not printed, persisted or authenticated device evidence.

All results enforce physicalContact=UNRESOLVED, actualLandings=UNAVAILABLE and canAffectCanonicalFlight=false. No timestamp, flight registration, raw source or location passes through diagnostic output. There is no automatic counting, splitting, recency, logs, DB or external communication.

## Test acceptance — NOT RUN

| Case | Contract |
| --- | --- |
| D42-01 | Exact kind/index/split/UTC differential on clean single-block source |
| D42-02 | 4.9s block boundary prohibits bridging; single-block pattern control |
| D42-03 | Three blocks with singleton or empty malformed middle |
| D42-04 | Collapsed cross-block duplicate boundary quarantine |
| D42-05 | Source height conflict: canonical parity and research quarantine |
| D42-06 | Distinct submillisecond UTC same JS-ms collision neighborhood |
| D42-07 | 35s averaged slow edge: baseline possible, research disposition inconclusive |
| D42-08 | Existing >=60s rule already blocks 94s gap |
| D42-09 | Low pass/taxi never acquires actual landing authority |
| D42-10 | In-span source-altitude anomaly cannot assert ground contact or relax legacy rule |
| D42-11 | Independent manual split and source boundary, edited source stale |
| D42-12 | Serialized output privacy, no raw UTC/geo/registration |
| D42-13 | Native V2 still UNSUPPORTED_SOURCE for multiple gx:Track |
| D42-14 | 36 deterministic seeded one-block cases, exact V2 event identity parity |
| D42-15 | Cadence sensitivity is descriptive, no new fixed gap cutoff |
| D42-16 | Uniform sparse sampling is not proven continuity |
| D42-17 | Parsed zero suggestions distinct from source UNAVAILABLE and actual contact |
| D42-18 | Malformed or oversized source explicit UNAVAILABLE |
| D42-19 | Binding invalidates when input/split/upload revision changes |
| D42-20 | No research network/storage operations |

These tests were AUTHORED but have NOT been run on the target Node24 checkout. Do not claim PASS, CI, merge or release until owner-local evidence exists.

## Immediate owner-local gate (Node.js 24, PowerShell, local Logbook)

Run and send the command output:

    git fetch origin
    git switch research/gps-v2-stage-d-comparator-20261018
    git pull --ff-only
    git rev-parse --short HEAD
    node -v
    npm run test:target -- tests/gps-v2-d42-shadow.test.ts tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
    npm run typecheck

Expected total authored targeted tests: prior 63 + new 20 = 83. PASS is unverified until executed.

**If and only if the above passes:** run the six owner-local KMLs with the privacy-safe CLI. Original KML remains in Downloads.

    $base = Join-Path $env:USERPROFILE 'Downloads'
    $names = @(
      'OK-BID-track-EGM96.kml',
      'OK-BID-track-EGM96 (1).kml',
      'OK-BID-track-EGM96 (2).kml',
      'OK-BID-track-EGM96 (3).kml',
      'OK-BID-track-EGM96 (4).kml',
      'OK-BID-track-EGM96 (5).kml'
    )
    $rows = @()
    for($i=0;$i -lt $names.Length;$i++){
      $file=Join-Path $base $names[$i]
      if(!(Test-Path -LiteralPath $file)){throw "Missing anonymous sample $i"}
      $id='sample{0:D2}' -f ($i+3)
      $json = & node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d42-shadow.mjs --file $file --id $id | Out-String
      if($LASTEXITCODE -ne 0){Write-Host $json;throw "D42 failed $id"}
      $r=$json | ConvertFrom-Json
      $rows += [PSCustomObject]@{
        Sample=$r.sample; Status=$r.status; Blocks=$r.sourceBlocks
        BaseStopGo=$r.hypotheticalBaseByKind.STOP_GO_REVIEW_POINT
        ShadowStopGo=$r.researchCandidatesByKind.STOP_GO_REVIEW_POINT
        Suppressed=$r.suppressedByBoundaryByKind.STOP_GO_REVIEW_POINT
        Inconclusive=$r.inconclusiveCount
        MedianSec=$r.cadence.medianSeconds
        MaxSec=$r.cadence.maxSeconds
      }
    }
    $rows | Format-Table -AutoSize

Expected SOURCE shapes ONLY: six research diagnostic outputs with blocks 2/2/3/2/2/2 and canonical fixes 948/587/893/74/593/1034 as previously established. D4.2A event counts are NOT KNOWN and must not be inferred from 21 legacy T&G hypotheses. Six private GPS files, routes and full UTCs never enter Git.

## Verification and closing ledger

- D4.1: previously 63/63 targeted and TypeScript PASS exact owner-local 3fc3cd11; six KML canonical sidecar PASS on later docs-only 815c2693.
- D4.2A: code/test/CLI staged on current research branch. **Native tests, typecheck and private corpus NOT RUN** at current new code HEAD.
- Full suite/build/Playwright/CI/production smoke NOT RUN; database/migrations N/A, merge/deploy NOT RUN, feature OFF.
- D4.2A NOT DONE until exact-head test/typecheck, owner-local six source evidence, independent interpretation and governance reconciliation; D4.2B/production integration NOT authorized.


## 2026-10-18 — First native D4.2A verification (OWNER-LOCAL EVIDENCE)

The product owner supplied the Windows PowerShell output from the checked-out research branch. `git fetch origin`, `git pull --ff-only` and `git rev-parse --short HEAD` verified **`83635bc4`**. `node -v` reported **v24.19.0**.

**Exact command:** `npm run test:target -- tests/gps-v2-d42-shadow.test.ts tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts`.

**Observed result:** **83 tests / 83 PASS / 0 FAIL / 0 skipped**, including all 20 D42 tests. In particular D42-14's 36 deterministic seeded one-block differential cases passed against the existing `GPS_V2_HORIZONTAL_V3` function, and D42-02, -04, -05, -06, -07, -08, -11, -13 covered synthetic source-boundary, duplicate, conflict, UTC-collision, 35s and 94s cases, split independence and native multi-block unsupported behavior.

`npm run typecheck` (`tsc --noEmit`) finished without diagnostic output: **PASS**.

**Evidence scope:** these are owner-local targeted checks on exact source/test SHA `83635bc4`, **not CI**, full suite, browser, production runtime or actual-contact validation. No 6-file **D4.2A** shadow-CLI run was in this supplied transcript. Earlier 6/6 D4.1 source-lineage results DO NOT qualify as D4.2A recognition evidence. The new documentation-only commits after `83635bc4` are not separately tested, but code remains unchanged as proved by GitHub diff.

**Remaining gate for D4.2A:** run the documented privacy-bounded `tooling/gps-v2-d42-shadow.mjs` on all six original local KMLs; inspect anonymized counts of hypothetical baseline and source-aware horizontal review points, boundary suppression and inconclusive coverage dispositions. No STOP_GO number is assumed and no legacy 21 proposal count is treated as true touchdown count.

**Status:** D4.2A is **SYNTHETICALLY VERIFIED / CORPUS ACCEPTANCE PENDING**; not complete, not merged/deployed. `lib/`, legacy movement/landing counts, DB/schema, feature OFF and Pilot Review HIDDEN remain unaffected. Full tests/build/Playwright/CI and production smoke NOT RUN; DB/migration N/A.
