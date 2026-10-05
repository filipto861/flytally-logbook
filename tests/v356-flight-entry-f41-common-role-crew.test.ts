import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { GPS_IMPORT_ROLES,resolveGpsImportCommonRoleCrew,validateGpsImportRole } from "../lib/gps-import-integrity.ts";
import { gpsFlightCandidate } from "../lib/flight-draft-candidate.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const between=(source:string,start:string,end:string)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`Missing range: ${start}`);return source.slice(a,b)};

test("F4.1 PIC/DUAL baseline is superseded narrowly by F4.3 Safety Pilot",()=>{
  assert.deepEqual([...GPS_IMPORT_ROLES],["PIC","DUAL","SAFETY PILOT"]);
  assert.deepEqual(validateGpsImportRole("PIC"),{role:"PIC"});
  assert.deepEqual(validateGpsImportRole("dual"),{role:"DUAL"});
  assert.deepEqual(validateGpsImportRole("safety pilot"),{role:"SAFETY PILOT"});
  for(const role of ["SPIC","PICUS","INSTRUCTOR","CO-PILOT","PAX","OBSERVER","ADMIN"]){
    const result=validateGpsImportRole(role);
    assert.equal(result.role,undefined,role);
    assert.match(result.error??"",/supports PIC, DUAL and SAFETY PILOT/i,role);
  }
});

test("F4.1 common RoleCrew resolver is strict and never field-falls back",()=>{
  assert.deepEqual(resolveGpsImportCommonRoleCrew({role:"PIC"},"EASA"),{
    context:{role:"PIC",commander:"",instructor:"",verificationName:"",verificationReference:"",actualPicMode:"",connectedPicUserId:0},
  });
  assert.match(resolveGpsImportCommonRoleCrew({role:"PIC",instructor:"Stale FI"},"EASA").error??"",/does not accept additional Role\/Crew evidence/i);

  assert.match(resolveGpsImportCommonRoleCrew({role:"DUAL",instructor:""},"EASA").error??"",/require the instructor\/PIC name/i);
  assert.deepEqual(resolveGpsImportCommonRoleCrew({role:"DUAL",instructor:"Training Instructor"},"EASA"),{
    context:{role:"DUAL",commander:"",instructor:"Training Instructor",verificationName:"",verificationReference:"",actualPicMode:"",connectedPicUserId:0},
  });
  assert.deepEqual(resolveGpsImportCommonRoleCrew({role:"DUAL",instructor:""},"ULL"),{
    context:{role:"DUAL",commander:"",instructor:"",verificationName:"",verificationReference:"",actualPicMode:"",connectedPicUserId:0},
  });
  assert.match(resolveGpsImportCommonRoleCrew({role:"DUAL",instructor:"FI",verificationReference:"stale"},"EASA").error??"",/accepts only the Instructor \/ PIC field/i);
});

test("F4.1 GPS candidate carries the resolved common RoleCrew into the shared normalizer boundary",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-F41",
    aircraftType:"B23",
    profile:{
      evidence:"EASA",
      aircraftClass:"SEP",
      regulatoryCategory:"AEROPLANE",
      balloonClass:"",
      balloonGroup:"",
      partFclCreditClass:"",
      partFclCreditBasis:"",
      partFclCreditFrom:"",
    },
    role:"DUAL",
    commander:"",
    instructor:"Training Instructor",
    verificationName:"",
    verificationReference:"",
    billingBasis:"",
    billingShare:"",
    task:"GPS import",
    operationType:"SP",
    engineType:"SE",
    reviewedPart:{
      date:"2026-10-02",
      departure:"LKPR",
      arrival:"LKLT",
      offBlock:"10:00",
      takeoff:"10:05",
      landing:"10:55",
      onBlock:"11:00",
      starts:"1",
      landingsDay:"1",
      landingsNight:"0",
      movementEvidenceRecorded:"no",
      nightTime:0,
      ifrTime:0,
    },
  });
  assert.equal(candidate.role,"DUAL");
  assert.equal(candidate.instructor,"Training Instructor");
  assert.equal(candidate.commander,"");
  assert.equal(candidate.verificationName,"");
  assert.equal(candidate.verificationReference,"");
  assert.equal(candidate.provenance.role,"COMMON_IMPORT");
});

test("F4.1 server resolves common RoleCrew from FormData after aircraft authority and before candidate normalization",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const gps=between(actions,"export async function importKmlFlight","export async function updateFlight");

  assert.match(gps,/evidence=authorityContext\.evidence/);
  assert.match(gps,/resolveGpsImportCommonRoleCrew\(\{role:form\.get\("role"\),commander:form\.get\("commander"\),instructor:form\.get\("instructor"\),verificationName:form\.get\("verificationName"\),verificationReference:form\.get\("verificationReference"\),actualPicMode:form\.get\("actualPicMode"\),connectedPicUserId:form\.get\("connectedPicUserId"\)\},evidence\)/);
  assert.match(gps,/resolveGpsImportPartRoleCrew\([\s\S]*?,evidence,commonRoleCrew\)/);
  assert.match(gps,/partRoleCrew\.push\(\{\.\.\.resolved\.context,commander:picResolution\.commander,connectedPicUserId:picResolution\.connectedUserId\}\)/);
  assert.match(gps,/role:roleCrew\.role,commander:roleCrew\.commander,instructor:roleCrew\.instructor,verificationName:roleCrew\.verificationName,verificationReference:roleCrew\.verificationReference/);
  assert.doesNotMatch(gps,/gpsFlightCandidate\(\{registration,aircraftType,profile:profileForFlight,role:form\.get\("role"\)/);
});

test("F4.1 UI exposes common DUAL requirements without a generic per-flight review gate",()=>{
  const form=read("components/kml-import-form.tsx");

  assert.match(form,/GPS_IMPORT_ROLES\.map\(value=><option/);
  assert.match(form,/roleCrewSpec\(role,selectedProfile\.evidence\)/);
  assert.match(form,/commonInstructorRequired=commonCrewSpec\?\.instructor==="required_save"/);
  assert.match(form,/onChange=\{event=>setRole\(event\.target\.value as \(typeof GPS_IMPORT_ROLES\)\[number\]\)\}/);
  assert.doesNotMatch(form,/reviewed:false/);
  assert.match(form,/role==="DUAL"\?<label><span>Instructor \/ PIC/);
  assert.match(form,/required=\{commonInstructorRequired\}/);
  assert.match(form,/commonRoleCrewReady=Boolean\(selectedProfile\)&&roleCrewBufferReady\(commonRoleCrewBuffer,selectedProfile!\.evidence,picConnections\)/);
  assert.match(form,/Common Role\/Crew/);
  assert.doesNotMatch(form,/name="verificationName"[^>]*value=\{[^}]*verification/i);
});
