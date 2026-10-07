# 3.5.4 — iPad flight-detail visual hotfix

**Status:** DONE · PRODUCTION VERIFIED  
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

## Verification

Final runtime exact-head local gate on `f7c80df84fbd6fd3bf18ede169ac54a9a2bcc768`:
- targeted 3.5.4 / 3.5.3 / accessibility / governance tests: **21/21 PASS**;
- TypeScript: **PASS**;
- full unit/regression suite: **1305/1305 PASS**;
- production build: **PASS**, including 41/41 static pages;
- PostgreSQL migration: **N/A**.

The only local warning is the existing Next.js notice about a parent `C:\Users\Filip Točík\package-lock.json` outside the repository; it does not affect the repository build.

Production closeout:
- PR #251 squash-merged as `8ed7567ca3f1f2ffb2834ecca0f29359bbd330c6`;
- Vercel production deployment `dpl_BceR2z3B27eXwnFuNzDL3AugQNjc` reached **READY** on the exact merge SHA;
- root/login smoke returned **HTTP 200** and the immediate runtime-error window was clean;
- production iPad visual acceptance confirmed both targeted 3.5.4 defects are resolved.

A separate sidebar collapse-button placement observation from the same iPad review is isolated to 3.5.5 and does not reopen the 3.5.4 flight-detail contract.

## Do not

- change `getFlightNavigationFast()`;
- change flight-list ordering or filters;
- replace the keyboard skip link with a hidden/non-focusable element;
- hide More or move its actions into primary navigation;
- modify flight/certification data to solve a layout problem.
