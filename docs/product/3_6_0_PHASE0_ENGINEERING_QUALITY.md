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

The integration tests examined gate themselves with:

`process.env.FLYTALLY_POSTGRES_INTEGRATION === "1"`

and use Node test `skip` when that flag is absent.

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

### P2 — Toolchain runtime is not explicitly pinned

GitHub workflows currently use Node 22, while package metadata does not define a root Node engine/version file and `@types/node` is on the 24 line.

This is not evidence of a runtime defect, but it is avoidable environment ambiguity.

**Decision required:** choose and document one supported Node runtime line after checking local/Vercel compatibility, then align package/workflow/developer setup.

### P2 — Git/PR hygiene has accumulated stale state

At audit start, five older PRs remained open (#187, #201, #206, #231, #232) and more than twenty non-`main` branches remained.

Do not delete them blindly. First prove each is merged-equivalent, superseded or intentionally retained; then close/delete only the proven stale set.

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
