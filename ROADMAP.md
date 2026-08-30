# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.39.0 · Core cleanup & performance

Focus:
- make `flight_participations` the canonical model for all **new** instructor requests; the legacy `instructor_flight_approvals` table is no longer populated by the modern request path
- retain `instructor_flight_approvals` as compatibility evidence for historical backups and old links, but redirect any legacy approval that already has a participation mapping into the canonical `/connections/shared/...` workflow
- remove fuzzy legacy approval status updates from the shared-flight workflow: compatibility projection updates now require the exact approval id, source owner, instructor, certified revision and flight hash
- detach an old `approval_id` whenever an instructor request is re-opened through the modern participation path so stale legacy projections cannot drive a new decision
- consolidate protected-runtime schema initialization behind one cached `ensureRuntimeSchema()` gate; base database migrations complete first and independent v1.32/v1.35.3 compatibility schemas then initialize in parallel
- use the same runtime-schema gate in shared-flight actions and instructor-request code, reducing repeated sequential schema initialization on cold server instances
- explicitly retain legacy `track_points`: current portable backup/restore still round-trips it, so removing the table would risk historical restore fidelity
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

- Claude audit hardening: scheduled backup and recency endpoints fail closed when `CRON_SECRET` is missing
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

## Near term

- v1.40: Flights UX & logbook polish — clearer filters, review/import provenance and faster everyday flight workflow
- v1.41: Print & Export finalisation — large-logbook guidance, range handling and complete/EASA/ULL consistency
- keep FSTD recency evidence deferred until it becomes a product priority
- retire `instructor_flight_approvals` only after historical backup/restore consumers are fully migrated
- migrate backup/restore away from `track_points` before considering removal of that compatibility table
- add a large-logbook print warning or range guidance before unrestricted print size becomes a practical performance issue

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Compatibility cleanup must never rewrite certified evidence. GPS inference must remain conservative and reviewable; presentation preferences, dashboard analytics and advisory recency evidence must never alter certified evidence or regulatory records automatically.
