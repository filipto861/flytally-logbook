# FlyTally Logbook — architecture

## Stack and layout

Next.js 16 (App Router) and React 19 in TypeScript, deployed on Vercel (region `fra1`) and backed by Neon PostgreSQL.

| Path | Contents |
|---|---|
| `app/` | Pages, server actions and API routes. `app/(protected)/` holds the authenticated workspace: flights, dashboard, statistics, map, credentials, connections, actions, notifications, data, database, export, print, fstd, audit, admin and profile. `app/api/` holds authenticated routes (backups, export, map/airspace tile proxies, push, cron). |
| `components/` | Reusable UI components |
| `lib/` | Domain rules, data services (`lib/data/`), regulatory engines, certification, GPS, collaboration, backup/recovery, schema |
| `data/` | Static reference data (airport catalogue `data/airports.csv`, aircraft types) |
| `sql/migrations/` | Applied production migration scripts |
| `tests/` | Unit tests (`tests/*.test.ts`) and PostgreSQL integration tests (`tests/integration/`) |
| `e2e/` | Playwright browser specs |
| `tooling/` | Test runners and fixtures only. Never part of the runtime. |

Product domains: **flight records** (Add/Edit, list, detail), **credentials & compliance** (licences, ratings, medical, recency), **collaboration** (connections, shared flights, instructor verification, actions, notifications, push), **analytics** (dashboard, statistics, map), **data & recovery** (backup, Trash, export, print), **FSTD**, **platform** (auth, profile, admin, schema).

## Database, tenancy, schema

- Neon is the transactional source of truth. `lib/db.ts` creates the client lazily, so builds don't need a database.
- **Every query is scoped by the authenticated `user_id`.** Cross-user workflows use explicit records (`flight_participations`, `flight_verifications`, connections). Ownership filters are never weakened for convenience.
- Schema registry: table `flytally_schema_migrations`, versions and names in `lib/migration-plan.ts` (current **v21**). `lib/db-optimization.ts` contains all migration statements and applies pending ones at startup, **except v21**, which must already exist in production (schema-first, see `sql/migrations/`).
- `lib/runtime-schema.ts` also runs idempotent feature schema gates (`lib/v*-schema.ts`, `lib/push-schema.ts`). Gates must be idempotent, safe to retry and compatible with historical rows.

## Certified and protected evidence

- Ordinary flights are editable until **certification**. Certification stores a versioned payload fingerprint (`lib/certification-integrity.ts`, `lib/flight-certification.ts`) and locks the record. Database triggers prevent silent changes.
- Corrections of certified records create revisions. They never overwrite history.
- **Voiding** a certified flight is a separate, reasoned, atomic operation. It archives the protected evidence (v20 void archive and provenance) and removes the flight from active and recency views. Void evidence must never be resurrected by restore.
- Instructor/peer signatures (`flight_verifications`) are HMAC-bound to an exact revision hash. A signature must never appear valid for a later revision.
- Audit history (`flight_audit_log`) records material changes independently of the UI.

## Regulatory model

One logbook covers `AEROPLANE`, `HELICOPTER`, `SAILPLANE`, `BALLOON`, `ULL` and conservative `OTHER`. **Shared workflow, specialised engines:** there is one canonical flight entry, but Part-FCL, SFCL, BFCL and helicopter rules each keep their own deterministic, separately tested engine. Presentation may normalise statuses (CURRENT / ACTION SOON / NOT CURRENT / INCOMPLETE EVIDENCE) only when the underlying evidence supports it. Missing evidence is never manufactured from hours or GPS geometry. Canonical recency uses **certified flights only**.

The rule-to-code map and the claims boundary are in [docs/REGULATORY.md](docs/REGULATORY.md).

## Flight entry

One semantic normalisation boundary serves both sources:

- Manual: `FlightForm` → `parseFlightInput(FormData)` → `manualFlightCandidate()` → `normalizeFlightDraft()` → `FlightInput`
- GPS: reviewed source state → `gpsFlightCandidate()` → the same `normalizeFlightDraft()` → `FlightInput`

`normalizeFlightDraft()` is pure (no DB, auth or FormData). GPS adds only track provenance, date-effective prices, duplicate locks and atomic flight+track persistence. GPS suggestions for an already saved flight require explicit review before they overwrite saved values. GPS import is PIC-only until other roles reach parity with manual Role/Crew semantics. GPS T&G, takeoff and day/night values are evidence-limited suggestions.

## Collaboration

Connections, shared flights, instructor verification, the action center and notifications are workflow layers over each pilot's own records. They add evidence and review state but never transfer ownership implicitly or rewrite protected records. Public flight shares are revocable and use restricted public DTOs.

## Backup and recovery

- **Backup** create, download, validate and preview work. Current-format backups are server-signed (`lib/backup-authenticity.ts`). The cron job is `/api/cron/backups`.
- **Full-account restore is disabled** (`lib/account-restore-containment.ts`). The old restore engine does not preserve the audit/ID/shared-evidence invariants, so it is blocked server-side before any write. Re-enabling it requires a new, reviewed design. Old restore code remains in the tree but is unreachable.
- **Trash** (deleted-flight recovery) works and is single-flight and atomic. Certified flights cannot enter ordinary Trash; they are voided instead.

## Data access and performance

- No cross-tenant caching. Avoid N+1 queries on hot pages. Aggregate in SQL.
- List payloads exclude GPS geometry. Detail/review views load it on demand.
- The dashboard uses lean bounded read models (`lib/data/dashboard-*.ts`). Historical analysis belongs to Statistics.
- Scale tests (10k/50k flights, 100k read benchmark) live in `tests/integration/postgres-*scale*` / `*performance*`. They guard hot paths by block budgets; re-baseline with `SCALE_BUDGET_REPORT=1` only after an intended query change.

## Maps

Leaflet with Standard (OSM) and optional Satellite and openAIP aviation overlays through authenticated server-side tile proxies (`app/api/map-tile`, `app/api/airspace-tile`). Maps are **reference only**, not an approved chart or EFB. Provider rights, quotas and coverage are unverified.

## Deployment and verification

- Vercel git auto-deploy is disabled. Deploys are manual and owner-approved. Cron jobs: backups 02:15 UTC and recency 05:15 UTC.
- CI (`.github/workflows/ci.yml`) blocks every PR on typecheck, unit tests, build and the full PostgreSQL suite, including scale tests. Scale tests assert the number of data blocks each production query touches on a fixed fixture (`tests/integration/scale-budget.ts`), with only a generous wall-clock ceiling, so shared-runner speed does not matter. Browser tests run on manual dispatch.
- Test runners (`tooling/run-postgres-tests.mjs`, `tooling/run-auth-browser.mjs`) only accept localhost databases. Each integration file gets a fresh database.

## Rules for new work

- Extend the canonical workflow. Don't add parallel Quick/Simple/Advanced implementations.
- Keep regulatory engines deterministic, evidence-driven and independently testable.
- Make database work tenant-safe and idempotent before you optimise it.
- Refactor large modules incrementally behind behavioural tests. Don't mix broad refactors with feature delivery.
- Prefer behavioural tests over source-text regex tests.
