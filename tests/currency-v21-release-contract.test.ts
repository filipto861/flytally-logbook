import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const draft=source("sql/drafts/3_8_0_currency_v21_additive_candidate.sql");
const pre=source("tooling/v380-v21-preflight.sql");
const migrate=source("tooling/v380-v21-migrate.sql");
const post=source("tooling/v380-v21-postflight.sql");
const plan=source("lib/migration-plan.ts");
const runtime=source("lib/db-optimization.ts");
const normalize=(v:string)=>v.replace(/\s+/g," ").trim();
const alters=[...draft.matchAll(/^ALTER TABLE (?:rates|aircraft|flights|flight_expenses)\n[\s\S]*?;/gm)].map(x=>x[0]);
const checks=[...draft.matchAll(/DO \$currency\$[\s\S]*?\$currency\$;/g)].map(x=>x[0]);

test("v21 executable DDL and runtime use all eight exact source-backed draft blocks",()=>{
  assert.equal(alters.length,4);
  assert.equal(checks.length,4);
  for(const ddl of [...alters,...checks]){
    assert.ok(normalize(migrate).includes(normalize(ddl)),"Production file differs from v21 review DDL");
    assert.ok(normalize(runtime).includes(normalize(ddl)),"Runtime v21 differs from review DDL");
  }
  assert.match(draft,/REVIEW CANDIDATE ONLY/);
  assert.doesNotMatch(draft,/INSERT INTO public\.flytally_schema_migrations/);
});

test("v21 registration is consistent and not claimed as already applied",()=>{
  assert.match(plan,/DATABASE_SCHEMA_VERSION=21;/);
  assert.match(plan,/\{version:21,name:"source-backed currency exact-money"\}/);
  assert.match(runtime,/21:"source-backed currency exact-money"/);
  assert.match(runtime,/if\(version===21\)return\[/);
  assert.match(migrate,/VALUES\(21,'source-backed currency exact-money'\)/);
  assert.doesNotMatch(draft,/\bversion:21\b/);
  assert.equal((runtime.match(/if\(version===21\)return\[/g)||[]).length,1);
});

test("SQL files require explicit database identity, with isolated read-only pre/post and bounded atomic migration",()=>{
  for(const s of [pre,migrate,post]){
    assert.match(s,/\\if :\{\?expected_database\}/);
    assert.match(s,/set_config\('flytally\.expected_database', :'expected_database',true\)/);
    assert.match(s,/current_database\(\) IS DISTINCT FROM current_setting\('flytally\.expected_database',true\)/);
    assert.match(s,/SET LOCAL search_path=public,pg_catalog/);
    assert.equal([...Buffer.from(s,"utf8")].every(x=>x<128),true,"Release scripts must be PowerShell5.1 ASCII-safe");
  }
  for(const s of [pre,post]){
    assert.match(s,/BEGIN TRANSACTION READ ONLY/);
    assert.match(s,/ROLLBACK;/);
    assert.doesNotMatch(s,/\bINSERT INTO\b/);
  }
  assert.match(migrate,/SET LOCAL lock_timeout='5s'/);
  assert.match(migrate,/SET LOCAL statement_timeout='60s'/);
  assert.match(migrate,/SELECT pg_advisory_xact_lock\(704190104\)/);
  assert.ok(migrate.indexOf("VALUES(21,")>migrate.indexOf("ALTER TABLE rates"));
  assert.ok(migrate.indexOf("DO $v380$",migrate.indexOf("VALUES(21,"))>migrate.indexOf("VALUES(21,"));
  assert.match(migrate,/COMMIT;\s*$/);
  assert.doesNotMatch(migrate,/\b(?:UPDATE|DELETE FROM|DROP TABLE|DROP COLUMN)\b/i);
});

test("release preflight and runtime refuse any partial v21 state and require certified-history protection",()=>{
  for(const s of [pre,migrate,runtime]){
    assert.match(s,/partial or existing monetary columns - fail closed/);
    assert.match(s,/partial or existing CHECK constraints - fail closed/);
    assert.match(s,/required v20 protected history or triggers missing/);
    assert.match(s,/registry must be exactly 1 through 20/);
    assert.match(s,/logbook_protect_locked_flight/);
    assert.match(s,/logbook_protect_source_provenance/);
  }
  for(const s of [post,migrate]){
    assert.match(s,/expected 12 nullable, no-default correctly typed columns/);
    assert.match(s,/expected 4 validated CHECKs/);
    assert.match(s,/historical rows unexpectedly populated/);
    assert.match(s,/registry not exactly 1\.\.21/);
  }
});
