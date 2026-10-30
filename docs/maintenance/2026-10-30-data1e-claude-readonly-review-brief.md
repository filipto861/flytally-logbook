# Claude independent security / restore review — DATA-1E2 (READ-ONLY)

> **Copy-and-paste handoff. Review only, NOT an instruction to implement, push, test an external database, merge, deploy or alter the product.**
>
> **Review status: REQUEST READY / CLAUDE REVIEW NOT RUN.** Do not claim independent review has happened until a real Claude response exists and findings are reconciled against source.

**Repository:** `filipto861/flytally-logbook` (private). **Not** `flytally-training`.  
**Canonical production-facing GitHub main (verified):** `807f281e5870164b794d001480ecc84e0b45aea5`.  
**Exact unmerged candidate SOURCE SHA for review:** `16a94e051037b680f7b08e97e8880e7967ada062` (Draft [PR #443](https://github.com/filipto861/flytally-logbook/pull/443), stacked on #442 `bb60178bebdbb7b0242474bc7b0fedfd99268567`; parent #434..#443 stack remains unmerged).  
**Exact design snapshot SHA:** `3edcfceea5561ef296fbf66e00c703c6a67e2811` (Draft [PR #444](https://github.com/filipto861/flytally-logbook/pull/444), stacked on #443; docs-only).  
**Primary design:** [source-verified DATA-1E acceptance plan](https://github.com/filipto861/flytally-logbook/blob/3edcfceea5561ef296fbf66e00c703c6a67e2811/docs/maintenance/2026-10-30-data1-v13-authenticated-acceptance-design.md).  
**Archived real transport evidence:** [DATA-1D Neon HTTP 3/3 PASS, cleanup verified](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/docs/maintenance/2026-10-30-data1-neon-http-stored-live-pass-evidence.md).

**Authority caution:** main is the canonical repository baseline; none of #434–#444 is merged or production. The reviewer must distinguish *what the unmerged candidate code does* from *what production currently runs*. Do not infer production DB schema/feature flags; these are **UNKNOWN**. Prior Vercel deployment `dpl_F2jdeRmYPGw4K2mZyvwUVii8SXAU` was READY from `55c8076e1eb8104c14392e15b272b33e0eb29607`, not this draft. Neon inventory verified only three existing protected projects; disposable DATA-1D project was deleted after owner approval and is no longer available.

---

## 1. Instructions to Claude (you are an adversarial, independent reviewer)

**Role:** Senior security / PostgreSQL / Next.js / backup-restoration reviewer, challenging the design and implementation, not an implementer. Do a bounded **read-only** source audit of authenticated, signed portable backup version 13 and server-stored gzip/Base64 backup download/restore. This is an aviation-logbook data-integrity feature. Certification, void history, participant evidence and provenance must not be silently rewritten, imported with the wrong owner, or misreported as verified. Security correctness and recoverability take precedence over convenience.

1. Open the actual private GitHub repository with an authorized connector or pre-supplied repository files. Fetch the **exact frozen SOURCE SHA `16a94e051037b680f7b08e97e8880e7967ada062`** for executable files/tests, the **exact frozen DESIGN SHA `3edcfceea5561ef296fbf66e00c703c6a67e2811`** for the acceptance proposal, and canonical `main@807f281e5870164b794d001480ecc84e0b45aea5` as background. Do not substitute branch HEAD, main HEAD or a previous chat summary.
2. Read `AGENTS.md`, `.agents/skills/README.md`, `.agents/skills/database-security/SKILL.md`, `.agents/skills/testing-quality/SKILL.md`, `.agents/skills/release-workflow/SKILL.md`, `.agents/skills/flight-integrity/SKILL.md`, relevant `DEVELOPMENT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, and `docs/AI_HANDOFF_TEMPLATE.md`. Follow actual source and tests over prose; the skills supply method but not authority to change code.
3. Independently trace each trust boundary from session and GET through DB selection, gzip/Base64 decode, v13 parsing/signature verification, preview, ownership, safety-backup creation, atomic restore SQL, and concurrency/audit effects. Verify every claim by **file and line at the specified source SHA**.
4. **Separate observations from hypotheses.** A missing check in one function may be enforced elsewhere. Don't label a confirmed vulnerability or PASS without demonstrating the full path. If access to the private repository or a critical file is unavailable, state **UNVERIFIED / BLOCKED** and identify the exact missing nonsecret source; do not assume content.
5. Provide architecture/security recommendations and candidate test design **only**. No code edits, commits, new PRs, actions, downloads of real backups, SQL connections/queries, test fixtures in Neon, external execution, deployment, migration, prod flag changes, or file/DB deletion. Do not request/share credentials, personal pilot data or real GPS tracks.
6. Owner **Filip** decides product trade-offs. If a proposed safety fix changes compatibility, signed-v13 contract, supported sizes, recovery semantics or user behavior, label the decision required; don't silently freeze it.

### Strict DO / DO NOT

**DO:** audit the frozen SHA, show line-based evidence, identify fail-closed edge cases, propose smallest backward-compatible fixes and negative acceptance tests; separate **PASS vs NOT RUN vs UNKNOWN** evidence.

**DO NOT:** modify `main`/any PR, create another branch, deploy, merge, write or delete any database, weaken certification/auth, export flight or GPS data, conflate Training and Logbook, run destructive tests on Logbook Shadow/Training Production/Training Acceptance, invent provider limits or regulatory approvals.

---

## 2. Immutable source file index (read these exact revisions)

The links below point to **unmerged** candidate code at `16a94e051037b680f7b08e97e8880e7967ada062`; if your repository connector cannot read them, fail closed and report the missing files. Any additional dependency or validator discovered from the imports must also be read at the same SHA.

| Contract | Frozen source |
|---|---|
| Stored download API, response headers/errors/auth | [`app/api/backups/[id]/route.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/app/api/backups/%5Bid%5D/route.ts), especially lines **6–9** |
| Stored gzip/Base64 creation, retention, owner SELECT, decompression | [`lib/backup-center.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/backup-center.ts), **13–53** |
| Portable-file restore vs stored restore and preview confirmation | [`app/(protected)/export/actions.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/app/%28protected%29/export/actions.ts), **23–25, 60–87** |
| Signed MVCC snapshot builder, validation, digest and HMAC | [`lib/account-backup.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/account-backup.ts), **15–68** |
| Pre-sign source validation/limits | [`lib/account-backup-presign.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/account-backup-presign.ts), **32–85** |
| MVCC 32-result verification | [`lib/account-backup-snapshot.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/account-backup-snapshot.ts), **30–72** |
| Backup parser, counts, ownership, void history | [`lib/portable-backup.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/portable-backup.ts), **124–265** |
| Server signature and source user binding | [`lib/backup-authenticity.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/backup-authenticity.ts), **5–20**; [`lib/verification-signature.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/verification-signature.ts) |
| Exact restore classification, protected conflicts, transaction | [`lib/account-restore-v6.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/account-restore-v6.ts), **47–85, 92–215, 220–285** |
| Login session and revocation | [`lib/auth/session.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/auth/session.ts), **1–47**; [`lib/auth/require-user.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/auth/require-user.ts) |
| Database adapter, migration side effects / v21 gate | [`lib/db.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/db.ts); [`lib/db-optimization.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/lib/db-optimization.ts), especially **1041–1111** |
| Recovery page initiates daily backup | [`app/(protected)/data/page.tsx`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/app/%28protected%29/data/page.tsx), **14–19** |
| User-facing stored preview and confirmation | [`components/backup-center.tsx`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/components/backup-center.tsx) (source review only; **do not** review styling or redesign UI) |
| Existing relevant tests | [`tests/v350-backup-v13.test.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/tests/v350-backup-v13.test.ts), [`tests/v381-data1-backup-presign.test.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/tests/v381-data1-backup-presign.test.ts), [`tests/v381-data1-backup-snapshot.test.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/tests/v381-data1-backup-snapshot.test.ts), [`tests/integration/postgres-backup-v13-void-history.test.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/tests/integration/postgres-backup-v13-void-history.test.ts), [`tests/integration/postgres-security-restore.test.ts`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/tests/integration/postgres-security-restore.test.ts) |
| Canonical risk/verification requirements | [`DEVELOPMENT.md`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/DEVELOPMENT.md), [`ARCHITECTURE.md`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/ARCHITECTURE.md), [`ROADMAP.md`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/ROADMAP.md), [`docs/AI_HANDOFF_TEMPLATE.md`](https://github.com/filipto861/flytally-logbook/blob/16a94e051037b680f7b08e97e8880e7967ada062/docs/AI_HANDOFF_TEMPLATE.md) |

**Source anchoring:**
- `app/api/backups/[id]/route.ts:7–8`: get session → parse positive safe ID → `loadStoredBackup(session.userId,id)`; success JSON/attachment/private-no-store; errors converted to 404 using `error.message`.
- `lib/backup-center.ts:35–38`: 50 MiB **compressed-at-creation** guard before storing gzip Base64; `50 MiB` is not evidence of response/decompressed safety or a Neon HTTP provider maximum.
- `lib/backup-center.ts:50–53`: `SELECT ... WHERE id=... AND user_id=...`, `gunzipSync(...)` without explicit `maxOutputLength`, `parsePortableBackup`, DB stored digest equality.
- `app/(protected)/export/actions.ts:76–85`: portable v13 import requires `portableBackupAuthenticity(...) === "verified"`; stored path runs `loadStoredBackup` then passes `{trustedSharedState:true, authenticity:"stored"}` without a separate HMAC verification call.
- `app/(protected)/export/actions.ts:62–73`: preview digest and literal RESTORE confirmation before a `pre_restore` stored backup; the latter happens before the restore execution, in a separate operation.
- `lib/account-restore-v6.ts:119–215, 220–283`: preflight/identity checks vs later `sql.transaction(queries)`. Establish actual invariant and race behavior before proposing changes.
- `lib/auth/session.ts:27–38` and `app/(protected)/data/page.tsx:14–19`: session access calls schema ensure; recovery page can create automatic backup. An apparent GET/preview is not inherently a read-only test.

These are **leads to verify**, not a predetermined verdict.

---

## 3. Bounded reviewer questions — answer each explicitly

**Q1 — Stored backup authenticity and trust (HIGH):** Does `loadStoredBackup` guarantee server provenance, or only coherence of stored bytes and a digest? Can a stored v13 record carrying the matching recomputed digest but invalid/missing server HMAC enter `prepareExactAccountRestore` with trusted shared-state history? Examine origin and permissions of `account_backups`; distinguish untrusted user-controlled input, server DB trust, DB compromise, and legitimately stored legacy backup. Recommend the smallest policy for v13 and an explicit compatibility story. **Challenge the existing design assertion; do not merely endorse it.**

**Q2 — Upload/download expansion and memory caps (HIGH):** Enumerate raw-body, Base64 field, compressed gzip, decompressed JSON, parsed object, Next.js response and database transport limits separately. What is already enforced (50 MiB compressed at create; 150 MiB uploaded JSON import) versus missing at read? Design a safe fail-closed decompression limit and testable bounded denial-of-service behavior without arbitrarily assuming a Neon limit, OOM-testing a real server or breaking legitimate large archives. Require actual evidence before choosing numeric limits.

**Q3 — Auth and object access (HIGH):** Can user B or an unauthenticated/revoked session retrieve, infer, preview or restore user A's stored backup by guessing ID? Review `getSession`, `requireUser`, SQL `id + user_id` checks and GET response status/headers for success, error, 400, 401, 404, cache behavior, and server action return paths. Include malformed IDs, cross-account signed file, stale sessions, user deactivation, JSON error leakage and replay.

**Q4 — Preview digest, TOCTOU, atomicity and concurrent restores (HIGH):** Compare `prepareExactAccountRestore` to `executeExactAccountRestore` and `createStoredBackup(...,"pre_restore")` on a separate transaction. Could a current-state change between preview and execution produce lost/incorrect evidence, undetected id collisions or partial state? Distinguish (a) main restore SQL atomicity, (b) separate safety-backup writes, and (c) PostgreSQL sequence effects and trigger/audit changes. Propose adversarial *local synthetic* transaction tests.

**Q5 — Signed certified and voided history (HIGH):** Confirm account binding, revision completeness, cryptographic fingerprints, immutable void/tombstone conflicts, source provenance and server-authoritative shared data on both portable and stored paths. Does `trustedSharedState` admit foreign evidence that the pre-sign validator should have rejected? Analyze regression risk without manufacturing regulatory claims.

**Q6 — Errors and metadata (MEDIUM):** Evaluate GET 404 `error.message`, different failure timing/messages, secrets/certification details in logs or response, and client-readable endpoints. Propose safe external failure shapes with server diagnostics separate. Examine whether missing/deleted foreign IDs and malformed gzip can differ in a data-leaking way.

**Q7 — Runtime/schema safety (HIGH):** Read `ensureDatabaseOptimizations`, v21 migration policy, auth and GET side effects, scheduled backup and `/data?view=recovery` auto-create. Is the proposed **isolated 127.0.0.1 PostgreSQL16, Node24, fully migrated synthetic accounts A/B** plan complete and executable using only existing repo-supported machinery? Identify precise preflight evidence needed to avoid a remote/prod target, env contamination or unexpected migration. Do **not** run it.

**Q8 — Acceptance coverage, missing tests, smallest safe milestones (HIGH):** Critique the proposed A0–A11 matrix in the design doc. Identify gaps in positive/negative/corrupt/large/concurrent/idempotent tests, source-vs-runtime evidence, budget, cleanup and signing-key rollover. Rank any minimum required code hardening **before** HTTP restore testing, and separate optional future improvements. Must preserve existing Flight and Training boundaries.

**Q9 — Architecture alternatives and migration/backward compatibility:** Offer at most **two** evidence-based options for any owner decision (e.g. enforce HMAC on stored v13 vs explicitly trust server-owned record with another proven provenance mechanism). Explain backwards compatibility, operational cost, failure modes, migration/schema implications and how to roll back. Do not choose the product policy in place of the owner.

---

## 4. Required output: independent reviewer response format

Respond as a Markdown report, not code. In this exact order:

1. **Verdict:** `APPROVE`, `APPROVE WITH CHANGES`, `BLOCK`, or `UNVERIFIED` (if source inaccessible). State exactly **what** is approved/blocked: *design adequacy for future isolated acceptance*, **never** production release. Mark any finding requiring code hardening before a live fixture.
2. **Repository evidence / identity:** exact code/source SHA(s), how accessed, `main` vs Draft differences, files actually read and any missing files; no generic imagined runtime facts.
3. **Findings table** ordered by severity `P0/P1/P2/P3`, each with: **ID, severity, category, exact `path:line` + SHA, observed code behavior, plausible failure/threat preconditions, impact on flight/certification integrity or account privacy, confidence `CONFIRMED SOURCE / HYPOTHESIS / UNKNOWN`, minimal remediation, backward-compatibility and specific test**. If no finding, say `NO FINDING` and why.
4. **Answer Q1–Q9 individually**, with independent reasoning, not paraphrasing the proposed design.
5. **Acceptance matrix critique:** retain/edit/reject each A0–A11 case; identify unsafe assumptions or missing cases; distinguish tests possible with unit harness vs actual isolated local PG16 HTTP/session vs separately approved restore.
6. **Owner decision table** (max 4 decisions): recommended default, alternative, trade-offs and whether **Filip's explicit approval** is required. No self-authorization of a migration, DB write, deploy or changed trust policy.
7. **Minimal next milestone proposal:** precise scope, dependencies, acceptance criteria, test types, DO/DO NOT, rollback and **one next step**. Separate **must-fix before isolated test**, **must-fix before release**, and **deferred**.
8. **Evidence ledger**: label all actual test outcomes `PASS/FAIL/PARTIAL/NOT RUN/UNKNOWN` with exact SHAs and distinguishing DATA-1D *transport* from DATA-1E *application* acceptance.
9. **Concluding reviewer self-check:** no code, git mutation, network/database access, credentials or private flight/GPS data, and no deployment or merge.

**Do not execute the acceptance matrix or return suggested patches as applied.** This is one independent read-only review, not an open-ended agent loop.

---

## 5. Evidence baseline / limits Claude MUST preserve

| Gate | Observed state / authority |
|---|---|
| Main and draft GitHub identity | Main `807f281e5870164b794d001480ecc84e0b45aea5`; #443 source `16a94e051037b680f7b08e97e8880e7967ada062`, #444 design snapshot `3edcfceea5561ef296fbf66e00c703c6a67e2811`; all unmerged |
| DATA-1D real provider network | **PASS 3/3** stored gzip/Base64 1/4/12MiB via owner's Windows Node24, exact executable `60affbabda8e377656c9a6ec82e63e227803929d`; GET/restore **not** covered |
| DATA-1D independent provider corroboration | Three synthetic rows and exact raw/gzip/Base64 lengths read via read-only Neon SQL; independent SQL did not re-hash full payload |
| DATA-1D cleanup | **PASS**: owner-authorized deletion `purple-lab-22755259`; fresh Neon list had only three original protected projects |
| Prior offline tests | Neon pinned driver in-process mocked HTTP 10/10, hosted Windows fake-node launcher 4/4, full Node 1,775/1,775/typecheck/build PASS at their **prior recorded SHAs**, **not** new DATA-1E acceptance |
| New signed-v13 authenticated app GET, portable restore and stored restore | **NOT RUN** |
| Cross-account HTTP with real session, corrupt/archive limit, race/atomic rollback, browser acceptance | **NOT RUN** |
| New DB, local PG16 synthetic A/B fixture / actual restore | **NOT CREATED/NOT RUN** for DATA-1E |
| Canonical current-candidate `verify:release:risk` | **NOT RUN** |
| Production DB v21 schema/flags and provider absolute HTTP max | **UNKNOWN** |
| Production release | **NO AUTHORIZATION**, Draft stack, live production remains earlier deployment |

**Additional nuance:** `signed-v13` refers to application portable JSON with verified server HMAC/digest and protected-history semantics; a synthetic unsigned gzip/Base64 roundtrip is not equivalent. `GET /api/backups/[id]` cannot be declared authenticated merely because a helper was unit-tested. `main` and Draft source may differ widely; do not treat proposed DATA-1 features as shipped.

---

## 6. Suggested Claude kickoff message (copy this, with a link to this review brief)

**Claude: Perform an independent READ-ONLY security and data-integrity review of FlyTally Logbook DATA-1E signed-v13 authenticated backup GET/restore. Use the exact unmerged source SHA `16a94e051037b680f7b08e97e8880e7967ada062` and design snapshot SHA `3edcfceea5561ef296fbf66e00c703c6a67e2811` from the private GitHub repository `filipto861/flytally-logbook`. My full task brief is `docs/maintenance/2026-10-30-data1e-claude-readonly-review-brief.md` on Draft PR #444. First confirm you can actually access the repository and its exact commits. Read the prescribed source files, validators and tests, then challenge—not rubber-stamp—the HMAC trust model for stored v13, gzip expansion limits, user ownership, API errors, pre-restore backup and transactional race safety. Produce the Q1–Q9 assessment, P0–P3 file:line findings, A0–A11 acceptance critique, owner decisions and one next step. No code edits, SQL, database connections, external execution, merge, deploy or claims of tests not run. If private GitHub access is missing, say UNVERIFIED and request specific nonsecret file excerpts; never infer code from a summary.**
