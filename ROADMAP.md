# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.37.0 · Flights & shared-flight workflow polish

Focus:
- present certified ULL records with the same proper single-flight logbook-entry layout used for protected EASA records instead of a reduced generic data table
- make current `flight_request` notifications expose the intended **Review & add** / **Review & sign** and **Decline** actions directly in Notifications
- keep legacy `flight_invite` notifications compatible while centralising decline handling through the canonical shared-flight action
- show the shared-flight path explicitly as **Review → Add → Certify** for non-instructor crew invitations
- derive clear user-facing states from existing evidence: Pending, Accepted, Declined, Added and Certified, without adding a second source of truth to the database
- keep source and participant logbooks independent: accepting a request creates/restores only the participant-owned draft, and certification remains an explicit later action by that pilot
- retain the existing instructor sign-only / sign-and-add FI workflow and immutable certification/verification evidence
- keep mobile actions stacked and touch-safe without changing the global navigation shell

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0–v1.36.2: mobile/iOS presentation work, single-tap navigation hotfix and isolated status-area handling

## Near term

- dashboard consolidation: Aircraft + Costs as one coherent area
- redesign Airports & Routes around two distinct concepts: visited airports and flown airport-to-airport routes
- keep FSTD recency evidence deferred until it becomes a product priority
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
