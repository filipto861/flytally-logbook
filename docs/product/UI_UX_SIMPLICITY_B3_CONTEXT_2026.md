# UI/UX Simplicity 2026 — B3 Profile Summary + Role-driven Context

**Status:** DONE — MERGE READY  
**Date:** 30 September 2026  
**Branch:** `feat/new-flight-b3-context`  
**Parent contract:** `docs/product/UI_UX_SIMPLICITY_IMPLEMENTATION_2026.md`

## Goal

Expose the actual aircraft/logbook context that will be persisted and keep required role evidence together, while separating optional training-purpose metadata from crew identity.

B3 is a presentation/hierarchy batch. It does not alter the canonical flight parser, persistence schema, certification payload/hash, recency rules, collaboration provenance, UTC semantics, aircraft-profile validation or billing contract.

## Aircraft & logbook summary

The collapsed summary now reports real current values rather than a generic category description:

- Logbook/evidence;
- regulatory category;
- aircraft class where distinct;
- SP/MP + SE/ME where applicable;
- selected-profile origin for a new flight.

Example:

`EASA · AEROPLANE · SEP · SP · SE · from OK-XXXX`

Invalid selected-aircraft defaults continue to show **Needs configuration**.

The disclosure is forced open whenever a selected registration has missing logbook/class evidence or the selected profile fails canonical configuration validation.

Edit mode continues to preserve the stored flight snapshot and does not claim that historical evidence came from the current mutable aircraft profile.

## Role-driven context

The former **Crew & training** section is now **Role details**.

It auto-opens only when the current role has required crew/supervision evidence:

- DUAL → Instructor / PIC;
- Safety Pilot → Actual PIC source + Actual PIC;
- SPIC / PICUS → supervision + countersignature.

For other roles, existing Commander/PIC and Instructor fields remain available in the same disclosure but do not compete with the normal entry path.

Existing field names, Connection identity behavior and countersignature inputs are unchanged.

## Training purpose is optional metadata

`FlightPurposePicker` and `Task / exercise` move out of Role details into a separate **Optional details** disclosure.

The picker component itself is unchanged.

Therefore the structured form semantics remain intact:

- `purposeSelectionPresent=yes`;
- `purposeCode` checkbox values;
- canonical `parseFlightInput()` purpose filtering and task encoding.

Optional details auto-opens on Edit when stored structured purpose or Task data is already present.

B4 may consolidate additional optional domains into this hierarchy, but B3 does not move Costs, Professional context, Notes, Night or IFR yet.

## Deliberately unchanged

- Create/Edit parser and field names;
- DUAL/Safety Pilot/SPIC/PICUS validation rules;
- Connection / participation behavior;
- certification completeness and fingerprint versions;
- recency / FCL.060;
- aircraft-profile canonical validation;
- edit snapshot semantics;
- billing;
- GPS import;
- schema / migrations.

## Regression coverage

Updated historical contract:

- `tests/v159-flight-entry-structure-expenses.test.ts`.

New B3 contract:

- `tests/v340-new-flight-b3-context.test.ts`.

The B3 contract verifies:

- explicit aircraft/logbook/regulatory/class/operation-engine summary data;
- profile origin only on new selected-aircraft context;
- invalid/unresolved profile auto-expansion;
- required Role details auto-open policy;
- DUAL / Safety Pilot / SPIC / PICUS evidence stays together;
- Training purpose and Task are outside Role details;
- purpose hidden submission semantics remain unchanged;
- parser, certification and collaboration boundaries remain unchanged.

## Database / migration

**N/A.**

No persistence semantics or schema are changed.

## Verification state

Initial local verification run on 30 September 2026:

- TypeScript: **PASS**
- targeted B3 / affected historical tests: **36/39 PASS, 3 FAIL**
- full unit/regression: **942/946 PASS, 4 FAIL**
- production build: **PASS**
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO CUMULATIVE LIVE REDESIGN SMOKE — NOT PASS**

Failure review found no runtime/parser/certification regression in the reported assertions. Four source-contract assertions were stale or overly broad after the intentional B3 presentation move:

1. the v1.59 structure test matched the imported `FlightPurposePicker` symbol instead of the rendered JSX occurrence;
2. the B1B origin contract expected the old leading separator even though B3 moved the origin into an array-based summary;
3. the v1.59.2 profile-expansion contract did not include the new fail-closed `profileNeedsConfiguration` condition while retaining the registration gate;
4. the B3 compliance guard test expected `==` while the existing authoritative code uses `===`.

Those test contracts were reconciled without changing runtime code. The current branch head was then rerun cleanly on 30 September 2026:

- reconciled targeted set: **22/22 PASS**;
- full unit/regression: **946/946 PASS**.

The earlier TypeScript and production build PASS remain runtime-equivalent because the reconciliation after that run changed tests/docs only.

The cumulative live browser check remains explicitly deferred by Filip's current decision.

## Next after B3

Merge B3, retain the cumulative live UI smoke as an explicit deferred item, then start:

**B4 — Optional details + helper-copy triage.**
