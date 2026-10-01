# Flight Entry Workflow 3.0 — F2 Role / Crew Parity Design Draft

**Status:** F2.0/F2.1/F2.2/F2.3 DONE · F2.3 PRODUCTION VERIFIED · F2.4 NEXT  
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

### F2.1 — pure RoleCrew spec + server validation only — DONE
- add pure `roleCrewSpec(role,evidence)` / equivalent;
- integrate role requirement validation into `normalizeFlightDraft()`;
- make EASA DUAL Instructor/PIC Save-required server-side;
- preserve existing SPIC/PICUS Save requirements through the same contract;
- encode Safety Pilot as externally resolved/action-authoritative until F2.3;
- preserve CO-PILOT/CRCP/PAX/OBSERVER Save-optional behavior;
- **no broad field sanitization**;
- no GPS role expansion;
- no certification version/hash schema change.
- verification: final PR head Verify FlyTally web #1065 PASS (TypeScript, full unit/regression, PostgreSQL acceptance); Browser smoke #441 PASS including production build + real Chromium smoke.
- merge: PR #204 → `main@0f00a3c256843dd24b84a801f6b1e0cae60771d5`.
- production: Vercel `dpl_Dd3wzaNm51qBVKDBzRMFHF7cEgfP` READY for the exact merge SHA; `fly-tally.com` is aliased with no alias error and returned HTTP 200.
- DB/schema migration: N/A.

### F2.2 — Manual inline Role/Crew UX — DONE / PRODUCTION VERIFIED
- required DUAL / Safety Pilot / SPIC / PICUS identity appears directly in Flight essentials immediately after Role;
- visibility/PIC-source mapping and EASA Save-required cues consume `roleCrewSpec(role,evidence)`;
- the completion surface includes DUAL Instructor/PIC, Safety Pilot Actual PIC, SPIC/PICUS supervisor and countersignature blockers with direct focus;
- generic Commander/PIC + Instructor inputs remain available under optional **Additional crew details**; DUAL has no duplicate optional crew disclosure;
- instructor / verification input state is preserved locally across unsaved Role switches, while persistence semantics remain unchanged;
- no destructive UI-only cleanup;
- Safety Pilot resolver semantics remain action-authoritative until F2.3;
- GPS remains PIC-only and certification v1–v8 is unchanged;
- authenticated browser coverage verifies DUAL and SPIC/PICUS required inline controls plus unsaved Role-switch value preservation;
- final verification: Verify FlyTally web #1075 PASS — TypeScript PASS, 1042/1042 unit/regression, PostgreSQL 63/63; Browser smoke #451 PASS — production build + Chromium 30 passed / 2 skipped;
- merge: PR #207 → `main@205483eda15f82770c1000c0a91fa4df92177fcd`;
- production: Vercel `dpl_9v8FjPuj8F2jAuH4TAVNfHrM4eAE` READY for the exact merge SHA; `fly-tally.com` aliases it with no alias error and returned HTTP 200;
- DB/schema migration: N/A.

### F2.3 — Safety Pilot resolver convergence — DONE / PRODUCTION VERIFIED
- one server resolver, `resolveSafetyPilotPicForSave()`, is used by create/update;
- the resolver owns Safety Pilot mode parsing, malformed/self account rejection, the EASA manual Actual-PIC requirement, accepted-Connection lookup and server display-name snapshot;
- non-Safety-Pilot roles bypass connected identity and preserve their normalized commander semantic value;
- connected identity is resolved only by submitted account ID plus accepted Connection; typed names are never matched to accounts;
- connected mode ignores client commander text and returns the current server `users.display_name` as the historical commander snapshot;
- create/update persist that shared semantic commander and connected user ID;
- the parent INSERT/UPDATE additionally rechecks accepted Connection state in its own write predicate, so revocation between initial resolution and persistence fails closed;
- if that write returns no row, the same resolver is called again to classify a Connection revocation without duplicating a second account-resolution implementation;
- `flight_connected_crew` remains separate metadata and its insert/update/delete remains conditional on successful parent persistence;
- no destructive RoleCrew sanitization is introduced; F2.4 still owns evidence-aware canonicalization;
- GPS remains PIC-only; certification v1–v8 and collaboration/materialization semantics remain unchanged;
- authenticated Chromium coverage verifies server display-name resnapshot on connected create/update and fail-closed Save after Connection revocation;
- final verification: Verify FlyTally web #1077 PASS — TypeScript PASS, 1048/1048 unit/regression, PostgreSQL 66/66; Browser smoke #453 PASS — production build + Chromium 32 passed / 2 skipped;
- merge: PR #209 → `main@d90215f88514e953e062980798954c497ca76be7`;
- production: Vercel `dpl_84eHWKabeoy8DqgGuM6rDATjTTjR` READY for the exact merge SHA; `fly-tally.com` aliases it with no alias error and returned HTTP 200;
- DB/schema migration: N/A.

### F2.4 — producer/consumer reconciliation + evidence-aware canonicalization — F2.4A DONE / F2.4B REVIEW GATE

Detailed evidence: `FLIGHT_ENTRY_WORKFLOW_3_0_F24_PRODUCER_CONSUMER_AUDIT.md`.  
Independent review package: `FLIGHT_ENTRY_WORKFLOW_3_0_F24_REVIEW_HANDOFF.md`.

#### F2.4A — identity-binding reconciliation — IMPLEMENTED / VERIFIED
- producer/consumer audit completed across Manual, GPS, shared-flight materialization, Certification, print/export, FCL.050, instructor verification, sharing/PIC invitations, audit/backup and recency;
- removed Certification-time DUAL/SPIC/PICUS display-name matching to accepted instructor Connections;
- removed the implicit account-bound verification request side effect from Certification;
- retained the existing explicit account-ID `instructor_id` request path as the sole FlyTally account-binding action;
- Crew Verification copy now states that typed instructor/supervising-PIC names are stored flight evidence only and that account-bound verification requires explicit connected-account selection after Certification;
- authenticated browser fixture proves a matching typed name on an already-certified DUAL record creates no pending instructor participation and exposes only the explicit request control;
- final PR head `9282b3c0795091e0ae62d4ee26a9d2230716ebb1` verification: Verify FlyTally web #1089 PASS — TypeScript PASS, 1052/1052 unit/regression, PostgreSQL 66/66; Browser smoke #465 PASS — production build + Chromium 34 passed / 2 skipped;
- merge: PR #212 → `main@06b50d911e0cedcafbd5f10bea41868098f8d8b0`;
- production: Vercel `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` READY for the exact merge SHA; `fly-tally.com` is aliased with no alias error;
- Certification v1–v8, exact revision/hash verification, in-person signing, certified-row immutability, Safety Pilot F2.3 semantics and GPS PIC-only behavior remain unchanged;
- DB/schema migration: N/A.

#### F2.4B — evidence-aware semantic canonicalization — DONE · COMPATIBILITY FREEZE
Focused review: `FLIGHT_ENTRY_WORKFLOW_3_0_F24B_REVIEW_HANDOFF.md`.

- confirmed `instructor` cannot be broadly cleared outside DUAL because non-DUAL differences/familiarisation purpose evidence depends on it;
- confirmed `verification_name` / `verification_reference` cannot be broadly cleared outside SPIC/PICUS because generic test/revalidation endorsement evidence shares those fields;
- text-regex endorsement detection is not sufficient authority for destructive cleanup;
- fresh discovery confirmed `commander` on a self-PIC role is not necessarily stale: Manual UI exposes optional Commander/PIC for self-PIC roles, and shared-flight materialization intentionally writes commander snapshots onto recipient `PIC` rows;
- the earlier draft preference to make SELF always override stored commander is withdrawn and frozen out of F2 because it could change printed/compliance interpretation of certified records and ignore intentional shared-flight provenance; any future reconsideration must reopen the decision explicitly;
- current preferred direction is compatibility-first: preserve `pilotInCommandName()` precedence, preserve raw crew fields, and split RoleCrew Save/UI identity requirements from historical/downstream PIC-display precedence;
- B1 makes that split explicit: `rolePicIdentitySource` governs role-defining Save/UI identity, while `picDisplayPrecedence` governs historical display/compliance resolution; self-PIC roles use `rolePicIdentitySource=SELF` with display precedence `COMMANDER → SELF` and an optional commander field;
- `pilotInCommandName()` delegates to the shared pure resolver, so the contract has one implementation point without changing historical output semantics;
- B1 production evidence: PR #217 → `main@6f1b33745d8b5c352d0d3331ea4891bb9f8d9f58`; Verify #1091 PASS — TypeScript, 1058/1058 unit/regression, PostgreSQL 66/66; Browser #466 PASS — production build + Chromium 34 passed / 2 skipped; Vercel `dpl_4MfDPVYDhR3ibgQ7uHoeUAagQkQW` READY on the exact merge SHA and serving `fly-tally.com`; DB/schema N/A;
- B2 outcome is intentionally conservative: no destructive clearing and no reinterpretation of certified self-PIC commander evidence is performed in F2. Evidence from Manual UI, shared PIC materialization, training-purpose retention, endorsement consumers, certification hashes, export/audit and backup prevents a safe broader cleanup rule;
- current display precedence is frozen for F2: DUAL `INSTRUCTOR → COMMANDER`, SPIC/PICUS `VERIFIER → COMMANDER`, self-PIC `COMMANDER → SELF`, commander-based roles `COMMANDER`;
- raw commander/instructor/verification values remain preserved on editable Save unless a future explicit structured model proves non-applicability; task/note regexes never authorize deletion;
- this is a compatibility freeze, not a claim that current historical field overloading is the ideal long-term schema. Any future semantic change must reopen the decision explicitly and protect certified history;
- B2 verification: PR #219 → `main@1c0ecf7be2e18feba7e583039ed5c27919dcdd42`; Verify #1092 PASS — TypeScript, 1059/1059 unit/regression, PostgreSQL 66/66; tests/docs only, so no new runtime/browser deployment was required beyond production-verified B1;
- a contract-only refactor should characterize Manual self-PIC fallback, explicit self-PIC commander, generic shared PIC `RECIPIENT_ACCOUNT`, linked Safety Pilot `CERTIFIED_SOURCE_COMMANDER`, certification hash stability, and raw export/audit/backup preservation;
- characterization PR #215 is merged as `main@064be0862b9506e472545eb16491b21019a90a50`; it covers self-PIC fallback/explicit commander precedence, the current RoleCrew mismatch, Manual commander availability, shared PIC commander producers and raw integrity/export visibility. Verify #1090 PASS — TypeScript, 1057/1057 unit/regression, PostgreSQL 66/66;
- any editable-Save clearing must be proven non-applicable from explicit structured evidence; otherwise preserve raw evidence;
- no runtime behavior change is permitted before independent review reconciliation.

#### F2.4C — cross-path characterization — IMPLEMENTED / VERIFY PENDING
- Manual Edit/role switching: shared normalizer preserves overlapping commander/instructor/verification evidence across DUAL → PIC → SPIC contexts;
- Certification: remains isolated from account binding and preserves certification v8 behavior; no implicit request/name matching;
- explicit verification: connected instructor requests consume account ID only, while in-person evidence remains exact revision/hash-bound with unauthenticated handwritten identity clearly distinguished;
- shared materialization: exact source revision/hash and PIC commander provenance remain fail-closed;
- print/read-only/CSV/XLS: semantic PIC resolution and raw crew evidence remain aligned;
- audit/backup: raw commander/instructor/verification fields remain human-visible and recoverable;
- recency: instructor evidence counts only from a signed verification matching the current flight revision and certification hash;
- Safety Pilot: F2.3 account-ID resolver and separate `flight_connected_crew` metadata remain authoritative;
- GPS remains PIC-only through `GPS_IMPORT_ROLES=["PIC"]` and the single-role import UI;
- authenticated browser coverage verifies that a certified DUAL record with matching typed evidence remains unbound and exposes both explicit connected-account request and in-person signature paths;
- no runtime, schema, certification-version or persisted-data change is intended by F2.4C.

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

F2.3 coverage:
- Safety Pilot manual/connected resolution and malformed/self connected identity;
- server display-name snapshot by account ID;
- revoked-Connection behavior before Save and at the write boundary;
- atomic connected-PIC metadata synchronization.

Later F2 coverage:
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

