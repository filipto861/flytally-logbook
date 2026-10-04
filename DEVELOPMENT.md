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
5. Do **not** rerun the full local gate merely because documentation, comments, or a stale test/source assertion was corrected after an already-valid full gate. Run the affected targeted test(s), then let PR CI independently re-prove the clean checkout. Repeat a heavy local gate only when the correction changes runtime behaviour, persistence/schema, auth/security, certification/recency logic, performance-critical code, or invalidates earlier evidence.
6. Publish one coherent candidate commit when practical. That commit creates the PR/Vercel preview when runtime-relevant files changed.
7. Merge only after the PR gates succeed. The production push does not repeat the same GitHub verification; Vercel performs the production build when the released commit can affect runtime output.

## Module scope registry

`tooling/development-modules.json` is the single development-only registry for module ownership and CI risk metadata. It does not participate in runtime application behaviour and existing runtime files should not be moved merely to satisfy the registry.

When a new product module is added, register its stable path prefixes there. Shared or previously unknown code remains conservative: it is reported as `shared` and receives the normal PostgreSQL gate. Documentation and CSS remain lightweight. Known performance hot paths are also registered centrally and trigger the retained scale gate.

`tooling/development-scope.mjs` consumes this registry both locally and in GitHub Actions. This keeps CI path logic out of workflow YAML and prevents future module additions from requiring another set of duplicated shell conditions.

## Vercel build filtering

`vercel.json` delegates the Ignored Build Step to `tooling/vercel-ignore-build.mjs`. The guard skips a deployment only when every changed file is development-only: Markdown documentation, `docs/`, `.github/`, `tests/`, or non-deployment `tooling/` files. The ignored-build guard itself is never treated as development-only because changing it must always exercise a real Vercel build.

Anything that may affect runtime or the build environment continues to deploy. This includes `app/`, `components/`, `lib/`, dependency metadata, TypeScript/Next configuration, `vercel.json` and `tooling/vercel-ignore-build.mjs` itself.

The guard first uses `VERCEL_GIT_PREVIOUS_SHA` when Vercel provides a usable commit. In this project Vercel preview checkouts may omit that variable and may not expose an `origin` remote. The safe fallback therefore matches the candidate-first workflow: production deployments compare the released commit with its first parent, while a preview without `VERCEL_GIT_PREVIOUS_SHA` may use its parent only when that parent is a GitHub-created merge commit from the normal production history. A preview with additional candidate commits after that production merge fails safe and requires the build rather than comparing only the latest commit.

If a safe diff base cannot be established, the guard requires the build. Do not broaden the development-only allowlist or weaken the trusted-parent rule merely to save a preview.

## Risk-based verification cadence

Verification depth follows the risk of the change, not the age or total size of the repository.

- **Iteration:** targeted tests only. Optimize for fast feedback while the implementation is still moving.
- **Milestone:** broaden only to the directly affected subsystem. Database, browser and scale suites are evidence for specific risks, not ritual gates after every edit.
- **Final local candidate:** one complete local release gate for the candidate, with the heavy subsystem suites required by its actual risk.
- **PR CI:** independent clean-checkout proof. CI is not a reason to duplicate an unchanged full local gate immediately beforehand or afterwards.
- **Production closeout:** run only release-specific checks such as DB preflight/postflight, deployment verification and smoke. Do not replay the entire development test matrix unless production evidence exposes a new uncertainty.

A failed gate should be diagnosed first. If the failure is a stale assertion, harness defect or documentation/source-contract drift, fix that defect and rerun the smallest test that proves the fix; do not blindly restart every expensive suite. If the failure exposes or may conceal a runtime/data-integrity defect, expand verification again before release.

This policy does not relax fail-closed behaviour, schema/certification integrity, auth/security gates, or production migration discipline. It removes redundant repetition while preserving independent release evidence.

## CI risk levels

Every pull request gets the **Fast application gate**: explicit `tsc --noEmit`, all unit/regression tests, and `next build`. The standalone TypeScript check is retained as a fast explicit integrity gate even though the production build also validates application types.

PostgreSQL is skipped only for documentation and CSS-only changes. Any other change runs the core PostgreSQL acceptance suite in parallel with the fast application gate.

The retained 10k/50k/100k scale tests run only when a known production hot path, scale fixture, or database optimization file changes. For a broad or release-critical candidate, add `[full-ci]` to the PR title; this forces the complete PostgreSQL suite including all retained scale gates.

## Authenticated browser acceptance

The authenticated Playwright suite uses one isolated mutable PostgreSQL fixture database for both desktop and mobile projects. `playwright.config.mjs` therefore pins the suite to **one worker** in local runs and CI. Do not override this with a higher worker count unless every worker/project receives an independently bootstrapped database.

After configuring the local browser-test database and environment, the canonical browser command is:

```bash
node tooling/bootstrap-browser-smoke-db.mjs
npx playwright test --config=playwright.config.mjs
```

## PostgreSQL commands

- `npm run test:postgres` — core database/integrity acceptance tests, excluding large scale fixtures.
- `npm run test:postgres:scale` — retained 10k/50k/100k performance fixtures only.
- `npm run test:postgres:full` — all PostgreSQL integration tests.
- `npm run verify:release` — explicit TypeScript, complete unit/regression, PostgreSQL and production-build verification when a suitable PostgreSQL test database is configured.

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
