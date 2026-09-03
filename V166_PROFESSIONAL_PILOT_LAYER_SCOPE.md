# FlyTally v1.66.0 — Professional Pilot Layer

## Goal

Add professional and multi-pilot experience structure without turning FlyTally into an airline operations system and without changing the legal meaning of historical flight records.

## Scope

- Keep the existing single flight record and existing FCL.050 pilot-function columns as the canonical logbook record.
- Add explicit professional operational context only where it is useful for later experience summaries: operator/employer label, flight/duty number, and professional operation category.
- Keep aircraft `SP` / `MP` operation separate from the pilot's logged function.
- Model professional pilot functions conservatively: PIC/commander, co-pilot, cruise-relief co-pilot, SPIC and PICUS remain distinct and map to the existing FCL.050 allocation rules.
- Add explicit supervised-command context for PICUS/SPIC rather than inferring command experience from ordinary PIC totals.
- Build a reusable Professional Experience summary from certified EASA records, grouped by PIC, PICUS/SPIC, co-pilot, cruise-relief co-pilot, instructor/examiner, multi-pilot and IFR/night experience.
- Preserve ULL, sailplane, helicopter and balloon regulatory-category behavior; professional metadata must not make a flight creditable where the underlying logbook role is not creditable.
- Preserve sharing, trash/restore, portable backup and certification integrity for all new flight-level fields.

## Safety boundaries

- Do not infer an airline/commercial operation from aircraft type, registration, route or operator name.
- Do not infer multi-pilot credit merely because an aircraft is commonly operated with two pilots; existing `operation_type=MP` remains an explicit flight-level choice.
- Co-pilot and cruise-relief co-pilot credit remain separate.
- PICUS/SPIC remain countersigned/supervised evidence and are not collapsed into ordinary unsupervised PIC.
- Professional summaries are derived views, not licences, qualifications, operator records, duty-time records or regulatory approvals.
- Do not implement flight/duty-time limitation (FTL), rostering, FDP, commander qualification, line checks or operator training records in v1.66.
- Do not rewrite or backfill historical certified flights.

## Regulatory baseline

FCL.050 / AMC1 FCL.050 remains the governing logbook baseline. The professional layer extends data presentation and explicit context; it does not replace the existing certified logbook model.
