# FlyTally roadmap

This roadmap applies to the current **Next.js / Vercel / Neon PostgreSQL** application. Historical Streamlit release notes elsewhere in the repository are legacy references only.

## Current release — v1.36.0 · Mobile UX & iOS polish

Focus:
- fix iOS/PWA status-bar and safe-area theming so Light and Dark appearance extend consistently into the top system area
- resolve manual Light/Dark preference before the protected shell paints instead of letting the device color scheme temporarily win
- normalize runtime `theme-color` metadata after hydration and keep browser chrome synchronized with FlyTally appearance
- preserve existing mobile safe-area offsets while adding left/right notch protection for narrow and landscape layouts
- compact the mobile Recency & currency presentation without removing regulatory values, forecasts or audit detail
- keep current recency requirements readable at a glance by removing redundant “Requirement met” sub-lines on small screens
- maintain 44 px primary mobile touch targets and a stable fixed navigation shell
- Recency Engine logic remains the v1.35.5 landing-based planning model; v1.36.0 is presentation/shell work only

## Certification baseline — v1.33.5

The v1.33 certification-readiness baseline remains unchanged: exact revision/hash verification, immutable certified records, correction history, instructor evidence, cross-user isolation, backup/restore integrity, PostgreSQL acceptance evidence and 10k query benchmarks.

## Completed UI foundation

- v1.34.0: modular dashboard registry, appearance contract and theme-aware maps
- v1.34.1: per-user dashboard editor with show/hide, ordering, sizing and presets
- v1.34.2: full application UI/UX consistency and responsive polish
- v1.35.0–v1.35.5: selectable recency monitoring, forecasts, structured revalidation evidence, audit detail and simplified landing-based FCL.060 planning indicator

## Near term

- keep FSTD recency evidence deferred until it becomes a product priority
- extend predefined recency profiles only where the underlying logbook data can support the rule without unsafe inference
- replace remaining read-only legacy/fuzzy participant-link fallbacks after historical rows have been verified
- decide whether the legacy `track_points` compatibility table can be retired after backup/restore paths are migrated

## Product direction

Preserve FCL.050-style logbook correctness, exact revision history, clear ULL/EASA filtering, separate pilot-owned records for the same physical flight, and simple mobile-first workflows. Presentation preferences and advisory recency evidence must never alter certified evidence or regulatory records automatically.
