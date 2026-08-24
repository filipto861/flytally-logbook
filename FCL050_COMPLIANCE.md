# FlyTally — FCL.050 compliance baseline

Regulatory baseline reviewed 24 August 2026:

- EASA Easy Access Rules for Aircrew, current online publication February 2026.
- FCL.050 — Recording of flight time.
- AMC1 FCL.050 — ED Decision 2025/002/R.
- Current Pilot Logbook instructions in the Easy Access Rules.

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

AMC1 FCL.050 also requires applicable countersignatures/remarks for cases such as SPIC/PICUS, skill tests and proficiency checks, instrument training used for a licence/rating, and specified revalidation/recency entries.

## FSTD

Where applicable the logbook must support FSTD records containing:

- type and qualification number of the device;
- FSTD instruction / exercise;
- date;
- total session time;
- accumulated FSTD time.

## Electronic record requirements

Electronic records must be readily available when requested by the competent authority, contain the relevant FCL.050 data, be certified by the pilot, and use a format acceptable to the competent authority.

## v1.10 certification-readiness gate

Before an EASA flight can be pilot-certified, FlyTally checks the stored record for mandatory FCL.050 data. Blocking checks include:

- valid date, departure/arrival place and UTC departure/arrival times;
- non-zero total flight time;
- registration plus structured aircraft make/model/variant;
- SP/MP and SE/ME classification;
- PIC identity;
- valid creditable pilot function and function-time allocation;
- instructor/PIC identity for DUAL;
- supervising pilot and countersignature reference for SPIC/PICUS;
- mandatory instrument-training remarks where detected from the structured flight context.

Non-creditable auxiliary roles (Safety Pilot, PAX and Observer) cannot be certified as FCL.050 pilot-function time. They may remain in FlyTally for reference and are excluded from official totals by default.

FSTD certification is separately gated on date, device type, qualification number, instruction/exercise and non-zero session time.

The checks run both in the UI and again server-side. Hiding or bypassing a disabled certification button therefore does not bypass the compliance gate.

## v1.11 certified records and audit

v1.11 extends certified-record integrity without adding a separate certification dashboard. Certification controls remain in the context where the record is managed.

Implemented concepts include:

- shared canonical SHA-256 payload generation for certification and later verification;
- verification states for current and archived certification fingerprints;
- field-by-field comparison between superseded and current flight revisions;
- printable per-flight certification audit report, separate from the official Pilot Logbook print;
- FSTD Certified R1 → Correction R2 → Certified R2 workflow with mandatory correction reason;
- immutable archived FSTD revision snapshots and database-level protection against silent certified-record edits;
- integrity status and revision history shown directly on the relevant flight or FSTD record;
- compact Draft / Locked / Certified / Correction status in the normal Flights workflow.

Integrity mismatches are surfaced for review and are never silently repaired.

## Implemented or substantially implemented

- licence-linked pilot identity including separate EASA/ULL address and licence number;
- PIC name logic including DUAL/instructor handling;
- structured aircraft make/model/variant snapshot on the flight;
- SE/ME and SP/MP metadata;
- total and accumulated flight time;
- PIC, co-pilot, dual and FI/FE allocation;
- SOLO, SPIC, PICUS and cruise-relief co-pilot roles;
- night / IFR time;
- day / night landing counts;
- dedicated FSTD session records and accumulated FSTD time;
- EASA Pilot Logbook print structure using column groups 1–12, page totals and carried totals;
- ten fixed-height record rows per A4 landscape page;
- unified print scope for Complete / ULL / EASA / ULL+EASA;
- explicit UTC handling for imported track timestamps with a known timezone;
- pilot certification with SHA-256 record fingerprint;
- immutable certified records;
- traceable certified-record correction revisions with mandatory correction reason and retained prior fingerprints;
- v1.10 FCL.050 certification-readiness gate;
- v1.11 flight/FSTD revision comparison and certification integrity verification.

## Remaining before any approval claim

The implementation is still **not** a basis for claiming that FlyTally is “EASA certified” or “EASA approved”. Remaining external/compliance work includes:

- competent-authority review of the electronic format and pilot-certification method;
- confirmation of how the authority expects electronic PIC/FI/FE countersignatures or endorsement evidence to be represented and authenticated;
- validation of the complete workflow against authority test cases and real exported logbooks;
- final documented data dictionary and evidence/test matrix for every applicable FCL.050/AMC item;
- any changes requested by the competent authority during acceptance review.

## Product rule

No UI or export should claim that FlyTally is "EASA certified" or "approved" until the relevant competent authority has accepted the electronic format. Development targets **FCL.050 compliance / certification readiness** first, followed by authority acceptance.
