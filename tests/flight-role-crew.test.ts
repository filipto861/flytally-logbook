import test from "node:test";
import assert from "node:assert/strict";

import { parseFlightInput } from "../lib/flight-input.ts";
import { roleCrewSpec } from "../lib/role-crew.ts";

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

test("F2.1 RoleCrew spec freezes PIC identity sources and Save policies",()=>{
  const pic=roleCrewSpec("PIC","EASA");
  assert.equal(pic?.selfIsPic,true);
  assert.equal(pic?.picNameSource,"SELF");
  assert.equal(pic?.commander,"not_applicable");

  const dual=roleCrewSpec("DUAL","EASA");
  assert.equal(dual?.instructor,"required_save");
  assert.equal(dual?.picNameSource,"INSTRUCTOR");
  assert.equal(roleCrewSpec("DUAL","ULL")?.instructor,"optional");

  for(const role of ["SPIC","PICUS"]){
    const spec=roleCrewSpec(role,"EASA");
    assert.equal(spec?.verificationName,"required_save");
    assert.equal(spec?.verificationReference,"required_save");
    assert.equal(spec?.picNameSource,"VERIFIER");
  }

  const safety=roleCrewSpec("SAFETY PILOT","EASA");
  assert.equal(safety?.commander,"external_resolver");
  assert.equal(safety?.connectedActualPic,"allowed");

  for(const role of ["CO-PILOT","CRUISE-RELIEF CO-PILOT","PAX","OBSERVER"]){
    assert.equal(roleCrewSpec(role,"EASA")?.commander,"optional");
  }
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
