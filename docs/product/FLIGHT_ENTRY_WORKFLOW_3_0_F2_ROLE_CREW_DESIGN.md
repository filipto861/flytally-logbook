# Flight Entry Workflow 3.0 — F2 Role / Crew Parity Design Draft

**Status:** DRAFT FOR INDEPENDENT REVIEW · NO RUNTIME CHANGE  
**Baseline:** `main@0ebb3d1e46df62046eb460134678435547beebb5`  
**Dependency:** F1 shared semantic normalization DONE / production-verified.

## 1. Objective

F2 makes Role/Crew semantics one source-agnostic server contract and makes the UI expose role-defining identity immediately when Role makes it relevant.

The concrete product problem remains the one that triggered Workflow 3.0:

- a pilot must not select DUAL and discover the Instructor/PIC field only later;
- GPS must not offer a role it cannot save with the same crew semantics as Manual;
- HTML `required` is not a domain boundary;
- changing Role must not silently carry semantically unrelated crew fields into the new role.

F2 is not a certification rewrite. `flightCertificationCompliance()` remains the stronger final certification gate.

## 2. Current repository evidence

### Current canonical roles

`EASA_ROLES`:
- PIC
- SOLO
- CO-PILOT
- CRUISE-RELIEF CO-PILOT
- DUAL
- SPIC
- PICUS
- FI
- INSTRUCTOR
- EXAMINER
- SAFETY PILOT

Additional reference roles:
- PAX
- OBSERVER

Current auxiliary roles are:
- SAFETY PILOT
- PAX
- OBSERVER

### Current function allocation

`allocatedFunctionTimes()` currently records:
- PIC minutes for PIC / SOLO / SPIC / PICUS / FI / INSTRUCTOR / EXAMINER;
- co-pilot minutes for CO-PILOT / CRUISE-RELIEF CO-PILOT;
- DUAL minutes for DUAL;
- instructor minutes for FI / INSTRUCTOR / EXAMINER;
- no creditable function time for Safety Pilot / PAX / Observer.

F2 must not change these allocations incidentally.

### Current PIC-name resolution

`pilotInCommandName()` currently resolves:
1. DUAL → `instructor`;
2. SPIC/PICUS → `verification_name`;
3. explicit `commander`;
4. current account pilot name for PIC / SOLO / FI / INSTRUCTOR / EXAMINER;
5. otherwise unavailable.

Therefore EASA CO-PILOT / CRUISE-RELIEF CO-PILOT / SAFETY PILOT / PAX / OBSERVER currently need an explicit commander before certification.

### Current Manual UI

- DUAL renders **Instructor / PIC** and makes it HTML-required for EASA.
- Safety Pilot renders **Actual PIC**:
  - manual name, or
  - accepted Connection.
- SPIC/PICUS render:
  - **Supervising PIC / FI**
  - **Countersignature reference**
- every other role receives generic optional **Commander / PIC** + **Instructor** fields.
- non-SPIC/PICUS roles receive hidden verification fields populated from the existing record.
- changing Role can therefore preserve/stash values that are not semantically relevant to the newly selected role.

### Current server Save boundary

`normalizeFlightDraft()`:
- validates canonical Role;
- requires SPIC/PICUS `verificationName + verificationReference`;
- does **not** independently require EASA DUAL instructor;
- does not role-strip `commander` / `instructor` / verification fields.

`createFlight()` / `updateFlight()`:
- separately enforce Safety Pilot connected-ID shape;
- separately require EASA Safety Pilot Actual PIC when no connected PIC is used;
- recheck connected Actual PIC against an accepted Connection;
- replace client commander text with the connected account display name;
- persist a separate `flight_connected_crew` PIC link.

The DUAL gap is therefore real: browser UI and certification require Instructor/PIC, but a crafted Save can currently persist EASA DUAL without it.

### Current GPS boundary

GPS remains PIC-only after F0/F1. That is intentional until this F2 contract is complete.

## 3. Frozen principles carried into F2

1. Role meaning is source-agnostic.
2. Manual and GPS may differ in interaction, not in Role semantics.
3. EASA role-defining identity is Save-required for:
   - DUAL → Instructor/PIC;
   - SAFETY PILOT → Actual PIC;
   - SPIC/PICUS → supervising PIC/FI + countersignature reference.
4. Connected accounts are never inferred from names.
5. A connected identity and the historical display-name snapshot are different evidence:
   - flight stores the historical text;
   - account link is separate metadata.
6. Save completeness and Certification completeness stay separate.
7. Certification v1–v8 is unchanged.
8. GPS stays PIC-only until a role is explicitly promoted with full parity.
9. No historical backfill or guessed crew repair.

## 4. Proposed source-agnostic Role/Crew contract

Introduce a pure role contract that is shared by:
- normalizer/server validation;
- Manual field visibility and required cues;
- GPS role availability;
- tests.

Candidate shape:

```ts
type CrewField =
  | "commander"
  | "instructor"
  | "verificationName"
  | "verificationReference"
  | "connectedActualPic";

type CrewFieldPolicy = "required_save" | "optional" | "not_applicable";

type RoleCrewSpec = {
  role: FlightRole;
  commander: CrewFieldPolicy;
  instructor: CrewFieldPolicy;
  verificationName: CrewFieldPolicy;
  verificationReference: CrewFieldPolicy;
  connectedActualPic: "allowed" | "not_applicable";
  selfIsPic: boolean;
  picNameSource:
    | "SELF"
    | "COMMANDER"
    | "INSTRUCTOR"
    | "VERIFIER"
    | "NONE";
};
```

Exact names are not frozen. The invariant is: applicability and Save requirements come from one role/evidence contract, not JSX branches and separate action heuristics.

## 5. Proposed EASA matrix

This matrix is deliberately split between **frozen decisions** and **review questions**.

| Role | PIC identity used by current certification | F2 Save-required proposal | Persisted role-owned fields | Review status |
| --- | --- | --- | --- | --- |
| PIC | Self account | none | role only; commander/instructor/verifier cleared | Review requested before tightening current optional fields |
| SOLO | Self account | none | role only; crew fields cleared | Review requested |
| FI | Self account | none | role only; crew fields cleared | Review requested because current UI allows generic commander/instructor |
| INSTRUCTOR | Self account | none | role only; crew fields cleared | Review requested |
| EXAMINER | Self account | none | role only; crew fields cleared | Review requested |
| DUAL | Instructor is PIC | **Instructor/PIC required** | instructor only | **Frozen** |
| SPIC | Verifier is supervising PIC/FI | **verification name + reference required** | verification pair only | **Frozen** |
| PICUS | Verifier is supervising PIC/FI | **verification name + reference required** | verification pair only | **Frozen** |
| SAFETY PILOT | Explicit Actual PIC commander | **Actual PIC required** | commander + optional connected-PIC metadata | **Frozen** |
| CO-PILOT | Explicit commander | proposed commander required before Save | commander only | **Needs review** |
| CRUISE-RELIEF CO-PILOT | Explicit commander | proposed commander required before Save | commander only | **Needs review** |
| PAX | Explicit commander needed by current EASA certification | leave Save-optional; certification still blocks | commander only if supplied | **Needs review** |
| OBSERVER | Explicit commander needed by current EASA certification | leave Save-optional; certification still blocks | commander only if supplied | **Needs review** |

Why CO-PILOT/CRCP are a review question:
- current certification requires a PIC name;
- unlike route/time completeness, the PIC is part of the role's crew identity;
- but promoting it to Save-required would intentionally tighten current Save semantics beyond the already frozen D3 roles.

Do not implement that tightening until reviewed/approved.

## 6. Non-EASA / ULL policy

F2 must not pretend EASA role semantics are automatically a ULL legal requirement.

For ULL:
- preserve current role storage and function-allocation behavior unless a tested product rule says otherwise;
- do not make EASA-only identity requirements mandatory merely because the same Role label is selected;
- connected Safety Pilot identity may still be used as explicit user evidence if the workflow supports it, but do not label it as EASA compliance.

The pure contract may therefore be `roleCrewSpec(role, evidence)`, not `roleCrewSpec(role, source)`.

## 7. Role-owned field sanitization

F2 acceptance requires that irrelevant semantic fields are not persisted after Role changes.

The server must sanitize role-owned fields before persistence.

Proposed rules:

- DUAL:
  - keep `instructor`;
  - clear `commander`;
  - clear verification pair.
- SPIC/PICUS:
  - keep verification pair;
  - clear `commander`;
  - clear `instructor`.
- SAFETY PILOT:
  - keep resolved `commander`;
  - clear instructor + verification pair.
- CO-PILOT/CRCP:
  - keep commander;
  - clear instructor + verification pair.
- self-PIC roles (PIC/SOLO/FI/INSTRUCTOR/EXAMINER):
  - proposed: clear commander/instructor/verification pair.
- PAX/OBSERVER:
  - keep commander only if supplied;
  - clear instructor/verification pair.

This is a semantic cleanup, not merely presentation.

### Historical/edit safety

Certified rows remain immutable.

For existing editable drafts:
- switching Role explicitly opts into the target Role contract;
- server Save may clear fields that are not applicable to the target Role;
- no automatic background rewrite occurs;
- if unchanged old drafts contain legacy extra fields, we need an explicit decision whether ordinary same-role Save sanitizes them immediately or only a Role change does.

**Recommended:** server always returns canonical target-role fields on Save, but before implementation add regression coverage for existing drafts and confirm we do not destroy meaningful supported evidence. Independent review requested.

## 8. Connected Safety Pilot Actual PIC

Keep account identity resolution outside the pure normalizer.

Proposed boundary:

```
Form/GPS source
  -> RoleCrew request (manual name OR connected user id)
  -> server connection resolver
  -> resolved historical commander text + optional account link
  -> pure role/crew normalization
  -> FlightInput
  -> persistence + flight_connected_crew metadata
```

Requirements:
- connected user ID must be server-authoritative;
- accepted Connection status is rechecked at submit time;
- self-link is rejected;
- empty/missing display name fails closed;
- persisted `commander` comes from the server account snapshot, not hidden client text;
- `flight_connected_crew` remains separate from certification hash;
- no invitation is sent on draft Save;
- post-certification invitation workflow remains unchanged.

F2 should extract the duplicated create/update connection logic into one resolver without changing collaboration lifecycle semantics.

## 9. DUAL / instructor identity

Current Manual DUAL datalist suggests connected instructor names, but the stored DUAL field is text only.

F2 must not infer an account link from that text.

Baseline:
- DUAL requires Instructor/PIC text before EASA Save;
- datalist/autocomplete may remain convenience-only;
- any future connected-instructor binding must use an explicit account ID and is separate from this basic Save contract;
- existing instructor verification workflows remain post-certification evidence and are not automatically triggered from a matching name.

## 10. SPIC / PICUS supervision

Keep:
- `verification_name`
- `verification_reference`

Both are Save-required for EASA SPIC/PICUS.

Do not silently convert a typed supervising name into a Connection.

If later adding an explicit supervising-account link:
- it must be separate metadata;
- certification text/reference remain the historical evidence;
- exact hash/revision binding remains unchanged.

That linkage is not required to close F2 unless repository evidence proves an existing workflow depends on it.

## 11. Manual UX target

Role-owned identity must not live behind a generic "Role details" disclosure when required.

Target placement directly below Role:

### DUAL

```text
Role        DUAL
Instructor / PIC   [____________]   Required
```

### SAFETY PILOT

```text
Role        SAFETY PILOT
Actual PIC source  Manual | Connection
Actual PIC         [____________]   Required
```

### SPIC / PICUS

```text
Role        SPIC
Supervising PIC / FI       [____________]   Required
Countersignature reference [____________]   Required
```

Optional crew information for roles where it is genuinely supported can remain under a small disclosure, but required role identity is inline.

Do not add explanatory paragraphs unless they communicate a non-obvious consequence.

## 12. GPS parity target

F2 does **not** automatically enable every Role in GPS.

Promotion rule:

A GPS role can be enabled only when all of these are true:
1. the shared RoleCrew spec defines it;
2. all Save-required identity can be collected in Common details;
3. server validation is identical to Manual semantics;
4. normalized persisted fields are identical for equivalent evidence;
5. N-part transaction remains atomic;
6. no role-specific collaboration metadata is lost.

Initial proposed promotion order:
1. DUAL common-role import;
2. SPIC/PICUS common-role import if countersignature evidence is meaningful for every imported part;
3. Safety Pilot only after connected/manual Actual PIC common-role semantics and post-save metadata are proven;
4. CO-PILOT/CRCP after commander Save policy is decided.

PIC remains the only enabled GPS role until each promotion milestone passes.

F4 still owns **per-part RoleCrew overrides**. F2 only needs a safe common RoleCrew context across the import.

## 13. Proposed F2 milestone split

### F2.0 — characterization + final contract
- inventory all Role/Crew consumers;
- freeze role/evidence matrix;
- characterize stale-field leakage;
- characterize Safety Pilot Manual/Connection create+update;
- characterize certification and sharing effects;
- independent review;
- no runtime change.

### F2.1 — pure RoleCrew spec + sanitization
- add `roleCrewSpec(role,evidence)`;
- add pure canonical role-owned-field validator/sanitizer;
- integrate into `normalizeFlightDraft()`;
- make frozen EASA DUAL + SPIC/PICUS Save rules server-authoritative;
- preserve existing function allocation;
- no connected-account DB work inside pure normalizer.

### F2.2 — Manual inline UX
- required role-owned fields move directly under Role;
- completion blocker uses the same RoleCrew spec;
- optional generic crew fields removed where not applicable;
- role switching preserves local UI input if useful but submit persists only canonical target-role fields.

### F2.3 — Safety Pilot connection resolver convergence
- one server resolver used by create/update;
- manual and connected paths produce the same historical commander semantic value;
- separate `flight_connected_crew` metadata preserved;
- revoked Connection / self-link / missing display name fail closed.

### F2.4 — GPS common RoleCrew parity
- enable only roles explicitly approved by F2 contract;
- common RoleCrew context for all parts;
- all parts normalized before mutation;
- one invalid role/crew context aborts whole import;
- Safety Pilot remains blocked until its metadata path is fully represented.

### F2.5 — cross-path + browser closeout
- Manual/GPS equivalent role semantics;
- desktop/iPad/mobile role-aware presentation;
- role-switch stale-data tests;
- certification v1–v8 unchanged;
- recency unchanged;
- sharing/instructor/Safety Pilot lifecycle regression;
- docs + production closeout.

## 14. Testing contract

### Pure domain

For every Role:
- accepted canonical fields;
- rejected/required fields;
- irrelevant fields sanitized;
- EASA vs ULL differences explicit;
- allocated function-time output unchanged.

Specific:
- EASA DUAL missing instructor → Save rejected;
- EASA DUAL instructor present → Save accepted;
- EASA SPIC/PICUS missing either supervision field → rejected;
- EASA Safety Pilot manual commander missing → rejected at resolved server boundary;
- connected Safety Pilot cannot use client-supplied commander as authority;
- PIC/SOLO/self-PIC roles do not inherit stale verification fields.

### PostgreSQL / actions

- Manual DUAL create/update;
- crafted DUAL request without instructor;
- Safety Pilot manual;
- Safety Pilot accepted Connection;
- revoked Connection between render and submit;
- connected pilot display name changed before submit → server snapshot wins;
- changing Safety Pilot to PIC removes connected PIC link;
- changing another role to Safety Pilot does not preserve stale incompatible fields;
- SPIC/PICUS;
- no partial child metadata after failed Save.

### Certification / downstream

- equivalent pre/post-F2 stored records produce unchanged certification issues except intentionally moved Save blockers;
- v1–v8 verification unchanged;
- function-time allocation unchanged;
- Safety Pilot remains auxiliary/non-creditable;
- sharing/instructor verification workflows remain exact-revision/hash bound;
- no recency expansion.

### Browser

Required states:
- Manual PIC;
- DUAL;
- Safety Pilot manual;
- Safety Pilot Connection;
- revoked Connection;
- SPIC;
- PICUS;
- one commander-based multi-pilot role after policy decision;
- role switch DUAL → PIC → DUAL;
- mobile + iPad + desktop;
- light + dark for final closeout.

## 15. Decisions requiring independent review

1. Should EASA CO-PILOT / CRUISE-RELIEF CO-PILOT commander become Save-required, or remain Certification-required only?
2. Should self-PIC roles always clear explicit `commander` and `instructor`, or is there a legitimate supported case for those fields?
3. For old editable drafts, should same-role Save sanitize irrelevant legacy crew fields immediately, or only after an explicit Role change?
4. Is keeping DUAL instructor and SPIC/PICUS supervisor as text-only historical evidence sufficient for F2, with explicit account linking deferred?
5. Is the Safety Pilot resolver boundary correctly separated from the pure RoleCrew normalizer?
6. Which roles, if any, should be promoted to GPS common-role support in F2 versus waiting for F4?
7. Are PAX/OBSERVER role semantics correctly treated as reference records with certification requirements separate from Save?
8. Does any existing sharing/instructor workflow rely on generic commander/instructor fields in a way this sanitization proposal would break?

Do not start runtime F2.1 until these are reconciled against repository evidence and independent review.
