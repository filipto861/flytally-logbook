# M0-B B1b.2c — Real session/cron/Neon HTTP authority map and isolated parity acceptance (DESIGN ONLY)

**2026-11-03 UTC. Repo:** `filipto861/flytally-logbook`. **Verified main:** `c9c2f60303236113a223942072311f5e37f876f7`. **Base:** Draft #465 `2520bb4129cb65729f2176c59c034f26b154f89e` (stack #464→#455; B0 #454 separate). Owner approved source analysis and safe test planning, not Neon remote SQL/branch provisioning, DB migration, merge, deploy or full Restore activation. No DeepSeek review by owner instruction.

> **Exact read-only evidence:** [GitHub Actions #41603548638](https://github.com/filipto861/flytally-logbook/actions/runs/41603548638) at executable SHA `5df035db7fb17c7d6c10eb41bd38c1839067cbdd`: Node24 syntax PASS, **12/12 PASS** source-bound/pure-cron tests; no `DATABASE_URL`, production DB, Neon HTTP request, session browser or app route execution. This is source verification, NOT live security acceptance.

## Actual authority paths, from current source

### User-facing Trash

1. `app/(protected)/data/page.tsx` obtains `userId` from `requireUser()` and only for `view="deleted"` calls `listDeletedFlights(userId)`. The view parameter does **not** control account ownership.
2. `lib/auth/require-user.ts` uses `getSession()` or redirects to login. `lib/auth/session.ts` reads an HttpOnly `logbook_session` cookie, hashes the token, joins `auth_sessions` with `users` and accepts only non-revoked, non-expired session and `users.active=1`; user ID originates from DB session. Session `role:"admin"|"user"` is **application role**, not Postgres role.
3. `lib/flight-trash.ts:listDeletedFlights` currently calls schema initialization then directly DELETEs expired `deleted_flights` **for that user ID** as a page-read side effect, then SELECTs only this owner's un-restored/unexpired items. It does **not** implement a future V22 owner-gated registry transition.
4. Single-flight Restore uses `app/(protected)/export/actions.ts` and `lib/flight-trash.ts:restoreDeletedFlightRecord`; after successful recovery it marks `restored_at/restored_flight_id` on historical archived row. That row can persist until cutoff while active recovered flight exists. Expiration of archived row must **not** change active event UID to `purged`. Full-account Restore remains blocked by M0-A.

### Scheduled sweep

1. `vercel.json` declares daily `/api/cron/backups` at **02:15 UTC** using `15 2 * * *`. This source configuration does not prove cron ran in production.
2. `app/api/cron/backups/route.ts` first checks exact `CRON_SECRET` Bearer authorization; unauthorized requests return 401 **before** `runPrivacyRetentionSweep()` and backup loop. `lib/cron-auth.ts` fails closed if secret absent/blank, does not trust user-agent.
3. `lib/privacy-account.ts:runPrivacyRetentionSweep` ensures schema, purges revoked public shares and runs a **global** expired `deleted_flights` DELETE in a batch also containing authentication metadata cleanup. This is the **second distinct direct-delete entrypoint**. The cron then selects up to 500 active users and runs automatic backups, with `maxDuration=300`. A future bounded owner sweep needs explicit progress/failure handling.
4. The cron Bearer authorization is **HTTP route authority**, NOT a separate SQL role or authorization for arbitrary per-user operations.

### Account erasure

`app/(protected)/profile/actions.ts:deleteAccount` obtains a real session and requires `DELETE MY ACCOUNT` confirmation; it calls separate Training erasure before `eraseAccountForPrivacy(session.userId)`. The inspected `lib/privacy-account.ts` removes many private collections and anonymizes/deactivates account, but **does not DELETE active flights or FSTD sessions**. Retained signed/voided/audit material, other participants' evidence and future owner-linked UID markers need explicit privacy/regulatory rules. No Training repo changes.

## Neon SQL connection and noninteractive transaction contract

- `lib/db.ts` exports **one cached** SQL query proxy using `neon(DATABASE_URL,{fullResults:false,arrayMode:false})` in production. Local `FLYTALLY_LOCAL_POSTGRES=1` selects a separate psql adapter. `package.json` specifies `@neondatabase/serverless ^1.0.0`. All three inspected caller modules import **the same `sql` client**. No independent per-pilot role, dedicated cron SQL principal or `SET ROLE` exists in those inspected paths; actual Neon production `current_user` and grants remain **UNKNOWN**.
- The prior Draft #465 synthetic NOLOGIN roles are **test fixtures only**, not the current application's production architecture. A PostgreSQL function taking a user-supplied owner ID while all callers share the same SQL principal **does not authenticate that owner**. Before enabling V22, separately approve either a strictly privileged maintenance database identity/credential or other demonstrably enforceable separation; application session authorization and owner-scoped queries remain necessary. Do not auto-create per-pilot DB roles.
- Official Neon docs [README](https://github.com/neondatabase/serverless/blob/main/README.md) and [CONFIG](https://github.com/neondatabase/serverless/blob/main/CONFIG.md) specify `neon().transaction([...])` is **one non-interactive HTTP transaction**. Query objects must be declared before request; JavaScript cannot `await` the result of A and dynamically build B inside the same HTTP transaction. A single batch may perform predefined owner lock then predefined post-lock SQL, while a stored procedure can make server-side decisions, subject to permission/locking review. Actual transport parity was NOT RUN.
- Do not make an interactive transaction by chaining separate `sql` HTTP calls and assuming a cross-request lock persists. WebSocket/Pool/Client is a separate architecture choice, not an approved workaround.

## V22 safety requirements (proposed, NOT deployed)

1. Keep current M0-A full-account Restore blocked, `DATABASE_SCHEMA_VERSION=21`, and no implicit migration registration or runtime V22 DDL.
2. Retention A direction only: stored ~90-day Trash cutoff, then atomic removal of full archived flight/GPS/expenses plus minimum owner+kind+UID marker for a **working additional 12 calendar months** from the original `purge_after`, pending legal/privacy review. No fingerprint unique, no fabricated source identity, no automatic indefinite retention.
3. A future shared owner-scoped cleanup service serves both user Trash list (identity from session) and verified cron (no user session). First transactional statement obtains owner gate, later `READ COMMITTED` SQL freshly reads and locks eligible records. Batch work per owner and deterministic locking; no global lock.
4. Un-restored expired Trash: atomic `trash→purged`, fixed marker cutoff and payload DELETE; already-restored historical archive: delete archive **only**, retain active owner UID and verify `restored_flight_id` matches active flight and UID. Mismatch => rollback. Legacy NULL UID remains untrusted. Void/certified/native audit and independent participants stay separate.
5. Both old direct expired DELETE paths must be made compatible **before** activating strict lifecycle trigger; schema-first expand and flag OFF must preserve old runtime rollback. User, cron and privacy erasure need separate authorizations, not merely arbitrary `owner_id` arguments.

## Future two-client Neon HTTP parity plan — NOT RUN

**Hard prerequisite:** obtain separately scoped owner approval for the **specific positively identified disposable Neon project, branch, database, role(s), fixture scope and cleanup rules**. Provider target identity and non-production status must be confirmed *before* any SQL, including read-only DB probe. No secrets/connection URLs in repo or diagnostics; no authentic pilot data. Missing or ambiguous DB target => STOP. User's present consent authorized this **plan**, not remote SQL/provisioning.

| Check | Acceptance on owner-approved disposable target |
| --- | --- |
| P0 target/role | Verify expected disposable branch/db/`current_user`/PG version and schema, no permissions against prod/staging; reject unknown identity before mutation |
| P1 same-owner concurrency | Two HTTP clients race Restore/cleanup; first-statement owner gate + fresh post-lock owner-qualified SQL avoids stale candidate or row/account deadlock |
| P2 unrelated owner | Separate-owner clients progress independently, no global advisory lock serialization |
| P3 UID | Same owner+kind+UID rejected by DB unique while independent same heuristic fingerprint events allowed |
| P4 restored archive | Expired restored archival copy deleted with live matching owner/UID preserved; forged `restored_flight_id` triggers rollback |
| P5 roles | User cannot run cron/global sweep/privacy erasure, cron cannot impersonate user; test separate DB permissions if actually provisioned |
| P6 legacy/evidence | NULL UID legacy expires without issuer forgery; certified Void/audit, FSTD, other users' evidence remain untouched; fixed +12-month proposed marker |
| P7 failure/rollback | Fault injection after lock and between marker update/delete atomically reverts; retry bounded/idempotent |
| P8 transport | Compare real Neon HTTP batched transaction error/isolation and two-client behavior to prior local PG16 diagnostic; do not infer parity from `psql` |

**Verification:** source-only Actions [#41603548638](https://github.com/filipto861/flytally-logbook/actions/runs/41603548638) executable `5df035db7fb17c7d6c10eb41bd38c1839067cbdd`: syntax PASS; 12/12 PASS with NO DB. Prior synthetic PostgreSQL16 [#41602112295](https://github.com/filipto861/flytally-logbook/actions/runs/41602112295) role/FK 9/9 PASS on a DIFFERENT SHA; not Neon proof. Real Neon HTTP, physical production catalog, exact SQL grants, full Node/typecheck/build, native Windows PG16 164/164, Playwright/risk, V14 issuer, B2 audit and authenticated production smoke **NOT RUN/UNKNOWN**. Production M0-A Vercel READY `dpl_H3e5qcMDqzd9m5NyqmKALVd9qmub` app `f8116a7311abbdc9e1a269e133fccd7f8533f5c0`; production DB/flags UNKNOWN.

**DO NOT:** remote/production SQL/provisioning/migrations, merge, deploy, flag change, full-account Restore activation, certified/audit rewrite, Training changes, DeepSeek review, or lawful-retention claims without legal assessment.

**ONE NEXT STEP:** after separate approval and identification of an owned **disposable Neon HTTP branch and least-privilege roles**, prepare the fail-closed P0–P8 harness and run it only against that approved isolated target.
