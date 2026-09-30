# UI/UX Simplicity 2026 — B4 Optional Details + Helper-copy Triage

**Status:** DONE — MERGE READY  
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

Initial local verification on 30 September 2026:
- TypeScript: **PASS**
- targeted B4 / affected historical tests: **47/50 PASS, 3 FAIL**
- full unit/regression: **949/954 PASS, 5 FAIL**
- production build: **PASS**
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO CUMULATIVE LIVE REDESIGN SMOKE — NOT PASS**

Failure review found five stale/over-broad source-contract assertions rather than a runtime/parser/certification failure:
1. legacy v1.25 expected the removed duplicate aircraft-origin sentence;
2. v1.32 expected superseded helper wording instead of the structured purpose submission contract;
3. B1B expected `const profileSummary=` even though B4 colocated adjacent derived constants;
4. B3 had the same declaration-shape assumption;
5. B4 CSS assertion omitted the intentional `flex-wrap:wrap` reflow safeguard.

These five assertions were reconciled test-only. Clean rerun on 30 September 2026 passed:

- TypeScript: **PASS**
- reconciled targeted set: **34/34 PASS**
- full unit/regression: **954/954 PASS**
- production build: **PASS** on the runtime-equivalent B4 head
- PostgreSQL: **N/A**
- authenticated browser: **DEFERRED TO CUMULATIVE LIVE REDESIGN SMOKE — NOT PASS**

The final syntax-only test correction changed no runtime code, so the earlier successful production build remains runtime-equivalent evidence.

## Next

Merge B4, then start **B5 — Responsive, accessibility and final UX closeout**. The cumulative authenticated live UI smoke remains an explicit deferred verification item.
