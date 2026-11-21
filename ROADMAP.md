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
  - Results: unit 1516/1516, PostgreSQL integration 164/164 (42 files, previously 32 skipped and 8 failing on `main`), typecheck and build pass. Browser: 112/123 pass, with 9 old failures in 5 specs (backlog #0).

## Owner decisions in force

- **Full-account restore stays disabled** until a new, reviewed design preserves certified, void, audit, ID and shared-evidence invariants. Backup creation, download and validation, and Trash recovery stay enabled.
- **Currency:** no FX conversion and no inferred currency (never assume CZK). Sums only within the same denomination, using exact minor units (v21).
- **Maps:** Standard is the default and Satellite is explicit opt-in. Maps are reference only, not a chart or EFB.
- **Online-only:** no offline editing, mutation queue or offline certified cache.
- **No regulatory, authority or commercial claims** beyond [docs/REGULATORY.md](docs/REGULATORY.md).

## Backlog (owner sets priority)

| # | Item | Notes |
|---|---|---|
| 0 | **Fix 5 failing browser specs** | The first full run of all 123 Playwright tests (2026-11-21) gave 112 passed, 9 failed, 2 skipped. The failing specs are: `advisory-presentation` E1.4, `manual-authority-certification` F3.4 and F3.5, `responsive-presentation` F5.3 (desktop and mobile) and `map-layers` pane ordering (mobile only). Failures look like stale selectors after UI changes, e.g. two "Aircraft profile" buttons. Decide per spec whether the spec or the UI is wrong. |
| 1 | **Light-mode contrast bugs** | `.form-error` (~1.7:1) and `.field-message-error` (`#f59e0b !important` in `app/v158-flight-entry-polish.css`, ~2.15:1). Small, high value. See [DESIGN §11](docs/DESIGN.md#11-known-structural-debt-input-for-css-consolidation). |
| 2 | **CSS consolidation** | 47 global stylesheets, `:where()` token rules overridden by old selectors, 168 `!important`, 33 breakpoints. Use a staged plan with before/after computed-style snapshots. |
| 3 | **Test triage** | 231 of the 277 unit test files read source files and assert their text by regex. Rewrite the ones that guard real invariants (SQL tenant scoping, certification and money) as behavioural tests, and delete the rest. |
| 4 | **Dependency security audit** | `npm audit` and upgrades from a fresh branch (replaces the closed `filipto861/flytally-logbook#432`). |
| 5 | **Safe full-account restore (M0-B)** | Needs a new design and an owner decision first. The previous attempt was abandoned. |
| 6 | **Story export completeness** | The Story exporter can omit failed map tiles instead of failing the export. |
| 7 | **Map provider rights** | Esri/openAIP rights, quotas, attribution and export restrictions are unverified. |
| 8 | **Multi-aircraft proof** | Heterogeneous Add/Edit across all categories, then sharing, recovery and scale closeout. |
| 9 | **Schema init consolidation** | `lib/db-optimization.ts` plus many `lib/v*-schema.ts` runtime gates. |
| 10 | **Privacy/operations note** | GDPR processing record, retention periods and the incident procedure were dropped from docs during the cleanup. Rewrite them from code if needed. |
| 11 | **Regulatory doc check** | The Easy Access Rules edition date conflicts in the old sources (Nov 2025 vs Feb 2026). See [REGULATORY §5](docs/REGULATORY.md#5-regulatory-source-snapshot). |
| — | Research | GPS touch-and-go time-normalised evidence; professional logbook platform. |
