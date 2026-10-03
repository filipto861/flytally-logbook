# Flight Entry Follow-up — Defaults, Day/Night Suggestions & Route UX

**Status:** E1.1 DONE / LOCAL VERIFIED · E1.2 IMPLEMENTED / VERIFICATION PENDING  
**Baseline:** `main@ee6b1d215d803aab3e4d2af12b41d61ddea06fee`  
**Decision owner:** Filip  
**Scope:** four post-closeout improvements identified from production New Flight / GPS Import use.

## 1. Requested outcomes

1. Single-pilot / multi-pilot should be preselectable from the aircraft profile.
2. GPS import should not write or show the synthetic Task value `GPS import`; historical occurrences should be cleaned up safely.
3. GPS landing evidence should be able to suggest Day vs Night from the actual event time/location instead of forcing manual classification when deterministic evidence exists.
4. The Intelligent Logbook `Continue from …` suggestion must not change the height/alignment of the Departure field versus Arrival.

These are follow-up features. Flight Entry Workflow 3.0 F0–F6 remains closed and production verified.

## 2. Repository findings

### 2.1 SP / MP is currently a flight-level value with an implicit generic SP fallback

Manual `FlightForm` currently initializes Operation with:
- stored `operation_type` when editing;
- otherwise generic fallback `SP`.

GPS currently clears Operation on aircraft selection and requires explicit SP / MP before review/save where the category uses those semantics.

Aircraft profiles already own several **defaults**, including:
- normal logbook;
- regulatory context;
- default Role;
- billing basis/share;
- pricing.

They do not currently contain an Operation default.

### 2.2 Operation is not an aircraft identity fact

SP / MP can differ for flights in the same aircraft. Therefore the aircraft profile must not become authoritative for the persisted flight operation.

Proposed contract:
- new nullable aircraft-profile field `default_operation_type` = `SP | MP | NULL`;
- it is a **default only**;
- Manual/GPS may preselect it for a new flight;
- pilot can override it per flight;
- Edit/SNAPSHOT keeps stored flight `operation_type`;
- no inference from aircraft class/type/name/history;
- no automatic backfill of existing aircraft profiles.

If an existing profile has no default:
- Manual and GPS show explicit `Select SP / MP` where applicable;
- missing is not silently interpreted as SP.

This deliberately removes the current generic Manual SP fallback.

### 2.3 Aircraft profile persistence is shared product data

Adding `default_operation_type` is an additive schema change and must be carried through:
- aircraft Add/Edit;
- Quick Add aircraft;
- flight New data query;
- GPS aircraft option;
- aircraft profile sharing/import where the canonical profile is copied;
- backup/restore and schema checks where aircraft columns are enumerated;
- tests and docs.

Tentative schema milestone: **v18**, additive nullable column, no data backfill.

## 3. GPS Task cleanup

### 3.1 New imports

Current GPS common details render:
`Task <input name="task" defaultValue="GPS import"/>`.

Decision:
- remove the GPS Task control from Common details;
- submit an empty Task for GPS unless a future explicit product requirement reintroduces it;
- Manual/Edit Task remains available under its existing optional-detail semantics.

### 3.2 Historical data is certification-sensitive

Repository verification shows `task` is part of `flightCertificationPayload()` starting with certification v1.

Therefore:
- **do not raw-update certified rows**;
- changing `task` on a certified row without the correction workflow invalidates its certification hash and violates the audit/revision contract.

Safe cleanup classes:

| Row state | Safe action |
| --- | --- |
| Draft / never certified | user-scoped exact-value cleanup `TRIM(task)='GPS import'` may clear it |
| Certified | no raw SQL update; preserve certified evidence unless the pilot explicitly opens a correction/re-certification workflow |
| Certified historical revision snapshot | never rewrite |

Before any production mutation:
- count exact-value matches by draft/certified state for the requesting account;
- create/verify backup evidence;
- show exact proposed impact;
- mutate only after explicit approval.

No cleanup of other Task values.

## 4. Day / Night landing suggestion

### 4.1 Regulatory source

For the EASA/SERA path, Implementing Regulation (EU) No 923/2012 Article 2(97) defines night as the hours between the end of evening civil twilight and the beginning of morning civil twilight. Civil twilight occurs with the centre of the sun 6 degrees below the horizon.

EASA GM1 Article 2(97) notes that evening/morning civil twilight may be promulgated for practical application by date and position.

The app must model this as **calculated source evidence / suggestion**, not as an authority override for jurisdictions that prescribe another permitted period.

### 4.2 No external daily database is required for the common EASA calculation

FlyTally already has:
- worldwide airport latitude/longitude and country in the airport catalogue;
- exact UTC timestamps and coordinates in GPS track points;
- detected final landing and touch-and-go event indices.

For GPS imports, the stronger evidence is the event itself:
- each detected T&G has track index/time/location;
- final landing has landing index/time/location.

Therefore Day/Night can be calculated from solar position at each actual event coordinate/time.

### 4.3 Proposed fail-closed contract

New pure helper:
`classifyCivilTwilightEvent({timestampUtc,lat,lon}) -> DAY | NIGHT | UNAVAILABLE`

Rules:
- DAY when solar centre altitude is >= -6°;
- NIGHT when solar centre altitude is < -6°;
- invalid/missing timestamp or coordinates => UNAVAILABLE;
- no guessed airport/timezone values;
- use UTC throughout.

For GPS review:
- calculate a suggested total `Day landings` / `Night landings` from each detected landing event;
- show provenance such as `Civil twilight calculation · GPS event time/location`;
- keep fields editable;
- changing split boundaries/track invalidates and recalculates the suggestion;
- the pilot still reviews/confirms before Save.

Do **not** silently overwrite a user-edited Day/Night value after they have changed it.

### 4.4 Scope limit for Manual entry

Manual entry generally has only aggregate landing count plus final landing time/location; it cannot safely classify multiple individual landings without per-event evidence.

First implementation should therefore be **GPS-only**.

A later Manual enhancement may suggest a single final landing when:
- total landings = 1;
- landing UTC exists;
- arrival location resolves to coordinates.

It must not distribute multiple landings between Day/Night by guess.

### 4.5 Jurisdiction caveat

SERA provides the civil-twilight definition, but Aircrew/Air Ops wording can allow an appropriate authority to prescribe another period between sunset and sunrise.

Initial release should:
- label the result as a calculated EASA/SERA civil-twilight suggestion;
- leave explicit pilot review;
- not claim universal jurisdictional authority.

If we later support jurisdiction-specific alternative definitions, that requires a first-class rule source keyed by applicability/country/date.

## 5. Continue-from layout defect

Current Intelligent Logbook behavior portals the continuation suggestion directly into the Departure `<label>`.

Result:
- Departure becomes taller;
- Arrival remains shorter;
- the two Route fields no longer align, especially on desktop.

Proposed UI contract:
- route inputs remain one aligned two-column row;
- contextual continuation / return-leg assistance renders in a dedicated full-width route-assistance row **below both fields**;
- compact on desktop; wraps naturally on mobile;
- no hover-only affordance;
- suggestion remains optional and never changes values until the pilot presses the explicit action;
- no change to suggestion logic/history semantics.

The existing `data-intelligent-review` marker remains for browser contracts.

## 6. Milestones

### E1.0 — independent review + final contract
Review:
- nullable aircraft operation default and no backfill;
- aircraft sharing/backup propagation;
- certification-safe Task cleanup;
- civil twilight algorithm/source/provenance;
- route-assistance layout.

No runtime change.

### E1.1 — Route UX + future GPS Task behavior
Low-risk batch:
- move Continue/Return assistance below the Route grid;
- remove GPS Task UI/default;
- GPS candidate/task persists empty;
- tests for Manual Task unaffected;
- no historical data mutation.

### E1.2 — Aircraft default Operation
- additive schema v18 `aircraft.default_operation_type`;
- Add/Edit + Quick Add;
- canonical profile sharing/backup/import paths;
- New Manual/GPS preselect when present;
- flight-level selector remains editable;
- existing NULL profile => explicit selection, not SP fallback;
- Edit keeps stored flight value.

### E1.3 — GPS civil-twilight landing suggestion
- pure astronomical helper;
- source-backed tests using known date/coordinate fixtures;
- GPS event-level day/night classification;
- suggestion provenance;
- user edit remains sticky;
- recalculation only when source events change.

### E1.4 — Historical `GPS import` Task cleanup
- production read-only census first;
- drafts only may be cleared directly after explicit approval;
- certified records remain untouched unless an explicit correction/re-certification plan is separately approved;
- backup/audit evidence recorded.

### E1.5 — verification / docs / production closeout
- targeted unit/source tests;
- migration/PostgreSQL tests for v18;
- TypeScript;
- full regression;
- production build;
- authenticated desktop/iPad/mobile browser coverage;
- PR/CI;
- migration deployment verification;
- production smoke;
- ROADMAP / FEATURES / CHANGELOG closeout.

## 7. Acceptance criteria

1. Selecting an aircraft with an explicit SP/MP default preselects that value in new Manual and GPS entry.
2. The pilot can change SP/MP for the individual flight.
3. Existing profiles with no default are not silently interpreted as SP.
4. GPS import no longer creates `task='GPS import'`.
5. Certified historical rows are never raw-mutated to remove Task.
6. GPS day/night suggestion is derived from each actual detected landing event and civil twilight at its UTC time/coordinate.
7. Any missing event time/coordinate fails closed to manual review.
8. User-edited Day/Night counts are never silently overwritten.
9. Continue/Return assistance no longer changes Route input alignment.
10. No certification-version change or historical rewrite is introduced incidentally.


## 8. Independent review reconciliation

Independent review returned **APPROVE WITH CHANGES**. Findings were checked against the repository and authoritative twilight definitions before implementation.

### E1-R1 — civil-twilight refraction offset / UNKNOWN proposal: partially rejected

The review correctly asked for explicit edge-case treatment, but its proposed physical model is not adopted.

Authoritative basis:
- current EASA SERA Article 2(97) defines civil twilight by the **centre of the sun's disc at 6 degrees below the horizon**;
- U.S. Naval Observatory computational guidance distinguishes sunrise/sunset, where refraction + solar radius produce the familiar 50-arcminute correction, from civil twilight, which it defines at **geometric solar-centre altitude -6°**.

Therefore:
- **no additional ~0.5° refraction/solar-disc offset** is added to the SERA -6° civil-twilight threshold;
- polar day/night is **not UNKNOWN by itself**: classification is evaluated at the event timestamp, so an event with geometric solar altitude >= -6° is DAY and < -6° is NIGHT even if no twilight crossing occurs that day;
- no root solver is required for event classification, so “near-singular twilight crossing” is not part of the core algorithm;
- invalid/non-finite timestamp/coordinates or a non-finite solar solution => UNAVAILABLE.

Before E1.3 implementation, the chosen solar-position algorithm must be verified against authoritative reference fixtures at ordinary and high latitudes. If the algorithm cannot meet the documented accuracy target near -6°, the implementation must fail closed rather than invent an arbitrary regulatory epsilon.

### E1-R2 — certified Task correction contract: accepted

When a certified flight is reopened specifically to clear `task='GPS import'`:
1. the previous certified revision snapshot retains the original Task;
2. the reopened row may be corrected through the existing correction workflow;
3. re-certification recomputes the certification payload/hash with the corrected Task, including empty string;
4. the correction reason remains first-class audit evidence;
5. no cleanup migration/script bypasses that workflow.

E1.4 must include an integration test proving the old snapshot retains `GPS import` and the new certified revision contains an empty Task.

### E1-R3 — Operation validation: accepted with certification nuance

`default_operation_type` remains a nullable profile **default**, never aircraft authority.

For SP/MP-capable EASA contexts:
- New Manual with profile default SP/MP: preselect it.
- New Manual with profile default NULL: show explicit `Select SP / MP`; draft Save may remain incomplete, storing empty operation rather than inventing SP.
- Certification remains fail-closed because existing FCL.050 compliance requires explicit SP/MP.
- GPS with profile default NULL: explicit SP/MP remains required before GPS save.
- GPS with profile default SP/MP: preselect it, but the pilot may override it per flight.
- Edit/SNAPSHOT: stored flight operation remains authoritative; current profile default is not applied.

For categories where SP/MP is not an applicable visible control, existing category-specific canonical behavior remains unchanged.

### E1-R4 — default_operation_type propagation checklist: accepted

E1.2 must explicitly verify NULL/SP/MP propagation through:
1. Aircraft Add/Edit;
2. Quick Add aircraft;
3. New Flight aircraft query/initializer;
4. GPS aircraft option;
5. aircraft profile sharing/import/export serialization that copies canonical profile fields;
6. backup/restore;
7. additive/idempotent schema migration and schema-version checks;
8. recency/certification consumers — profile default must never substitute for stored flight operation.

Unknown persisted/imported values must fail closed; they are not coerced to SP.

### E1-R5 — route-assistance accessibility: accepted

Dedicated route assistance row contract:
- sits after Departure + Arrival in DOM order;
- `aria-live="polite"`;
- explicit action is a real button;
- focus is not programmatically stolen when the suggestion appears;
- no document horizontal overflow;
- Departure/Arrival input boxes retain equal row alignment at desktop/iPad widths;
- mobile wraps below the fields without overlap.

### E1-R6 — final landing coordinate precedence: accepted with correction

Primary source is always the detected event track coordinate.

Aerodrome-coordinate fallback is permitted only if:
- the event timestamp is valid;
- the arrival aerodrome resolves unambiguously to a valid coordinate;
- the track event lacks a valid coordinate.

No invented “aerodrome reference time” exists in the current data model, so the review's proposed ±2-minute comparison to an aerodrome reference time is not adopted. If the event coordinate is unavailable and aerodrome fallback would materially change applicability, UI provenance must say the aerodrome coordinate was used.

### E1-R7 — jurisdiction/provenance copy: accepted

Initial GPS Day/Night suggestion copy must identify:
- EASA/SERA civil-twilight basis;
- GPS event UTC/location (or explicit aerodrome-coordinate fallback);
- pilot confirmation required;
- calculated suggestion is not represented as universal jurisdictional authority.



## 10. E1.2 implementation contract

Repository implementation resolves the Operation-default model as follows:

- `aircraft.default_operation_type` is added by schema migration v18 as nullable text constrained to `SP`, `MP` or SQL NULL;
- migration v18 performs **no UPDATE/backfill** on existing aircraft;
- `flights.operation_type` is deliberately unchanged from the existing persisted schema. For an applicable Manual draft with no selected/default Operation, FlyTally stores the existing draft representation `''` rather than inventing SP or changing the flight schema to nullable;
- FCL.050 certification already rejects anything other than explicit SP/MP, preserving fail-closed certification semantics;
- GPS remains stricter at Save: applicable GPS imports cannot save until SP/MP is resolved;
- Edit/SNAPSHOT does not apply the current aircraft profile default over stored flight evidence.

Propagation implemented:
1. Aircraft Add/Edit — explicit optional Default operation;
2. Quick Add aircraft — same optional field, default blank;
3. New Flight aircraft query — carries `default_operation_type`;
4. GPS aircraft option — preselects valid profile default but keeps required per-flight control;
5. aircraft one-time sharing — new snapshots carry the field; malformed values fail closed;
6. account backup/restore — current schema row is exported/restored exactly;
7. schema migration — additive/idempotent v18 with DB CHECK and no backfill;
8. recency/certification — no consumer reads the aircraft default as flight evidence.

Backward compatibility:
- a legacy pending aircraft share whose snapshot predates `defaultOperationType` leaves an existing recipient aircraft default unchanged when Flight defaults are imported;
- a new snapshot that explicitly contains `defaultOperationType:""` means the sender intentionally has no default and may clear the recipient default to NULL if the recipient chooses to import Flight defaults.

E1.2 does not change certification version/hash, historical flights, recency rules or aircraft applicability authority.

## 9. E1.1 implementation freeze after review

E1.1 may now proceed with only:
- Route assistance relocation + accessibility contract;
- future GPS Task behavior: remove the visible/common `Task = GPS import` control and submit empty Task for newly imported flights;
- regression tests proving Manual/Edit Task semantics remain unchanged;
- **no historical data cleanup in E1.1**.

E1.2/E1.3/E1.4 remain separately gated by their schema/aviation/data-integrity requirements.
