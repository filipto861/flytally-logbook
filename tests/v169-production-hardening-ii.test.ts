import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const graph=["pilot_licences","pilot_qualifications","pilot_connections","instructor_flight_approvals","flight_participations","user_notifications","flight_verifications","connection_audit_log"] as const;

test("v1.69 exact restore preview and execution use one classified v7+ graph",()=>{
  const source=read("lib/account-restore-v6.ts");
  for(const section of graph){
    assert.ok(source.includes(`["${section}",backup.${section}`),`${section} is missing from restore preview classification`);
    assert.ok(source.includes(`chunks(plan.addRows.${section}??[]`),`${section} execution does not use the classified addRows plan`);
    assert.equal(source.includes(`chunks(backup.${section}`),false,`${section} execution bypasses restore classification`);
  }
});

test("v1.69 exact restore explicitly prepares the latest additive feature schemas",()=>{
  const source=read("lib/account-restore-v6.ts");
  for(const version of ["162","163","164","165","166"]){
    assert.match(source,new RegExp(`ensureV${version}Schema`));
  }
  assert.match(source,/ensureV165Schema\(\),ensureV166Schema\(\)/);
});

test("v1.69 feature migrations remain retryable, serialized and non-destructive",()=>{
  for(const version of ["162","163","164","165","166"]){
    const source=read(`lib/v${version}-schema.ts`);
    assert.match(source,/MIGRATION_KEY=/,`v${version} has no stable migration key`);
    assert.match(source,/flytally_feature_migrations/,`v${version} does not persist migration completion`);
    assert.match(source,/pg_advisory_xact_lock/,`v${version} migration is not serialized`);
    assert.match(source,/ON CONFLICT\(migration_key\) DO NOTHING/,`v${version} migration completion is not idempotent`);
    assert.match(source,/\.catch\(error=>\{globalThis\.__flytallyV\d+Schema=undefined;throw error\}\)/,`v${version} cached schema gate cannot retry after failure`);
    assert.doesNotMatch(source,/\bDROP\s+(?:TABLE|COLUMN)\b/i,`v${version} contains a destructive DROP`);
    assert.doesNotMatch(source,/\bTRUNCATE\b/i,`v${version} contains TRUNCATE`);
    assert.doesNotMatch(source,/\bDISABLE\s+TRIGGER\b/i,`v${version} disables integrity triggers`);
    assert.doesNotMatch(source,/session_replication_role/i,`v${version} bypasses database integrity triggers`);
  }
});

test("v1.69 keeps safety-pilot time dashboard-only and all auxiliary roles out of logged analytics",()=>{
  const dashboard=read("lib/data/dashboard.ts"),insights=read("lib/data/pilot-insights.ts"),page=read("app/(protected)/dashboard/page.tsx");
  assert.match(dashboard,/role IN \('SAFETY PILOT','PAX','OBSERVER'\) auxiliary,role NOT IN \('PAX','OBSERVER'\) dashboard_total/);
  assert.match(insights,/role IN \('SAFETY PILOT','PAX','OBSERVER'\) auxiliary/);
  assert.match(page,/safety pilot time · dashboard only/);
});

test("v1.69 CI retains both 10k and 50k PostgreSQL scale evidence",()=>{
  const workflow=read(".github/workflows/verify-web.yml");
  assert.match(workflow,/flytally-scale-evidence[.]json/);
  assert.match(workflow,/flytally-v169-scale-evidence[.]json/);
  assert.match(workflow,/retention-days: 90/);
});
