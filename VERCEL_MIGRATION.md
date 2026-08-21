# Vercel migration

The repository contains the production Streamlit v0.73.3.2 application and a
new Next.js v0.80 migration target. Both use the same existing Neon PostgreSQL
schema; no destructive database migration is required for this foundation.

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
- Dashboard totals are produced by one aggregate SQL query.
- Flight history is sorted and paginated in PostgreSQL (50 rows per page).
- Large GPS payloads are excluded from dashboard and flight-list queries.
- Maps and track-player JavaScript will be dynamically loaded only on their
  dedicated routes.
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
