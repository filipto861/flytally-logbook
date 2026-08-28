# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.35 · Recency Engine

Focus:
- generalized, pure recency evaluation engine over certified FlyTally flight records
- automatic regulatory profiles driven by saved licences and qualifications
- FCL.140.A rolling LAPL(A) privileges profile
- FCL.060 SEP/TMG passenger-currency profiles, including the night IR exemption
- warning-window awareness for dated licences, qualifications, medical/language documents and other credentials
- user-defined rolling currency rules stored per user in existing `user_settings.preferences_json`
- recency presentation remains advisory and never changes certified flight evidence

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish

## Near term

- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- add structured proficiency-check/revalidation evidence before automating alternative regulatory routes
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences must never alter certified evidence or regulatory calculations.
