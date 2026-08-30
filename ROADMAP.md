# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.44.0 · Production hardening & cleanup

Focus:
- restore the PostgreSQL acceptance gate to the current certification v4 and participation-only instructor workflow instead of testing obsolete v1.33/v1.38 SQL shapes
- close the stale v1.17 draft PR that duplicated every production verification run and add CI concurrency/branch guards so the production branch cannot create a second PR verification for the same SHA
- add targeted hot-path indexes for shared-flight lookups, exact verification evidence, notification links, licence lookups and the retained legacy `track_points` backup path
- make backup ownership validation cover `connection_audit_log` as well as connections, participations, approvals, verifications, licences, qualifications and notifications
- keep `track_points` deliberately present because portable backup/restore still round-trips it; removal requires a future backup-format migration rather than an ad-hoc table cleanup
- keep `instructor_flight_approvals` compatibility-only for historical backups/links while all new instructor requests remain canonical `flight_participations` records
- re-run the controlled 10k-flight Dashboard, Flights and Print acceptance benchmarks against the current query shapes
- preserve certification payloads/hashes/revisions, Recency Engine, GPS inference/review, FCL.050 print layout and global mobile navigation

## v1.43.0 · Print & Export finalisation

- use one scope vocabulary across printable logbook and flight export: Complete logbook, ULL only, EASA only and ULL + EASA
- validate calendar dates and reject invalid or reversed From/To ranges instead of silently producing empty output or a PostgreSQL date-cast error
- keep Excel FSTD content aligned with the selected print scope and date range; ULL-only exports exclude FSTD while Complete, EASA and ULL + EASA include the matching FSTD period
- keep CSV deliberately flight-row only and make the Excel/CSV difference explicit in the UI
- narrow the export flight query to the fields actually written instead of loading the complete flight record payload
- show selected record/page counts before printing, warn for large browser print jobs and show a clear empty-selection state
- keep the same FCL.050 columns 1–12, 10-row A4 landscape renderer and running-total logic for Complete, ULL, EASA and ULL + EASA
- preserve certification payloads/hashes/revisions, Recency Engine, GPS inference/review, shared-flight workflow and portable backup/restore

## v1.42.1 · GPS import review player polish

- keep one authoritative synchronized GPS map/player in the import workflow instead of repeating a static map in every flight review card
- retain altitude/speed profiles and interactive take-off, landing, touch-and-go and split markers
- retain the v1.38.1–v1.38.2 split/landing/take-off heuristics unchanged

## v1.41.0 · Map & GPS UX

- keep ordinary flight-detail loads lightweight by fetching only GPS track summaries on the server; detailed player coordinates are requested only when the GPS tab is actually opened
- expose a dedicated authenticated, user-scoped, no-store GPS review endpoint for the detailed track/player payload
- compare saved BLOCK/AIR values with the current GPS-derived suggestion before the pilot chooses to apply it
- show detected landing count as advisory evidence only; it is never written by the Apply GPS time suggestions action
- make provenance explicit: GPS suggestions remain derived/reviewable data until the pilot deliberately applies them, and certified records remain immutable
- show source file name, stored point count, distance and start time for each attached track in the GPS manager
- retain the existing synchronized map/altitude/speed player and the v1.38.1–v1.38.2 GPS split/landing/take-off heuristics unchanged

## v1.40.0 · Flights UX & logbook polish

- make the Flights list an operational workspace rather than a raw table: quick views expose Drafts, Certified records, waiting shared-flight requests and records shared with the current pilot
- add exact record-state filters for Draft, Certified, Correction and Locked records without changing certification state or evidence
- add user-scoped shared-flight filters for Waiting, Shared/accepted, Shared with me and Not shared
- surface shared-flight state directly beside each flight's role and certification badge
- preserve existing search, ULL/EASA, role, aircraft, airport, route, GPS, date and sort filters and keep them combinable
- keep Previous/Next navigation consistent when a record or shared-workflow filter is active
- keep the fast Flights path N+1-free and exclude GPS coordinate JSON from the list query
- present flight rows as compact mobile cards below 760 px while leaving the global mobile shell/navigation untouched

## v1.39.0 · Core cleanup & performance

- make `flight_participations` the canonical model for all new instructor requests; `instructor_flight_approvals` is no longer populated by the modern request path
- retain `instructor_flight_approvals` as compatibility evidence for historical backups and old links
- make legacy approval synchronization exact by approval id, source owner, instructor, certified revision and flight hash
- consolidate protected-runtime schema initialization behind the retryable `ensureRuntimeSchema()` gate
- explicitly retain legacy `track_points`: portable backup/restore still round-trips it
- preserve backup/restore support for existing instructor approval rows while stopping creation of new duplicates
- keep certification payloads/hashes/revisions, Recency Engine, GPS inference, dashboard behavior and global mobile navigation unchanged

## v1.38.2 · GPS take-off time hardening

- `flightEnvelope()` ignores isolated taxi/runway speed spikes and requires sustained movement plus real climb when altitude evidence is usable
- automatic take-off is anchored to the first point clearly above the local ground baseline
- speed-only fallback remains available for tracks without useful altitude data

## v1.38.1 · GPS split & landing detection hardening

- automatic GPS splitting is stricter than generic track validation: both proposed flight sections must contain credible airborne movement and at least 1 km of actual tracked movement
- short taxi/GPS bursts followed by ground waits are not promoted to separate flights
- altitude-based touch-and-go candidates reject physically implausible GPS altitude discontinuities

## v1.38.0 · Dashboard, Airports & Routes overhaul

- scheduled backup and recency endpoints fail closed when `CRON_SECRET` is missing
- certified ULL and EASA records share one read-only field structure
- Aircraft and Costs are one coherent dashboard area
- Airports and Routes are separate period-aware statistics with direct drill-down to Flights

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed product foundation

- v1.34.0–v1.34.2: modular dashboard, per-user layout, System/Dark/Light appearance and responsive UI consistency
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0–v1.36.2: mobile/iOS presentation work, single-tap navigation hotfix and isolated status-area handling
- v1.37.0: unified shared-flight notification/review workflow, explicit Review → Add → Certify states and protected ULL logbook-entry presentation
- v1.38.0: dashboard consolidation, distinct airport/route analytics, ULL/EASA field-parity regression guard and fail-closed cron authentication
- v1.38.1–v1.38.2: conservative GPS split/landing/take-off inference based on real SkyDemon failure cases
- v1.39.0: canonical participation workflow, exact legacy compatibility updates and cached runtime schema initialization
- v1.40.0: record/workflow-aware Flights filtering, shared-flight status in the list, narrowed list payload and mobile flight cards
- v1.41.0: lazy GPS detail payload, saved-vs-derived review and explicit track provenance
- v1.42.0–v1.42.1: visual GPS import player with take-off, landing, touch-and-go and split markers, followed by removal of the redundant per-flight map
- v1.43: Print & Export finalisation — shared scope/range semantics, filtered FSTD exports and large-logbook guidance
- v1.44.0: CI/acceptance hardening, backup ownership validation and targeted production indexes

## Near term

- v1.45: Licences & Pilot Profile finalisation — structured licence/qualification UX, FI/FE presentation, unlimited/date/recency validity and consistent identity/signature use
- observe large career-logbook browser print performance before changing the fixed FCL.050 page renderer
- keep FSTD recency evidence deferred until it becomes a product priority
- retire `instructor_flight_approvals` only after historical backup/restore consumers and old links are fully migrated
- migrate backup/restore away from `track_points` before considering removal of that compatibility table

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Compatibility cleanup must never rewrite certified evidence. GPS inference must remain conservative and reviewable; presentation preferences, dashboard analytics and advisory recency evidence must never alter certified evidence or regulatory records automatically.
