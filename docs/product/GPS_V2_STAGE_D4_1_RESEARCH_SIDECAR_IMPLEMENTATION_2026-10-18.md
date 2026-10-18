# GPS V2 — Stage D4.1 source lineage sidecar implementation evidence

**Status:** IMPLEMENTATION STAGED / EXACT-HEAD TESTS AND NATIVE 6-KML ACCEPTANCE NOT RUN.
**Approved scope:** Owner explicitly approved D4.1 research-only implementation on 2026-10-18.
**Repo:** flytally-logbook. Branch: research/gps-v2-stage-d-comparator-20261018. Research PR #366 Draft, nested under parent experimental PR #364 Draft.

## Implemented, isolated surface

1. research/gps-detection-r21/multi-gx-track-lineage.ts — pure bounded gx:Track source-to-canonical evidence sidecar. Reads only caller-provided source text, imports existing canonical parseKml (read-only), does NOT modify legacy parser or canonical flight model.
2. tests/gps-v2-d4-multi-gx-lineage.test.ts — 19 synthetic source/provenance/fail-closed test cases. Test count is authored, not yet a passing result.
3. tooling/gps-v2-d4-lineage.mjs — owner-local, read-only single-file CLI for a compact non-geographic summary. Outputs only anonymous sample ID, source block count, raw/normalized fix totals, collapsed/conflict fix counts, blocked-edge/collision-edge counts and motion island count. No source path, original filename, GPS coordinates, time, altitude or registration in stdout.
4. No changes to lib/, app/, components/, pages, DB, migrations, persistence, flight calculations, landingCount, production V2 parser/detector or experimental feature flags.

## Frozen semantics and proof obligations

- Only strict, paired, time-tagged gx:Track blocks are accepted. Every source when/coord must pair exactly; malformed/unsupported source or unstable ordering => UNAVAILABLE, never silently drop samples.
- Canonical parity is evaluated by executing actual parseKml on the same raw string and requiring every normalized lat/lon/alt/time value and count to match exactly. Supplied canonical cannot forge trust.
- Existing legacy dedup is mirrored: adjacent same-UTC/near-position fixes preserve first reading. All collapsed raw source fix references are retained in the sidecar. Conflicting source heights are quarantined, never made authoritative.
- Source block identity remains sidecar metadata, not a flight split. Edges crossing source blocks are blocked, even at 4.9 seconds. When a cross-block duplicate collapses away, both neighboring canonical edges are blocked to avoid hidden bridging.
- Same-millisecond timestamp collisions also quarantine neighboring edges. No speed or altitude calculations are performed by D4.1, and no recognizer consumes its edges yet.
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
        BlockedEdges=$r.blockedEvidenceEdges; Islands=$r.motionIslands
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
