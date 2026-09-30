# Flight Entry Workflow 3.0 — Canonical Entry Contract

**Status:** ACTIVE · DESIGN FROZEN / F0.0 + F0.1 + F0 DONE / F1 NEXT  
**Decision owner:** Filip  
**Frozen date:** 30 September 2026  
**Repository:** `filipto861/flytally-logbook`  
**F0 inventory baseline:** `main@5dca9b32af8af0d0a76cca1dada6ae27c5446789`

## 1. Purpose

Flight Entry Workflow 3.0 fixes a structural problem that remains after the completed UI/UX Simplicity 2026 workstream: Manual and GPS entry create the same `flights` domain entity through different semantic write paths.

The goal is not another cosmetic redesign. The goal is to make it structurally impossible for Manual and GPS to assign different meaning, validation or regulatory identity to equivalent flight records, while making the common pilot entry flow materially simpler.

Authority for this work:

1. actual runtime code and tests;
2. certification, recency, historical-record and collaboration contracts;
3. this frozen product contract;
4. ROADMAP / FEATURES / CHANGELOG;
5. independent AI review as advisory evidence only.

## 2. Evidence behind the freeze

The design was challenged in three passes:

- Claude independent Round 1: **APPROVE WITH CHANGES**;
- DeepSeek independent Round 2: **APPROVE WITH CHANGES**;
- repository reconciliation against current `main` by ChatGPT.

Repository-backed findings:

- Manual create uses `parseFlightInput(form)`.
- GPS `importKmlFlight()` manually reads FormData and directly inserts `flights` + track rows.
- GPS persists empty `commander` and `instructor`.
- GPS currently exposes DUAL without an Instructor/PIC field.
- GPS currently exposes SAFETY PILOT without Manual Safety Pilot Actual-PIC semantics.
- GPS server role handling does not share the canonical Manual role validation boundary.
- GPS still has fail-open class/evidence fallbacks to `ULL`.
- Manual B0.5 already removed the equivalent selected-aircraft fail-open fallback and surfaces unresolved profile context.
- canonical recency consumes certified flights only.
- Dashboard and Statistics currently consume draft flights as logged activity.
- Export and Print can include draft flights; Print marks them as `DRAFT`.
- therefore a malformed GPS entry can affect non-recency product totals/outputs immediately after Save even before certification.

## 3. Production-integrity defect that pre-empts M2B

### GPS invalid profile → ULL

Current GPS behavior can turn missing/malformed selected-aircraft evidence or class into `ULL`.

This is a confirmed fail-open defect because:

- missing evidence is not ULL;
- malformed EASA context is not ULL;
- non-EASA records follow different certification/compliance semantics;
- Dashboard/Statistics/Export/Print can consume saved drafts before certification.

Required invariant:

> Invalid or missing aircraft profile/context must never become ULL by fallback.

Valid explicit ULL remains valid.

This defect is handled before the broader redesign.

## 4. Frozen product decisions

### D1 — One canonical semantic flight contract

Manual and GPS may have different interaction/source flows, but they must normalize into the same canonical flight semantics before persistence.

GPS is a source of evidence/suggestions/provenance. It is not a separate flight model.

### D2 — Role meaning is source-agnostic

Role requirements may depend on role, evidence and applicable regulatory context.

They must **not** differ because the entry source is Manual versus GPS.

Do not create `roleCrewSpec(..., source)` semantics.

### D3 — EASA role-defining identity is required before Save

For EASA entries:

- DUAL → Instructor / PIC required before Save;
- SAFETY PILOT → Actual PIC required before Save;
- SPIC / PICUS → supervising PIC/FI + countersignature reference required before Save.

These fields must appear inline immediately when Role makes them applicable.

This preserves and aligns existing production behavior:
- Manual EASA DUAL already exposes an HTML-required Instructor/PIC;
- Manual EASA Safety Pilot is server-blocked without Actual PIC / accepted Connection;
- Manual EASA SPIC/PICUS is server-blocked without supervision/countersignature evidence.

Server validation must become at least as strict as the visible UI; HTML required state is not a domain boundary.

### D4 — Draft and certification remain distinct

The entry workflow only decides whether a semantically coherent draft can be saved.

It does **not** duplicate the full certification engine.

Examples that may remain draft-incomplete under existing policy include:
- route;
- times;
- optional Night/IFR;
- task/purpose where not Save-required by the canonical parser;
- professional context where not otherwise required;
- costs / expenses / notes.

`flightCertificationCompliance()` remains the authoritative certification gate.

### D5 — Invalid aircraft context blocks until explicitly resolved

An invalid aircraft profile must not silently supply defaults.

UI state:
- valid profile → compact trusted profile summary;
- invalid/unresolved profile → **Needs configuration**.

A user may explicitly resolve a valid flight-level context where current product semantics legitimately permit a per-flight snapshot override. That explicit value is not treated as if it came from a healthy aircraft profile.

Do not force a global aircraft-profile edit when a legitimate explicit per-flight context is supported by current contracts.

### D6 — Profile override policy remains conservative

Normal entry should not expose profile schema by default.

Baseline:

- Registration: normal flight selection.
- Make/model/type: profile identity; no routine flight override.
- Evidence/class/category: profile-backed; explicit flight-level resolution/override only where current semantics legitimately support it, never as a silent repair.
- TMG Aeroplane/Sailplane context: explicit flight-level regulatory context remains legitimate.
- Operation SP/MP: flight-specific.
- Engine SE/ME: retain current applicable flight-context semantics until F0 proves a stricter contract; do not silently broaden or remove override capability.
- Balloon class/group: profile identity.
- Balloon FREE/TETHERED: flight-specific.
- Sailplane launch evidence: flight-specific.
- Billing: aircraft default may apply when explicitly configured; flight may remain Not tracked.

F0 must turn this policy into an evidence-backed field matrix before F3 changes UI affordances.

### D7 — GPS Safety Pilot fails closed until parity exists

Target:
- Manual / accepted Connection Actual PIC selection;
- server-side Connection recheck;
- separate connected identity;
- no invitation on Save;
- existing post-certification collaboration workflow.

Until full parity is implemented, GPS must not persist Safety Pilot with empty/ambiguous Actual PIC semantics.

### D8 — Canonical server-side role validation is mandatory

HTML dropdowns are not a domain boundary.

Crafted requests must not persist unsupported roles or role combinations.

### D9 — Multi-part GPS uses semantic-group inheritance

One GPS import session has a common aircraft identity.

Role/Crew may be common to all parts with an explicit whole-group per-part override.

Rules:
- inherited parts follow common RoleCrew context;
- an overridden part owns a complete RoleCrew context for its final role;
- changing common values affects only inherited parts;
- `Reset to common` removes the part override;
- server persistence receives fully resolved values, never `inherit` markers;
- aircraft identity is not a routine per-part override within one import session.

Avoid field-level Role/Crew inheritance.

### D10 — Atomic multi-part persistence

Normalize and validate all parts before mutation.

One invalid part aborts the import.

The final transaction must remain:
- atomic;
- duplicate-safe;
- tenant-scoped;
- connection-rechecked where relevant;
- no partial flights/tracks/crew rows.

### D11 — Historical records are not repaired by invention

Do not backfill old GPS DUAL/Safety Pilot records with guessed crew or guessed profile values.

Existing certified history is unchanged unless the user explicitly enters the correction workflow.

### D12 — No long-lived old/new server-semantic flag

The canonical server/domain write contract must converge.

A UI-only rollout flag may be considered for presentation changes if evidence requires it, but a long-lived server flag that keeps the old GPS semantic write path alive is not acceptable.

Rollback must never re-enable invalid-profile → ULL fallback.

## 5. Target UX model

The common PIC flow should feel approximately like:

```text
Date        Aircraft        Role

From        To

Off block   Takeoff
Landing     On block

Landings

More details ▾

Save & review
```

Role complexity appears immediately and inline:

### DUAL

```text
Role: DUAL

Instructor / PIC
[________________]
```

### Safety Pilot

```text
Role: SAFETY PILOT

Actual PIC
( ) Manual
( ) FlyTally Connection
```

### SPIC / PICUS

```text
Role: SPIC

Supervising PIC / FI
[________________]

Countersignature reference
[________________]
```

Aircraft profile presentation should normally be compact:

```text
OK-BID · B23 · SEP · EASA
Details
```

Unresolved:

```text
OK-BID
Needs configuration
Resolve
```

Do not replace one complex form with more accordions. Context that defines the selected Role belongs inline.

## 6. Copy hierarchy

Default to the least copy that preserves meaning:

1. label only;
2. label + short status;
3. inline warning/error when action is required;
4. disclosure-level explanation only when context is non-obvious;
5. full help only when explicitly requested.

Keep helper copy mainly for:
- validation;
- material consequence;
- unusual provenance;
- non-obvious evidence/regulatory consequence;
- collaboration consequence;
- destructive/irreversible action.

Remove copy that only repeats the label, section title or an obvious option.

## 7. Target architecture

The target is **shared domain semantics, composable UI**, not one giant universal React form.

Candidate boundary to prove in F0/F1:

```ts
type FlightEntrySource = "MANUAL" | "GPS";

type RawFlightEntry = {
  // untrusted values extracted from the active interaction/source
};

type FlightEntryContext = {
  userId: number;
  aircraftContext: ResolvedAircraftContext;
  // accepted connection context / existing edit context / provenance as required
};

type NormalizeFlightResult =
  | { ok: true; input: FlightInput; extras: FlightPersistenceExtras }
  | { ok: false; errors: FlightDomainError[] };

normalizeFlightEntry(raw, context): NormalizeFlightResult
```

Responsibilities should remain separated:

- Manual extraction;
- GPS/split extraction;
- aircraft-context resolution;
- source-agnostic role/crew specification;
- connection validation;
- pure flight normalization;
- duplicate/fingerprint logic;
- transactional persistence;
- GPS track persistence;
- certification compliance.

Exact type/service names are not frozen. The boundary is.

## 8. Entry state boundary

Do not create a second certification engine in New Flight.

Entry needs only enough state to decide:

- **SAVE_BLOCKED**
- **SAVEABLE_DRAFT**

Saved Review/Certification remains responsible for:
- certification completeness;
- signature/countersignature workflows;
- protected revision/hash;
- final certification state.

Possible entry blockers include:
- no aircraft;
- unresolved invalid aircraft context;
- unsupported role;
- role-defining EASA crew/supervision evidence missing;
- malformed populated billing/configuration;
- category-specific required Save evidence already enforced by canonical parser.

F0 must document the exact current Save contract instead of generalizing from regulatory intuition.

## 9. Milestones

### F0.0 — Minimal characterization for integrity hotfix — DONE

**Goal:** prove the exact affected production contract before changing GPS behavior.

Scope:
- map GPS selected-aircraft defaults and server fallbacks;
- map current GPS Role allow-list and crafted-request behavior;
- map current GPS crew persistence;
- map downstream draft consumers relevant to evidence/class;
- identify tests that currently encode fallback behavior;
- establish valid PIC GPS baseline.

Required characterization:
- valid EASA/SEP GPS import;
- valid ULL GPS import;
- missing/malformed selected aircraft context;
- DUAL GPS;
- Safety Pilot GPS;
- crafted unsupported role;
- duplicate/transaction behavior;
- Dashboard/Statistics/Export/Print effect of a saved draft;
- Recency remains certified-only.

No runtime behavior change.

Characterization artifact:
`docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F00_CHARACTERIZATION.md`

Current evidence adds one important role finding:
- GPS UI stores display label INSTRUCTOR as non-canonical value `INSTRUKTOR`;
- canonical `ROLES` contains `INSTRUCTOR`;
- current function-time allocation gives `INSTRUKTOR` zero credit;
- the smallest F0.1 role set proven coherent without adding new crew UI is therefore **PIC only**.

Verification: Verify FlyTally web #970 PASS; TypeScript PASS; unit/regression 971/971 PASS; PostgreSQL acceptance 55/55 PASS. F0.0 is closed with no runtime/schema change.

### F0.1 — GPS fail-closed integrity hotfix — DONE / VERIFIED

**Goal:** eliminate the production fail-open defect with minimal blast radius.

Required outcomes:
- remove implicit GPS `ULL` class/evidence fallback;
- missing/malformed context → explicit unresolved / Needs configuration;
- server rejects missing/invalid class/evidence rather than inventing ULL;
- canonical server role validation;
- temporarily reject/hide GPS roles that cannot yet be persisted with coherent required semantics;
- preserve valid PIC EASA and valid explicit ULL GPS import;
- no schema migration unless evidence proves one necessary;
- no broad UI redesign.

Final F0.1 interim role policy:
- GPS supports **PIC only**;
- every other submitted GPS role is rejected server-side;
- GPS Safety Pilot, DUAL, SPIC/PICUS and other role semantics remain unavailable until F2 proves source-agnostic Role/Crew parity.

F0.0 proved PIC as the smallest safe compatibility set and F0.1 implemented that boundary.

Closeout evidence:
- Verify FlyTally web #979 PASS;
- TypeScript PASS;
- full unit/regression 979/979 PASS;
- PostgreSQL acceptance 55/55 PASS;
- Browser smoke #366 PASS with authenticated Chromium desktop/mobile 26 passed / 2 skipped;
- production build PASS;
- DB schema/migration N/A.

Next: F0 full field / consumer contract inventory.

### F0 — Full field / consumer contract inventory — DONE / VERIFIED

Authoritative inventory artifact:

`docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`

The repository-backed matrix now covers every important flight field across:
- Manual New;
- GPS New;
- Edit;
- Certification;
- Recency;
- Dashboard;
- Statistics;
- Export/Print;
- Sharing;
- GPS tracks;
- Safety Pilot;
- instructor/supervision verification.

For every field record:
- canonical meaning;
- source;
- profile-derived?;
- GPS-derived?;
- pilot-entered?;
- role-dependent?;
- Save-required?;
- Certification-required?;
- common import value?;
- per-part override?;
- persistence location;
- existing normalizer;
- downstream consumers;
- target UX location.

Mark unknowns; do not guess.

F0 additionally records four implementation constraints that F1 must not obscure:
- make/model/variant are currently finalized by the DB aircraft-identity snapshot trigger;
- Manual EASA DUAL has a UI/certification requirement that is not yet an authoritative parser Save rule;
- CSV/XLS export is not a complete semantic mirror of the stored/certified flight payload;
- shared-flight creation explicitly copies source identity while the INSERT trigger can overwrite make/model/variant from current recipient profile state, so that interaction needs dedicated integrity review.

F0 runtime change: **none**.

F0 verification:
- Verify FlyTally web #982 PASS;
- TypeScript PASS;
- full unit/regression 988/988 PASS;
- PostgreSQL acceptance 55/55 PASS;
- browser N/A because F0 changes only analysis/docs/source-contract tests;
- DB schema/migration N/A.

**Next: F1 — Shared normalization / semantic write contract.**

### F1 — Shared normalization / semantic write contract

**Goal:** Manual and GPS normalize equivalent flight semantics through one domain contract.

Acceptance:
- Manual create behavior remains regression-equivalent except for explicitly approved fixes;
- GPS no longer manually invents a smaller semantic record;
- no hidden defaults;
- irrelevant role data cannot leak into persistence;
- certification payload/version/hash unchanged;
- no destructive historical rewrite.

### F2 — Role / Crew parity

**Goal:** one source-agnostic role/crew contract and immediate role-aware UI.

Acceptance:
- EASA DUAL Instructor/PIC inline + Save-required;
- EASA Safety Pilot Actual PIC inline + Save-required with Manual/Connection parity;
- SPIC/PICUS supervision/countersignature inline + Save-required;
- switching roles may preserve useful local input state, but irrelevant semantic fields are not persisted;
- server is authoritative.

### F3 — Aircraft context simplification

**Goal:** stop presenting aircraft-profile schema as a normal flight-entry task.

Acceptance:
- valid profile shows compact actual evidence-bearing context;
- invalid profile shows Needs configuration;
- legitimate explicit flight context remains available;
- no silent repair;
- TMG and other multi-context cases remain explicit;
- historical snapshots remain independent of mutable current profile.

### F4 — GPS multi-part common / override model

**Goal:** deterministic common inheritance with whole RoleCrew overrides.

Acceptance:
- common aircraft identity;
- common RoleCrew by default;
- explicit whole-group override per part;
- common edits affect inherited parts only;
- reset-to-common deterministic;
- one invalid part blocks atomic import;
- server receives fully resolved records.

### F5 — Primary UX / copy simplification

**Goal:** materially reduce decision density for common PIC entry after domain convergence.

Acceptance:
- common PIC entry exposes only essential current decisions;
- role-defining fields appear inline;
- Optional details stay optional;
- no duplicated Review/certification guidance;
- helper copy follows the frozen hierarchy.

### F6 — Browser / responsive / production closeout

Required:
- desktop 1440;
- iPad landscape 1024;
- iPad portrait 768;
- mobile 390;
- mobile 320;
- 200% reflow equivalent;
- light + dark.

Role/source coverage:
- Manual PIC;
- Manual DUAL;
- Manual Safety Pilot Manual;
- Manual Safety Pilot Connection;
- Manual SPIC/PICUS;
- GPS PIC;
- GPS DUAL once parity exists;
- GPS Safety Pilot once parity exists;
- GPS multi-part;
- invalid profile.

## 10. Testing contract

At the relevant milestones require:

### Domain/unit
- shared normalization equivalence;
- canonical role validation;
- role-specific Save rules;
- invalid profile fail-closed;
- valid ULL preserved;
- optional billing remains Not tracked;
- role-change stale-data stripping;
- category-specific movement/profile rules.

### PostgreSQL
- Manual create/update;
- GPS single;
- GPS multi-part atomicity;
- duplicate handling;
- one invalid part rollback;
- Safety Pilot Manual/Connection;
- revoked Connection;
- DUAL;
- SPIC/PICUS;
- no partial related rows.

### Downstream consumers
- recency remains certified-only;
- Dashboard/Statistics do not receive false ULL identity from new saves;
- Export/Print expose the stored draft identity accurately;
- equivalent Manual/GPS semantic records produce equivalent certification requirements.

### Browser
- role-dependent fields appear immediately;
- unsupported GPS roles cannot be persisted;
- invalid profile is visibly unresolved;
- focus/error navigation remains accessible;
- mode switching does not cross-wire forms or stale role state.

## 11. Historical compatibility

Do not:
- rewrite certified rows;
- backfill guessed crew;
- backfill guessed evidence/class;
- change certification hash/version as incidental cleanup;
- infer connected accounts from names;
- destroy current correction/revision semantics.

Old incomplete GPS records remain evidence of what was stored. Review/Edit may surface missing evidence, but repair requires explicit user action.

## 12. Documentation / roadmap discipline

This workstream pre-empts Multi-aircraft M2B because a confirmed production data-integrity defect exists in the GPS write path.

M2B remains accepted work and is not cancelled.

After F0.1, re-check:
- remaining production risk;
- F0/F1 dependency on M2B historical applicability work;
- whether M2B should resume before or after later UX milestones.

Default direction after F0.1 is to continue the domain-convergence milestones needed to prevent Manual/GPS semantic drift unless new evidence changes priority.

## 13. Definition of success

The completed workstream must make it structurally impossible for:

- invalid aircraft context to become ULL by fallback;
- equivalent Manual and GPS records to use different semantic validation;
- DUAL Instructor/PIC to be undiscoverable before Save;
- Safety Pilot to lose Actual PIC semantics;
- unsupported crafted GPS roles to persist;
- multi-part inheritance to overwrite explicit RoleCrew overrides;
- failed N-part imports to leave partial state;
- Review to be the first place fundamental role identity is discoverable;
- draft presence to be confused with certified regulatory evidence.

At the same time, the normal PIC flow must be materially simpler than the current production entry form.
