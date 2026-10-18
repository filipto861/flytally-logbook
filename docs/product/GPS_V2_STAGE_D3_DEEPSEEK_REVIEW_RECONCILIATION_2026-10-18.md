# GPS Detection 2.0 — Stage D3 independent review reconciliation

**Date:** 2026-10-18. **Status:** READ-ONLY DESIGN REVIEW RECONCILED; no implementation or owner release decision.
**Repo/PR:** flytally-logbook, research PR #366 (draft) based on parent GPS V2 PR #364 (draft).
**Review input:** DeepSeek independent review of the redacted six-track D3 handoff, supplied by product owner. DeepSeek explicitly had NO repo/source/raw KML/native V2 execution access. Its output is design advice, not test evidence or aviation authority.

## First-party reconciliation against the current repository

- `lib/track-processing.ts::parseKml` iterates all `gx:Track` blocks and appends paired observations into one legacy track. `normalize()` collapses adjacent points with near-identical positions and equal timestamps before sorting by parsed UTC milliseconds when at least two timestamps exist. The canonical `KmlPoint` shape presently contains lat/lon/alt/time only, **not** source segment references.
- `lib/gps-v2-import-lineage.ts::kmlGxTrack` requires exactly one `gx:Track` block, so the six owner-supplied two-/three-block sources are expected to be `UNSUPPORTED_SOURCE` in native V2. This source applicability finding is from the code; **native six-file V2 runs NOT RUN**.
- Current V2 `finalized()` intentionally mirrors the legacy normalization for near-identical position/time KML fixes, retains the first altitude, records a conflict anchor if the discarded duplicate altitude differs and quarantines affected V2 horizontal edges. DeepSeek's literal advice 'do not silently pick an altitude' must be reconciled with this existing frozen canonical parity: **do not change canonical/legacy dedup in this research milestone; preserve its exact behavior while recording all discarded source references and quarantining conflicts for V2, or fail closed**.
- Current source analysis sorts normalized points by JavaScript-parsed milliseconds. DeepSeek's 'never silently sort' must be interpreted as **never lose original order/provenance or claim continuity based on resorting**. Compatibility may require preserving existing canonical ordering while maintaining a separate source-order-to-canonical-index map. Same-millisecond/submillisecond ties require explicit discontinuity treatment.
- Current V2 `inspectGpsV2HorizontalTrack` accepts only exact one-to-one normalized equality and its split partitions; `candidatesInPart` invalidates edges around quarantined source fixes and zero-millisecond collisions but **does not yet receive source block boundaries**. No claim of safe multi-block detection until new boundary evidence exists.
- The legacy `altitudeTouchAndGoIndices` contains in-span +30m left/minimum/right evidence and a >25m/s discontinuity guard. Stage D3 sample07's independently reconstructed candidate is rejected by that in-span guard; do not relax it merely to recover an owner-reported true T&G.
- Current product D3 offline DTO contract explicitly requires `horizontalCandidates=HIDDEN`, `altitudeCandidates=HIDDEN`, no unverified notes/candidates in production; the experimental PR #364 pilot panel is NOT authorization to enable the flag. This remains a release blocker.

## DeepSeek recommendations — adjudication

| Recommendation | Adjudication | Reason / implementation boundary |
| --- | --- | --- |
| Segment-first source processing and no motion bridge | ACCEPT AS DESIGN INVARIANT | A `gx:Track` block is evidence identity, not automatically a separate flight. Break horizontal and altitude evidence across unverified source boundaries. |
| Map every retained canonical point back to source block/index and all collapsed references | ACCEPT FOR **RESEARCH SIDECAR DESIGN**, NOT CANONICAL SCHEMA CHANGE | Canonical KmlPoint and persistence remain unchanged. An audit/lineage sidecar can retain source block ordinal, point ordinal, raw ordering, normalized index, dedup reason and conflicts without changing import. |
| Reject malformed, ambiguous, conflicting source | ACCEPT FAIL CLOSED WITH EXISTING CANONICAL PARITY | Support whole-file unavailable or locally quarantined motion islands only when independent index provenance proves every retained fix. Do not silently discard malformed rows or create count authority. |
| Treat no proposals as no true landings | REJECT | Unavailable source vs supported source with zero hypotheses vs pilot-verified no T&G are three distinct states. |
| Keep sample07 non-counted due to in-span source-height anomaly | ACCEPT | May be retained as **research-only suppressed-candidate reason**; no assertion of physical contact. Never add to legacy `landingCount()` or production review under current policy. |
| Treat sample08 data outage as unknown/unobservable | ACCEPT | Cannot interpolate a touchdown through two missing spans. |
| Require independent physical-contact evidence for positive labels | QUALIFY | Owner-pilot reports are valid **pilot-reported labels with declared approximate uncertainty** for qualitative development; they are not device-certified contact evidence or regulator-grade truth. Use independently corroborated labels as a separate higher-evidence evaluation tier and never pool the tiers into population accuracy. |
| Synthetic matrix before runtime changes | ACCEPT | Test segment boundaries, canonical parity, conflicts, missing samples, low-pass/go-around, taxi, in-span spike, exactly 25 m/s vs >25 m/s, provenance and HIDDEN/OFF states. |

## Proposed source-lineage sidecar contract — DESIGN, NOT CODE

1. Parse source as bounded, ordered blocks. A `sourceBlockOrdinal` is stable only **within a particular immutable raw input**. A block is not a flight, runway, airport, landing or continuous movement proof.
2. Within each source block associate each observation with `sourceFixOrdinal`, verbatim source UTC, parsed UTC milliseconds, position, altitude (including explicit missing/null), and any parser diagnostics. Keep original byte input transient in owner-local process, never in output/GitHub.
3. Build explicit `canonicalFixIndex -> [sourceBlockOrdinal, sourceFixOrdinal...]` provenance; source collapsed-fix reasons (e.g. same time and near-identical lat/lon) and raw-to-canonical order must be explainable. Verify canonical count *and* exact retained lat/lon/alt/time equality with the existing importer.
4. The sidecar records source-block boundaries and quarantine ranges **after canonical reordering**. If sorting interleaves blocks or makes boundary assignment ambiguous, return `UNAVAILABLE` rather than invent stable continuity.
5. At minimum invalidate every velocity edge crossing a source block boundary, including across adjacent fixes whose time happens to be close. Also quarantine duplicate/conflicting fixes and timestamp collisions locally. Do not bridge those edges for altitude-shape, speed island, evidence spans, split-derived review events or a rolling candidate.
6. Preserve existing manual flight splits separately. Source segmentation is motion evidence segmentation, **not** automatic flight splitting and must not change user-entered flight segmentation.
7. Return explicit source applicability/reason outcomes; `ADVISORY_ONLY` still means sensor accuracy, contact, AGL, landing count and applicability are unresolved. Zero horizontal hints must never mean zero actual events.
8. Decision still open: whether a proof-carrying segmented V2 sidecar may be introduced in the source reader **without** changing canonical parser vs fail closed on complex overlapping block orders. The sidecar approach is preferred for initial evaluation because it minimizes blast radius.

## Candidate/evaluation states (proposal only)

- `SOURCE_UNAVAILABLE`: source lineage insufficient or incompatible; not a zero-event negative.
- `NO_QUALIFYING_HYPOTHESES`: parsed/evaluable source, algorithm proposed none; actual events unknown.
- `UNRESOLVED_HYPOTHESIS`: event profile is suggestive but wheel contact is not proven; non-counted.
- `SUPPRESSED_SOURCE_DISCONTINUITY`: required evidence crosses an unverified source block/gap/conflict; non-counted research audit.
- `SUPPRESSED_IN_SPAN_ALTITUDE_DISCONTINUITY`: legacy-like candidate shape found but current safety guard rejects suspect inside-span height derivative; non-counted research audit.
- `UNOBSERVABLE_INTERVAL`: data gap prevents deciding whether an event happened; no inference, negative, TP/FP/FN, or count.
- Keep **pilot labels in a separate provenance table**: `PILOT_REPORTED` with approximate tolerance, `INDEPENDENTLY_CORROBORATED`, `UNKNOWN`. This taxonomy is not a production DTO/API or a persisted database schema proposal.

## Regression-first acceptance matrix (not yet authored/run)

| Scenario | Expected source/recognition outcome |
| --- | --- |
| Two continuous-looking gx:Track blocks, boundary inside fast/slow/fast | No bridging across boundary; source segments can each be analyzed independently only after exact lineage proof |
| Three blocks with one empty/malformed/unpaired block | Explicit unavailable or isolated quarantine, no silent drop that fabricates continuity |
| Exact same-timestamp/near-position duplicate within block | Canonical-parity dedup trace explains every source fix; duplicate source references preserved |
| Duplicate same time/position across block boundary | Retained/collapsed provenance preserved, no bridging boundary; ambiguity fails closed |
| Same time, conflicting altitude; same time, conflicting location | Conflict quarantine/fail closed; retained canonical value never treated as independently verified height |
| Source-order inversion and sorting/interleaving blocks | Exact output parity only if all source order/boundary mappings provable; otherwise UNAVAILABLE |
| Distinct submillisecond UTC strings with identical Date.parse ms | Collision edges quarantined, source strings preserved in transient provenance |
| Source gap 35s/94s near an alleged T&G | UNKNOWN / UNOBSERVABLE; no extrapolation through missing data |
| Clean source shape with rolling T&G, with and without corroborated pilot truth | Unverified hypothesis cannot authorize contact; validation tier recorded separately |
| Low-pass/go-around or high-speed taxi with rolling-looking source altitude | No automatic landing count; event class unresolved absent independent truth |
| In-span +15m/0.52s derivative or exactly 25 vs just above 25m/s | Current >25m/s guard unchanged; boundary and suppression reasons tested deterministically |
| V2 zero horizontal points; source unsupported; pilot says no T&G | Three distinct outcomes and no false automatic count or certified data |
| Production feature flag OFF and legacy import saved record | No V2 pilot review surfacing, no change to saved fields or existing canonical import |

## Required next milestone and decision gates

**D3-Native:** Have the owner run existing read-only D1 comparator against six original files from the exact checked-out research SHA, with anonymously paired sample IDs. Expected strict V2 `UNSUPPORTED_SOURCE` for multi-gx:Track; verify rather than asserting execution. No raw input or filenames in posted output. Targeted tests and TypeScript evidence are from an earlier code SHA; a documentation-only commit does not justify a new-HEAD runtime PASS claim.

**D4-Design:** After native source classification, write a detailed source-to-canonical sidecar design and synthetic proof matrix; independent review already delivered (this document). Decide whether to implement a research-only multi-gx:Track parser first or to keep strict unsupported and focus on the existing legacy false-positive safety gate.

**Owner product decision required** before implementing any algorithm extension or changing Pilot Review HIDDEN policy. A research-only provenance parser preserving HIDDEN/OFF/no-count is a narrower, safer scope than rollout of ambiguity review cards.

**Not authorized:** production V2 panel enablement, changed T&G thresholds, automatic landing totals, database reads, migrations, saved-flight rewrites, flight auto-splits, merge, deploy or public GPS accuracy claims.

## Verification ledger

- DeepSeek review: RECEIVED and independently reconciled against actual repository source (read-only); reviewer did not access repo or files.
- Six-file Python reconstruction and owner screenshots: existing Stage D3 evidence, not Node-native V2 run.
- Owner prior local Node 24 targeted 44/44 and TypeScript PASS on earlier `69e7e220`; does not certify this documentation SHA.
- New changes in this milestone: documentation only; typecheck/full suite/build/browser/native six-KML run **NOT RUN** on latest SHA.
- DB/schema/migration: N/A. PR #366 and parent #364 remain draft; no merge/deploy/feature ON.
