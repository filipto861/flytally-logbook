# FlyTally changelog

This file records production-facing behavior changes. Detailed regulatory rationale, migration evidence and UX audits remain in the version-specific review documents.

## 1.57.0 — Flight Entry Workflow Simplification — 2026-09-01

### Added
- Recent-route shortcuts in manual New flight using FlyTally's existing route-history query.
- Explicit local-flight shortcut to set arrival equal to the current departure only when the pilot chooses it.
- Live BLOCK/AIR duration feedback directly below the timeline.
- Human-readable missing-field list in the final review card.

### Changed
- Logbook and Cost sections open automatically when they contain a missing or relevant required choice, without auto-closing after completion.
- Manual/GPS source selection is more compact on mobile.
- Entry-progress wording reflects the actual inline review workflow.

### Preserved
- No change to flight parsing/storage semantics, regulatory calculations, EASA movement evidence, certification/revisions, aircraft identity authority, GPS evidence, sharing, print/export or backup/restore.

### Verification
- Release gate: TypeScript + complete regression suite + PostgreSQL acceptance + production build + clean Vercel preview + post-deploy runtime audit.
- Detailed record: `FLIGHT_ENTRY_UX_V157.md`.

## 1.56.0 — Mobile Layout Audit & Responsive Hardening
- Added the shared iOS/WebKit native date/time sizing fix and a primary-navigation responsive containment audit.
- Preserved internal scrolling for genuinely wide tables/navigation rather than hiding page overflow.

## 1.55.0 — Flight Entry Layout & Responsive UX
- Paired Date/Registration, Departure/Arrival, Off-block/On-block, Takeoff/Landing and Role/Day landings into an aligned desktop grid with a logical single-column mobile flow.

## 1.54.4 — Aircraft Picker Selection Close Fix
- Prevented a confirmed aircraft catalogue selection from immediately reopening because of the debounced search effect.

## 1.54.3 — Aircraft Type Catalogue & Smart Aircraft Setup
- Added the structured FAA aircraft-type catalogue, searchable Make/Model/ICAO picker and manual fallback while keeping Part-FCL class separately pilot-confirmed.

## 1.53.1 — Aircraft State Integrity
- Prevented mixed or stale aircraft state when changing registration or aircraft type in flight entry.

## 1.53.0 — Guided Everyday Entry
- Made normal manual entry the default and simplified first-aircraft/profile setup through progressive disclosure.

## 1.52.0 — Codebase Review & Cleanup
- Removed the retired Streamlit/Python runtime and obsolete generated artifacts while preserving the validated regulatory core.

## 1.51.x — Regulatory Correctness Core
- Established the tested FCL.060, LAPL/FCL.740.A, legacy movement, eligible automatic ULL-credit and certification-evidence baseline retained by later releases.