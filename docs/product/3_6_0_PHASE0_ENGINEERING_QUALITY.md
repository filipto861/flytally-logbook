# 3.6.0 Phase 0 — Engineering quality and test architecture gate

**Status:** ACTIVE — Phase 0A DONE / VERIFIED; Phase 0B ACTIVE  
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

### Phase 0A implementation state — DONE / VERIFIED

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

Verification after the TypeScript-safe regression fix:
- targeted development/browser/Vercel source-contract set: **29/29 PASS**;
- TypeScript: **PASS**;
- production build: **PASS**, 41/41 static pages;
- authenticated browser fixture bootstrap: **PASS** (`Browser smoke database ready.`);
- Playwright itself still did **NOT RUN** because Node 24 on Windows rejected `spawnSync npx.cmd` with `EINVAL`.

This is another Phase 0A browser-runner portability defect, not product runtime evidence. The runner now resolves the repository-pinned `@playwright/test` CLI and executes it directly through `process.execPath`, removing the Windows command-wrapper dependency while keeping the exact locked Playwright version. A new source-contract regression guards against reintroducing `npx.cmd` execution.

Follow-up after the direct-Playwright-CLI change:
- Playwright now launches successfully on Windows and the authenticated browser fixture bootstrap succeeds;
- the full browser run executed **98 tests using one worker** and finished **66 PASS / 30 FAIL / 2 skipped in 15.2 minutes**;
- the source-contract subset exposed one stale assertion that still expected the superseded `npx --no-install playwright test` wrapper;
- the browser failures cluster into test-harness drift rather than one product regression: current auto-collapsing GPS `<details>` sections were being manipulated while hidden, 3.5.2 had intentionally removed the account-level Night-definition control while old E1.3 browser expectations remained, and certified-fixture teardown attempted ordinary `DELETE` operations that production immutability triggers correctly reject.

Phase 0A corrective browser-harness batch:
- update the stale v3.2 U4 runner assertion to the direct repository-pinned Playwright CLI;
- make browser tests reopen GPS Track / Flight context sections through their visible `<summary>` before mutating controls that the current UI intentionally collapses;
- align the legacy Night-definition browser cases with the frozen 3.5.2 always-on GPS/SERA contract; persisted legacy keys remain compatibility data only;
- add localhost-only browser fixture cleanup that temporarily disables only `USER` triggers on `flights` inside one transaction, then immediately re-enables them; production runtime/delete semantics are unchanged;
- correct the browser DB helper timeout variable to `PGCONNECT_TIMEOUT`.

Iteration policy after the 15.2-minute diagnostic run: use Playwright `--grep` targeted clusters while fixing the harness; run the complete serialized 98-test browser gate only once on the final Phase 0A candidate.

Targeted verification of that corrective batch:
- development/browser/Vercel source-contract set: **31/31 PASS**;
- TypeScript: **PASS**;
- certified/certification fixture cluster: **10/10 PASS** in 53.9 seconds;
- 3.5.2 / E1.3 current Night-suggestion cluster: **6/6 PASS** in 18.0 seconds;
- GPS Role/Crew/split cluster: **8/20 PASS**; all 12 failures were the same remaining stale browser-harness assumption, not divergent product behavior: the current single-flight GPS UI presents `Split into multiple flights` for the first split, while those tests still waited for the later-state `Add split` control; the F6 single-flight matrix also still needed to reopen the auto-collapsing Flight context before each Role transition.

Follow-up verification:
- GPS Role/Crew/split cluster improved to **16/20 PASS**;
- the remaining four failures are two test cases repeated across desktop/mobile: F4.2 common Role transition and F6 single-flight Safety Pilot transition;
- both failures still manipulated dependent controls immediately after a Role change that can auto-collapse Flight context.

Verification of the narrowed two-case rerun:
- F4.2 common Role transition: **PASS** on desktop and mobile;
- F6 GPS single-flight matrix: **FAIL** on desktop and mobile at the next dependent Safety Pilot control;
- narrowed run result: **2/4 PASS in 33.4 seconds**.

Root cause remained the same current UI behavior: changing `actualPicMode` can auto-collapse Flight context, so `connectedPicUserId` was present but intentionally hidden when the browser test tried to use it.

Final targeted harness fix:
- add `selectGpsActualPicMode`, which explicitly opens Flight context, changes Actual PIC source, then reopens Flight context before dependent Safety Pilot controls are touched;
- use it in the F6 single-flight manual and connected Safety Pilot states.

Final browser verification:
- F6 Manual RoleCrew targeted rerun: **2/2 PASS** in 15.6 seconds;
- final full authenticated browser acceptance: **96 PASS / 2 skipped / 0 failed** across 98 executions in **7.5 minutes**;
- browser fixture bootstrap completed before both runs;
- this closes the browser-harness regression sequence. No product runtime behavior changed.

Final PostgreSQL safety review found one remaining fail-closed gap before Phase 0A closure: the acceptance runner would probe and then execute destructive integration fixtures against any caller-supplied DATABASE_URL. The manual workflow and current local evidence both use isolated localhost PostgreSQL, so remote targets are neither required nor acceptable for this gate.

Final Phase 0A safety correction:
- PostgreSQL acceptance now rejects malformed or non-localhost DATABASE_URL values before invoking psql;
- accepted hosts are localhost / loopback only;
- a regression test proves a remote URL is rejected before any client connection attempt.

Phase 0A closeout evidence on the exact safety candidate:
- targeted development/browser/Vercel governance regression: **32/32 PASS**;
- PostgreSQL core acceptance: **86/86 PASS**, 0 failed / 0 skipped;
- PostgreSQL full acceptance: **99/99 PASS**, 0 failed / 0 skipped, including retained 10k / 50k / 100k scale fixtures within their published thresholds;
- TypeScript: **PASS**;
- full unit/regression suite: **1316/1317 PASS** with one stale v1.44 source-contract assertion that still expected the integration flag in workflow YAML;
- production build: **PASS**, Next.js 16.3.2, 41/41 static pages;
- the stale v1.44 test was corrected to assert the current ownership contract: workflow does not inject the flag; `tooling/run-postgres-tests.mjs` owns `FLYTALLY_POSTGRES_INTEGRATION=1`;
- targeted rerun of that corrected historical contract: **5/5 PASS**;
- final full authenticated browser acceptance remains **96 PASS / 2 intentionally skipped / 0 failed** across 98 executions in 7.5 minutes.

Per the candidate-first development policy, the full 1,317-test suite was not rerun after the final assertion-only correction: the preceding full run proved the other 1,316 tests, and the only modified test file then passed its complete 5-test targeted suite. PostgreSQL, browser and production-build evidence remain valid because that final change touched only the stale source assertion.

**Phase 0A is CLOSED.** The next active step is Phase 0B — risk model and deterministic test selection. No 3.6.0 saved-date/timezone runtime semantics have started.

## Phase 0 implementation plan

### Phase 0A — Gate safety / reproducibility — DONE

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

### Phase 0B — Risk model and deterministic test selection — DONE / VERIFIED

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

Phase 0B implementation is split into small milestones:

**0B.1 — authoritative registry foundation**
- move the duplicated `test:ui` membership into the registry;
- add explicit documentation, UI/presentation, runtime, persistence, auth/browser, scale and tooling risk/gate metadata;
- make `scope:changed` emit selected risks, gates and targeted test groups;
- make changed registered tests select their owning group without inheriting unrelated runtime risk;
- keep unknown runtime conservative through full unit/build evidence, but do not invent PostgreSQL/browser dependencies.

Implementation candidate on the active branch:
- registry schema advanced to v2 with explicit documentation, presentation, test-group, special-rule and module gate metadata;
- the 16-file UI contract list now lives only in the registry;
- `npm run test:ui` delegates to the generic registry-backed `test:group` runner;
- changed-scope output now includes browser/build gates, risks, test groups and resolved targeted tests in addition to PostgreSQL/scale/full-test decisions;
- regression coverage was rewritten around the Phase 0B contract, including CSS presentation classification, unknown-runtime conservative handling, test ownership, PostgreSQL/browser harness escalation and fail-closed unknown test-group execution.

0B.1 verification on the first candidate:
- targeted scope/pipeline set: **24/25 PASS**; the only failure was a stale DEVELOPMENT source assertion that still expected the pre-0B.1 phrase `shared or previously unknown runtime code remains conservative`;
- registry-backed `test:ui`: **113/113 PASS** across the 16 registry-owned files;
- TypeScript: **PASS**;
- full unit/regression: **1322/1323 PASS**; the same stale DEVELOPMENT source assertion was the sole failure;
- production build: **PASS**, Next.js 16.3.2 with 41/41 static pages.

The stale assertion has been corrected to verify the actual 0B.1 contract: unknown app/components/lib runtime files fail conservative, while PostgreSQL/browser dependencies are not invented automatically. This is an assertion-only test correction; registry/runtime tooling behavior is unchanged.

0B.1 final targeted rerun:
- `tests/development-pipeline.test.ts`: **12/12 PASS** in 180 ms.

**0B.1 is CLOSED / VERIFIED.** The next active milestone is **0B.2 — stable-module coverage**. The already-valid UI, TypeScript, full-suite remainder and build evidence remain accepted because the final correction changed only the stale source assertion.

**0B.2 — stable-module coverage**
- expand module ownership beyond the current 31.8% baseline for stable app/components/lib domains;
- retain explicit `shared` handling for genuinely cross-cutting or not-yet-owned runtime files;
- add regression coverage for representative ownership boundaries.

Implementation candidate:
- audited runtime surface remains **381** `.ts/.tsx/.css` files across `app/`, `components/` and `lib/`;
- stable module ownership expands from **121/381 (31.8%)** to **368/381 (96.6%)**;
- **13/381** reviewed cross-cutting/not-yet-owned files remain explicitly listed under `shared-runtime` instead of receiving guessed ownership;
- added stable ownership for aircraft/airports, GPS/tracks, notifications/push, identity/auth, legal/commercial, professional experience and shell/presentation, while expanding the existing flight, credentials, connections, analytics, recovery and platform domains;
- a registry ownership contract now requires at least **90% stable coverage**, zero unclassified current runtime files, and explicit shared-runtime handling;
- representative regression coverage verifies aircraft, GPS, auth, push and shell ownership plus conservative shared-runtime gates.

0B.2 verification:
- targeted development-scope/pipeline set: **28/28 PASS**;
- TypeScript: **PASS**.

**0B.2 is CLOSED / VERIFIED.** The next active milestone is **0B.3 — workflow/command convergence**.

**0B.3 — workflow/command convergence**
- wire canonical group execution through one registry-backed runner;
- remove remaining duplicated suite lists from package/workflow/tooling surfaces;
- document the exact targeted-vs-heavy-gate contract before Phase 0C.

Implementation candidate:
- PostgreSQL scale-suite membership moved into the same v2 development registry; the PostgreSQL runner now reads that membership instead of carrying its own literal three-file list;
- runtime scale hot paths and PostgreSQL scale-test membership are separate registry fields, so they are not duplicated while both can select the scale gate;
- manual-cloud targeted verification now executes `npm run test:group -- ui-contract` directly through the canonical registry-backed group runner;
- `test:ui` remains only a convenience alias and contains no file list;
- DEVELOPMENT now freezes `scope:changed` as a planner-only command: it reports targeted groups and independent heavy-gate booleans but never executes PostgreSQL, browser, build or destructive fixture work itself;
- regression coverage functionally compares PostgreSQL core/scale/full selection against the current integration directory and registry, guards the workflow's generic group execution, and protects the targeted-vs-heavy contract.

0B.3 verification:
- targeted development-scope/pipeline set: **29/29 PASS**;
- TypeScript: **PASS**.

**0B.3 is CLOSED / VERIFIED. Phase 0B is CLOSED / VERIFIED.** The next active phase is **Phase 0C — Browser suite structure**. Before implementation, perform read-only discovery of the current Playwright monolith/fixture ownership and obtain an independent second-AI review of the proposed split and any future worker-isolation design.

### Phase 0C — Browser suite structure — ACTIVE

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

#### Phase 0C discovery baseline

Read-only inventory on the active branch:

- `e2e/public-shell.spec.mjs`: **2,053 lines / ~127.6 kB**, **48 logical tests**, **13 local helper functions**, and **25 imports** from the shared browser DB fixture helper;
- `e2e/browser-db.mjs`: **363 lines** of fixture/reset/query helpers;
- `tooling/bootstrap-browser-smoke-db.mjs`: **600 lines** of isolated browser-database bootstrap;
- Playwright currently has two projects (desktop Chrome + Pixel 7), `fullyParallel:false`, and **workers:1** because both projects mutate the same isolated PostgreSQL fixture;
- the normal full gate therefore executes the 48 public-shell tests under both projects (**96 executions**) plus the dedicated UI-audit capture test under both projects (**2 intentionally skipped executions unless explicitly enabled**) = the observed **98 executions**;
- several presentation tests already manage their own viewport/theme matrices with `page.setViewportSize` / shared F6 presentation state, so running those same matrices again under both device projects is potentially redundant unless mobile UA/touch semantics are actually part of the assertion;
- the current UI-audit capture spec already demonstrates the desired pattern: it skips the mobile project because it owns its viewport/theme matrix internally.

0C.0 baseline implementation candidate:
- added `tooling/browser-suite-baseline.json` with the exact 48 authenticated browser test names, current project/worker/retry contract, known browser DB helper exports/fixture IDs/users, required presentation states and the previously verified 96/2/0 execution result;
- added `tests/browser-suite-structure.test.ts` to enforce those invariants across future spec splitting;
- registered that structure contract in the development-pipeline targeted group;
- no Playwright spec, browser DB helper, bootstrap, product runtime or DB schema changed.

0C.0 verification:
- targeted browser-structure/scope/pipeline set: **34/34 PASS**;
- TypeScript: **PASS**.

**0C.0 is CLOSED / VERIFIED.**

0C.1 implementation candidate:
- extracted only two proven cross-domain primitives into `e2e/browser-actions.mjs`: `expectNoHorizontalOverflow` and `loginBrowserPilot`;
- both implementations were moved byte-for-byte in behavior from the monolith: selectors, waits, assertions, credentials and timeout semantics are unchanged;
- GPS/details/split/RoleCrew helpers remain local to the monolith because they are domain-specific at this stage;
- `holdPost` also remains local because current reuse spans only certification plus settings/connections mutation areas, not the three-or-more-domain threshold from review;
- no browser test moved files; all 48 logical names remain under the current acceptance spec;
- no Playwright project/worker/retry, browser DB fixture, bootstrap, product runtime or schema change;
- structure regression now rejects GPS/RoleCrew-specific helpers from the shared action module and proves the two extracted helpers are no longer locally redefined.

0C.1 verification:
- targeted browser-structure/scope/pipeline set: **35/35 PASS**;
- TypeScript: **PASS**;
- full serialized authenticated browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **4.9 minutes**.

**0C.1 is CLOSED / VERIFIED.**

0C.2 Batch 1 implementation candidate — settings/connections mutations:
- moved exactly four existing tests into `e2e/settings-connections-mutations.spec.mjs`: appearance mutation, connection acceptance, account settings transaction, and connection access update;
- test names and assertions are unchanged;
- the local `holdPost` helper is intentionally duplicated for this domain during the split rather than prematurely promoted to the shared action module; 0C.2a will reconcile helper ownership after domains exist;
- `resetAccountSettingsFixture` remains imported by the monolith because advisory/Night tests still use it; only mutation-only reset imports moved with the new spec;
- new spec sorts after `public-shell.spec.mjs`, preserving the previous broad execution order of these end-of-file mutation tests while the suite remains workers=1;
- baseline contract still requires the exact 48 logical names, centralized `browser-db.mjs`, unchanged fixture IDs, two projects, workers=1 and the existing retry contract;
- no product runtime, DB schema, browser DB fixture implementation, bootstrap, Playwright project or worker change.

0C.2 Batch 1 verification:
- targeted browser-structure/scope/pipeline set: **36/36 PASS**;
- TypeScript: **PASS**;
- focused new mutation spec: **8/8 PASS** across both Playwright projects in **23.3 seconds**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **4.8 minutes**.

**0C.2 Batch 1 is CLOSED / VERIFIED.**

0C.2 Batch 2 implementation candidate — advisory presentation:
- moved exactly seven existing advisory/presentation tests into `e2e/advisory-presentation.spec.mjs`: E1.1 route assistance, E1.2 operation defaults, E1.4 legacy GPS Task, 3.5.2 Night-setting removal, legacy MANUAL applicability, E1.3 SERA suggestion, and sparse GPS Night-time;
- test names and assertions are unchanged;
- the new spec uses only the already-shared login/overflow primitives plus centralized `browser-db.mjs` reset/query helpers;
- the monolith no longer imports advisory-only reset helpers;
- current source inventory remains exactly **48 unique logical acceptance tests**: 37 in `public-shell.spec.mjs`, 7 in `advisory-presentation.spec.mjs`, and 4 in `settings-connections-mutations.spec.mjs`;
- no DB fixture implementation, fixture ID, product runtime, schema, Playwright project, worker or retry change.

0C.2 Batch 2 verification:
- targeted browser-structure/scope/pipeline set: **37/37 PASS**;
- TypeScript: **PASS**;
- focused advisory spec: **14/14 PASS** across both Playwright projects in **27.3 seconds**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **4.7 minutes**.

The full run again emitted Windows/PostgreSQL `could not reserve shared memory region` log lines, but no browser assertion or persistence gate failed. Treat this as a local-environment watch item, not as proof that the warning is harmless in all cases; investigate if it coincides with a future DB/browser failure.

**0C.2 Batch 2 is CLOSED / VERIFIED.**

0C.2 Batch 3 implementation candidate — Manual RoleCrew / verification:
- moved exactly five existing tests into `e2e/manual-rolecrew-verification.spec.mjs`: F2.2 Manual RoleCrew, F2.4C verifier evidence, Safety Pilot Actual PIC form, F2.3 Safety Pilot resolver, and certified Safety Pilot PIC invitation;
- test names and assertions are unchanged;
- the new domain spec imports only the already-shared login/overflow primitives and centralized browser DB reset/query helpers;
- `expectAuthenticatedRoute` remains domain-local in this batch rather than being promoted to shared ownership before 0C.2a;
- source inventory remains exactly **48 unique logical acceptance tests**: 32 public-shell + 7 advisory + 5 Manual RoleCrew/verification + 4 settings/connections mutations;
- no fixture ID, browser DB implementation, bootstrap, product runtime, schema, Playwright project, worker or retry change.

0C.2 Batch 3 verification:
- targeted browser-structure/scope/pipeline set: **38/38 PASS**;
- TypeScript: **PASS**;
- focused Manual RoleCrew/verification spec: **10/10 PASS** across both Playwright projects in **41.2 seconds**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **5.0 minutes**.

The full run again emitted a Windows/PostgreSQL `could not reserve shared memory region` warning, but no browser assertion or persistence gate failed. Keep it as the existing local-environment watch item.

**0C.2 Batch 3 is CLOSED / VERIFIED.**

0C.2 Batch 4 implementation target — Manual aircraft authority / certification:
- next split owns the eight remaining Manual authority/certification tests: profile-owned aircraft context, F3.4 Manual compact context, the four F3.5 authority variants, Manual Save & certify, and certified-flight void/audit;
- keep GPS-specific certification/quality tests in the GPS domain;
- preserve all current test names, assertions, DB fixture IDs and one-worker/two-project execution semantics;
- keep `holdPost` domain-local for the certified-void flow during the split; helper ownership is reconciled only in 0C.2a.

0C.2 Batch 4 implementation candidate:
- created `e2e/manual-authority-certification.spec.mjs` and moved exactly those eight tests with unchanged names/assertions;
- moved the authority-only reset helpers with the new spec; GPS-specific reset helpers remain in `public-shell.spec.mjs`;
- moved `holdPost` with the certified-void domain flow and removed its local definition from the remaining monolith;
- current source inventory remains exactly **48 unique logical acceptance tests**: 24 public-shell + 8 Manual authority/certification + 7 advisory + 5 Manual RoleCrew/verification + 4 settings/connections mutations;
- centralized `browser-db.mjs`, fixture IDs, bootstrap, both Playwright projects, workers=1 and retry behavior are unchanged;
- structure regression proves all eight names live only in the Manual authority/certification spec and that `holdPost` no longer remains in the monolith.

0C.2 Batch 4 verification:
- targeted browser-structure/scope/pipeline set: **39/39 PASS**;
- TypeScript: **PASS**;
- focused Manual authority/certification spec: **16/16 PASS** across both Playwright projects in **1.2 minutes**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **4.8 minutes**.

**0C.2 Batch 4 is CLOSED / VERIFIED.**

0C.2 Batch 5 implementation target — responsive presentation:
- next split owns the remaining broad self-managed viewport/theme matrix tests, without changing their project execution yet;
- expected domain includes the 3.4 responsive entry shell, F4.4 GPS RoleCrew responsive UX, both F5.3 presentation-focused Manual RoleCrew tests, F6 Manual, F6 GPS single-flight, F6 GPS multi-part, F6 invalid-profile recovery, and F2.5 RoleCrew presentation;
- this batch is file-ownership only: **no project×matrix deduplication yet**; every test continues to run under the same two Playwright projects until 0C.3;
- preserve exact names, viewport/theme state labels, fixture resets and shared DB/project/worker/retry semantics.

0C.2 Batch 5 implementation candidate:
- created `e2e/responsive-presentation.spec.mjs` and moved exactly those nine presentation/matrix tests with unchanged test names and assertions;
- retained the F6 viewport list and `applyF6PresentationState` inside the responsive domain, so required desktop/iPad/mobile/320px/reflow/light/dark state labels remain colocated with the tests that own them;
- duplicated the currently domain-specific GPS interaction helpers into the responsive spec only for this split; the functional GPS copy remains in `public-shell.spec.mjs` until 0C.2a helper-ownership reconciliation;
- **no Playwright project skip or project×matrix deduplication was introduced**; 0C.3 remains the only phase allowed to remove a project after mobile-semantics proof;
- current source inventory remains exactly **48 unique logical acceptance tests**: 15 public-shell + 9 responsive presentation + 8 Manual authority/certification + 7 advisory + 5 Manual RoleCrew/verification + 4 settings/connections mutations;
- centralized `browser-db.mjs`, fixture IDs, bootstrap, both Playwright projects, workers=1 and retry behavior are unchanged;
- structure regression proves all nine test names moved, F6 matrix ownership moved with them, and the responsive spec has no project-name skip logic.

0C.2 Batch 5 verification:
- targeted browser-structure/scope/pipeline set: **40/40 PASS**;
- TypeScript: **PASS**;
- focused responsive presentation spec: **18/18 PASS** across both Playwright projects in **3.1 minutes**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **12.0 minutes** on the second local PC;
- the second PC required its own isolated PostgreSQL fixture plus a valid local `SESSION_SECRET`; the earlier all-test login failure was an environment/configuration failure, not a Batch 5 product/test assertion failure.

**0C.2 Batch 5 is CLOSED / VERIFIED.**

0C.2 Batch 6 implementation target — GPS / RoleCrew:
- move the ten remaining GPS functional acceptance tests from `public-shell.spec.mjs` into `e2e/gps-rolecrew.spec.mjs`;
- keep the five actual public/auth/shell tests in `public-shell.spec.mjs`;
- move the remaining GPS-only helper/reset/query ownership with the GPS domain where proven exclusive;
- preserve exact test names/assertions, centralized browser DB fixture implementation, fixture IDs, both Playwright projects, workers=1 and retry semantics;
- this is still file/domain ownership only; no project×matrix deduplication before 0C.3.

0C.2 Batch 6 implementation candidate:
- created `e2e/gps-rolecrew.spec.mjs` with exactly the ten remaining GPS functional acceptance tests and their GPS-only interaction helpers;
- reduced `e2e/public-shell.spec.mjs` to exactly five public/auth/shell tests: login shell, unauthenticated redirect, pending login state, authenticated core-shell navigation, and offline banner;
- removed direct `browser-db.mjs` ownership from `public-shell.spec.mjs`; GPS DB reset/query helpers remain centralized in `browser-db.mjs` and are imported only by the GPS domain where needed;
- current source inventory remains exactly **48 unique logical acceptance tests**: 10 GPS / RoleCrew + 9 responsive presentation + 8 Manual authority/certification + 7 advisory + 5 Manual RoleCrew/verification + 5 public/auth/shell + 4 settings/connections mutations;
- no test name, assertion, fixture ID, browser DB implementation, bootstrap, Playwright project, worker or retry behavior changed;
- structure regression proves the ten GPS names no longer live in the shell spec, the shell contains exactly five tests, and GPS-only helpers/browser-DB ownership are absent from the shell.

0C.2 Batch 6 verification:
- targeted browser-structure/scope/pipeline set: **41/41 PASS**;
- TypeScript: **PASS**;
- focused GPS / RoleCrew spec: **20/20 PASS** across both Playwright projects in **2.6 minutes**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **11.8 minutes**.

**0C.2 Batch 6 is CLOSED / VERIFIED.**
**0C.2 domain splitting is CLOSED.**

Next milestone is **0C.2a helper-ownership reconciliation**. This is a read/ownership cleanup only: review helpers duplicated across the newly split domain specs, promote only genuinely cross-domain primitives, keep domain-specific GPS/presentation helpers local, preserve centralized browser DB fixtures, exact 48 logical tests, workers=1 and both Playwright projects.

0C.2a implementation candidate:
- promoted only generic cross-domain primitives into `e2e/browser-actions.mjs`: `expectAuthenticatedRoute`, `ensureDetailsOpen`, and `holdPost`; existing `expectNoHorizontalOverflow` and `loginBrowserPilot` remain there;
- removed duplicated local `expectAuthenticatedRoute` implementations from public-shell and Manual RoleCrew/verification;
- removed duplicated local `holdPost` implementations from Manual authority/certification and settings/connections mutations;
- created domain-scoped `e2e/gps-actions.mjs` for the six GPS interaction helpers genuinely shared by GPS functional and responsive-presentation domains: `openGpsFlightContext`, `selectGpsCommonRole`, `selectGpsActualPicMode`, `openGpsTrackReview`, `splitGpsIntoTwo`, and `completeF43GpsPart`;
- `gps-actions.mjs` consumes the generic `ensureDetailsOpen` primitive instead of duplicating generic details behavior;
- GPS-specific helpers were **not** added to the generic browser-action module; presentation-specific `applyF6PresentationState` remains local to responsive presentation; shell-only `navigateMain` remains local to public-shell;
- exact source inventory remains **48 unique logical acceptance tests** with no duplicate names; `browser-db.mjs`, fixture IDs, bootstrap, both Playwright projects, workers=1 and retry semantics are unchanged;
- structure tests now guard generic-vs-GPS helper ownership and reject reintroduced local duplicates.

0C.2a verification on the corrected head:
- targeted browser-structure/scope/pipeline set: **43/43 PASS**, including the new fail-closed `node --check` coverage for every `e2e/*.mjs` module;
- TypeScript: **PASS**;
- focused GPS / RoleCrew spec: **20/20 PASS** across both Playwright projects in **2.5 minutes**;
- focused responsive presentation spec: **18/18 PASS** across both Playwright projects in **2.8 minutes**;
- complete serialized browser gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions** in **11.4 minutes**.

**0C.2a is CLOSED / VERIFIED.**

Next milestone is **0C.3 — proven project × matrix deduplication**. No execution may be removed for speed alone. Deduplication is allowed only where the test already owns the complete required viewport/theme matrix and source/runtime evidence shows that mobile-project-only semantics (UA, `isMobile`, touch, deviceScaleFactor, safe-area, virtual keyboard, pointer/hover, mobile browser chrome) are irrelevant. If proof is insufficient, retain both projects.

0C.3 discovery/proof result:
- the responsive domain contains nine logical tests, but only **four F6 tests** explicitly own the complete required `F6_PRESENTATION_VIEWPORTS` matrix (desktop 1440, iPad landscape, iPad portrait, mobile 390, mobile 320, 200% reflow equivalent) and both light/dark themes;
- the other five responsive tests use intentionally narrower release/focused matrices, so they **retain both Playwright projects**;
- the four full-matrix tests do not read project name, UA, touch/deviceScaleFactor, pointer/hover, safe-area, virtual-keyboard or viewport-device APIs; repository source search found no application runtime branching on `navigator.userAgent`, touch/pointer/hover, deviceScaleFactor, safe-area, visualViewport or matchMedia, and PR #255 changes no `app/`, `components/` or `lib/` runtime files;
- therefore only those four full F6 matrices are tagged `@self-managed-presentation`;
- `mobile-chromium` excludes that tag with project-level `grepInvert`, which removes those four mobile-project executions rather than counting runtime skips;
- desktop-chromium still executes each tagged test across its complete self-managed viewport/theme matrix; the five partial/focused responsive tests still execute under both desktop and Pixel 7 projects;
- expected full-gate execution count changes from **98 to 94**: 92 passing acceptance executions + the existing 2 intentional UI-audit skips, if runtime behavior remains unchanged. Actual verification output remains authoritative.

0C.3 verification:
- targeted browser-structure/scope/pipeline set: **44/44 PASS**;
- TypeScript: **PASS**;
- focused responsive presentation spec: **14/14 PASS**, confirming 9 desktop executions + 5 retained mobile-project executions;
- complete serialized browser acceptance with explicit `--retries=0`: **92 PASS / 2 intentional skips / 0 failed** across **94 executions** in **10.3 minutes**;
- the observed 94-execution matrix exactly matches the proof-driven design: four complete self-managed F6 matrices run once, while the other five responsive tests retain both Playwright projects.

**0C.3 is CLOSED / VERIFIED.**

0C.4 final Phase 0C acceptance:
- all **48 logical acceptance tests** remain present and unique;
- fixture/reset identities remain unchanged and `browser-db.mjs` remains centralized;
- `workers=1` and `fullyParallel=false` remain unchanged;
- the required desktop/iPad/mobile/320px/reflow × light/dark evidence remains owned by the F6 presentation matrices;
- TypeScript, targeted structure contracts and the complete serialized browser gate all pass on the final 0C code candidate;
- PR #255 changes no `app/`, `components/` or `lib/` runtime files, so 0C introduces no product behavior or timezone-semantic change;
- no DB schema change and no per-worker DB isolation were introduced.

**0C.4 is CLOSED / VERIFIED.**
**PHASE 0C — BROWSER TEST ARCHITECTURE — CLOSED / VERIFIED.**

Next milestone: **Phase 0D — test contract / evidence taxonomy**.

Superseded pre-review implementation draft (preserved for decision history):

**0C.1 — shared helper extraction, no behavioral change**
- move genuinely reusable navigation/login/overflow/details/GPS interaction helpers out of the monolith;
- keep DB fixture ownership in `browser-db.mjs`;
- preserve test names, fixture IDs, order-sensitive reset semantics, two projects and workers=1.

**0C.2 — domain spec split**
- split public/auth/shell boundaries;
- split Manual flight authority/certification;
- split GPS/RoleCrew flows;
- split settings/connections/transaction mutations;
- split responsive presentation matrices;
- preserve the exact same logical test inventory and grep-able names.

**0C.3 — redundant project-matrix removal**
- only for tests that fully own their viewport/theme matrix and do not depend on mobile user-agent/touch semantics, run under one Playwright project;
- retain both projects for ordinary workflow tests whose real device project semantics are part of coverage;
- prove the resulting execution-count reduction without reducing required viewport/theme states.

**Not part of 0C by default:** per-worker database isolation or raising `workers` above 1. That is a separate architecture change because the current suite and bootstrap assume one mutable database. It may be designed after the spec split, but must not be smuggled into this refactor.

Before any 0C implementation, obtain an independent second-AI review of the domain boundaries, helper extraction, execution-matrix deduplication, shared-DB hazards and the decision to defer per-worker isolation.

Independent review result: **ACCEPT WITH CHANGES**. Reconciliation:
- accepted: add a machine-checkable 0C.0 baseline before refactoring;
- accepted: make 0C.1 minimal and extract only proven cross-domain primitives;
- accepted: keep `browser-db.mjs` centralized for all of Phase 0C;
- accepted: use a modest seven-domain spec layout, with broad responsive/theme matrices kept together rather than scattered into functional specs;
- accepted: preserve workers=1 / fullyParallel=false / one isolated mutable PostgreSQL fixture throughout Phase 0C;
- accepted: full browser acceptance after every domain-split batch because file splitting can expose hidden order/reset dependencies even under one worker;
- accepted: project × self-managed matrix deduplication is the highest-risk 0C step and requires explicit proof that mobile UA/touch/device-scale/pointer semantics are irrelevant before skipping a project;
- accepted: per-worker DB isolation stays out of scope and requires a separate harness design;
- implementation note: local Playwright already defaults to retries=0; 0C.3 will still run final local acceptance explicitly with `--retries=0`.

Frozen Phase 0C milestones after review:

**0C.0 — baseline / invariant gate**
- preserve the exact 48 logical authenticated browser test names across any future spec split;
- preserve desktop-chromium + mobile-chromium, workers=1, fullyParallel=false and the current local/CI retry contract;
- preserve centralized browser DB helper ownership, known fixture IDs and primary browser users;
- preserve required F6 viewport/theme states and the existing single-project UI-audit self-managed matrix;
- baseline evidence remains the already-verified full gate: **96 PASS / 2 intentional skips / 0 failed** across **98 executions**;
- implement source/structure invariants before moving any browser test.

**0C.1 — minimal shared helper extraction**
- extract only proven cross-domain primitives such as login/navigation, horizontal-overflow assertion, generic details open/reopen and request hold where reuse is proven;
- keep GPS-specific, authority-specific and RoleCrew-specific helpers domain-local until the split demonstrates genuine reuse;
- no test movement, no project changes, no DB helper split, no weakened waits/selectors/assertions;
- verification: targeted structure contract + TypeScript + full browser acceptance; logical-name baseline must remain exact.

**0C.2 — domain split in batches**
Target layout:
1. `public-shell.spec.mjs` — public/auth/shell;
2. `manual-authority-certification.spec.mjs`;
3. `gps-rolecrew.spec.mjs`;
4. `manual-rolecrew-verification.spec.mjs`;
5. `settings-connections-mutations.spec.mjs`;
6. `responsive-presentation.spec.mjs`;
7. `advisory-presentation.spec.mjs`.

Rules:
- preserve the exact 48 logical names and grep-ability;
- preserve fixture IDs/reset semantics and centralized `browser-db.mjs`;
- no new mutable `beforeAll` state without explicit proof of retry safety;
- after each split batch, run the moved/new spec under both projects and then the complete serialized browser gate.

**0C.2a — helper ownership reconciliation**
- only after the split, promote domain helpers to shared ownership when multiple domains actually use them;
- reject a generic browser-helper dumping ground.

**0C.3 — proven project × matrix deduplication**
A test may skip the second Playwright project only when all are true:
- it explicitly owns the complete required viewport/theme matrix;
- it does not rely on mobile UA, `isMobile`, `hasTouch`, deviceScaleFactor, safe-area, virtual keyboard, pointer/hover or mobile browser chrome;
- every required desktop/iPad landscape/iPad portrait/mobile/320px or reflow/light/dark state remains evidenced;
- no project skip exists only for speed;
- full acceptance passes explicitly with `--retries=0` and the before/after execution matrix is documented.

**0C.4 — final Phase 0C acceptance**
- 48 logical tests preserved unless independently approved otherwise;
- fixture/reset identities unchanged;
- `browser-db.mjs` centralized;
- workers=1 unchanged;
- required responsive/theme evidence preserved;
- TypeScript + targeted structure contract + full browser acceptance PASS;
- no product runtime, timezone semantics or DB schema change;
- per-worker DB isolation not introduced.

### Phase 0D — Test contract / evidence taxonomy — DONE / VERIFIED

Phase 0D makes **risk**, **gate** and **evidence class** separate machine contracts so a green static/source assertion cannot be presented as proof of runtime behavior.

Canonical behavioral evidence classes:

1. **`domain-unit`** — direct business-rule and fail-closed behavior.
2. **`application-source-contract`** — wiring, governance and static/source presentation invariants; never a substitute for runtime behavior.
3. **`postgres-acceptance`** — real persistence, constraint and transaction behavior against PostgreSQL.
4. **`browser-acceptance`** — user-visible workflow, responsive and async interaction behavior.

Build remains independent non-behavioral artifact evidence. The heterogeneous full Node regression suite remains an **aggregate regression gate**, not an evidence class.

Independent second-AI review verdict: **ACCEPT WITH CHANGES**. Reconciliation against the repository:

- accepted: keep the taxonomy in the existing development registry rather than create a second manifest;
- accepted: upgrade the registry to schema v3 and add a JSON Schema contract;
- accepted: current named groups must be homogeneous; `ui-contract` and `development-pipeline` are explicitly `application-source-contract`;
- accepted: `fullTests` must never synthesize `domain-unit`;
- accepted: build must never synthesize any behavioral evidence class;
- accepted: dedicated PostgreSQL/browser acceptance can be PASS only from the dedicated full gate with retries=0;
- accepted: raw skipped acceptance cases cannot be reported as PASS; intentional exclusions must be explicit N/A cases inside the planned count;
- accepted: required evidence that did not execute is `NOT RUN`, never `N/A`;
- accepted with placement correction: required-vs-observed evidence is separate, but `scope:changed` remains a planner and therefore emits **required** evidence only. Observed PASS/FAIL/count/retry data belongs to the post-execution evidence report/evaluator; the planner must not invent observations;
- accepted with scope correction: no PR/CI reporter currently consumes `scope:changed`, so 0D extends its stable additive CLI output and DEVELOPMENT reporting contract rather than inventing a second reporting subsystem;
- not adopted for this candidate: a mandatory full browser rerun or PostgreSQL rerun merely because evidence-taxonomy tooling changed. Under the existing risk-based gate contract, those classes remain N/A unless browser/PostgreSQL harness/runtime surface changes. The final 0D candidate still requires the aggregate full regression gate and independent build artifact.

0D implementation candidate:

- **0D.1 — taxonomy/schema:** development registry v3 + `development-modules.schema.json`;
- **0D.2 — homogeneous group metadata:** named groups declare evidence class and coverage; no per-test registry is introduced;
- **0D.3 — planner/evaluator:** `scope:changed` reports `required_evidence`, `aggregate_gates` and `build_artifact`; `evidence-contract.mjs` evaluates observed status fail-closed;
- **0D.4 — negative enforcement:** source-contract PASS cannot become domain/browser/PostgreSQL PASS; aggregate full tests cannot become domain-unit; build cannot become behavioral evidence; raw skips/retries prevent acceptance PASS;
- **0D.5 — reporting documentation:** DEVELOPMENT defines PASS / FAIL / NOT RUN / N/A / PARTIAL semantics and the command/count/retry/source-gate evidence fields;
- **0D.6 — verification/closeout:** DONE. Final correction candidate verification passed and required closeout documentation is reconciled.

Verification history:
- first aggregate regression run: **1340/1354 PASS, 14 FAIL**; all 14 failures were stale source-location contracts left behind by the verified Phase 0C browser split;
- those historical assertions were retargeted to the verified domain-owned specs/helpers without changing product runtime, browser behavior, DB schema or timezone semantics;
- final exact-code-head verification on `686734911f5c3f45e395fdda6b7d98a5021e84ae`: development-pipeline **65/65 PASS**, TypeScript **PASS**, aggregate regression **1354/1354 PASS**, production build **PASS** with **41/41** static pages;
- `domain-unit`: **N/A**; `postgres-acceptance`: **N/A**; `browser-acceptance`: **N/A** for this tooling/source-contract candidate.

**PHASE 0D — CLOSED / VERIFIED.**

New release work must state which behavioral classes apply and why the others are N/A. Quality is not measured by raw test count alone.

### Phase 0E — Canonical verification commands — ACTIVE

Independent review verdict: **ACCEPT WITH CHANGES**. The design is reconciled as follows.

#### 0E.0 — Semantics / ledger / compatibility freeze — DONE (design only)

Risk, required evidence and available evidence remain distinct:

- **required evidence** stays canonical in the existing risk/gate policy. Do not duplicate it per module.
- modules may declare **available direct evidence**, e.g. exact repo-relative `evidenceTests.domain-unit` files;
- required `domain-unit` + no approved available direct evidence = blocked / NOT RUN, fail closed before expensive gates;
- aggregate `npm test` never substitutes for missing direct domain evidence.

Every canonical executor must emit a machine-readable evidence ledger entry for the exact candidate. A release PASS is valid only when every required gate has an authoritative successful ledger entry for the same candidate fingerprint.

Candidate identity is content-aware:
- exact normalized candidate file list;
- current HEAD SHA;
- optional explicit base SHA;
- candidate source/mode;
- deterministic content-aware files hash;
- derived `candidateId`.

Commit SHA alone is insufficient because explicit path / files-list candidates may include local uncommitted content.

Ledger entries record at minimum:
- gate;
- evidence class or independent artifact class;
- candidate identity;
- modules / source groups as applicable;
- canonical command;
- exit code;
- effective configuration;
- counts/status needed by the Phase 0D evidence contract;
- produced/consumed artifact metadata where applicable.

Stale/mismatched entries are not evidence.

#### Canonical commands

- `test:target` — low-level explicit Node test-file runner.
- `test:group` — homogeneous registry-backed source-contract groups.
- `verify:plan` — side-effect-free plan with human and JSON output; `scope:changed` remains compatible.
- `verify:app` — application-level gate only: TypeScript + aggregate Node regression + production build. It does not satisfy domain/PostgreSQL/browser evidence by itself.
- `verify:postgres` — full PostgreSQL acceptance. Core/scale/full test commands remain lower-level iteration/milestone tools.
- `verify:browser` — browser-only full authenticated acceptance. It requires a fresh build artifact/ledger from the same candidate, forces retries=0 and workers=1, preserves fullyParallel=false, and rejects narrowing/filtering/sharding.
- `verify:browser:with-build` — temporary compatibility convenience for the previous build+browser behavior.
- `verify:domain` — direct domain-unit evidence using registry-approved exact test paths only.
- `verify:release` — risk-based plan + executor + ledger.
- `verify:release:full` / explicit `--force-all` — compatibility/full escape hatch during migration.

No separate `verify:source` command is required: direct `test:group` executions may emit authoritative `application-source-contract` ledger entries.

#### Candidate contract

Exactly one candidate source is required:
- positional paths;
- `--files <path>`;
- `--base <git-ref>`;
- `--all` = all tracked paths.

No input = invalid invocation. There is no implicit `origin/main` or guessed merge base.

`--force-all` forces gate selection; it does **not** redefine candidate membership.

`--base` must resolve the exact supplied Git ref and fail if the comparison cannot be resolved. Optional `--worktree` / `--staged` modes are deferred unless explicit paths/files prove insufficient.

#### Planner and exit semantics

`verify:plan` is side-effect free. It does not connect to PostgreSQL, build the application, start a browser or mutate fixtures.

Planner output includes:
- candidate identity;
- normalized files;
- modules / risks;
- selected targeted groups;
- typecheck requirement;
- aggregate/full-test requirement;
- PostgreSQL / scale / browser / build requirements;
- required behavioral evidence;
- blocked evidence reasons.

Exit codes:
- **0** — valid plan / successful canonical gate;
- **2** — invalid candidate/configuration/invocation;
- **3** — valid candidate blocked by missing required evidence or stale prerequisite.

Typecheck is a planner gate and is default-required for non-documentation candidates. Release callers do not arbitrarily suppress it.

#### Browser/build separation

Build and browser remain separate evidence concepts.

The build gate records a candidate-bound build manifest including the candidate fingerprint and produced Next build identity. `verify:browser` consumes that manifest and the existing build output; candidate mismatch or stale/missing build identity exits 3 before browser execution.

`verify:release` orders build before browser whenever browser acceptance is required and no fresh authoritative build entry already exists.

#### 0E milestones

1. **0E.0 — semantics / ledger / compatibility freeze — DONE (design only)**.
2. **0E.1 — explicit candidate input + `verify:plan` + candidate fingerprint — DONE / VERIFIED**.
3. **0E.2 — registry available-evidence metadata + direct domain selection — ACTIVE**.

0E.2 implementation candidate:
- every current module carrying a risk mapped to `domain-unit` has explicit exact-path `evidenceTests.domain-unit` metadata;
- the direct selector unions approved evidence only for affected modules and keeps missing-module coverage explicit;
- direct evidence paths are schema-validated, must exist, and must not be PostgreSQL acceptance or members of source-contract groups;
- dedicated pure behavioral tests were added for aircraft-profile validation and professional experience instead of promoting mixed historical source-contract files;
- current registry coverage is **10/10 domain-risk modules** with no missing direct-evidence files;
- `verify:plan` emits direct domain modules/tests and blocked-evidence reasons; aggregate full tests remain non-authoritative for domain evidence;
- verification is pending before 0E.2 closeout.
4. **0E.3 — evidence ledger + canonical app/PostgreSQL/browser/domain gates**.
5. **0E.4 — risk-based release orchestrator + compatibility full path**.
6. **0E.5 — negative/selection/freshness/config regression coverage**.
7. **0E.6 — manual workflow + DEVELOPMENT alignment**.
8. **0E.7 — exact-candidate verification / closeout**.

#### 0E.1 verification closeout

Verified locally on exact code head `34146fdc2cf8dc7645acfb1aea9de66078cd430a`:
- Node **24.19.0**;
- development-pipeline **72/72 PASS**;
- TypeScript **PASS**;
- aggregate regression **1361/1361 PASS**;
- production build **PASS**, **41/41** static pages;
- canonical planner smoke for `package.json` produced a deterministic candidate fingerprint and selected only development-infrastructure/application-source-contract + aggregate full tests + build, with PostgreSQL/browser disabled.

The build emitted only the pre-existing local Turbopack workspace warning about an unrelated parent-directory `package-lock.json`; it did not fail the repository build and is not a 0E.1 code regression.

Do not change product runtime, browser fixture architecture, DB schema, certification/backup contracts or 3.6.0 timezone semantics in Phase 0E.

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
