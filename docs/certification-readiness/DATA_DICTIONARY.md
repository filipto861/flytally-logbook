# FlyTally Data Dictionary

Version: 1.33.0

This dictionary describes the principal fields used by the current Next.js production application. It focuses on fields that affect the pilot logbook, certification integrity, revision history and instructor verification.

## Flight identity

| Field | Meaning | Source | Protected after certification |
|---|---|---|---|
| `id` | Internal immutable flight identifier | Database | Yes, part of certification payload |
| `user_id` | Owner of the pilot logbook record | Authenticated session | Yes, part of certification payload |
| `date` | Date of flight | Pilot/import | Yes |
| `evidence` | Logbook scope, normally `EASA` or `ULL` | Pilot/aircraft profile | Yes |
| `registration` | Aircraft registration | Pilot/aircraft profile/import | Yes |
| `aircraft_make` | Aircraft manufacturer | Aircraft profile | Yes |
| `aircraft_model` | Aircraft model | Aircraft profile | Yes |
| `aircraft_variant` | Optional variant | Aircraft profile | Yes |
| `aircraft_type` | Legacy/display type field | Aircraft profile | Yes |
| `aircraft_class` | FlyTally class category such as SEP, TMG, ULL, MEP | Aircraft profile | Yes |

## Route and time

| Field | Meaning | Source | Protected after certification |
|---|---|---|---|
| `departure` | Departure aerodrome/location | Pilot/GPS detection | Yes |
| `arrival` | Arrival aerodrome/location | Pilot/GPS detection | Yes |
| `off_block` | Block-off time | Pilot/GPS import | Yes |
| `takeoff` | Take-off time | Pilot/GPS import | Yes |
| `landing` | Landing time | Pilot/GPS import | Yes |
| `on_block` | Block-on time | Pilot/GPS import | Yes |

FlyTally derives block and air durations from these stored time values where required. Derived display values are not themselves the authoritative certification inputs unless explicitly included in the certification payload.

## Operational conditions

| Field | Meaning |
|---|---|
| `operation_type` | Single-pilot or multi-pilot operation classification used by print/totals |
| `engine_type` | Single-engine or multi-engine classification used by print/totals |
| `landings_day` | Day landings |
| `landings_night` | Night landings |
| `night_minutes` | Night flight time |
| `ifr_minutes` | IFR flight time |

## Pilot function

| Field | Meaning |
|---|---|
| `role` | Primary FlyTally role for the owner's record, e.g. PIC, DUAL, FI, SPIC, PICUS |
| `pic_minutes` | Credited PIC time |
| `copilot_minutes` | Credited co-pilot time |
| `dual_minutes` | Credited dual instruction time |
| `instructor_minutes` | Credited FI/FE time |
| `commander` | Name recorded as pilot in command where applicable |
| `instructor` | Instructor/supervising-pilot name field where applicable |

A single physical flight can create separate logbook records for different users. One user's record is never treated as the mutable shared master for all pilots.

## Remarks and structured purpose

| Field | Meaning |
|---|---|
| `task` | Training/exercise/task text |
| `note` | Free-form remarks |
| `verification_name` | Legacy/manual verification name field where applicable |
| `verification_reference` | Legacy/manual verification reference |
| `purpose_code` | Structured purpose identifier. Current regulatory-adjacent value: `LAPL_FCL140A_REFRESHER` |

For certification format v3, `purpose_code` is part of the protected certification payload. Legacy text recognition remains only for older records where the structured code did not exist.

## Certification fields

| Field | Meaning |
|---|---|
| `record_revision` | Logical revision number of the owner's record |
| `certified_at` | Timestamp when the current revision was pilot-certified |
| `certification_hash` | SHA-256 fingerprint of the canonical certification payload |
| `certification_version` | Version of the canonical payload format used for the fingerprint |
| `correction_reason` | Reason supplied when opening a correction |
| `locked_at` | Lock state; certified records are protected independently by database trigger |

Certified revisions are preserved in `flight_certified_revisions` before a correction becomes editable.

## Archived certified revisions

`flight_certified_revisions` stores:

- flight and owner identifiers;
- revision number;
- certification hash and format version;
- certification/supersession timestamps;
- correction reason;
- full JSON snapshot of the certified record.

The archive exists so an older certified revision remains reconstructable and verifiable after later corrections.

## Participation workflow

`flight_participations` represents another person's relationship to a source flight. Important fields include:

- `source_flight_id`, `source_user_id` — source pilot record;
- `participant_user_id` — connected participant;
- `participant_role` — role of that participant;
- `source_revision`, `source_hash` — exact certified revision requested/shared;
- `status` — request/workflow state;
- `participant_flight_id` — optional separate logbook record created for the participant.

A participant's own logbook entry is separate from the source pilot's record.

## Verification evidence

`flight_verifications` represents signed evidence bound to one exact certified revision.

| Field | Meaning |
|---|---|
| `flight_id`, `flight_user_id` | Source pilot record and owner |
| `signer_user_id` | FlyTally signer account; null for in-person same-device signature |
| `verification_role` | Instructor, supervising PIC or other supported verification role |
| `record_revision` | Exact revision signed |
| `flight_hash` | Exact certification SHA-256 signed |
| `credential_snapshot` | Identity/credential information captured at signing time |
| `payload_hash` | Bound flight hash retained with evidence |
| `server_signature` | HMAC-SHA-256 over canonical verification payload |
| `status` | Signed, revoked or another historical state |
| `signed_at`, `revoked_at` | Evidence timestamps |
| `revocation_reason` | Reason retained if a signature is revoked |

## Data not treated as regulatory certification inputs

GPS tracks, map styling, aircraft hourly rates, cost calculations, dashboard configuration and similar convenience data are not automatically part of the flight certification fingerprint unless explicitly added to a future certification-payload version.

Any future change to protected-field coverage must increment or otherwise preserve compatibility of the certification payload format so older certified records remain verifiable.
