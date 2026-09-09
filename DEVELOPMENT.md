# FlyTally development workflow

FlyTally uses a candidate-first development workflow. The objective is to keep normal iteration fast while retaining full integrity and performance gates where they are relevant.

## Development loop

1. Work locally on a complete slice. Do not push every intermediate edit to the candidate branch.
2. During iteration, run only the tests that cover the changed behaviour:
   - `npm run typecheck` for a quick TypeScript-only check.
   - `npm run test:target -- tests/<relevant-file>.test.ts` for targeted regression tests.
3. Before publishing a candidate, run `npm run verify`. This runs the explicit TypeScript gate, the complete unit/regression suite once, and then the real Next.js production build.
4. Publish one coherent candidate commit when practical. That commit creates the PR/Vercel preview.
5. Merge only after the PR gates succeed. The production push does not repeat the same GitHub verification; Vercel performs the production build.

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
