# FCL.050-Oriented Compliance Matrix

Version: 1.33.0

Purpose: map the current FlyTally implementation to common pilot-logbook record concepts associated with FCL.050. This is an engineering traceability document, not a legal determination that FlyTally satisfies every competent-authority requirement.

| Record concept | FlyTally implementation | Evidence / screen | Current limitation / authority point |
|---|---|---|---|
| Date | `flights.date` | Flight detail, print/export | Stored as legacy text-compatible date representation |
| Departure place/time | `departure`, `off_block` | Flight detail, FCL.050 print | Pilot/GPS-derived; user reviews before certification |
| Arrival place/time | `arrival`, `on_block` | Flight detail, FCL.050 print | Same as above |
| Aircraft type/registration | aircraft identity fields + registration | Aircraft profile, print identity key | ICAO/display type is separated from full make/model/variant |
| Single-/multi-pilot time | `operation_type`, `engine_type`, calculated block allocation | Print columns | Classification depends on correctly maintained aircraft/flight data |
| Total flight time | derived from block times for logbook print | Dashboard, flight detail, print | Calculation rules should remain consistent across views |
| PIC identity | `commander` plus role-aware print logic | Flight detail, print | For DUAL training, instructor/PIC identity must not be replaced by student identity |
| Day/night landings | `landings_day`, `landings_night` | Flight detail, print | Pilot remains responsible for correct entry |
| Night/IFR | `night_minutes`, `ifr_minutes` | Flight detail, print | Pilot-entered/import-assisted |
| Pilot function time | PIC/co-pilot/DUAL/FI minute fields | Flight detail, totals, print | Role allocation is validated by FlyTally rules but remains dependent on correct operational classification |
| FSTD | separate `fstd_sessions` records | FSTD page, print | Separate certification lifecycle from flights |
| Remarks/endorsements | `task`, `note`, verification markers | Flight detail, print | Structured purpose is used where implemented; free text remains available |
| Pilot certification | certification timestamp + SHA-256 fingerprint + DB immutability | Flight status, audit report | "Certification" is FlyTally record finalisation, not authority approval |
| Correction history | revision archive + correction reason | Audit report | Current revision and every preserved certified revision are distinct |
| Instructor verification | `flight_verifications` bound to revision/hash | Flight detail, Connections, audit, verification report | Same-device handwritten identity is not independently authenticated by FlyTally |
| Revocation | verification status + timestamp + reason | Connections/audit/report | Revocation preserves historical evidence rather than deleting it |
| ULL/EASA separation | `evidence` plus print scope filters | Print & Data | Combined print changes filtering, not the FCL.050-style layout |
| LAPL recency support | rolling 24-month calculation, structured refresher purpose, signed FI verification | Licences | Regulatory interpretation remains subject to competent-authority confirmation; relevant ULL time is handled under current Czech guidance logic |

## Certification traceability

For flight certification format v3, the canonical payload includes:

- owner/user and flight identifiers;
- record revision and correction reason;
- date and evidence scope;
- aircraft identity/class;
- departure/arrival and stored times;
- operation and engine classification;
- day/night landings, night and IFR minutes;
- pilot-function time and named PIC/instructor fields;
- remarks/task/verification text fields;
- structured `purpose_code`.

The resulting SHA-256 is stored as `certification_hash`. Older certification payload versions remain versioned so the hash is recalculated with the original historical shape rather than the latest one.

## Items for competent-authority discussion

The following are intentionally not presented by FlyTally as settled regulatory conclusions:

1. whether a particular electronic presentation/print layout is accepted in lieu of a traditional paper logbook in every use case;
2. the level of electronic-signature assurance expected for instructor endorsements;
3. whether same-device handwritten signature evidence is acceptable and under what identity-verification conditions;
4. retention/export expectations if the service becomes unavailable;
5. exact evidence format an authority would prefer during ramp/check/administrative review;
6. any national interpretation that goes beyond the software's current implementation.
