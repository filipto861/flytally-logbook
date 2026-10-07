# 3.5.0 Phase 2 — Remaining multi-aircraft integrity audit

**Status:** VERIFIED / NO RUNTIME CHANGE REQUIRED  
**Date:** 7 October 2026  
**Repo:** `flytally-logbook`  
**Branch:** `feat/3.5.0-certified-flight-voiding`  
**Production runtime:** product `3.5.0`; PostgreSQL schema v20  
**Phase 1 state:** `3.5.0` production verified; schema v20 deployed and postflight verified

## Objective

Close the remaining historical/dynamic aircraft-applicability integrity questions without weakening existing recency behavior, certification evidence, or backward compatibility.

Stored flight facts remain authoritative. A current aircraft profile may affect historical regulatory credit only where FlyTally explicitly models a separate applicability mapping with its own provenance/effectivity.

## Frozen constraints

- Preserve ordinary certified ULL / Annex-I aeroplane PIC → SEP experience credit.
- Preserve the explicit `part_fcl_credit_class`, `part_fcl_credit_basis`, `part_fcl_credit_from` concept as external applicability/provenance, not flight evidence.
- Missing/malformed applicability must never be guessed or silently repaired.
- Manual and GPS equivalent inputs must persist equivalent flight-owned aircraft context.
- Same-registration historical edits remain SNAPSHOT-authoritative.
- Certification v1–v8 fingerprints remain unchanged unless separately reviewed evidence proves a version change necessary.
- No production migration/deployment during this audit.

## Repository census

### Historical context consumers — snapshot-owned

The audit found no general current-profile reinterpretation of historical flight context:

- Dashboard and Statistics / pilot insights read persisted `flights.regulatory_category`, `aircraft_class`, `evidence` with conservative legacy fallback.
- Professional experience reads persisted certified Part-FCL flight category.
- Print/export category partitioning reads persisted flight context.
- SPL and Balloon recency read persisted flight category/class/domain evidence.
- Helicopter historical type resolution uses stored `flight.aircraft_model`, then bounded legacy `flight.aircraft_type`; existing PostgreSQL acceptance proves editing today's aircraft model does not rewrite the historical type result.
- Manual and GPS create paths both use PROFILE authority and persist flight-owned context; same-registration edit uses SNAPSHOT authority.

### Current-profile dependencies that are intentional and non-historical

- Helicopter recency reads active helicopter profiles to enumerate/setup type workspaces; historical flight type still comes from the flight snapshot.
- Aircraft/Data-health compares stored flights with the **current** profile as an explicit diagnostic.
- Flight detail may use current-profile convenience metadata such as ICAO type; this is not regulatory-credit authority.

### Aeroplane recency current-profile dependency

`lib/recency-service.ts` and `lib/recency-audit-service.ts` join the matching current aircraft row only for:

- `part_fcl_credit_class`
- `part_fcl_credit_basis`
- `part_fcl_credit_from`

They do **not** source historical flight evidence/class/category/type from today's aircraft row.

This tuple is an external Annex-I/ULL applicability mapping. Copying it into certified flights would create a second source of truth and is not currently justified.

## ULL / Annex-I behavior to preserve

The recency engine currently has two conceptual paths:

1. ordinary ULL aeroplane → automatic SEP mapping;
2. explicit atypical override → e.g. TMG, with an optional effective-from boundary in the historical evaluator.

ULL flights do not replace the mandatory FI/CRI refresher element and do not silently become ordinary Part-FCL flight evidence.

## Independent review

The independent reviewer agreed with:

- flight snapshot vs external-applicability separation;
- keeping the explicit mapping external/effective-dated rather than copying it into flight snapshots;
- one shared eligibility resolver as the minimal architecture if runtime change is needed;
- no schema v21 or certification-version change on current evidence.

The reviewer also identified the legacy tuple as the decisive unresolved risk: compatibility should be preserved only through an explicit, bounded rule; if such a boundary cannot be justified, the system should fail closed rather than invent provenance.

## Repository-history correction to the review handoff

The original handoff overstated one historical fact.

- v1.51.3 commit `5f100350` changed the **UI and recency engine** so ordinary ULL → SEP became automatic and displayed explicit override basis/reference and valid-from as optional.
- However, the same v1.51.3 server-side Aircraft Add/Edit action still executed:
  - explicit class present → basis/reference required;
  - explicit class present → valid ISO valid-from required.
- v1.51.4 commit `8329aaaf` hid the override controls and preserved the stored fields.
- later M1 commit `3a14d21` centralized that strict new/edit/import profile validation and explicitly stated that exact restore and existing ULL/Annex-I semantics were to remain unchanged.
- exact account restore still restores aircraft rows without invoking current `validateAircraftProfile`.

Therefore a class-only or partially populated explicit tuple is **not proven to be a normal persisted v1.51.3 Add/Edit state**. Such rows may still exist through exact restore, historical/manual data handling, or other legacy paths, but that must be established from production data rather than assumed.

## Decision after review

No Phase 2 runtime behavior is changed.

An experimental unverified batch that relaxed stored-profile validation was superseded before verification once the server-side v1.51.3 history above was confirmed. Runtime and characterization code remain at the exact `69310a3` behavior that passed the initial Phase 2 suite 4/4.

The required read-only production aggregate census was then executed against the production Primary branch / `neondb`. It returned:

| credit_shape | aircraft_profiles | active | inactive | saved_flights | certified_ULL_flights |
| --- | ---: | ---: | ---: | ---: | ---: |
| `NONE` | 25 | 25 | 0 | 295 | 36 |

Additional aggregate orphan checks returned zero basis/date metadata where credit class was blank. Production schema was independently confirmed as v19.

Therefore:
- there is no production explicit override state to preserve or remediate;
- there are no partial/malformed/orphan tuple shapes;
- the strict current profile validator remains appropriate;
- ordinary ULL → SEP remains automatic/profile-independent;
- the optional external override concept remains available for future complete, provenance-backed mappings;
- no canonical-resolver runtime rewrite is necessary in 3.5;
- no schema v21 or certification payload change is justified.

Census script: `tooling/3_5_phase2_credit_census.sql` (corrected and successfully executed read-only).

## Production census criteria and result

For all aircraft profiles, grouped only as aggregate counts:

- no explicit override;
- complete SEP/TMG override with non-empty basis and valid ISO date;
- explicit class only;
- class + basis but no date;
- class + date but no basis;
- explicit class with malformed/non-ISO date;
- unsupported explicit class;
- active vs inactive profile counts;
- number of certified ULL flights attached to each shape.

Decision rule:
- anomalous/partial shapes were zero, so strict stored-profile validation stays in place and no legacy compatibility machinery is added;
- no basis/reference or effective date is invented;
- no additive migration is required.

## Acceptance evidence so far

- Phase 2 characterization suite on exact head `69310a3`: **4/4 PASS**.
- It freezes:
  - aeroplane recency current-profile authority to the explicit credit tuple only;
  - snapshot-owned category/type consumers;
  - Manual/GPS PROFILE + same-registration SNAPSHOT boundaries;
  - current evaluator behavior for class-only explicit credit.
- Production aggregate census: **VERIFIED READ-ONLY** — 25/25 profiles `NONE`, 295 saved flights, 36 certified ULL flights, zero anomalous shapes.
- Production schema: **v19 confirmed**.
- Phase 2 runtime change: **N/A — none required by evidence**.

## DO NOT

- do not backfill certified flights from current aircraft profiles;
- do not copy `part_fcl_credit_*` into flight certification snapshots;
- do not invent a default class, basis or effectivity;
- do not remove ordinary ULL → SEP automatic credit;
- do not relax current strict profile writes merely because the evaluator accepts a broader legacy shape;
- do not add schema v21 without production evidence;
- do not deploy schema v20 during this audit.
