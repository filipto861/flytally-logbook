import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("E1.5 runtime migrator ignores registry versions newer than its advertised schema",()=>{
  const db=read("lib/db-optimization.ts");
  assert.match(db,/SELECT version FROM flytally_schema_migrations WHERE version<=\$\{DATABASE_SCHEMA_VERSION\} ORDER BY version/);
  assert.match(db,/pendingMigrationVersions\(rows\.map\(row=>Number\(row\.version\)\)\)/);
});

test("E1.5 PR automation cannot run feature-branch Vercel runtime and CI databases are isolated",()=>{
  const vercel=JSON.parse(read("vercel.json")) as {git?:{deploymentEnabled?:Record<string,boolean>}};
  assert.equal(vercel.git?.deploymentEnabled?.["*"],false);
  assert.equal(vercel.git?.deploymentEnabled?.main,true);

  const verify=read(".github/workflows/verify-web.yml");
  const browser=read(".github/workflows/browser-smoke.yml");
  assert.match(verify,/POSTGRES_DB: flytally_test/);
  assert.match(verify,/DATABASE_URL: postgresql:\/\/flytally:flytally@127\.0\.0\.1:5432\/flytally_test/);
  assert.match(browser,/POSTGRES_DB: flytally_browser/);
  assert.match(browser,/DATABASE_URL: postgresql:\/\/flytally:flytally@127\.0\.0\.1:5432\/flytally_browser/);
  assert.doesNotMatch(verify,/neondb|DATABASE_URL:\s*\$\{\{\s*secrets\./);
  assert.doesNotMatch(browser,/neondb|DATABASE_URL:\s*\$\{\{\s*secrets\./);
});

test("E1.5 production v18 preflight is read-only and fails closed on registry or partial-schema drift",()=>{
  const sql=read("tooling/e15-v18-preflight.sql");
  assert.match(sql,/BEGIN TRANSACTION READ ONLY/);
  assert.match(sql,/FOR v IN 1\.\.17 LOOP/);
  assert.match(sql,/COUNT\(\*\) FROM public\.flytally_schema_migrations\)<>17/);
  assert.match(sql,/version<1 OR version>17/);
  assert.match(sql,/default_operation_type already exists/);
  assert.match(sql,/constraint already exists/);
  assert.match(sql,/current_database\(\) IS DISTINCT FROM 'neondb'/);
  assert.match(sql,/pg_is_in_recovery\(\)/);
  assert.match(sql,/ROLLBACK/);
  assert.doesNotMatch(sql,/\bUPDATE\b|\bINSERT\b|\bDELETE\b|ALTER TABLE/i);
});

test("E1.5 explicit v18 migration revalidates under the runtime advisory lock and contains no cleanup/backfill",()=>{
  const sql=read("tooling/e15-v18-migrate.sql");
  assert.match(sql,/^\\set ON_ERROR_STOP on/m);
  assert.match(sql,/BEGIN;/);
  assert.match(sql,/SET LOCAL lock_timeout='5s'/);
  assert.match(sql,/SET LOCAL statement_timeout='30s'/);
  assert.match(sql,/pg_advisory_xact_lock\(704190104\)/);
  assert.match(sql,/current_database\(\) IS DISTINCT FROM 'neondb'/);
  const lock=sql.indexOf("pg_advisory_xact_lock(704190104)");
  const guard=sql.indexOf("FOR v IN 1..17 LOOP");
  const alter=sql.indexOf("ALTER TABLE public.aircraft");
  assert.ok(lock>=0&&guard>lock&&alter>guard);
  assert.doesNotMatch(sql,/IF NOT EXISTS/);
  assert.match(sql,/ADD COLUMN default_operation_type TEXT/);
  assert.match(sql,/ADD CONSTRAINT ck_aircraft_default_operation_type/);
  assert.match(sql,/CHECK\(default_operation_type IS NULL OR default_operation_type IN \('SP','MP'\)\)/);
  assert.match(sql,/VALUES\(18,'aircraft default operation type'\)/);
  assert.match(sql,/existing aircraft defaults were populated unexpectedly/);
  assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(sql,/UPDATE\s+public\.aircraft|UPDATE\s+aircraft|UPDATE\s+flights|flight_certified_revisions|flight_audit_log|deleted_flights|GPS import/i);
});

test("E1.5 postflight verifies v18 shape and preserves evidence counts for comparison",()=>{
  const sql=read("tooling/e15-v18-postflight.sql");
  assert.match(sql,/BEGIN TRANSACTION READ ONLY/);
  assert.match(sql,/current_database\(\) IS DISTINCT FROM 'neondb'/);
  assert.match(sql,/COUNT\(\*\) FROM public\.flytally_schema_migrations\)<>18/);
  assert.match(sql,/version<1 OR version>18/);
  assert.match(sql,/version=18 AND name='aircraft default operation type'/);
  assert.match(sql,/data_type IS DISTINCT FROM 'text'/);
  assert.match(sql,/column_nullable IS DISTINCT FROM 'YES'/);
  assert.match(sql,/column_default IS NOT NULL/);
  assert.match(sql,/convalidated/);
  assert.match(sql,/default_operation_type IS NOT NULL/);
  assert.match(sql,/certified_revision_rows/);
  assert.match(sql,/flight_audit_rows/);
  assert.match(sql,/deleted_flight_rows/);
  assert.match(sql,/ROLLBACK/);
});

test("E1.5 additive column is compatible with existing aircraft consumers audited for the pre-deploy window",()=>{
  const backup=read("lib/account-backup.ts");
  const restore=read("lib/account-restore-v6.ts");
  const actions=read("app/(protected)/database/actions.ts");
  const data=read("lib/data/aircraft.ts");

  assert.match(backup,/SELECT \* FROM aircraft WHERE user_id=/);
  assert.match(restore,/INSERT INTO aircraft SELECT \(json_populate_record\(NULL::aircraft,item\)\)\.\*/);
  assert.match(actions,/INSERT INTO aircraft\(user_id,registration,/);
  assert.doesNotMatch(actions,/INSERT INTO aircraft\s+VALUES/i);
  assert.match(data,/SELECT a\.registration,/);
});
