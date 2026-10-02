# Flight Entry Workflow 3.0 — F3 Aircraft Context Simplification

**Status:** F3.1 PRODUCTION CENSUS COMPLETE · A+ CONFIRMED · F3.2 RESOLVER NEXT  
**Repository baseline for F3.1:** main@82123d11480aebd0973c540a1e530f1582211f20  
**Scope:** aircraft-context authority, explicit override semantics, compact Manual/GPS presentation, historical snapshot protection. No runtime/schema/certification change in F3.0.

## 1. Goal

F3 stops presenting aircraft-profile schema as an ordinary flight-entry task while preserving explicit legitimate per-flight context and historical evidence.

Target:
- valid active profile supplies the normal flight context;
- ordinary entry shows compact evidence-bearing context instead of editable profile schema;
- invalid active profile fails closed as **Needs configuration**;
- explicit per-flight context changes are deliberate and visibly different from profile defaults;
- TMG and other multi-context cases remain explicit;
- editing an existing flight does not silently refresh its stored historical context from a mutable current profile;
- GPS and Manual converge on one aircraft-context authority model before F4.

## 2. Current repository evidence

### Canonical profile validation already exists

validateAircraftProfile() owns ULL/EASA normalization, EASA make/model requirements, class/category compatibility, TMG Aeroplane/Sailplane contexts, OTHER Aeroplane/Sailplane/Other contexts, Part-BFCL class/group applicability, and Part-FCL credit provenance.

resolveFlightEntryAircraftProfileDefaults() fails closed instead of repairing malformed profiles to ULL.

### Manual New/Edit is client-defaulted, not server profile-authoritative

FlightForm resolves the selected profile in the browser and pre-populates evidence, aircraftClass, regulatoryCategory, balloon class/group and aircraft type.

createFlight() and updateFlight() then call parseFlightInput(form) directly. They do not re-resolve the selected active aircraft profile and do not distinguish:
- profile-derived values;
- stored historical snapshot values;
- an intentional flight-level override.

A crafted Manual request can therefore submit any context accepted by the generic parser for the selected registration.

### Invalid Manual profile is visible but not an action-level Save blocker

The client computes profileNeedsConfiguration, opens Aircraft & logbook, and shows Needs configuration.

But:
- the completion blocker list does not include profileNeedsConfiguration;
- Manual actions do not revalidate the selected aircraft profile.

### GPS already has stronger authority

GPS import:
1. re-queries the active owned aircraft on the server;
2. validates the profile;
3. rejects malformed/unavailable profiles;
4. checks submitted logbook/class against canonical profile values;
5. persists server-resolved context.

F3 should converge Manual toward this authority boundary, not weaken GPS.

### Historical Edit already has the right distinction

shouldApplyAircraftProfileDefaults() is false for Edit + same registration, true for New, and true when Edit changes registration.

The database identity snapshot contract matches this:
- same-registration edits keep historical identity;
- actual registration changes snapshot the new aircraft identity;
- explicit shared historical identity survives a conflicting mutable current profile.

F3 should formalize this on the server.

## 3. Authority model — frozen after independent review

F3 distinguishes authority from presentation. The server derives authority; the client never claims PROFILE/SNAPSHOT authority and there is no generic client-sent `OVERRIDE` authority flag.

### PROFILE authority

Applies to:
- Manual New;
- Manual Edit when the final submitted registration differs from the stored registration;
- GPS import.

Manual requirements:
- an owned aircraft profile must exist;
- the profile must validate canonically;
- malformed/unavailable profile => **Needs configuration** / Save unavailable;
- submitted aircraft context must be a member of `allowedFlightContexts(profile)`;
- unexplained drift is rejected rather than silently rewritten;
- aircraft type/identity is profile-owned.

An inactive but owned/valid profile may remain usable for explicit historical Manual back-fill. Whether an inactive aircraft is normally shown in the picker is a presentation concern, not the server authority rule.

GPS keeps its existing active-owned-profile selection requirement. F3 converges semantic authority, not every source-specific selectability rule.

### SNAPSHOT authority

Applies to Manual Edit when the normalized final registration equals the normalized stored registration.

Requirements:
- stored flight context remains authoritative even if the current profile changed, was deactivated, or became invalid;
- no silent profile refresh;
- if all aircraft-context fields are unchanged, they pass through without re-validating the historical values against today's validator;
- unrelated edits therefore cannot be blocked solely because a historical row would fail a newer validator;
- an explicit context correction validates only the changed/corrected context;
- registration comparison is canonicalized at least for case and surrounding whitespace and is based on stored registration versus final submitted registration.

### Allowed multi-context selection (A+)

The broad full-regulatory override proposal is superseded.

The shared pure function `allowedFlightContexts(profile)` defines the complete set of legitimate flight contexts a valid profile may produce. Normal profiles usually yield one context. Genuine multi-context profiles may yield multiple explicit choices.

Frozen scope:
- evidence stays profile-owned;
- aircraft class stays profile-owned;
- TMG regulatory context remains an explicit per-flight choice where the profile legitimately supports Part-FCL Aeroplane versus Part-SFCL Sailplane context;
- OTHER category remains explicit through the same multi-context mechanism;
- Balloon class/group remain profile-owned;
- Balloon FREE/TETHERED remains flight-specific;
- aircraft identity/type is never a free flight-level context choice.

Same-registration historical correction is a separate SNAPSHOT correction path and is not authority granted by a client flag.

## 4. Shared server contract — frozen

Use one shared aircraft-context contract, not a second flight model.

Core concepts:
- `FlightAircraftContext`: evidence, aircraftClass, regulatoryCategory, balloonClass, balloonGroup, aircraftType;
- authority kind: PROFILE or SNAPSHOT, derived server-side;
- `allowedFlightContexts(profile)`: pure source of truth for valid PROFILE contexts;
- explicit SNAPSHOT correction detection for editable historical rows.

Server behavior:
- Create => PROFILE.
- Update with normalized stored registration == normalized final registration => SNAPSHOT.
- Update with changed final registration => PROFILE.
- GPS => PROFILE using its existing active-owned-profile selection rule.
- PROFILE submissions outside `allowedFlightContexts(profile)` fail closed.
- SNAPSHOT unchanged context is preserved byte/semantic-equivalently and is not refreshed from the current profile.
- SNAPSHOT changed context is treated as an explicit correction and validated deliberately.
- no silent drift repair, inferred neighboring values, or ULL fallback.

Scope of drift enforcement is aircraft regulatory/identity context only. Flight-level fields such as SP/MP, SE/ME, billing/rates/share defaults and other source-specific flight facts keep their existing contracts unless another milestone changes them explicitly.

## 5. Identity / type handling

F3 keeps the existing database historical identity snapshot contract.

PROFILE:
- aircraftType is profile-owned/server-checked;
- make/model/variant remain owned by the existing snapshot trigger.

SNAPSHOT:
- stored aircraft_type, make/model/variant and regulatory fields stay historical.

OVERRIDE:
- regulatory/logbook context may change explicitly;
- aircraft identity is not a free-text override.

No identity backfill.

## 6. UI target

### Valid profile

Default Manual presentation becomes compact, for example:

**Aircraft context**  
EASA · Aeroplane · SEP · OK-BID  
Profile default

Do not present Logbook/Class/Profile schema as routine editable controls.

Flight-specific fields stay explicit:
- Operation SP/MP;
- Engine SE/ME;
- balloon FREE/TETHERED;
- sailplane launch evidence;
- Role/Crew;
- route/times.

### Invalid active profile

Show:

**Needs configuration**  
This aircraft profile cannot supply a valid logbook context.

Save is blocked. Link to the Aircraft workspace. Do not manufacture replacement values.

### Historical Edit

Show:

**Stored flight context**  
EASA · Aeroplane · SEP  
Preserved from this flight

Do not label it as current-profile data.

### Multi-context choice / historical correction

Do not expose a generic full-context override.

For a valid PROFILE with more than one member of `allowedFlightContexts(profile)`:
- show only the legitimate contextual decision (TMG regulatory context / OTHER category);
- make the selection explicit and visibly flight-specific;
- reset deterministically to the profile-supported default/selection state.

For same-registration Edit:
- unchanged stored context remains a read-only historical summary;
- a deliberate correction action may expose only the fields that the correction contract actually allows;
- correction never refreshes identity from the current profile.

## 7. Multi-context cases

### TMG

TMG supports Aeroplane · Part-FCL and Sailplane · SPL / Part-SFCL. F3 must not guess one from aircraft type alone.

Draft: keep a visible per-flight Regulatory context choice for TMG, with profile value as initial selection.

### OTHER

Current validator allows EASA OTHER with AEROPLANE, SAILPLANE or OTHER. This also remains explicit.

### Balloon

Balloon class/group are profile context. FREE/TETHERED remains flight-specific BFCL evidence.

## 8. Independent-review reconciliation — frozen

Independent review verdict: **APPROVE WITH CHANGES**.

Accepted:
- broad Option B is not frozen;
- F3 uses **A+**: profile-owned evidence/class with explicit choices only for genuine multi-context profile semantics plus explicit historical SNAPSHOT correction;
- server computes the allowed-context set; no generic client authority flag;
- PROFILE drift is rejected, never silently rewritten;
- unchanged SNAPSHOT context is not revalidated against today's stricter validator;
- same-registration Edit remains independent of a mutable/inactive/invalid current profile;
- aircraft identity/type remains profile/snapshot-owned;
- read-only production census is required before runtime enforcement;
- shared-flight materialization and recipient historical identity paths are outside Manual PROFILE equality enforcement.

Reconciled differences from the reviewer:
- Manual server authority requires **owned + valid**, not necessarily active, so explicit historical back-fill on a retired aircraft is not structurally prohibited. Picker behavior may remain active-first.
- GPS keeps its existing active-profile workflow but receives the same narrow TMG/OTHER common context decision in F3. F4 still owns Role/Crew inheritance and per-part overrides.
- no new provenance schema field is introduced. Persisted flight context remains historical truth; existing audit history should be reused for corrections if it already covers those writes.

Superseded draft decisions remain documented above for traceability but do not control implementation.

## 9. Revised milestones

### F3.0 — discovery / characterization / independent review — DONE
- current Manual/GPS authority divergence characterized;
- historical SNAPSHOT behavior frozen;
- independent review completed and reconciled;
- no runtime/schema change.

### F3.1 — read-only production census + final enforcement gate — DONE
Evidence: `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F31_PRODUCTION_CENSUS.md`.

Production census found:
- 25 aircraft profiles, all active, **0 invalid** under current validator-equivalent checks;
- 289 flights, all with a current matching owned profile by normalized registration;
- 73 apparent category divergences are all certified legacy rows with blank stored `regulatory_category`;
- exactly one evidence/class divergence exists: a certified historical ULL snapshot against a profile now EASA/SEP; the profile update timestamp is later than the flight date;
- 0 explicit nonblank category mismatches;
- 7 historical identity differences against mutable current profiles, reinforcing SNAPSHOT ownership;
- no current TMG/OTHER/Balloon flight/profile population and no populated Part-FCL credit provenance.

No production evidence requires reopening A+. No migration or bulk repair is required. The census was read-only and changed no runtime/schema/certification data.

### F3.2 — pure shared authority resolver
- implement pure `allowedFlightContexts(profile)`;
- implement normalized registration/context comparison;
- derive PROFILE versus SNAPSHOT server-side;
- characterize unchanged SNAPSHOT pass-through and explicit correction detection;
- unit matrix only; not yet wired to production mutations.

### F3.3 — server enforcement + GPS authority convergence
- wire Manual create/update through the shared resolver;
- reject invalid PROFILE and crafted unexplained drift;
- preserve unchanged same-registration SNAPSHOT without current-profile validation;
- preserve shared-flight materialization/recipient paths outside this equality gate;
- wire GPS through the same authority resolver with no full regulatory override;
- add common TMG/OTHER context selection for the whole GPS import session where `allowedFlightContexts(profile)` has multiple members;
- GPS Role remains PIC-only until F4.

### F3.4 — compact context UX
- valid profile => compact context summary + canonical hidden submission fields;
- historical Edit => Stored flight context summary;
- invalid profile => Needs configuration + Save blocker;
- draft-preserving route to Aircraft configuration;
- explicit TMG/OTHER multi-context choice only;
- no generic evidence/class override UI.

### F3.5 — action/persistence/browser/production closeout
Cover at minimum:
- crafted FormData drift for each authority mode;
- registration normalization including A→B→A UI round-trip with final server comparison against stored registration;
- same-registration Edit with inactive/invalid current profile;
- legacy unchanged SNAPSHOT that fails today's validator;
- profile-changed-between-render-and-submit race;
- Quick Add followed by immediate Save;
- TMG/OTHER common Manual/GPS context;
- Balloon class/group profile ownership and FREE/TETHERED flight specificity;
- certification v1–v8 invariance;
- historical identity/shared materialization invariance;
- exact backup/restore, trash/restore, export/print/statistics/recency characterization where affected;
- desktop/iPad/mobile, light/dark browser acceptance;
- required ROADMAP / FEATURES / CHANGELOG closeout and production evidence.

## 9.1 F3.0 verification evidence

- PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`.
- Verify FlyTally web #1096 PASS: application/TypeScript gate PASS, 1084/1084 unit/regression, PostgreSQL 66/66.
- Browser smoke: N/A for F3.0 because only documentation and characterization tests changed.
- DB/schema/deploy: N/A.
- Runtime semantics remain unchanged; F3.1 is review-gated.

## 9.2 F3.1 production-census evidence

- Database inspection was read-only; no production row was mutated.
- Profile population: 25 total / 25 active / 0 invalid.
- Flight population: 289 total / 289 current-profile matches.
- Legacy blank stored regulatory category: 73 certified rows / 0 drafts.
- Explicit nonblank category mismatch: 0.
- Evidence/class mismatch against current profile: 1 certified historical snapshot; current profile was updated after the flight date.
- Historical identity differences against current profile: 7 total (4 certified / 3 draft).
- TMG/OTHER/Balloon profile/flight population: 0; populated Part-FCL credit provenance: 0 profiles.
- Runtime/schema/certification/deploy: N/A.
- A+ remains frozen; F3.2 is next.

## 10. Acceptance criteria

F3 cannot close until:
- ordinary valid-profile entry no longer asks users to re-enter aircraft-profile schema;
- Manual New/registration-change uses server-authoritative owned + valid profile context; GPS keeps its existing active-owned-profile selection requirement;
- invalid profile cannot be bypassed by crafted Manual context fields;
- same-registration Edit preserves stored historical context;
- a multi-context choice or SNAPSHOT correction cannot be inferred from drift;
- TMG/multi-context cases stay explicit;
- GPS and Manual use the same aircraft-context authority concepts;
- certification v1–v8 and historical identity snapshots remain unchanged;
- no guessed/backfilled context is written;
- F4 receives one clear common aircraft-context contract.
