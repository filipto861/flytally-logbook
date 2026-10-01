# Flight Entry Workflow 3.0 — F2.4 Role/Crew Producer-Consumer Audit

**Status:** ANALYSIS COMPLETE · INDEPENDENT REVIEW REQUIRED BEFORE CANONICALIZATION RUNTIME  
**Repository baseline:** `main@367147cce44d1dcb3a28f14b8f9e55c905d0cc20`  
**Scope:** Role/Crew producer-consumer reconciliation, removal of account inference from typed names, and design of evidence-aware canonicalization. No runtime/schema/certification-version change in this document.

## 1. Purpose

F2.4 exists because `commander`, `instructor`, `verification_name` and `verification_reference` are not simple role-owned fields.

The F2.0/F2.1 review already established that broad Role-only clearing would destroy legitimate evidence. F2.4 therefore audits the complete write/read path before any canonicalization is allowed.

The required outcomes are:

1. remove the remaining DUAL/SPIC/PICUS name → account inference;
2. identify which stored values are authoritative role identity versus additional training/endorsement evidence;
3. define what may be normalized semantically without destructive historical rewrite;
4. preserve certification v1–v8, exact revision/hash verification and certified-row immutability;
5. keep GPS PIC-only until F4.

## 2. Frozen constraints

- Certified rows are immutable. No background cleanup or historical backfill.
- No account link may be inferred from a typed/display name.
- Connected account identity and historical text evidence are separate facts.
- EASA DUAL: `instructor` is Save-required and is the PIC-name source.
- EASA SPIC/PICUS: `verification_name` + `verification_reference` are Save-required; `verification_name` is the PIC-name source.
- EASA Safety Pilot: Actual PIC is Manual or an explicitly selected accepted Connection; F2.3 owns that resolver.
- CO-PILOT / CRUISE-RELIEF CO-PILOT commander remains Save-optional and Certification-required.
- PAX / OBSERVER commander remains Save-optional; F2 does not relax the current Certification PIC-name gate.
- PIC / SOLO / FI / INSTRUCTOR / EXAMINER use the owning account as canonical self-PIC identity; no stored commander snapshot is required.
- GPS stays PIC-only throughout F2.
- Certification payload versions v1–v8 do not change.

## 3. Producer / consumer matrix

| Datum | Current producers | Current authoritative meaning | Important consumers | F2.4 implication |
| --- | --- | --- | --- | --- |
| `commander` | Manual generic crew field; F2.3 Safety Pilot resolver; shared-flight materialization | Explicit PIC/commander text for commander-based roles; Safety Pilot historical Actual-PIC snapshot; shared recipient commander snapshot | `pilotInCommandName()`, FCL.050 Certification, print/read-only output, CSV/XLS export, certification hash v1, sharing/PIC materialization, audit, backup | Cannot be globally cleared. Self-PIC interpretation conflicts with the current helper precedence and requires review. |
| `instructor` | Manual DUAL inline identity; optional generic Instructor field; shared recipient materialization currently writes empty | DUAL Instructor/PIC role identity; outside DUAL it can be additional training evidence | DUAL Save/Certification/PIC-name resolution; aircraft differences/familiarisation purpose filtering; export, hash v1, audit, backup | Broad non-DUAL clearing is unsafe. |
| `verification_name` | Manual SPIC/PICUS inline field; preserved hidden field for other roles; shared recipient materialization writes empty | SPIC/PICUS supervising PIC/FI identity; also currently used as generic endorsement evidence | SPIC/PICUS Save/Certification/PIC-name output; test/check and revalidation warnings; print remarks for SPIC/PICUS; export, hash v1, audit, backup | Broad non-SPIC/PICUS clearing is unsafe while generic endorsement evidence shares this storage. |
| `verification_reference` | Manual SPIC/PICUS inline field; preserved hidden field for other roles; shared recipient materialization writes empty | SPIC/PICUS countersignature reference; also generic signed-endorsement reference | SPIC/PICUS Save/Certification; test/check and revalidation warnings; print remarks for SPIC/PICUS; export, hash v1, audit, backup | Broad non-SPIC/PICUS clearing is unsafe. |
| connected Actual PIC | F2.3 explicit account-ID resolver | Account linkage metadata only; historical text remains in `commander` | post-cert PIC invitation and source provenance | Already correctly separate in `flight_connected_crew`; no F2.4 rewrite required. |
| instructor/supervisor account request | explicit post-certification `instructor_id` action; **also** current automatic name-matching path during Certification | Account-bound verification request | `flight_participations`, signed `flight_verifications`, recency evidence | Automatic name matching violates the frozen contract and must be removed. Explicit ID request remains valid. |

## 4. Manual Save / normalizer findings

`normalizeFlightDraft()` is source-agnostic and pure. It trims all four Role/Crew text fields but does not strip them.

The current RoleCrew contract correctly owns Save requirements:

- self-PIC roles → PIC source `SELF`;
- DUAL → PIC source `INSTRUCTOR`;
- SPIC/PICUS → PIC source `VERIFIER`;
- Safety Pilot → external commander resolver;
- other roles → PIC source `COMMANDER`.

However, the pure normalizer also contains an explicit non-role consumer of `instructor`:

- DUAL may retain the selected training purposes;
- outside DUAL, a populated `instructor` is required to retain `AIRCRAFT_DIFFERENCES` / `AIRCRAFT_FAMILIARISATION`.

Therefore `instructor` cannot be cleared solely because Role is not DUAL.

## 5. Certification and account-link finding — F2.4 blocking defect

`certification-actions.ts` currently runs `autoRequestTrainingVerification()` after certifying a DUAL/SPIC/PICUS flight.

That helper:

1. takes the typed `instructor` or `verification_name`;
2. searches accepted instructor-labelled Connections;
3. compares `users.display_name` to the typed name with case-insensitive normalized string equality;
4. if exactly one account matches, calls `upsertInstructorRequest(..., instructorId)`.

This is account identity inference from a typed name and directly conflicts with the frozen F2 contract.

The repository already has the correct explicit workflow:

- the certified flight page loads accepted instructor Connections as account IDs;
- `requestInstructorApproval()` reads explicit `instructor_id`;
- `upsertInstructorRequest()` rechecks accepted instructor/student Connection state;
- request/signature remains exact revision/hash bound.

**F2.4 Stage A therefore removes the automatic name-matching path and relies on the existing explicit post-certification request action.**

Required UI copy reconciliation:
- do not say a request is sent automatically;
- do not say matching a typed name to a Connection sends anything;
- before Certification, explain that stored instructor/supervisor text is historical evidence only;
- after Certification, explicitly choose a connected account or use the in-person signature path.

No schema is required for this change.

## 6. PIC-name interpretation finding

Current `pilotInCommandName()` resolves:

1. DUAL → `instructor`;
2. SPIC/PICUS → `verification_name`;
3. any non-empty `commander`;
4. self account for PIC/SOLO/FI/INSTRUCTOR/EXAMINER;
5. unavailable.

This does **not** fully match the frozen RoleCrew contract because a stale/non-empty `commander` on a self-PIC role overrides the owning account name.

This matters because `pilotInCommandName()` feeds Certification and print/read-only output.

Three possible reconciliations exist:

### Option A — destructive editable-Save cleanup
Clear `commander` for self-PIC roles on a future editable Save.

Pros:
- stored row becomes canonical.

Cons:
- destroys previously entered text;
- requires precise Edit/role-switch semantics;
- does not fix already-certified historical output;
- unnecessary if raw evidence can be preserved but made non-authoritative.

### Option B — semantic precedence reconciliation
Make `pilotInCommandName()` follow `roleCrewSpec()`:
- DUAL → instructor;
- SPIC/PICUS → verifier;
- self-PIC roles → owning account;
- commander-based/external roles → commander.

Preserve raw `commander` in storage/export/audit/backup.

Pros:
- aligns output/Certification semantics with the frozen contract;
- no row rewrite or data destruction.

Risk:
- changes interpretation of existing certified self-PIC rows that contain a commander value, even though raw signed/hash evidence is unchanged.

### Option C — preserve current interpretation
Keep commander-over-self precedence indefinitely.

This avoids output change but leaves the current RoleCrew contract and actual Certification/print interpretation inconsistent.

**Draft F2.4 recommendation: Option B, but do not implement before independent review because it changes interpretation of existing certified rows.**

## 7. Verification-field overload

`verification_name` and `verification_reference` are authoritative RoleCrew identity for SPIC/PICUS.

They are also used by `fcl050-compliance.ts` as generic endorsement evidence when task/note text heuristically matches:
- skill test;
- proficiency check;
- assessment of competence;
- revalidation;
- recency/refresher activity.

Those generic consumers are not explicit state; they depend on text regexes.

Consequences:

- F2.4 must **not** clear `verification_*` for every non-SPIC/PICUS role;
- F2.4 must **not** use a regex match as authority to decide destructive retention/clearing;
- a future explicit endorsement-evidence model may separate role supervision from generic endorsement evidence, but that is not required to remove name inference.

## 8. Instructor-field overload

Outside DUAL, a populated `instructor` currently enables retention of:
- `AIRCRAFT_DIFFERENCES`;
- `AIRCRAFT_FAMILIARISATION`.

The existing training evidence tests explicitly cover this behavior.

Consequences:

- do not clear `instructor` solely because target Role is PIC/SOLO/FI/INSTRUCTOR/EXAMINER/CO-PILOT/etc.;
- do not make DUAL semantics the only reason an instructor name may exist;
- if a future canonical model separates training instructor evidence from DUAL PIC identity, migration must be additive and evidence-preserving.

## 9. Shared-flight materialization

`materializeParticipation()` is a separate producer of recipient logbook semantics.

Current commander behavior is explicit by participation role:
- PIC with `CERTIFIED_SOURCE_COMMANDER` → certified source commander;
- PIC with `RECIPIENT_ACCOUNT` → recipient account display name;
- INSTRUCTOR participant → recipient display name;
- other participant roles → source pilot display name.

Recipient materialization currently writes empty `instructor` and empty `verification_*` and recalculates recipient credit rather than copying source credit.

F2.4 must treat this as an intentionally separate producer, not silently run it through Manual-only cleanup assumptions.

## 10. Print / export / audit / backup

- CSV/XLS export exposes raw `commander`, `instructor`, `verification_name`, `verification_reference`.
- Print/read-only resolves display PIC through `pilotInCommandName()`; SPIC/PICUS verification text is also emitted in remarks.
- Flight audit visibly tracks all four fields.
- Portable backup uses full `flights` rows and therefore preserves them exactly.
- Restore is not a canonicalization opportunity.

Therefore any destructive cleanup would be externally observable and must happen only from an explicit editable mutation with evidence-aware rules. No background rewrite is permitted.

## 11. Recency / verification evidence

Current recency reads signed `flight_verifications` bound to the exact flight revision/hash for instructor evidence. It does not treat a typed instructor name alone as equivalent to a signed verification.

This supports removing automatic name-to-account binding: explicit account request/signature is the stronger evidence domain and remains intact.

## 12. GPS

GPS remains PIC-only.

F2.4 does not promote any RoleCrew role into GPS and does not add interim common/per-part RoleCrew semantics. F4 remains the owner of that work.

## 13. Proposed F2.4 implementation split

### F2.4A — identity-binding reconciliation
Runtime-safe, frozen-contract work:

- remove `autoRequestTrainingVerification()` from Certification;
- remove its name-matching DB lookup;
- keep Certification v8 and lock/hash behavior unchanged;
- keep explicit post-certification `instructor_id` request flow;
- update verification-panel copy so it no longer promises automatic matching/request;
- add source + PostgreSQL/browser regression coverage proving typed names do not bind accounts.

### F2.4B — evidence-aware semantic canonicalization
Review-gated:

- reconcile PIC-name source precedence with `roleCrewSpec()`;
- preserve raw evidence where storage is overloaded;
- do not clear non-DUAL `instructor` while it carries differences/familiarisation evidence;
- do not clear non-SPIC/PICUS `verification_*` while it carries generic endorsement evidence;
- if any editable-Save cleanup is introduced, prove each cleared field is non-applicable under Role + evidence + training/endorsement context;
- no certified-row mutation.

### F2.4C — cross-path characterization
Before F2.5:

- Manual role switch and ordinary Edit;
- Certification before/after removal of name inference;
- explicit connected instructor request and in-person signature;
- shared materialization;
- print/read-only/CSV/XLS;
- audit and backup/restore;
- recency exact signed-verification dependency;
- GPS remains PIC-only.

## 14. Acceptance criteria

F2.4 cannot be marked DONE until:

- no runtime path converts DUAL/SPIC/PICUS text into an account ID by name matching;
- explicit account-bound verification remains available and exact-revision/hash bound;
- Certification v1–v8 compatibility is unchanged;
- raw evidence is not destructively erased without a proven applicability rule;
- certified rows are not rewritten;
- Safety Pilot F2.3 semantics regressions stay green;
- shared-flight recipient semantics stay green;
- ROADMAP / FEATURES / CHANGELOG / F2 design are reconciled with verified runtime evidence.
