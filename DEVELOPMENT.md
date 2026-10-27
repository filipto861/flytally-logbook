# FlyTally development workflow

### 2026-10-27 — Explicit manual production deployments from non-main refs
For owner-authorized manual Vercel deployments targeting production from an unmerged feature ref, `tooling/vercel-ignore-build.mjs` now **always requires a build**. The previous production `HEAD^1` fallback could see only a final docs checkpoint and cancel a release that contains runtime changes relative to the currently serving production build. Automatic Git deployments remain disabled by `vercel.json`, previews remain skipped, and `main` production docs-only filtering remains unchanged. The release operator still must independently verify main/work/deployed SHA, owner approval, runtime-vs-tested tree, database/schema target, and post-deploy alias/smoke; this guard is **not permission** to deploy an arbitrary branch or bypass release verification.


## Current N2-C draft acceptance inventory (23 October 2026)

The N2-C calendar SQL integration added a third pilot-insights test, so the exact current Draft PR #394 PostgreSQL inventory requires **42 integration files, 164 real tests and 6 protected partitions**, with 124 tests in `shared-core`. Each test file remains SHA-256 hash-pinned after strict UTF-8/canonical-LF normalization; modified fixture hashes and declared counts MUST be reconciled together and reviewed, never bypassed by relaxing the validator. Historical earlier acceptance counts (163/163) remain true only for their recorded older SHAs and are NOT evidence for the N2-C candidate. The browser selection protocol remains **version 2**; adding targets does not require changing the schema protocol version. Read-only `node tooling/validate-postgres-partition-registry.mjs` checks the inventory without connecting to a database. PostgreSQL/browser execution needs owned verified disposable localhost PG16 clusters per the trusted executor and all exact-candidate risk gates. These changes are test-tooling only, not runtime/production migration authorization.

FlyTally uses a candidate-first development workflow. The objective is to keep normal iteration fast while retaining full integrity and performance gates where they are relevant.

## Production deployment separation (16 Oct 2026 — pre-merge configuration candidate)

The repository config `vercel.json` explicitly disables automatic Git deployments from all branches, **including `main`**: `git.deploymentEnabled = {"*":false,"main":false}`. This is an intentional governance barrier, **not** a production deployment or permission to skip release checks. The standalone config PR must first pass candidate-bound verification and be squash-merged; before merging dependent feature PRs, independently inspect Vercel production deployment metadata after the config merge to confirm no new deployment was triggered. If the config merge does create a new production deployment or if the observable state is ambiguous, **STOP**; do not merge dependent feature PRs. Manual production deploy from an explicitly verified Git SHA requires a separate owner authorization, target preflight, and post-deploy production smoke. The product remains operational on the previously deployed production build until manual deployment is authorized.

## Development loop

1. Work locally on a complete slice. Do not push every intermediate edit to the candidate branch.
2. During iteration, run only the tests that cover the changed behaviour:
   - `npm run typecheck` when TypeScript/application contracts changed or a quick compile check is useful.
   - `npm run test:target -- tests/<relevant-file>.test.ts` for targeted regression tests.
   - `npm run scope:changed -- <path> [<path> ...]` to see the development modules and CI risk selected for a set of changed files.
3. At a meaningful milestone, run the smallest broader gate justified by the changed surface:
   - UI-only work: focused browser coverage for the affected flow when needed.
   - persistence/schema/data-integrity work: relevant PostgreSQL acceptance.
   - known scale/performance hot paths: the retained scale fixture for that path.
   - unrelated heavy suites are not a default milestone requirement.
4. Before the final PR/release candidate, run the candidate-aware local release gate appropriate to the change: `npm run verify:release:risk -- <candidate>`. It consumes the planner and runs or reuses only the selected authoritative gates. `npm run verify` remains a compatibility application gate, not the final risk-based release decision.
5. Do **not** rerun the full local gate merely because documentation, comments, or a stale test/source assertion was corrected after an already-valid full gate. Run the affected targeted test(s). Repeat a heavy local gate only when the correction changes runtime behaviour, persistence/schema, auth/security, certification/recency logic, performance-critical code, or invalidates earlier evidence.
6. Publish one coherent candidate commit when practical. That commit creates/updates the PR. Vercel previews are currently intentionally skipped on non-production branches; local verification is the authoritative pre-merge gate.
7. Merge only after the required **local** release gates for the exact candidate succeed. GitHub Actions are not a required merge/release gate; Vercel still performs the production build when the released commit can affect runtime output.

## Toolchain baseline

- **Node.js 24.x** is the canonical runtime line for Logbook development and verification. It matches the Vercel project runtime, `.nvmrc`, `package.json#engines` and the manual GitHub workflows.
- **Playwright Test 1.55.0** is a direct locked development dependency. Local and manual-cloud browser acceptance must use that repository copy; do not install an ad-hoc runner version in the workflow.
- Run `npm ci` after dependency metadata changes. Do not treat a build from a different Node/Playwright toolchain as equivalent release evidence.
- PostgreSQL acceptance commands are destructive test-fixture gates and therefore accept only localhost/loopback `DATABASE_URL` targets. Use the repository's isolated local/CI PostgreSQL database; never point `test:postgres*` at Neon, production, staging, or any other remote database.

## Module scope registry (current contract)

The authoritative **development-only** registry is `tooling/development-modules.json` (schema/version **3** at this documentation checkpoint). It owns module/path classification, targeted source/domain groups, risk metadata, and selected PostgreSQL/browser/scale evidence. Changes to classification require reviewed registry+test updates, not a docs-only assumption. **Unknown application runtime files fail conservative**: they do not automatically invent PostgreSQL/browser dependencies without an explicit risk/path contract.

Use the commands defined in `package.json` and `tooling/`:

- `npm run scope:changed -- <path> [<path> ...]` — read-only **scope classifier**, never a test runner;
- `npm run verify:plan -- <candidate>` — explicit candidate/risk/evidence plan; missing/ambiguous candidate is an error;
- `npm run verify:iterate -- <candidate>` — targeted iteration for applicable evidence;
- `npm run test:group -- <registered-group>` and `npm run test:target -- <test-file>` — registered group or targeted regression;
- `npm run verify:release:risk -- <candidate>` — authoritative exact-candidate local release-gate evaluation; only selected heavy tests run. `npm run verify` and `verify:release` retain their different compatibility/full behavior;
- PostgreSQL and authenticated browser/scale tests are required only when the planner/risk contract selects them; missing required evidence is **NOT RUN / blocked**, never PASS or N/A.

**Historical implementation and verification results:** The original 0B/0E/0F module-registry and candidate-system development narrative is preserved [verbatim here](docs/history/DEVELOPMENT_PHASE0_VERIFICATION_HISTORY.md). Dates, historical ownership counts, old registration versions and intermediate “not active” statements in that archive must not override the current registry or the active execution contract below.

### Changed-scope execution contract

`npm run scope:changed -- <path> [<path> ...]` is a **planner**, not an executor. It must never connect to PostgreSQL, reset browser fixtures, start Playwright or run a build by itself. Its output is the explicit verification contract for the supplied change set:

- `typecheck=true`: TypeScript checking is required; this defaults true for non-documentation candidates and false for documentation-only candidates;
- `test_groups`: named registry-backed targeted groups for fast iteration; run them with `npm run test:group -- <group>`;
- `full_tests=true`: the final candidate needs the complete `npm test` application regression gate;
- `postgres=true`: run PostgreSQL acceptance against an isolated localhost fixture; `scale=true` means use the full/scale acceptance path rather than the core-only path;
- `browser=true`: run authenticated browser acceptance with its isolated localhost browser fixture;
- `build=true`: run `npm run build` for final candidate evidence;
- a heavy gate is required only when its own flag is true; `full_tests` does not silently imply PostgreSQL or browser work.

Targeted group membership, PostgreSQL scale-test membership, and module/risk ownership are single-sourced in `tooling/development-modules.json`. The PostgreSQL runner reads its scale membership from that registry, and the manual cloud targeted path executes the registry-backed `ui-contract` group directly. `npm run test:ui` remains only a local convenience alias for the same group.

The manual GitHub workflows remain **manual-only diagnostics**. They do not infer a diff, write candidate-bound release authority, or override the local `verify:release:risk` decision. Their targeted mode uses the same registry-backed group runner; the PostgreSQL workflow requires explicit selection, and `Browser smoke` intentionally runs the legacy full browser diagnostic rather than `browser-risk`.

## Evidence taxonomy and reporting

Phase 0D separates three concepts that must not be conflated:

- **risk** — what a change may have affected;
- **gate** — which command/suite should be executed;
- **evidence class** — what a successful observation is actually allowed to prove.

The canonical behavioral evidence classes are:

1. `domain-unit` — direct business-rule / fail-closed behavior;
2. `application-source-contract` — wiring, governance and static/source presentation invariants;
3. `postgres-acceptance` — real PostgreSQL persistence, constraint and transaction behavior;
4. `browser-acceptance` — user-visible browser workflow, responsive and async behavior.

The production build is reported independently as the non-behavioral `build` artifact. `npm test` / `fullTests` remains an **aggregate regression gate**; its aggregate PASS count does not by itself prove `domain-unit` or any other behavioral evidence class.

`tooling/development-modules.json` schema v3 owns the evidence taxonomy and homogeneous named-group metadata. Current named groups `ui-contract` and `development-pipeline` are `application-source-contract`; source-contract groups must not import Playwright, PostgreSQL clients, browser fixtures or DB fixtures.

`npm run scope:changed -- ...` remains a **planner only**. In addition to the existing gate flags it reports:
- `required_evidence` — behavioral evidence classes required by the selected risk/gate contract;
- `aggregate_gates` — aggregate gates such as `full-tests` that are useful regression coverage but are not evidence classes;
- `build_artifact` — whether an independent build result is required.

The planner does **not** emit observed PASS/FAIL evidence because it does not execute tests. Observed evidence is recorded only after a command actually ran.

### Evidence status contract

For each applicable behavioral class and for build, report one of `PASS`, `FAIL`, `NOT RUN`, `N/A` or diagnostic `PARTIAL`.

- Required + no execution = `NOT RUN`; it is never `N/A`.
- `N/A` is valid only when the planner/risk contract does not require that evidence class.
- A source/regex/static contract PASS proves only `application-source-contract`; it does **not** prove runtime domain behavior, browser behavior or PostgreSQL behavior.
- A build PASS proves only that the build artifact completed; it does not satisfy any behavioral evidence class.
- `fullTests` is aggregate regression evidence only and must not synthesize `domain-unit`.
- `postgres-acceptance` and `browser-acceptance` may be PASS only from their dedicated full acceptance gates, with retries = 0.
- Raw skipped acceptance cases prevent PASS. Intentional exclusions must be classified explicitly as N/A cases so planned = passed + failed + explicit N/A.
- Evidence reports should record command, planned/executed counts, failures, explicit N/A count, retries, coverage and source gate.

`tooling/evidence-contract.mjs` is the machine-checkable status evaluator for these semantics. It intentionally fails required missing evidence as `NOT RUN` and rejects aggregate/build/source-contract results that attempt to masquerade as a different behavioral class.

## Vercel build filtering

`vercel.json` delegates the Ignored Build Step to `tooling/vercel-ignore-build.mjs`.

Current policy is explicit:
- **non-production branches:** Vercel preview builds are intentionally skipped; local-first verification is authoritative and GitHub Actions remain optional manual diagnostics;
- **production/main:** development-only changes may skip the production build, while runtime/dependency/deployment changes require it.

For production, the guard treats Markdown documentation, `docs/`, `.github/`, `tests/`, and non-deployment `tooling/` files as development-only. The ignored-build guard itself is never development-only because changing it must exercise the production build decision path.

Anything that may affect runtime or the build environment continues to require a production build. This includes `app/`, `components/`, `lib/`, dependency metadata, TypeScript/Next configuration, `vercel.json` and `tooling/vercel-ignore-build.mjs` itself.

The preview-skip policy is a deliberate cost/workflow decision, not evidence that a preview build passed. Phase 0 may revisit this policy separately if independent preview-build evidence is judged worth the additional Vercel build volume; do not silently rely on a preview that was intentionally canceled/skipped.

## Risk-based verification cadence

Verification depth follows the risk of the change, not the age or total size of the repository.

- **Iteration:** targeted tests only. Optimize for fast feedback while the implementation is still moving.
- **Milestone:** broaden only to the directly affected subsystem. Database, browser and scale suites are evidence for specific risks, not ritual gates after every edit.
- **Final local candidate:** one complete local release gate for the candidate, with the heavy subsystem suites required by its actual risk.
- **GitHub Actions:** optional manual diagnostic only. They are not part of the normal merge/release gate.
- **Production closeout:** run only release-specific checks such as DB preflight/postflight, deployment verification and smoke. Do not replay the entire development test matrix unless production evidence exposes a new uncertainty.

A failed gate should be diagnosed first. If the failure is a stale assertion, harness defect or documentation/source-contract drift, fix that defect and rerun the smallest test that proves the fix; do not blindly restart every expensive suite. If the failure exposes or may conceal a runtime/data-integrity defect, expand verification again before release.

This policy does not relax fail-closed behaviour, schema/certification integrity, auth/security gates, or production migration discipline. It removes redundant repetition while preserving independent release evidence.

## GitHub Actions policy

GitHub Actions are **manual-only** and are not part of the normal FlyTally merge/release gate.

- `Verify FlyTally web` and `Browser smoke` may be started manually with `workflow_dispatch` only when an independent cloud reproduction is useful. Their jobs are labeled as diagnostics; they must not be reported as the candidate-bound release verdict.
- Normal development and release verification are performed on the developer workstation.
- Do not use GitHub Actions as the primary debugging loop or as a mandatory release ritual.
- A release may be merged with GitHub CI **NOT RUN by decision** when the required local evidence for the changed surface is complete.
- Never claim GitHub CI PASS when it was not run.

The local gate remains risk-based: TypeScript/unit-regression, PostgreSQL, browser, build and scale coverage are required only where the changed surface justifies them.

## Browser verification cadence

The authenticated browser suite is intentionally serialized because it mutates one shared isolated PostgreSQL fixture. A repository-wide Playwright run is therefore relatively expensive and is **not** a mandatory gate for every feature release.

Use:
- targeted changed-flow browser tests during implementation;
- targeted responsive matrices when the changed UI needs desktop/iPad/mobile/light/dark coverage;
- the complete Playwright suite only for broad cross-product shell changes, browser-harness changes that can affect unrelated flows, or when a specific regression risk justifies it.

When a test already iterates its own viewport/theme matrix, running that matrix under both Playwright device projects is normally redundant. Prefer a single desktop project for that matrix unless the test explicitly depends on mobile user-agent/touch semantics.

## Authenticated browser acceptance

The authenticated Playwright suite uses one isolated mutable PostgreSQL fixture database for both desktop and mobile projects. `playwright.config.mjs` therefore pins the suite to **one worker** in local runs and CI. Do not override this with a higher worker count unless every worker/project receives an independently bootstrapped database.

During Phase 0C browser-structure work, `tooling/browser-suite-baseline.json` and `tests/browser-suite-structure.test.ts` freeze the current acceptance invariants: 48 logical authenticated test names, the two-project/one-worker contract, centralized browser DB fixture ownership, known fixture identities and required responsive/theme states. Split specs may move tests between files, but those invariants must remain green unless an independent product/test-architecture decision explicitly changes them.

Phase 0C.1 keeps shared browser actions intentionally small. `e2e/browser-actions.mjs` may contain only proven cross-domain UI primitives; GPS, aircraft-authority, RoleCrew and other domain workflows stay local until post-split reuse proves otherwise. Helper extraction must preserve selectors, waits, assertions and timeout semantics exactly enough that the complete authenticated browser gate remains equivalent.


A self-managed viewport matrix is not equivalent to a mobile Playwright device project. `page.setViewportSize()` does not recreate mobile user agent, touch, `isMobile`, device scale factor, safe-area, virtual-keyboard or pointer/hover semantics. A second project may therefore be removed only after those semantics are proven irrelevant for that test. Phase 0C.3 will make deduplication evidence explicit with a local full gate using `--retries=0`.


After configuring the local browser-test database and environment, the application server must be told to use the localhost PostgreSQL adapter rather than the Neon HTTP client. A localhost `DATABASE_URL` without `FLYTALLY_LOCAL_POSTGRES=1` is invalid for authenticated browser acceptance.

Canonical local setup:

```bash
npm ci
npx --no-install playwright install chromium
export DATABASE_URL=postgresql://flytally:flytally@127.0.0.1:55432/flytally_browser
export FLYTALLY_LOCAL_POSTGRES=1
export FLYTALLY_AUTH_BROWSER=1
export FLYTALLY_BROWSER_PASSWORD=FlyTally-Browser-2026!
export SESSION_SECRET=flytally-browser-session-secret-not-production
export SIGNING_SECRET=flytally-browser-signing-secret-not-production
npm run verify:browser:with-build -- --all
```

PowerShell equivalent:

```powershell
npm ci
npx --no-install playwright install chromium
$env:DATABASE_URL="postgresql://flytally:flytally@127.0.0.1:55432/flytally_browser"
$env:FLYTALLY_LOCAL_POSTGRES="1"
$env:FLYTALLY_AUTH_BROWSER="1"
$env:FLYTALLY_BROWSER_PASSWORD="FlyTally-Browser-2026!"
$env:SESSION_SECRET="flytally-browser-session-secret-not-production"
$env:SIGNING_SECRET="flytally-browser-signing-secret-not-production"
npm run verify:browser
```

`npm run test:browser` remains the low-level authenticated browser runner. It fails before resetting the fixture unless both explicit browser-test flags are set; the bootstrap itself rejects a missing or non-local `DATABASE_URL`. Canonical release browser evidence uses `npm run verify:browser:risk -- <candidate args>`; it owns or reuses a fresh candidate-bound build and executes only the exact planner-selected risk targets. `npm run verify:browser -- <candidate args>` and `verify:browser:with-build` are legacy full-matrix diagnostics only.

## Owned PostgreSQL 16 acceptance for subsequent PRs (Draft; validation pending)

The six-partition PG16 executor introduced by PR #340 has an explicitly gated, reusable **owner-local** entrypoint. It runs the pinned 42 files / 163 tests in six newly created and physically verified `127.0.0.1` PostgreSQL 16 clusters; the caller does **not** supply or reuse a database. The original PR340 `FLYTALLY_PR340_PARTITION_RELEASE=1` path and ordinary single-database path are unchanged.

In a **clean** worktree whose HEAD matches a freshly fetched remote topic branch, with Node.js 24 and native Windows PostgreSQL 16 tools:

```powershell
git fetch origin
$env:FLYTALLY_OWNED_PG16_RELEASE="1"
$env:FLYTALLY_OWNED_PG16_EXPECTED_REF="refs/remotes/origin/fix/your-topic-branch"
npm run verify:postgres -- --base origin/main
Remove-Item Env:FLYTALLY_OWNED_PG16_RELEASE,Env:FLYTALLY_OWNED_PG16_EXPECTED_REF -ErrorAction SilentlyContinue
```

The expected origin branch is an identity check, **not** a connection string. Only topic branches with `fix/`, `feat/`, `chore/` or `test/` are accepted. HEAD must exactly match that fetched remote branch; staged, unstaged or untracked files cause refusal. Both owned-mode flags must be explicitly present, and the legacy PR340 flag must not also be enabled. CI/Vercel environments are refused. A `DATABASE_URL` is **not required** for `verify:postgres` in this mode; its own launcher creates fresh clusters and does not use inherited PostgreSQL routing/credentials. Old generic mode still requires a localhost `DATABASE_URL`.

The canonical verifier writes `postgres-acceptance` ledger only after direct execution of all six partitions with strict TAP, no missing/failed/skipped/retried cases, and verified distinct cluster identities. A `VALIDATED-ONLY` diagnostic report is **not** release authority. Shared-core runs under the declared controlled-local `work_mem=64MB` benchmark profile (unchanged performance limits); this proves neither production defaults nor Neon latency. No runtime or production database DDL is authorized by this mode.

For `verify:release:risk`, browser acceptance may also be required. That remains a **separate** authenticated fixture, with its own disposable localhost `DATABASE_URL`, `FLYTALLY_AUTH_BROWSER=1`, `FLYTALLY_LOCAL_POSTGRES=1`, and, when required for v21 schema-first, both `FLYTALLY_CURRENCY_V21_BROWSER=1` and `FLYTALLY_V21_RISK_BROWSER=1`. Do not point a browser fixture reset at an existing database. Source-only, PG-only and browser-only evidence must remain separately identified.

**Verification status:** This reusable mode was staged in a Draft PR; same-head typecheck, contract tests, canonical PostgreSQL release evidence and full release acceptance are **NOT RUN** until demonstrated by owner-local logs.

## PostgreSQL commands

- `npm run test:postgres` — core database/integrity acceptance tests, excluding large scale fixtures.
- `npm run test:postgres:scale` — retained 10k/50k/100k performance fixtures only.
- `npm run test:postgres:full` — all PostgreSQL integration tests.
- `npm run verify:postgres -- <candidate args>` — canonical full PostgreSQL acceptance with candidate-bound ledger evidence.
- `npm run verify:release` — unchanged static compatibility full path.
- `npm run verify:release:risk -- <candidate args>` — planner-driven candidate release orchestration with exact ledger reuse and one final evidence matrix.

The PostgreSQL runner now owns the integration-test intent: an explicitly invoked PostgreSQL command injects `FLYTALLY_POSTGRES_INTEGRATION=1` into its child test process after preflight. It fails before the suite when `DATABASE_URL` is missing or the `psql` client cannot be executed. A PostgreSQL gate must never report success by silently skipping the integration suite.

## Deployment discipline

The canonical production branch is `main`. Development changes should reach it through a reviewed candidate PR, not by direct iterative pushes. `npm run build` is deliberately build-only so Vercel does not rerun the application test suite on every preview or production deployment. Feature branches are temporary and should be deleted after merge; release history belongs in commits, tags, and GitHub Releases rather than long-lived version branches.

## Documentation governance

Every significant work cycle must reconcile the canonical development documents before it is closed:

Every significant PR must either update the relevant canonical document(s) or state explicitly in the PR why ROADMAP / FEATURES / CHANGELOG are `N/A`. Merely reading the documents does not satisfy this requirement.

- `ROADMAP.md` — update when priority, phase, dependencies, status or a frozen product decision changes.
- `FEATURES.md` — update when a capability is added, removed, materially changed or explicitly deferred.
- `CHANGELOG.md` — record what actually merged; never mark planned or unverified work as completed.

Do not create a new root-level version-specific Markdown file for routine milestones. Use the canonical documents first. Supporting analysis belongs under the appropriate `docs/` area; superseded milestone notes belong under `docs/history/`.

A new development chat should reconstruct state from actual repository state first, then ROADMAP, FEATURES, CHANGELOG, architecture/development docs and the latest verified handoff or PR evidence. If those sources disagree, reconcile the drift before new implementation.

Documentation-only changes still use a branch and PR, but runtime/database verification is `N/A` unless the documentation change also modifies executable/configuration files.

**Optional documentation health report (report-only, not a release gate):** run `node docs/scripts/check-documentation.mjs` after document edits and `node --test docs/scripts/check-documentation.test.mjs` when changing that helper. It uses only local files, checks package/lock versions and ordinary active-doc relative paths, excludes dated historical source documents and prints warnings without blocking PRs. [Exact scope and limitations](docs/scripts/README.md). The tool is intentionally kept under `docs/` as a manual docs-only utility; do not move runtime code there to evade risk classification. Human source review is still required for semantic correctness, regulatory claims, deployment identity and historical effectivity.



## Product versioning

Current planning and releases follow `docs/product/VERSIONING.md`.

- Use numeric `MAJOR.MINOR.PATCH` product versions.
- New ROADMAP work is identified by the target product release number and numeric phases, not by new letter-coded milestone families.
- `CHANGELOG.md` records actual merged/shipped changes; planned scope belongs in ROADMAP.
- Keep `package.json`, any visible app version, release changelog heading and release tag aligned at ship time.
- PostgreSQL migration versions, certification payload versions and backup format versions remain independent technical counters.
- Historical letter-coded milestone names remain untouched where needed for traceability, but do not create new ones.


## Local-first verification

For significant feature work, keep the pull request in **Draft** while implementation is active.

During development and release preparation:
- use the developer workstation for targeted tests, TypeScript, browser checks, PostgreSQL checks and production build as required by the changed scope;
- GitHub Verify and Browser Smoke do not run automatically;
- do not use GitHub Actions as the debugging loop;
- use a manual GitHub workflow only when Filip explicitly wants an independent cloud reproduction.

Before merge:
1. complete the relevant local release gate on the exact candidate;
2. update ROADMAP / FEATURES / CHANGELOG;
3. record GitHub CI as `NOT RUN — local-first policy` unless a manual workflow was explicitly requested;
4. merge only after the local evidence required by the changed surface is complete.

This is a deliberate workflow choice, not a claim that CI passed.
