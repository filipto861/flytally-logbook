# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.35.2 · Recency evidence & proactive warnings

Focus:
- generalized recency evaluation over certified FlyTally flight records
- selectable FCL.140.A and FCL.060 monitoring with rolling-window drop-off forecasts
- structured user-entered LAPL(A) proficiency-check and SEP/TMG revalidation evidence
- FCL.740.A SEP/TMG revalidation planning via proficiency-check or experience routes
- proactive in-app notifications with per-user 7/14/30-day warning windows
- compact daily recency snapshot on the dashboard
- warning-window awareness for dated licences, qualifications, medical/language documents and other credentials
- user-defined rolling currency rules stored per user in existing `user_settings.preferences_json`
- recency presentation remains advisory and never changes certified flight evidence or authority validity records

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish

## Near term

- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- consider structured take-off / approach evidence before promoting FCL.060 from planning indicator to stronger compliance assistance
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
