# FlyTally Logbook — working rules

Private multi-user electronic pilot logbook (EASA Part-FCL oriented). Next.js 16 App Router + React 19, TypeScript, Neon PostgreSQL, Vercel. Production: `fly-tally.com`.

`flytally-training` is a separate repository. Never change it from here.

## Where things are

| Need | Read |
|---|---|
| System map, data model, invariants | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Current state and backlog | [ROADMAP.md](ROADMAP.md) |
| Regulatory rules ↔ code, claims the product must never make | [docs/REGULATORY.md](docs/REGULATORY.md) |
| UI tokens, components, accessibility, CSS debt | [docs/DESIGN.md](docs/DESIGN.md) |
| Applied production SQL migrations | [sql/migrations/](sql/migrations/README.md) |

Code, schema and tests are the source of truth. If a document disagrees with the code, fix the document. History lives in git (`git log`), not in documents.

## Commands

```bash
npm ci
npm run dev                 # local dev server
npm run typecheck
npm test                    # unit tests (no database)
npm run test:target -- tests/foo.test.ts
npm run build
npm run verify              # typecheck + unit tests + build
npm run test:postgres       # integration correctness tests (39 files), needs local PostgreSQL 16
npm run test:postgres:scale # timing-based 10k/50k/100k-flight scale tests
npm run test:postgres:full  # both
npm run test:browser        # Playwright, needs local PostgreSQL 16 and a prior build
```

PostgreSQL and browser tests need `DATABASE_URL=postgresql://flytally@127.0.0.1:<port>/flytally_currency_test` on a disposable local server. Use a non-default port (not 5432 or 55432), user `flytally` and no password. The runners refuse anything that isn't localhost. They create and drop databases and reset the fixture.

## Rules

1. **Data integrity first.** Missing or conflicting critical data (aircraft identity, category, role, certification evidence, currency) must **fail closed**. Never invent defaults, infer CURRENT status from missing evidence, or silently convert money.
2. **Certified records are protected.** Certification fingerprints, revisions, signatures bound to exact revisions, void archives and audit history must never be silently mutated or resurrected. Treat the restore, Trash, certification and sharing paths as high-risk.
3. **Tenant safety.** Every query is scoped by the authenticated `user_id`. Cross-user access goes only through explicit participation or verification records.
4. **No regulatory or commercial claims** beyond what [docs/REGULATORY.md](docs/REGULATORY.md) allows. Tests passing is not authority approval.
5. **Never touch production without the owner's explicit approval in the current conversation.** This covers the production Neon database, migrations, Vercel deploys, environment variables, feature flags and the backup crons. Never point tests at a non-local database.
6. **Small, scoped changes.** One concern per branch or PR. Don't mix refactoring with behaviour changes in high-risk areas.
7. **Verify by risk.** Every change runs `npm run verify`. Changes to SQL, schema, restore, Trash, certification or sharing also run `npm run test:postgres`. Changes to hot read paths (dashboard, flight list, statistics, print/export) also run `npm run test:postgres:scale`. User-visible flows also run the relevant browser specs. Report exactly what ran and what didn't. Never claim a run you didn't do.
8. **UI work** follows [docs/DESIGN.md](docs/DESIGN.md): use existing tokens and components, keep light and dark themes and mobile/iPad working, keep focus and keyboard behaviour, and use 44 px touch targets.
9. **No secrets or private pilot data** in the repository, commits or logs.

## Deployment

Vercel git auto-deploy is **disabled** (`vercel.json`). Production deploys are manual and owner-approved. Merging to `main` does not deploy. Production schema changes are applied **before** deploying code that needs them, using reviewed scripts in `sql/migrations/` (preflight, migrate, postflight). The runtime (`lib/db-optimization.ts`) refuses to create v21 anywhere except a disposable local test database. New schema versions must follow the same schema-first pattern.

## Known debt (don't spread it; reduce it when you're working nearby)

- About 1,500 unit tests. Most of them assert **source text by regex** rather than behaviour. They lock wording, class names and CSS order. When a test only locks text, prefer replacing it with a behavioural test.
- 47 global stylesheets with version-named layers and override specificity. See the [DESIGN debt section](docs/DESIGN.md#11-known-structural-debt-input-for-css-consolidation).
- Runtime schema initialisation is spread over `lib/db-optimization.ts` and many `lib/v*-schema.ts` modules.
- Test and file names carry historical version prefixes (`v140-…`, `v380-…`). New files use descriptive names without version prefixes.
