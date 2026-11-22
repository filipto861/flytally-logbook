# FlyTally Logbook — roadmap

Short and current. Update it when the state changes. Old detail is in git history (everything before the 2026-11-21 cleanup).

## Current state (2026-11-22)

- **Version:** 3.8.1 (`package.json`), schema **v21** (`lib/migration-plan.ts`).
- **Production:** `main@d4ed0e0` deployed on 2026-11-22 (owner-approved; Vercel `dpl_2pzwzm9GMki47oqywrMSCWbdy89G`, READY, `fly-tally.com`).
  - Contents compared to the previous deploy (`main@f8116a7`, `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub`, kept as the rollback target): Next.js 16.3.2 → 16.4.6 (security fixes, including critical RCE advisories) and the light-mode error-text contrast fix.
  - No schema, migration, environment or Vercel setting changes.
  - Checks: public pages respond, no runtime errors after deploy, and the owner confirmed signed-in use.
  - Production database, schema and flags were not read back (no DB changes were made).
- **Repository cleanup (2026-11-21):**
  - All 36 abandoned draft PRs were closed (DATA-1 and M0-B stacks).
  - Process and handoff documentation was removed.
  - Tooling was reduced to standard runners, and CI now runs automatically on PRs.
  - Tests that only checked documents or tooling were removed.
  - Results: unit 1520/1520, PostgreSQL integration 164/164 (42 files, previously 32 skipped and 8 failing on `main`), typecheck and build pass. Browser: 121/123 pass, 2 conditional skips. The 5 stale specs were fixed on 2026-11-21; one of them (F3.5 crafted aircraft drift) had silently stopped testing the server check.
- **Since the cleanup:**
  - Scale tests assert blocks touched instead of wall-clock time and gate PRs again.
  - `npm audit` is clean.
  - Error text in light mode meets WCAG AA.

## Owner decisions in force

- **Full-account restore stays disabled** until a new, reviewed design preserves certified, void, audit, ID and shared-evidence invariants. Backup creation, download and validation, and Trash recovery stay enabled.
- **Currency:** no FX conversion and no inferred currency (never assume CZK). Sums only within the same denomination, using exact minor units (v21).
- **Maps:** Standard is the default and Satellite is explicit opt-in. Maps are reference only, not a chart or EFB.
- **Online-only:** no offline editing, mutation queue or offline certified cache.
- **No regulatory, authority or commercial claims** beyond [docs/REGULATORY.md](docs/REGULATORY.md).

## Backlog (owner sets priority)

| # | Item | Notes |
|---|---|---|
| 2 | **CSS consolidation** | 47 global stylesheets, `:where()` token rules overridden by old selectors, 168 `!important`, 33 breakpoints. Use a staged plan with before/after computed-style snapshots. |
| 3 | **Behavioural tests instead of regex** | Phase 1 is done (2026-11-22): 366 presentation-only tests (UI text, CSS, layout, versions) were removed and 894 were kept. 194 of the 242 unit test files still read source text, but every remaining check guards an invariant. Phase 2 converts them per domain (SQL scoping → PostgreSQL integration; pure rules → direct function calls). Done: the flight-list cost aggregation, in `tests/integration/postgres-flight-cost-summary.test.ts` (whole selection rather than one page, per-pilot scope, per-flight rounding, unknown and invalid costs never counted as zero; proven by a mutation check). Also done: the Statistics per-aircraft cost scope, in `tests/integration/postgres-statistics-cost-scope.test.ts` (period, category, auxiliary roles, other pilots). Next: cook template-literal escapes in every integration test that runs production SQL (dashboard and Statistics regexes currently reach PostgreSQL with doubled backslashes), then certification. |
| 5 | **Safe full-account restore (M0-B)** | Needs a new design and an owner decision first. The previous attempt was abandoned. |
| 6 | **Story export completeness** | The Story exporter can omit failed map tiles instead of failing the export. |
| 7 | **Map provider rights** | Esri/openAIP rights, quotas, attribution and export restrictions are unverified. |
| 8 | **Multi-aircraft proof** | Heterogeneous Add/Edit across all categories, then sharing, recovery and scale closeout. |
| 9 | **Schema init consolidation** | `lib/db-optimization.ts` plus many `lib/v*-schema.ts` runtime gates. |
| 10 | **Privacy/operations note** | GDPR processing record, retention periods and the incident procedure were dropped from docs during the cleanup. Rewrite them from code if needed. |
| 11 | **Regulatory doc check** | The Easy Access Rules edition date conflicts in the old sources (Nov 2025 vs Feb 2026). See [REGULATORY §5](docs/REGULATORY.md#5-regulatory-source-snapshot). |
| 12 | **Vercel secret hygiene** | Production `DATABASE_URL` is stored as type "encrypted", and Vercel flags it as `readable-secret`: anyone with project access can read it in the dashboard. Re-create it as type "sensitive" (owner action in Vercel; no code change). |
| — | Research | GPS touch-and-go time-normalised evidence; professional logbook platform. |
