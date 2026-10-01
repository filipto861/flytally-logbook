# Flight Entry Workflow 3.0 — F2 Role / Crew Parity Design Draft

**Status:** F2.0 REVIEW RECONCILED · CONTRACT FROZEN FOR F2.1 VALIDATION-ONLY START · NO RUNTIME CHANGE IN THIS DOCUMENT PR  
**Baseline:** `main@0ebb3d1e46df62046eb460134678435547beebb5`  
**Dependency:** F1 shared semantic normalization DONE / production-verified.  
**Independent review:** APPROVE WITH CHANGES; reconciled against current repository evidence on 1 October 2026.

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

type CrewFieldPolicy = "required_save" | "optional" | "not_applicable" | "external_resolver";

type RoleCrewSpec = {
  role: FlightRole;
  evidence: string;
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

Exact names are not frozen. The invariant is: applicability and Save requirements come from one source-agnostic role/evidence contract, not JSX branches and separate action heuristics.

**Important reconciliation:** the contract does **not** synthesize the account holder's display name into `flights.commander` for self-PIC roles. Current repository semantics explicitly allow ordinary PIC commander to be blank and resolve self identity from the owning account in `pilotInCommandName()`. Injecting account identity into the pure normalizer would make it source/account-aware and would contradict the F0 field/consumer contract.

## 5. Frozen EASA matrix after review

This matrix is deliberately split between **frozen decisions** and **review questions**.

| Role | PIC identity used by current certification | F2 Save rule | F2.1 persistence stance | Frozen status |
| --- | --- | --- | --- | --- |
| PIC | Self account | no additional crew identity required | do not synthesize commander; no destructive sanitization in F2.1 | **Frozen** |
| SOLO | Self account | no additional crew identity required | same as PIC | **Frozen** |
| FI | Self account | no additional crew identity required | same as PIC; preserve current training-evidence semantics until consumer audit closes | **Frozen** |
| INSTRUCTOR | Self account | no additional crew identity required | same as PIC; preserve current training-evidence semantics until consumer audit closes | **Frozen** |
| EXAMINER | Self account | no additional crew identity required | same as PIC; preserve current endorsement-evidence semantics until consumer audit closes | **Frozen** |
| DUAL | Instructor is PIC | **Instructor/PIC required before Save** | validate instructor; sanitization deferred | **Frozen** |
| SPIC | `verification_name` is supervising PIC/FI | **verification name + reference required before Save** | preserve existing pair; sanitization deferred | **Frozen** |
| PICUS | `verification_name` is supervising PIC/FI | **verification name + reference required before Save** | preserve existing pair; sanitization deferred | **Frozen** |
| SAFETY PILOT | Explicit Actual PIC commander | **Actual PIC required before Save** | existing action-level resolver remains authoritative until F2.3 | **Frozen** |
| CO-PILOT | Explicit commander | **Save-optional; Certification-required** | preserve commander if supplied | **Frozen after review** |
| CRUISE-RELIEF CO-PILOT | Explicit commander | **Save-optional; Certification-required** | preserve commander if supplied | **Frozen after review** |
| PAX | Explicit commander under current certification | **Save-optional; current Certification behavior unchanged** | preserve commander if supplied | **Frozen after review** |
| OBSERVER | Explicit commander under current certification | **Save-optional; current Certification behavior unchanged** | preserve commander if supplied | **Frozen after review** |

The independent reviewer proposed storing canonical self identity in `commander` for self-PIC roles. Repository evidence does not support that change: the F0 contract states ordinary PIC commander may be blank, and `pilotInCommandName()` resolves self from the owning account after role-specific instructor/verifier/explicit-commander checks. F2 therefore keeps self identity as account ownership semantics rather than inventing a new stored commander requirement.

For PAX/OBSERVER, F2 does **not** weaken current certification rules. Whether a future product should certify non-pilot reference entries without a PIC name is a separate product/regulatory decision, not part of F2.

## 6. Non-EASA / ULL policy

F2 must not pretend EASA role semantics are automatically a ULL legal requirement.

For ULL:
- preserve current role storage and function-allocation behavior unless a tested product rule says otherwise;
- do not make EASA-only identity requirements mandatory merely because the same Role label is selected;
- connected Safety Pilot identity may still be used as explicit user evidence if the workflow supports it, but do not label it as EASA compliance.

The pure contract may therefore be `roleCrewSpec(role, evidence)`, not `roleCrewSpec(role, source)`.

## 7. Field ownership and sanitization — reconciled

The initial draft treated `commander`, `instructor` and `verification_*` as purely role-owned fields. The hidden-consumer audit disproved that simplification.

Repository evidence:
- `normalizeFlightDraft()` uses a populated `instructor` outside DUAL to retain selected `AIRCRAFT_DIFFERENCES` / `AIRCRAFT_FAMILIARISATION` purpose evidence;
- `fcl050-compliance.ts` uses `verification_name` / `verification_reference` outside SPIC/PICUS when test/check or revalidation remarks require endorsement evidence;
- CSV/XLS export exposes the raw stored commander/instructor/verification columns;
- printable/FCL.050 output resolves PIC through `pilotInCommandName()`, so self-PIC does not require a stored commander;
- shared-flight materialization is an additional producer of commander semantics and must be included before destructive canonicalization is introduced.

Therefore **F2.1 must not perform broad destructive crew-field sanitization.** It is validation-only.

Sanitization policy is now:
1. certified rows remain immutable;
2. no background rewrite or guessed cleanup;
3. F2.1 adds server-authoritative role requirements without deleting legacy/additional evidence;
4. destructive clearing on editable Save is deferred until each field is proven non-applicable in the complete role + evidence + training/endorsement context;
5. role switches may hide local fields, but persistence must not erase potentially meaningful training/endorsement evidence merely because the target role changed;
6. a later F2 milestone may introduce **evidence-aware** canonicalization after producer/consumer audit and regression coverage.

This supersedes the earlier proposal to clear commander/instructor/verification fields solely from Role.

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
- any future connected-instructor binding must use an explicit account ID and is separate from this basic Save contract.

**Repository reconciliation:** current `certification-actions.ts` contains `autoRequestTrainingVerification()`, which matches DUAL/SPIC/PICUS text against accepted instructor-labelled Connections and can create an account-bound verification request. That is name-based identity inference and conflicts with the frozen F2 rule that account links are never inferred from names. F2 must remove or replace that automatic name-matching path before closeout. The existing explicit post-certification request action may remain because it receives an explicit account ID.

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

## 12. GPS parity target — frozen after review

**GPS remains PIC-only for all of F2.**

The independent review correctly identified that F4 owns common/per-part RoleCrew inheritance and override semantics. Enabling DUAL, SPIC/PICUS, Safety Pilot or co-pilot roles during F2 would create an interim GPS contract that F4 would immediately need to replace.

F2 may make the shared RoleCrew contract reusable by GPS, but no additional GPS role becomes selectable or persistable until F4 explicitly integrates it with atomic multi-part inheritance/override behavior.

## 13. Frozen F2 milestone split after review

### F2.0 — characterization + review reconciliation — DONE IN DESIGN PR
- inventory Role/Crew consumers and producers;
- reconcile independent review against repository evidence;
- freeze CO-PILOT/CRCP Save-optional + Certification-required;
- freeze GPS PIC-only through F2;
- confirm self-PIC identity is account-derived and does not require stored commander;
- identify overloaded instructor/verification evidence and name-based auto-request conflict;
- no runtime change.

### F2.1 — pure RoleCrew spec + server validation only
- add pure `roleCrewSpec(role,evidence)` / equivalent;
- integrate role requirement validation into `normalizeFlightDraft()`;
- make EASA DUAL Instructor/PIC Save-required server-side;
- preserve existing SPIC/PICUS Save requirements through the same contract;
- encode Safety Pilot as externally resolved/action-authoritative until F2.3;
- preserve CO-PILOT/CRCP/PAX/OBSERVER Save-optional behavior;
- **no broad field sanitization**;
- no GPS role expansion;
- no certification version/hash schema change.

### F2.2 — Manual inline Role/Crew UX
- required DUAL / Safety Pilot / SPIC / PICUS identity appears directly with Role;
- required/visibility cues consume the shared spec where applicable;
- generic optional fields are not removed until their evidence dependencies are resolved;
- no destructive UI-only cleanup.

### F2.3 — Safety Pilot resolver convergence
- one server resolver used by create/update;
- accepted Connection rechecked at Save time;
- server display-name snapshot remains authoritative;
- manual and connected paths converge to the same commander semantic value;
- `flight_connected_crew` remains separate metadata.

### F2.4 — producer/consumer reconciliation + evidence-aware canonicalization
- audit Manual, GPS, shared-flight materialization, certification, print/export, FCL.050, instructor verification, sharing/PIC invitations, dashboard/statistics and backup/restore;
- remove/replace DUAL/SPIC/PICUS name-based automatic account matching in certification;
- define which `instructor` / `verification_*` values are role identity versus training/endorsement evidence;
- only then introduce deterministic editable-draft sanitization for fields proven non-applicable;
- certified rows remain immutable.

### F2.5 — cross-path regression + closeout
- role matrix unit coverage;
- crafted Manual Save coverage;
- Safety Pilot connection lifecycle;
- certification v1–v8 verification unchanged;
- shared/instructor/PIC invitation regressions;
- desktop/iPad/mobile role-aware presentation;
- docs + production closeout.

## 14. Testing contract

### Pure domain

For every Role:
- role/evidence policy is deterministic;
- Save-required fields are explicit;
- Save-optional roles remain accepted without commander where frozen;
- EASA vs ULL differences are explicit;
- PIC-name source semantics are explicit;
- allocated function-time output remains unchanged.

F2.1-specific:
- EASA DUAL missing instructor → Save rejected;
- EASA DUAL instructor present → Save accepted;
- EASA SPIC/PICUS missing either supervision field → rejected through the shared RoleCrew contract;
- EASA CO-PILOT/CRCP without commander remains Save-valid;
- EASA PAX/OBSERVER without commander remains Save-valid;
- self-PIC roles do not gain a new stored commander requirement;
- existing instructor/verification evidence is preserved because F2.1 performs no destructive sanitization.

Later F2 coverage:
- Safety Pilot manual/connected resolution and revoked-Connection behavior in F2.3;
- evidence-aware stale-field cleanup only after F2.4 consumer/producer proof.

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

## 15. Independent review reconciliation / frozen decisions

Independent review verdict: **APPROVE WITH CHANGES**.

Accepted:
1. CO-PILOT / CRUISE-RELIEF CO-PILOT commander remains Save-optional and current Certification remains the stronger PIC-name gate.
2. PAX / OBSERVER commander remains Save-optional; F2 does not alter current certification behavior.
3. Safety Pilot connection resolution remains before/around the pure normalizer, with server-side accepted-Connection recheck and one shared create/update resolver targeted in F2.3.
4. GPS remains PIC-only until F4.
5. Certified rows are never sanitized or rewritten; no historical backfill.

Corrected after repository reconciliation:
1. The reviewer's recommendation to persist self identity into `commander` is **not adopted**. Current F0 contract and `pilotInCommandName()` explicitly support blank self-PIC commander with account-owner resolution.
2. Broad role-only sanitization is **not safe**. `instructor` and `verification_*` have non-role consumers for training/endorsement evidence, so destructive cleanup is deferred to F2.4 after evidence-aware audit.
3. SPIC/PICUS PIC-name semantics are not ambiguous in current code: `pilotInCommandName()` resolves `verification_name` as the supervising PIC/FI.
4. Current certification auto-request logic performs unique name matching to an instructor-labelled accepted Connection. That conflicts with the frozen no-name-inference rule and must be removed or replaced with explicit account-ID selection before F2 closes.

**Runtime gate:** F2.1 may start because it is now limited to a pure RoleCrew requirement contract + server-authoritative validation. Sanitization, account-link behavior changes and GPS expansion are explicitly out of F2.1.

