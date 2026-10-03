import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  GPS_IMPORT_ROLES,
  resolveGpsImportCommonRoleCrew,
  resolveGpsImportPartRoleCrew,
  validateGpsImportRole,
} from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing range: ${start}`);return source.slice(a,b)};

test("F4.3 expands GPS role scope only to Safety Pilot beyond F4.2",()=>{
  assert.deepEqual([...GPS_IMPORT_ROLES],["PIC","DUAL","SAFETY PILOT"]);
  assert.deepEqual(validateGpsImportRole("SAFETY PILOT"),{role:"SAFETY PILOT"});
  for(const role of ["SPIC","PICUS","CO-PILOT","INSTRUCTOR","EXAMINER","PAX","OBSERVER"]){
    assert.equal(validateGpsImportRole(role).role,undefined,role);
  }
});

test("F4.3 common Safety Pilot envelope is strict for Manual and Connection identity",()=>{
  assert.match(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"manual",
    commander:"",
  },"EASA").error??"",/Enter the actual PIC/i);

  assert.deepEqual(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"manual",
    commander:"Manual Captain",
  },"EASA"),{
    context:{
      role:"SAFETY PILOT",
      commander:"Manual Captain",
      instructor:"",
      verificationName:"",
      verificationReference:"",
      actualPicMode:"manual",
      connectedPicUserId:0,
    },
  });

  assert.deepEqual(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"manual",
    commander:"",
  },"ULL"),{
    context:{
      role:"SAFETY PILOT",
      commander:"",
      instructor:"",
      verificationName:"",
      verificationReference:"",
      actualPicMode:"manual",
      connectedPicUserId:0,
    },
  });

  assert.deepEqual(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"connected",
    connectedPicUserId:"9002",
  },"EASA"),{
    context:{
      role:"SAFETY PILOT",
      commander:"",
      instructor:"",
      verificationName:"",
      verificationReference:"",
      actualPicMode:"connected",
      connectedPicUserId:9002,
    },
  });

  assert.match(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"connected",
    connectedPicUserId:"9002",
    commander:"Client supplied name",
  },"EASA").error??"",/resolved from the selected account/i);

  assert.match(resolveGpsImportCommonRoleCrew({
    role:"SAFETY PILOT",
    actualPicMode:"manual",
    commander:"Manual Captain",
    connectedPicUserId:"9002",
  },"EASA").error??"",/must not include a connected account ID/i);
});

test("F4.3 whole-part Safety Pilot overrides cannot borrow identity fields from common",()=>{
  const common={
    role:"SAFETY PILOT" as const,
    commander:"Common Captain",
    instructor:"",
    verificationName:"",
    verificationReference:"",
    actualPicMode:"manual" as const,
    connectedPicUserId:0,
  };

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"SAFETY PILOT",
    rolePresent:true,
  },"EASA",common).error??"",/must include its own Actual PIC mode/i);

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"SAFETY PILOT",
    rolePresent:true,
    actualPicMode:"manual",
    actualPicModePresent:true,
  },"EASA",common).error??"",/must include its own Actual PIC text field/i);

  assert.match(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"SAFETY PILOT",
    rolePresent:true,
    actualPicMode:"connected",
    actualPicModePresent:true,
  },"EASA",common).error??"",/must include its own connected Actual PIC account ID/i);

  assert.deepEqual(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"SAFETY PILOT",
    rolePresent:true,
    actualPicMode:"manual",
    actualPicModePresent:true,
    commander:"Override Captain",
    commanderPresent:true,
  },"EASA",common),{
    mode:"OVERRIDE",
    context:{
      role:"SAFETY PILOT",
      commander:"Override Captain",
      instructor:"",
      verificationName:"",
      verificationReference:"",
      actualPicMode:"manual",
      connectedPicUserId:0,
    },
  });

  assert.deepEqual(resolveGpsImportPartRoleCrew({
    mode:"OVERRIDE",
    role:"SAFETY PILOT",
    rolePresent:true,
    actualPicMode:"connected",
    actualPicModePresent:true,
    connectedPicUserId:"9002",
    connectedPicUserIdPresent:true,
  },"EASA",common),{
    mode:"OVERRIDE",
    context:{
      role:"SAFETY PILOT",
      commander:"",
      instructor:"",
      verificationName:"",
      verificationReference:"",
      actualPicMode:"connected",
      connectedPicUserId:9002,
    },
  });
});

test("F4.3 reuses the Manual Actual-PIC authority helper without name matching",()=>{
  const helper=read("lib/flight-connected-crew.ts");

  assert.match(helper,/export async function resolveSafetyPilotPic\(/);
  assert.match(helper,/export async function resolveSafetyPilotPicForSave/);
  assert.match(helper,/return resolveSafetyPilotPic\(\{/);
  assert.match(helper,/WHERE u\.id=\$\{connectedUserId\}/);
  assert.match(helper,/pc\.status='accepted'/);
  assert.match(helper,/commander:snapshot\.displayName,connectedUserId:snapshot\.id/);
  assert.doesNotMatch(helper,/LOWER\([^)]*display_name|ILIKE|display_name\s*=\s*\$\{commander\}/);
});

test("F4.3 GPS resolves every final part before normalization and keeps account ID separate from commander",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");

  assert.match(gps,/actualPicMode:form\.get\("actualPicMode"\),connectedPicUserId:form\.get\("connectedPicUserId"\)/);
  assert.match(gps,/actualPicMode:form\.get\(\`\$\{prefix\}actualPicMode\`\),connectedPicUserId:form\.get\(\`\$\{prefix\}connectedPicUserId\`\)/);
  assert.match(gps,/const picResolution=await resolveSafetyPilotPic\(\{sourceUserId:userId,role:resolved\.context\.role,evidence,commander:resolved\.context\.commander,mode:resolved\.context\.actualPicMode,connectedPicUserId:resolved\.context\.connectedPicUserId\}\)/);
  assert.match(gps,/partRoleCrew\.push\(\{\.\.\.resolved\.context,commander:picResolution\.commander,connectedPicUserId:picResolution\.connectedUserId\}\)/);
  assert.match(gps,/connectedPicUserId:roleCrew\.connectedPicUserId/);
  assert.match(gps,/role:roleCrew\.role,commander:roleCrew\.commander/);
});

test("F4.3 connected Safety Pilot write is connection-guarded and atomic with flight track and child row",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");

  assert.match(gps,/\$\{item\.connectedPicUserId\}=0 OR EXISTS\([\s\S]*pc\.status='accepted'/);
  assert.match(gps,/INSERT INTO flight_connected_crew\(source_flight_id,source_user_id,connected_user_id,intended_role,updated_at\)/);
  assert.match(gps,/SELECT inserted\.id,\$\{userId\},\$\{item\.connectedPicUserId\},'PIC',NOW\(\)/);
  assert.match(gps,/track_insert AS \([\s\S]*INSERT INTO flight_tracks/);
  assert.match(gps,/1\/\(SELECT COUNT\(\*\)::integer FROM inserted\) inserted_ok/);
  assert.match(gps,/1\/\(SELECT COUNT\(\*\)::integer FROM track_insert\) track_ok/);
  assert.match(gps,/CASE WHEN \$\{item\.connectedPicUserId\}>0 THEN 1\/\(SELECT COUNT\(\*\)::integer FROM connected_crew\) ELSE 1 END crew_ok/);
  assert.match(gps,/SELECT flight_id FROM validated WHERE inserted_ok=1 AND track_ok=1 AND crew_ok=1/);
  assert.match(gps,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(gps,/insertResults\.some\(rows=>!Number\(rows\?\.\[0\]\?\.flight_id\)\)/);
  assert.doesNotMatch(gps,/flight_participations|certification_hash|certification_version/);
});

test("F4.3 GPS UI receives accepted Connections and submits explicit Manual or account-ID identity",()=>{
  const page=read("app/(protected)/flights/new/page.tsx");
  const form=read("components/kml-import-form.tsx");

  assert.match(page,/getAcceptedPicConnections\(userId\)/);
  assert.match(page,/<KmlImportForm[^>]*picConnections=\{picConnections\}/);
  assert.match(form,/function SafetyPilotFields/);
  assert.match(form,/name=\{\`\$\{namePrefix\}actualPicMode\`\}/);
  assert.match(form,/name=\{\`\$\{namePrefix\}connectedPicUserId\`\}/);
  assert.match(form,/name=\{\`\$\{namePrefix\}commander\`\}/);
  assert.match(form,/option\.id===id/);
  assert.match(form,/role==="SAFETY PILOT"/);
  assert.match(form,/roleCrewOverride\.role==="SAFETY PILOT"/);
  assert.match(form,/No invitation is sent when this import is saved/);
});
