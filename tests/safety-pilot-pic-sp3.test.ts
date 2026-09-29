import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("SP3 dedicated PIC invitation derives the recipient only from stored connected-crew metadata",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const helperStart=actions.indexOf("async function insertPicParticipation");
  const inviteStart=actions.indexOf("export async function inviteConnectedPic",helperStart);
  const inviteEnd=actions.indexOf("export async function inviteCrewMember",inviteStart);
  assert.ok(helperStart>=0&&inviteStart>helperStart&&inviteEnd>inviteStart);
  const helper=actions.slice(helperStart,inviteStart),invite=actions.slice(inviteStart,inviteEnd);
  assert.match(invite,/JOIN flight_connected_crew c ON c\.source_flight_id=f\.id AND c\.source_user_id=f\.user_id AND c\.intended_role='PIC'/);
  assert.match(invite,/c\.connected_user_id/);
  assert.match(invite,/UPPER\(TRIM\(COALESCE\(f\.role,''\)\)\)='SAFETY PILOT'/);
  assert.match(invite,/f\.certified_at IS NOT NULL/);
  assert.match(invite,/COALESCE\(f\.certification_hash,''\)<>''/);
  assert.match(invite,/insertPicParticipation\(sourceFlightId,userId,participantId,"CERTIFIED_SOURCE_COMMANDER"\)/);
  assert.match(helper,/pc\.status='accepted'/);
  assert.match(helper,/COALESCE\(f\.record_revision,1\)/);
  assert.doesNotMatch(invite,/form:FormData/);
});

test("generic crew sharing exposes PIC only through the explicit canonical-role authorization path",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(actions,/if\(role==="PIC"\)\{/);
  assert.match(actions,/canInviteAsPic\(source\[0\]\.role\)/);
  assert.match(actions,/insertPicParticipation\(sourceFlightId,userId,participantId,"RECIPIENT_ACCOUNT"\)/);
  assert.match(detail,/item!=="PIC"\|\|canInviteAsPic\(role\)&&!participantOwned&&!activePicParticipation/);
  assert.match(detail,/PIC creates a complete PIC copy of this certified event/);
});

test("SP3 certified Safety Pilot UI exposes only the stored linked Actual PIC and live Connection state",()=>{
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(detail,/picInvitePanel=certified&&role==="SAFETY PILOT"&&connectedPic/);
  assert.match(detail,/connectedPic\.connectionAccepted/);
  assert.match(detail,/Invite Actual PIC/);
  assert.match(detail,/This linked Actual PIC is no longer an accepted Connection/);
  assert.match(detail,/inviteConnectedPic\.bind\(null,id\)/);
});

test("SP3 notification is revision-bound participation review wording, not automatic materialization",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("export async function inviteConnectedPic");
  const end=actions.indexOf("export async function inviteCrewMember",start);
  const invite=actions.slice(start,end);
  assert.match(invite,/title:"PIC logbook invitation"/);
  assert.match(invite,/Review this certified Safety Pilot flight before adding the complete PIC copy to your logbook/);
  assert.doesNotMatch(invite,/materializeParticipation/);
});
