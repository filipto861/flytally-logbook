# FlyTally

Current production-oriented release: **FlyTally v1.33.2 — Certification Readiness**.

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

## v1.33 — Certification Readiness

v1.33 adds an owner-authenticated, printable **Authority Verification Report** for a certified flight. The report independently recalculates each preserved certification SHA-256, identifies the exact revision/hash bound to instructor evidence, validates stored verification HMAC-SHA-256 evidence at report time, preserves revoked evidence in history, and displays same-device handwritten signature evidence without overstating identity assurance.

The release family also establishes a controlled certification-readiness documentation set in `docs/certification-readiness/` and progressively replaces source-only confidence with reproducible PostgreSQL acceptance evidence.

### v1.33.1

The GitHub verification workflow starts an isolated PostgreSQL 16 service and exercises the production certified-record protection/correction model, revision-bound verification and source/participant record independence. Acceptance output is retained as a commit-specific CI artifact.

### v1.33.2

v1.33.2 adds database-backed cross-user ownership tests using SQL templates read directly from the production server-action sources. It also adds a regulatory/evidence-focused portable-backup round trip: current R2 and archived R1 certification fingerprints, structured purpose, instructor HMAC evidence, participation binding and GPS data are restored using the production restore SQL and then re-verified.

Backup certification-history validation now verifies stored HMAC-SHA-256 verification evidence as well as flight certification fingerprints. Recomputing the outer unkeyed portable-file checksum therefore cannot be used to forge signed instructor evidence.

The controlled documents include:

- data dictionary;
- FCL.050-oriented compliance matrix;
- certification/signature specification;
- acceptance-test matrix;
- security and restore evidence specification;
- change-control rules.

These materials are engineering and authority-discussion aids. They do **not** state that FlyTally is EASA certified or approved by ÚCL.

## v1.32 — Integrity & Performance baseline

v1.32 consolidated verified-flight workflow around `flight_participations` as the workflow record and `flight_verifications` as signed evidence; `instructor_flight_approvals` remains temporarily as a compatibility projection.

It also introduced structured LAPL FCL.140.A refresher-purpose tagging, SQL-side dashboard aggregation, date-scoped large print jobs, licence-type normalization, safer runtime migrations, ULL-aware Czech LAPL recency handling and a web verification workflow in GitHub Actions.

## Legacy Streamlit code

`app.py`, `logbook_core/`, `logbook_ui/` and older PostgreSQL/Streamlit migration documents are **historical legacy code and documentation**. They are retained only for reference/recovery and are **not the current FlyTally production runtime or source of truth**.

When auditing or developing the current product, use the Next.js/Vercel codebase and current migrations as the authoritative implementation.

## Verification

```bash
npm ci
npm run verify
```

`npm run build` also runs the TypeScript test suite before the Next.js production build. The GitHub CI workflow additionally runs the isolated PostgreSQL acceptance suite under `tests/integration/`.
