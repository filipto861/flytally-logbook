# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.36.2 · iOS status-bar hotfix

Focus:
- keep the v1.36.1 single-tap navigation behavior completely unchanged
- set the protected route `theme-color` server-side from the user's saved FlyTally appearance instead of the device theme when Light or Dark is selected explicitly
- make the initial `html` / `body` background match the server-rendered saved appearance before hydration, so iOS Home Screen status-area sampling does not start from the legacy dark root background
- use CSS-only `:has()` appearance matching and the existing non-interactive safe-area paint; no bootstrap scripts, overlays or navigation geometry changes
- preserve System appearance through `prefers-color-scheme`
- retain the compact mobile Recency & currency presentation from v1.36.0
- Recency Engine logic remains the v1.35.5 landing-based planning model; v1.36.2 changes only first-paint/status-area presentation

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator
- v1.36.0: initial mobile/iOS polish and compact recency presentation
- v1.36.1: restore proven single-tap mobile navigation and remove unsafe first-paint/head manipulation

## Near term

- keep FSTD recency evidence deferred until it becomes a product priority
- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
