# FlyTally — FCL.050 compliance baseline

Regulatory baseline reviewed 24 August 2026:

- EASA Easy Access Rules for Aircrew, current revision published November 2025 / online publication February 2026.
- FCL.050 — Recording of flight time.
- AMC1 FCL.050 — ED Decision 2025/002/R.
- Pilot logbook instructions incorporated by ED Decision 2025/022/R.

The older August 2023 Easy Access Rules page must not be used as the sole compliance baseline.

## Mandatory flight-record content

FlyTally must retain and print, where applicable:

- pilot name and address;
- PIC name;
- date;
- departure place and UTC time;
- arrival place and UTC time;
- aircraft make, model, variant and registration;
- SE / ME indication where applicable;
- SP / MP allocation in the prescribed logbook format;
- total flight time;
- accumulated total flight time;
- day and night landings as pilot flying;
- night and IFR time;
- pilot function: PIC including solo, SPIC and PICUS, co-pilot including cruise-relief co-pilot, dual, FI and FE;
- applicable remarks, endorsements and countersignatures.

## FSTD

Where applicable the logbook must support FSTD records containing:

- type and qualification number of the device;
- FSTD instruction / exercise;
- date;
- total session time;
- accumulated FSTD time.

## Electronic record requirements

Electronic records must be readily available when requested by the competent authority, contain the relevant FCL.050 data, be certified by the pilot, and use a format acceptable to the competent authority.

For certification readiness FlyTally therefore also needs:

- an auditable pilot-certification mechanism;
- integrity / change history for certified records;
- explicit countersignature workflow for SPIC/PICUS and other entries requiring instructor, PIC or examiner certification;
- export that remains readable using commonly available software;
- stable page totals and accumulated totals;
- a documented data dictionary and test matrix against every FCL.050 / AMC1 FCL.050 requirement.

## Current implementation status

Implemented or substantially implemented:

- pilot identity including address and licence reference;
- PIC name logic including DUAL/instructor handling;
- flight date, route, registration and aircraft type;
- SE/ME and SP/MP metadata;
- total and accumulated flight time;
- PIC, co-pilot, dual, FI/FE allocation;
- SOLO, SPIC, PICUS and cruise-relief co-pilot roles;
- night / IFR time;
- day / night landing counts;
- unified print scope for Complete / ULL / EASA / ULL+EASA;
- explicit UTC handling for imported track timestamps with a known timezone.

Not yet sufficient to claim complete FCL.050 conformity or competent-authority acceptance:

- dedicated FSTD session records;
- exact official pilot-logbook column layout and SP/MP time placement;
- structured make / model / variant data rather than one generic aircraft-type string;
- complete mandatory remarks workflow for skill tests, proficiency checks, assessments, instrument training, revalidation and recency cases;
- electronic pilot certification and countersignature workflow;
- tamper-evident audit history for certified entries;
- formal competent-authority acceptance.

## Product rule

No UI or export should claim that FlyTally is "EASA certified" or "approved" until the relevant competent authority has accepted the electronic format. Development should target **FCL.050 compliant / certification-ready** first, followed by authority acceptance.
