# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.38.2 · GPS take-off time hardening

Focus:
- stop `flightEnvelope()` from treating one early taxi/runway speed spike as the take-off time
- require a sustained fast movement segment and, when usable altitude data is present, a real climb before accepting the automatic take-off timestamp
- anchor the suggested take-off to the first point clearly above the local ground-altitude baseline instead of the first isolated high-speed point
- keep a speed-only fallback for tracks without useful altitude data so older/generic GPS imports still work
- retain v1.38.1 conservative split validation and impossible-altitude-jump rejection for touch-and-go detection
- keep landing-time inference, airport inference, manual review/editability, dashboard, certification, Recency Engine and global mobile navigation unchanged

## v1.38.1 · GPS split & landing detection hardening

- automatic GPS splitting is stricter than generic track validation: both proposed flight sections must contain credible airborne movement and at least 1 km of actual tracked movement
- a short taxi/GPS speed burst followed by a long ground wait is not promoted to a separate suggested flight
- altitude-based touch-and-go candidates are rejected when local evidence depends on a physically implausible GPS altitude discontinuity above 25 m/s (about 4,900 ft/min)
- genuine rolling touch-and-go detection, manual split controls and time-gap split logic remain supported

## v1.38.0 · Dashboard, Airports & Routes overhaul

- Claude audit hardening: scheduled backup and recency endpoints fail closed when `CRON_SECRET` is missing and never trust a spoofable `vercel-cron` User-Agent fallback
- certified ULL and EASA records share one read-only field structure; only the evidence label differs
- Aircraft and Costs are one coherent dashboard area with aircraft count, period cost, average cost per hour and per-aircraft breakdown
- Airports and Routes are separate detailed statistics with period-aware direct drill-down to Flights
- Routes retain directional A → B semantics plus explicit A ↔ B pair filtering
- airport/route insights are computed inside the existing user-scoped dashboard aggregation

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed product foundation

- v1.34.0–v1.34.2: modular dashboard, per-user layout, System/Dark/Light appearance and responsive UI consistency
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0–v1.36.2: mobile/iOS presentation work, single-tap navigation hotfix and isolated status-area handling
- v1.37.0: unified shared-flight notification/review workflow, explicit Review → Add → Certify states and protected ULL logbook-entry presentation
- v1.38.0: dashboard consolidation, distinct airport/route analytics, ULL/EASA field-parity regression guard and fail-closed cron authentication
- v1.38.1: conservative GPS split validation and altitude-glitch rejection for landing suggestions
- v1.38.2: sustained-flight/climb evidence for automatic take-off timestamps

## Near term

- keep FSTD recency evidence deferred until it becomes a product priority
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- retire the compatibility `instructor_flight_approvals` projection only after all historical consumers are proven migrated
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated
- add a large-logbook print warning or range guidance before unrestricted print size becomes a practical performance issue

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. GPS inference must remain conservative and reviewable; presentation preferences, dashboard analytics and advisory recency evidence must never alter certified evidence or regulatory records automatically.
