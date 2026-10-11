# FlyTally Logbook

FlyTally Logbook is a private multi-user electronic pilot logbook built with Next.js, React, Neon PostgreSQL and Vercel.

The production source of truth lives in `app/`, `components/` and `lib/`. Regression and PostgreSQL acceptance coverage lives in `tests/`.

## Start here

This README is a stable navigation entrypoint, not the authority for current release status. Always establish the current GitHub `main` SHA before starting a new development session.

1. **[ROADMAP](ROADMAP.md)** — current release status, work order, owner decisions and next step.
2. **[DEVELOPMENT](DEVELOPMENT.md)** — active branch, risk-based verification and release workflow.
3. **[FEATURE LIST](FEATURES.md)** — capabilities, limitations and intentional exclusions.
4. **[ARCHITECTURE](ARCHITECTURE.md)** — runtime, data ownership, security and regulatory contracts.
5. **[CHANGELOG](CHANGELOG.md)** — append-only shipped/history evidence; read relevant sections, not the whole file by default.
6. **[Documentation index](docs/README.md)** — current supporting contracts, review records and dated history.

Historic [repository audit](docs/maintenance/2026-10-10-repository-audit.md), [roadmap snapshot](docs/history/ROADMAP_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) and [feature snapshot](docs/history/FEATURES_BEFORE_2026-10-10_CANONICAL_CLEANUP.md) remain dated evidence, not current instructions. For the current product version and next release, use the ROADMAP and independently verified deployment evidence.

## Runtime architecture

- Next.js 16 App Router and React 19
- Neon PostgreSQL transactional production database
- Vercel deployment
- server actions and authenticated API routes for mutations/private data
- certified flight revisions and audit/integrity evidence
- category-aware pilot logbook workflows
- recency/evidence planning with explicit regulatory boundaries
- pilot connections, shared flights and instructor verification
- GPS import, review and playback
- print/export, backup and recovery

## Repository layout

- `app/` — routes, pages, server actions and API endpoints
- `components/` — shared client/server UI
- `lib/` — database, regulatory, certification, backup, GPS and domain services
- `tests/` — TypeScript regression tests and PostgreSQL acceptance tests
- `e2e/` — browser/end-to-end coverage
- `data/` — read-only/reference datasets
- `docs/` — active supporting documentation and archived development evidence

## Verification

Typical local gate:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Database acceptance when the PostgreSQL test environment is configured:

```bash
npm run test:postgres
npm run test:postgres:full
```

The exact verification policy is defined in `DEVELOPMENT.md`. Never report a test, build, migration or deployment as successful unless it actually ran.

## Safety and regulatory boundary

FlyTally can preserve and evaluate pilot-entered evidence, but internal implementation and test success do not constitute approval by EASA, ÚCL, LAA or another authority.

The product must fail closed when required regulatory evidence is missing or ambiguous and must preserve certified/finalized records rather than silently rewriting them.
