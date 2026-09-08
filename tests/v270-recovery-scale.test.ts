import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { EXACT_RESTORE_STATEMENT_LIMIT,RESTORE_BATCH_SIZES,estimateExactRestoreStatements } from "../lib/recovery-scale.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.7 large-account disaster recovery stays inside the atomic statement budget",()=>{
  const fixture={
    settings:1,aircraft:100,rates:1000,airports:500,expiries:100,
    flights:100_000,flight_expenses:25_000,
    spl_recency_evidence:100,helicopter_recency_evidence:100,bpl_recency_evidence:100,
    fstd_sessions:1000,flight_tracks:5000,track_points:100_000,
    flight_certified_revisions:500,fstd_certified_revisions:100,audit_log:5000,deleted_flights:100,
    pilot_licences:50,pilot_qualifications:100,pilot_connections:100,instructor_flight_approvals:100,
    flight_participations:1000,flight_verifications:500,user_notifications:5000,connection_audit_log:1000,
  } as const;
  const statements=estimateExactRestoreStatements(fixture,{profileUpdate:true});
  assert.equal(statements,710);
  assert.ok(statements<EXACT_RESTORE_STATEMENT_LIMIT,`large recovery needs ${statements} statements`);
});

test("v2.7 recovery keeps coordinate-heavy GPS batches conservative while scaling flight rows",()=>{
  assert.equal(RESTORE_BATCH_SIZES.flights,500);
  assert.equal(RESTORE_BATCH_SIZES.flight_tracks,100);
  assert.equal(RESTORE_BATCH_SIZES.track_points,1000);
  assert.ok(RESTORE_BATCH_SIZES.flight_tracks<RESTORE_BATCH_SIZES.flights);
});

test("v2.7 production exact restore uses the tested batch policy and retains atomic safety",()=>{
  const source=read("lib/account-restore-v6.ts");
  assert.match(source,/RESTORE_BATCH_SIZES/);
  assert.match(source,/EXACT_RESTORE_STATEMENT_LIMIT/);
  assert.doesNotMatch(source,/queries\.length>1000/);
  assert.match(source,/queries\.length>EXACT_RESTORE_STATEMENT_LIMIT/);
  assert.match(source,/await sql\.transaction\(queries\)/);
});
