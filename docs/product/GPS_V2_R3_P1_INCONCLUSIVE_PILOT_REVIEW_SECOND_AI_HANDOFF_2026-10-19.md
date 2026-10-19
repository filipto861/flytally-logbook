# GPS V2 R3-P1 — independent read-only source and UX safety review handoff

Status: PREPARED FOR OPTIONAL EXTERNAL REVIEW; NOT SENT TO OR REVIEWED BY DEEPSEEK/CLAUDE.
Date: 2026-10-19. No original KML, private flight times, exact source GPS fixes or user identities included.

## Brief

The user requests a pilot-review-only treatment for source-height discontinuities that cause frozen legacy rolling-T&G candidate rejection. Research R2-1/R2-2 and owner-private offline R3-0B diagnosis found two overlapping source-height geometry windows rejected by ONE common >25m/s altitude derivative edge. Owner first-person report describes one T&G; physical wheel contact is NOT independently corroborated. Automatic landing-count or regulator evidence from this is prohibited.

Current repo stack:
- Research R2-2 Draft PR #368 closed **as read-only engineering**: 97/97 owner-local targeted tests PASS, TypeScript PASS, six private KML anonymous reports, no prod merge.
- R3 source/contact evidence protocol Draft PR #369, pilot claim REPORTED_CONTACT_UNCORROBORATED and no independent contact truth.
- Exact audited files: components/kml-import-form.tsx, components/gps-import-review-player.tsx, lib/gps-v2-advisory.ts, lib/gps-v2-import-lineage.ts, research/gps-detection-r21/stage-d43-r2-2-legacy-shape-audit.ts, app/(protected)/flights/actions.ts, tests/gps-v2-ui-contract.test.ts, tests/gps-v2-import-lineage.test.ts.
- Current UI automatically PREFILLS legacy landingCount(part) as a proposed reviewed landing total, but allows manual editing. V2 panel is horizontal-only and build-default-OFF, in existing Review GPS track disclosure.
- Native V2 strict source converter rejects multi-gx KML with UNSUPPORTED_SOURCE. Research R2-2 understands more source structure but uses node:crypto and returns aggregate counts only; it is not a browser DTO.

## Proposed direction

P1A: separate research-only, browser-safe, exact source/canonical/split/revision-bound and provenance-aware quality context adapter, narrow supported gx:Track dialect, hard break fail closed. Group overlapping minima by ONE shared bad source edge; never assert T&G or touchdown. Current V2 native multi-gx remains unsupported.
P1B (after P1A verified): flag-OFF-by-default **separate** quality-review card under existing GPS import Review disclosure, with no form value effect, new event/time authority, hidden field, automatic increment or native V2 source eligibility change. Optional seek only with proven index mapping and correctly handled display downsampling.
P1C multi-gx V2 support / automatic algorithm changes deferred; separately approved later.

See docs/product/GPS_V2_R3_P1_INCONCLUSIVE_PILOT_REVIEW_DESIGN_2026-10-19.md for full contract, source inventory, detailed test matrix, gates and Do/Do Not.

## Requested independent questions

1. Does the planned diagnostic-only multi-gx sidecar improperly soften the separate native V2 unsupported-source contract? Would a stricter architectural separation or named third research-only channel be necessary?
2. Can raw qualifying geometry windows ever be grouped into a safe review context by common invalid evidence edge without inventing contact evidence? What additional provenance/boundary gates should fail closed?
3. What exact constraints ensure the browser-safe adapter has strict parity with frozen legacy predicates and previous D4/R1/R2-1/R2-2 diagnostics without importing node:crypto or duplicating unsafe interpretation?
4. How should the existing legacy landingCount() prefill and editable Day/Night split interact with an INCONCLUSIVE warning without misleading a pilot that the quality card verifies a landing?
5. How should seek/index mapping work if the visual player displays downsampled overview points but source diagnostics are full canonical indices?
6. Which small source-local adversarial tests would invalidate this approach? Prioritize block boundary, collapsed duplicate conflicting alt, same-ms collisions, >15s gaps, sensor level step, low pass, split invalidation and stale file.
7. Is P1A/P1B realistically small enough? Recommend smallest safe scope and evidence requirements before UI enablement.

Review rules: READ-ONLY. DO NOT implement or change files; DO NOT propose weakening 25m/s, altitude/speed thresholds, adding automatic T&G, enabling native V2 multi-gx, assuming pilot report is independent contact truth, adding tracking of original locations, or bypassing existing application/manual-flight input validation. Cite verified repo paths and separate fact from proposed design. Return defects, risk ranking, minimal corrective design, required tests and a clear GO/DESIGN-REVISION/NO-GO opinion. The product owner remains final decision maker; second AI is not an authority.
