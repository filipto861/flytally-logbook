# FlyTally v1.61 — Category-aware Flight Entry

v1.61 introduces a presentation-only aircraft-category layer into the existing `Add flight` workflow.

## User-facing behaviour

- A blank new manual flight no longer shows aircraft-dependent Flight experience controls before an aircraft is selected.
- After Registration is selected, FlyTally derives a simple UI category from the existing aircraft profile: Aeroplane, ULL, Sailplane, or Aircraft.
- The existing experience controls then appear in the context of that selected profile.
- Aircraft & logbook summary also shows the derived category.
- Clearing Registration on a new unsaved flight clears the aircraft-dependent profile state again.
- Role remains a property of the flight. Aircraft selection never changes it.

## Safety boundary

This release does **not** add SPL/GPL, sailplane recency, launch methods, helicopter semantics, new flight-credit rules, database columns, migrations, certification fields, or signing changes.

The category is derived only for presentation. Existing EASA/ULL parser and movement-evidence behaviour remain authoritative and unchanged.

## Next category release

v1.62 can plug sailplane-specific experience controls into this category layer without creating a second Add flight workflow.
