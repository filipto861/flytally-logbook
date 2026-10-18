# GPS V2 — Stage D4.2 boundary-aware research detector consumption

**Date:** 2026-10-18. **Status: DESIGN ONLY / OWNER APPROVAL AND INDEPENDENT REVIEW REQUIRED BEFORE CODING.**
Repo: `flytally-logbook`. PR #366 research Draft based on PR #364 Draft. No production V2, legacy, logbook counts, DB, app, UI or feature flag change authorized under this design document.

## Dependency / verified state

D4.1 is complete within its narrowly approved **research-only** contract: exact owner-local code HEAD `3fc3cd11` yielded 63/63 targeted Node tests and TypeScript PASS; owner-local original six KMLs at `815c2693` yielded 6/6 native `SOURCE_PARSED_DIAGNOSTIC_ONLY` with 13 source blocks, 4148 original fixes, 4129 canonical fixes, 19 collapsed near-duplicates, 0 dedup altitude conflicts, 7 blocked inter-block evidence edges and 13 unblocked source runs. No production code was edited. The 13 runs are **source-provenance partitions, NOT proof of uninterrupted tracking**. See D4.1 final ledger.

Current strict production-facing V2 source reader (`lib/gps-v2-import-lineage.ts::kmlGxTrack`) rejects any multi-`gx:Track` source, so native V2 returns `UNAVAILABLE/UNSUPPORTED_SOURCE` for all six. D4.1's research sidecar is NOT wired into V2 and must not change this behavior without separately approved D4.2 implementation.

## Read-only discovery — current V2 limitations

- `lib/gps-v2-advisory.ts::inspectGpsV2HorizontalTrack()` establishes exact source/canonical equality and validates optional manual flight split cuts before calling `candidatesInPart()`; it has **no source block boundary input**.
- `candidatesInPart()` derives adjacent horizontal speed edges, quarantines altitude-conflict neighbor edges and equal-JavaScript-millisecond UTC collision neighbor edges. It groups successive non-null velocity edges in `islands()`; candidate rules only produce `DEPARTURE_REVIEW_POINT`, `ARRIVAL_REVIEW_POINT` and `STOP_GO_REVIEW_POINT`, all non-contact advisory hypotheses.
- Current `edge()` refuses nonpositive or >=60-second intervals, or calculated speed >900 km/h, otherwise a non-null velocity edge may be admitted. **A 35-second source gap can still pass that current edge function**. That is not equivalent to verifying motion throughout the 35 missing seconds. A 94-second gap would be refused by this existing rule. Do not infer physical contact or genuine slow duration solely from a long source interpolation-like edge.
- Source segment boundaries, canonical dedup provenance and gap/coverage policy are independent concepts. A missing-evidence period remains `UNKNOWN/UNOBSERVABLE`, not a TP, FP, FN, or proof of zero movement.
- The pilot's reported missed rolling T&G in sample07 fails a separate **in-span** 28.85m/s altitude anomaly guard in the legacy algorithm. Horizontal V2 cannot independently prove wheel contact; D4.2 is NOT authorization to add altitude T&G logic or change 25m/s, 28–145km/h and +30m historical guards.

## Options — decision not made

| Option | Scope | Benefit | Trade-off |
| --- | --- | --- | --- |
| A — **Research-only shadow segmentation consumer (recommended)** | Pure research adapter reads D4.1 sidecar; uses existing canonical points, splitting evidence at source boundaries/quarantine, and computes hypothetical horizontal review points only in owner-local CLI | Validates candidate/event sensitivity against six KMLs without changing source-of-truth or pilot UI; low blast radius | Must maintain a separate read-only algorithm mirror, requires rigorous equivalence tests for one-block source |
| B — Extend production V2 reader/detector while flag OFF | Add source provenance and blocked-edge injection to `lib/`; support multi-block sources when canonical parity and boundary-proof hold | Avoids duplication in research vs production | Larger blast radius, threatens frozen D3 HIDDEN policy and requires full regression/ON-OFF/browser gates; premature before corpus and independent review |
| C — Keep multi-block V2 `UNSUPPORTED_SOURCE` | Research observes only legacy/sidecar | Strongest immediate fail-closed behavior | No V2 candidate analysis for this common source format |

**Recommendation:** D4.2A as a separate, explicitly authorized research milestone after independent design review. Do **not** implement B or promote Pilot Review. Do not treat A as a production feature or automatic landing count.

## Proposed D4.2A recognition input contract (design only)

1. Accept **raw exact source text** and declared KML format plus optional explicit manual split cuts; call D4.1 source-to-canonical proof internally on that exact text, not on caller-forged provenance arrays. Recompute existing canonical output and verify exact source equality before recognition.
2. Prove source block and collapsed duplicate canonical boundaries; enforce D4.1 `blockedEdges` as **hard breaks**. The source run may contain long time gaps or positional anomalies, so compute a distinct edge-validity mask from timed observations. Never label source runs "flight phases".
3. Reject/mark unavailable any candidate whose needed speed observation or context traverses a blocked edge, invalid timestamp edge, plausible-but-unobserved gap, or collapsed conflicting fix. A shadow candidate may be `SOURCE_DISCONTINUITY` / `INCONCLUSIVE` without any pilot-facing exposure; no positive/contact authority.
4. Preserve **manual flight split cuts** as a separate partition dimension. Source blocks must never automatically create flights. Results bind to exact input/split/parser/algorithm revision and become stale on any input modification.
5. Compare candidate output from a single clean gx:Track with the *current* V2 horizontal engine; prove equivalence within the existing supported input class. Any divergence must be explained. For multiple blocks, compare only **potential source-aware hypotheses** against pilot label tiers; event counts are proposals, not actual T&G counts.
6. Keep source-coverage uncertainties explicit: a 35-second sample gap accepted by current `edge()` is **not** observed uninterrupted motion. Do not invent a new GPS sampling interval threshold from two flights. First characterize distributions and false suggestions with independent evidence and propose a source/provenance-based policy. Consider fail-closed status when critical candidate windows rely on unobserved continuity.
7. No raw GPS coordinates, full routes, absolute UTC, registration, pilot identity or aircraft flight IDs in GitHub test fixtures or diagnostic report. Outputs contain only anonymous sample, relative offset, reasons, quality counters and `physicalContact=UNRESOLVED`, `actualLandings=UNAVAILABLE`.
8. Production V2 still returns `UNAVAILABLE/UNSUPPORTED_SOURCE` on multi-block KML until a **separate** owner-approved source parser/detector integration milestone. No legacy modification, auto T&G, total landing count or regulatory recency changes.

## Required synthetic and real-world safety matrix

| ID | Input | Must establish |
| --- | --- | --- |
| D42-01 | One clean gx:Track, no source split | Existing V2 horizontal event-equivalence / non-contact |
| D42-02 | Two blocks with fast→slow→fast crossing boundary at only 4.9s | No synthetic STOP_GO spanning block edge |
| D42-03 | Three blocks with single-fix/empty middle | No bridge; malformed remains `UNAVAILABLE` |
| D42-04 | Adjacent duplicate collapsing across block join | D4.1 boundary quarantine propagates to event evidence windows |
| D42-05 | Same UTC position, conflicting altitude | Retained canonical parity but event evidence quarantine; no contact |
| D42-06 | Two distinct source UTC strings same JS millisecond | Velocity collision and near-edge context invalidated |
| D42-07 | Inside-block gap approx 35s with synthetic apparent slow speed | Unknown continuity; candidate either unavailable/inconclusive, not counted |
| D42-08 | Inside-block gap >60s (e.g. 94s) | Invalid edge, no event bridge |
| D42-09 | Rapidly moving low pass / go-around; taxi/high-speed on ground | No physical-contact proof or landing count |
| D42-10 | Owner-reported rolling T&G with 28.85m/s in-span height spike | No guard relaxation, no source-backed contact claim |
| D42-11 | Manual flight split intersects block boundary; edited source | Both boundaries respected; stale review rejected |
| D42-12 | All six original anonymous source shapes | Redacted source-aware shadow output with source applicability, no invented truth or coordinates |
| D42-13 | Feature flag OFF and production parser unchanged | Existing legacy and V2 `UNAVAILABLE` behavior unaffected |

## Independent DeepSeek review questions (read-only / DO NOT CODE)

Given the D4.1 6/6 successful proof-only sidecar and present V2 edge/islands logic, should D4.2A use a separate shadow copy of the horizontal engine or extract a pure shared internal function from production into research without altering semantics? Which minimizes the chance of source segment boundary bridging and backward compatibility regressions? Specifically analyze 35s valid V2 velocity edge under existing <60s rule and whether a source/provenance-quality signal can fail closed without adding an invented new fixed threshold. Review split/collision/quarantine propagation, one-block equivalence contract, source-run vs timed island semantics, 4.9s boundary controls, and release / D3 HIDDEN flag gates. No new T&G limits or authority claims. Recommend precise acceptance tests and sequencing, including whether D4.2A must avoid any `lib/` refactor until after pilot corpus evidence.

## Governance and verification

- D4.1: DONE **research-only**, owner-local 63/63 targeted + TypeScript PASS and six local KML source parity accepted.
- D4.2: DESIGN ONLY; not coded, tested, approved for implementation or shipped.
- Source reading for this D4.2 design: Github read-only inspection of `lib/gps-v2-advisory.ts`, `lib/gps-v2-import-lineage.ts`, D4.1 pure research sidecar. This design is analysis, not a tested new runtime.
- Full suite/build/Playwright/CI: NOT RUN on this design HEAD. DB/migrations: N/A. Merge/deploy: NOT RUN. Feature flag: unchanged/OFF. Parent pilot candidates HIDDEN until independent approval.
