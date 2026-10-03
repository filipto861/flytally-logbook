import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { allocatedFunctionTimes } from "../lib/easa-logbook.ts";
import { flightCertificationHash,verifyFlightCertification } from "../lib/certification-integrity.ts";
import { parseFlightInput,ROLES } from "../lib/flight-input.ts";
import { ROLE_CREW_ROLES,roleCrewSpec } from "../lib/role-crew.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

type Policy="required_save"|"optional"|"not_applicable"|"external_resolver";
type Identity="SELF"|"COMMANDER"|"INSTRUCTOR"|"VERIFIER";
type Display="SELF"|"COMMANDER"|"INSTRUCTOR"|"VERIFIER";
type MatrixRow={
  role:string;
  self:boolean;
  identity:Identity;
  display:Display[];
  easaCommander:Policy;
  easaInstructor:Policy;
  easaVerification:Policy;
  connected:"allowed"|"not_applicable";
  allocation:{picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number};
};

const matrix:MatrixRow[]=[
  {role:"PIC",self:true,identity:"SELF",display:["COMMANDER","SELF"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"SOLO",self:true,identity:"SELF",display:["COMMANDER","SELF"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"CO-PILOT",self:false,identity:"COMMANDER",display:["COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:0,copilotMinutes:60,dualMinutes:0,instructorMinutes:0}},
  {role:"CRUISE-RELIEF CO-PILOT",self:false,identity:"COMMANDER",display:["COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:0,copilotMinutes:60,dualMinutes:0,instructorMinutes:0}},
  {role:"DUAL",self:false,identity:"INSTRUCTOR",display:["INSTRUCTOR","COMMANDER"],easaCommander:"optional",easaInstructor:"required_save",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:0,copilotMinutes:0,dualMinutes:60,instructorMinutes:0}},
  {role:"SPIC",self:false,identity:"VERIFIER",display:["VERIFIER","COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"required_save",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"PICUS",self:false,identity:"VERIFIER",display:["VERIFIER","COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"required_save",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"FI",self:true,identity:"SELF",display:["COMMANDER","SELF"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:60}},
  {role:"INSTRUCTOR",self:true,identity:"SELF",display:["COMMANDER","SELF"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:60}},
  {role:"EXAMINER",self:true,identity:"SELF",display:["COMMANDER","SELF"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:60,copilotMinutes:0,dualMinutes:0,instructorMinutes:60}},
  {role:"SAFETY PILOT",self:false,identity:"COMMANDER",display:["COMMANDER"],easaCommander:"external_resolver",easaInstructor:"optional",easaVerification:"optional",connected:"allowed",allocation:{picMinutes:0,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"PAX",self:false,identity:"COMMANDER",display:["COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:0,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
  {role:"OBSERVER",self:false,identity:"COMMANDER",display:["COMMANDER"],easaCommander:"optional",easaInstructor:"optional",easaVerification:"optional",connected:"not_applicable",allocation:{picMinutes:0,copilotMinutes:0,dualMinutes:0,instructorMinutes:0}},
];

function formFor(role:string,evidence:"EASA"|"ULL"="EASA"){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-10-02",
    registration:evidence==="EASA"?"OK-F25":"OK-ULL25",
    aircraftType:evidence==="EASA"?"Bristell B23":"ULL",
    aircraftClass:evidence==="EASA"?"SEP":"ULL",
    evidence,
    departure:"LKLT",
    arrival:"LKPR",
    offBlock:"10:00",
    takeoff:"10:05",
    landing:"10:55",
    onBlock:"11:00",
    starts:"1",
    landingsDay:"1",
    role,
    billingBasis:"",
    operationType:"SP",
    engineType:"SE",
  }))form.set(key,value);
  return form;
}

function satisfyCrewRequirements(form:FormData,role:string){
  if(role==="DUAL")form.set("instructor","Training Instructor");
  if(role==="SPIC"||role==="PICUS"){
    form.set("verificationName","Supervising PIC");
    form.set("verificationReference",`${role} signed evidence`);
  }
}

const certificationRow={
  id:2501,
  user_id:42,
  date:"2026-10-02",
  evidence:"EASA",
  registration:"OK-F25",
  aircraft_make:"BRM Aero",
  aircraft_model:"Bristell B23",
  aircraft_variant:"",
  aircraft_type:"B23",
  aircraft_class:"SEP",
  regulatory_category:"AEROPLANE",
  balloon_class:"",
  balloon_group:"",
  balloon_operation:"",
  launch_method:"",
  launches:0,
  departure:"LKLT",
  arrival:"LKPR",
  off_block:"10:00",
  takeoff:"10:05",
  landing:"10:55",
  on_block:"11:00",
  operation_type:"SP",
  engine_type:"SE",
  operator_name:"",
  flight_number:"",
  operation_context:"",
  landings_day:1,
  landings_night:0,
  movement_evidence_recorded:true,
  takeoffs_day:1,
  takeoffs_night:0,
  approaches_day:1,
  approaches_night:0,
  night_minutes:0,
  ifr_minutes:0,
  pic_minutes:60,
  copilot_minutes:0,
  dual_minutes:0,
  instructor_minutes:0,
  commander:"Historical Commander",
  instructor:"Training Instructor",
  role:"PIC",
  task:"F2.5 closeout",
  note:"RoleCrew compatibility record",
  purpose_code:"",
  verification_name:"Verifier Evidence",
  verification_reference:"Ref F25",
  record_revision:1,
  correction_reason:"",
};

test("F2.5 role matrix covers every Manual role exactly once",()=>{
  assert.deepEqual([...ROLE_CREW_ROLES],[...ROLES]);
  assert.equal(matrix.length,ROLES.length);
  assert.deepEqual(matrix.map(row=>row.role),[...ROLES]);
  assert.equal(new Set(matrix.map(row=>row.role)).size,ROLES.length);
});

test("F2.5 EASA RoleCrew policy and function-time allocation remain frozen for every role",()=>{
  for(const row of matrix){
    const spec=roleCrewSpec(row.role,"EASA");
    assert.ok(spec,row.role);
    assert.equal(spec?.selfIsPic,row.self,row.role);
    assert.equal(spec?.rolePicIdentitySource,row.identity,row.role);
    assert.deepEqual(spec?.picDisplayPrecedence,row.display,row.role);
    assert.equal(spec?.commander,row.easaCommander,row.role);
    assert.equal(spec?.instructor,row.easaInstructor,row.role);
    assert.equal(spec?.verificationName,row.easaVerification,row.role);
    assert.equal(spec?.verificationReference,row.easaVerification,row.role);
    assert.equal(spec?.connectedActualPic,row.connected,row.role);
    assert.deepEqual(allocatedFunctionTimes(row.role,60),row.allocation,row.role);
  }
});

test("F2.5 ULL RoleCrew policy stays permissive without inventing EASA Save blockers",()=>{
  for(const row of matrix){
    const spec=roleCrewSpec(row.role,"ULL");
    assert.ok(spec,row.role);
    assert.equal(spec?.commander,"optional",row.role);
    assert.equal(spec?.instructor,"optional",row.role);
    assert.equal(spec?.verificationName,"optional",row.role);
    assert.equal(spec?.verificationReference,"optional",row.role);
    assert.equal(spec?.connectedActualPic,row.connected,row.role);
    assert.equal(spec?.rolePicIdentitySource,row.identity,row.role);
    assert.deepEqual(spec?.picDisplayPrecedence,row.display,row.role);
  }
});

test("F2.5 crafted Manual EASA Save inputs pass only after their RoleCrew Save requirements are supplied",()=>{
  for(const row of matrix){
    const form=formFor(row.role,"EASA");
    if(row.role==="DUAL"){
      const rejected=parseFlightInput(form);
      assert.equal(rejected.data,undefined,row.role);
      assert.match(rejected.error??"",/instructor\/PIC/i,row.role);
    }else if(row.role==="SPIC"||row.role==="PICUS"){
      form.set("verificationName","Supervising PIC");
      const rejected=parseFlightInput(form);
      assert.equal(rejected.data,undefined,row.role);
      assert.match(rejected.error??"",/countersignature reference/i,row.role);
      form.delete("verificationName");
    }
    satisfyCrewRequirements(form,row.role);
    const parsed=parseFlightInput(form);
    assert.equal(parsed.error,undefined,row.role);
    assert.equal(parsed.data?.role,row.role,row.role);
  }
});

test("F2.5 crafted Manual ULL Save inputs do not acquire EASA crew requirements",()=>{
  for(const row of matrix){
    const parsed=parseFlightInput(formFor(row.role,"ULL"));
    assert.equal(parsed.error,undefined,row.role);
    assert.equal(parsed.data?.role,row.role,row.role);
  }
});

test("F2.5 certification fingerprints v1-v8 remain verifiable and RoleCrew evidence remains integrity-bound",()=>{
  for(let version=1;version<=8;version++){
    const candidate={...certificationRow,certification_version:version};
    const hash=flightCertificationHash(candidate,42,version);
    assert.match(hash,/^[a-f0-9]{64}$/,String(version));
    assert.equal(verifyFlightCertification({...candidate,certification_hash:hash},42).status,"verified",String(version));
    assert.equal(verifyFlightCertification({...candidate,certification_hash:hash,commander:"Tampered Commander"},42).status,"mismatch",String(version));
  }
  assert.equal(verifyFlightCertification({...certificationRow,certification_version:9,certification_hash:"x"},42).status,"unsupported");
  const action=read("app/(protected)/flights/certification-actions.ts");
  assert.match(action,/flightCertificationHash\(\{\.\.\.row,certification_version:8\},userId,8\)/);
  assert.match(action,/certification_version=8/);
});

test("F2.5 invitation workflows remain explicit, account-ID based and exact-source bound",()=>{
  const certification=read("app/(protected)/flights/certification-actions.ts");
  const instructor=read("app/(protected)/flights/instructor-actions.ts");
  const training=read("lib/training-verification.ts");
  const shared=read("app/(protected)/flights/shared-actions.ts");
  const saveActions=read("app/(protected)/flights/actions.ts");

  assert.doesNotMatch(certification,/upsertInstructorRequest|autoRequestTrainingVerification/);
  assert.match(instructor,/form\.get\("instructor_id"\)/);
  assert.match(training,/participant_role='INSTRUCTOR'/);
  assert.match(training,/source_revision=COALESCE\(f\.record_revision,1\)/);
  assert.match(training,/source_hash/);

  assert.match(shared,/export async function inviteConnectedPic/);
  assert.match(shared,/flight_connected_crew/);
  assert.match(shared,/participant_role='PIC'/);
  assert.match(shared,/source_revision/);
  assert.match(shared,/source_hash/);
  assert.match(shared,/validCrewCombination/);

  assert.doesNotMatch(saveActions,/INSERT INTO flight_participations/);
  assert.doesNotMatch(saveActions,/inviteConnectedPic|upsertInstructorRequest/);
});

test("F2.5 auxiliary roles remain non-creditable and do not silently enter LAPL experience",()=>{
  for(const role of ["SAFETY PILOT","PAX","OBSERVER"]){
    assert.deepEqual(allocatedFunctionTimes(role,60),{picMinutes:0,copilotMinutes:0,dualMinutes:0,instructorMinutes:0},role);
  }
  const recency=read("lib/recency-engine.ts");
  assert.doesNotMatch(recency,/laplExperienceRole[^\n]*SAFETY PILOT/);
  assert.doesNotMatch(recency,/laplExperienceRole[^\n]*PAX/);
  assert.doesNotMatch(recency,/laplExperienceRole[^\n]*OBSERVER/);
});

test("F2.5 GPS role scope is superseded narrowly by F4.1 PIC/DUAL and F4.3 Safety Pilot while later roles remain blocked",()=>{
  const gps=read("lib/gps-import-integrity.ts");
  const form=read("components/kml-import-form.tsx");
  assert.match(gps,/GPS_IMPORT_ROLES=\["PIC","DUAL","SAFETY PILOT"\]/);
  assert.match(gps,/GPS import currently supports PIC, DUAL and SAFETY PILOT/);
  assert.match(form,/GPS_IMPORT_ROLES\.map\(value=><option/);
  assert.match(form,/role==="DUAL"/);
  assert.match(form,/role==="SAFETY PILOT"/);
  for(const role of ["SPIC","PICUS","CO-PILOT"]){
    assert.doesNotMatch(form,new RegExp(`<option(?: value="[^"]+")?>${role.replace(/[.*+?^$()|[\]\\]/g,"\\test("F2.5 GPS role scope is superseded narrowly by F4.1 PIC and DUAL while later roles remain blocked",()=>{
  const gps=read("lib/gps-import-integrity.ts");
  const form=read("components/kml-import-form.tsx");
  assert.match(gps,/GPS_IMPORT_ROLES=\["PIC","DUAL"\]/);
  assert.match(gps,/GPS import currently supports PIC and DUAL/);
  assert.match(form,/GPS_IMPORT_ROLES\.map\(value=><option/);
  assert.match(form,/role==="DUAL"/);
  for(const role of ["SPIC","PICUS","SAFETY PILOT","CO-PILOT"]){
    assert.doesNotMatch(form,new RegExp(`<option(?: value="[^"]+")?>${role.replace(/[.*+?^$()|[\]\\]/g,"\\$&")}</option>`));
  }
});")}</option>`));
  }
});
