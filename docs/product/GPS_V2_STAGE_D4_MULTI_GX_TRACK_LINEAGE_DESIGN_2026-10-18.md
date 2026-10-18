# GPS V2 — Stage D4 multi-gx:Track source-lineage proposal

**Date:** 2026-10-18. **Current status:** D4.0 OWNER-LOCAL NATIVE CORPUS CLASSIFICATION COMPLETE; D4.1 research sidecar DESIGN PROPOSAL / OWNER APPROVAL REQUIRED before implementation.
**Repo:** flytally-logbook. Research PR #366 (draft); parent PR #364 (draft). No flytally-training changes.
**Purpose:** make source applicability to multiple KML gx:Track blocks researchable without inventing movement, modifying canonical flights or enabling experimental production Pilot Review.

## Evidence and current state

- Current legacy `lib/track-processing.ts::parseKml()` iterates every gx:Track, concatenates observations via `pushUnique`, then `normalize` deduplicates adjacent same-time/near-position fixes (1e-7 degree tolerance) and sorts by parsed milliseconds if enough UTC fixes exist. **There is no retained block identity.**
- V2 `lib/gps-v2-import-lineage.ts::kmlGxTrack()` currently refuses any source other than one gx:Track. Its existing KML parity and source-height conflict quarantine must remain intact until a design is independently verified.
- Existing `lib/gps-v2-advisory.ts::candidatesInPart()` knows canonical splits, quarantine indices, timestamp-collision edges but **does not receive raw source block boundaries**. Extending source format acceptance without this dependency would be unsafe.
- Six owner-supplied local KML sources were examined read-only using an independent temporary source-block audit, *not* the native Node24 repo comparator. Each has 2–3 blocks with canonical point counts 948/587/893/74/593/1034, matching earlier independent legacy counts. In all six, canonical ordering yielded a sequential block run, **not** interleaving, but this is only a six-file property, not a general guarantee.
- The intervals between successive retained canonical block runs (relative seconds only, private raw geo/UTC withheld) are:

| Sample | Block-run canonical point counts | Inter-block observed delta (s) | Native V2 status |
| --- | --- | --- | --- |
| sample03 (track 0) | 1 + 947 | 20.11 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |
| sample04 (track 1) | 582 + 5 | 70.66 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |
| sample05 (track 2) | 11 + 878 + 4 | 24.01 and 77.16 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |
| sample06 (track 3) | 69 + 5 | 92.46 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |
| sample07 (track 4) | 3 + 590 | 4.90 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |
| sample08 (track 5) | 1033 + 1 | 26.39 | NOT RUN; strict parser code predicts UNSUPPORTED_SOURCE |

**Important:** A 4.90-second boundary may look like normal 5-second sampling but is STILL a source segment boundary with no validated continuity. Single-point block runs supply no intrablock velocity evidence. The known sample07 missed T&G (~+1781s) is **inside** its long second block, and its +15m/0.52s anomaly guard is a separate recognition issue; lifting boundary constraints cannot resolve it.

## Proposed narrow-scope research architecture

**Choice A (recommended as DESIGN, not yet approved):** Extend only research-side source-lineage construction first, with an explicit *sidecar* for multi-block KML. Keep `KmlPoint` canonical import, saved flights, API schemas and user-facing flags unchanged. No direct production support in this phase.

Conceptual interfaces (not implementation contract until owner decision):

```ts
type SourceRef = Readonly<{
  blockOrdinal: number;     // source XML order, not flight number
  fixOrdinal: number;       // fix within source block, before dedup
}>;
type CanonicalProvenance = Readonly<{
  canonicalIndex: number;   // EXACT current legacy normalized array index
  retained: SourceRef;      // first canonical-retained raw fix
  collapsed: readonly SourceRef[]; // deduped fixes, even across blocks
  altitudeConflict: boolean;
}>;
type SegmentSidecar = Readonly<{
  parserRevision: string;
  canonical: readonly CanonicalProvenance[];
  // Evidence-edge indices i representing canonical points i -> i+1
  blockedEdges: readonly number[];
  blockCount: number;
  status: "SOURCE_PARSED_DIAGNOSTIC_ONLY" | "UNAVAILABLE";
  reason: string | null;
}>;
```

### Semantics to freeze before implementation

1. Source parsing: verify complete paired `when` + `gx:coord` counts **per block**; strict UTC parsing and numeric coordinate validation. Unsupported/malformed/partially parsed XML is not silently repaired. Preserve original block/fix ordinal identity and time strings in a transient local graph.
2. Replicate exact current legacy *effective* dedup and stable timestamp sort in a separate research mirror without changing `lib/track-processing.ts`. If every retained canonical point cannot be mapped with exact lat/lon/alt/time equality to the existing importer, return `UNAVAILABLE/CANONICAL_SOURCE_MISMATCH`. Equal counts alone are insufficient.
3. A deleted near-position/time duplicate can have a different altitude; retain **both** source references, keep original canonical-retained value for parity and quarantine that location's evidence. Never claim a chosen retained height is authenticated.
4. Source boundary: if canonical index `i` and `i+1` derive from different blocks, mark edge `i` blocked even for a 4.9-second gap and near-identical positions. When a cross-block duplicate collapses at the join, keep its source references **and** retain a boundary break at the appropriate adjacent edge(s) so no evidence can pass silently through the collapsed fix.
5. Sorting: retain source-order and timestamp-order mappings. If the canonical sort interleaves blocks, source block continuity or boundary mapping becomes ambiguous, or parsed submillisecond precision creates unresolved same-ms edge identity, fail closed or quarantine all affected motion islands. Never infer a cross-block speed.
6. Distinguish block boundaries from user flight split cuts: blocks only constrain continuous sensor evidence, never auto-create flight records. A flight can contain multiple source blocks, and user split revision must still invalidate old suggestions.
7. No adjacency-based proof of continuity: time deltas / spatial proximity cannot override an unverified block boundary. A `blockedEdges` flag must propagate into **every** horizontal or altitude evidence span and must split speed smoothing windows; merely disabling one direct speed edge while retaining neighbors in median-of-five is not enough.
8. Zero recognized proposals, `UNSUPPORTED_SOURCE`, `SOURCE_DISCONTINUITY`, missing data and pilot-confirmed zero T&G are distinct states. Neither the sidecar nor V2 proposes/regulates landing count.
9. Research source provenance is not verified sensor provenance: source blocks, parser identity, declared altitude values and canonical parity do not validate altitude datum, receiver precision or physical touchdown.

### Caution: production V2 integration is outside this batch

The first milestone, if approved, should produce *pure synthetic source-lineage metadata and tests* (no experimental pilot card). Only after those pass should a separate milestone consider consuming blocked edges in the V2 detector with all affected evidence windows redesigned. Do not make `kmlGxTrack()` accept multi-block files **before** that nonbridging detection contract exists. Legacy behavior stays untouched. Physical-contact authority remains `UNRESOLVED`, landing totals `UNAVAILABLE` in V2, feature flag OFF and D3 production `horizontalCandidates=HIDDEN`.

## Synthetic acceptance matrix — owner approval pending

| Test group | Case | Expected invariant |
| --- | --- | --- |
| SOURCE-1 | Two gx blocks, 4.9s boundary, apparent fast/slow/fast pattern spans boundary | Blocked edge; no horizontal stop-go spanning boundary |
| SOURCE-2 | Two blocks separated 70/92s or 35/94s outage | No inferred motion across absent observations; UNKNOWN, not zero landings |
| SOURCE-3 | Three blocks with 1-point/empty middle block | Fail closed / quarantined island; do not bridge; no automatic flight split |
| SOURCE-4 | One block with unpaired when/coord or malformed fix | UNAVAILABLE; never canonicalize by silent point skipping |
| SOURCE-5 | Exact same-UTC/near-position duplicate within and across blocks | Preserve collapsed references and parity; boundary remains blocked |
| SOURCE-6 | Same UTC/location but different source height | Canonical retains existing value for compatibility but V2 evidence quarantine; no confident landing |
| SOURCE-7 | Same-ms or sub-ms collision, different location | No computed speed across collision; preserve raw UTC text |
| SOURCE-8 | Sorting inversions/interleaved blocks | Explicit failure/quarantine, never fabricate source segment continuity |
| SOURCE-9 | Null vs genuine zero altitude | Not interchangeable; zero height never proves ground contact |
| SOURCE-10 | All six anonymous sample shapes / counts | No raw geo or date in fixtures or GitHub; native exact-HEAD CLI required for comparison |
| CONTRACT-1 | Manual flight split near block boundary, upload changed | Invalidate stale review, respect both boundaries; no auto-split |
| CONTRACT-2 | Parser/source mismatch, multi-block unsupported | `UNAVAILABLE` must not become `0` landing proposals or an authorized prediction |
| UI-1 | Research sidecar disabled/OFF | Production Pilot Review remains HIDDEN, unchanged legacy experience |
| REG-1 | Ambiguous rolling shape with +15m/0.52s inside-span spike | Existing legacy >25m/s source-anomaly guard not relaxed; non-counted research audit only |
| NEG-1 | Low pass, missed-event gap, taxi and go-around controls | Require separate pilot/independent truth provenance, never infer labels from detector output |

## Milestones and acceptance gates

- **D4.0 — Native corpus classification (immediate):** owner-local current Node24 checkout, run D1 comparator on six KMLs, capture anonymized `v2.status`/`reason` and legacy proposal counts. Do not copy original KML/identifying metadata to repo or public report. Compare to independent reconstructed 1/1/10/0/6/3 only after actual outputs.
- **D4.1 — Pure research sidecar (conditional on owner approval):** narrow additional file under `research/gps-detection-r21/`, source parser and synthetic tests; no changes to `lib/`, `components/`, `app/`, DB, stored models, flags or server actions. Demonstrate six synthetic shapes and boundary invariants on exact HEAD. Preserve canonical dedup and source-source conflict provenance.
- **D4.2 — Separate detector consumption design:** after D4.1 success, independent review and owner decision of any boundary-aware V2 algorithm interaction. No admission/count change under D4.1.
- **D4.3 — Future pilot evidence evaluation:** additional independently observed T&G vs low-pass negatives, source applicability and precision/recall stratified by label provenance. Policy gate for any production visibility; no approval presumed.

## Suggested owner-local native comparator (PowerShell)

Use your already checked-out repo, Node 24, and original six private KML files in Downloads. Adjust filenames/paths to the actual local files; do not post filenames/coordinates with the output. The sample mapping matches uploaded tracks numbered 0–5.

```powershell
git fetch origin
git switch research/gps-v2-stage-d-comparator-20261018
git pull --ff-only
git rev-parse --short HEAD
node -v
npm run test:target -- tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
npm run typecheck

$base = Join-Path $env:USERPROFILE 'Downloads'
$names = @(
    'OK-BID-track-EGM96.kml',
    'OK-BID-track-EGM96 (1).kml',
    'OK-BID-track-EGM96 (2).kml',
    'OK-BID-track-EGM96 (3).kml',
    'OK-BID-track-EGM96 (4).kml',
    'OK-BID-track-EGM96 (5).kml'
)
for ($i = 0; $i -lt $names.Count; $i++) {
    $file = Join-Path $base $names[$i]
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Local KML missing for anonymous sample index $i. Confirm the file path privately."
    }
    $id = 'sample' + (3 + $i).ToString('00')
    Write-Host "=== $id ==="
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-compare.mjs --file $file --id $id
    if ($LASTEXITCODE -ne 0) { throw "Comparator failed for $id" }
}
```

If the local filenames differ, change only the local `$names` values. The D1 comparator outputs relative offset aggregates; source names/paths should not be copied into Github or other public locations. **Historical note:** This command was subsequently run on the owner-local checkout; see D4.0 results and evidence ledger below.

## D4 evidence ledger

- Current six-KML block-run/boundary audit: **local read-only independent XML/source reconstruction**, not native Node24 FlyTally.
- Prior owner-local code tests on `69e7e220`: targeted 44/44 and TypeScript PASS. The newer six-file command ran on exact `c2274ca2` (docs-only changes since earlier code), but no fresh targeted tests/typecheck were included in this latest terminal log; no exact-HEAD test claim.
- Native D1 comparator for all six new KML: **PASS — owner-local six-file execution, exact HEAD `c2274ca2`, all rows completed**, output table captured below. This verifies legacy hypothesis counts and strict V2 applicability outcomes, NOT landing truth.
- D4.1 source-lineage sidecar implementation: NOT STARTED / awaits owner approval.
- Full suite/build/Playwright/DB/production smoke: NOT RUN / N/A as appropriate.
- No runtime/legacy/import/persistence, feature-flag or production changes, no merge/deploy.


## D4.0 verified milestone — native six-KML comparator

**Evidence:** Owner's Windows PowerShell transcript on 2026-10-18. Working repo branch `research/gps-v2-stage-d-comparator-20261018`, `git pull --ff-only` fast-forward and `git rev-parse --short HEAD` = **`c2274ca2`**. The CLI `tooling/gps-v2-stage-d-compare.mjs` was executed for each of the six private KML files using anonymized local sample IDs. All six rows were produced without missing/error messages. Runtime version was not reprinted in this D4.0 transcript; an earlier owner terminal verified Node v24.19.0.

| Anonymous sample | Canonical points | Native legacy T&G hypotheses | Native V2 status | Native V2 reason | V2 event count |
| --- | ---: | ---: | --- | --- | --- |
| sample03 | 948 | 1 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |
| sample04 | 587 | 1 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |
| sample05 | 893 | 10 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |
| sample06 | 74 | 0 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |
| sample07 | 593 | 6 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |
| sample08 | 1034 | 3 | UNAVAILABLE | UNSUPPORTED_SOURCE | UNAVAILABLE |

**Conclusion:** Native parser execution exactly matches the previously independent reconstructed legacy counts: total **21 legacy proposals**. The strict V2 source gate returns `UNSUPPORTED_SOURCE` for **6/6** sources with multiple `gx:Track` blocks. The text `V2Events = UNAVAILABLE` must never be replaced with `0`. This proves current source incompatibility, NOT that V2 failed to detect 21 true landings. `sample06` zero is only zero *legacy proposals*, not a ground-truth no-T&G determination. `sample07` owner-reported missed rolling T&G and `sample08` potential event during missing telemetry remain separately labeled/uncertain.

**D4.0 acceptance:** COMPLETE for anonymous native source compatibility classification and reproduction of legacy proposal counts. It does NOT establish raw source sensor trust, physical contact, per-event correctness, production readiness or a test pass on this later documentation SHA. No private KML source or full route copied into Git.

**D4.1 decision remains OPEN:** implement pure research-only source-lineage sidecar under `research/gps-detection-r21/`, preserving canonical code/data, parser behavior, V2 unsupported status, experimental flag OFF and HIDDEN pilot hints. No direct production multi-block support until a separately reviewed, boundary-aware detector contract exists. Prove synthetic invariant cases SOURCE-1..10, CONTRACT-1..2 and existing targeted tests before further scope.

