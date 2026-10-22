# FlyTally Logbook — rolling session handoff

**UTC 2026-10-22T11:50:40.113Z — Isolated PG scale research PR #385 DRAFT, stacked on portable core PR #384; no code tests on reconstructed SHA.**

- **GitHub verified:** repo `filipto861/flytally-logbook`, main `860df276f7044586834871808e7e3843a10daaac`, research branch `test/local-pg-scale-research-20261022` pre-checkpoint HEAD `483b9afe7bd84f8fd6c4ba9b8cd7e912d5e8a383`; PR #385 OPEN/DRAFT targeting `chore/local-windows-workflow-core-20261022`; clean core PR #384 OPEN/DRAFT base main, core HEAD `3016aa59634146a178cc22d9efa5a55577f57058`. Historical mixed PR #383 CLOSED without merge; all history/comments retained. This docs write advances research HEAD, reverify after update.
- **Scope:** exactly separate performance diagnostic/fault isolation: `tests/integration/postgres-v169-production-hardening.test.ts`, `postgres-v230-large-logbook-performance.test.ts`, separate `postgres-v380-full-v20-restore.test.ts` opt-in guard, `tooling/run-postgres-tests.mjs`, optional guarded serial-scale command in `tooling/local-workflow.mjs`/`package.json`, source regressions `tests/local-workflow.test.mjs`. Added `docs/PG_SCALE_INVESTIGATION_20261022.md`, ROADMAP/CHANGELOG and Project Memory. All production SQL, DB schema, benchmark strict thresholds, and canonical full gate untouched.
- **Owner Windows evidence only on historical mixed executable SHA `f2643ca5c1c6fe1d7e70c94e1deaca2cb2eb0728`:** safety **26/26 PASS**; serial scale **12/13**, 100k Pilot Insights Career **4250.504ms > 4000ms FAIL**. Earlier full 42-file PG **121 PASS / 3 FAIL / 39 SKIP FAIL**. Exact reconstructed research SHA tests NOT RUN; standalone dedicated historic full-v20 fixture NOT RUN. Product full release PG gate remains FAIL, not waived. Runtime DB/migrations/feature flags/deploy UNKNOWN and unchanged.
- **DO NOT:** no merge/deploy/production DB or Training, no relax threshold or trust serial diagnostic as release PASS, no reset local DB, no unsupported performance optimization or current user data. Core PR #384 is independent and should not be made contingent on this exploratory diagnostics PR for development convenience; release evidence remains mandatory.
- **Exactly one next step:** independent read-only second-AI review of source-backed plan evidence in `docs/PG_SCALE_INVESTIGATION_20261022.md`, then separately scope any change. In the meantime owner validates core PR #384 on Windows before considering explicit merge approval.

---

**Previous historical checkpoints:**


**UTC 2026-10-22T11:49:55.259Z — Split complete: portable Windows core PR #384 Draft, scale research PR #385 Draft, superseded #383 CLOSED.**

- **Verified GitHub:** repo `filipto861/flytally-logbook`; main `860df276f7044586834871808e7e3843a10daaac`; core branch `chore/local-windows-workflow-core-20261022` pre-checkpoint work HEAD `23f6987ad7e4b253c9129850bec331efe86ab9ac`; PR #384 OPEN/DRAFT, base main. Research branch `test/local-pg-scale-research-20261022` derived from core commit `a91d5a8ade46973539cfd93a8ac59c04bd4568c0`, PR #385 OPEN/DRAFT with base core; original mixed #383 CLOSED unmerged, commits/comments retained. After this checkpoint write work head changes and must be reverified.
- **Code/scope:** clean PR #384 has 14 original diff files: `tooling/local-workflow.mjs`, `tooling/local-native-pg16.mjs`, owned PG16 read-only diagnosis/finalization/PowerShell recovery, 8 package scripts, `playwright.config.mjs`, browser-suite source contract, 22 core `tests/local-workflow.test.mjs` contracts, `AGENTS.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/TESTING_WORKFLOW.md`. Plus this handoff and ACTIVE_WORK checkpoint docs. The clean branch does **NOT** alter `tooling/run-postgres-tests.mjs`, `postgres-v169...`, `postgres-v230...`, `postgres-v380-full-v20...`, any product SQL/schema/rules, strict scale limits or original risk planner. Only research PR #385 changes those test/diagnostic modules with no product SQL, based directly on core; verified compare showed 0 behind and only 10 independent research changed-file paths. Original #383 is historical only, do not merge it.
- **Prior owner Windows evidence BOUND TO OLD SHA `f2643ca5c1c6fe1d7e70c94e1deaca2cb2eb0728`:** `npm run test:local-workflow` 26/26 PASS on mixed branch, owned native PG16 exact physical loopback identity PASS; guarded scale diagnostic 13 tests / 12 PASS / 1 FAIL, currently failing `pilotInsightsCareer100k` 4250.504ms > unchanged 4000ms. Previous 42-file PostgreSQL full acceptance on earlier mixed SHA 121 PASS / 3 FAIL / 39 SKIP overall FAIL. Some dedicated historical v20 tests remain separately NOT RUN. These older results **DO NOT verify** the reconstructed core new SHA, and a working local fixture does not mean full release PASS.
- **Verification status clean PR #384:** GitHub diff/source invariant inspection PASS (22 core test registrations, strict PG/browser guard, no performance research modules, 8 scripts). Owner Windows Node24 safety, quick source/typecheck, build, Playwright U3, full PG, second PC setup/reboot, CI and release evidence on exact new clean HEAD **NOT RUN**. Production DB/migrations/feature flags/deploy actual runtime UNKNOWN; none changed.
- **DO NOT:** no merge or deploy without explicit owner approval after new candidate-bound tests. No remote/prod DB or real pilot/GPS records, no local fixture reset/reinitialization, no Training repo, no silent scale threshold relaxation or counting research fixture PASS as release. Do not merge/close/erase the research PR before proper review. Frozen core design keeps original risk gates.
- **Exactly one next step:** owner Windows, with clean git status, run `git fetch origin`, `git switch --track origin/chore/local-windows-workflow-core-20261022`, `npm run test:local-workflow`, and only on PASS `npm run test:quick`; share sanitized exact-SHA output. If switching to existing local branch use `git switch chore/local-windows-workflow-core-20261022`. Then re-evaluate Browser U3 and merge authorization.

---

**Previous historical checkpoints:**


**Recorded:** 2026-10-21. **Classification:** documentation snapshot; independently verify all references on resumption.

## Repo and observed baseline
- Repository: `filipto861/flytally-logbook`; `filipto861/flytally-training` is a **separate project**.
- Observed latest GitHub `main` commit at discovery: `8099149f72d493c34dd59babf65bdb064ff99fc9` (GPS V2 cleanup documentation). **Not a perpetual live SHA.**
- Source-of-truth status, version, release order: [ROADMAP](../../ROADMAP.md), [FEATURES](../../FEATURES.md), [CHANGELOG](../../CHANGELOG.md). Re-read relevant portions and actual source/PRs rather than using this dated snapshot as release truth.
- Present work: see [ACTIVE_WORK](ACTIVE_WORK.md) for discovered PRs and their independent gates.

## This milestone
- Scoped documentation-only work branch `docs/session-continuity-20261021`: add persistent cross-chat handoff/checkpoint rules and pointers to the existing AI reviewer template.
- Existing product code, authenticated routes, certified-flight revision history, regulatory logic, PostgreSQL/Neon data, GPS importer, Vercel configuration and `main`: **unchanged by the proposal**.
- Validation: GitHub source inspection and branch/PR inventory. **NOT RUN:** local npm tests, typecheck, build, database/browser tests, CI and deployment. Never call these PASS without evidence on exact SHA.

## One next action
Review and explicitly approve or reject the dedicated documentation PR; no merge or production deployment implied. On next implementation session, first re-fetch actual GitHub branch state and [ACTIVE_WORK](ACTIVE_WORK.md), then continue only the selected scoped PR.

## Checkpoint fields for the next session
Update after an owner decision, completed milestone, new blocker, PR change or session switch: UTC time; verified `main` SHA; work branch/head; PR; approved scope and DO NOT; files touched; observed exact-head evidence; private/local-only blockers; one smallest next step. Mark unknown or unrun gates accurately. See [protocol](HANDOFF_PROTOCOL.md) and [original full reviewer handoff template](../AI_HANDOFF_TEMPLATE.md).
