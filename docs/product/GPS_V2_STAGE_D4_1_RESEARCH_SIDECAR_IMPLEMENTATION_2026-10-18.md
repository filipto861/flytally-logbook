# GPS V2 — Stage D4.1 source lineage sidecar implementation evidence

**Current status (supersedes historical pending entries below): D4.1 RESEARCH-ONLY MILESTONE COMPLETE / OWNER-LOCAL VERIFIED.** Owner-local 63/63 targeted Node tests + TypeScript PASS on `3fc3cd11`; six private KMLs passed native D4.1 lineage CLI on `815c2693` (documentation-only commits since tested code). No production authority, integration, merge or deploy.


## D4.1 final acceptance — 6/6 native KML sidecar PASS (2026-10-18)

**Provenance:** Owner's local Windows PowerShell terminal log. Branch `research/gps-v2-stage-d-comparator-20261018`, `git pull --ff-only`, exact local `git rev-parse --short HEAD` **`815c2693`**. Six owner-selected original KML files run through `tooling/gps-v2-d4-lineage.mjs`. Every CLI call completed without nonzero exit or MISSING. This new HEAD differs from previously tested `3fc3cd11` only by documentation, as verified in the PR file comparison.

| Sample | Status | Blocks | Raw | Canonical | Collapsed | Conflicts | Blocked edges | Unblocked source runs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sample03 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 2 | 951 | 948 | 3 | 0 | 1 | 2 |
| sample04 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 2 | 590 | 587 | 3 | 0 | 1 | 2 |
| sample05 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 3 | 897 | 893 | 4 | 0 | 2 | 3 |
| sample06 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 2 | 77 | 74 | 3 | 0 | 1 | 2 |
| sample07 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 2 | 596 | 593 | 3 | 0 | 1 | 2 |
| sample08 | SOURCE_PARSED_DIAGNOSTIC_ONLY | 2 | 1037 | 1034 | 3 | 0 | 1 | 2 |
| **Total** | **6/6 source diagnostic only** | **13** | **4148** | **4129** | **19** | **0** | **7** | **13** |

Acceptance conclusion:
- D4.1 **research-only** source parser output is compatible with the existing canonical normalized-fix counts for all six actual owner-KMLs. All samples have the expected source block count and dedup totals; sidecar reports one blocked edge per inter-block boundary in this corpus, and no duplicate-height conflicts. This is corpus evidence for **these six sources only**, not a general formal proof of all KMLs or sensor truth.
- Tests: exact code HEAD `3fc3cd11` **63/63 targeted PASS, TypeScript PASS**, owner-local not CI. The `815c2693` later documentation HEAD tested the same implementation through six-file CLI, not an all-suite re-run. This final acceptance documentation commit follows both.
- A source run is **not** a verified timed/speed-continuous movement island. Even an uninterrupted source block may have absent telemetry. Sample08's possible unobserved maneuver in the known gaps is still `UNKNOWN/UNOBSERVABLE`, not an additional touchdown.
- The runtime `lib/gps-v2-import-lineage.ts` remains unchanged: six multi-block files still produce `UNAVAILABLE/UNSUPPORTED_SOURCE` in current production-facing V2; D4.1 sidecar does not make them V2-evaluable. Legacy T&G counts are not physical-contact truth.
- **D4.1 DONE** as narrowly approved pure research sidecar + synthetic tests + owner-local corpus validation. **D4.2 NOT IMPLEMENTED/NOT APPROVED** for detector integration; any next phase needs distinct owner decision and independent design review. Parent D3 pilot visibility HIDDEN/experimental flag OFF decisions unchanged.
- Full test suite, build, Playwright, production smoke: **NOT RUN**; DB/migration: N/A; merge/deploy: NOT RUN. No raw route, absolute UTC, coordinates, registration, or full GPS source committed.


**Status:** RESEARCH D4.1 SYNTHETIC ACCEPTANCE VERIFIED OWNER-LOCAL at `3fc3cd11`: 63/63 targeted PASS and TypeScript PASS. NATIVE SIX-KML SIDECAR CORPUS ACCEPTANCE PENDING. NOT SHIPPED.
**Approved scope:** Owner explicitly approved D4.1 research-only implementation on 2026-10-18.
**Repo:** flytally-logbook. Branch: research/gps-v2-stage-d-comparator-20261018. Research PR #366 Draft, nested under parent experimental PR #364 Draft.

## Implemented, isolated surface

1. research/gps-detection-r21/multi-gx-track-lineage.ts — pure bounded gx:Track source-to-canonical evidence sidecar. Reads only caller-provided source text, imports existing canonical parseKml (read-only), does NOT modify legacy parser or canonical flight model.
2. tests/gps-v2-d4-multi-gx-lineage.test.ts — 19 synthetic source/provenance/fail-closed test cases. Test count is authored, not yet a passing result.
3. tooling/gps-v2-d4-lineage.mjs — owner-local, read-only single-file CLI for a compact non-geographic summary. Outputs only anonymous sample ID, source block count, raw/normalized fix totals, collapsed/conflict fix counts, blocked-edge/collision-edge counts and unblocked source-run count. No source path, original filename, GPS coordinates, time, altitude or registration in stdout.
4. No changes to lib/, app/, components/, pages, DB, migrations, persistence, flight calculations, landingCount, production V2 parser/detector or experimental feature flags.

## Frozen semantics and proof obligations

- Only strict, paired, time-tagged gx:Track blocks are accepted. Every source when/coord must pair exactly; malformed/unsupported source or unstable ordering => UNAVAILABLE, never silently drop samples.
- Canonical parity is evaluated by executing actual parseKml on the same raw string and requiring every normalized lat/lon/alt/time value and count to match exactly. Supplied canonical cannot forge trust.
- Existing legacy dedup is mirrored: adjacent same-UTC/near-position fixes preserve first reading. All collapsed raw source fix references are retained in the sidecar. Conflicting source heights are quarantined, never made authoritative.
- Source block identity remains sidecar metadata, not a flight split. Edges crossing source blocks are blocked, even at 4.9 seconds. When a cross-block duplicate collapses away, both neighboring canonical edges are blocked to avoid hidden bridging.
- Same-millisecond timestamp collisions also quarantine neighboring edges. These source runs are NOT proof of temporal/sensor continuity; 35-second gaps inside a source block are not independently ruled out here. The production V2 edge-level time-gap gate is a separate D4.2 requirement. No speed or altitude calculations are performed by D4.1, and no recognizer consumes its edges yet.
- Data gaps cannot prove touchdown. This tool is about provenance and continuity only. It always returns canAffectCanonicalFlight=false, physicalContact=UNRESOLVED, actualLandings=UNAVAILABLE.
- Additional forbidden inputs: GPS fixes outside recognized gx:Track, unsupported Track dialects, oversized string (>2,000,000 characters), more than 25,000 fixes. Source modes/altitude datum/device accuracy remain unknown, even when parser equality succeeds.

## Synthetic test inventory — EXPECTED, NOT VERIFIED

D4-SOURCE-01: 4.9s block boundary; D4-SOURCE-02: 35s/94s gaps; D4-SOURCE-03: empty middle block; D4-SOURCE-04: unpaired tags; D4-SOURCE-05: in-block duplicate; D4-SOURCE-05b: boundary collapsed duplicate; D4-SOURCE-06: conflicting heights; D4-SOURCE-07: submillisecond UTC collision; D4-SOURCE-08: source order inversion; D4-SOURCE-09: missing vs measured zero altitude; D4-CONTRACT-01: forged canonical; D4-CONTRACT-02: malformed Track; D4-SOURCE-10: sparse/large/sparse block runs; D4-CONTRACT-03: output redaction; D4-CONTRACT-04: no IO/network from pure sidecar; D4-SOURCE-11: extra fix outside blocks; D4-SOURCE-12: unsupported mixed Track; D4-SOURCE-13: oversized input; D4-RELEASE-01: sidecar does not enable native V2 multi-block status or landing authority.

These tests cover **sidecar boundary data**, NOT actual downstream STOP_GO behavior. Full evidence-island propagation to V2 speed smoothing, event windows, altitude shape and manual splits is **D4.2 design**, not implemented in D4.1. Do not misrepresent blockedEdges as a production detector guard yet.

## Owner-local exact-HEAD acceptance (Node 24, PowerShell)

From the logbook repository:

    git fetch origin
    git switch research/gps-v2-stage-d-comparator-20261018
    git pull --ff-only
    git rev-parse --short HEAD
    node -v
    npm run test:target -- tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
    npm run typecheck

If the test or typecheck fails, STOP and send sanitized test output (no raw tracks).

Only if they both pass, run the local CLI on the six raw KMLs (ensure the filenames in Downloads match your real files):

    $base = Join-Path $env:USERPROFILE 'Downloads'
    $names = @(
      'OK-BID-track-EGM96.kml',
      'OK-BID-track-EGM96 (1).kml',
      'OK-BID-track-EGM96 (2).kml',
      'OK-BID-track-EGM96 (3).kml',
      'OK-BID-track-EGM96 (4).kml',
      'OK-BID-track-EGM96 (5).kml'
    )
    $results = @()
    for ($i = 0; $i -lt $names.Length; $i++) {
      $path = Join-Path $base $names[$i]
      if (-not (Test-Path -LiteralPath $path)) { throw "Missing local sample $i" }
      $id = 'sample{0:D2}' -f ($i+3)
      $json = node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-d4-lineage.mjs --file $path --id $id | Out-String
      if ($LASTEXITCODE -ne 0) { throw "Lineage unavailable for sample $id; investigate before continuing" }
      $r = $json | ConvertFrom-Json
      $results += [PSCustomObject]@{
        Sample=$r.sample; Status=$r.status; Blocks=$r.sourceBlocks
        Raw=$r.rawFixes; Canonical=$r.canonicalFixes
        Duplicates=$r.collapsedFixes; Conflicts=$r.conflictFixes
        BlockedEdges=$r.blockedEvidenceEdges; SourceRuns=$r.sourceRuns
      }
    }
    $results | Format-Table -AutoSize

Existing independent corpus expectations to check, not assume: blocks 2/2/3/2/2/2, raw fixes 951/590/897/77/596/1037, normalized fixes 948/587/893/74/593/1034. Any discrepancy is a STOP, not an instruction to change expected values to make the tests pass. New D4.1 does **not** change the native V2 result on multi-block files: the D1 comparator should still return V2 UNAVAILABLE/UNSUPPORTED_SOURCE.

Do NOT paste raw KML, private registrations or complete routes into GitHub issues. Returned anonymous aggregate summaries can still reveal characteristics; share within owner-controlled research context.

## Quality and closing ledger

- Github branch changes: new isolated research parser, synthetic tests and local research CLI only, plus required docs. No changes to production code.
- Source review: static file diff and imports checked; **runtime Node24 tests NOT RUN** by assistant environment. No CI pass claimed.
- Six new real KML: previous D4.0 Node native comparator PASS on older exact c2274ca2. **New D4.1 sidecar's six-file run NOT RUN**.
- D4.1 acceptance: **PENDING** exact-HEAD targeted PASS, TypeScript PASS and real corpus parity. D4.2 NOT STARTED.
- DB/migrations: N/A. Build/Playwright/production smoke: NOT RUN; production application unchanged in this batch.
- Merge/deploy/flag: NOT RUN/OFF. Experimental PR #364 policy conflict (pilot Review HIDDEN) remains unresolved. No certification or regulatory recency status granted.


## 2026-10-18 D4.1 first owner-local test acceptance attempt and minimal repair

- Owner's Windows local branch was `059b98a9` according to `git rev-parse --short HEAD`.
- `npm run test:target -- tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts`: **63/63 PASS, fail 0**, including all 19 new D4.1 cases. This is valid owner-local Node test evidence **only for that tested head**, not CI and not a production release check.
- `npm run typecheck`: **FAIL** with TS2367 + TS2339 at `tests/gps-v2-d4-multi-gx-lineage.test.ts:30`. Cause: the helper called `assert.equal(r.status,"SOURCE_PARSED_DIAGNOSTIC_ONLY",...)` before testing `if(r.status==="UNAVAILABLE")`, so assert's type narrowing rendered the second branch unreachable.
- Minimal research **test helper only** correction: test status `UNAVAILABLE` and throw before asserting `SOURCE_PARSED_DIAGNOSTIC_ONLY`. No runtime production or research parser implementation changed.
- New repair commit `ae7b3574`: **NOT RUN** tests/typecheck on that patched exact head. The newer documentation commits also do not inherit test evidence.
- The six-file `tooling/gps-v2-d4-lineage.mjs` sidecar acceptance remains **NOT RUN**. Earlier D4.0 native comparator on the same six KMLs is distinct and cannot substitute for D4.1.

**Next gate:** exact current branch HEAD, repeat the same 63 targeted tests plus `npm run typecheck`. If successful, run the read-only six-KML D4.1 lineage CLI from this document and compare block/raw/canonical counts. Never weaken source parity merely to make a sample pass.


## D4.1 second owner-local verification — typecheck correction confirmed (2026-10-18)

**Runtime evidence:** Owner performed `git fetch`, `git switch`, `git pull --ff-only` and `git rev-parse --short HEAD` reporting **`3fc3cd11`**. Exact research branch source for D4.1 code/test had no changes compared with the previous owner-local test, except the two-line test helper reordering committed to this head.

- Owner-local `npm run test:target -- tests/gps-v2-d4-multi-gx-lineage.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts` **63 tests / 63 PASS / 0 FAIL**, including D4.1 source & release guards.
- Owner-local `npm run typecheck` (`tsc --noEmit`) completed without errors: **PASS**.
- The earlier TS2367/TS2339 diagnostic has been fixed by placing the `UNAVAILABLE` discriminant guard **before** the success assertion; verified locally on the exact checkout. This is local evidence, **not CI**.
- The six-file native **D4.1 source-lineage CLI** on owner-private corpus is **NOT RUN** yet. D4.0 comparator native results cannot be substituted. D4.1 remains **PARTIALLY VERIFIED / NOT DONE** until sidecar corpus parity and all six source-block/provenance reports are inspected.
- New commits that modify **only these governance documents** follow the source verification. The source/test code was verified on `3fc3cd11`, but a later new-HEAD release suite, full tests/build/Playwright and actual sidecar corpus evidence have **NOT RUN**.
- No production parser, detector, UI, feature flag, database, flight data, migration, merge or deploy has changed.

**Next step:** run the existing owner-local six-file D4.1 lineage summary CLI shown in this document. Expected raw/normalized counts by sample are 951→948, 590→587, 897→893, 77→74, 596→593, 1037→1034; block counts 2/2/3/2/2/2. Do not invent expected conflict or boundary-edge counts — inspect actual output. Any `UNAVAILABLE` or mismatch should fail the corpus acceptance gate and be investigated without altering production behavior.


## Read-only independent six-KML duplicate audit — preliminary, not Node sidecar acceptance

In an assistant-local independent parser inspection of the six owner-uploaded KML files, indexed by private anonymous sample IDs:

| Sample | Blocks | Paired raw fixes | Legacy-shaped dedup fixes | Adjacent collapsed duplicates | Conflicting duplicate altitudes | Cross-block collapsed duplicates | Timestamp order inversions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sample03 | 2 | 951 | 948 | 3 | 0 | 0 | 0 |
| sample04 | 2 | 590 | 587 | 3 | 0 | 0 | 0 |
| sample05 | 3 | 897 | 893 | 4 | 0 | 0 | 0 |
| sample06 | 2 | 77 | 74 | 3 | 0 | 0 | 0 |
| sample07 | 2 | 596 | 593 | 3 | 0 | 0 | 0 |
| sample08 | 2 | 1037 | 1034 | 3 | 0 | 0 | 0 |

**Method limitation:** This is a separate local Python inspection of source block/time/coord pairs using the documented legacy near-duplicate rule, not a native execution of `tooling/gps-v2-d4-lineage.mjs` and not proof of exact JS canonical parity. It cannot replace the next owner-local Node24 six-file acceptance run. No raw routes, source names, coordinates or source timestamps have been committed. Expected blocked edge and `sourceRuns` values are not asserted until native evaluation; source runs are not independently validated time/speed continuity.
