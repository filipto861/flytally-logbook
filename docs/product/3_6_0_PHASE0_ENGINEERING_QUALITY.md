# 3.6.0 Phase 0 — Engineering quality and test architecture gate

**Status:** ACTIVE audit / design gate  
**Production baseline:** 3.5.5  
**Target release:** 3.6.0  
**Runtime product change in this phase:** none  
**PostgreSQL migration in this phase:** none expected

## Purpose

Before implementing 3.6.0 saved-date / timezone semantics, harden the repository's testing and development workflow so release evidence is deterministic, fail-closed and maintainable.

This is not a rewrite of the test suite. Existing tests remain evidence unless a specific defect, duplication, stale implementation assertion or coverage gap justifies changing them.

The 3.6.0 timezone/runtime implementation is blocked until the mandatory Phase 0 acceptance criteria below are satisfied.

## Reconstructed baseline

Repository audit against `main@8b8a008b7ce1049652eaf24303d5e73ff641e2f4` found:

- 793 repository files.
- 381 application source files under `app/`, `components/` and `lib/` when counting TypeScript/TSX/CSS.
- 272 `*.test.ts` files:
  - 33 PostgreSQL integration/scale files under `tests/integration/`;
  - 204 historical version/milestone-named test files;
  - 35 non-versioned/domain-named test files.
- Playwright has three E2E support/spec files; `e2e/public-shell.spec.mjs` is about 126 kB / 2,014 lines and currently contains 48 Playwright tests.
- `tooling/development-modules.json` matches only 121 of 381 audited application TypeScript/TSX/CSS files (31.8%); 260 files currently fall outside a named product module.
- The current `test:ui` command contains 16 manually listed test files, while `development-scope.mjs` recognizes only 11 files as its fast-UI set.
- Five old pull requests remain open and more than twenty non-`main` branches remain in the repository. They require supersession review before cleanup.

These counts describe source structure only. No test/build command is claimed as rerun by this audit.

## Findings

### P0 — PostgreSQL commands are not fail-closed locally

`tooling/run-postgres-tests.mjs` launches the selected PostgreSQL test files with the caller's environment unchanged.

All **33/33** PostgreSQL integration/scale files were inspected and reference:

`process.env.FLYTALLY_POSTGRES_INTEGRATION === "1"`

as the suite-level integration intent. The existing files then use that state to bypass setup and/or skip PostgreSQL cases when the flag is absent. The blast radius is therefore suite-wide, not an isolated test-file defect.

Therefore:

- `npm run test:postgres`;
- `npm run test:postgres:full`; and
- the PostgreSQL portion of `npm run verify:release`

can be invoked without the integration flag and may complete with PostgreSQL cases skipped instead of proving database acceptance.

GitHub's manual workflow explicitly sets the flag, but the documented local commands do not.

**Required correction:** when a PostgreSQL gate is explicitly invoked it must either execute the selected PostgreSQL tests or fail before the test run with a clear configuration/preflight error. Missing configuration must never look like acceptance.

### P0 — Development scope metadata is too coarse to be authoritative

The current module registry covers only 31.8% of audited application source files.

The current classifier also:

- treats every `.css` file as lightweight/documentation-style;
- treats essentially every non-lightweight application TS/TSX change as requiring PostgreSQL acceptance;
- reports module/risk flags but does not deterministically map changed code to the relevant targeted test files;
- therefore does not yet implement the intended risk-based test-selection contract.

Unknown shared code should remain conservative, but presentation-only code must not automatically imply PostgreSQL risk, and CSS must not be confused with documentation.

### P1 — Fast UI lists have already drifted

`package.json:test:ui` and `development-scope.mjs:fastUiTests` maintain separate manual lists and already disagree (16 vs 11 files).

This is exactly the duplication the module registry was intended to prevent.

**Required correction:** one source of truth for suite membership.

### P1 — DEVELOPMENT documentation and executable workflow have drifted

`DEVELOPMENT.md` states that `development-scope.mjs` is consumed locally and in GitHub Actions. The current manual verification workflows do not invoke it.

Documentation must describe actual executable behavior; future scope logic must not rely on a path that is not wired into the workflow.

### P1 — Browser runner version is not locally reproducible

`@playwright/test` is not a direct development dependency in `package.json`. The manual GitHub Browser smoke workflow installs `@playwright/test@1.55.0` ad hoc, while local instructions use `npx playwright`.

That permits local/cloud runner drift.

**Required correction:** pin the browser test runner in the repository and use the same locked dependency locally and in the manual cloud workflow.

### P1 — Browser suite is a growing monolith

`e2e/public-shell.spec.mjs` now combines public auth-boundary smoke, authenticated product navigation, flight-entry contracts, certification/voiding, settings/connections mutations and several responsive/theme matrices.

The shared mutable PostgreSQL fixture correctly requires serialized execution, but serialization does not require one 2,000-line spec file.

The suite also contains multiple tests that manage their own viewport/theme matrices while the Playwright configuration has desktop and mobile projects. Only one project-specific skip check was found in the monolithic spec, so some matrix work is likely duplicated across projects.

**Required correction:** split by stable domain while keeping one shared DB worker unless independent per-worker fixtures are introduced.

### P1 — Source-regression tests need an explicit taxonomy

A substantial amount of UI/governance coverage intentionally reads source files and asserts exact CSS/JSX/workflow text. Examples include 3.5.4/3.5.5 visual guards, pipeline governance tests and the large UI consistency audit.

These guards are useful, but they are not equivalent to behavioral unit tests or browser acceptance. Exact-text assertions also create stale-test churn when implementation changes without changing behavior.

**Required correction:** retain source-contract tests where valuable, but classify them separately and prefer behavioral/domain/browser evidence for product semantics.

### P2 — Test naming is dominated by historical milestone IDs

204 of 272 test files use historical version/milestone naming.

Do not mass-rename them: that would create large churn without improving runtime confidence.

**Direction:** freeze historical names for traceability; new tests should use stable domain/behavior names unless a release-specific contract genuinely requires a release label.

### P2 — Toolchain runtime was not explicitly pinned

At audit start, GitHub workflows used Node 22 while package metadata had no root Node engine/version file and `@types/node` was on the 24 line.

Live Vercel project inspection resolved the ambiguity: the production Logbook project is configured for **Node 24.x**.

**Frozen Phase 0A direction:** Node 24.x is the canonical runtime line. Align `.nvmrc`, `package.json#engines`, manual GitHub workflows and development documentation to that production runtime.

### P1 — Vercel preview policy and development docs had drifted

Repository inspection after the initial audit found that `tooling/vercel-ignore-build.mjs` intentionally exits successfully for **every non-production Vercel deployment**, so feature-branch previews are canceled/skipped regardless of whether runtime files changed.

The skip message still claimed feature branches were validated by GitHub Actions, while current governance makes GitHub Actions manual-only and local verification authoritative. DEVELOPMENT also still implied that runtime candidate commits created Vercel previews.

This is workflow/documentation drift, not evidence of a failed production build.

**Phase 0A decision:** preserve the existing no-preview policy for now rather than changing deployment cost/behavior implicitly. Correct the stale messages and documentation to local-first truth. Whether to restore runtime preview builds is a separate Phase 0E workflow decision with explicit cost/evidence trade-offs.

### P2 — Git/PR hygiene has accumulated stale state

At audit start, five older PRs remained open (#187, #201, #206, #231, #232) and more than twenty non-`main` branches remained.

Do not delete them blindly. First prove each is merged-equivalent, superseded or intentionally retained; then close/delete only the proven stale set.

## Independent review reconciliation

A second-AI read-only review was reconciled against the actual repository before implementation.

Accepted:
- the PostgreSQL false-green is P0 because it undermines the local-first release model;
- Playwright runner drift, the browser monolith, CSS risk misclassification and historical test proliferation are real maintenance risks;
- browser DB serialization must remain one-worker until independently isolated worker databases exist;
- timing/flakiness evidence is missing and should be measured before optimizing expensive suites.

Repository verification strengthened the review:
- all 33 PostgreSQL integration/scale files reference the integration-intent flag, so the silent-skip exposure is suite-wide locally;
- the manual GitHub PostgreSQL workflow did set the flag, so this specific false-green was a **local command contract** defect rather than evidence that the existing cloud PostgreSQL job also skipped;
- the Vercel Logbook project actually runs Node 24.x, resolving the Node 22/24 ambiguity in favor of Node 24.

Review recommendations deliberately **not** adopted:
- do not create a 272-entry per-test registry unless evidence proves that granularity is necessary. Phase 0B should evolve the existing module manifest into grouped risk/test metadata, with explicit exceptions where needed;
- do not remove historical/version-named tests from the default full regression suite merely because they are old. Exclusion/deletion requires proven redundant coverage first;
- do not make the complete browser suite mandatory for every release. Browser evidence remains risk-based; a release gate is assembled from the candidate's actual risk.

### Phase 0A implementation state — IN PROGRESS / NOT YET VERIFIED

Implemented on the Phase 0 branch:
- PostgreSQL runner preflights `DATABASE_URL` and `psql`, then injects `FLYTALLY_POSTGRES_INTEGRATION=1` into the selected test process itself;
- regression coverage proves the PostgreSQL gate fails before test execution when DB configuration is absent;
- `@playwright/test` 1.55.0 is pinned in repository dependency metadata instead of installed ad hoc in the manual workflow;
- authenticated browser acceptance has a wrapper that requires explicit browser/local-PostgreSQL test mode before fixture bootstrap;
- the browser bootstrap connection-timeout environment variable was corrected to `PGCONNECT_TIMEOUT`;
- Node 24.x is aligned across Vercel production configuration, `.nvmrc`, package engines and manual workflows;
- DEVELOPMENT has been corrected to describe the executable workflow rather than claiming the scope registry is already consumed by GitHub Actions;
- Vercel preview documentation and the ignore-script message now reflect the actual policy: non-production previews are intentionally skipped and local gates are authoritative.

Verification evidence from the developer workstation after the first Phase 0A batch:
- Node runtime: **v24.19.0**;
- `npm ci`: **PASS** (37 packages installed; npm retried a transient `@img/colour` tarball warning and completed successfully);
- targeted development/browser/Vercel source-contract set: **26/27 PASS, 1 FAIL**;
- the sole failure was a stale documentation/source assertion: DEVELOPMENT now says `Shared or previously unknown runtime code remains conservative`, while the test still expected the older wording;
- TypeScript: **PASS**;
- production build: **PASS**, Next.js 16.3.2, 41/41 static pages;
- the build emitted a non-fatal workstation warning about a separate `C:\\Users\\Filip Točík\\package-lock.json` outside the repository; the repository lockfile itself was accepted by `npm ci`.

The stale source assertion was corrected in a test-only follow-up. Per the local-first policy, the already-valid TypeScript/build evidence is not invalidated by that assertion-only change.

Follow-up workstation evidence:
- corrected targeted development/browser/Vercel source-contract set: **27/27 PASS**;
- Docker is **not installed** on the workstation, so the proposed containerized PostgreSQL fixture could not be started;
- the workstation does have the `psql` client, so setting a localhost URL without a running server exposed a second harness defect: the Phase 0A PostgreSQL preflight checked only that `psql` existed, then fanned out into 30 core files / 86 failing cases, all with the same connection-refused cause;
- `test:postgres:full` likewise started all 33 files / 99 cases and failed for the same unavailable localhost server;
- Chromium installation succeeded;
- authenticated browser acceptance did not reach Playwright tests because the browser DB bootstrap failed on the same localhost connection refusal.

These PostgreSQL/browser failures are **environment/harness failures, not product regression evidence**. They also prove that the PostgreSQL runner now forces the integration flag rather than silently skipping tests.

The newly observed preflight weakness was fixed in a second Phase 0A hardening step:
- PostgreSQL acceptance now runs a real `SELECT 1` connectivity probe against `DATABASE_URL` before spawning any integration test files;
- authenticated browser acceptance validates a localhost URL and runs the same connectivity probe before the destructive fixture bootstrap;
- source-contract coverage now guards those preflight requirements.

Follow-up after the connectivity-preflight change:
- targeted development/browser/Vercel source-contract set: **28/28 PASS**;
- PostgreSQL core with an unavailable localhost server: **FAIL-CLOSED AS DESIGNED** before test fanout, with an explicit `DATABASE_URL` connectivity error;
- authenticated browser acceptance with the same unavailable localhost server: **FAIL-CLOSED AS DESIGNED** before fixture bootstrap;
- workstation PostgreSQL 16 binaries are available at `C:\Program Files\PostgreSQL\16\bin`: `psql.exe`, `initdb.exe`, `pg_ctl.exe` and `createdb.exe`;
- Docker remains unavailable, but is no longer required for Phase 0A verification because an isolated temporary local PostgreSQL cluster can be created with the installed PostgreSQL 16 binaries.

A second workstation then reproduced the canonical toolchain with Node 24.19.0 and PostgreSQL 16.15. An isolated temporary cluster on `127.0.0.1:55432` initialized successfully, accepted connections, and returned `flytally_test|flytally`. Production build also passed again with 41/41 static pages.

That workstation exposed one more reproducibility defect: PostgreSQL was installed correctly but its `bin` directory was not on the Windows process `PATH`. The acceptance runners therefore failed with `spawnSync psql ENOENT` even though the explicit `C:\Program Files\PostgreSQL\16\bin\psql.exe` worked. This is an environment/harness portability issue, not product regression evidence.

The branch now supports an explicit `FLYTALLY_PSQL` executable path. The shared PostgreSQL CLI resolver prepends that executable's directory to child `PATH`, so:
- the connection preflight uses the exact requested client;
- all PostgreSQL integration child tests inherit the same executable path;
- browser fixture bootstrap inherits the same path;
- Playwright/browser child processes inherit the same prepared environment;
- PATH discovery remains the fallback when no override is needed.

Verification after the explicit-psql-path change:
- targeted development/browser/Vercel source-contract set: **29/29 PASS**;
- PostgreSQL core: **86/86 PASS** across 30 files;
- PostgreSQL full: **99/99 PASS** across 33 files, including the 10k / 50k / 100k scale suites within their published thresholds;
- explicit `FLYTALLY_PSQL` path successfully propagated to the PostgreSQL integration child processes;
- authenticated browser verification rebuilt the application successfully through compilation, then TypeScript correctly stopped the candidate before browser execution because `tests/development-pipeline.test.ts` imported the JavaScript helper without a declaration file.

That TypeScript failure is a Phase 0A test-harness regression, not product runtime evidence. The regression test was corrected to validate the helper as a source contract instead of importing the `.mjs` module into TypeScript. No PostgreSQL runner/browser-runner implementation changed after the successful PostgreSQL acceptance runs.

Still required before Phase 0A can close:
- rerun the targeted development-pipeline/browser source regression set after the TypeScript-safe test fix;
- TypeScript/build verification on the corrected candidate;
- successful authenticated browser acceptance against the isolated localhost PostgreSQL cluster.

No PASS is claimed for those remaining items until they actually run.

## Phase 0 implementation plan

### Phase 0A — Gate safety / reproducibility

Mandatory before any broader refactor:

1. Make explicitly requested PostgreSQL test commands fail closed:
   - preflight required configuration;
   - set/propagate the integration intent deterministically;
   - prove that a missing DB/test environment fails rather than silently skips;
   - prove core/scale/full selection still selects the expected files.
2. Pin `@playwright/test` as a development dependency and remove ad-hoc runner installation drift.
3. Add canonical browser command(s) that make the intended mode explicit:
   - public-only smoke may run without the authenticated fixture;
   - authenticated acceptance must fail clearly when its required fixture/environment is absent.
4. Decide and pin the supported Node runtime line; align local docs and manual workflows.

### Phase 0B — Risk model and deterministic test selection

Replace duplicated manual suite lists with one development-test manifest.

The registry must represent at least:

- product module;
- risk classes such as domain/data-integrity, persistence/schema, auth/security, browser/UI, scale/performance, build/tooling;
- targeted unit/contract test groups;
- PostgreSQL requirement;
- browser requirement;
- scale requirement.

Rules:

- documentation remains lightweight;
- CSS is UI/presentation, not documentation;
- unknown runtime code fails conservative but does not automatically invent a database dependency;
- shared/high-risk code can escalate to broader gates;
- changed tests select their owning suite rather than changing runtime risk by accident;
- selection logic is itself regression-tested.

### Phase 0C — Browser suite structure

Split the monolithic browser spec into stable domain specs, for example:

- public/auth boundary;
- shell/navigation;
- flight entry;
- flight detail/certification;
- settings/connections mutations;
- responsive presentation matrices.

Preserve:

- the isolated browser database;
- one worker until per-worker DB isolation exists;
- deterministic fixture reset;
- desktop/mobile coverage where device semantics matter;
- explicit iPad/mobile/theme matrices where layout semantics matter.

Avoid executing a self-managed viewport/theme matrix under both Playwright device projects unless the test explicitly needs both user-agent/device contexts.

### Phase 0D — Test contract policy

Document and enforce four evidence classes:

1. **Domain/unit behavior** — preferred for pure business rules and fail-closed semantics.
2. **Application/source contract** — allowed for wiring, governance and static presentation invariants; not a substitute for runtime behavior.
3. **PostgreSQL acceptance** — real persistence/constraint/transaction evidence.
4. **Browser acceptance** — user-visible workflow, responsive and async interaction evidence.

New release work must state which classes apply and why others are N/A.

Do not measure quality by raw test count alone.

### Phase 0E — Canonical verification commands

Create a small, unambiguous command surface.

Target behavior:

- quick targeted iteration;
- changed-scope recommendation/selection;
- complete application gate;
- explicit PostgreSQL gate;
- explicit browser gate;
- release gate assembled from the risks actually applicable to the candidate.

A command named as a gate must not silently downgrade itself to skipped evidence.

### Phase 0F — Hygiene and closeout

- reconcile `DEVELOPMENT.md` with executable tooling;
- review stale PRs/branches and clean only proven superseded state;
- keep ROADMAP / FEATURES / CHANGELOG discipline;
- record measured test/build/browser/PostgreSQL evidence exactly as run;
- do not modify 3.6.0 saved-date/timezone runtime semantics during Phase 0.

## Acceptance criteria

Phase 0 is DONE only when:

- PostgreSQL gate invocation cannot succeed with all selected PostgreSQL tests silently skipped;
- runner/suite selection has regression tests;
- one authoritative development-test/risk registry replaces duplicated fast-suite lists;
- CSS/UI changes are classified as presentation risk, not documentation;
- the registry covers the intended stable runtime modules, with explicit conservative handling for genuinely shared files;
- Playwright is repository-pinned and local/manual-cloud commands use the same locked version;
- authenticated browser acceptance has an explicit preflight/fail-closed entry point;
- the monolithic browser spec has been split enough that ownership and targeted execution are clear, without weakening fixture isolation;
- responsive matrices are not redundantly replayed across projects unless justified;
- DEVELOPMENT documentation matches the implemented command behavior;
- historical version-named tests remain traceable; new naming guidance is domain/behavior-first;
- TypeScript and the relevant unit/regression suite pass;
- PostgreSQL core/full acceptance passes when Phase 0 changes touch its harness;
- browser acceptance passes when Phase 0 changes touch its harness;
- production build passes before merge;
- ROADMAP / CHANGELOG / DEVELOPMENT and this contract are reconciled;
- FEATURES is updated only if a product capability actually changes;
- 3.6.0 runtime implementation remains unstarted until this gate is closed.

## 3.6.0 handoff after Phase 0

After Phase 0 closes, 3.6.0 Phase 1 returns to issue #144 with a stronger test foundation.

Timezone work must then separately freeze and test:

- configured user calendar timezone for saveable date defaults;
- UTC/source timestamp authority for GPS/FCL.050 evidence;
- midnight/day-boundary behavior;
- DST forward/backward transitions;
- timezone-setting changes versus already-persisted records;
- backup/export/edit consequences;
- whether any existing persisted data requires treatment.

GPS/FCL.050 UTC evidence must never be reinterpreted as local-time evidence merely for convenience.
