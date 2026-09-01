# FlyTally v1.53.1 — aircraft state audit

Scope: manual flight entry/editing when aircraft registration or aircraft type is changed.

## Findings

1. Registration is the authoritative aircraft-profile selector in `FlightForm`.
2. Changing registration refreshes display type, aircraft class, logbook evidence, engine type, billing basis/share and hourly rate.
3. `operationType` is not refreshed when registration changes. A value from the previous aircraft/record can therefore survive a registration correction.
4. Role is currently refreshed from the new aircraft profile on registration change. Role is flight-specific, not aircraft identity, so a registration correction can unexpectedly change PIC/DUAL/etc.
5. `Aircraft type` is a free text field independent of registration. Changing only that text cannot refresh class/evidence/engine/billing. This can create a mixed record: new type label with aircraft-dependent metadata from the old profile.

## Correct state boundary

Aircraft-dependent values refreshed from a newly selected registration:
- aircraft type/display type
- class
- normal logbook/evidence
- engine type
- operation type default
- billing basis/share
- resolved hourly rate

Flight-dependent values preserved:
- role
- crew/instructor/supervising pilot
- route/date/times
- landing/movement counts
- night/IFR time
- task/purpose/notes

## Type catalogue

The official worldwide reference is ICAO Doc 8643. ICAO provides current online search/API access, but bulk data redistribution is not a no-strings-attached bundled dataset.

Mictronics publishes an ICAO aircraft-types export under the Open Data Commons Attribution License and updates it weekly. It is a viable source for a local searchable FlyTally catalogue with manual fallback, provided attribution and an explicit update/import process are included.
