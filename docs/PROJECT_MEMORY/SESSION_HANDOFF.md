# FlyTally Logbook — rolling session handoff

**UTC 2026-10-22T11:54:06.604Z — Core PR #384 includes essential historic-v20 test-selection safety (23 core tests); scale research remains separate #385.**

- **Verified GitHub:** main full SHA `860df276f7044586834871808e7e3843a10daaac`; core work `chore/local-windows-workflow-core-20261022` pre-checkpoint full SHA `a7705bd9392eb5b83a66111f6c8e7a8941784293`; PR #384 OPEN/DRAFT base main, PR #385 OPEN/DRAFT based on core; archived #383 CLOSED/unmerged with history intact. This checkpoint advances core HEAD. Product development U3 remains separate.
- **Scoped code correction after clean extraction:** `tests/integration/postgres-v380-full-v20-restore.test.ts` now demands explicit independent full-v20 opt-in rather than treating generic PG gate as authorization; `tests/local-workflow.test.mjs` includes the tested nested-node negative regression with NODE_TEST_CONTEXT stripped, total **23** core safety tests. No full v20 restore acceptance performed, no separate DB reset. Original v169/v230 scale SQL/benchmarks and optional serial-scale diagnostic remain **only** in research PR #385. No change to `tooling/run-postgres-tests.mjs`, app SQL, DB schema, performance thresholds, release planner, production features. AGENTS, ROADMAP, CHANGELOG, permanent testing runbook and PR #384 body updated accordingly.
- **Actual owner evidence:** previous Windows Node24 mixed PR #383 executable SHA `f2643ca5c1c6fe1d7e70c94e1deaca2cb2eb0728`: 26/26 source safety PASS and exact native PG16 local identity PASS. On a previous mixed SHA generic 42-file PG run 121 PASS / 3 FAIL / 39 SKIP (scale FAIL, dedicated full-v20 tests skipped safely). Last serial scale 12/13 FAIL (100k Pilot Insights Career 4250.504ms > 4000ms). Historical evidence **cannot transfer to reconstructed clean HEAD**: exact new core safety 23/23, quick/typecheck, build, Playwright, full PG, CI, reboot reuse, second Windows PC are **NOT RUN**.
- **DB/deploy/flags:** production remote DB/runtime migration/deploy/feature flag state UNKNOWN; no such change attempted. Only scoped test tools on branch; no merge/deploy/main update. No actual user flight/GPS records or credentials used in checkpoint.
- **DO NOT:** do not merge either PR without explicit Filip approval and SHA-bound acceptance, no remote/prod DB operations, no false full-PG release PASS or threshold relaxation, no wiping/disabling valid local fixture, no Training changes, no releasing performance research as part of core.
- **Exactly one next step:** owner Windows `git status --short`, `git fetch origin`, `git switch --track origin/chore/local-windows-workflow-core-20261022`, `npm run test:local-workflow`, then if PASS `npm run test:quick`. Send sanitized logs; if already checked out, omit --track. After exact-head verification, discuss explicit merge authorization, then continue original Browser U3 work.

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
