# GPS Detection 2.0 — Stage D2 real KML comparison and next diagnosis

**Status:** Stage D1 initial real comparator EXECUTED owner-local; D2 event-local diagnosis PLANNED. Research only, no release or authority.  
**Repository:** `flytally-logbook` / PR #366; parent PR #364 remains Draft and production advisory feature flag OFF.  
**Owner-local run:** Node v24.19.0, branch exact working HEAD `114a8204`, 2026-10-18. Local source files not committed or copied to the repo.

## Pilot labels vs raw tool output

Pilot's previously confirmed account, not a sensor-contact certification:
- `sample01` (local file `121001.kml`): **1 real T&G and 1 final full-stop**, one legacy hypothesis at +00:30:24.9 confirmed *false*; one at +01:01:34.9 corresponds at minute-level to pilot's ~+01:00:40 real T&G. The ~55 s discrepancy is retained, not erased, and is **not** a second-exact match.
- `sample02` (local file `121002.kml`): **2 real T&G and 1 final full-stop**, and a low pass at approximately +00:30:05. Legacy hypotheses at +00:51:50.7 and +00:56:49.7 correspond at pilot-confirmed minute-level to the two T&G. Legacy did not propose T&G for the low pass.
- Both: count/timing evidence is pilot-recalled and approximate. Ground-truth confidence and time tolerance must be declared before any automated event scoring. No unbiased global precision/recall metric, no physical touchdown validation.

Read-only comparator results on the exact reported owner-local HEAD:

| Anonymized sample | Canonical/timed points | Duration | Legacy altitude T&G proposals | V2 status | V2 STOP_GO | V2 other | Quarantined source fixes |
| --- | ---: | ---: | --- | --- | ---: | --- | ---: |
| sample01 | 913 / 913 | 4092.5 s | +1824.9 s (pilot-confirmed false), +3694.9 s (pilot-matched, minute-level) | ADVISORY_ONLY | 0 | none | 1 |
| sample02 | 1088 / 1088 | 3960.3 s | +3110.7 s, +3409.7 s (both pilot-matched, minute-level) | ADVISORY_ONLY | 0 | ARRIVAL +1356.7 s, +1462.5 s, **both unresolved** | 1 |

`DIAGNOSTIC_ONLY`, `actualTouchAndGoes=UNKNOWN`, `actualFullStops=UNKNOWN`, `groundTruthComparison=NOT_EVALUATED` in tool JSON are **intentional**; pilot labels above are a separate provenance layer. Those fields MUST NOT be overwritten with guesses. Null/unknown/unsupported must not become zero. Legacy emits `confidence=medium` for each of the four altitude proposals; that does not independently validate them.

## Reconciliation and hypotheses

1. Both KMLs are now V2 source-compatible (`GPS_V2_IMPORT_LINEAGE_V3`), with exactly one quarantined source height conflict each. Quarantine count alone does **not** locate a T&G or prove why the detector misses an event.
2. Legacy's altitude branch detects rolling profiles without a low-speed stop. V2 `STOP_GO` specifically needs a sustained horizontal fast→<=20 km/h→fast pattern; therefore the V2 miss **can be explained structurally** for rolling T&G that do not slow to that speed. We have not extracted each event's actual speed feature window on these files, so attributing individual misses to this single gate is a hypothesis, not a measured per-event root cause.
3. `sample01` false altitude proposal is **confirmed by pilot**, but its precise cause (altitude oscillation, nearby discontinuity, single-edge recovery, duplicate fixes, speed smoothing, or something else) is **not yet proven**. The 1 quarantined source fix is not automatically causal.
4. The two V2 ARRIVAL review points for `sample02` are **unresolved horizontal hints**, neither confirmed landing nor false T&G; they must not affect canonical counts.
5. A low-pass negative control exists for `sample02`; the pilot truth allows saying legacy did not propose a T&G there. Do not extend that claim to every public ADS-B low pass.

## Next D2 step — local event diagnostic without algorithm changes

- Add a research-only event-centered quality inspector to produce **relative offsets and aggregate data only**, for four legacy proposals and the pilot-labeled low pass; do not ship it in production UI.
- Analyze sampling gaps (including near-zero/negative dt), altitude missingness, before/minimum/after altitude shape, in-span large-rate discontinuities, motion speed regimes, any quarantined source conflict proximity **if and only if source indices are auditable**; maintain clear observed vs derived vs unknown.
- Use existing legacy qualification evidence bounds (+30 m within existing index windows), not invented threshold changes. Treat any inspection window as diagnostic context, **never** a touchdown gate.
- Falsify each proposed explanation against synthetic counterexamples and at least another pilot-labeled negative/positive before modifying the detector.
- Keep `GPS_V2_HORIZONTAL_V3` untouched; seek independent DeepSeek read-only review once a detailed reason matrix and proposed corrective design exist, prior to any count-adding change.
- No raw route, coordinate, absolute UTC, registration, person, file path, or source content in GitHub. Local reports may remain sensitive; review before publication.

## Test and release ledger

- Parent code/testing on the user's prior research checkout: targeted 39/39 PASS, TypeScript PASS.
- Exact owner local working HEAD `114a8204` verified by `git rev-parse --short HEAD` in terminal. Two private KML compare commands executed successfully on that HEAD.
- This documentation commit occurs **after** that comparison; no new-HEAD test/release PASS implied.
- No analyzer output on further event features yet. Additional GPS corpus, `verify:plan`, full suite, build and browser **NOT RUN**.
- No DB access/migrations, merge, deployment or enablement. Production D3 HIDDEN-vs-experimental-Pilot-Review conflict remains unresolved.

## D2 local diagnostic probe (STAGED, NOT VERIFIED)

Research-only files now staged in PR #366:
- research/gps-detection-r21/stage-d-event-quality.ts
- tooling/gps-v2-stage-d-quality.mjs
- tests/gps-v2-stage-d-event-quality.test.ts

For every legacy hypothesis, the quality probe outputs relative time, the *legacy-derived* five-point smoothed horizontal speed, the elapsed time covered by +/-10 canonical fixes, counts of missing/zero/near-zero (>0 and <0.1 s)/over-15 s time intervals, source altitude-rate anomalies >25 m/s, max source-derived rates, and the nearest +/-30 m altitude rise evidence boundaries with aggregate span quality. These values are **for diagnosis**, not new thresholds or physical-contact proof. The <=0.1 s diagnostic flag does not silently admit samples, change the legacy detector, or make sensor evidence valid. Original absolute altitude, route and UTC remain unreported.

Run on owner-local Node24 checkout, using the exact raw KML previously tested:

    git fetch origin
    git pull --ff-only
    git rev-parse --short HEAD
    npm run test:target -- tests/gps-v2-stage-d-event-quality.test.ts tests/gps-v2-stage-d-comparator.test.ts tests/gps-v2-advisory.test.ts tests/gps-v2-import-lineage.test.ts
    npm run typecheck

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-quality.mjs --file "$env:USERPROFILE\Downloads\121001.kml" --id sample01
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types tooling/gps-v2-stage-d-quality.mjs --file "$env:USERPROFILE\Downloads\121002.kml" --id sample02

Send only redacted JSON reports (not raw files/paths) for analysis. The program does not attach pilot labels or alter results. **Latest new D2 code/tests NOT RUN**; prior 39/39 PASS and TypeScript PASS belong to the earlier comparator SHA, not this D2 code HEAD.

After report inspection, differentiate observed anomalies from causality: a >25 m/s step in the surrounding window is not necessarily within the actual left-minimum-right qualifying evidence span. If source altitude is unverified, record source-derived altitude shape only, not confirmed AGL/contact.

## D2 event quality probe — FIRST OWNER-LOCAL RESULTS (2026-10-18)

**Evidence scope:** Owner local PowerShell: Node v24.19.0, git rev-parse HEAD = 69e7e220; targeted 44/44 PASS; npm run typecheck PASS. Both original KML files were read locally by the research-only D2 CLI. Reports are redacted aggregate/relative-offset data; prior pilot labels remain separate. Current repository HEAD after this documentation change will differ from tested source SHA.

| Sample/event (elapsed) | Pilot status | Legacy smoothed horizontal km/h | Source altitude height above event: max before / after (m) | Nearest +30m evidence span (s) | Within-span edges below 0.1s | Edges >15s | Alt-rate >25m/s | Max observed valid alt-rate m/s |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| sample01 +1824.9 | Confirmed false legacy T&G | 126.9 | 54.2 / 41.9 | 52.8 | 1 | 1 | 0 | 12.6 |
| sample01 +3694.9 | Pilot-time-corresponding T&G | 104.1 | 103.9 / 195.5 | 61.0 | 0 | 3 | 0 | UNAVAILABLE (no valid-rate intervals <=15s in span) |
| sample02 +3110.7 | Pilot-time-corresponding T&G | 95.6 | 120.7 / 134.6 | 71.0 | 0 | 0 | 0 | 4.8 |
| sample02 +3409.7 | Pilot-time-corresponding T&G | 96.8 | 124.0 / 138.8 | 75.0 | 0 | 1 | 0 | 3.6 |

The BEFORE/AFTER figures above are **source-height deviations from each event candidate** within ten surrounding fixes, not AGL, actual climb/descent, runway elevation or contact evidence. The relative times are derived by JavaScript millisecond parsing, not verified timing precision of the receiver.

**Measured limitations and falsification:**
- The one confirmed false legacy candidate has a source-derived V-shaped altitude pattern and passes current legacy altitude jump-rate guard; no >25 m/s edge inside its qualifying evidence span. A guard on this rate **alone** cannot reject it.
- It includes one sub-0.1-second timed edge and one >15-second interval within the qualification span; neither proves those samples caused the false proposal.
- A known true pilot-matched T&G on sample01 has *three* >15-second intervals within its own qualification span. A blanket rule treating any >15-second interval as evidence of a false T&G would risk suppressing this true event. It is especially important that its valid altitude-rate maximum is **UNAVAILABLE**, not zero.
- The other two pilot-matched events have more consistent sampling; one still has a >15-second span gap.
- Sample02's confirmed low pass is pilot-labeled but NOT separately analyzed by this new probe: the CLI only emits quality for legacy T&G proposals, not arbitrary ground-truth negatives.
- Event-level reasons for the V2 STOP_GO misses are still not individually established; the horizontal-only algorithm structurally lacks rolling-T&G altitude recognition. Do not modify production thresholds from these four proposals.

**Next D2 action:** acquire additional owner-provided KML/GPX/CSV tracks (public ADS-B is acceptable for robustness/disagreement research, with source/licence/provenance recorded). Keep real T&G/full-stop/low-pass counts as UNKNOWN unless pilot/independent evidence supports them. Prefer both confirmed positives and confirmed negatives, including suspected go-arounds and low passes. Inspect quality windows then prepare independent reviewer questions; no tuning/count update, no source upload to GitHub.
