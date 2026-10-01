# Independent Review Handoff — Flight Entry Workflow 3.0 / F2.4B

> **Status:** REQUESTED · read-only architecture/data-integrity review before any F2.4B runtime semantic change.  
> **Repository baseline:** `main@95a1f88f7fa7380669339fefd87a8831e64e0949`.  
> **Previous milestone:** F2.4A DONE / PRODUCTION VERIFIED.

## Reviewer role

Act as an independent reviewer. Challenge the proposed F2.4B direction against existing data provenance, certified-history compatibility, shared-flight semantics and the current repository behavior. Do not implement code.

Repository: `filipto861/flytally-logbook`

Primary files:
- `lib/role-crew.ts`
- `lib/logbook-print.ts`
- `lib/fcl050-compliance.ts`
- `lib/flight-input.ts`
- `components/flight-form.tsx`
- `app/(protected)/flights/shared-actions.ts`
- `lib/certification-integrity.ts`
- `app/api/export/route.ts`
- `app/(protected)/print/page.tsx`
- `tests/flight-role-crew.test.ts`
- `tests/logbook-print.test.ts`
- `tests/fcl050-compliance.test.ts`

Supporting design/audit:
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F2_ROLE_CREW_DESIGN.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F24_PRODUCER_CONSUMER_AUDIT.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F24_REVIEW_HANDOFF.md`

## Current verified state

F2.4A removed Certification-time DUAL/SPIC/PICUS display-name → account inference.

- PR #212 merged as `06b50d911e0cedcafbd5f10bea41868098f8d8b0`;
- final PR-head Verify #1089 PASS: TypeScript, 1052/1052 unit/regression, PostgreSQL 66/66;
- Browser #465 PASS: production build, Chromium 34 passed / 2 skipped;
- production Vercel `dpl_DP43Y79vK4Kny2L86Wuw5VCjAoHH` READY for that exact merge SHA;
- `fly-tally.com` aliases the deployment with no alias error;
- no schema migration;
- Certification v1–v8 unchanged.

## Frozen F2 constraints

- no account identity inference from names;
- certified rows are immutable; no backfill or guessed repair;
- raw crew fields remain externally observable in export/audit/backup and are part of certification payload history;
- GPS remains PIC-only through F2;
- Safety Pilot F2.3 connection resolver is unchanged;
- broad Role-only clearing of `instructor` or `verification_*` is prohibited because those fields have non-role evidence consumers;
- no destructive canonicalization based on task/note regex heuristics.

## F2.4B discovery — important new evidence

The earlier F2.4 draft preferred making account SELF override a stored `commander` for self-PIC roles. Fresh repository reconstruction found stronger compatibility evidence against doing that blindly.

### 1. Current downstream PIC precedence

`pilotInCommandName()` currently resolves:
1. DUAL → `instructor`;
2. SPIC/PICUS → `verification_name`;
3. any stored `commander`;
4. PIC/SOLO/FI/INSTRUCTOR/EXAMINER → owning account display name;
5. unavailable.

This helper feeds FCL.050 Certification and print/read-only output.

### 2. RoleCrew contract currently says SELF

`roleCrewSpec()` currently sets:
- PIC/SOLO/FI/INSTRUCTOR/EXAMINER: `selfIsPic=true`, `picNameSource="SELF"`, `commander="not_applicable"`.

That is a useful Save/UI policy, but it is stricter than the existing persisted/output semantics.

### 3. Manual UI still exposes explicit Commander / PIC on self-PIC roles

For every non-DUAL role except Safety Pilot, `components/flight-form.tsx` exposes **Additional crew details → Commander / PIC**.

Therefore a PIC/FI/etc record can intentionally contain an explicit commander value. The field is not merely unreachable stale storage.

### 4. Shared-flight materialization intentionally writes commander on a PIC row

`materializeParticipation()` creates recipient logbook rows.

For participant role PIC:
- with `RECIPIENT_ACCOUNT`, it snapshots the participant display name into `commander`;
- with `CERTIFIED_SOURCE_COMMANDER`, allowed only for the linked Safety Pilot Actual PIC path, it preserves the certified source `commander` snapshot;
- the materialized recipient role is `PIC`.

Therefore a self-PIC row with a non-empty `commander` can be deliberate provenance, not just stale Manual data.

### 5. Raw commander is integrity-visible

`commander` is:
- included in certification payload/hash history;
- exported raw in CSV/XLS;
- retained by backup;
- audit-visible;
- printed semantically through `pilotInCommandName()`.

Changing only semantic resolution would leave the certified hash valid while changing what an old certified row prints/displays as PIC.

## Risk assessment

### Earlier option B — SELF wins semantically, raw commander preserved

This is non-destructive at storage level, but it is **not output-compatible**:
- existing certified self-PIC records with explicit commander could print a different PIC name;
- shared PIC materialization can intentionally preserve a historical commander snapshot that would become ignored;
- account display-name changes could retroactively alter printed PIC identity on those rows.

Because backward compatibility and source evidence outrank conceptual cleanup, this is now considered higher-risk than the original draft suggested.

### Option A — clear commander on future editable self-PIC Save

This avoids rewriting certified rows but is still destructive to editable rows and can erase explicit Manual/shared provenance. The current UI deliberately allows that value, so a blanket clear is not currently justified.

### Option C — preserve current commander-over-SELF output precedence

This best preserves existing behavior and certified interpretation. The inconsistency then lives in the RoleCrew model: `picNameSource="SELF"` is not a complete description of output precedence.

## Proposed F2.4B direction

### B1 — reconcile the contract, not historical data

Preferred design:
- keep `pilotInCommandName()` behavior unchanged unless independent review finds a stronger invariant;
- do not clear `commander`, `instructor` or `verification_*` broadly;
- separate **Save requirement / UI applicability** from **semantic PIC display precedence** in the RoleCrew model;
- treat SELF as the default/account identity source for self-PIC roles, while an explicit stored commander remains historical PIC text with current backward-compatible precedence;
- connected/account binding remains separate metadata and is never inferred from the stored text.

A minimal implementation could replace the singular `picNameSource` concept with two explicit concepts, for example:
- `requiredPicIdentitySource`: SELF / INSTRUCTOR / VERIFIER / COMMANDER / EXTERNAL;
- `storedCommanderMeaning`: NOT_REQUIRED / OPTIONAL_HISTORICAL / EXTERNAL_SNAPSHOT.

Exact naming is not frozen; the goal is to stop using one enum for both Save/UI and downstream interpretation.

### B2 — no destructive canonicalization in F2.4B

Unless the review identifies a field/value combination that is provably non-applicable from explicit structured evidence:
- preserve raw values on editable Save;
- no task/note regex-driven clearing;
- no certified-history mutation;
- no background cleanup.

### B3 — characterize intentional self-PIC commander cases

Add tests before any semantic refactor for:
- Manual PIC with empty commander → SELF fallback;
- Manual PIC with explicit commander → current explicit commander output;
- FI/INSTRUCTOR/EXAMINER equivalent behavior;
- generic shared PIC materialization with `RECIPIENT_ACCOUNT`;
- Safety Pilot linked Actual PIC materialization with `CERTIFIED_SOURCE_COMMANDER`;
- Certification hash unaffected by contract-only refactor;
- CSV/XLS/audit/backup raw commander unchanged.

## Questions for independent review

Please answer explicitly.

1. Does the shared PIC materialization evidence change your answer to the earlier self-PIC commander question?
2. Should current `pilotInCommandName()` commander-over-SELF precedence be preserved for backward compatibility?
3. If yes, should `roleCrewSpec.picNameSource="SELF"` be reinterpreted only as Save/UI/default identity policy, or replaced with separate explicit policy fields?
4. Is blanket future-Save clearing of `commander` on PIC/SOLO/FI/INSTRUCTOR/EXAMINER unsafe given the current Manual UI and shared-materialization producer?
5. Do you agree F2.4B should perform **no destructive crew-field canonicalization** unless structured evidence proves non-applicability?
6. Should shared materialized PIC commander snapshots remain semantically authoritative even if the participant later changes their account display name?
7. Would changing old certified print/compliance interpretation without changing the certification hash violate the project's backward-compatibility expectation?
8. Is a contract-only RoleCrew refactor with unchanged persisted/output behavior an acceptable F2.4B milestone?
9. Are there any hidden consumers that make even a contract-only split unsafe?
10. After B1 characterization, is F2.4C cross-path testing sufficient before F2.5 closeout?

## Acceptance criteria before runtime change

- independent review reconciled against actual repo;
- no certified output meaning changes without an explicit reviewed decision;
- no raw evidence deletion;
- no schema migration unless separation cannot be expressed safely otherwise;
- all existing F2.1–F2.4A behavior preserved;
- Safety Pilot F2.3 and shared PIC provenance preserved;
- GPS remains PIC-only;
- ROADMAP / FEATURES / CHANGELOG / F2 design updated in the same work cycle.
