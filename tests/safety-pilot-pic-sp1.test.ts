import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { canInviteAsPic,crewRoleCredits,normalizeCrewRole,validCrewCombination } from "../lib/crew.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("SP1 recognizes PIC participation but only from a Safety Pilot source",()=>{
  assert.equal(normalizeCrewRole("pic"),"PIC");
  assert.equal(validCrewCombination("SAFETY PILOT","PIC"),true);
  assert.equal(validCrewCombination("PIC","PIC"),false);
  assert.equal(validCrewCombination("CO-PILOT","PIC"),false);
  assert.equal(validCrewCombination("OBSERVER","PIC"),false);
  assert.equal(validCrewCombination("DUAL","PIC"),false);
});

test("SP1 grants canonical PIC credit to a PIC participant",()=>{
  assert.deepEqual(crewRoleCredits("PIC",73),{role:"PIC",pic:73,copilot:0,instructor:0});
});

test("dedicated Safety Pilot PIC pairing stays narrow while generic PIC authorization is separate",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.equal(validCrewCombination("SAFETY PILOT","PIC"),true);
  assert.equal(validCrewCombination("INSTRUCTOR","PIC"),false);
  assert.equal(canInviteAsPic("INSTRUCTOR"),true);
  assert.doesNotMatch(actions,/if\(role==="PIC"\)return;/);
  assert.match(actions,/role==="PIC"/);
  assert.match(actions,/canInviteAsPic\(source\[0\]\.role\)/);
  assert.match(detail,/canInviteAsPic\(role\)/);
});

test("SP1 migration and persistence helpers preserve owner, role and accepted-Connection gates",()=>{
  const migration=read("lib/db-optimization.ts");
  const helper=read("lib/flight-connected-crew.ts");
  assert.match(migration,/if\(version===15\)return\[/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS flight_connected_crew/);
  assert.match(migration,/FOREIGN KEY\(source_flight_id,source_user_id\) REFERENCES flights\(id,user_id\) ON DELETE CASCADE/);
  assert.match(migration,/CHECK\(intended_role='PIC'\)/);
  assert.match(migration,/participant_role IN \('CO-PILOT','SAFETY PILOT','INSTRUCTOR','EXAMINER','OBSERVER','PIC'\)/);
  assert.match(helper,/pc\.status='accepted'/);
  assert.match(helper,/f\.certified_at IS NULL/);
  assert.match(helper,/f\.locked_at IS NULL/);
  assert.match(helper,/UPPER\(TRIM\(COALESCE\(f\.role,''\)\)\)='SAFETY PILOT'/);
  assert.match(helper,/ON CONFLICT\(source_flight_id,intended_role\) DO UPDATE/);
});
