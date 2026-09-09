# FlyTally development workflow

FlyTally uses a candidate-first development workflow. The objective is to keep normal iteration fast while retaining full integrity and performance gates where they are relevant.

## Development loop

1. Work locally on a complete slice. Do not push every intermediate edit to the candidate branch.
2. During iteration, run only the tests that cover the changed behaviour:
   - `npm run typecheck` for a quick TypeScript-only check.
   - `npm run test:target -- tests/<relevant-file>.test.ts` for targeted regression tests.
   - `npm run scope:changed -- <path> [<path> ...]` to see the development modules and CI risk selected for a set of changed files.
3. Before publishing a candidate, run `npm run verify`. This runs the explicit TypeScript gate, the complete unit/regression suite once, and then the real Next.js production build.
4. Publish one coherent candidate commit when practical. That commit creates the PR/Vercel preview when runtime-relevant files changed.
5. Merge only after the PR gates succeed. The production push does not repeat the same GitHub verification; Vercel performs the production build when the released commit can affect runtime output.

## Module scope registry

`tooling/development-modules.json` is the single development-only registry for module ownership and CI risk metadata. It does not participate in runtime application behaviour and existing runtime files should not be moved merely to satisfy the registry.

When a new product module is added, register its stable path prefixes there. Shared or previously unknown code remains conservative: it is reported as `shared` and receives the normal PostgreSQL gate. Documentation and CSS remain lightweight. Known performance hot paths are also registered centrally and trigger the retained scale gate.

`tooling/development-scope.mjs` consumes this registry both locally and in GitHub Actions. This keeps CI path logic out of workflow YAML and prevents future module additions from requiring another set of duplicated shell conditions.

## Vercel build filtering

`vercel.json` delegates the Ignored Build Step to `tooling/vercel-ignore-build.mjs`. The guard skips a deployment only when every changed file is development-only: Markdown documentation, `docs/`, `.github/`, `tests/`, or non-deployment `tooling/` files. The ignored-build guard itself is never treated as development-only because changing it must always exercise a real Vercel build.

Anything that may affect runtime or the build environment continues to deploy. This includes `app/`, `components/`, `lib/`, dependency metadata, TypeScript/Next configuration, `vercel.json` and `tooling/vercel-ignore-build.mjs` itself.

The guard first uses `VERCEL_GIT_PREVIOUS_SHA` when Vercel provides a usable commit. In this project Vercel preview checkouts may omit that variable and may not expose an `origin` remote. The safe fallback therefore matches the candidate-first workflow: production deployments compare the released commit with its first parent, while a preview without `VERCEL_GIT_PREVIOUS_SHA` may use its parent only when that parent is a GitHub-created merge commit from the normal production history. A preview with additional candidate commits after that production merge fails safe and requires the build rather than comparing only the latest commit.

If a safe diff base cannot be established, the guard requires the build. Do not broaden the development-only allowlist or weaken the trusted-parent rule merely to save a preview.

## CI risk levels

Every pull request gets the **Fast application gate**: explicit `tsc --noEmit`, all unit/regression tests, and `next build`. The standalone TypeScript check is retained as a fast explicit integrity gate even though the production build also validates application types.

PostgreSQL is skipped only for documentation and CSS-only changes. Any other change runs the core PostgreSQL acceptance suite in parallel with the fast application gate.

The retained 10k/50k/100k scale tests run only when a known production hot path, scale fixture, or database optimization file changes. For a broad or release-critical candidate, add `[full-ci]` to the PR title; this forces the complete PostgreSQL suite including all retained scale gates.

## PostgreSQL commands

- `npm run test:postgres` — core database/integrity acceptance tests, excluding large scale fixtures.
- `npm run test:postgres:scale` — retained 10k/50k/100k performance fixtures only.
- `npm run test:postgres:full` — all PostgreSQL integration tests.
- `npm run verify:release` — explicit TypeScript, complete unit/regression, PostgreSQL and production-build verification when a suitable PostgreSQL test database is configured.

## Deployment discipline

The production branch is `codex/vercel-migration-v080`. Development changes should reach it through a reviewed candidate PR, not by direct iterative pushes. `npm run build` is deliberately build-only so Vercel does not rerun the application test suite on every preview or production deployment.
