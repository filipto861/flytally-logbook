# Flight Entry Follow-up — Defaults, Day/Night Suggestions & Route UX

**Status:** DISCOVERY / DESIGN COMPLETE · INDEPENDENT REVIEW REQUIRED BEFORE RUNTIME OR DATA CHANGES  
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
