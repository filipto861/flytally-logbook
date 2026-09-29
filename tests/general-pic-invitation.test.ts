import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { canInviteAsPic,normalizePicCommanderBasis,PIC_COMMANDER_BASES,validCrewCombination } from "../lib/crew.ts";
import { ROLES } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("general PIC invitation accepts every canonical stored flight role and rejects unknown roles",()=>{
  for(const role of ROLES)assert.equal(canInviteAsPic(role),true,role);
  assert.equal(canInviteAsPic(""),false);
  assert.equal(canInviteAsPic("CAPTAIN"),false);
  assert.equal(canInviteAsPic("NOT-A-ROLE"),false);
});

test("generic PIC authorization remains separate from the dedicated Safety Pilot crew pairing",()=>{
  assert.equal(validCrewCombination("SAFETY PILOT","PIC"),true);
  assert.equal(validCrewCombination("INSTRUCTOR","PIC"),false);
  assert.equal(validCrewCombination("PAX","PIC"),false);
  assert.equal(canInviteAsPic("INSTRUCTOR"),true);
  assert.equal(canInviteAsPic("PAX"),true);
});

test("PIC commander provenance has two explicit immutable meanings",()=>{
  assert.deepEqual(PIC_COMMANDER_BASES,["CERTIFIED_SOURCE_COMMANDER","RECIPIENT_ACCOUNT"]);
  assert.equal(normalizePicCommanderBasis("certified_source_commander"),"CERTIFIED_SOURCE_COMMANDER");
  assert.equal(normalizePicCommanderBasis("recipient_account"),"RECIPIENT_ACCOUNT");
  assert.equal(normalizePicCommanderBasis(""),null);
  assert.equal(normalizePicCommanderBasis("OTHER"),null);
});

test("schema v16 persists explicit PIC provenance and one active PIC participation per revision",()=>{
  const migration=read("lib/db-optimization.ts");
  const plan=read("lib/migration-plan.ts");
  assert.match(plan,/DATABASE_SCHEMA_VERSION=16/);
  assert.match(migration,/if\(version===16\)return\[/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS pic_commander_basis TEXT/);
  assert.match(migration,/CERTIFIED_SOURCE_COMMANDER/);
  assert.match(migration,/RECIPIENT_ACCOUNT/);
  assert.match(migration,/flight_participations_one_active_pic_uq/);
  assert.match(migration,/participant_role='PIC' AND status IN \('pending','accepted'\)/);
});
