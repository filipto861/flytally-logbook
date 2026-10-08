# FlyTally Logbook documentation

This directory contains supporting documentation for the Logbook repository.

## Active documentation

- `../ROADMAP.md` — canonical implementation order and current phase.
- `../FEATURES.md` — canonical feature/capability inventory.
- `../CHANGELOG.md` — actual merged/product changes.
- `../ARCHITECTURE.md` — architecture and domain boundaries.
- `../DEVELOPMENT.md` — development, verification and deployment workflow.
- `design-language.md` — active design-language guidance.
- `ux-audit.md` — current design/UI audit findings and closeout history.
- `product/3_6_0_PHASE0_ENGINEERING_QUALITY.md` — active 3.6.0 pre-runtime engineering quality, test-architecture and development-workflow gate.
- `product/3_6_0_PHASE1_TIMEZONE_SEMANTICS.md` — active 3.6.0 saved-date/timezone semantic contract and implementation milestones.
- `product/V3_0_UX_CONSOLIDATION.md` — detailed UX/product consolidation record.
- `product/MULTI_AIRCRAFT_SCALE_CONTRACT.md` — active Multi-aircraft source-of-truth contract.
- `product/GPS_TOUCH_AND_GO_RELIABILITY.md` — Priority 1 GPS landing-detection investigation contract.
- `product/SAFETY_PILOT_PIC_WORKFLOW.md` — Priority 2 Safety Pilot ↔ PIC workflow/data-model contract.
- `compliance/` — active compliance/commercial-validation engineering documentation, including the current FCL.050 implementation baseline and evidence matrix.
- `certification-readiness/` — retained certification-readiness evidence from an older release baseline; useful for provenance, but not current release status.

## Historical documentation

`history/` contains old release scopes, audits, regulatory baselines and the previous long-form roadmap.

Historical documents are retained for evidence and decision context. They are **not** the current source of truth for implementation order or product status.

If a historical file conflicts with `ROADMAP.md`, `FEATURES.md`, current architecture, tests or code, reconcile the conflict before implementation rather than guessing.
