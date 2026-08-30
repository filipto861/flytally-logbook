# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.41.0 · Map & GPS UX

Focus:
- keep ordinary flight-detail loads lightweight by fetching only GPS track summaries on the server; detailed player coordinates are requested only when the GPS tab is actually opened
- expose a dedicated authenticated, user-scoped, no-store GPS review endpoint for the detailed track/player payload
- compare saved BLOCK/AIR values with the current GPS-derived suggestion before the pilot chooses to apply it
- show detected landing count as advisory evidence only; it is never written by the Apply GPS time suggestions action
- make provenance explicit: GPS suggestions remain derived/reviewable data until the pilot deliberately applies them, and certified records remain immutable
- show source file name, stored point count, distance and start time for each attached track in the GPS manager
- retain the existing synchronized map/altitude/speed player and the v1.38.1–v1.38.2 GPS split/landing/take-off heuristics unchanged
- preserve certification payloads/hashes/revisions, Recency Engine, shared-flight workflow, dashboard behavior and global mobile navigation

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

## Near term

- v1.42: Print & Export finalisation — large-logbook guidance, range handling and complete/EASA/ULL consistency
- keep FSTD recency evidence deferred until it becomes a product priority
- retire `instructor_flight_approvals` only after historical backup/restore consumers are fully migrated
- migrate backup/restore away from `track_points` before considering removal of that compatibility table

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Compatibility cleanup must never rewrite certified evidence. GPS inference must remain conservative and reviewable; presentation preferences, dashboard analytics and advisory recency evidence must never alter certified evidence or regulatory records automatically.
