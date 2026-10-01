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
  assert.match(plan,/version:16,name:"general PIC invitation provenance"/);
  assert.match(migration,/if\(version===16\)return\[/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS pic_commander_basis TEXT/);
  assert.match(migration,/CERTIFIED_SOURCE_COMMANDER/);
  assert.match(migration,/RECIPIENT_ACCOUNT/);
  assert.match(migration,/flight_participations_one_active_pic_uq/);
  assert.match(migration,/participant_role='PIC' AND status IN \('pending','accepted'\)/);
});


test("generic and dedicated PIC invites persist different immutable commander provenance",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  assert.match(actions,/insertPicParticipation\(sourceFlightId,userId,participantId,"CERTIFIED_SOURCE_COMMANDER"\)/);
  assert.match(actions,/insertPicParticipation\(sourceFlightId,userId,participantId,"RECIPIENT_ACCOUNT"\)/);
  assert.match(actions,/WHEN flight_participations\.participant_role='PIC' THEN flight_participations\.pic_commander_basis/);
  assert.match(actions,/active_pic\.participant_role='PIC' AND active_pic\.status IN \('pending','accepted'\)/);
});

test("generic PIC invitation fails closed for re-shared source flights and unknown source roles",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("export async function inviteCrewMember");
  const end=actions.indexOf("export async function inviteSafetyPilot",start);
  assert.ok(start>=0&&end>start);
  const generic=actions.slice(start,end);
  assert.match(generic,/participant_owned/);
  assert.match(generic,/if\(!canInviteAsPic\(source\[0\]\.role\)\|\|Boolean\(source\[0\]\.participant_owned\)\)return/);
  assert.match(generic,/role==="PIC"/);
});

test("generic PIC materialization copies the complete certified event but recalculates recipient role credit",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("async function materializeParticipation");
  const end=actions.indexOf("async function insertPicParticipation",start);
  assert.ok(start>=0&&end>start);
  const materialize=actions.slice(start,end);
  assert.match(materialize,/f\.note/);
  assert.match(materialize,/Number\(row\.landings_day\)\|\|0/);
  assert.match(materialize,/Boolean\(row\.movement_evidence_recorded\)/);
  assert.match(materialize,/Number\(row\.takeoffs_day\)\|\|0/);
  assert.match(materialize,/Number\(row\.approaches_day\)\|\|0/);
  assert.match(materialize,/Number\(row\.night_minutes\)\|\|0/);
  assert.match(materialize,/Number\(row\.ifr_minutes\)\|\|0/);
  assert.match(materialize,/credit=crewRoleCredits\(participantRole,creditMinutes\)/);
  assert.match(materialize,/\$\{credit\.pic\},\$\{credit\.copilot\},0,\$\{credit\.instructor\}/);
  assert.match(materialize,/recipientNote=pic\?text\(row\.note\)/);
});

test("certified flight UI exposes PIC in generic sharing while preserving the dedicated Actual PIC panel",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(detail,/canInviteAsPic\(role\)&&!participantOwned&&!activePicParticipation/);
  assert.match(detail,/PIC creates a complete PIC copy of this certified event/);
  assert.match(detail,/role==="SAFETY PILOT"&&connectedPic/);
  assert.match(detail,/Number\(member\.participant_user_id\)===connectedPic\.connectedUserId/);
  assert.match(detail,/PIC re-sharing is unavailable because this flight was itself added from another shared or verified flight/);
});

test("recipient preview follows invitation provenance and shows the copied source note for PIC",()=>{
  const page=read("app/(protected)/connections/shared/[id]/page.tsx");
  assert.match(page,/p\.pic_commander_basis/);
  assert.match(page,/picCommanderBasis==="CERTIFIED_SOURCE_COMMANDER"\?row\.commander:row\.participant_name/);
  assert.match(page,/note:pic\?row\.note:""/);
  assert.match(page,/with the complete certified event data/);
});
