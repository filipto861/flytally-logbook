# FlyTally

Current production application: **FlyTally v1.32.1 — Integrity & Performance hotfix**.

FlyTally is a Next.js electronic pilot logbook backed by Neon PostgreSQL and deployed on Vercel. The active application lives in `app/`, `components/` and `lib/`.

## Current architecture

- Next.js 16 App Router
- React 19
- Neon PostgreSQL
- Vercel production deployment
- EASA / FCL.050 and ULL logbook workflows
- certification revisions and audit history
- pilot connections, crew participation and instructor verification
- GPS/KML/GPX/CSV track handling
- printable EASA-style logbook, exports and account backups

## v1.32 — Integrity & Performance

This release focuses on consolidating the verified-flight workflow and removing production repair logic from page rendering. Instructor requests now use `flight_participations` as the request/workflow record and `flight_verifications` as the signed evidence; `instructor_flight_approvals` remains temporarily as a compatibility projection for older records and views.

Other v1.32 work includes structured LAPL FCL.140.A refresher-purpose tagging, SQL-side dashboard aggregation, date-scoped large print jobs, licence-type normalization, and an enforced web verification workflow in GitHub Actions.

v1.32.1 hardens the initial release by keeping the one-time purpose backfill away from certified/locked flights and fixing PostgreSQL keyword collisions in dashboard time-series aliases.

## Legacy Streamlit code

`app.py`, `logbook_core/`, `logbook_ui/` and older PostgreSQL/Streamlit migration documents are **historical legacy code and documentation**. They are retained only for reference/recovery and are **not the current FlyTally production runtime or source of truth**.

When auditing or developing the current product, use the Next.js/Vercel codebase and current migrations as the authoritative implementation.

## Verification

```bash
npm ci
npm run verify
```

`npm run build` also runs the TypeScript test suite before the Next.js production build.
