# 3.5.3 — Flight detail navigation UX

**Status:** ACTIVE  
**Owner:** Filip Točík  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `fix/3.5.3-flight-detail-navigation`  
**Production baseline:** `3.5.2`

## Trigger

Flight detail already exposes Back, Previous and Next navigation, but the controls are visually too quiet to be readily discoverable. The user should be able to move through flights without repeatedly returning to the flight list.

## Existing authority

The current detail route already calls `getFlightNavigationFast(userId,id,context)`.

That navigation service already:
- orders the unfiltered list consistently;
- respects supported Flights filters and sort context;
- returns `previousId`, `nextId`, `position` and `total`;
- keeps flight-record data untouched.

3.5.3 is therefore a presentation/discoverability patch, not a navigation-data redesign.

## Frozen contract

1. Keep the existing `FLIGHT x/y` indicator.
2. Make **Back to flights** visually obvious and preserve the current Flights query context.
3. Show **Previous flight** and **Next flight** as explicit peer controls.
4. Keep both direction controls present at the first/last flight:
   - unavailable direction is visibly disabled;
   - no fabricated destination;
   - disabled control is not interactive.
5. Preserve existing filter/sort context in Previous/Next links.
6. Desktop/iPad:
   - Back remains clearly separated from sequential navigation;
   - Previous/Next stay grouped and stable.
7. Mobile:
   - Back occupies its own row;
   - Previous/Next form a two-column row;
   - no horizontal page overflow;
   - touch targets remain at least the existing canonical minimum.
8. Keep **More** as secondary record actions; do not mix destructive/audit actions into sequential navigation.
9. No DB, certification, recency, sharing, persistence or flight-record semantic change.

## Implementation scope

- `app/(protected)/flights/[id]/page.tsx`
  - restructure only the detail navigation markup;
  - reuse the existing `navigation.previousId`, `navigation.nextId` and `suffix`;
  - add explicit disabled edge states.
- `app/ui-system.css`
  - make the navigation hierarchy obvious;
  - add responsive desktop/mobile layout.
- regression tests
  - freeze labels, context-preserving destinations, edge-state behavior and responsive structure.

## Acceptance criteria

- Back to flights is immediately visible.
- Previous flight / Next flight are visually recognizable as navigation controls.
- First flight shows Previous disabled and Next available when applicable.
- Last flight shows Previous available and Next disabled when applicable.
- A single-flight result set shows both directions disabled.
- Filtered/sorted browsing stays inside the same result context.
- `FLIGHT x/y` remains accurate because the existing navigation service is unchanged.
- Mobile does not rely on horizontal scrolling to expose the three core navigation controls.
- More menu behavior is unchanged.

## Verification

Before merge:
- targeted navigation/source regression tests;
- existing flight-workflow regression;
- TypeScript;
- full unit/regression suite;
- production build;
- browser acceptance: targeted responsive check if available;
- PostgreSQL migration: N/A.

## Do not

- change flight ordering semantics;
- invent Previous/Next IDs;
- add client-side history heuristics;
- drop filter/sort query context;
- hide the unavailable edge control and shift layout;
- change record/certification behavior.
