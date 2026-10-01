# Independent Review Handoff — Flight Entry Workflow 3.0 / F2.4

> **Review status:** REQUESTED · read-only architecture/data-integrity review before F2.4 runtime canonicalization.  
> Repository baseline used for discovery: `main@367147cce44d1dcb3a28f14b8f9e55c905d0cc20`.

## Reviewer role

Act as an independent read-only reviewer. Challenge the proposed F2.4 design against the repository contract and data-integrity constraints. Do not write implementation code.

Repository: `filipto861/flytally-logbook`

Primary documents:
- `ROADMAP.md`
- `FEATURES.md`
- `CHANGELOG.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F2_ROLE_CREW_DESIGN.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F24_PRODUCER_CONSUMER_AUDIT.md`
- `docs/product/FLIGHT_ENTRY_WORKFLOW_3_0_F0_FIELD_CONSUMER_MATRIX.md`

Primary runtime:
- `lib/role-crew.ts`
- `lib/flight-input.ts`
- `lib/logbook-print.ts`
- `lib/fcl050-compliance.ts`
- `components/flight-form.tsx`
- `app/(protected)/flights/actions.ts`
- `app/(protected)/flights/certification-actions.ts`
- `app/(protected)/flights/instructor-actions.ts`
- `lib/training-verification.ts`
- `app/(protected)/flights/shared-actions.ts`
- `app/(protected)/flights/[id]/page.tsx`
- `app/(protected)/print/page.tsx`
- `app/api/export/route.ts`
- `lib/account-backup.ts`
- `lib/recency-service.ts`

## Current verified state

F2.3 is DONE / PRODUCTION VERIFIED.

- PR #209 merged as `d90215f88514e953e062980798954c497ca76be7`;
- Verify #1077 PASS: TypeScript, 1048/1048 unit/regression, PostgreSQL 66/66;
- Browser #453 PASS: production build, Chromium 32 passed / 2 skipped;
- production Vercel `dpl_84eHWKabeoy8DqgGuM6rDATjTTjR` READY for that exact runtime SHA;
- F2.3 Safety Pilot connected identity is explicit account-ID metadata, server-authoritative, fail-closed and separate from the historical commander snapshot;
- DB migration: N/A.

## Frozen F2 decisions

- account links are never inferred from names;
- connected identity and historical display-name text are separate evidence;
- certified rows are immutable; no historical backfill or guessed repair;
- Certification payload v1–v8 remains unchanged;
- GPS remains PIC-only throughout F2;
- CO-PILOT / CRUISE-RELIEF CO-PILOT commander remains Save-optional and Certification-required;
- PAX / OBSERVER commander remains Save-optional;
- self-PIC roles PIC/SOLO/FI/INSTRUCTOR/EXAMINER use account ownership as canonical PIC identity and do not require a stored commander;
- DUAL uses `instructor` as Instructor/PIC identity;
- SPIC/PICUS use `verification_name` as supervising PIC/FI identity and require `verification_reference`;
- broad Role-only clearing is prohibited because crew fields have non-role evidence consumers.

## Confirmed repository findings

### 1. Name-to-account inference still exists

`certification-actions.ts` currently has `autoRequestTrainingVerification()`.

For DUAL/SPIC/PICUS it:
- reads typed `instructor` / `verification_name`;
- searches accepted instructor-labelled Connections;
- compares `users.display_name` using case-insensitive string equality;
- if one account matches, creates an account-bound request.

This violates the frozen no-name-inference rule.

There is already an explicit account-ID flow:
- flight detail loads accepted instructor Connections by account ID;
- `requestInstructorApproval()` receives `instructor_id`;
- `upsertInstructorRequest()` rechecks accepted Connection state;
- request/signature remains exact revision/hash bound.

### 2. Instructor storage is overloaded

`instructor` is DUAL role identity, but outside DUAL `normalizeFlightDraft()` also uses the presence of `instructor` to preserve:
- `AIRCRAFT_DIFFERENCES`;
- `AIRCRAFT_FAMILIARISATION`.

Existing tests cover this.

Therefore broad non-DUAL clearing would destroy supported training evidence.

### 3. Verification storage is overloaded

`verification_name` / `verification_reference` are SPIC/PICUS role identity/countersignature evidence.

They are also used by current FCL.050 warning logic as generic test/check or revalidation endorsement evidence, driven by task/note regexes.

Therefore broad non-SPIC/PICUS clearing is unsafe, and regex detection should not become authority for destructive cleanup.

### 4. Commander semantics have one unresolved inconsistency

`roleCrewSpec()` says PIC/SOLO/FI/INSTRUCTOR/EXAMINER are self-PIC roles.

Current `pilotInCommandName()` instead resolves:
1. DUAL instructor;
2. SPIC/PICUS verifier;
3. any explicit commander;
4. self account for self-PIC roles.

Thus a stale commander can override canonical self identity in Certification/print output.

### 5. Shared materialization is a separate producer

`materializeParticipation()` explicitly creates recipient commander semantics from participation context and recalculates recipient role credit. It does not simply clone Manual RoleCrew fields.

### 6. Raw fields are externally observable

- CSV/XLS exports raw commander/instructor/verification fields.
- Audit tracks them.
- Backups preserve full flight rows.
- Certification hash v1 includes them.
- Print/read-only consumes semantic PIC resolution and SPIC/PICUS verification remarks.

## Draft F2.4 design

### Stage A — identity-binding reconciliation

Proposed as mandatory and low-risk:
- delete/retire `autoRequestTrainingVerification()`;
- remove automatic name-matching DB query from Certification;
- Certification still certifies/locks exactly as before but sends no account request implicitly;
- explicit post-certification `instructor_id` request remains;
- in-person signature remains;
- update flight-detail copy so it never says the typed name will automatically match/send;
- add regression coverage proving typed names do not create account-bound requests.

No schema migration. No certification version change.

### Stage B — evidence-aware semantic canonicalization

Proposed:
- no broad field clearing;
- preserve raw overloaded instructor/verification evidence;
- consider reconciling `pilotInCommandName()` to the RoleCrew contract without rewriting rows.

Draft preferred PIC resolution:
1. DUAL → instructor;
2. SPIC/PICUS → verification_name;
3. self-PIC roles → owning account name;
4. commander-based/external roles → commander;
5. otherwise unavailable.

This would preserve raw commander in storage/export/audit/backup but make it non-authoritative for self-PIC semantics.

Important risk: this changes the interpreted PIC output of already-certified self-PIC rows that contain a stored commander, even though their raw row and certification hash remain untouched.

### Stage C — cross-path regression

Characterize:
- Manual Edit/role switching;
- Certification;
- explicit instructor request;
- in-person signature;
- shared-flight materialization;
- print/read-only/export;
- audit/backup;
- recency exact signed-verification behavior;
- Safety Pilot F2.3;
- GPS PIC-only.

## Questions for independent review

Please answer these explicitly.

1. **Stage A verdict:** Is removing the Certification-time name matcher and relying on the existing explicit post-certification `instructor_id` request the correct replacement, or is an explicit pre-certification account ID required for any existing product invariant?

2. **Request timing:** Does Certification need to create any verification request at all, or should Certification and account-bound verification remain strictly separate user actions?

3. **Self-PIC commander:** Which is safest?
   - A: clear commander on future editable Save;
   - B: preserve raw commander but make self account win semantically in `pilotInCommandName()`;
   - C: preserve current commander-over-self behavior.
   Evaluate certified-history/output compatibility, not just code simplicity.

4. **Overloaded instructor:** Do you agree that no non-DUAL `instructor` clearing is safe while differences/familiarisation purpose evidence depends on it?

5. **Overloaded verification fields:** Do you agree that no broad non-SPIC/PICUS `verification_*` clearing is safe while generic endorsement evidence shares those columns and is detected heuristically?

6. **Heuristic evidence:** Should F2.4 explicitly forbid using task/note regex matches as an authority for destructive canonicalization?

7. **Shared materialization:** Is it correct to keep participant materialization as a separate explicit producer instead of forcing it through Manual-only canonicalization logic?

8. **Certification compatibility:** Would changing only PIC display/compliance resolution order, without changing stored rows or certification hash payload, violate the project's frozen certification compatibility expectation in your view?

9. **UI:** After removing automatic matching, should the DUAL/SPIC/PICUS typed name fields remain text-only historical evidence while the connected-account request is chosen only after Certification?

10. **F2.4 closeout:** Is it acceptable for F2.4's canonicalization result to be intentionally non-destructive for overloaded fields, with storage separation deferred to a future additive model, as long as semantic authority is explicit?

11. Identify any missing producer/consumer that would make the audit incomplete.

## Requested response structure

1. Verdict: APPROVE / APPROVE WITH CHANGES / BLOCK.
2. Blocking findings.
3. Stage A verdict.
4. Self-PIC commander recommendation.
5. Instructor evidence recommendation.
6. Verification evidence recommendation.
7. Shared-materialization recommendation.
8. Certification/hash/history compatibility concerns.
9. Missing consumers/tests.
10. Exact implementation order you recommend.
11. Any item that must be decided by Filip before runtime work.

Do not propose:
- name-based account inference;
- guessed historical repair;
- rewriting certified rows;
- changing certification payload v1–v8;
- GPS role expansion in F2;
- a second flight model.
