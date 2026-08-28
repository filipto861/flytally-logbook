# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.35.3 · FCL.060 evidence completeness

Focus:
- generalized recency evaluation over certified FlyTally flight records
- selectable FCL.140.A, FCL.060 and FCL.740.A monitoring with rolling-window forecasts
- structured take-off and approach evidence for new/reviewed EASA flights
- FCL.060 evaluation from explicit take-offs, approaches and landings instead of a landing-only proxy
- separate day/night movement counters and the current-IR night exemption
- historical certified flights remain untouched; missing movement evidence is shown as limited data rather than inferred
- certification payload v4 protects structured movement evidence while v1–v3 verification remains unchanged
- structured user-entered LAPL(A) proficiency-check and SEP/TMG revalidation evidence
- proactive in-app notifications with per-user 7/14/30-day warning windows
- compact daily recency snapshot on the dashboard
- recency presentation remains advisory and never changes certified flight evidence or authority validity records

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish

## Near term

- add FSTD pilot-flying movement evidence before counting simulator events toward FCL.060
- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
