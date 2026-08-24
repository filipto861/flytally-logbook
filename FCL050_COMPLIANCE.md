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
- supervising PIC/FI name and countersignature reference for SPIC/PICUS.

Potential skill/proficiency check, revalidation/recency and instrument-training contexts are surfaced as advisory remarks unless a dedicated structured endorsement workflow provides enough information for a stronger rule. Generic hidden verifier fields are not required for ordinary EASA roles.

Non-creditable auxiliary roles (Safety Pilot, PAX and Observer) cannot be certified as FCL.050 pilot-function time. They may remain in FlyTally for reference and are excluded from official totals by default.

FSTD certification is separately gated on date, device type, qualification number, instruction/exercise and non-zero session time.

The checks run both in the UI and again server-side. Hiding or bypassing a disabled certification button therefore does not bypass the compliance gate.

## v1.11 certified-record integrity and audit

v1.11 adds a verification layer around the existing certified-record workflow:

- flight certification fingerprints are generated and re-verified from one shared canonical payload definition;
- legacy flight certification version 1 and current version 2 remain verifiable;
- current and archived certified flight revisions are checked against their stored SHA-256 fingerprints;
- corrected flight revisions show material field-by-field differences between revisions;
- a printable Certification Audit Report shows the revision chain, correction reasons, timestamps, hashes and verification results;
- FSTD records now use the same traceable correction model as flights: certified R1 → mandatory correction reason → editable R2 → certified R2;
- every superseded certified FSTD revision is stored as an immutable JSON snapshot with its original hash and certification metadata;
- FSTD current and archived revision fingerprints are re-verifiable;
- Certification Center provides a combined queue for Ready to certify, Needs attention, Correction drafts, Certified records and fingerprint integrity issues;
- integrity mismatches are reported for manual review and are never silently repaired.

Database schema version 8 contains the FSTD certified revision archive and database-level protection that permits a certified FSTD record to enter correction mode only after a matching certified snapshot has been archived in the same transaction.

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
- immutable certified flight and FSTD records;
- traceable flight and FSTD correction revisions with mandatory correction reason and retained prior fingerprints;
- v1.10 FCL.050 certification-readiness gate;
- v1.11 fingerprint verification, revision comparison, Certification Center and audit report.

## Remaining before any approval claim

The implementation is still **not** a basis for claiming that FlyTally is “EASA certified” or “EASA approved”. Remaining external/compliance work includes:

- competent-authority review of the electronic format and pilot-certification method;
- confirmation of how the authority expects electronic PIC/FI/FE countersignatures or endorsement evidence to be represented and authenticated;
- structured handling and validation of applicable skill tests, proficiency checks, revalidation/recency entries and other Column 12 endorsements where required;
- validation of the complete workflow against authority test cases and real exported logbooks;
- final documented data dictionary and evidence/test matrix for every applicable FCL.050/AMC item;
- any changes requested by the competent authority during acceptance review.

## Product rule

No UI or export should claim that FlyTally is "EASA certified" or "approved" until the relevant competent authority has accepted the electronic format. Development targets **FCL.050 compliance / certification readiness** first, followed by authority acceptance.
