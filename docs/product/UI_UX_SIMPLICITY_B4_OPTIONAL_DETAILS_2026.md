# UI/UX Simplicity 2026 — B4 Optional Details + Helper-copy Triage

**Status:** IMPLEMENTED IN BRANCH — VERIFICATION PENDING  
**Date:** 30 September 2026  
**Branch:** `feat/new-flight-b4-optional-details`

## Scope

B4 consolidates optional New Flight metadata under one native **Optional details** disclosure:

- Training purpose + Task / exercise;
- Night / IFR time;
- Professional context;
- Costs / expenses;
- Notes.

B4 is presentation-only. It does not change the canonical parser, persistence schema, certification rules, recency rules, collaboration provenance, UTC semantics, aircraft-profile validation, billing semantics or GPS import behavior.

## Populated Edit behavior

Stored optional data opens Optional details on Edit. The summary identifies populated domains. Malformed populated billing remains fail-closed, changes the summary to **Needs configuration**, and forces the disclosure open.

Closing Optional details does not remove or disable its fields, so a normal edit/save cycle does not erase stored optional values merely because the disclosure is closed.

## Night / IFR

Night time and IFR time move out of **Flight experience** into Optional details. Their existing field names and parser semantics remain unchanged. Historical stored values remain discoverable even when the current profile would not normally show those controls.

## Professional context

`ProfessionalContextFields` supports an embedded presentation while preserving its existing fields and applicability behavior. Repetitive per-field prose is reduced to one non-inference note.

## Helper-copy triage

Removed or compacted:

- repeated aircraft-profile-default prose;
- generic PIC role explanation;
- duplicate profile-origin paragraph;
- redundant optional-cost and Task explanations.

Kept visible:

- validation errors;
- malformed billing remediation;
- role/Connection consequences;
- signed-evidence consequences for structured recency purposes;
- category-specific regulatory evidence guidance.

## Regression coverage

Updated historical contracts:

- `tests/v158-flight-entry-polish.test.ts`;
- `tests/v159-flight-entry-structure-expenses.test.ts`;
- `tests/v338-new-flight-b1b-completion.test.ts`.

New contract:

- `tests/v341-new-flight-b4-optional-details.test.ts`.

## Database / migration

**N/A.**

## Verification state

- TypeScript: **NOT RUN**
- targeted B4 / affected historical tests: **NOT RUN**
- full unit/regression: **NOT RUN**
- production build: **NOT RUN**
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO CUMULATIVE LIVE REDESIGN SMOKE — NOT PASS**

## Next

After clean verification and merge: **B5 — Responsive, accessibility and final UX closeout.**
