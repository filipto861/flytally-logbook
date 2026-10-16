# Airport elevation — Phase 1 GPS Detection 2.0 foundation (2026-10-16)

**Scope:** `flytally-logbook` only. Owner approved Phase 1 on 2026-10-16. **Implementation staged on `feat/airport-elevation-phase1`; not verified/released.**

## Why

The intended downstream product value is **more accurate GPS takeoff / landing / rolling touch-and-go classification**. The existing `lib/track-processing.ts` uses speed, local relative altitude and continuity; it does not have airport reference MSL elevation. Airport elevation may improve later evidence fusion, but **must not be treated as proof of runway contact**. GPS Detection 2.0 needs a separate design and validation milestone. This work does NOT modify GPS detection or flight records and is not a Training performance feature.

## Data provenance and meaning

- Static OurAirports-derived `data/airports.csv` already has `elevation_ft`. `lib/airport-catalog.ts` exposes `CatalogAirport.elevationFt: number | null` with strict non-guessing parsing.
- A blank, missing or malformed CSV elevation becomes `null` (unknown). Zero and negative values are valid. The new pure `lib/airport-elevation.ts` helper validates and formats `ft MSL`.
- User-owned `airports.elevation_ft` remains nullable. Browser forms permit manual entry and explicit clearing (blank field). Existing elevation is preserved when a legacy update form omits the field entirely; an explicitly blank field clears it.
- The row-level elevation editor updates **only** `elevation_ft`, scoped by `user_id`, and excludes `ourairports%` reference source rows. It cannot silently blank the name or coordinates.
- Origin is existing dataset vs manually entered record; this is **reference-only**. Airport elevation does not establish runway-end / threshold elevation. GNSS altitude may be ellipsoidal or another datum; vertical uncertainty, proximity and trajectory need later resolution. No automatic AGL calculation or confidence upgrade in Phase 1.

## Schema evidence and release prerequisite

A read-only Neon `describe_table_schema` check of project **Logbook Shadow** (`muddy-dust-14049657`) on 2026-10-16 found `public.airports.elevation_ft` of type **double precision nullable**. **No database writes or schema changes were made.**

**Production schema was NOT inspected / verified** because the available Neon connection does not identify the Logbook production project. Before any merge/deploy:

1. Determine exact target from authorized production configuration, **not** from an assumed project name.
2. Read-only check: `SELECT data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='airports' AND column_name='elevation_ft';`.
3. If absent, review and explicitly approve the **optional** additive `tooling/airport-elevation-phase1-additive.sql` before running it on that exact target. If already nullable double precision, SQL migration is **N/A**. If incompatible, stop and reconcile.
4. Confirm read-only post-migration schema, then application reads/writes against an isolated test target. **Never use remote Neon for destructive acceptance tests.**
5. No production backfill is part of this phase.

The app's airport page now reads this column; deploying it before column availability may fail, so this preflight is a hard release blocker.

## Changed surfaces

- `lib/airport-elevation.ts`: pure nullable value parser, validation and `ft MSL` presentation
- `lib/airport-catalog.ts`: CSV column and catalogue type
- `lib/data/database.ts` → `lib/data/database-v164.ts`: user-owned elevation read path
- `app/(protected)/database/actions.ts`: full airport save and elevation-only edit, success/error redirect, idempotent field-missing behavior
- `app/(protected)/database/page.tsx`, `app/v300-u31-aircraft-airports.css`: add / view / edit
- Isolated browser fixtures: `tooling/bootstrap-browser-smoke-db.mjs` and `e2e/browser-db.mjs`
- `tests/airport-elevation.test.ts`: parser/validator/format assertions plus source/persistence/fixture contracts
- Optional migration artifact only: `tooling/airport-elevation-phase1-additive.sql`

## Verified owner-local gates and new browser acceptance batch

- On `e88bc4f9923b091bfde125bfcdb323877506c45c`, clean tree (16 Oct 2026): `verify:iterate -- --base origin/main` **PASS**, source 257/257, direct domain 19/19, typecheck PASS. `verify:postgres -- --base origin/main`, explicit six-owned-local-PG16 mode: **163/163 PASS**, exit 0; six isolated clusters, PostgreSQL 16.15. `npm test` full aggregate **1,629/1,629 PASS**, exit 0. Initial targeted 13/13 and build PASS were also recorded on an earlier SHA.
- **After** these PASS observations the branch was amended for browser acceptance. Therefore the new HEAD requires its own tests and release candidate identity. No later PASS result may be backdated from `e88bc4f9`.
- `tooling/bootstrap-browser-smoke-db.mjs`: browser-only disposable `airports` fixture now matches custom airport action needs (`municipality`, `iso_country`, `updated_at`, `UNIQUE(user_id,ident)`, nullable elevation). The second pre-existing fixture pilot has test-only credentials for cross-account authorization checks.
- `e2e/airport-elevation.spec.mjs`: two authenticated logical scenarios, each on desktop and mobile: add with NULL; forged malformed elevation rejected before mutation; edit to zero, negative, clear back to NULL; persistence and unchanged metadata; reference catalogue lookup and overflow; server-action cross-user forged edit is rejected without changing owner data.
- Strict `tooling/browser-suite-baseline.json` and `tooling/development-modules.json` now register these **four browser execution targets** as aircraft-airports release evidence, preserving existing targets. Corresponding source-contract tests keep fixture, ownership and baseline expectations explicit.
- **Destructive fixture isolation:** `tooling/run-airport-elevation-browser-local.ps1` provisions and identity-checks a new owned local PG16 cluster and sends an exact scoped candidate to `verify:browser:risk` with schema-first local v21 intent for the existing currency regressions. Bootstrap executes `DROP SCHEMA public CASCADE` **only** on this newly verified disposable database. Never invoke browser tests against production, Neon or a pre-existing local database.
- **As of authoring:** new browser specs and amended fixture **NOT RUN**; updated branch full suite, typecheck, build, PG acceptance and risk browser acceptance **NOT RUN**. The pre-browser 1,629/1,629 result belongs only to `e88bc4f9`. Production Logbook schema still **NOT VERIFIED**; PR remains DRAFT, no schema migrations/deploy/merge.

## Verification required before READY

**Current verification (owner-local Windows PowerShell, 16 Oct 2026, original PR head `79b9a66a`):** Node v24.19.0; `npm ci` complete; targeted elevation/airport-code/U3.1 tests **13/13 PASS**; `npm run typecheck` **PASS**; `npm run build` **PASS**. Initial `verify:iterate -- --base origin/main` reported **source FAIL** (256/257; source inventory expected 397 vs actual 398), **domain PASS** (13/13) and **typecheck PASS**. Corrective branch update increments the reviewed `tooling/development-modules.json` audited runtime count to **398**, preserving full ownership coverage, and registers `tests/airport-elevation.test.ts` as direct domain-unit evidence. **The new branch head has NOT YET BEEN TESTED**; rerun the exact candidate `verify:iterate` after `git pull`. `psql` and `pg_isready` are not on the user's PATH, and `DATABASE_URL` is not configured: PostgreSQL/browser acceptance **NOT RUN**. Do not use remote Neon or an assumed production database for test acceptance.

On owner-local checkout of exact branch HEAD:

```bash
npm ci
npm run test:target -- tests/airport-elevation.test.ts tests/airport-code.test.ts tests/v300-u31-aircraft-airports.test.ts
npm run typecheck
npm run build
npm run scope:changed -- lib/airport-elevation.ts lib/airport-catalog.ts lib/data/database.ts app/\(protected\)/database/actions.ts app/\(protected\)/database/page.tsx
```

Then run the candidate-aware `npm run verify:release:risk -- <candidate>` on the **exact pinned branch commit**, satisfying its targeted Postgres/browser gates on owned isolated localhost fixtures. Specifically exercise manual airport add with unknown, zero, negative elevation; edit existing elevation; clear to NULL; invalid form feedback; cross-user edit rejection; custom metadata unchanged; reference display and dark/mobile widths; previous catalogue search and routes unaffected. Verify historical flights/GPS evidence unchanged. Release gate and tests remain **NOT RUN** until owner-local evidence is attached. No merge/deploy requested.
