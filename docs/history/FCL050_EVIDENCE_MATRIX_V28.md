# FlyTally v2.8 — FCL.050 engineering evidence matrix

Status date: 17 September 2026

This matrix is internal engineering traceability for the FlyTally electronic pilot-record implementation. It documents where applicable FCL.050 / AMC1 FCL.050 information is stored, validated, printed and regression-tested. It is **not** an authority approval, certification or legal opinion.

| Requirement / evidence | Canonical FlyTally source | Runtime / certification control | Regulator-facing output | Regression / engineering evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Holder name | `users.display_name` | Missing holder name is surfaced before print | Identity header on every print page | `tests/print-regulatory-source.test.ts` | Implemented |
| Holder address | licence-linked profile in `user_settings.preferences_json` | Missing address is surfaced before print | Identity header on every print page | `tests/logbook-print.test.ts`, print-source regression | Implemented |
| Holder licence number | active `pilot_licences.licence_number` | Active authoritative licence selected by EASA/ULL scope; legacy mirror is fallback only | Identity header on every print page | `tests/logbook-print.test.ts`, `tests/print-regulatory-source.test.ts` | Implemented |
| Licence validity warning | `pilot_licences.validity_mode`, `valid_until`, `recency_until` | Unlimited/date/recency modes interpreted before output | Pre-print warning; expiry is not silently ignored | `tests/logbook-print.test.ts` | Implemented |
| Date | `flights.date` | FCL.050 compliance gate validates record date | Column 1 | `tests/fcl050-compliance.test.ts` | Implemented |
| Departure place | `flights.departure` | Mandatory for EASA certification | Column 2 | `tests/fcl050-compliance.test.ts` | Implemented |
| Departure UTC | `flights.off_block` | Mandatory valid time for EASA certification | Column 2, UTC | `tests/fcl050-compliance.test.ts` | Implemented |
| Arrival place | `flights.arrival` | Mandatory for EASA certification | Column 3 | `tests/fcl050-compliance.test.ts` | Implemented |
| Arrival UTC | `flights.on_block` | Mandatory valid time for EASA certification | Column 3, UTC | `tests/fcl050-compliance.test.ts` | Implemented |
| Aircraft make/model/variant | flight snapshot fields `aircraft_make`, `aircraft_model`, `aircraft_variant`; aircraft ICAO mapping | Structured aircraft identity checked by compliance gate where applicable | Compact type code plus per-page Aircraft identity key retaining full identity | `tests/logbook-print.test.ts`, `tests/fcl050-compliance.test.ts` | Implemented |
| Registration | `flights.registration` | Mandatory for EASA certification | Column 4 | `tests/fcl050-compliance.test.ts` | Implemented |
| SP / MP allocation | `flights.operation_type` | Mandatory classification; totals route to SP or MP columns | Column group 5 | `tests/easa-print-layout.test.ts` | Implemented |
| SE / ME allocation | `flights.engine_type` | Mandatory classification where applicable | Column group 5 | `tests/easa-print-layout.test.ts` | Implemented |
| Total flight time | derived from stored block times (`off_block` → `on_block`) | Non-zero total required for EASA certification | Column 6 and page totals | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| Accumulated / carried total | deterministic pagination totals | Page total, previous-page carry and running total are calculated independently of rendered text | `TOTAL THIS PAGE`, `TOTAL FROM PREVIOUS PAGES`, `TOTAL TIME` | `tests/easa-print-layout.test.ts`, `tests/print-regulatory-source.test.ts` | Implemented |
| PIC identity | `commander`, instructor/verifier context, holder identity | Role-sensitive PIC resolution; DUAL/SPIC/PICUS checks | Column 7 | `tests/fcl050-compliance.test.ts`, `tests/logbook-print.test.ts` | Implemented |
| Day / night landings | `landings_day`, `landings_night` | Landing reconciliation checked at certification | Column group 8 | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| Night time | `night_minutes` | Included in certified record fingerprint and totals | Column group 9 | `tests/easa-print-layout.test.ts` | Implemented |
| IFR time | `ifr_minutes` | Included in certified record fingerprint and totals | Column group 9 | `tests/easa-print-layout.test.ts` | Implemented |
| PIC / co-pilot / DUAL / FI-FE function time | `pic_minutes`, `copilot_minutes`, `dual_minutes`, `instructor_minutes`, `role` | Role-to-column allocation is certification-blocking when inconsistent | Column group 10 | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| SPIC / PICUS supervision | `verification_name`, `verification_reference`, signed verification record | Supervising identity / countersignature details required before certification | PIC resolution plus Remarks | `tests/fcl050-compliance.test.ts`, `tests/logbook-print.test.ts` | Implemented |
| CRCP identification | role `CRUISE-RELIEF CO-PILOT` | Co-pilot allocation rules | `CRCP` in Remarks | FCL.050 compliance regression | Implemented |
| Remarks / endorsements | `task`, `purpose_code`, `note`, signed verification context | Structured special-purpose checks where detected | Column 12 | FCL.050 compliance regression | Substantially implemented; authority expectations still to be confirmed |
| Pilot certification | `certified_at`, canonical certification hash / revision | Server-side certification gate; certified records are not silently mutable | DRAFT marker before certification; page certification box | certification-integrity and audit regressions | Implemented |
| Corrections / audit trail | record revision, archived fingerprints and correction reason | Superseded certified versions retained | Separate audit evidence; corrected current entry in logbook | `tests/certification-integrity.test.ts`, `tests/flight-audit.test.ts` | Implemented |
| FSTD type / qualification | `fstd_sessions.device_type`, `qualification_number` | Mandatory before FSTD certification | Column group 11 | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| FSTD instruction / exercise | `fstd_sessions.instruction` | Mandatory before FSTD certification | Remarks / FSTD row | `tests/fcl050-compliance.test.ts` | Implemented |
| FSTD date and session time | `session_date`, `total_minutes` | Valid date and non-zero time required | Column group 11 and FSTD running totals | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| Auxiliary-only roles | `SAFETY PILOT`, `PAX`, `OBSERVER` | May be retained as reference but cannot carry creditable function time; excluded from official totals by default | Optional reference rows marked `NON-CREDITABLE` | `tests/fcl050-compliance.test.ts`, `tests/easa-print-layout.test.ts` | Implemented |
| Scope filtering | flight `evidence` + output category | Complete / ULL / EASA / ULL+EASA filter contract | Same regulator-facing powered-logbook structure for selected powered records | `tests/logbook-print.test.ts` | Implemented |

## v2.8 C3 release gate

The C3 print/compliance block is ready to merge only when all of the following are true:

1. TypeScript, unit/regression tests, production build and PostgreSQL acceptance pass on the PR head.
2. The authoritative `pilot_licences` path remains covered by both behavioural tests and a source-contract regression.
3. Multi-page totals prove that the final running total equals the selected-record grand total across every FCL total column.
4. No UI or document claims that FlyTally is authority-approved or EASA-certified.
5. Feature-branch Vercel preview builds remain suppressed; only the merged `main` release is allowed to create the production build.

## External acceptance items still open

- competent-authority acceptance of the electronic record format and pilot-certification method;
- authority expectations for electronic countersignatures and endorsement authentication;
- validation against authority-provided or authority-agreed test cases;
- any authority-requested changes to presentation, retention, authentication or export evidence.
