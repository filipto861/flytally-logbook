# FlyTally v1.59.0 — Flight Entry Structure & Expenses

## Objective

Align New flight with the way a pilot thinks about a flight instead of grouping fields by implementation history. Add structured personal expenses without mixing financial metadata into the certified logbook record.

## Entry hierarchy

- **Flight essentials** — date, aircraft, route, timeline, BLOCK/AIR and role.
- **Flight experience** — day/night landings, night/IFR time and, for EASA records, PF movement evidence with advanced take-off/approach adjustment.
- **Crew & training** — PIC/instructor, purpose/exercise and SPIC/PICUS supervision/countersignature evidence.
- **Aircraft & logbook** — logbook, aircraft type/class, SP/MP and SE/ME. A complete aircraft profile keeps this section out of the normal path.
- **Costs** — billing basis/share, calculated aircraft cost and user-owned additional expenses.
- **Notes** — separate optional flight remarks.

## Structured personal expenses

Additional rows support Landing fee, Handling, Parking, Fuel and Other/custom descriptions. Amounts are stored as integer minor units plus an ISO-style three-letter currency code. FlyTally groups totals by currency and does not invent an FX conversion.

`flight_expenses` is keyed by both `flight_id` and `user_id`. The database foreign key enforces that an expense belongs to the same user as its flight. Shared-flight materialization therefore never copies another pilot's expenses.

Financial metadata is deliberately outside the flight certification fingerprint and record revision. A pilot can update personal expenses on a locked/certified flight without rewriting regulatory evidence. Core flight editing remains protected exactly as before.

## Recovery

Portable backup format v8 includes `flight_expenses`, validates account ownership and validates that every expense belongs to a backed-up flight. Older v4-v7 backups remain accepted with an empty expense section. Trash/restore also carries personal expense rows with the deleted flight.

## Deliberately unchanged

- `parseFlightInput()` field meanings and stored flight semantics;
- FCL.050/FCL.060, LAPL, FCL.740.A and eligible ULL-credit calculations;
- EASA PF/movement and countersignature rules (only their UI location changed);
- certification fingerprints, certified revisions and signatures;
- aircraft-state authority and v1.53.1 stale-state protection;
- GPS evidence/import, participant flight materialization, print/export semantics.

## Release gates

TypeScript, complete regression suite, PostgreSQL acceptance (including expense ownership/cascade constraints), production build, clean Vercel preview, squash merge, production CI and runtime audit.
