# FlyTally architecture — v1.52

## Production stack

FlyTally is a Next.js 16 / React 19 application deployed on Vercel and backed by Neon PostgreSQL. The active runtime is TypeScript only.

Production code boundaries:

- `app/` — App Router pages, server actions and API routes
- `components/` — reusable UI and interaction components
- `lib/` — domain, data, regulatory, certification, GPS and backup services
- `tests/` — TypeScript regression coverage and PostgreSQL acceptance tests

The pre-Vercel Streamlit/Python application is not part of the active tree from v1.52.0 onward. Git history is the archive for that implementation.

## Database and tenancy

Neon PostgreSQL is the transactional source of truth. Queries and mutations are scoped by authenticated `user_id`; cross-user workflows use explicit participation/verification records rather than weakening ownership filters.

`lib/db.ts` owns the Neon client and initializes it lazily so build-time module imports do not require a live production database connection.

Schema compatibility is runtime-gated through `lib/runtime-schema.ts`:

1. base database migrations/optimizations run first;
2. compatible feature schema gates then initialize in parallel;
3. each gate is idempotent;
4. a failed gate clears the process-local promise so a later request can retry instead of leaving the runtime permanently poisoned.

Current feature schema gates include the certification/workflow foundation and the structured movement, training and aircraft-credit additions introduced through v1.51.

## Certified record model

Flights remain ordinary editable records until certification. Certification establishes a protected revision/fingerprint boundary. Corrections create a new revision instead of mutating the meaning of previously certified/signed evidence.

Important separations:

- `flights` contains the pilot's record;
- certification history preserves revision fingerprints;
- `flight_participations` represents shared-flight workflow/ownership linkage;
- `flight_verifications` represents signed verification evidence bound to an exact flight revision/hash;
- audit records preserve material changes independently of the UI.

The current application must not make a signed historical verification appear valid for a later corrected revision.

## Regulatory and recency architecture

Regulatory planning is separated into four layers:

- `lib/recency-engine.ts` — deterministic rule evaluation from normalized evidence;
- `lib/recency-service.ts` — authenticated database projection and compatibility normalization;
- `lib/recency-audit.ts` — explanation/evidence rows for an evaluation;
- `lib/recency-audit-service.ts` — database projection used by the audit layer.

The engine itself remains strict. Compatibility rules are applied only where provenance makes them safe, before evaluation.

### Structured movements

Modern EASA records can carry explicit PF take-off, approach and landing counters. Explicit zero is authoritative. A structured-era record without movement evidence is not silently reconstructed.

Certified EASA flights created before the v1.35.3 structured-movement boundary can use the bounded legacy compatibility layer, based on creation provenance rather than later edits.

### ULL / Annex-I experience

Ordinary certified ULL aeroplane PIC experience defaults to SEP credit for the FCL.140.A and FCL.740.A experience routes. Native ULL starts/landings are used rather than manufacturing movement counts from hours.

ULL remains separate from FCL.060 passenger currency and does not automatically satisfy the mandatory FI/CRI refresher element. Optional internal class metadata is retained only for atypical mappings such as a genuine TMG; it is not exposed in the normal Aircraft UI.

### Audit alignment

Evidence detail must use the same eligibility helpers as the calculation. A record that does not contribute to a requirement must not be labelled as a confirmed contributor merely because it is a valid flight record.

## Data access and performance

List/dashboard routes use compact SQL projections and aggregation where practical. Large GPS geometry is excluded from routine list payloads and loaded for detail/review workflows only.

Performance principles:

- avoid user-data caching across tenants;
- avoid N+1 queries on high-frequency pages;
- aggregate in PostgreSQL when transferring raw rows would be wasteful;
- load detailed GPS data only when a route actually needs it;
- keep runtime schema initialization process-local and idempotent.

## Airport reference data

`data/airports.csv` is the single repository airport catalogue used by the Next.js runtime. `lib/airport-catalog.ts` loads it server-side, normalizes aliases and keeps a process-local read-only index.

The previously generated `airports_full.sqlite` copy and Python seed workflow were removed in v1.52.0 because the production runtime did not consume them.

## Backups and exports

Portable account backup is an application feature; it is not implemented by committing a production database copy to Git. Provider-managed PostgreSQL recovery remains separate from user portable export/restore.

Repository cleanup therefore deliberately excludes frozen transactional SQLite databases and personal source spreadsheets from the active tree.

## Build and verification gates

Local/current verification:

```bash
npm ci
npm run typecheck
npm test
npm run test:postgres
npm run build
```

The production GitHub workflow runs TypeScript validation, isolated PostgreSQL acceptance and a production build. Vercel performs another production build from the released commit.

Release-numbered regression tests are intentionally retained after their release is closed. They define behavior that later cleanup/refactoring must continue to preserve.

## Deferred technical debt

The application still has version-layered CSS imports and several deliberately large domain/UI modules. v1.52.0 does not mass-consolidate these because a broad visual or business-logic rewrite would add regression risk without improving correctness. Future refactors should be isolated, measurable and covered by behavior/visual checks rather than mixed into a repository hygiene release.
