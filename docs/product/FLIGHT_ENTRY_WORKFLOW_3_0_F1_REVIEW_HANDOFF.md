# Independent Review Handoff — Flight Entry Workflow 3.0 / F1

## Reviewer role

Act as an **independent read-only architecture/data-integrity reviewer**. Do not assume the draft design is correct. Challenge it against the stated repository evidence and constraints.

Repository: `filipto861/flytally-logbook`  
Baseline: `main@1fb1b4edb051b3ce8d052a50401916cb2cbc78b8`

Primary documents:
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F1_DESIGN.md`
- `docs/product/MULTI_AIRCRAFT_SCALE_CONTRACT.md`

Primary runtime:
- `lib/flight-input.ts`
- `app/(protected)/flights/actions.ts`
- `components/flight-form.tsx`
- `components/kml-import-form.tsx`
- `lib/gps-import-integrity.ts`
- `lib/certification-integrity.ts`
- `app/(protected)/flights/certification-actions.ts`
- `lib/fcl050-compliance.ts`
- `lib/recency-service.ts`
- `app/(protected)/flights/shared-actions.ts`
- `lib/db-optimization.ts`

## Current state

F0.1 is merged and production-ready:
- invalid/missing GPS aircraft context no longer falls back to ULL;
- GPS role is PIC-only and unsupported roles are server-rejected.

F0 is DONE/verified:
- source/Save/Certification/persistence/consumer matrix frozen;
- Manual New/Edit use `parseFlightInput()`;
- GPS still uses a separate direct semantic INSERT path;
- certification v1–v8 must remain compatible;
- canonical recency is certified-only;
- dashboard/statistics/export/print can consume drafts.

## Frozen constraints

- correctness > convenience;
- fail closed > plausible guess;
- one canonical flight model;
- historical flight snapshot > mutable current profile for historical identity;
- no invented regulatory evidence;
- GPS provenance is not a second flight model;
- F1 must not broaden GPS beyond PIC;
- F2 owns complete Role/Crew parity;
- no historical rewrite/backfill;
- no incidental certification hash/version change;
- GPS N-part import remains atomic;
- Manual create behavior should remain regression-equivalent except explicitly approved integrity fixes.

## Draft F1 architecture

Proposed pipeline:

```
Manual FormData ─┐
                 ├─> source adapter ─> FlightDraftCandidate ─> normalizeFlightDraft() ─> FlightInput
GPS reviewed part┘
```

`parseFlightInput(FormData)` remains a compatibility wrapper around the new pure normalizer.

GPS can retain its specialized atomic SQL/track transaction, but every semantic `flights` value must come from normalized `FlightInput`, not a second hand-written semantic mapper.

Source provenance / child domains remain separate:
- GPS track;
- expenses;
- connected crew account links;
- certification lifecycle;
- participation/verifications.

## Findings that need challenge

### 1. Operation / Engine

Manual exposes SP/MP + SE/ME.

Current GPS silently forces:
- Operation = SP;
- Engine = class-derived `defaultEngineType()`.

This can be materially wrong (e.g. PIC in MP operation; generic Helicopter does not prove SE).

Draft recommendation:
- FCL-style EASA GPS must receive explicit Operation/Engine candidate state;
- either compact common controls are shown or unresolved context fails closed;
- do not let a source-agnostic normalizer hide an SP assumption.

### 2. DUAL server Save gap

Manual UI and Certification require Instructor/PIC for EASA DUAL, but `parseFlightInput()` does not itself reject a crafted DUAL Save without instructor.

F2 owns the complete Role/Crew fix. Review whether F1 extraction can safely leave this unchanged without creating a misleading "canonical" contract.

### 3. Sailplane / movement source gaps

GPS currently lacks explicit:
- non-TMG sailplane launch evidence;
- Part-FCL PF movement/approach evidence;
- TMG movement evidence;
- day/night classification;
- night/IFR.

Do not recommend inference from generic GPS movement unless source evidence actually proves the fact.

### 4. Shared-flight historical identity / DB trigger

The v6 BEFORE INSERT / UPDATE OF registration trigger writes flight make/model/variant from the current matching aircraft profile.

Ordinary Manual/GPS inserts rely on this.

But `acceptSharedFlight()` explicitly inserts the certified source make/model/variant. The trigger can replace them with recipient current-profile identity on INSERT.

Draft fix direction:
- a new idempotent migration, not editing already-applied v6;
- INSERT preserves explicit supplied historical identity tuple and only resolves profile identity when no snapshot was supplied;
- registration-changing UPDATE refreshes identity for the new registration;
- same-registration UPDATE does not refresh historical identity.

Review this carefully for Manual, GPS, sharing, backup/restore and corrections.

## Questions

Please answer with:
1. **Blocking findings** — correctness/data-integrity problems that must change before implementation.
2. **Non-blocking improvements** — simplifications or better boundaries.
3. **Architecture verdict by component** — candidate type, pure normalizer, FormData wrapper, GPS adapter, persistence boundary, DB trigger.
4. **Operation/Engine recommendation** — explicit controls vs fail closed vs another source-backed design.
5. **Shared-trigger recommendation** — exact safe semantics and migration risks.
6. **F1 milestone split** — whether F1.1–F1.6 is appropriately small and dependency-ordered.
7. **Tests missing from the draft**.
8. **Any reason F1 should not start after reconciliation**.

Do not propose:
- a second flight model;
- guessed/backfilled historical evidence;
- GPS role expansion beyond PIC in F1;
- certification v1–v8 rewrite;
- non-atomic multi-part persistence.
