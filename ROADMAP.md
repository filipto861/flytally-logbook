# FlyTally Logbook — roadmap

Short and current. Update it when the state changes. Old detail is in git history (everything before the 2026-11-21 cleanup).

## Current state (2026-11-21)

- **Version:** 3.8.1 (`package.json`), schema **v21** (`lib/migration-plan.ts`).
- **Production:** last recorded owner-approved deploy is `main@f8116a7` on 2026-11-02 (M0-A, full-account restore disabled). It was not re-verified during the cleanup. The production database, schema and flags have not been read back since.
- **Repository cleanup (2026-11-21):**
  - All 36 abandoned draft PRs were closed (DATA-1 and M0-B stacks).
  - Process and handoff documentation was removed.
  - Tooling was reduced to standard runners, and CI now runs automatically on PRs.
  - Tests that only checked documents or tooling were removed.
  - Results: unit 1516/1516, PostgreSQL integration 164/164 (42 files, previously 32 skipped and 8 failing on `main`), typecheck and build pass. Browser: 121/123 pass, 2 conditional skips. The 5 stale specs were fixed on 2026-11-21; one of them (F3.5 crafted aircraft drift) had silently stopped testing the server check.

## Owner decisions in force

- **Full-account restore stays disabled** until a new, reviewed design preserves certified, void, audit, ID and shared-evidence invariants. Backup creation, download and validation, and Trash recovery stay enabled.
- **Currency:** no FX conversion and no inferred currency (never assume CZK). Sums only within the same denomination, using exact minor units (v21).
- **Maps:** Standard is the default and Satellite is explicit opt-in. Maps are reference only, not a chart or EFB.
- **Online-only:** no offline editing, mutation queue or offline certified cache.
- **No regulatory, authority or commercial claims** beyond [docs/REGULATORY.md](docs/REGULATORY.md).

## Backlog (owner sets priority)

| # | Item | Notes |
|---|---|---|
| 1 | **Light-mode contrast bugs** | `.form-error` (~1.7:1) and `.field-message-error` (`#f59e0b !important` in `app/v158-flight-entry-polish.css`, ~2.15:1). Small, high value. See [DESIGN §11](docs/DESIGN.md#11-known-structural-debt-input-for-css-consolidation). |
| 2 | **CSS consolidation** | 47 global stylesheets, `:where()` token rules overridden by old selectors, 168 `!important`, 33 breakpoints. Use a staged plan with before/after computed-style snapshots. |
| 3 | **Test triage** | 231 of the 277 unit test files read source files and assert their text by regex. Rewrite the ones that guard real invariants (SQL tenant scoping, certification and money) as behavioural tests, and delete the rest. |
| 4 | **Dependency security audit** | `npm audit` and upgrades from a fresh branch (replaces the closed `filipto861/flytally-logbook#432`). |
| 5 | **Safe full-account restore (M0-B)** | Needs a new design and an owner decision first. The previous attempt was abandoned. |
| 6 | **Story export completeness** | The Story exporter can omit failed map tiles instead of failing the export. |
| 7 | **Map provider rights** | Esri/openAIP rights, quotas, attribution and export restrictions are unverified. |
| 8 | **Multi-aircraft proof** | Heterogeneous Add/Edit across all categories, then sharing, recovery and scale closeout. |
| 9 | **Schema init consolidation** | `lib/db-optimization.ts` plus many `lib/v*-schema.ts` runtime gates. |
| 12 | **Hardware-independent scale assertions** | The scale tests assert wall-clock `EXPLAIN ANALYZE` time against fixed limits. On shared CI runners the same query varies a lot, e.g. `pilotInsights100k` ran in 4.7–7.7 s on CI against a 7 s limit and in 2.3 s locally. Since 2026-11-21 the scale suite runs on `main`, nightly and on demand instead of gating PRs. Next step: assert buffers read and plan shape (index use, no seq scan on large tables), keep a generous time ceiling, then let the suite gate PRs again. |
| 13 | **Profile `pilotInsights100k`** | It is the slowest scale query by far (seconds; the others are under 1 s). Check its plan for an aggregation or index improvement. |
| 10 | **Privacy/operations note** | GDPR processing record, retention periods and the incident procedure were dropped from docs during the cleanup. Rewrite them from code if needed. |
| 11 | **Regulatory doc check** | The Easy Access Rules edition date conflicts in the old sources (Nov 2025 vs Feb 2026). See [REGULATORY §5](docs/REGULATORY.md#5-regulatory-source-snapshot). |
| — | Research | GPS touch-and-go time-normalised evidence; professional logbook platform. |
