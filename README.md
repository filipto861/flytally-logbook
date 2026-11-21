# FlyTally Logbook

A private, multi-user electronic pilot logbook (EASA Part-FCL oriented), live at [fly-tally.com](https://fly-tally.com). It's built with Next.js 16, React 19, TypeScript, Neon PostgreSQL and Vercel.

## What it does

- **Flight records:** a canonical Add/Edit flight model for aeroplane, helicopter, sailplane, balloon, ULL and other categories. Flights go through review, certification and auditable correction or voiding, with search, filters and detail views.
- **Aircraft and airports:** personal aircraft profiles with defaults, a type catalogue, airport reference data, and copying aircraft profiles between connections.
- **GPS:** KML/GPX/CSV import, evidence-limited takeoff, touch-and-go and day/night suggestions, and track playback. Maps offer Standard, optional Satellite and an openAIP aviation overlay (reference only).
- **Licences and recency:** licences, ratings, medical and qualifications, plus category-aware recency planning (FCL.060, FCL.140, SFCL, BFCL, helicopter). Status is never shown as CURRENT when evidence is missing.
- **Collaboration:** pilot connections, shared flights, instructor verification and signatures, an action center, notifications and web push, revocable public flight views and story cards.
- **Data:** print and export, signed portable backups and validation, and deleted-flight (Trash) recovery. Full-account restore is currently disabled by design.
- **Platform:** responsive desktop, iPad and mobile layouts, light and dark themes, and an installable PWA. It is online-only.

## Getting started

```bash
cp .env.example .env.local   # fill DATABASE_URL, SESSION_SECRET, …
npm ci
npm run dev
```

Checks:

```bash
npm run verify              # typecheck + unit tests + build
npm run test:postgres       # integration tests (local PostgreSQL 16)
npm run test:browser        # Playwright (local PostgreSQL 16, after build)
```

For the test database setup, see [CLAUDE.md](CLAUDE.md#commands).

## Documentation

| Document | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Working rules for contributors and AI agents |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System map, data model and invariants |
| [ROADMAP.md](ROADMAP.md) | Current state, owner decisions and backlog |
| [docs/REGULATORY.md](docs/REGULATORY.md) | Regulatory rules ↔ code, and claims the product must never make |
| [docs/DESIGN.md](docs/DESIGN.md) | UI tokens, components, accessibility and CSS debt |
| [sql/migrations/](sql/migrations/README.md) | Applied production migrations |

## Regulatory boundary

FlyTally records and evaluates pilot-entered evidence. Neither the implementation nor passing tests constitute approval by EASA, ÚCL, LAA or any other authority. When required evidence is missing or ambiguous, the product fails closed. It preserves certified records rather than rewriting them.
