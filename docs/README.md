# FlyTally Logbook — documentation index

**Reviewed:** 10 October 2026. **Scope:** `flytally-logbook` only. `flytally-training` has separate code and governance.

## Canonical current sources

1. [ROADMAP](../ROADMAP.md) — current status, release order, frozen decisions, acceptance gates and next step.
2. [FEATURE LIST](../FEATURES.md) — implemented/planned capability inventory and intentionally unavailable behavior.
3. [CHANGELOG](../CHANGELOG.md) — actual merged changes, dated production/data actions and historical verification evidence.
4. [ARCHITECTURE](../ARCHITECTURE.md) — runtime, canonical data model and domain/security boundaries.
5. [DEVELOPMENT](../DEVELOPMENT.md) — local/CI test policy, branch/PR workflow, DB acceptance and deploy discipline.
6. [VERSIONING](product/VERSIONING.md) — semantic release numbering versus independent technical schema/format counters.

**Precedence:** actual code/runtime evidence → ROADMAP → FEATURES → CHANGELOG → architecture/development → active detailed contracts → dated acceptance → history. If these conflict, reconcile before implementation. A merged build is not an accepted full release.

## Active 3.7.0 support and acceptance records

- [Maps and Aviation Layers design/source contract](product/3_7_0_MAPS_AVIATION_LAYERS.md) — **historical phase-0/phase-1 architecture with some stale in-document status**; current release status is in ROADMAP.
- [Independent review reconciliation](product/3_7_0_MAPS_REVIEW_RECONCILIATION.md) — historical review conditions and provider gates.
- [Standard Maps Phase 1 acceptance](product/3_7_0_PHASE1_TEST_ACCEPTANCE.md) — completed/merged standard-only acceptance evidence; prior candidate and test failures retained.
- [Satellite endpoint security acceptance](product/3_7_0_SATELLITE_AUTH_SECURITY_ACCEPTANCE.md) — production auth/privacy containment and outstanding provider gates.
- [A2D combined Aviation acceptance](product/3_7_0_A2D_COMBINED_AVIATION_OVERLAY_ACCEPTANCE.md) — merged Aviation and documented provider/provenance limits.
- [A2E Map settings acceptance](product/3_7_0_A2E_MAP_SETTINGS_ACCEPTANCE.md) — merged protected map controls and earlier test sequences.
- [A2F zoom/menu acceptance](product/3_7_0_A2F_MAP_OVERLAY_ZOOM_POLISH_ACCEPTANCE.md) — merged z14 native/z18 display behavior, test and production evidence.
- [Maps review handoff](product/3_7_0_MAPS_REVIEW_HANDOFF.md) — **dated reviewer questions**, not an instruction to repeat already settled design decisions.

**Known open release gates:** signed-in production map/proxy/high-zoom and theme checks, native Safari iPad orientations, documented provider permissions/coverage/freshness/quotas and explicit final 3.7.0 release decision. The current `3.6.0` product version remains unchanged.

## Active cross-cutting contracts

- [Design language](design-language.md) and [UI/UX audit](ux-audit.md) — visual/design audit and historical closeout.
- [Multi-aircraft canonical scale](product/MULTI_AIRCRAFT_SCALE_CONTRACT.md) — profile/flight applicability and future scale validation.
- [GPS touch-and-go reliability](product/GPS_TOUCH_AND_GO_RELIABILITY.md) — supported fixes and separately evidenced research follow-up.
- [Safety Pilot / PIC shared flight](product/SAFETY_PILOT_PIC_WORKFLOW.md) and [General PIC invitation](product/GENERAL_PIC_INVITATION.md) — explicit role/participant evidence.
- [Compliance records](compliance/) — regulatory/claims engineering boundaries, source snapshots and evidence matrices; **not** external approval.
- [Certification-readiness](certification-readiness/) — retained earlier verification specifications and evidence; **not** proof of current authority certification.

## Completed milestone evidence / historic design

- `product/3_6_0_*`, `product/3_5_*` and `product/3_4_*` — dated accepted release evidence, design/verification records and their earlier candidate states. These are not current execution instructions.
- `product/FLIGHT_ENTRY_*`, `product/UI_UX_SIMPLICITY_*` and `product/V3_0_UX_CONSOLIDATION.md` — workflow and UX milestone history; use the canonical model in FEATURES/ARCHITECTURE for current behavior.
- [History](history/README.md) — old scopes, audits, snapshots and retained regulatory evidence. Verbatim pre-cleanup [ROADMAP](history/ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) and [FEATURE LIST](history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) preserve the prior full narratives.
- [Maintenance audit](maintenance/2026-10-10-repository-audit.md) — dated GitHub branch/PR inventory and cleanup safety gates; counts are a snapshot.

**Rules for archiving:** classify active contracts, completed milestone evidence, superseded proposals and retained compliance records separately. No history deletion, silent code-path rename or blanket merge of old stacked branches. Check backlinks and GitHub PR references before moving documents.
