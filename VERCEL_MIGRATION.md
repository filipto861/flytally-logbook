# Vercel migration

The repository contains the production Streamlit v0.73.3.2 application and a
new Next.js v0.81 migration target. Both use the same existing Neon PostgreSQL
schema; no destructive database migration is required for this foundation.

## v0.81 parity expansion

- Streamlit-priority dashboard with period filters, ULL/EASA and PIC cards.
- Searchable logbook with BLOCK/AIR metrics and complete GPS coverage.
- Flight GPS map, altitude profile and track playback.
- KML, gx:Track, Flightradar24 and common ADS-B KML import.
- Aircraft, historical rates, custom airports, profile and expiries.
- Excel-compatible, CSV and portable JSON account exports.
- Collapsible responsive navigation and mobile layout.

## Vercel configuration

1. Keep the project root at the repository root.
2. Framework preset: Next.js (also forced by `vercel.json`).
3. Add `DATABASE_URL` using the pooled Neon connection string.
4. Add a unique `SESSION_SECRET` containing at least 32 random characters.
5. Deploy the migration branch as Preview first. Do not point the production
   domain at it until the parity checklist is complete.

The `fra1` function region is selected to reduce latency to a European Neon
database. If the Neon project is in another region, colocate the Vercel
functions with that database instead.

## Performance rules

- Private data is never cached across users.
- Dashboard sections use parallel aggregate SQL queries and never transfer raw tracks.
- Flight history is filtered, sorted and paginated in PostgreSQL (25–200 rows per page).
- Large GPS payloads are excluded from dashboard and flight-list queries.
- Full GPS data is loaded only on map and flight-detail routes; overview geometry
  is capped at 180 points per track.
- Mutations will invalidate only the affected route/data scope.

## Migration gates

- Authentication compatibility with current scrypt hashes
- dashboard totals parity
- flight list/detail/edit parity
- aircraft/rate/profile/expiry parity
- KML import, split detection, map and track-player parity
- export/backup parity
- authorization and ownership tests for every mutation
- cold/warm response measurements from the production region
