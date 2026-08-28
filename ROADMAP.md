# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.38.0 · Dashboard, Airports & Routes overhaul

Focus:
- make the Claude audit hardening part of the release: both scheduled backup and recency endpoints now **fail closed** when `CRON_SECRET` is missing and never trust a spoofable `vercel-cron` User-Agent fallback
- keep certified ULL and EASA records on one read-only logbook structure with the same field set: departure/arrival UTC, aircraft type/registration, SP SE/ME, multi-pilot, total, PIC, day/night landings, night/IFR, PIC/co-pilot/DUAL/FI-FE and remarks; only the evidence label differs
- consolidate Aircraft and Costs as one coherent dashboard area with aircraft count, period cost, average cost per hour and per-aircraft flight/time/cost breakdown
- separate **Airports** from **Routes** in detailed statistics instead of mixing two different concepts in one table
- Airports shows visited airport, visits, departures, arrivals, first visit and last visit with direct drill-down to matching flights
- Routes shows directional A → B flight count, total time, first flown and last flown with a direct directional drill-down plus an explicit A ↔ B pair option
- compute airport/route insight data inside the existing user-scoped dashboard aggregation rather than adding per-row/N+1 queries
- keep period filtering consistent across the summary widget and detailed statistics
- keep v1.37 shared-flight workflow, certification evidence, Recency Engine behavior and global mobile navigation unchanged

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed product foundation

- v1.34.0–v1.34.2: modular dashboard, per-user layout, System/Dark/Light appearance and responsive UI consistency
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0–v1.36.2: mobile/iOS presentation work, single-tap navigation hotfix and isolated status-area handling
- v1.37.0: unified shared-flight notification/review workflow, explicit Review → Add → Certify states and protected ULL logbook-entry presentation
- v1.38.0: dashboard consolidation, distinct airport/route analytics, ULL/EASA field-parity regression guard and fail-closed cron authentication

## Near term

- keep FSTD recency evidence deferred until it becomes a product priority
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- retire the compatibility `instructor_flight_approvals` projection only after all historical consumers are proven migrated
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated
- add a large-logbook print warning or range guidance before unrestricted print size becomes a practical performance issue

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences, dashboard analytics and advisory recency evidence must never alter certified evidence or regulatory records automatically.
