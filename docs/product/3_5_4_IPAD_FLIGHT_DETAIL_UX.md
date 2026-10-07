# 3.5.4 — iPad flight-detail visual hotfix

**Status:** IMPLEMENTED · VERIFICATION PENDING  
**Owner:** Filip Točík  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.5.4-ipad-flight-detail-ux`  
**Production baseline:** `3.5.3`

## Trigger

Production visual review of 3.5.3 on iPad exposed two presentation-only defects:

1. On flight-detail headers with a wider identity block, the **More** control can wrap by itself onto a second line while Back / Previous / Next stay on the first line.
2. The visually hidden **Skip to content** accessibility link uses an off-screen transform that can leave part of its cyan border visible inside the iPad safe area.

The 3.5.3 navigation data authority, ordering, query-context preservation and disabled edge-state behavior are not implicated.

## Frozen contract

1. Keep the existing 3.5.3 Back / Previous / Next destinations and labels.
2. Keep the existing filter/sort query suffix on Back / Previous / Next.
3. Keep Previous/Next disabled edge states visible and noninteractive.
4. Wider desktop/iPad layout:
   - Back / Previous / Next / More stay in one non-wrapping navigation row;
   - the flight identity block may shrink/wrap before an individual navigation control is pushed onto a second row.
5. Narrower tablet layout:
   - the whole navigation group moves below the flight identity as one unit;
   - the group remains left-aligned and stable.
6. Mobile layout remains the 3.5.3 hierarchy:
   - Back on its own row;
   - Previous/Next in two columns;
   - More remains secondary.
7. **Skip to content** remains in the DOM and keyboard-focusable.
8. When not focused, the skip link is fully visually hidden using clipping/1px containment rather than relying on an off-screen transform.
9. On focus, the skip link restores its visible padding, border and content.
10. No flight ordering, record, certification, recency, sharing, persistence, DB or schema behavior changes.

## Implementation

- `app/(protected)/flights/[id]/page.tsx`
  - add a flight-detail-specific header class only.
- `app/ui-system.css`
  - make the flight-detail navigation non-wrapping on wider layouts;
  - keep More non-shrinking;
  - stack the entire flight-detail header/navigation at narrower tablet widths;
  - override the historical skip-link transform with a fully clipped hidden state and explicit focused state.
- regression tests
  - freeze iPad navigation behavior and skip-link visibility/focus behavior.

## Verification required

- new 3.5.4 regression test;
- existing 3.5.3 flight-detail navigation regression;
- existing v3.0 U6 skip-navigation/accessibility regression;
- versioning/navigation governance tests;
- TypeScript;
- full unit/regression suite;
- production build;
- production iPad visual acceptance after deploy.

PostgreSQL migration: **N/A**.

## Do not

- change `getFlightNavigationFast()`;
- change flight-list ordering or filters;
- replace the keyboard skip link with a hidden/non-focusable element;
- hide More or move its actions into primary navigation;
- modify flight/certification data to solve a layout problem.
