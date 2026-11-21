# FlyTally Logbook — Regulatory reference

Condensed developer reference for the regulatory rules FlyTally implements, the evidence fields they depend on, and the claims the product must never make. It replaces the former `docs/compliance/` and `docs/certification-readiness/` sets.

Executable code, schema and tests are authoritative. If this document and the code disagree, the code wins and this document must be corrected. Nothing here is a legal opinion or an authority approval.

## 1. Rule-to-code map

### 1.1 Logbook record content and certification gate (FCL.050 / AMC1 FCL.050)

| Rule | Module / function | Notes |
|---|---|---|
| Category router for the certification gate | `lib/fcl050-compliance.ts` → `flightCertificationCompliance()` | Runs only for `evidence = 'EASA'`. **ULL records get no FCL.050 gate (returns no issues).** Sailplane and balloon records get a category-specific gate. Everything else uses `fcl050FlightCompliance()`. |
| FCL.050 flight record checks (aeroplane / helicopter) | `fcl050FlightCompliance()` | See §1.2 |
| Sailplane / balloon record checks | `categorySpecificFlightCompliance()` (internal) | Same core checks, using air time when present. Non-TMG sailplanes require `launches ≥ 1` and `launch_method`. Balloons require `balloon_class`, a hot-air `balloon_group` (A–D) and `balloon_operation` (FREE/TETHERED). |
| FSTD session checks | `fstdCompliance()` | Date, `device_type`, `qualification_number`, `instruction`, `total_minutes > 0` |
| Role to function-column allocation | `lib/easa-logbook.ts` → `allocatedFunctionTimes()` | PIC/SOLO/SPIC/PICUS → PIC. CO-PILOT/CRCP → co-pilot. DUAL → dual. FI/INSTRUCTOR/EXAMINER → PIC **and** FI/FE. |
| Non-creditable roles | `lib/logbook-print.ts` → `AUXILIARY_LOGBOOK_ROLES` (`SAFETY PILOT`, `PAX`, `OBSERVER`), `isAuxiliaryLogbookRole()` | Can be certified as reference records. They must carry no function time and are excluded from FCL totals. |
| PIC name resolution | `lib/logbook-print.ts` → `pilotInCommandName()` → `lib/role-crew.ts` → `resolveRoleCrewPicName()` | Role-aware. For DUAL the PIC is the instructor, and for SPIC/PICUS it is the supervising pilot. |
| Server-side certification | `lib/flight-certification.ts` → `certifyStoredFlight()` | Re-runs the gate on the stored row, so a hidden or bypassed UI button does not bypass it. It also checks row `xmin` to reject stale writes, then hashes and locks in one guarded UPDATE. |
| Mandatory-field summary helpers | `blockingComplianceIssues()`, `complianceReady()` | Only `severity: "error"` blocks. Warnings do not block. |

### 1.2 FCL.050 checks in detail (`fcl050FlightCompliance`)

**Blocking (error):**
- the date must be valid ISO;
- departure and arrival places are required;
- `off_block` and `on_block` must be valid `HH:MM` times, treated as UTC;
- total block time must be greater than 0;
- `registration` and `aircraft_make` are required, plus `aircraft_model` (or the legacy `aircraft_type`). **The variant is not enforced;**
- `engine_type` must be SE or ME, and `operation_type` must be SP or MP. Co-pilot roles require MP;
- the role must be a creditable AMC1 FCL.050 function, and a PIC name must resolve;
- DUAL requires an `instructor` name;
- SPIC/PICUS require both `verification_name` (the supervising PIC/FI) and `verification_reference` (the countersignature reference);
- function time must be present, must not exceed twice the block time, and must exactly match `allocatedFunctionTimes(role, block)`;
- night and IFR time must each be no more than the block time;
- `landings_day + landings_night` must equal `starts` (the landing total);
- instrument training (detected from remarks text, or from DUAL with IFR minutes) requires a non-empty remark;
- an auxiliary role must carry no function time.

**Warning only (does not block):** skill test, proficiency check or AoC detected in remarks; revalidation or recency activity detected in remarks; missing task or remark. Detection is regex-based on `task` and `note`. AMC1 FCL.050 endorsement and countersignature duties for these entries are therefore **advisory, not enforced**.

### 1.3 Recency and currency engines

All engines return a `RecencyEvaluation` (`status: current | attention | not-current`, plus requirements, forecast and note). Services feed them **certified flights only** (`certified_at IS NOT NULL`). An instructor-signed contribution counts only when a `flight_verifications` row is `signed` and matches the flight's **current** `record_revision` and `certification_hash`.

| Rule | Function (file) | What the code requires |
|---|---|---|
| FCL.140.A LAPL(A) | `evaluateLaplA()`, `evaluateLaplMetrics()` (`lib/recency-engine.ts`) | Rolling 2 years: 12 h, 12 take-offs **and** 12 landings (min of both), and 1 h refresher. Experience counts as PIC, or as DUAL/SOLO only with current instructor signature. The refresher must be signed DUAL on a non-ULL SEP/TMG with `purpose_code = LAPL_FCL140A_REFRESHER` (legacy text fallback only when `purpose_code` is empty). A recorded `LAPL_PROFICIENCY_CHECK` evidence item is the alternative route. |
| ULL credit toward Part-FCL (FCL.035(a)(4)) | `isAnnexCreditForClass()`, `isFcl060ClassEligible()` | Certified ULL PIC time is credited as SEP by default. `aircraft.part_fcl_credit_class` can override this (e.g. TMG), and `part_fcl_credit_from` limits historical credit. **ULL flights never satisfy the FI/CRI refresher element.** |
| FCL.060 passenger currency (A) | `evaluatePassengerCurrencyMode()` / `evaluatePassengerCurrency()` | 90 days, same mapped class (SEP or TMG), PF roles: 3 take-offs, 3 approaches and 3 landings. Night mode adds 1 night take-off, approach and landing, unless a current aeroplane IR exists (`lib/regulatory-qualification.ts` → `isAeroplaneIrQualification()`; IRI never counts). |
| FCL.740.A SEP/TMG class revalidation | `evaluateClassRevalidation()` | Final 12 months before expiry: 12 h, 6 h PIC, 12 take-offs and 12 landings, plus a 1 h refresher (`SEP_TMG_FCL740A_REFRESHER`, signed) or a recorded exemption. A proficiency check is allowed in the final 3 months. **It never extends saved rating validity automatically**, and a missing expiry date gives `DATE NEEDED`. |
| Custom user rules | `parseCustomRecencyRules()`, `evaluateCustomRule()` | Up to 20 rules, metric-based, over a rolling window. |
| SFCL.160(a) SPL sailplanes | `evaluateSplSailplane()` (`lib/spl-recency.ts`) | 24 months: 5 h (TMG time allowed), 15 launches and 2 signed FI(S) training flights (`SPL_SFCL160_TRAINING`) in non-TMG sailplanes. A proficiency check is the alternative. |
| SFCL.160(b)/(c) SPL TMG | `evaluateSplTmg()` | 24 months: 12 h total, of which 6 h TMG, 12 TMG take-offs and landings, and a signed training flight of at least 1 h. Under (c), holders with Part-FCL TMG privileges are exempt and Part-FCL controls. |
| SFCL.160(e) SPL passengers | `evaluateSplPassenger()` | 90 days as PIC: 3 launches (sailplane) or 3 take-offs and landings (TMG). TMG night requires 1 night pair. |
| SFCL.155(c) launch methods | `evaluateLaunchMethod()` | 2 years: 5 launches (bungee 2). For self-launch, TMG take-offs count too. |
| FCL.140.H LAPL(H) | `evaluateLaplH()` (`lib/helicopter-recency.ts`) | **Type-specific, with no pooling**. 12 months on the stored type: 6 h, 6 take-off/approach/landing triples and 1 signed refresher of at least 1 h (`LAPL_H_FCL140H_REFRESHER`). Flights without a stored type give `LIMITED DATA`; they are never assigned from the mutable current aircraft profile. |
| FCL.060 helicopter passengers | `evaluateHelicopterPassengerCurrency()` | 90 days per type, PIC/CO-PILOT: 3 triples, plus 1 night triple unless an IR(H) is held. |
| BFCL.160 BPL base class | `evaluateBplBaseClass()` (`lib/balloon-recency.ts`) | 24 months: 6 h (take-off to landing), 10 take-offs and landings, plus 1 signed FI(B) training flight (`BPL_BFCL160_TRAINING`) within 48 months. A proficiency check is the alternative. |
| BFCL.160(b) additional class | `evaluateBplAdditionalClass()`, `findBplAnchorClass()` | 3 h per additional class in 24 months, plus one current base (anchor) class. |
| BFCL.200 tethered | `evaluateBplTetheredRating()` | 1 qualifying tethered hot-air flight in 48 months. Ground-only tether activity does not count. |
| Licence / qualification validity | `lib/credential-validity.ts` → `credentialValidity()` | Modes are `unlimited`, `date` and `recency`. A missing date gives `incomplete`, never valid. |

The services that assemble these evaluations from the database are `lib/recency-service.ts` (`getRecencyStateForUser`, `refreshRecencySnapshot`), `lib/spl-recency-service.ts`, `lib/helicopter-recency-service.ts`, `lib/balloon-recency-service.ts` and `lib/recency-workspace-service.ts`. Movement-evidence audit is in `lib/recency-audit.ts`, and category capabilities are in `lib/aircraft-category.ts` (`aircraftCategoryCapabilities()`, `resolveRegulatoryAircraftCategory()`).

**Movement-evidence compatibility** (`lib/legacy-movement.ts` → `resolveMovementCompatibility()`):
- Explicit PF counters are used as recorded.
- For certified EASA flights created before structured counters existed, the code reconstructs 1 take-off and 1 approach per landing. These evaluations are annotated as legacy-inferred.
- For ULL records, native `starts` and landings become a total-movement record. **Night PF movements are never inferred from ULL counters.**
- A structured-era EASA record with movement evidence switched off is never inferred.
- When certified flights in a window lack movement evidence and that could change the outcome, the result is `attention` / `LIMITED DATA`, not `current`.

### 1.4 Structured purpose codes (`lib/flight-purpose.ts`)

`purpose_code` is a pipe-separated list (`serializeFlightPurposeCodes()`), and it is part of the certification fingerprint from v3 onwards. Applicability depends on category and role (`flightPurposeApplicable()`): regulatory refresher and training codes need DUAL, while the general codes also allow a named instructor.

| Code | Category | Used by |
|---|---|---|
| `LAPL_FCL140A_REFRESHER` | AEROPLANE | `evaluateLaplA` |
| `SEP_TMG_FCL740A_REFRESHER` | AEROPLANE | `evaluateClassRevalidation` |
| `LAPL_H_FCL140H_REFRESHER` | HELICOPTER | `evaluateLaplH` |
| `SPL_SFCL160_TRAINING` | SAILPLANE | `evaluateSplSailplane`, `evaluateSplTmg` |
| `BPL_BFCL160_TRAINING` | BALLOON | `evaluateBplBaseClass` |
| `AIRCRAFT_DIFFERENCES`, `AIRCRAFT_FAMILIARISATION` | any | Endorsement evidence (`lib/aircraft-training-verification.ts`) |

### 1.5 Print and export (`app/(protected)/print/page.tsx`)

- **Layout.** FCL.050 column groups 1–12 on A4 landscape, 10 fixed rows per page by default. Page, previous-page and running totals are computed independently of the rendered text (`lib/easa-print-layout.ts` → `paginateEasaRecords()`, `totalsForEasaRecord()`).
- **Category layouts.** Separate layouts exist for Part-SFCL, Part-BFCL and other categories (`lib/category-print.ts`).
- **Scope filters.** Complete / ULL / EASA / ULL+EASA, plus a category filter (`lib/logbook-print.ts`). Filtering changes which records are selected, not the layout.
- **Remarks markers.** `CRCP`, `<role> · NON-CREDITABLE`, `FI SIGNED: <name>` (current revision only) and `DRAFT` for uncertified rows.
- **Aircraft type.** The type cell shows a compact ICAO code (a FlyTally presentation choice). A per-page *Aircraft identity key* maps it back to the full make/model/variant.
- **Holder identity.** `printIdentity()` takes the licence number and validity from the active `pilot_licences` row. The legacy `user_expiries` / preferences mirror is a fallback only. Missing holder name, address or licence number, and an expired licence, are warned about before printing.

## 2. Data dictionary essentials

### 2.1 `flights` fields with regulatory meaning

| Group | Fields |
|---|---|
| Identity / scope | `id`, `user_id`, `date`, `evidence` (`EASA`/`ULL`), `regulatory_category` (`AEROPLANE`/`HELICOPTER`/`SAILPLANE`/`BALLOON`/`ULL`/`OTHER`) |
| Aircraft snapshot | `registration`, `aircraft_make`, `aircraft_model`, `aircraft_variant`, `aircraft_type` (legacy/display), `aircraft_class` (SEP, TMG, MEP, ULL, …) — snapshotted onto the flight by DB trigger `logbook_snapshot_aircraft_identity` |
| Route / time | `departure`, `arrival`, `off_block`, `takeoff`, `landing`, `on_block` (UTC `HH:MM`). Durations are derived, not stored inputs. |
| Conditions | `operation_type` (SP/MP), `engine_type` (SE/ME), `night_minutes`, `ifr_minutes` |
| Movements | `starts`, `landings_day`, `landings_night`, `movement_evidence_recorded`, `takeoffs_day/night`, `approaches_day/night` |
| Category context | `launches`, `launch_method` (sailplane); `balloon_class`, `balloon_group`, `balloon_operation` |
| Professional context | `operator_name`, `flight_number`, `operation_context` |
| Function | `role`, `pic_minutes`, `copilot_minutes`, `dual_minutes`, `instructor_minutes`, `commander`, `instructor` |
| Remarks | `task`, `note`, `purpose_code`, `verification_name`, `verification_reference` (SPIC/PICUS countersignature) |
| Certification | `record_revision`, `certified_at`, `certified_by_user_id`, `certification_hash`, `certification_version`, `correction_reason`, `locked_at` |

Each user's flight is a separate record. A shared physical flight is never one mutable master record for several pilots.

### 2.2 Supporting tables

- **`flight_certified_revisions` / `fstd_certified_revisions`.** Archived certified revisions: revision number, hash, version, timestamps, correction reason and a full JSON snapshot.
- **`flight_verifications`.** Signed evidence bound to one exact revision. Fields: `flight_id`, `flight_user_id`, `signer_user_id` (null for in-person capture), `verification_role` (`INSTRUCTOR`/`SUPERVISING PIC`/`EXAMINER`), `record_revision`, `flight_hash`, `credential_snapshot`, `server_signature` (HMAC), `status` (`pending`/`signed`/`declined`/`superseded`/`cancelled`/`revoked`), and timestamps plus `revocation_reason`.
- **`flight_participations`.** Another user's relationship to a source flight. Fields: `source_flight_id`, `source_user_id`, `participant_user_id`, `participant_role`, `source_revision`, `source_hash`, `status`, and the optional `participant_flight_id` (the participant's own separate copy).
- **`flight_source_provenance`.** Immutable link from a participant's copy to the exact source revision and hash.
- **`voided_certified_flights`** and the `voided_flight_*` tables. Immutable tombstone archive of a voided certified flight with all its evidence.
- **`pilot_licences` / `pilot_qualifications`.** Authoritative licence and rating records (`validity_mode`, `valid_until`, `recency_until`, `active`).
- **`aircraft.part_fcl_credit_class` / `_basis` / `_from`.** ULL-to-Part-FCL credit mapping.
- **`fstd_sessions`.** `session_date`, `device_type`, `qualification_number`, `instruction`, `total_minutes`.

GPS tracks, costs, map styling and dashboard configuration are **not** part of the certification fingerprint.

## 3. Certification and change-control invariants

1. **Certification is the pilot's own finalisation.** `certifyStoredFlight()` validates the row, computes `flightCertificationHash()` (v8), and sets `certified_at`, `certification_hash`, `certification_version` and `locked_at` in one guarded UPDATE. It is not authority certification.
2. **Fingerprints are versioned.** `lib/certification-integrity.ts` defines the flight payload versions; each builds on the one before:

   | Version | Adds |
   |---|---|
   | v1 | Core record |
   | v2 | Revision and correction reason |
   | v3 | `purpose_code` |
   | v4 | Movement evidence |
   | v5 | Regulatory category and launches |
   | v6 | Balloon class and group |
   | v7 | Balloon operation |
   | v8 | Professional context |

   FSTD payloads have v1 and v2. `verifyFlightCertification()` / `verifyFstdCertification()` always recompute with the **stored** version. Unknown versions report `unsupported`, never `verified`. Changing protected-field coverage **requires a new version**, and old hashes must never be reinterpreted.
3. **The database enforces immutability.** The trigger `logbook_protect_locked_flight` (`lib/db-optimization.ts`) rejects any UPDATE of a certified flight except a correction transition. That transition must:
   - increment the revision;
   - supply a non-empty correction reason;
   - clear the certification and lock;
   - change no other column;
   - have a matching archived row in `flight_certified_revisions`.

   DELETE of a certified flight is rejected unless a matching `voided_certified_flights` tombstone exists in the same transaction (`lib/flight-voiding.ts` → `voidCertifiedFlightRecord()`, reason of 8 or more characters). FSTD has an equivalent trigger, `logbook_protect_certified_fstd`.
4. **Corrections never overwrite.** The lifecycle is Draft R1 → Certified R1 → Correction R2 (draft) → Certified R2. Archived revisions stay verifiable.
5. **Signatures bind to an exact revision.** The verification payload is `{flightId, flightUserId, signerUserId, recordRevision, flightHash, verificationRole, credentialSnapshot}`. It is canonicalised with recursive key sorting and signed with HMAC-SHA-256 (`lib/verification-signature.ts`, keyed by `SIGNING_SECRET`/`SESSION_SECRET`, 24 characters or more, otherwise it throws). A verification is *current* only if revision, hash, `status = 'signed'` and role all match the live flight. An R1 signature never becomes current for R2. Instructor requests (`lib/training-verification.ts` → `upsertInstructorRequest()`) are only created for certified DUAL/SPIC/PICUS flights with an accepted instructor connection.
6. **Revocation keeps history.** Status becomes `revoked`, with a timestamp and reason, and the row is not deleted. A revoked verification is never counted as current.
7. **The credential snapshot is frozen at signing**, so later profile edits do not rewrite historical evidence.
8. **"Sign & add FI entry"** (`app/(protected)/flights/shared-actions.ts` → `signAndAddInstructorParticipation`, `materializeParticipation`) creates a separate instructor-owned FI record. Deleting that copy never alters the student's source record or its verification.
9. **Views read different things:**
   - Flight detail and Print read current-revision evidence only.
   - Audit (`/flights/[id]/audit`) and the Authority Verification Report (`/flights/[id]/verification-report`, `lib/authority-verification.ts`) show the full revision and signature history, with live SHA-256 and HMAC verification status.
10. **Integrity failures surface; they are never repaired.** A mismatch is displayed or rejected, and hashes are never silently rewritten. A missing signing secret reports `unavailable`, not valid.
11. **Backups:**
    - Portable backups carry a SHA-256 payload digest. Version 12 and later are also server-signed with HMAC (`lib/backup-authenticity.ts`).
    - `validateBackupCertificationHistory()` (`lib/backup-certification.ts`) re-verifies every current and archived fingerprint, verification HMAC and void archive. It also requires the backup to belong to the same account. Recomputing the outer digest cannot forge signature evidence.
    - **Full-account restore is currently blocked unconditionally** (`lib/account-restore-containment.ts`). Backups can still be created, checked and downloaded.
12. **Migrations are idempotent** and must not rewrite certified rows to match a newer representation. Use version-aware readers and legacy fallbacks instead. Never bypass the protection triggers without a separately reviewed procedure and backup.
13. **Ownership checks:** every mutation is constrained by the `requireUser()` account ID (owner, participant or signer predicate). Object IDs alone never authorise a change.

## 4. Hard boundaries (fail closed, never claim)

- **No authority approval.** FlyTally is not approved, certified, endorsed or accepted by EASA, ÚCL/Czech CAA, LAA ČR, any other authority, a manufacturer or an operator. `lib/regulatory-validation.ts` → `regulatoryAuthorityStatuses` has `approvalClaimed: false` for every entry:
  - EASA: `REFERENCE_BASELINE`;
  - ÚCL: `EXTERNAL_VALIDATION_PENDING`;
  - LAA ČR: `SCOPE_CONFIRMATION_PENDING`.
- **"Certified" in the UI means pilot finalisation**, not authority certification. The Authority Verification Report is technical evidence, not an authority-issued certificate.
- **Signatures are not AES/QES.** The three assurance classes are in `signatureAssuranceCatalog`, each with `qes: false` and `advancedElectronicSignatureClaimed: false`:
  - FlyTally account attestation;
  - in-person handwritten capture, where the identity is entered and **not authenticated** by FlyTally;
  - server integrity binding: HMAC is integrity evidence, not a signer credential.

  Do not claim that these replace handwritten or countersignature evidence for ÚCL submissions. Adding QES would need a real trust-service architecture, not a renamed HMAC.
- **Missing evidence is never CURRENT.**
  - Only certified flights count.
  - Supervised experience counts only with current-revision signed verification.
  - Unknown helicopter type or missing movement counters give `attention` / `LIMITED DATA`.
  - A missing expiry date gives `DATE NEEDED` / `incomplete`.
  - Unknown certification versions give `unsupported`.
- **No fabricated values.**
  - Ratings are never extended automatically.
  - Night PF movements are never inferred from ULL totals.
  - Default values are never treated as approved data.
  - Auxiliary roles carry no creditable time.
  - User-declared evidence (proficiency checks, external refreshers) is labelled as user-declared; authority records remain controlling.
- **ULL / LAA scope stays separate** from Part-FCL assumptions, except for the explicit FCL.035(a)(4) credit mapping above.
- **Maps are reference only.** They are not an approved aviation chart or EFB, and they do not show active or activated airspace or NOTAMs. The openAIP overlay (`app/api/airspace-tile/...`, `lib/openaip-airspace-contract.ts` → `airspaceCapability()`) fails closed. It needs authentication, explicit deployment enablement and a verified provider contract. Map tiles are proxied server-side with provider attribution retained.
- **Training content** (see the `aviation-safety` notice in `lib/legal.ts`) is a supplemental aid, not an AFM, POH, QRH or checklist. Operational calculations must not extrapolate or interpolate beyond the governed source.

### 4.1 Brand and public claims policy (C5)

The canonical registry is `lib/brand-claims.ts` (`publicClaimRegistry`). The public page is `/legal/brand-claims`, and `/legal/regulatory` shows the authority and signature status.

| Allowed wording (within scope) | Never publish without exact external evidence |
|---|---|
| "Digital pilot logbook", "Electronic pilot logbook" | EASA / ÚCL / Czech CAA / LAA ČR approved, certified, endorsed, official or compliant |
| "FCL.050-style logbook records", "FCL.050-style record and export workflow" | "Official authority logbook" |
| "Source-backed aircraft training", "Source-backed training and reference aid" (only where provenance is kept) | Manufacturer- or operator-approved |
| | Fully or guaranteed regulator-compliant |
| | Advanced or qualified electronic signature (AES/QES) |
| | Registered trademark, `FlyTally®` (the brand status is `UNVERIFIED`) |

`unsafePublicMarketingClaims(text)` is the regex guard for these phrases, enforced by `tests/v290-brand-claims.test.ts`. "FCL.050-style" must never be shortened to "EASA-approved" or "compliant". Any future approval claim must name the exact body, product version, territory, use case, limitations and effective date, and must not exceed that scope.

### 4.2 Commercial and regulatory release gates

Several constants are deliberately `null` so that commercial or approval mode cannot be switched on through environment variables alone:
- `REGULATORY_EXTERNAL_EVIDENCE_VERSION` (`lib/regulatory-validation.ts`);
- `BRAND_CLAIMS_EXTERNAL_EVIDENCE_VERSION` (`lib/brand-claims.ts`);
- `COMMERCIAL_RELEASE_EXTERNAL_EVIDENCE_VERSION` (`lib/commercial-release-control.ts`);
- `COMMERCIAL_LEGAL_IMPLEMENTED_CONTENT_VERSION` (`lib/commercial-legal.ts`).

The gates are aggregated by `getCommercialReadiness()` (`lib/commercial-readiness.ts`) and `getCommercialReleaseAudit()` (`lib/commercial-release-audit.ts`), whose verdict is `BLOCKED`, `READY_FOR_TRANSITION` or `CLEARED`. `next.config.ts` calls `assertCommercialProductionBuildSafe()`, so a production build requesting `FLYTALLY_LAUNCH_STAGE=commercial` fails while the gate is not clear. `PENDING`, missing or unknown decision values never clear a gate.

## 5. Regulatory source snapshot

These are the references that underlie the implementation. Re-check them against current publications before relying on them.

| Source | Version referenced |
|---|---|
| Reg. (EU) No 1178/2011 (Aircrew), FCL.050 / FCL.060 / FCL.140.A/H / FCL.740.A / FCL.035 | EUR-Lex consolidated text 2026-04-30 |
| EASA Easy Access Rules for Aircrew | Revision Nov 2025 (an earlier review cited the "Feb 2026 online publication") |
| AMC1 FCL.050 | ED Decision 2025/002/R |
| Pilot logbook specimen / instructions | ED Decision 2025/022/R |
| Part-SFCL (SFCL.155, SFCL.160), Part-BFCL (BFCL.160, BFCL.200) | Rule IDs cited in code; the regulation versions were not part of the original snapshot |
| ÚCL CAA-ZLP-163 §1.11 | Electronic non-CAT logbooks are allowed in AMC1 FCL.050 form. Applications normally need signed printouts unless an electronic form is approved in advance. |
| ÚCL application guide | 26 Feb 2026 (ÚCL cloud upload of an electronic logbook does not imply acceptance of FlyTally signatures) |
| eIDAS, Reg. (EU) No 910/2014 | Art. 25 (only QES is equivalent to a handwritten signature) |
| LAA ČR / ULL | No FlyTally-specific acceptance evidence |

AMC1 FCL.050 electronic-record expectations are:
- readily available to the authority;
- containing the FCL.050 items;
- certified by the pilot;
- in a format acceptable to the authority.

Implementing the data model does not satisfy that last point; authority acceptance is still outstanding.
