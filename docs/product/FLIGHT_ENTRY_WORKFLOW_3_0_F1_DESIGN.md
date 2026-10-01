# Flight Entry Workflow 3.0 — F1 Shared Normalization Design Draft

**Status:** INDEPENDENT REVIEW COMPLETE · APPROVE WITH CHANGES · RECONCILED DESIGN  
**Baseline:** `main@1fb1b4edb051b3ce8d052a50401916cb2cbc78b8`  
**Dependency:** F0 field/consumer matrix DONE/verified.

## 1. F1 objective

F1 removes the structural condition that lets Manual New/Edit and GPS New assign different semantic meaning to equivalent flight records.

F1 is **not** the Role/Crew parity milestone and is **not** the final UX simplification milestone.

The target is one server-side normalization boundary:

```
Manual FormData ─┐
                 ├─> source adapter ─> FlightDraftCandidate ─> normalizeFlightDraft() ─> FlightInput
GPS reviewed part┘
```

`FlightInput` remains the canonical normalized semantic record used by persistence.

## 2. Frozen non-goals

F1 must not:

- broaden GPS beyond PIC;
- add Safety Pilot / DUAL / SPIC / PICUS GPS semantics;
- change certification payload v1–v8;
- rewrite historical rows;
- infer missing old GPS evidence;
- fold GPS tracks, expenses or connected-account links into the flight semantic payload;
- redesign the entire New Flight UI;
- change recency rules;
- introduce a second aircraft model.

F2 remains the owner of full Role/Crew parity.

## 2A. Independent-review reconciliation

Independent review returned **APPROVE WITH CHANGES**.

Accepted blocking changes:
- F1.0 becomes a prerequisite hotfix for the shared-flight identity trigger before shared normalization can close.
- F1 release cannot ship while GPS silently assumes `Operation=SP` or derives Engine from aircraft class.
- GPS sailplane/movement/night/IFR gaps remain explicit unresolved evidence; generic GPS motion is not authority for those facts.
- F1 must not claim complete Role/Crew authority; F2 still owns DUAL/Safety Pilot/SPIC/PICUS completeness.
- `FlightDraftCandidate` stays minimal and can express unresolved semantic state.
- source provenance remains explicit but separate from the canonical persisted value.
- connection validation, persistence, tracks and post-save actions stay outside the pure normalizer.

Repository reconciliation:
- the current aircraft profile model has no authoritative stored `operation_type` / `engine_type` defaults to resolve the GPS gap;
- therefore class-derived Engine is not a valid future F1 authority;
- exact backup restore stages identity blank and later restores the historical tuple explicitly, so the proposed same-registration trigger preservation does not conflict with the restore write sequence.

## 3. Proposed domain layers

### Layer A — source adapters

Adapters convert source-specific state into a typed `FlightDraftCandidate`.

They may:
- copy explicit pilot input;
- copy authoritative aircraft-profile context;
- copy reviewed GPS suggestions;
- preserve explicit empty/unavailable state.

They may **not** invent a regulatory fact merely to satisfy a field.

Proposed adapters:
- `manualFlightCandidate(form: FormData)`;
- `gpsFlightCandidate(common, reviewedPart, profile)`.

### Layer B — canonical normalizer

Extract the semantic body of current `parseFlightInput()` into a source-agnostic pure function:

```ts
type FlightDraftCandidate = {
  date: unknown;
  registration: unknown;
  evidence: unknown;
  aircraftType?: unknown;
  aircraftClass: unknown;
  regulatoryCategory?: unknown;
  balloonClass?: unknown;
  balloonGroup?: unknown;
  balloonOperation?: unknown;
  launchMethod?: unknown;
  launches?: unknown;
  departure?: unknown;
  arrival?: unknown;
  offBlock?: unknown;
  takeoff?: unknown;
  landing?: unknown;
  onBlock?: unknown;
  landingsDay?: unknown;
  landingsNight?: unknown;
  movementEvidenceRecorded?: unknown;
  takeoffsDay?: unknown;
  takeoffsNight?: unknown;
  approachesDay?: unknown;
  approachesNight?: unknown;
  operationType?: unknown;
  engineType?: unknown;
  operatorName?: unknown;
  flightNumber?: unknown;
  operationContext?: unknown;
  nightTime?: unknown;
  ifrTime?: unknown;
  commander?: unknown;
  instructor?: unknown;
  role: unknown;
  verificationName?: unknown;
  verificationReference?: unknown;
  task?: unknown;
  purposeCodes?: unknown[];
  billingBasis?: unknown;
  billingShare?: unknown;
  note?: unknown;
};
```

The exact type can be refined during implementation. The invariant matters more than the spelling: one pure semantic function receives explicit candidate state and returns either canonical `FlightInput` or a domain error.

For source-authority-sensitive fields, the candidate must be able to represent an explicit unresolved state instead of overloading empty string or a guessed default. At minimum this applies to aircraft context, Operation, Engine and later Role/Crew contexts. Keep provenance compact (for example source metadata alongside candidate construction) rather than turning `FlightInput` into a provenance object.

### Layer C — compatibility wrapper

Keep:

```ts
parseFlightInput(form: FormData)
```

as a stable compatibility API for current Manual callers/tests. It becomes:

```
FormData -> manualFlightCandidate() -> normalizeFlightDraft()
```

This minimizes blast radius and lets F1 prove Manual regression equivalence before routing GPS through the same normalizer.

### Layer D — persistence

F1 does **not** need to force Manual and GPS into one SQL transaction implementation.

Manual has expenses/connected-crew child writes; GPS has N-part atomic flight+track writes and sorted advisory locks.

The requirement is:

> every `flights` semantic value written by Manual or GPS must come from the same normalized `FlightInput` contract.

GPS may retain its atomic CTE persistence shape if every part is normalized first and the INSERT consumes normalized fields rather than reconstructing semantics independently.

## 4. Source provenance boundaries

Keep these outside `FlightInput`:

| Data | Why separate |
| --- | --- |
| GPS KML/GPX/CSV coordinates, source label, distance | source evidence / child track domain |
| Flight expenses | child commercial records, separately validated |
| `flight_connected_crew` | account linkage/collaboration metadata; historical commander text remains on flight |
| certification/lock metadata | lifecycle evidence created only by certification/correction workflows |
| participation/verifications | cross-user evidence tied to exact revision/hash |

This separation prevents F1 from turning provenance into hidden flight defaults.

## 5. Normalization rules F1 should preserve

Unless an explicit approved correction below applies, extracting the pure normalizer must preserve current Manual behavior:

- date/time syntax and block/AIR/taxi bounds;
- canonical evidence/class/role/billing validation;
- regulatory-category compatibility;
- balloon class/group/operation validation;
- current sailplane launch handling;
- category-aware credited time;
- structured movement handling;
- SPIC/PICUS countersignature requirement;
- role-derived function-time allocation;
- professional-context validation;
- purpose/task normalization;
- note and text length limits.

The first implementation batch should be characterization/refactor only: Manual tests must remain equivalent before GPS is touched.

## 6. GPS F1 candidate contract

GPS remains PIC-only.

For every reviewed part, the adapter should explicitly provide:

### Common across parts
- selected registration;
- canonical active-profile evidence/class/regulatory/balloon context;
- aircraft type;
- role = PIC;
- billing choice/share;
- task;
- any common operation/engine values that are actually explicit or authoritatively resolved.

### Per part
- reviewed date;
- reviewed route;
- reviewed four times;
- reviewed landing/take-off evidence currently supported by the UI;
- note;
- source-derived time used only through the same normalizer;
- price remains a server persistence derivation from part date + billing choice.

The adapter must not populate unsupported semantic fields merely to make normalization pass.

## 7. Newly exposed F1 correctness question: Operation / Engine

Current Manual UI exposes Operation (SP/MP) and Engine (SE/ME) for applicable categories.

Current server parser has compatibility fallbacks:
- invalid/missing operation -> `SP`;
- invalid/missing engine -> class-based `defaultEngineType()`.

Current GPS direct write:
- forces `SP`;
- uses class-based `defaultEngineType()`.

F0 shows this is not just an implementation detail:
- SP/MP changes printed/statistical flight classification;
- current EASA certification validates explicit SP/MP;
- Co-pilot/CRCP require MP;
- a generic Helicopter class does not prove single-engine;
- PIC can exist in multi-pilot operations.

### Reconciled F1 direction

Do **not** make source-agnostic normalization depend on a hidden GPS `SP` assumption.

For EASA GPS, Operation and Engine become explicit semantic candidate values. The current aircraft profile does not contain authoritative Operation/Engine defaults, therefore F1 cannot resolve these from profile today.

Release policy:
1. F1.1–F1.4 may refactor/characterize without changing current GPS UX.
2. Before F1 is releasable, F1.5 must add compact common GPS controls for **Operation: SP/MP** and **Engine: SE/ME** for applicable EASA contexts.
3. If either value is unresolved at submit time, GPS Save fails closed with Needs configuration / explicit correction; the normalizer never supplies SP or class-derived Engine as an implicit answer.
4. Non-EASA behavior remains governed by its existing explicit domain rules; no new inference is introduced.

This resolves the review ambiguity in favor of explicit controls rather than making normal EASA GPS import unusable by default.

## 8. Sailplane / movement gaps

F1 must not solve source-fidelity gaps by fabrication.

Current GPS lacks:
- non-TMG sailplane launch evidence;
- ordinary Part-FCL PF checkbox/approaches;
- TMG explicit take-off evidence;
- day/night classification;
- night/IFR.

Safe default policy:
- absence of positive regulatory evidence may under-credit a draft;
- it must never create positive recency evidence;
- if a field is required for current Certification, Certification may continue to block until the user explicitly supplies it;
- if a field is required by the final Save contract for that category, the source must expose an explicit input or the source must fail closed.

F1 should not silently broaden these features. F4 remains the owner of multi-part common/override UX.

## 9. DUAL gap stays visible

F0 confirmed:
- Manual UI marks EASA DUAL Instructor/PIC required;
- Certification requires it;
- `parseFlightInput()` itself does not independently reject a crafted DUAL Save with blank instructor.

F1 extraction must not accidentally erase or conceal this finding.

Preferred ownership remains F2, where all Role/Crew Save semantics move to one authoritative server contract. If extracting the normalizer makes this rule trivial to add safely, it still requires an explicit F2 decision/test rather than incidental tightening.

## 10. Aircraft identity trigger / sharing integrity gate

F1 core normalization does not need a schema migration.

However F0 found a separate historical-identity risk:

- ordinary Manual/GPS INSERTs rely on `logbook_snapshot_aircraft_identity()` to populate make/model/variant;
- shared-flight acceptance explicitly supplies the certified source flight's make/model/variant;
- the same BEFORE INSERT trigger can replace those explicit values with recipient current-profile identity for the registration.

### Required F1.0 integrity fix before F1 normalization implementation

Use a new idempotent schema migration rather than editing the already-applied v6 migration in place.

Proposed trigger semantics:

- **INSERT**
  - when an explicit historical identity tuple is supplied, preserve it;
  - otherwise resolve missing identity from current aircraft profile;
- **UPDATE OF registration**
  - resolve identity for the new registration so an editable draft changing aircraft cannot retain the old registration's snapshot;
- **UPDATE without registration change**
  - do not refresh historical identity from mutable current profile.

The identity tuple is atomic:
- if **all three** supplied identity fields are empty/null, resolve the tuple from current profile;
- if **any** identity field is supplied, preserve the supplied tuple exactly and do not mix missing members from current profile.

Existing Manual/GPS inserts currently leave snapshot columns empty and therefore continue to resolve from profile. Shared-flight inserts explicitly supply the source tuple and will preserve it.

Exact backup restore remains compatible: it intentionally stages the inserted flight with an empty identity tuple, then performs a separate same-registration UPDATE that explicitly restores make/model/variant. The identity trigger only fires on INSERT or UPDATE OF registration, so that second restore step remains authoritative.

This must be a new base migration (v17), not a rewrite of v6.

## 11. F1 implementation plan

### F1.0 — shared-flight identity trigger hotfix — DONE / VERIFIED
- base migration v17 added;
- INSERT with empty identity tuple resolves current profile;
- INSERT with any explicit identity member preserves the supplied tuple atomically;
- UPDATE with changed registration resolves the new profile identity;
- same-registration UPDATE preserves historical identity;
- PostgreSQL acceptance covers Manual/GPS-style insert, explicit snapshot, sharing, registration change, exact restore sequence and certification compatibility.
- Verification: final PR head Verify #997 PASS; 992/992 unit; PostgreSQL 76/76; Browser #378 26 passed / 2 skipped; production build PASS.
- Production: main `e7361dbe…`, Vercel READY, migration v17 confirmed in the production Neon registry and live trigger definition verified. F1.0 deployment gate is closed.

### F1.1 — candidate types + source adapters — DONE / VERIFIED
- added minimal typed `FlightDraftCandidate` with compact provenance and explicit unresolved semantic state;
- added Manual FormData characterization preserving presence-sensitive fields;
- added GPS reviewed-part characterization that does not infer Operation/Engine, day/night movements, Part-FCL PF/approach evidence, sailplane launches, night or IFR;
- adapters are intentionally not imported by current Manual/GPS mutation runtime yet;
- Verification: Verify #998 PASS; 998/998 unit/regression; PostgreSQL 63/63; Browser #379 26 passed / 2 skipped; production build PASS; DB migration N/A.

### F1.2 — pure normalizer extraction — DONE / VERIFIED
- extracted source-agnostic `normalizeFlightDraft(candidate)` from the semantic body of `parseFlightInput()`;
- `parseFlightInput(FormData)` now delegates through `manualFlightCandidate()`;
- the normalizer contains no DB, auth or FormData dependency;
- explicit unresolved candidate values return domain errors instead of guessed defaults;
- Manual date/time, evidence/class/category, billing, sailplane, balloon, movement, SPIC/PICUS, professional, purpose/task and function-time semantics remain regression-equivalent;
- Verification: Verify #1007 PASS; TypeScript PASS; 1006/1006 unit/regression; PostgreSQL 63/63; Browser #388 26 passed / 2 skipped; production build PASS; DB migration N/A.
- GPS mutation persistence is intentionally still not routed through the normalizer.

### F1.3 — Manual wrapper regression — DONE / VERIFIED
- proved Manual create/update each enter through `parseFlightInput(FormData)` and do not bypass it with direct candidate/normalizer calls;
- proved normalized `FlightInput` fields feed both create INSERT and update SET contracts;
- preserved expenses as a separately validated child domain;
- preserved connected Actual-PIC validation/linkage outside the pure normalizer;
- preserved create duplicate fingerprint/advisory lock and update lock/price-history boundaries;
- GPS remains intentionally outside this Manual proof until F1.4;
- Verification: Verify #1013 PASS; TypeScript PASS; 1014/1014 unit/regression; PostgreSQL 63/63; Browser N/A; DB migration N/A.

### F1.4 — GPS semantic adapter / persistence convergence

#### F1.4A — normalization adapter / preparation
- resolve each reviewed PIC part into candidate state;
- expose explicit input slots for every source-sensitive semantic value needed by the shared normalizer;
- prove unresolved values fail closed;
- do **not** activate the new path in `importKmlFlight()` while required source authority is still unavailable.

#### F1.4B — production persistence activation
- after F1.5/F1.6 satisfy the required source-authority inputs, pass every semantic flight value through the shared normalizer;
- retain atomic N-part SQL/track transaction, sorted advisory locks and duplicate protection;
- remove the hand-written GPS semantic mapper where the shared normalized value exists.

This split is a dependency correction, not a change in target architecture. Activating F1.4 before F1.5/F1.6 would either break ordinary EASA GPS imports or reintroduce guessed regulatory facts, both of which violate the independent-review freeze.

### F1.5 — explicit GPS Operation / Engine
- add compact common SP/MP + SE/ME controls for applicable EASA GPS imports;
- unresolved values fail closed;
- no class-derived Engine and no hidden SP default in the shared GPS path.

### F1.6 — source-fidelity + cross-path closeout
- sailplane/movement/night/IFR evidence is explicit or remains unavailable; never inferred from generic movement;
- equivalent Manual/GPS PIC semantics tested where both sources provide equivalent facts;
- preserve v1–v8 verification and certified-only recency;
- ROADMAP/FEATURES/CHANGELOG closeout + browser/production smoke for runtime changes.

## 12. Do / Do not

### Do
- small commits/batches;
- prove Manual parity before GPS conversion;
- use one semantic normalizer;
- keep source provenance separate;
- fail closed unsupported semantics;
- preserve atomic GPS persistence;
- keep certification and recency boundaries untouched.

### Do not
- rewrite certified history;
- infer crew from names;
- infer PF/night/launch evidence from generic GPS movement;
- broaden GPS roles in F1;
- change v1–v8 hash payloads;
- edit an already-applied migration as the production fix for the sharing trigger;
- combine F1 with general UX cleanup.

## 13. Review closeout

Independent review is complete and reconciled.

Final decisions:
1. candidate → pure normalizer → `FlightInput` remains the architecture;
2. `parseFlightInput(FormData)` remains a compatibility wrapper;
3. EASA GPS receives explicit common SP/MP + SE/ME controls before F1 release;
4. unresolved Operation/Engine fails closed;
5. shared-flight trigger fix is **F1.0**, before semantic normalization work is allowed to close;
6. identity tuple preservation is atomic and implemented by a new v17 migration;
7. F1 does not claim complete Role/Crew authority before F2;
8. GPS stays PIC-only;
9. N-part persistence remains atomic and specialized only for persistence/provenance, not semantic meaning.

Runtime implementation may begin with **F1.0 only**, followed by the ordered F1.1–F1.6 batches.
