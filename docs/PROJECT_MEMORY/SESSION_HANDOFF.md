# FlyTally Logbook — rolling session handoff

**UTC 2026-10-22T07:23:53.813Z — PR #383 first-run native PG16 stall mitigation (DRAFT, not merged/deployed).**

- Independently verified GitHub main: `860df276f7044586834871808e7e3843a10daaac`. Work branch `chore/portable-local-test-workflow-20261022` before this checkpoint: `0648cf031f567f6939f42fe3e96eb886be5c3f46`; PR #383 Draft, base main. This documentation commit advances head; refetch it when resuming.
- Owner-reported Windows result at former work head `d83ea6dd0aaac59d1cba4e4ca9bb68bb8fa73a5b`: `git pull --ff-only` succeeded. `npm run setup:local` printed existing npm dependencies and Chromium then showed no further output for ~2 minutes. **UNKNOWN** whether native PG16 tool probing, initdb, pg_ctl, or Docker caused wait, whether Ctrl+C was applied, and whether an unfinished local data directory exists. Treat status as **BLOCKED/NOT RUN**, not a test PASS.
- Scope: diagnosis and small fix to dev-only PG16 installer visibility and stuck-process behavior; preserve owner data, explicit identity and existing safety gates. DO NOT: no uncontrolled deletes, no adoption of unknown DB, no production/remote DB, no Training repo changes, no merge/deploy/migration/feature flags.
- Changed files since stall: `tooling/local-native-pg16.mjs`, `tooling/local-workflow.mjs`, `tests/local-workflow.test.mjs`, `docs/TESTING_WORKFLOW.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/PROJECT_MEMORY/ACTIVE_WORK.md`, this handoff. Native probes bound to 7 s each; initdb to 90 s and pg_ctl startup to 40 s; native startup messages and child stdout/stderr visible; Docker endpoint/daemon probes bounded 8 s each. Interrupted data directory without ownership marker is marked INCOMPLETE and blocks retries without deletion.
- **Evidence for current change:** GitHub source and SHA inspected; source-only code parsing and 10 syntactic/wiring assertions PASS. These are NOT native Windows Node, database or browser runtime tests. **Exact updated head:** `npm run test:local-workflow` NOT RUN; `npm run test:quick` NOT RUN; typecheck NOT RUN; build NOT RUN; PG16 acceptance NOT RUN; Playwright NOT RUN; CI NOT RUN. Previous head's 7/7 guard PASS and 256/257 failing quick test are historical evidence only.
- Production DB/migration/flags/deploy **NOT ACCESSED/NOT RUN** (actual runtime state UNKNOWN). No product changes and no operation on owner's PC were performed remotely.
- **Single next step:** receive owner's read-only PowerShell results for `Get-Process initdb,pg_ctl,postgres`, existence of `.flytally/persistent-local-pg16` and `.env.test.local`, plus filenames/timestamps in the cluster directory, without posting secret file contents; assess whether partial initialization needs a reviewed recovery path before another setup attempt.

---

**Historical handoff (superseded):**

**UTC 2026-10-22T07:10:41.267Z — DEV-ENV reboot-persistent Windows PG16 candidate on PR #383 (DRAFT, NOT MERGED/DEPLOYED).**

- Verified GitHub main full SHA `860df276f7044586834871808e7e3843a10daaac`. Verified work branch `chore/portable-local-test-workflow-20261022` HEAD before this checkpoint `ae559459aa8766e0d0547d7955edf0165dfc778a`; PR #383 targets main. This handoff commit advances HEAD.
- Scope owner-approved: practical one-command Windows home/office reuse without resetting local PG16 after reboot. Native PG16 controlled data directory under .flytally, marker/PG_VERSION/version/data_directory/user/host/port verification, on-demand pg_ctl restart; Docker named volume/auto-restart alternative with no unverified volume takeover. Dependency/Chromium reuse and script safety tests retained. DO NOT merge/deploy, touch remote/prod databases, change migrations/flags, alter Training, delete non-owned local data.
- New/updated files: `tooling/local-native-pg16.mjs`, `tooling/local-workflow.mjs`, `tests/local-workflow.test.mjs`, `tests/browser-suite-structure.test.ts` (fix stale regex), `docs/TESTING_WORKFLOW.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, `docs/PROJECT_MEMORY/ACTIVE_WORK.md`, this rolling handoff. Legacy PG and browser gate policies preserved.
- Owner-provided actual Windows evidence on historical PR HEAD `c3d86b5bb7af9f7b578ccce8daebfba443e20038`: `setup:local` completed; Node24, npm/Git, psql, Chromium recognized; Docker engine missing; no prior owned local DB. 7/7 `test:local-workflow` PASS; `test:quick` source 256/257 **FAIL** specifically regex expectation for Playwright portable retry change, typecheck PASS, domain N/A, release NOT EVALUATED. Never call this quick run PASS.
- Corrective code pushed to PR for regex plus persistent native Windows PG16 fallback. **Source-only review:** 11/11 custom V8 pure/mock checks PASS for manifest, regex, wiring and volume/restart, JS function-body parse PASS. These checks do NOT constitute Windows Node/npm/psql/Postgres/Playwright acceptance. **On current new head:** native safety test NOT RUN, quick gate NOT RUN, typecheck NOT RUN, full tests/build NOT RUN, PostgreSQL and browser tests NOT RUN, CI NOT RUN; production DB/migrations/flags/deploy UNKNOWN/NOT RUN (no production action).
- Risks: Only psql client has been observed, not whether owner has installed all native PG16 server binaries; first-run Windows creation, stop/reboot/start, and cross-machine setup need concrete owner logs. Failure preserves local files and refuses to adopt unknown DBs. Test browser schema remains intentionally disposable despite persistent cluster backing.
- One next step: owner `git pull --ff-only` on current branch then `npm run setup:local` on this Windows PC; send full diagnostics. Only if setup succeeds, rerun `npm run test:quick` on same HEAD and validate old single source-test failure fixed.

---

**Previous checkpoint (historical):**

**UTC checkpoint:** 2026-10-22T07:08:36.446Z. **Scope: DEV-ENV portable two-PC PG16 persistence + Playwright test contract fix; PR #383 DRAFT, NOT MERGED / NOT DEPLOYED.**

- GitHub verified main SHA: `860df276f7044586834871808e7e3843a10daaac`. Verified work HEAD **before this checkpoint:** `ffb05d301dc2624ca1270f2bb6b22a6501de6e76`, branch `chore/portable-local-test-workflow-20261022`, PR #383 targeting main. This commit advances the branch; refetch HEAD before acting.
- Owner requirement: on home and work Windows PCs stop recreating Postgres environment after reboot; reuse installed Node 24, Playwright, psql and, when present, PostgreSQL 16 server binaries. Preserve product/test accuracy and no runtime/prod changes. **DO NOT:** no merge/deploy, no remote or production database, no migrations, no feature-flag changes, no Training edits, no user flight data, no destructive tests on a non-owned local DB.
- Work files: `tooling/local-native-pg16.mjs` (new), `tooling/local-workflow.mjs`, `tests/local-workflow.test.mjs`, `tests/browser-suite-structure.test.ts`, `docs/TESTING_WORKFLOW.md`, `DEVELOPMENT.md`, `ROADMAP.md`, `CHANGELOG.md`, plus retained PR #383 prior files and this handoff.
- Solution: **persistent native Windows PostgreSQL 16** cluster under gitignored `.flytally/persistent-local-pg16` initializes only once then starts with pg_ctl on subsequent `npm run setup:local` after Windows reboot. Explicit owner marker, PG_VERSION, nonredirected data-directory, localhost port, connected database/user and PG16 physical identity; no takeover of arbitrary services. When full native PG16 tools are absent, local Docker option with persisted named PG16 volume and restart policy. `.env.test.local` keeps per-machine random credentials. Auth browser resets its *disposable test schema* but not the persistent cluster. No automatic external DB operations.
- **Owner-supplied Windows evidence on previous PR HEAD `c3d86b5...`:** `npm run setup:local` succeeded; existing dependencies and Chromium detected; Node24, Git and psql available, Docker unavailable, no local owned test DB yet. `test:local-workflow` **7/7 PASS**. `npm run test:quick`: source gate **256/257 FAIL**, exactly one outdated regex in `tests/browser-suite-structure.test.ts` because portable Playwright retry override was added; TypeScript **PASS**; domain N/A; release NOT EVALUATED. Corrective browser test regex change now on work branch; post-fix Windows test NOT RUN.
- **Source/model evidence for current work:** V8 pure/mock checks of native ownership manifest, source guard and Playwright regex **11/11 PASS**, and JS module bodies parse in a source-only harness. This is **not** native Node24, Windows, PostgreSQL acceptance or Playwright execution. Exact new HEAD: npm guard suite **NOT RUN**, typecheck **NOT RUN**, `test:quick` **NOT RUN**, full tests/build **NOT RUN**, owned PG16/browser **NOT RUN**, CI **NOT RUN**. Existing production DB, migration, flags, deploy status **UNKNOWN/NOT RUN** (no production action attempted).
- Blocker: cannot execute on owner's Windows host; success of PG16 creation/start/resume after reboot and full quick source gate requires owner-PC log. `psql` by itself does not prove that native `initdb`/`pg_ctl` exist.
- **Exactly one next step:** owner runs `git pull --ff-only` then `npm run setup:local` on this branch, and supplies output. This will validate installation detection, owned native PG16 first-run or fail-closed missing-server case. Then rerun quick gate on that tested SHA before any merge consideration.

---

**Prior checkpoint (historical, preserved):**

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
