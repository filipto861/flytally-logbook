# GPS V2 — D4.2A post-corpus DeepSeek review reconciliation and proposed research roadmap

**Reviewed 2026-10-19. Status: D4.2A RESEARCH EXPERIMENT COMPLETE (bounded engineering acceptance), rolling T&G detection fitness NOT DEMONSTRATED. Next research stages DESIGN ONLY / OWNER IMPLEMENTATION APPROVAL REQUIRED.**
Repo: flytally-logbook, research PR #366 Draft, parent PR #364 Draft. No production lib, flight data, UI, DB or deployment changes.

## Evidence and reviewer applicability

Independent DeepSeek reviewer inspected selected provided code and evidence files without checkout, raw KML, tool execution or independently corroborated contact evidence. Reviewed source revisions: GPS_V2_HORIZONTAL_V3, GPS_D4_MULTI_GX_SIDECAR_V1, GPS_D42_SHADOW_V1. Its review is a critical read-only secondary assessment, NOT verification of source physics or a runtime release.
Owner-local Node v24.19.0 tests on code SHA 83635bc4: 83/83 targeted PASS and TypeScript PASS, including 36 deterministic single-block differential fixtures. Six owner-private multi-gx KML were processed by read-only shadow CLI on documentation-only SHA c5cd44b2: all six RESEARCH_DIAGNOSTIC_ONLY, with 0 BASE STOP_GO, 0 SHADOW STOP_GO, 0 STOP_GO suppressed, and 0 emitted inconclusive candidates. Existing legacy rolling-altitude proposals total 21 (1/1/10/0/6/3), not 21 independently verified physical contacts. There is no confirmed real positive source-boundary STOP_GO suppression within this corpus. Full suite/build/browser/CI/deploy not run.

## Decision-by-decision adjudication

| Review point | Disposition | Reconciliation |
| --- | --- | --- |
| Research shadow as isolated boundary-aware comparator | ACCEPT | Engineering scope achieved and tests/corpus executed; close D4.2A as a bounded research experiment, NOT as rolling-T&G accuracy or deploy approval. |
| Six real STOP_GO zeros reflect low-speed predicate / domain mismatch | ACCEPT WITH QUALIFICATION | Frozen V2 requires <=20km/h slow evidence bracketed by >=45km/h edges and timed context. Few qualifying low-speed edges support mismatch with rolling maneuvers; exact cause for each possible physical event not known. |
| sample03/sample08: no eligible <=20km/h edges | ACCEPT | From separate Python reconstruction; implies no STOP_GO can be generated under this specific predicate in these sources. Does NOT imply no wheel contacts. |
| sample07: one slow edge structurally makes STOP_GO impossible | CORRECT | One slow edge could mathematically qualify if its observed interval duration >=5s and surrounding fast/context requirements hold; median cadence cannot prove this edge duration. Actual complete predicate yielded zero, cause cannot be ascribed solely to aggregate slow-edge count. |
| sample05 491s gap prevents all candidate islands | CORRECT | Such an edge is invalid under existing >=60s V2 edge rule, but only breaks evidence across that interval; other valid islands could exist elsewhere. |
| D4.2A boundary suppression verified on six real events | REJECT | All baseline STOP_GO=0, so real-data suppression is vacuous. Only synthetic boundary tests passed. Real positive suppression remains empirically unexercised. |
| Missing coverage must be reported even without candidates | ACCEPT | A zero event array is not complete observation. Design source-linked coverage/gap evidence independent of event emission. |
| Unobserved gap starts at fixed 60s | CORRECT | 60s is the existing V2 velocity-edge ceiling, not an authenticated source-coverage policy. Also preserve provenance boundaries, invalid UTC, collisions, and source-cadence concerns below 60s WITHOUT inventing a universal threshold. |
| Observed interval means aircraft was continuously observed between fixes | REJECT | Only endpoints are sampled; interval durations provide temporal adjacency, not a continuous trajectory or proof of no intervening action. Rename outputs accordingly. |
| Altitude gx:coord is always ellipsoid height with 2–5m noise | NOT SOURCE-SUPPORTED | Actual height datum, processing method, device precision, config, and effectivity are UNKNOWN for these sources; do not assign ellipsoid/AGL/pressure/sigma as fact. |
| sample03/sample08 should return altitude NONE / INSUFFICIENT | REJECT AS FIXED EXPECTATION | Legacy altitude research emitted 1 and 3 provisional suggestions there; no independent quality/contact evidence proves altitude-shape class. Derive outcome from actual window evidence and provenance, not these labels. |
| sample07 source jump can be overridden | REJECT | Existing in-span approximately 28.85m/s >25m/s guard remains fail-closed; suspect span can only become evidence-quality INCONCLUSIVE, never an approved rolling contact. |
| New SHALLOW vs DEEP minimum classification thresholds | DEFER | No source-backed numerical boundary or physical runway height/AGL evidence exists. Do not create or use such categories until source evidence and owner approval establish explicit definitions. |
| 5–10 positive/negative examples with device-certified tiers | QUALIFY | Dataset size numbers are planning suggestions, not accuracy evidence or a hard statistical acceptance claim. Evidence tiers require documented provenance and what each source independently proves. ADS-B alone does not establish wheel contact; videos only corroborate what is visibly captured. DEVICE_CERTIFIED must not be invented. |
| No threshold tuning; no production integration | ACCEPT | Preserve <=20, >=45, <60, 900, 120s and historical legacy 25m/s/altitude rules; production multi-block remains UNSUPPORTED_SOURCE, Pilot Review HIDDEN and flag OFF. |

## Proposed new research milestones (DESIGN-ONLY; no code approved)

**Naming:** Use provisional R1/R2/R3 research stages, not 'D4.2B' for coverage. Prior D4.2A runbook explicitly uses 'D4.2B/production integration' as a future unapproved concept; reusing that name for a harmless coverage report would silently change its meaning. Proposed labels: D4.3-R1 Coverage, D4.3-R2 Altitude Shape, D4.3-R3 Independent Evidence. Final milestone naming, sequence and scope require owner confirmation.

### D4.3-R1 — Coverage and data-gaps report (recommended next design/implementation decision)

- Research-only and candidate-independent: describe adjacency between successive canonical fixes, source block boundaries, blocked edges, UTC collisions, existing V2-invalid speed/time edges and potentially unusual source-local cadence. Distinguish OBSERVED_FIX, BETWEEN_OBSERVATIONS_UNPROVEN, SOURCE_DISCONTINUITY, SOURCE_UNAVAILABLE and COVERAGE_UNDETERMINED.
- Never call a two-fix edge a continuously observed flight path. SOURCE_BOUNDARY requires a hard break even at 4.9 seconds; manual flight split remains a different dimension and never becomes a source block flight. Record exact relative index and delta duration only in local diagnostic memory; CLI remains aggregate/redacted.
- Existing >=60s V2 rejection must appear as VELOCITY_EDGE_INVALID, not as a universal declaration of 'the only GPS gaps'. The known 35.35-second sample08 gap is a coverage concern to evaluate against defensible source-local cadence, with explicit uncertainty if source-quality knowledge is insufficient. No new arbitrary 15s/35s limit.
- Coverage must exist when candidates=[]; connect each candidate to relevant supporting edge intervals / nearest known discontinuities or explicit NONE/UNDETERMINED. Never fabricate a candidate or interpolate a touchdown into a missing recording span.
- Acceptance examples: sample05 491.57s and sample08 94.39s interval abnormalities visible with appropriate reason; 35.35s retained as source interval and investigated without hardcoded rejection; clean synthetic 5s sampling has no invented source break; 4.9s across blocks still blocked; privacy redaction; same-source deterministic output and invalidation on modified source/split; no lib imports of research.

### D4.3-R2 — Altitude-shape and source-quality *design*

- Do not implement or declare thresholds yet. Draft a separate research evidence model for local descent/minimum/climb *shape*, with source datum/unit/mode and precision UNKNOWN unless source documentation verifies them. 'Shape present' is not ground contact.
- Preserve existing 25m/s legacy discontinuity guard and all frozen speed/shape limits without treating them as a newly approved classifier. If a proposed window includes >25m/s implausible source-height derivative, classify that window INCONCLUSIVE / ALTITUDE_DISCONTINUITY; do not assert all of sample07 globally ineligible or invent an exact contact location.
- A 35s/94s GPS gap, collapsed altitude conflicts and same-JS-ms UTC collisions break evidentiary continuity as appropriate. No altitude bridging/smoothing across hard source boundaries. Avoid categorizing SHALLOW/DEEP without evidence-backed cutoffs or a validated runway-relative height.
- Future test matrix must include rolling pilot-reported sample07 ambiguous anomaly, sample03/08 legacy candidate windows without assuming NONE, low-pass, go-around, taxi negative controls, GPS altitude noise, missing/zero altitude, cross-block duplications and source-coverage gaps. Contact always UNRESOLVED and actualLandings UNAVAILABLE.

### D4.3-R3 — Independent evidence acquisition / quality tiers

- Owner-led private acquisition of independently corroborated positive contacts and confirmed non-contact maneuvers; classify each label by source, time bounds, aircraft/receiver effectivity, independence, uncertainty and limitations. Pilot firsthand evidence remains useful as PILOT_REPORTED, not equivalent to independently documented contact.
- Media/observer claims must be assessed individually: e.g. clear visual contact can be corroborative; ADS-B track on its own cannot prove physical wheel contact. Do not claim a device-certified tier without named authentic sensor evidence.
- Include cases of taxi, low pass, go-around, normal landing, rolling T&G, and large telemetry dropout across more than one flight/pilot/source where available. Keep track files, video, absolute UTC, registrations, identities and route data out of GitHub; only derived anonymous statistics there.
- No precision/recall/FN/TN estimation on unverifiable or unobserved cases. A missing recording span is not a confirmed negative or missed positive. Dataset counts are exploratory targets, not representative performance evidence.

## Proposed release gates / sequencing

1. Close D4.2A only as 'RESEARCH ENGINEERING EXPERIMENT COMPLETE / ROLLING UTILITY NOT DEMONSTRATED' based on existing tests, six KML execution and independent read-only review. Preserve limitation permanently in changelog.
2. Request owner decision separately on D4.3-R1 coverage-only research implementation. Before any code, freeze fields, source coverage semantics, privacy contract and acceptance tests; full V2 source frozen.
3. Keep R2 altitude work DESIGN-ONLY until source-quality/applicability is documented and independently reviewed; collect R3 evidence alongside research when possible.
4. Any eventual new rolling recognition or production source-reader work demands another architecture/evidence/owner gate; full typecheck/unit/full build/browser/flag ON/OFF/source quality testing before release; no implicit flag enablement.

## Verification ledger

DeepSeek analysis: READ-ONLY submitted report, not a runtime test; no code written for this reconciliation. Prior owner-local D4.2A code SHA 83635bc4: 83/83 targeted PASS, TypeScript PASS. Six owner-private shadow CLI on docs-only c5cd44b2: 6/6 source processed, zero horizontal STOP_GO candidates; no independently verified touchdown ground truth.
This review batch is DOCUMENTATION ONLY; current head tests/full suite/build/browser/CI/DB/production smoke NOT RUN or N/A, merge/deploy NOT RUN, PR #366 remains Draft. Production multi-gx:Track remains UNSUPPORTED_SOURCE and Pilot Review HIDDEN, flag OFF.
