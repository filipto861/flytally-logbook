# Flight Entry Workflow 3.0 — F1 Shared Normalization Design Draft

**Status:** DRAFT FOR INDEPENDENT REVIEW · NO RUNTIME CHANGE  
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

### Recommended F1 direction

Do **not** make source-agnostic normalization depend on a hidden GPS `SP` assumption.

For FCL-style EASA categories, F1 should make Operation and Engine explicit candidate values. Manual already supplies visible controls. GPS should either:
1. expose compact common Operation/Engine controls before Save; or
2. fail closed when those values are unresolved.

For category branches where Operation/Engine are compatibility-only and certification does not use them, preserve the current encoded values without presenting them as regulatory authority.

Independent review is requested before freezing which UI option is used.

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

### Recommended integrity fix before F1 closeout

Use a new idempotent schema migration rather than editing the already-applied v6 migration in place.

Proposed trigger semantics:

- **INSERT**
  - when an explicit historical identity tuple is supplied, preserve it;
  - otherwise resolve missing identity from current aircraft profile;
- **UPDATE OF registration**
  - resolve identity for the new registration so an editable draft changing aircraft cannot retain the old registration's snapshot;
- **UPDATE without registration change**
  - do not refresh historical identity from mutable current profile.

A practical implementation candidate is to treat a non-empty supplied make/model/variant tuple on INSERT as an explicit snapshot. Existing Manual/GPS inserts currently leave those snapshot columns empty and therefore continue to resolve from profile.

This migration requires independent review and dedicated PostgreSQL acceptance tests before implementation.

## 11. F1 implementation plan

### F1.1 — pure normalizer extraction
- introduce typed candidate + pure normalizer;
- keep `parseFlightInput(FormData)` wrapper;
- no expected behavior change;
- existing Manual tests + new equivalence tests.

### F1.2 — Manual create/update proof
- prove create/update both consume normalized `FlightInput`;
- no persistence/schema change;
- preserve expenses and connected PIC child semantics.

### F1.3 — GPS candidate adapter
- resolve each reviewed part into candidate state;
- pass through shared normalizer;
- retain F0.1 aircraft fail-closed + PIC-only role;
- resolve Operation/Engine design question before merge.

### F1.4 — GPS persistence convergence
- direct INSERT consumes only normalized part values plus persistence-only derived price/track data;
- preserve sorted advisory locks;
- preserve duplicate `NOT EXISTS`;
- preserve one N-part transaction;
- no partial flight/track state.

### F1.5 — cross-path acceptance
- equivalent EASA SEP PIC Manual/GPS common fields;
- equivalent ULL PIC common fields;
- invalid profile;
- unsupported role;
- optional incomplete draft;
- certification requirements unchanged;
- downstream draft consumers read stored identity consistently.

### F1.6 — integrity/dependency closeout
- resolve or explicitly block on shared-flight identity trigger risk;
- preserve v1–v8 verification;
- ROADMAP/FEATURES/CHANGELOG closeout;
- production smoke if runtime changed.

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

## 13. Review decisions required before runtime implementation

Independent reviewer should challenge:

1. Is candidate -> pure normalizer -> `FlightInput` the smallest safe architecture, or should persistence use a different canonical type?
2. Is retaining `parseFlightInput(FormData)` as a wrapper sufficient for backward compatibility?
3. Should F1 expose GPS Operation/Engine common controls, or fail closed unresolved FCL operation/engine context?
4. Is the proposed explicit-snapshot INSERT trigger rule safe across Manual, GPS, sharing, restore and historical correction?
5. Should the trigger integrity fix be a pre-F1 hotfix, F1.0 prerequisite, or M2B item that blocks F1 closeout?
6. Are there any certification v1–v8 or recency side effects the design missed?
7. Can GPS use the normalizer while preserving current atomic N-part persistence without creating a second semantic mapping?

No runtime implementation should start until these questions are reconciled against code/tests and, where useful, independent review.
