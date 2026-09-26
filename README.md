# FlyTally Logbook

FlyTally Logbook is a private multi-user electronic pilot logbook built with Next.js, React, Neon PostgreSQL and Vercel.

The production source of truth lives in `app/`, `components/` and `lib/`. Regression and PostgreSQL acceptance coverage lives in `tests/`.

## Start here

For development continuity, use these documents in this order:

1. **`ROADMAP.md`** — current phase, next work, dependencies and frozen planning decisions.
2. **`FEATURES.md`** — canonical product capability inventory.
3. **`CHANGELOG.md`** — what actually changed.
4. **`ARCHITECTURE.md`** — runtime and domain architecture.
5. **`DEVELOPMENT.md`** — branch, verification, CI and deployment workflow.
6. **`docs/README.md`** — index of active supporting documentation and historical evidence.

Do not infer current development state from an old version-specific Markdown file. Historical milestone documents are stored under `docs/history/`.

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
