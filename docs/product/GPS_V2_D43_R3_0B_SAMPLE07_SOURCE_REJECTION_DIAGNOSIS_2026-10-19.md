# GPS V2 D4.3-R3-0B — sample07 private source-rejection diagnosis

Date: 2026-10-19. Research-only owner-private KML analysis, public GitHub stores this anonymized summary ONLY. Parent: R3-0 Draft PR #369. No raw track, original source filename, registration, GPS coordinates, raw heights, exact flight times, canonical indexes or source hashes committed.

## Grounded observations

1. Pilot explicitly reports one rolling Touch & Go with wheel contact and renewed departure in a private approximate minute of sample07. Source of contact claim: PILOT_ATTESTATION; evidence category REPORTED_CONTACT_UNCORROBORATED. No independent video, sensor or witness contact corroboration was provided.
2. Owner-local native R2-1 aggregate previously found one GLOBAL altitude-height derivative edge above historical 25m/s threshold in this private source. Native R2-2 found two within-anchor 25m/s rejected geometry windows, 22 legacy 30m-anchored geometry windows, 20 pre-group eligible windows and 6 original grouped altitude proposals. Source windows are not physical events.
3. This investigation independently parsed the original private KML and replayed the existing frozen source-normalization and R2-2 legacy geometry checks using a private **offline Python reconstruction**. Source block parsing, adjacent dedup, time order, five-point median speed, local minima, 30m evidence anchors and in-span derivative rules were reconstructed. Totals agree with all above native per-source R2-2 aggregate counts. This is NOT an execution of a new native TypeScript local per-window trace.
4. Both rejected windows lie within the **owner-reported minute** and depend on the **same underlying altitude source edge**, NOT two independent anomalous edges or two physical contacts. That single recorded step is a 15m source-height difference across 0.52s, approx 28.85m/s; frozen rule rejects greater than 25m/s for 0<dt<=15s within the nearest qualifying descent/climb anchor span. Both inspected windows otherwise satisfy existing speed and timed-intermediate-climb gates. Sensor accuracy and actual intervening vertical aircraft movement remain UNKNOWN.
5. Offline counterfactual ONLY: ignoring the >25m/s derivative exclusion in the private reconstruction would allow these two overlapping source windows into the frozen <8-index grouping process, giving **one additional provisional legacy altitude suggestion**, NOT two. This does NOT prove the result is correct or safe, and DOES NOT authorize changing the legacy threshold, production counting or recency.

## Evidentiary status

- The shared-edge relation is source-based debugging, not sensor-authenticated causality or wheel-contact proof.
- Pilot testimony can help prioritize investigation but is NOT independently corroborated event ground truth. The timing association is based on private pilot statement and source timestamps; it is NOT a second witness or proof of touchdown at either GPS minimum.
- No independent positive/negative reference set exists to calculate actual false-negative rate or accuracy.
- Do not classify two rejected source windows as two missing T&Gs. Do not overrule the quality discontinuity or substitute missing motion with interpolation.
- Private analysis retains exact original source temporal alignment off-repository only. Published statements deliberately omit absolute times and per-fix indexes.

## Next bounded owner decision (NO CODE AUTHORIZED)

Research may propose an explicit SOURCE_QUALITY_INCONCLUSIVE / PILOT_REVIEW_REQUIRED state in the existing GPS import Review UI, rather than silently counting it as a landing or weakening the >25m/s gate. Such a design requires discovery of current UI, source-eligibility, feature-flag and import review paths; exact source/split/revision binding; source-quality provenance; overlap grouping without fictional event claims; tests for low-pass, sensor shifts, gaps, conflicting/source-block tracks and duplicate/stale input; and independent owner review. Multi-gx source remains UNSUPPORTED_SOURCE in current native V2 and feature flag OFF; no hidden enabling or changes to certified/recency state.

## Work evidence and closing

Privacy-bounded offline Python source-shape diagnostic REPRODUCED earlier native R2-2 aggregate source counts, and identified a common rejected derivative source edge. This is NOT a new owner-local Node test pass, TypeScript check, CI verification or independent touchdown validation. The research branch adds DOCUMENTATION ONLY; R3 independent-contact case remains uncorroborated; no code, DB, UI, flags, flight records, landings, recency, merge or deployment changed. Build/test/CI/browser NOT RUN / N/A for this docs-only note.
