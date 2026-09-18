# FlyTally — FCL.050 compliance baseline

Regulatory baseline reviewed 25 August 2026:

- EASA Easy Access Rules for Aircrew, current online publication February 2026.
- FCL.050 — Recording of flight time.
- AMC1 FCL.050 — ED Decision 2025/002/R for the current AMC content.
- Current Pilot Logbook specimen/instructions presented by EASA under ED Decision 2025/022/R in the online Easy Access Rules.

The older August 2023 Easy Access Rules page must not be used as the sole compliance baseline.

## Mandatory flight-record content

FlyTally must retain and make available, where applicable:

- pilot name and address;
- PIC name;
- date;
- departure place and UTC time;
- arrival place and UTC time;
- aircraft type including make, model and variant where a distinct variant applies, plus registration;
- SE / ME indication where applicable;
- SP / MP allocation in the prescribed logbook structure;
- total flight time;
- accumulated total flight time;
- day and night landings as pilot flying;
- night and IFR time;
- pilot function: PIC including solo, SPIC and PICUS, co-pilot including cruise-relief co-pilot, dual, FI and FE;
- applicable remarks, endorsements and countersignatures.

AMC1 FCL.050 also requires applicable countersignatures/remarks for SPIC/PICUS, skill tests and proficiency checks, instrument training used for a licence/rating, specified revalidation/recency entries, and CRCP entries.

## FSTD

Where applicable the logbook supports FSTD records containing:

- type and qualification number of the device;
- FSTD instruction / exercise;
- date;
- total session time;
- accumulated FSTD time.

## Electronic record requirements

Electronic records must be readily available when requested by the competent authority, contain the relevant FCL.050 data, be certified by the pilot, and use a format acceptable by the competent authority.

## Certification-readiness gate

Before an EASA flight can be pilot-certified, FlyTally checks the stored record for mandatory FCL.050 data. Blocking checks include:

- valid date, departure/arrival place and UTC departure/arrival times;
- non-zero total flight time;
- registration plus structured aircraft make/model and variant where applicable;
- SP/MP and SE/ME classification;
- PIC identity;
- valid creditable pilot function;
- role-to-column allocation: PIC/SOLO/SPIC/PICUS to PIC, co-pilot/CRCP to co-pilot, DUAL to DUAL, and FI/FE time to FI/FE with PIC where FlyTally records the user as instructor/examiner;
- instructor/PIC identity for DUAL;
- supervising PIC/FI and countersignature reference for SPIC/PICUS;
- mandatory instrument-training remarks where detected from the structured flight context.

Non-creditable auxiliary roles (Safety Pilot, PAX and Observer) may remain in FlyTally as certified reference records but are excluded from official creditable totals by default and may not contain PIC/co-pilot/DUAL/FI-FE time.

FSTD certification is separately gated on date, device type, qualification number, instruction/exercise and non-zero session time.

The checks run both in the UI and again server-side. Hiding or bypassing a disabled certification button therefore does not bypass the compliance gate.

## Certified records and audit

FlyTally uses certified-record revisions rather than silent mutation:

- canonical SHA-256 payload generation for certification and later verification;
- verification states for current and archived certification fingerprints;
- field-by-field comparison between superseded and current flight revisions;
- printable per-flight certification audit report, separate from the official Pilot Logbook print;
- FSTD Certified R1 → Correction R2 → Certified R2 workflow with mandatory correction reason;
- immutable archived FSTD revision snapshots and database-level protection against silent certified-record edits;
- compact Draft / Locked / Certified / Correction status in the normal workflow.

Integrity mismatches are surfaced for review and are never silently repaired.

## v1.14 print rules

The v1.14 print view keeps the established 1–12 logbook structure, A4 landscape format, fixed record rows, page totals, carried totals, pilot certification box and chronological FSTD integration.

FlyTally intentionally displays a compact ICAO type designator in the main Aircraft type cell when an ICAO type is available. This is a FlyTally presentation choice, not an EASA requirement. Because AMC1 FCL.050 requires the electronic record to contain aircraft make/model/variant information, each printed page also carries an **Aircraft identity key** mapping the compact type code to the stored full make/model/variant identity. The full structured aircraft identity remains part of the electronic flight record and certification evidence.

The print view also:

- shows the actual/supervising PIC rather than SELF for SPIC/PICUS when the holder is not the designated aircraft PIC;
- renders SPIC/PICUS countersignature information in Remarks;
- automatically renders `CRCP` in Remarks for cruise-relief co-pilot records;
- warns before printing when holder name, holder address or matching licence number is missing;
- marks uncertified records as DRAFT;
- keeps auxiliary reference records excluded from official totals by default.

## v2.8 print identity source of truth

The regulator-facing print path now treats `pilot_licences` as the authoritative licence record. The printed holder licence number and current validity are taken from the active `pilot_licences` row, while the holder address and print scope remain licence-linked profile attributes. The former `user_expiries` licence mirror remains only as a backwards-compatible fallback for accounts that still contain legacy records.

This avoids a split source of truth between the Licences UI and the printable logbook. A stale legacy mirror cannot override a current active `pilot_licences` record. Unlimited, date-based and recency-based validity modes are interpreted from the authoritative licence row before the print warning state is produced.

Regression coverage explicitly verifies EASA/ULL scope selection, canonical licence-number precedence, legacy fallback, inactive-record handling and expiry warnings.

## Implemented or substantially implemented

- licence-linked pilot identity including separate EASA/ULL address and licence number;
- authoritative `pilot_licences` source for regulator-facing printed licence identity, with legacy fallback only;
- PIC name logic including DUAL/instructor and SPIC/PICUS handling;
- structured aircraft make/model/variant snapshot on the flight;
- compact ICAO print code plus printed full-aircraft identity key;
- SE/ME and SP/MP metadata;
- total and accumulated flight time;
- PIC, co-pilot, dual and FI/FE allocation;
- role-to-function-column validation before certification;
- SOLO, SPIC, PICUS and cruise-relief co-pilot roles;
- automatic CRCP print remark;
- night / IFR time;
- day / night landing counts;
- dedicated FSTD session records and accumulated FSTD time;
- Pilot Logbook print structure using column groups 1–12, page totals and carried totals;
- ten fixed-height record rows per A4 landscape page;
- unified print scope for Complete / ULL / EASA / ULL+EASA;
- explicit UTC handling for imported track timestamps with a known timezone;
- pilot certification with SHA-256 record fingerprint;
- immutable certified records;
- traceable certified-record correction revisions with mandatory correction reason and retained prior fingerprints;
- flight/FSTD revision comparison and certification integrity verification.

## Remaining before any approval claim

The implementation is still **not** a basis for claiming that FlyTally is “EASA certified” or “EASA approved”. Remaining external/compliance work includes:

- competent-authority review of the electronic format and pilot-certification method;
- confirmation of how the authority expects electronic PIC/FI/FE countersignatures or endorsement evidence to be represented and authenticated;
- validation of the complete workflow against authority test cases and real exported logbooks;
- final documented data dictionary and evidence/test matrix for every applicable FCL.050/AMC item;
- any changes requested by the competent authority during acceptance review.

## Product rule

No UI or export should claim that FlyTally is "EASA certified" or "approved" until the relevant competent authority has accepted the electronic format. Development targets **FCL.050 compliance / certification readiness** first, followed by authority acceptance.
