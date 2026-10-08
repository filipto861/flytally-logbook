# FlyTally development workflow

FlyTally uses a candidate-first development workflow. The objective is to keep normal iteration fast while retaining full integrity and performance gates where they are relevant.

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
4. Before the final PR/release candidate, run one complete local release gate appropriate to the change. `npm run verify` remains the normal application gate; add PostgreSQL/browser/scale coverage when the changed surface requires it.
5. Do **not** rerun the full local gate merely because documentation, comments, or a stale test/source assertion was corrected after an already-valid full gate. Run the affected targeted test(s). Repeat a heavy local gate only when the correction changes runtime behaviour, persistence/schema, auth/security, certification/recency logic, performance-critical code, or invalidates earlier evidence.
6. Publish one coherent candidate commit when practical. That commit creates/updates the PR. Vercel previews are currently intentionally skipped on non-production branches; local verification is the authoritative pre-merge gate.
7. Merge only after the required **local** release gates for the exact candidate succeed. GitHub Actions are not a required merge/release gate; Vercel still performs the production build when the released commit can affect runtime output.

## Toolchain baseline

- **Node.js 24.x** is the canonical runtime line for Logbook development and verification. It matches the Vercel project runtime, `.nvmrc`, `package.json#engines` and the manual GitHub workflows.
- **Playwright Test 1.55.0** is a direct locked development dependency. Local and manual-cloud browser acceptance must use that repository copy; do not install an ad-hoc runner version in the workflow.
- Run `npm ci` after dependency metadata changes. Do not treat a build from a different Node/Playwright toolchain as equivalent release evidence.
- PostgreSQL acceptance commands are destructive test-fixture gates and therefore accept only localhost/loopback `DATABASE_URL` targets. Use the repository's isolated local/CI PostgreSQL database; never point `test:postgres*` at Neon, production, staging, or any other remote database.

## Module scope registry

`tooling/development-modules.json` is the single development-only registry for module ownership, risk metadata and named targeted test groups. It does not participate in runtime application behaviour and existing runtime files should not be moved merely to satisfy the registry.

Phase 0B.1 uses registry version 2:
- Markdown/docs remain lightweight documentation;
- CSS is classified as `ui-presentation`, selects the UI contract group and build evidence, and does **not** invent PostgreSQL risk;
- registered tests select their owning test group rather than being treated as runtime changes;
- unknown `app/`, `components/` or `lib/` runtime files fail conservative to full unit/regression + build evidence, but do not automatically invent PostgreSQL/browser dependencies;
- explicit persistence, browser and scale paths can escalate only the relevant heavy gates;
- `[full-ci]` remains the explicit escape hatch that selects every heavy gate.

`tooling/development-scope.mjs` reports `typecheck`, `postgres`, `scale`, `browser`, `full_tests`, `build`, matched `modules`, `risks`, `test_groups`, resolved `targeted_tests`, `required_evidence`, `aggregate_gates` and `build_artifact`.

Named groups are executed through `npm run test:group -- <group>`. `npm run test:ui` is now only an alias for the registry-owned `ui-contract` group; the 16-file UI list is no longer duplicated in `package.json`.

The Phase 0B.2 registry expands stable ownership from the original **121/381 (31.8%)** baseline to **368/381 (96.6%)**. The remaining **13** reviewed cross-cutting/not-yet-owned runtime files are explicitly listed under `shared-runtime`; future unmatched runtime files still fail conservative instead of receiving guessed ownership. Registry regression coverage requires at least 90% stable ownership and zero unclassified files in the current audited surface.

### Phase 0E canonical planner candidate

`npm run verify:plan -- <candidate>` is the new canonical Phase 0E planner surface. It is implemented as a side-effect-free wrapper around the same registry classifier used by `scope:changed`.

Accepted candidate sources are explicit:
- repository-relative positional paths;
- `--files <path>` containing one repo-relative path per line;
- `--base <git-ref>` for an explicitly supplied committed comparison;
- `--all` for all tracked repository paths.

No candidate input is an error. Multiple candidate sources are an error. The planner does not guess `origin/main`, a merge base, or a branch target.

Use `--json` for machine-readable plan output. Every plan includes:
- a content-aware `candidateId`;
- current HEAD SHA and optional resolved base SHA;
- exact normalized candidate paths and a deterministic files hash;
- modules, risks, targeted groups and required evidence;
- explicit `typecheck`, aggregate/full-test, PostgreSQL, scale, browser and build requirements.

`--force-all` changes gate selection only; it does not change candidate membership. This is deliberately distinct from `--all`, which changes the candidate to all tracked paths.

Phase 0E.1 does **not** execute tests, builds, PostgreSQL or browser fixtures and does not yet claim evidence PASS. Evidence availability blocking and the execution ledger are subsequent 0E milestones.


### Phase 0E.2 direct domain evidence registry

Direct `domain-unit` evidence is now explicit **available evidence** on the existing module registry. Required evidence is still derived only from the canonical risk/gate policy; modules do not duplicate a `requiredEvidence` field.

A module whose risks require `domain-unit` declares exact reviewed test paths under:

```json
{
  "evidenceTests": {
    "domain-unit": ["tests/example.test.ts"]
  }
}
```

Rules:
- exact repository-relative test paths only; no globs or inferred filenames;
- current domain-risk modules must have at least one approved direct test;
- direct domain evidence files must not be PostgreSQL integration tests or source-contract group members;
- the same approved pure behavioral test may support more than one module when it directly exercises both contracts;
- adding a file to aggregate `npm test` does not make it direct evidence automatically.

`verify:plan` now exposes the approved direct-domain modules/tests under `plan.directEvidence["domain-unit"]`. Missing approved tests are reported in `blockedEvidence`; a blocked plan exits 3 after emitting the plan. The current registry is fully covered, so normal current domain modules have no missing-domain block.

### Phase 0E.3 candidate-bound verification ledger and canonical gates

Canonical verification executors now bind their observations to the exact `candidateId` produced by the planner and write local machine-readable records under ignored `.flytally/verification/<candidateId>/`.

Available command surface in this implementation batch:
- `npm run verify:app -- <candidate args>` — TypeScript, aggregate Node regression and production build. Legacy `npm run verify` remains no-argument compatible by treating the candidate as `--all`; when explicit candidate args are supplied it forwards them to `verify:app`. Aggregate regression remains non-behavioral evidence.
- `npm run verify:domain -- <candidate args>` — only the registry-approved direct `domain-unit` tests for the affected modules; required-but-unavailable direct evidence exits 3 before execution.
- `npm run verify:postgres -- <candidate args>` — complete PostgreSQL acceptance against the existing localhost-only fail-closed harness.
- `npm run verify:browser -- <candidate args>` — browser-only authenticated acceptance. It requires a successful build ledger for the same candidate and a matching current Next.js build identity before any browser fixture reset.
- `npm run verify:browser:with-build -- <candidate args>` — compatibility convenience that creates the candidate-bound production build first, then runs the browser-only gate.

The low-level `test:postgres*`, `test:browser`, `test:target` and `test:group` commands remain available for iteration. The existing static `verify:release` compatibility path remains unchanged until Phase 0E.4 replaces it with the risk-based orchestrator.

Browser acceptance is deliberately stricter than raw Playwright success:
- canonical browser execution forces `--retries=0` and `--workers=1`;
- `playwright.config.mjs` must remain `fullyParallel=false`;
- a stale/missing/mismatched build ledger blocks the browser gate with exit 3;
- raw Playwright skips are not acceptance PASS;
- the dedicated UI-audit capture skip is registered explicitly as an N/A exclusion, so it remains distinguishable from an unexpected skipped acceptance test.

Ledger files are local evidence artifacts, not repository state, and `.flytally/` is ignored by Git.



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

The manual GitHub workflows remain **manual-only diagnostics**. They do not infer a diff or override the local risk decision; their targeted mode uses the same registry-backed group runner, while heavy PostgreSQL/browser jobs still require explicit manual selection.

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

- `Verify FlyTally web` and `Browser smoke` may be started manually with `workflow_dispatch` only when an independent cloud reproduction is useful.
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

`npm run test:browser` remains the low-level authenticated browser runner. It fails before resetting the fixture unless both explicit browser-test flags are set; the bootstrap itself rejects a missing or non-local `DATABASE_URL`. Canonical `npm run verify:browser -- <candidate args>` is browser-only and first requires a fresh candidate-bound build ledger. Use `npm run verify:browser:with-build -- <candidate args>` when the compatibility build+browser flow is desired.

## PostgreSQL commands

- `npm run test:postgres` — core database/integrity acceptance tests, excluding large scale fixtures.
- `npm run test:postgres:scale` — retained 10k/50k/100k performance fixtures only.
- `npm run test:postgres:full` — all PostgreSQL integration tests.
- `npm run verify:postgres -- <candidate args>` — canonical full PostgreSQL acceptance with candidate-bound ledger evidence.
- `npm run verify:release` — temporary static compatibility path until the Phase 0E.4 risk-based orchestrator replaces it.

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
