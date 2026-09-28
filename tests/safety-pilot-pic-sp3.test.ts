import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("SP3 PIC invitation derives the recipient only from stored connected-crew metadata",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const start=actions.indexOf("export async function inviteConnectedPic");
  const end=actions.indexOf("export async function inviteCrewMember",start);
  assert.ok(start>=0&&end>start);
  const invite=actions.slice(start,end);
  assert.match(invite,/JOIN flight_connected_crew c ON c\.source_flight_id=f\.id AND c\.source_user_id=f\.user_id AND c\.intended_role='PIC'/);
  assert.match(invite,/c\.connected_user_id/);
  assert.match(invite,/pc\.status='accepted'/);
  assert.match(invite,/UPPER\(TRIM\(COALESCE\(f\.role,''\)\)\)='SAFETY PILOT'/);
  assert.match(invite,/f\.certified_at IS NOT NULL/);
  assert.match(invite,/COALESCE\(f\.certification_hash,''\)<>''/);
  assert.match(invite,/COALESCE\(f\.record_revision,1\)/);
  assert.doesNotMatch(invite,/participant_id/);
  assert.doesNotMatch(invite,/form:FormData/);
});

test("SP3 keeps PIC unreachable through the generic arbitrary-recipient invite path",()=>{
  const actions=read("app/(protected)/flights/shared-actions.ts");
  const detail=read("app/(protected)/flights/[id]/page.tsx");
  assert.match(actions,/export async function inviteCrewMember[\s\S]*?if\(role==="PIC"\)return;/);
  assert.match(detail,/availableRoles=CREW_ROLES\.filter\(item=>item!=="PIC"&&/);
  assert.match(detail,/genericCrewRows=safetyRows\.filter\(member=>String\(member\.participant_role/);
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
  assert.match(invite,/Review this certified Safety Pilot flight before adding a separate PIC record/);
  assert.doesNotMatch(invite,/materializeParticipation/);
});
