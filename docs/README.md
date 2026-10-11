# FlyTally Logbook — documentation index

**Reviewed:** 11 October 2026. **Scope:** `flytally-logbook` only. `flytally-training` has separate code and governance.

## Canonical current sources

- [AI contributor entrypoint](../AGENTS.md) — stable repo-bound guardrails and navigation only; never duplicates current release state.
- [AI handoff + independent review template](AI_HANDOFF_TEMPLATE.md) — SHA-bound minimal context for new sessions, independent read-only AI review and evidence ledger.

1. [ROADMAP](../ROADMAP.md) — current status, release order, frozen decisions, acceptance gates and next step.
2. [FEATURE LIST](../FEATURES.md) — implemented/planned capability inventory and intentionally unavailable behavior.
3. [CHANGELOG](../CHANGELOG.md) — actual merged changes, dated production/data actions and historical verification evidence.
4. [ARCHITECTURE](../ARCHITECTURE.md) — runtime, canonical data model and domain/security boundaries.
5. [DEVELOPMENT](../DEVELOPMENT.md) — local/CI test policy, branch/PR workflow, DB acceptance and deploy discipline.
6. [VERSIONING](product/VERSIONING.md) — semantic release numbering versus independent technical schema/format counters.

**Precedence:** actual code/runtime evidence → ROADMAP → FEATURES → CHANGELOG → architecture/development → active detailed contracts → dated acceptance → history. If these conflict, reconcile before implementation. A merged build is not an accepted full release.

## Completed documentation / AI-development governance review (11 October 2026)

- [11 October documentation inventory and AI workflow proposal](maintenance/2026-10-11-documentation-ai-workflow-audit.md) — 123-file inventory, link-scan limits and source-of-truth drift; reviewed with DeepSeek and owner-approved as a phased, non-destructive docs/AI governance workstream.
- [DeepSeek independent-review brief](maintenance/2026-10-11-deepseek-ai-workflow-review-brief.md) — reviewer input contract and explicit no-implementation scope; independent reply received.
- [DeepSeek review reconciliation](maintenance/2026-10-11-deepseek-review-reconciliation.md) — actual PR #312 diff checked and review findings reconciled; owner subsequently approved minimum document ownership, pointer-only AGENTS, history preservation and report-only checker. DOC-1 status ownership merged in PR #313, DOC-2 history preservation merged in PR #314, DOC-3 stable AGENTS + handoff merged in PR #315; DOC-4 report-only checks merged in PR #316; [DOC-5 final workflow/documentation reconciliation](maintenance/2026-10-11-doc5-ai-governance-closeout.md) records accepted scope and verification limits (merged PR #317). No outstanding DOC review gate remains.

- [Active development execution contract](../DEVELOPMENT.md) and [verbatim 0B/0E/0F test infrastructure history](history/DEVELOPMENT_PHASE0_VERIFICATION_HISTORY.md) — historical registry/test counts and “not active yet” notices are dated, not current instructions.

- [Documentation consistency report (optional)](scripts/README.md) — read-only Node command and isolated fixtures; not a merge gate, CI PASS or replacement for source/UX/DB evidence.

## 3.7.0 completed release / retained technical acceptance

- [3.7.0 production/owner-acceptance closeout](product/3_7_0_FINAL_PRODUCTION_ACCEPTANCE_2026-10-11.md) — release `39ee01b7`, Vercel READY and alias assigned, owner-reported functional signoff, explicitly unverified external rights; version release is NOT provider/commercial clearance.
- [Maps and Aviation Layers design/source contract](product/3_7_0_MAPS_AVIATION_LAYERS.md) — **historical phase-0/phase-1 architecture with some stale in-document status**; current release status is in ROADMAP.
- [Independent review reconciliation](product/3_7_0_MAPS_REVIEW_RECONCILIATION.md) — historical review conditions and provider gates.
- [Standard Maps Phase 1 acceptance](product/3_7_0_PHASE1_TEST_ACCEPTANCE.md) — completed/merged standard-only acceptance evidence; prior candidate and test failures retained.
- [Satellite endpoint security acceptance](product/3_7_0_SATELLITE_AUTH_SECURITY_ACCEPTANCE.md) — production auth/privacy containment and outstanding provider gates.
- [A2D combined Aviation acceptance](product/3_7_0_A2D_COMBINED_AVIATION_OVERLAY_ACCEPTANCE.md) — merged Aviation and documented provider/provenance limits.
- [A2E Map settings acceptance](product/3_7_0_A2E_MAP_SETTINGS_ACCEPTANCE.md) — merged protected map controls and earlier test sequences.
- [A2F zoom/menu acceptance](product/3_7_0_A2F_MAP_OVERLAY_ZOOM_POLISH_ACCEPTANCE.md) — merged z14 native/z18 display behavior, test and production evidence.
- [Maps review handoff](product/3_7_0_MAPS_REVIEW_HANDOFF.md) — **dated reviewer questions**, not an instruction to repeat already settled design decisions.

**Product release:** `3.7.0` is **DONE / PRODUCTION** as of 11 October (version, Vercel READY, target alias and owner UX acceptance). Direct post-release browser/HTTP smoke was unavailable here, and third-party map-provider rights/coverage/quotas remain separately unverified; do not infer external permissions from product version or functional acceptance.

## 3.8.0 active discovery

- [3.8.0 Currency / monetary semantics](product/3_8_0_CURRENCY_MONETARY_SEMANTICS.md) — source inventory and M0–M6 plan. [Reconciled DeepSeek review and owner D4 approval](product/3_8_0_CURRENCY_REVIEW_RECONCILIATION.md): **all current ISO 4217 monetary currencies** with authoritative minor-unit precision; D1–D3 and runtime/schema remain pending. [Historical review brief](product/3_8_0_CURRENCY_INDEPENDENT_REVIEW_BRIEF.md); issue #136. No FX or retroactive currency assignment.

## Active cross-cutting contracts

- [Design language](design-language.md) and [UI/UX audit](ux-audit.md) — visual/design audit and historical closeout.
- [Multi-aircraft canonical scale](product/MULTI_AIRCRAFT_SCALE_CONTRACT.md) — profile/flight applicability and future scale validation.
- [GPS touch-and-go reliability](product/GPS_TOUCH_AND_GO_RELIABILITY.md) — supported fixes and separately evidenced research follow-up.
- [Safety Pilot / PIC shared flight](product/SAFETY_PILOT_PIC_WORKFLOW.md) and [General PIC invitation](product/GENERAL_PIC_INVITATION.md) — explicit role/participant evidence.
- [Certified-flight voiding (3.5.0)](product/3_5_0_CERTIFIED_FLIGHT_VOIDING.md) — dated source/verification contract for protected archive, active-flight exclusion, participant provenance and backup v13; use current code/tests and [ARCHITECTURE](../ARCHITECTURE.md) for active invariants, not historical draft status.
- [Compliance records](compliance/) — regulatory/claims engineering boundaries, source snapshots and evidence matrices; **not** external approval.
- [Certification-readiness](certification-readiness/) — retained earlier verification specifications and evidence; **not** proof of current authority certification.

## Completed milestone evidence / historic design

- `product/3_6_0_*`, `product/3_5_*` and `product/3_4_*` — dated accepted release evidence, design/verification records and their earlier candidate states. These are not current execution instructions.
- `product/FLIGHT_ENTRY_*`, `product/UI_UX_SIMPLICITY_*` and `product/V3_0_UX_CONSOLIDATION.md` — workflow and UX milestone history; use the canonical model in FEATURES/ARCHITECTURE for current behavior.
- [History](history/README.md) — old scopes, audits, snapshots and retained regulatory evidence. Verbatim pre-cleanup [ROADMAP](history/ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) and [FEATURE LIST](history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) preserve the prior full narratives.
- [Maintenance audit](maintenance/2026-10-10-repository-audit.md) — dated GitHub branch/PR inventory and cleanup safety gates; counts are a snapshot.
- [Historical PR triage](maintenance/2026-10-10-open-pr-triage.md) — 10 October read-only snapshot of legacy R1/R2 drafts, **all closed without merge on 11 October**; the ten obsolete branch refs were subsequently deleted with their independent history roots retained through three archive tags (see branch pruning closeout).
- [M2A code audit](maintenance/2026-10-10-r2-m2a-source-audit.md) — dated source comparison for now-abandoned R1/R2 experiments; not an active port roadmap.
- [Branch pruning closeout](maintenance/2026-10-11-branch-prune-preflight.md) — SHA-pinned preflight and two owner-executed, GitHub-verified cleanup batches: 10 abandoned Satellite branches plus 6 fully-merged legacy branches removed; 3 archive tags and the pre-F3 anchor retained.

**Rules for archiving:** classify active contracts, completed milestone evidence, superseded proposals and retained compliance records separately. No history deletion, silent code-path rename or blanket merge of old stacked branches. Check backlinks and GitHub PR references before moving documents.
