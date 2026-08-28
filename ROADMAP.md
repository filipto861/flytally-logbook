# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.34 · Modular UI

Focus:
- central dashboard widget registry and validated per-user layout model
- dashboard preferences stored inside existing `user_settings.preferences_json`
- shared appearance contract: System / Dark / Light
- theme tokens layered over the existing UI without changing certified-flight data or certification payloads
- theme-aware OpenStreetMap rendering
- preparation for user-controlled widget visibility, ordering and sizing in v1.34.1

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Near term

- v1.34.1: dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full visual pass across the application, including light-mode polish, graphs, maps and removal of unnecessary persistent explanatory copy
- v1.35: generalized Recency Engine with predefined regulatory profiles and user-defined currency rules
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Modular UI preferences must remain presentation-only and must never alter certified evidence or regulatory calculations.
