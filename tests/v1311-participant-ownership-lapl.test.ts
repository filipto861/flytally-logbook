import assert from "node:assert/strict";import test from "node:test";import fs from "node:fs";import path from "node:path";
import { allocatedFunctionTimes,EASA_ROLES } from "../lib/easa-logbook.ts";
import { pilotInCommandName } from "../lib/logbook-print.ts";
const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.31.1 gives an instructor a separate FI/PIC logbook entry",()=>{
  assert.ok(EASA_ROLES.includes("FI"));
  assert.deepEqual(allocatedFunctionTimes("FI",65),{picMinutes:65,copilotMinutes:0,dualMinutes:0,instructorMinutes:65});
  assert.equal(pilotInCommandName({role:"FI",commander:"Instructor Pilot"},"Instructor Pilot"),"Instructor Pilot");
  const shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(shared,/role==="INSTRUCTOR"\?"FI":role/);
  assert.match(shared,/instructorName=""/);
  assert.match(shared,/FI entry linked to/);
});

test("participant-owned copy can be removed without deleting the source record or verification",()=>{
  const trash=read("lib/flight-trash.ts"),shared=read("app/(protected)/flights/shared-actions.ts");
  assert.match(trash,/flight_participations p WHERE p\.participant_user_id=\$\{userId\} AND p\.participant_flight_id=f\.id/);
  assert.doesNotMatch(trash,/DELETE FROM flight_verifications/);
  assert.match(shared,/\["pending","accepted"\]\.includes\(text\(row\.status\)\)/);
  assert.match(shared,/participant_flight_id IS NULL THEN 'pending'/);
});

test("instructor can sign only or sign and add their FI entry",()=>{
  const page=read("app/(protected)/connections/flight/[id]/page.tsx"),actions=read("app/(protected)/flights/instructor-actions.ts");
  assert.match(page,/Sign &amp; add FI entry/);assert.match(page,/Sign only/);
  assert.match(actions,/approveAndAddInstructorFlight/);assert.match(actions,/addApprovedFlightToLogbook/);
});

test("Licences UI treats LAPL as unlimited and monitors rolling FCL.140.A recency",()=>{
  const licences=read("app/(protected)/credentials/page.tsx"),sidebar=read("components/sidebar.tsx");
  assert.match(sidebar,/label:"Licences"/);assert.match(licences,/PILOT LICENCES/);assert.match(licences,/FCL\.140\.A/);
  assert.match(licences,/laplMinutes>=720/);assert.match(licences,/laplLandings>=12/);assert.match(licences,/laplRefresher>=60/);
  assert.match(licences,/SEP\/TMG is monitored through rolling recency/);assert.match(licences,/validity_mode" value="unlimited"/);
});

test("v1.31 participant ownership baseline stays within the v1.31 release family",()=>{assert.match(JSON.parse(read("package.json")).version,/^1\.31\./)});
