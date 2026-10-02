# Flight Entry Workflow 3.0 — F3 Aircraft Context Simplification

**Status:** F3.0 DONE / VERIFIED · INDEPENDENT REVIEW REQUIRED BEFORE F3.1 RUNTIME AUTHORITY CHANGE  
**Repository baseline:** main@4e42dbf7fd095aa768e404500b141510386a18c5  
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

## 3. Authority model

F3 should distinguish authority from presentation.

### PROFILE authority

Applies to Manual New, Manual Edit after registration changes, and GPS import.

Requirements:
- active owned aircraft must exist;
- current profile must validate canonically;
- malformed/unavailable profile => Needs configuration / Save unavailable;
- client context drift is rejected rather than silently repaired;
- aircraft type/identity is profile-owned.

### SNAPSHOT authority

Applies to Manual Edit when registration remains unchanged.

Requirements:
- stored flight context remains authoritative even if current profile changed, was deactivated, or is incomplete;
- no silent profile refresh;
- unrelated edits do not mutate stored aircraft context.

### EXPLICIT OVERRIDE

Applies only after an explicit user action.

Proposed rules:
- override is explicit, never inferred from field drift;
- server validates a complete compatible flight context;
- persisted flight fields remain historical truth for that flight;
- override never mutates the aircraft profile;
- New/registration-change still requires a valid identity-bearing target profile;
- same-registration Edit may explicitly correct its stored draft/correction context independently of current profile state.

Exact override breadth is a review decision.

## 4. Server contract proposal

Use one shared aircraft-context contract, not a second flight model.

Suggested concepts:
- FlightAircraftContext: evidence, aircraftClass, regulatoryCategory, balloonClass, balloonGroup, aircraftType.
- Authority kind: PROFILE, SNAPSHOT, OVERRIDE.

The action derives base authority:
- Create => PROFILE.
- Update same registration => SNAPSHOT.
- Update changed registration => PROFILE.
- Client may request OVERRIDE but cannot claim PROFILE/SNAPSHOT authority.

For PROFILE/SNAPSHOT without override:
- submitted normalized context must equal authoritative context;
- unexplained drift fails closed.

For OVERRIDE:
- submitted context is validated explicitly;
- no value is inferred from neighboring fields.

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

### Explicit override

If retained after review:
- one explicit Change flight context / Use different context for this flight action;
- show only fields that can actually change;
- state that it changes this flight only, not the aircraft profile;
- reset deterministically to PROFILE/SNAPSHOT values.

## 7. Multi-context cases

### TMG

TMG supports Aeroplane · Part-FCL and Sailplane · SPL / Part-SFCL. F3 must not guess one from aircraft type alone.

Draft: keep a visible per-flight Regulatory context choice for TMG, with profile value as initial selection.

### OTHER

Current validator allows EASA OTHER with AEROPLANE, SAILPLANE or OTHER. This also remains explicit.

### Balloon

Balloon class/group are profile context. FREE/TETHERED remains flight-specific BFCL evidence.

## 8. Review decisions

### Decision 1 — override breadth

**Option A — narrow override**
Only regulatory-category override for multi-context classes such as TMG/OTHER. Evidence and class stay profile-owned.

Pros: strongest authority, simpler UX.  
Risk: removes existing valid flight-level logbook/class flexibility.

**Option B — explicit full regulatory override — draft recommendation**
Preserve current valid flight-level flexibility behind explicit override mode:
- evidence;
- class;
- compatible regulatory category;
- category-required balloon context.

Pros: backward-compatible with the documented F0 Manual contract; exceptions become deliberate.  
Risk: more UI/validation complexity and must never bypass an invalid profile.

**Option C — no override except historical correction**
Not recommended because F3 acceptance requires legitimate explicit flight context to remain available.

### Decision 2 — GPS override timing

**Option A:** F3 adds the same explicit common aircraft-context override to GPS; all imported parts share it. F4 later owns per-part RoleCrew inheritance/override.

**Option B:** GPS stays profile-only through F3 and gains context override in F4.

Draft recommendation: A, otherwise Manual and GPS still disagree on TMG/multi-context authority after F3.

## 9. Proposed milestones

### F3.0 — discovery / characterization / review
- freeze current Manual/GPS authority divergence;
- freeze historical snapshot behavior;
- decide override breadth and GPS timing;
- no runtime change.

### F3.1 — shared server authority contract
- add pure context comparison/resolution;
- derive PROFILE versus SNAPSHOT server-side;
- reject invalid profile and unexplained submitted drift;
- no UI simplification yet.

### F3.2 — Manual compact context UX
- valid profile => compact summary + canonical hidden fields;
- historical Edit => stored snapshot summary;
- invalid profile => Needs configuration + Save blocker;
- explicit override per reviewed decision;
- TMG/OTHER explicit handling.

### F3.3 — GPS context convergence
- reuse shared context contract;
- preserve active-profile server authority;
- add reviewed common override behavior if approved;
- GPS role remains PIC-only until F4.

### F3.4 — action / persistence regression
Cover New, Edit same registration, Edit changed registration, invalid/deactivated profile, explicit ULL, TMG Aeroplane/Sailplane, OTHER, Balloon, crafted drift, and no partial related mutations.

### F3.5 — browser / production closeout
Manual + GPS, valid/invalid profile, override, historical Edit, TMG, desktop/iPad/mobile/light/dark, docs + production evidence.

## 9.1 F3.0 verification evidence

- PR #225 merged as `4e42dbf7fd095aa768e404500b141510386a18c5`.
- Verify FlyTally web #1096 PASS: application/TypeScript gate PASS, 1084/1084 unit/regression, PostgreSQL 66/66.
- Browser smoke: N/A for F3.0 because only documentation and characterization tests changed.
- DB/schema/deploy: N/A.
- Runtime semantics remain unchanged; F3.1 is review-gated.

## 10. Acceptance criteria

F3 cannot close until:
- ordinary valid-profile entry no longer asks users to re-enter aircraft-profile schema;
- Manual New/registration-change uses server-authoritative active profile context;
- invalid profile cannot be bypassed by crafted Manual context fields;
- same-registration Edit preserves stored historical context;
- explicit override cannot be inferred from drift;
- TMG/multi-context cases stay explicit;
- GPS and Manual use the same aircraft-context authority concepts;
- certification v1–v8 and historical identity snapshots remain unchanged;
- no guessed/backfilled context is written;
- F4 receives one clear common aircraft-context contract.
