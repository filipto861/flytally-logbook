# FlyTally

Current production-oriented release: **FlyTally v1.52.0 — Codebase Review & Cleanup**.

FlyTally is a private multi-user electronic pilot logbook built with Next.js, React, Neon PostgreSQL and Vercel. The production source of truth lives in `app/`, `components/` and `lib/`; regression and PostgreSQL acceptance coverage lives in `tests/`.

## Runtime architecture

- Next.js 16 App Router and React 19
- Neon PostgreSQL as the transactional production database
- Vercel deployment in the European region
- server actions and authenticated API routes for mutations and private data
- idempotent runtime schema gates for compatibility migrations
- certified flight revisions, audit history and revision-bound verification evidence
- EASA / FCL.050 and ULL logbook workflows
- LAPL / SEP / TMG recency planning with explicit regulatory evidence boundaries
- pilot connections, shared flights and instructor verification
- GPS/KML/GPX/CSV import, track review and playback
- printable logbook, export and portable account backup

## Regulatory model

The logbook record and the recency planner are deliberately separate layers. Certified records are not silently rewritten to make a recency result green.

The v1.51 regulatory core established the current rules used by v1.52:

- FCL.060 passenger currency uses structured pilot-flying movement evidence; legacy EASA records are handled only through the bounded legacy-compatibility path.
- Eligible certified ULL aeroplane PIC experience is automatically treated as SEP experience for FCL.140.A and the FCL.740.A experience route; ULL does not automatically satisfy FCL.060 passenger currency or the mandatory FI/CRI refresher element.
- explicit structured zeroes remain authoritative.
- recency calculation and Evidence detail use the same eligibility rules.
- FlyTally may report a planning/readiness state but does not alter licence or rating validity automatically.

`REGULATORY_CORE_V151.md` documents the final v1.51.x regulatory baseline. These materials are engineering aids and do **not** claim that FlyTally is approved or certified by EASA or a national authority.

## Repository layout

- `app/` — routes, pages, server actions and API endpoints
- `components/` — shared client/server UI
- `lib/` — database, regulatory, certification, backup, GPS and domain services
- `tests/` — TypeScript regression tests and isolated PostgreSQL acceptance tests
- `data/airports.csv` — read-only airport reference catalogue used by the current runtime
- `docs/certification-readiness/` — controlled engineering/evidence documentation

Historical Streamlit/Python runtime files, frozen SQLite data and one-off migration tooling were removed from the active tree in v1.52.0. Their history remains available in Git rather than being shipped alongside the production application.

## Verification

```bash
npm ci
npm run typecheck
npm test
npm run test:postgres   # requires the PostgreSQL acceptance environment
npm run build
```

GitHub CI runs TypeScript validation, isolated PostgreSQL acceptance and a full production build for the production branch. Vercel performs an independent production build on deployment.

## Development principles

- preserve user ownership boundaries on every query and mutation;
- preserve certified revisions and signed evidence rather than mutating history;
- prefer `LIMITED DATA` to invented regulatory evidence;
- keep compatibility migrations idempotent and retryable;
- keep GPS payloads out of list/dashboard hot paths;
- retain regression tests when a release is closed — old release-numbered tests are part of the current safety net, not obsolete code.
