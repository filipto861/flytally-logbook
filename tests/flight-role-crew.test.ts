import test from "node:test";
import assert from "node:assert/strict";

import { parseFlightInput } from "../lib/flight-input.ts";
import { resolveRoleCrewPicName,roleCrewSpec } from "../lib/role-crew.ts";

function formFor(role:string,evidence="EASA"){
  const form=new FormData();
  const aircraftClass=evidence==="ULL"?"ULL":"SEP";
  for(const [key,value] of Object.entries({
    date:"2026-10-01",
    registration:"OK-F21",
    aircraftType:"Bristell B23",
    offBlock:"10:00",
    takeoff:"10:10",
    landing:"11:00",
    onBlock:"11:10",
    starts:"1",
    role,
    evidence,
    aircraftClass,
    billingBasis:"",
    operationType:"SP",
    engineType:"SE",
  }))form.set(key,value);
  return form;
}

test("F2.4B RoleCrew separates role identity policy from PIC display precedence",()=>{
  const pic=roleCrewSpec("PIC","EASA");
  assert.equal(pic?.selfIsPic,true);
  assert.equal(pic?.rolePicIdentitySource,"SELF");
  assert.equal(pic?.commander,"optional");
  assert.deepEqual(pic?.picDisplayPrecedence,["COMMANDER","SELF"]);

  const dual=roleCrewSpec("DUAL","EASA");
  assert.equal(dual?.instructor,"required_save");
  assert.equal(dual?.rolePicIdentitySource,"INSTRUCTOR");
  assert.deepEqual(dual?.picDisplayPrecedence,["INSTRUCTOR","COMMANDER"]);
  assert.equal(roleCrewSpec("DUAL","ULL")?.instructor,"optional");

  for(const role of ["SPIC","PICUS"]){
    const spec=roleCrewSpec(role,"EASA");
    assert.equal(spec?.verificationName,"required_save");
    assert.equal(spec?.verificationReference,"required_save");
    assert.equal(spec?.rolePicIdentitySource,"VERIFIER");
    assert.deepEqual(spec?.picDisplayPrecedence,["VERIFIER","COMMANDER"]);
  }

  const safety=roleCrewSpec("SAFETY PILOT","EASA");
  assert.equal(safety?.commander,"external_resolver");
  assert.equal(safety?.connectedActualPic,"allowed");
  assert.equal(safety?.rolePicIdentitySource,"COMMANDER");
  assert.deepEqual(safety?.picDisplayPrecedence,["COMMANDER"]);

  for(const role of ["CO-PILOT","CRUISE-RELIEF CO-PILOT","PAX","OBSERVER"]){
    const spec=roleCrewSpec(role,"EASA");
    assert.equal(spec?.commander,"optional");
    assert.equal(spec?.rolePicIdentitySource,"COMMANDER");
    assert.deepEqual(spec?.picDisplayPrecedence,["COMMANDER"]);
  }
});

test("F2.4B PIC resolver preserves historical commander precedence without account inference",()=>{
  assert.equal(resolveRoleCrewPicName({role:"PIC",commander:"Historical PIC",selfName:"Owner Pilot"}),"Historical PIC");
  assert.equal(resolveRoleCrewPicName({role:"PIC",commander:"",selfName:"Owner Pilot"}),"Owner Pilot");
  assert.equal(resolveRoleCrewPicName({role:"DUAL",instructor:"Instructor",commander:"Captain",selfName:"Student"}),"Instructor");
  assert.equal(resolveRoleCrewPicName({role:"PICUS",verificationName:"Supervisor",commander:"Captain",selfName:"Student"}),"Supervisor");
  assert.equal(resolveRoleCrewPicName({role:"UNKNOWN",commander:"Legacy Commander",selfName:"Owner Pilot"}),"Legacy Commander");
});

test("F2.1 makes EASA DUAL instructor server-required while preserving ULL behavior",()=>{
  const missing=parseFlightInput(formFor("DUAL"));
  assert.equal(missing.data,undefined);
  assert.match(missing.error??"",/instructor\/PIC/i);

  const easa=formFor("DUAL");easa.set("instructor","Instructor Name");
  assert.equal(parseFlightInput(easa).data?.instructor,"Instructor Name");

  const ull=parseFlightInput(formFor("DUAL","ULL"));
  assert.equal(ull.error,undefined);
  assert.equal(ull.data?.role,"DUAL");
});

test("F2.1 keeps SPIC and PICUS countersignature validation on the shared contract",()=>{
  for(const role of ["SPIC","PICUS"]){
    const form=formFor(role);form.set("verificationName","Supervising PIC");
    let parsed=parseFlightInput(form);
    assert.equal(parsed.data,undefined);
    assert.match(parsed.error??"",/countersignature reference/i);

    form.set("verificationReference","Signed ref F21");
    parsed=parseFlightInput(form);
    assert.equal(parsed.error,undefined);
    assert.equal(parsed.data?.verificationName,"Supervising PIC");
    assert.equal(parsed.data?.verificationReference,"Signed ref F21");
  }
});

test("F2.1 does not tighten commander-optional draft roles",()=>{
  for(const role of ["PIC","SOLO","FI","INSTRUCTOR","EXAMINER","CO-PILOT","CRUISE-RELIEF CO-PILOT","PAX","OBSERVER"]){
    const parsed=parseFlightInput(formFor(role));
    assert.equal(parsed.error,undefined,role);
    assert.equal(parsed.data?.role,role);
  }
});

test("F2.1 leaves Safety Pilot account/manual authority at the action resolver boundary",()=>{
  const parsed=parseFlightInput(formFor("SAFETY PILOT"));
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.role,"SAFETY PILOT");
  assert.equal(roleCrewSpec("SAFETY PILOT","EASA")?.commander,"external_resolver");
});

test("F2.1 performs no destructive sanitization of additional training or endorsement evidence",()=>{
  const form=formFor("PIC");
  form.set("commander","Legacy explicit commander");
  form.set("instructor","Training instructor");
  form.set("verificationName","Examiner");
  form.set("verificationReference","Signed check");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.commander,"Legacy explicit commander");
  assert.equal(parsed.data?.instructor,"Training instructor");
  assert.equal(parsed.data?.verificationName,"Examiner");
  assert.equal(parsed.data?.verificationReference,"Signed check");
});
