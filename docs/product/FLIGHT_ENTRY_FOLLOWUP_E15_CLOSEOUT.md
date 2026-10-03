# Flight Entry Follow-up E1.5 — Verification / Migration / Production Closeout

**Status:** DESIGN / INDEPENDENT REVIEW GATE  
**Repo:** `filipto861/flytally-logbook`  
**Branch:** `feat/entry-followup-defaults-daylight-ux`  
**Baseline main:** `ee6b1d215d803aab3e4d2af12b41d61ddea06fee`

## 1. Reconstructed state

E1.1–E1.4 are DONE / LOCAL VERIFIED.

Verified milestone evidence:
- E1.1: targeted 30/30 PASS; TypeScript PASS; build PASS; authenticated browser 3/3 PASS.
- E1.2: targeted 54/54 PASS; focused migration regression 5/5 PASS; TypeScript PASS; PostgreSQL 2/2 PASS; build PASS; authenticated browser 4/4 PASS.
- E1.3: focused 38/38 PASS; TypeScript PASS; build PASS; authenticated browser 5/5 PASS.
- E1.4: focused 20/20 PASS; TypeScript PASS; PostgreSQL certification/correction 5/5 PASS; build PASS; targeted authenticated browser 1/1 PASS.

Production database evidence from the E1.4 read-only census:
- target database `neondb`;
- transaction read-only verified ON for census;
- schema registry maximum = v17;
- required certification/history tables present;
- exact live `task='GPS import'`: 14 rows across 3 accounts, all 14 certified at observation time;
- zero ordinary draft cleanup candidates;
- no historical production mutation was executed.

Production migration v18 is NOT APPLIED.

The feature branch is ahead of `main` and not behind it. E1.5 must not introduce new product semantics unless a release blocker is discovered.

## 2. E1.5 goal

Close the E1 workstream without mixing three independent concerns:

1. **release verification** of E1.1–E1.4;
2. **schema v18 deployment prerequisite** for nullable aircraft `default_operation_type`;
3. **application merge/deploy/smoke**.

Historical `GPS import` handling remains evidence-preserving and is not part of the schema migration.

## 3. Frozen migration contract — v18

Canonical runtime migration source:

```sql
ALTER TABLE aircraft ADD COLUMN IF NOT EXISTS default_operation_type TEXT;

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname='ck_aircraft_default_operation_type'
      AND conrelid='aircraft'::regclass
  ) THEN
    ALTER TABLE aircraft
      ADD CONSTRAINT ck_aircraft_default_operation_type
      CHECK(default_operation_type IS NULL OR default_operation_type IN ('SP','MP'));
  END IF;
END $$;
```

Migration registry:
- version: `18`
- name: `aircraft default operation type`

Properties:
- additive;
- nullable;
- no DEFAULT;
- no aircraft backfill;
- no flight-table mutation;
- no certification payload/hash/version change;
- no E1.4 Task mutation.

Existing profiles therefore become `NULL`, meaning **no aircraft default**.

## 4. Release sequence

### A. Final local release gate

Before any production write:
1. branch HEAD and clean working tree confirmed;
2. `npm run typecheck`;
3. full `npm test`;
4. full PostgreSQL acceptance with `FLYTALLY_POSTGRES_INTEGRATION=1`;
5. isolated browser DB bootstrap;
6. production build;
7. full authenticated Playwright desktop + mobile.

The final E1.5 evidence must report exact pass/fail counts rather than infer success from earlier milestone runs.

### B. Independent migration/deployment review

A second AI reviews:
- v18 DDL and idempotency;
- fail-closed production preflight;
- rollback/backup strategy;
- ordering of PR/CI, migration, merge and deploy;
- post-migration invariants;
- production smoke;
- risk of runtime auto-migration racing an explicit migration.

No production write happens before this review is reconciled.

### C. PR / CI before production mutation

Preferred ordering:
1. local release gate PASS;
2. open final PR against `main`;
3. require Fast application gate, PostgreSQL acceptance, Chromium desktop + mobile, Classify CI risk and Vercel Preview status;
4. do not merge yet.

This proves the exact release candidate before touching production schema.

### D. Production DB preflight

Use the production `DATABASE_URL` obtained from the Vercel `logbook` project without exposing it in chat or docs.

Read-only preflight must prove:
- target database identity;
- current schema registry maximum = 17;
- v18 registry row absent;
- `aircraft.default_operation_type` absent;
- `ck_aircraft_default_operation_type` absent;
- aircraft row count recorded for post-check;
- no unexpected partial migration state.

Any partial/unexpected state => STOP and reconcile before migration.

A production recovery point / Neon branch snapshot should be created or otherwise explicitly documented before the write if available for the identified production project.

### E. Explicit v18 migration

Apply v18 before application deployment because schema is a deployment prerequisite.

Migration must:
- run in one transaction;
- acquire the same advisory transaction lock used by runtime migration: `704190104`;
- fail closed unless pre-state is the reviewed v17 state;
- add only the nullable column + CHECK constraint;
- insert exactly the v18 migration-registry row;
- not write any aircraft default values;
- not touch flights, certification tables, Task evidence, audit history or recovery history.

The explicit production migration procedure must be independently reviewed before execution.

### F. Post-migration verification

Before merge/deploy, verify:
- schema max = 18;
- registry row 18 has exact expected name;
- `default_operation_type` exists;
- column is nullable;
- column default is NULL / absent;
- constraint permits NULL/SP/MP only;
- existing aircraft rows remain NULL immediately after migration;
- aircraft row count unchanged;
- historical flights/certification structures untouched.

Because v18 is backward compatible, current production main must remain functional while the release candidate still waits to merge.

### G. Merge / deploy

After DB verification:
1. merge reviewed PR to `main`;
2. capture exact merge SHA;
3. verify Vercel production deployment is READY for that SHA;
4. verify `fly-tally.com` alias points to that deployment.

Runtime `ensureDatabaseOptimizations()` must observe v18 as already applied and perform no duplicate schema change.

### H. Production smoke

Minimum smoke:
- `/` public root;
- `/login`;
- unauthenticated protected routing;
- authenticated Aircraft page reads existing NULL default safely;
- Add/Edit aircraft allows NULL/SP/MP default;
- Manual New uses NULL as explicit choice and SP/MP when configured;
- GPS New behaves equivalently;
- certified legacy `GPS import` remains raw + annotated, not rewritten;
- production schema remains v18;
- no immediate runtime errors.

Re-run the E1.4 read-only census after deployment for evidence only. Do not require the count to remain exactly 14 because production activity may legitimately change between observations; classify any new exact legacy rows by date/state instead of mutating them.

## 5. Rollback model

v18 is additive and backward compatible with current `main`.

If application deployment fails after v18:
- leave v18 in place;
- roll application back to the previous known-good deployment;
- do **not** drop the column/constraint merely to match old code.

Schema rollback is not the default because dropping the column could destroy user-entered defaults after deployment. Any schema reversal requires a separate reviewed recovery decision.

## 6. Acceptance criteria

E1.5 can close only when:
- final local release gate PASS;
- independent review reconciled;
- final PR CI PASS;
- v18 production preflight matches expected v17 state;
- recovery point/backup decision documented;
- v18 applied and post-verified;
- PR merged to main;
- exact production deployment READY + alias verified;
- production smoke PASS;
- post-deploy E1.4 evidence census completed read-only;
- ROADMAP / FEATURES / CHANGELOG / this document updated to DONE / PRODUCTION VERIFIED.

## 7. Explicit non-goals

E1.5 must not:
- mutate historical `task='GPS import'`;
- backfill aircraft Operation defaults;
- infer SP/MP from aircraft type or history;
- change certification payload/version/hash semantics;
- introduce a new migration beyond v18;
- combine M2B or unrelated roadmap work;
- claim production verification before migration/deploy/smoke actually occur.
