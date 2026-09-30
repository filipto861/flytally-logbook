# Flight Entry Workflow 3.0 — F0.0 Characterization

**Status:** IMPLEMENTED · VERIFICATION PENDING  
**Date:** 30 September 2026  
**Repository baseline:** `bfe064038e8ecd6a0cb2a53d1090728abd676b57`  
**Runtime change:** none

## 1. Purpose

F0.0 records the exact current GPS entry/write behavior before the F0.1 fail-closed hotfix. It is characterization evidence, not an approval of the behavior described here.

The characterization is intentionally narrow:

- current selected-aircraft class/evidence defaults;
- current GPS role surface and server handling;
- current crew persistence;
- duplicate/transaction semantics;
- immediate downstream consumers of saved drafts;
- valid PIC baseline.

The broader per-field inventory remains F0.

## 2. Current Manual versus GPS boundary

### Manual

`createFlight()` uses `parseFlightInput(form)`.

The parser:
- requires valid evidence, aircraft class/category and role values;
- validates category/class combinations;
- applies canonical billing parsing;
- applies canonical role credit allocation;
- server-blocks EASA SPIC/PICUS without supervision name + countersignature;
- is supplemented by `createFlight()` Safety Pilot connected/manual Actual-PIC validation.

### GPS

`importKmlFlight()` does not call `parseFlightInput()`.

It currently:
- parses evidence/class/role itself;
- derives regulatory category itself;
- allocates function time directly;
- builds its own `INSERT INTO flights`;
- inserts track rows in the same transaction.

This is a confirmed semantic-write divergence.

## 3. GPS aircraft-context characterization

### UI defaults

Current `KmlImportForm` uses:

- aircraft class → `selectedAircraft?.aircraft_class || "ULL"`;
- evidence/logbook → `selectedAircraft?.evidence || "ULL"`.

### Server fallbacks

Current `importKmlFlight()` uses:

- `form.get("evidence") || "ULL"`;
- `form.get("aircraftClass") || "ULL"`;
- `form.get("role") || "PIC"`.

Therefore missing aircraft evidence/class can be turned into ULL independently at both presentation and server boundaries.

This is the confirmed F0.1 fail-open defect.

Valid explicit ULL is a separate valid state and must remain supported.

## 4. Current GPS role characterization

Current visible GPS Role choices are:

| GPS UI value | Display | Canonical `ROLES`? | Current allocation / crew result | Characterization |
| --- | --- | :---: | --- | --- |
| `PIC` | PIC | Yes | PIC minutes allocated; commander empty, but canonical print/compliance can identify the account holder as PIC | **Coherent baseline** |
| `DUAL` | DUAL | Yes | DUAL minutes allocated; `instructor=''`; no Instructor/PIC input in GPS | **Incomplete / unsafe for first-save semantics** |
| `INSTRUKTOR` | INSTRUCTOR | **No** | `allocatedFunctionTimes("INSTRUKTOR")` allocates zero function time | **Non-canonical stored role / unsafe** |
| `SAFETY PILOT` | SAFETY PILOT | Yes | auxiliary allocation; `commander=''`; no Actual-PIC/Connection contract | **Incomplete / unsafe** |
| `CO-PILOT` | CO-PILOT | Yes | co-pilot time allocated; `commander=''`; PIC identity cannot be entered | **Incomplete for EASA identity semantics** |
| `PAX` | PAX | Yes | auxiliary/non-creditable; `commander=''`; PIC identity cannot be entered | **Incomplete reference semantics** |
| `OBSERVER` | OBSERVER | Yes | auxiliary/non-creditable; `commander=''`; PIC identity cannot be entered | **Incomplete reference semantics** |

Current GPS UI does **not** expose SPIC or PICUS.

The server does not validate the submitted GPS role through canonical `ROLES`, so a crafted request is not bounded by the UI list.

### F0.1 interim compatibility decision

The smallest role set proven semantically coherent without adding new crew UI is:

> **PIC only**

F0.1 should therefore preserve valid GPS PIC import and fail closed for other GPS roles until role/crew parity is introduced.

This is intentionally conservative and temporary. F2 restores supported role breadth through the canonical Role/Crew contract rather than keeping incomplete GPS-specific semantics.

## 5. Current crew / verification persistence

The current GPS flight INSERT writes:

- `commander = ''`;
- `instructor = ''`.

The GPS insert does not persist:
- `verification_name`;
- `verification_reference`;
- connected Actual-PIC identity;
- `flight_connected_crew` linkage.

Consequences:

- DUAL loses Instructor/PIC identity at first Save;
- Safety Pilot loses Actual-PIC semantics;
- GPS cannot currently represent SPIC/PICUS supervision even if a crafted role were submitted;
- roles requiring a separate PIC name cannot collect it before Save.

F0.1 must not invent these values. Unsupported role semantics fail closed until F2.

## 6. INSTRUKTOR mismatch

GPS currently renders:

`<option value="INSTRUKTOR">INSTRUCTOR</option>`

Canonical `ROLES` contains:

`INSTRUCTOR`

not:

`INSTRUKTOR`

`allocatedFunctionTimes("INSTRUKTOR", 60)` produces:

- PIC 0;
- Co-pilot 0;
- DUAL 0;
- Instructor 0.

The canonical `INSTRUCTOR` role would instead allocate both PIC and Instructor time.

F0.1 must reject/remove the non-canonical GPS value. It must not silently reinterpret arbitrary unknown submitted roles.

## 7. Manual Save-boundary characterization

Current Manual behavior is not perfectly uniform and F1/F2 must reconcile it deliberately.

### DUAL

The Manual EASA DUAL input is HTML-required in `FlightForm`.

However `parseFlightInput()` itself currently permits a DUAL draft with blank `instructor`.

Therefore the browser UI is stricter than the core parser for this one condition.

Frozen 3.0 direction remains:
- EASA DUAL Instructor/PIC inline;
- server-side Save requirement must eventually match the UI.

### SPIC / PICUS

`parseFlightInput()` already rejects EASA SPIC/PICUS without both:
- `verificationName`;
- `verificationReference`.

### Safety Pilot

Manual `createFlight()` has explicit EASA Safety Pilot Actual-PIC/Connection validation and accepted-Connection handling.

GPS has no equivalent contract today.

## 8. Duplicate and transaction behavior

Current GPS duplicate protection has multiple layers:

1. fingerprint uniqueness across reviewed parts in the same submitted import;
2. pre-transaction existing-flight lookup;
3. deterministic sorted advisory transaction locks per fingerprint;
4. `WHERE NOT EXISTS` on each flight insert inside the transaction;
5. all locks + all flight/track inserts run through one `sql.transaction([...])`.

Failure returns:

`Import failed and the transaction was rolled back. No partial flights were created.`

F0.1 must preserve this atomicity and duplicate behavior.

F1/F4 may refactor the service boundary, but not weaken these guarantees.

## 9. Draft-consumer characterization

Saved draft identity is already product-visible before certification.

| Consumer | Draft flights included? | Characterization |
| --- | :---: | --- |
| Canonical recency | **No** | Explicit `f.certified_at IS NOT NULL` |
| Dashboard | **Yes** | Reads user flights without certified-only filter |
| Statistics / Pilot Insights | **Yes** | Reads user flights without certified-only filter |
| Export | **Yes** | Exports `certified_at` as record metadata rather than excluding drafts |
| Print | **Yes** | Includes drafts and appends `DRAFT` in remarks |

Therefore invalid GPS EASA context silently stored as ULL can immediately alter:
- EASA/ULL dashboard totals;
- statistics/category composition;
- exported evidence/class;
- printed logbook classification.

This is why F0.1 is a production data-integrity hotfix even though recency is certified-only.

## 10. Valid GPS PIC baseline

The baseline that F0.1 must preserve:

- explicit selected registration;
- valid explicit EASA/SEP remains EASA/SEP;
- valid explicit ULL remains ULL;
- Role PIC remains canonical;
- PIC function time is allocated from the current GPS credited-time rule;
- reviewed route/time/movement suggestions remain pilot-reviewable;
- duplicate protection remains;
- all imported parts + tracks remain atomic;
- no certification/recency/hash semantics are changed.

Existing authenticated browser coverage already proves that selecting a valid EASA/SEP aircraft in GPS exposes EASA/SEP rather than receiving the Manual intelligent-review portal.

F0.1 adds the negative fail-closed behavior; it must not regress this positive baseline.

## 11. F0.1 frozen acceptance contract

F0.1 is intentionally smaller than the eventual redesign.

### Must change

1. Remove UI fallback of missing class/evidence to ULL.
2. Remove server fallback of missing class/evidence to ULL.
3. Missing/invalid context must be visibly unresolved and server-rejected.
4. Preserve explicit valid ULL.
5. Preserve explicit valid EASA/SEP.
6. Validate GPS role server-side.
7. Interim GPS role allow-list becomes **PIC only**.
8. Crafted non-PIC/unknown roles fail closed.
9. Preserve current duplicate fingerprint/advisory-lock/transaction behavior.
10. No schema migration.
11. No historical backfill.
12. No certification hash/version change.
13. No recency-rule change.
14. No broad form redesign.

### Must not change

- GPS track parsing;
- T&G/split detection thresholds;
- airport detection;
- review-required semantics;
- multi-part transaction atomicity;
- billing optionality contract;
- existing Manual entry behavior except shared helpers only if proven no-op;
- historical certified records.

## 12. F0.1 verification matrix

Required tests after implementation:

### Source/domain
- missing evidence rejected;
- missing class rejected;
- malformed evidence rejected;
- malformed class rejected;
- explicit ULL accepted;
- explicit EASA/SEP accepted;
- PIC accepted;
- DUAL rejected by GPS interim boundary;
- SAFETY PILOT rejected;
- `INSTRUKTOR` rejected;
- arbitrary crafted role rejected.

### Browser
- valid EASA/SEP GPS profile remains EASA/SEP;
- valid ULL GPS profile remains ULL;
- invalid/missing profile shows unresolved / Needs configuration rather than ULL;
- role selector exposes only supported F0.1 role semantics;
- Save cannot bypass the unresolved state.

### Persistence / PostgreSQL
- valid PIC single import persists expected evidence/class/role;
- valid PIC multi-part remains atomic;
- duplicate import blocked;
- invalid context creates zero flights/tracks;
- unsupported role creates zero flights/tracks.

### Regression
- canonical recency remains certified-only;
- Dashboard/Statistics/Export/Print receive no newly-created false ULL draft from invalid EASA context;
- Manual parser/certification/sharing contracts unchanged.

## 13. F0.0 closeout criteria

F0.0 is complete when:
- this characterization is merged;
- source characterization tests pass;
- ROADMAP/FEATURES/CHANGELOG identify F0.1 as the next runtime milestone;
- no runtime behavior changed.

F0.0 does not claim F0.1 behavior is already fixed.
