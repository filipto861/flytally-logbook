# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.36.1 · Mobile navigation hotfix

Focus:
- restore the proven v1.35.5 single-tap navigation behavior on mobile and touch devices
- remove the v1.36.0 first-paint script and direct Next-managed head/meta reconciliation that could interfere with touch navigation
- keep the iOS status area non-interactive and paint-only, with `pointer-events: none`
- do not override mobile menu, backdrop, tab or hamburger interaction geometry in the v1.36 layer
- retain the compact mobile Recency & currency presentation from v1.36.0
- keep the iOS/PWA status-bar style on the safe static metadata path while appearance continues to use the established ThemeManager
- Recency Engine logic remains the v1.35.5 landing-based planning model; v1.36.1 changes shell/presentation behavior only

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0: initial mobile/iOS polish and compact recency presentation

## Near term

- keep FSTD recency evidence deferred until it becomes a product priority
- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
