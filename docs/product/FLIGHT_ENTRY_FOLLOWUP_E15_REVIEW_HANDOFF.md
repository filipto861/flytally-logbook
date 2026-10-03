# Independent Review Handoff — Flight Entry Follow-up E1.5

Please perform an independent **read-only** review. Do not implement and do not run production changes.

Repository: `filipto861/flytally-logbook`  
Branch: `feat/entry-followup-defaults-daylight-ux`  
Closeout design: `docs/product/FLIGHT_ENTRY_FOLLOWUP_E15_CLOSEOUT.md`

## Current state

E1.1–E1.4 are DONE / LOCAL VERIFIED.

Production database was read-only inspected during E1.4:
- database `neondb`;
- schema maximum v17;
- v18 not applied;
- certification/history tables present.

E1.4 production census found 14 exact live `task='GPS import'` rows across 3 accounts, all certified at that observation, zero ordinary drafts. Historical evidence exists in certified revisions, deleted recovery copies and audit events. Policy is frozen: no automated historical mutation.

## Only production schema change

v18 adds an aircraft-profile preference:

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

Registry:
`18 | aircraft default operation type`

No DEFAULT. No backfill. No flight mutation.

Runtime migrator applies pending versions in a transaction with:
`pg_advisory_xact_lock(704190104)`.

## Proposed production order

1. Full local release gate.
2. Open final PR and require CI PASS, but do not merge.
3. Read-only production DB preflight proving clean v17 state and no partial v18.
4. Create/document a recovery point if available.
5. Apply explicit v18 transaction using the same advisory lock.
6. Verify schema v18, nullable/no-default column, exact constraint, zero non-NULL existing defaults, unchanged aircraft row count.
7. Merge PR.
8. Verify exact Vercel deployment SHA READY and production alias.
9. Production smoke.
10. Re-run E1.4 census read-only for evidence only.
11. Docs closeout.

Rollback proposal:
- if app deploy fails after v18, leave additive v18 schema in place and roll app back;
- do not drop the column as a routine rollback because user values could exist after rollout.

## Please challenge

1. Is explicit pre-apply v18 before app deploy preferable to allowing `ensureDatabaseOptimizations()` to migrate on first request?
2. Is the v17 preflight sufficiently fail-closed? Which exact partial-drift states must abort?
3. Should migration require **all versions 1–17** to be present, rather than only `MAX(version)=17`?
4. Should the explicit migration use the exact runtime advisory lock `704190104`, and are there any race concerns with the currently deployed app?
5. Is a Neon branch/restore point necessary for this additive migration, and what minimum evidence should be captured?
6. Which post-migration invariants must be checked before merging application code?
7. Is leaving v18 in place while rolling the app back the correct failure strategy?
8. Does PR/CI-before-migration then migration-before-merge minimize blast radius?
9. What production smoke is necessary to prove NULL/SP/MP behavior without creating misleading user defaults?
10. Are there any hidden backup/restore/sharing/API consumers that could fail when the column exists before the new app deploys?
11. Should the post-deploy E1.4 census be repeated, and how should newly observed legacy rows be interpreted without historical mutation?
12. Identify any missing race, lock, transaction, connection-pooling, schema-cache, deploy, or rollback failure mode.

Return:
- APPROVE / APPROVE WITH CHANGES / BLOCK;
- findings ordered S1/S2/S3;
- exact preflight/migration/postflight contract changes;
- exact release-order changes;
- no implementation.
