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
