# FlyTally v1.52.0 — Codebase review record

Date: 31 August 2026

Scope: full repository review after the v1.51.x regulatory release family. The objective is repository and architecture hygiene **without intentionally changing validated flight, certification or recency behavior**.

## Review result

The active Next.js application is structurally sound enough to continue development. The largest cleanup issue was not a newly discovered production bug; it was that the repository still shipped the complete pre-Vercel Streamlit/Python runtime, migration utilities, frozen transactional SQLite data and obsolete deployment documents next to the current application.

v1.52 removes that ambiguity and makes the current runtime boundary explicit.

## Removed from the active tree

- legacy Streamlit entry point and `.streamlit` configuration;
- legacy `logbook_core/` and `logbook_ui/` Python packages;
- legacy Python dependency manifest;
- old Python/SQLite migration and shadow-verification scripts;
- old SQL bootstrap material no longer used by the runtime migration system;
- frozen `data/logbook.sqlite` transactional database;
- historical personal/source Excel import workbook;
- generated `data/airports_full.sqlite` and its seed workflow/script;
- unused legacy airport override CSV;
- v0.x performance, PostgreSQL migration/cutover and Streamlit deployment notes.

All of this remains recoverable through Git history. It is no longer part of a production checkout or Vercel source tree.

## Retained deliberately

- all current TypeScript release-numbered regression tests, including v1.51.x tests;
- `docs/certification-readiness/` controlled engineering/evidence documents;
- `FCL050_COMPLIANCE.md` and the final v1.51.x regulatory baseline;
- current runtime migration modules (`db-optimization`, `v132-schema`, `v1353-schema`, `v144-schema`, `v145-schema`, `v148-schema`, `v151-schema`);
- compatibility tables/data paths still exercised by current backup/certification/shared-flight tests;
- internal Part-FCL class override metadata for historical/atypical aircraft, although the everyday Aircraft UI no longer exposes it;
- `data/airports.csv`, which is the airport catalogue actually read by the Next.js runtime.

## Regulatory review

The v1.51.x implementation remains the baseline:

- modern structured movement counters remain strict;
- explicit zero remains explicit zero;
- legacy EASA movement reconstruction is limited by creation provenance relative to the v1.35.3 migration boundary;
- FCL.060 calculation and audit evidence share the same effective movement interpretation;
- eligible certified ordinary ULL aeroplane PIC experience automatically maps to SEP for the FCL.140.A and FCL.740.A experience routes;
- ULL does not automatically satisfy FCL.060 passenger currency or the FI/CRI refresher requirement;
- audit rows are filtered by the same contribution eligibility as the corresponding calculation.

No cleanup change is permitted to weaken those regression contracts.

## Database review

Production transactional storage remains Neon PostgreSQL. Runtime schema initialization continues through `ensureRuntimeSchema()` with the base migration gate first and compatible feature gates in parallel afterward.

The review specifically avoids a destructive schema cleanup. Old columns/tables that are still part of backup compatibility, certification evidence, current queries or migration safety remain in place. Repository cleanup is not used as an excuse for a risky production-data rewrite.

## Performance review

The current architecture already keeps large GPS payloads out of ordinary flight-list/dashboard paths and uses compact SQL projections for high-frequency views. No broad query rewrite is included in v1.52 because this release is intended to be behavior preserving.

The airport catalogue remains a process-local read-only index from `data/airports.csv`. The second generated SQLite copy was dead weight and has been removed.

## UI / CSS review

The obsolete Aircraft Part-FCL override controls were removed in v1.51.4; v1.52 also removes their dead CSS selectors.

The application still imports a sequence of release-layer CSS files. This is recognized technical debt, but mass-merging those layers is intentionally deferred: without broad visual-regression coverage it would create substantially more risk than value in a hygiene release.

## Documentation review

`README.md`, `ARCHITECTURE.md` and `ROADMAP.md` are rewritten around the current Next.js/Vercel application rather than the old Streamlit architecture. Historical release archaeology belongs in Git, not in the top-level operational documentation.

## Version/reproducibility review

`package.json` and `package-lock.json` must carry the same v1.52.0 root package version. CI/build validation is required after the lockfile is synchronized.

## Required release gates

Before v1.52.0 can be merged to production:

1. `npm ci` succeeds from the cleaned tree;
2. TypeScript typecheck passes;
3. the complete current TypeScript regression suite passes;
4. isolated PostgreSQL acceptance passes;
5. Next.js production build passes;
6. a clean Vercel preview reaches READY;
7. production CI passes after squash merge;
8. `fly-tally.com` serves the released deployment;
9. production runtime error/fatal logs show no new failure.

## Deferred items

These are valid future cleanup projects, but deliberately not mixed into v1.52.0:

- incremental consolidation of version-layered CSS with visual regression checks;
- splitting very large UI/server-action modules where a measurable maintainability or performance benefit exists;
- deeper query-plan work based on production latency evidence rather than speculative rewrites;
- destructive removal of database compatibility columns/tables only after backup/restore and certification migration policy explicitly allows it.
