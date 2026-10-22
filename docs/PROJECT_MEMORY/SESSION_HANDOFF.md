# FlyTally Logbook — rolling session handoff

**UTC checkpoint:** 2026-10-22T06:46:39Z. **Status: DEV-ENV PR #383 hardened, owner-PC acceptance NOT RUN; no merge/deploy.**

- Repository filipto861/flytally-logbook. GitHub-verified **main**: `860df276f7044586834871808e7e3843a10daaac`. Work branch `chore/portable-local-test-workflow-20261022`, PR **#383** open Draft targeting main; verified **pre-checkpoint HEAD** `f5f522012a4f5a40ff2098b9d67f1dd3d319fb13`. This checkpoint advances HEAD; refetch PR/base and HEAD next session.
- Scope approved by Filip: Logbook prioritized; one-command incremental setup across two Windows PCs, reuse installed npm/Chromium, isolated owned PG16, guarded quick/risk release + DB/browser acceptance; documentation and automated safety tests. **DO NOT:** no Training repository or shared DB, remote Neon/prod changes, migrations, flags, merge or deployment without separate approval.
- **Files on scoped branch:** `tooling/local-workflow.mjs`, `tests/local-workflow.test.mjs`, `package.json`, `playwright.config.mjs`, `docs/TESTING_WORKFLOW.md`, `AGENTS.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, this Project Memory document and `ACTIVE_WORK.md`.
- **New technical safety:** a localhost URL alone is not trusted for destructive acceptance; check local-only Docker endpoint, exact named image/container, user/database/password, sole 127.0.0.1 port binding, running state and pg_isready. Setup starts existing verified fixture or creates new; waits for readiness; never silently adopts a different DB. Explicit blank DB env masks potential `.env.local` prod fallback; browser acceptance prohibits stale server reuse. Full release calls canonical risk planner and only requires Docker when PG/scale/browser selected. `npm run setup:local` now executes local-workflow guard tests.
- **Evidence for current work:** GitHub fetched source and branch state; isolated V8 **mock simulation 8/8 scenarios**, including local/remote DB and container rejection and risk/no-DB decision. This simulation is NOT Node24/on-machine integration evidence. **NOT RUN** on exact PR source: native Node `npm run test:local-workflow`, TypeScript, full suite, build, Docker PG16, actual PostgreSQL acceptance, Playwright/browser and CI. Database/migration/feature-flag/deploy runtime status **UNKNOWN/NOT RUN**; no production action executed here.
- **Blocker:** cannot access either of Filip's real Windows PCs from this environment; cannot truthfully verify Docker/psql or local browser acceptance. Training PR #291 is independent and not modified in this continuation.
- **One next step:** on one Windows PC, checkout Draft PR #383 on an appropriate branch and run `npm run setup:local`; capture its exact output (including guard test) to verify true Node24/Docker execution. Then repeat on the second PC and run candidate-risk gates before any merge request.

---

**Prior dated checkpoint (historical, preserved):**

**UTC checkpoint:** 2026-10-22T06:27:00Z. **Status: DEV-ENV local test workflow draft PR #383; NOT MERGED / NOT DEPLOYED.**

- **Verified GitHub main:** 860df276f7044586834871808e7e3843a10daaac. **Verified implementation/work branch HEAD before this checkpoint:** bdbc9f60067caa0b862d30b13b87903dffb4932d on chore/portable-local-test-workflow-20261022; PR #383, base main. This checkpoint commit itself advances the work branch; refetch live head and PR before continuing.
- **Filip-approved scope:** two Windows PCs; preserve already installed tools; one-command incremental local setup + isolated disposable PG16 + guarded quick/full/DB/browser test wrappers and durable docs. **DO NOT:** no Training DB, no remote/prod Neon, no flight data, no migrations, no flags, no merge/deploy, no rewriting canonical risk gates. No auto-prefill or product behavior changes.
- **Changed scope/files:** tooling/local-workflow.mjs, tests/local-workflow.test.mjs, package.json, playwright.config.mjs, docs/TESTING_WORKFLOW.md, AGENTS.md, DEVELOPMENT.md, ROADMAP.md, CHANGELOG.md, and these Project Memory pointers. Existing PostgreSQL/browser gates reused; wrapper prevents Playwright reuse of an unrelated web server, disallows remote Docker contexts, and masks remote DB URLs Next.js might otherwise load from .env.local.
- **SHA-bound evidence:** GitHub content, branch, tree and PR creation inspected. Node24 local tests **NOT RUN**, TypeScript **NOT RUN**, npm full tests **NOT RUN**, build **NOT RUN**, PG16 integration **NOT RUN**, Playwright **NOT RUN**, CI **NOT RUN**. Source inspection is not PASS. Disposable DB state **UNKNOWN**, migrations **NOT RUN**, feature flags **UNCHANGED by proposal**, production DB **NOT ACCESSED**, deploy **NOT RUN**.
- **Blocker:** no access to Filip's home/office Windows environment for true setup/fixture acceptance. Training has separate draft PR #291 with safe non-DB setup and Neon HTTP compatibility blocker (plain PostgreSQL TCP would be incompatible).
- **One next step:** run npm run doctor / setup:local / test:local-workflow on both Windows PCs and post exact command evidence to PR #383; then test selected canonical risk/PG/browser gates before explicit merge consideration.

---

**Previous dated checkpoint (historical; superseded by the current one):**

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
