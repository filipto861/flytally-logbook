import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gpsFlightCandidate,manualFlightCandidate } from "../lib/flight-draft-candidate.ts";
import { normalizeFlightDraft,parseFlightInput } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");

function baseForm(){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-10-01",
    registration:"OK-F12",
    aircraftType:"Bristell B23",
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    departure:"LKPR",
    arrival:"LKLT",
    offBlock:"10:00",
    takeoff:"10:10",
    landing:"11:00",
    onBlock:"11:10",
    role:"PIC",
    billingBasis:"BLOCK",
    billingShare:"1",
    operationType:"SP",
    engineType:"SE",
    landingsDay:"1",
    landingsNight:"0",
  }))form.set(key,value);
  return form;
}

test("F1.2 parseFlightInput is a compatibility wrapper over the pure normalizer",()=>{
  const form=baseForm();
  form.set("movementEvidenceRecorded","yes");
  form.set("takeoffsDay","1");
  form.set("approachesDay","1");
  form.set("nightTime","0:10");
  form.set("ifrTime","0:20");
  form.set("task","Line check");
  form.set("note","wrapper parity");

  assert.deepEqual(parseFlightInput(form),normalizeFlightDraft(manualFlightCandidate(form)));
});

test("F1.2 pure normalizer preserves canonical Manual SEP semantics",()=>{
  const result=normalizeFlightDraft(manualFlightCandidate(baseForm()));
  assert.equal(result.error,undefined);
  assert.deepEqual(result.data&&{
    evidence:result.data.evidence,
    aircraftClass:result.data.aircraftClass,
    regulatoryCategory:result.data.regulatoryCategory,
    starts:result.data.starts,
    landingsDay:result.data.landingsDay,
    landingsNight:result.data.landingsNight,
    operationType:result.data.operationType,
    engineType:result.data.engineType,
    picMinutes:result.data.picMinutes,
    billingBasis:result.data.billingBasis,
  },{
    evidence:"EASA",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    starts:1,
    landingsDay:1,
    landingsNight:0,
    operationType:"SP",
    engineType:"SE",
    picMinutes:70,
    billingBasis:"BLOCK",
  });
});

test("F1.2 pure normalizer preserves SPIC countersignature validation",()=>{
  const form=baseForm();
  form.set("role","SPIC");
  form.set("verificationName","Supervising PIC");
  let result=normalizeFlightDraft(manualFlightCandidate(form));
  assert.equal(result.data,undefined);
  assert.match(result.error??"",/countersignature reference/i);

  form.set("verificationReference","Signed ref F12");
  result=normalizeFlightDraft(manualFlightCandidate(form));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.role,"SPIC");
  assert.equal(result.data?.picMinutes,70);
});

test("F1.2 pure normalizer preserves non-TMG sailplane launch and AIR credit semantics",()=>{
  const form=baseForm();
  form.set("registration","OK-GLD");
  form.set("aircraftType","Sailplane");
  form.set("aircraftClass","GLIDER");
  form.set("regulatoryCategory","SAILPLANE");
  form.set("launchMethod","AEROTOW");
  form.set("launches","1");
  const result=normalizeFlightDraft(manualFlightCandidate(form));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.launchMethod,"AEROTOW");
  assert.equal(result.data?.launches,1);
  assert.equal(result.data?.starts,1);
  assert.equal(result.data?.picMinutes,50);
});

test("F1.2 pure normalizer preserves BFCL class/group/operation semantics",()=>{
  const form=baseForm();
  form.set("registration","OK-BAL");
  form.set("aircraftType","Balloon");
  form.set("aircraftClass","BALLOON");
  form.set("regulatoryCategory","BALLOON");
  form.set("balloonClass","HOT_AIR_BALLOON");
  form.set("balloonGroup","B");
  form.set("balloonOperation","FREE");
  form.set("takeoffsDay","1");
  const result=normalizeFlightDraft(manualFlightCandidate(form));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.balloonClass,"HOT_AIR_BALLOON");
  assert.equal(result.data?.balloonGroup,"B");
  assert.equal(result.data?.balloonOperation,"FREE");
  assert.equal(result.data?.takeoffsDay,1);
  assert.equal(result.data?.picMinutes,50);
});

test("F1.2 pure normalizer preserves professional context and purpose normalization",()=>{
  const form=baseForm();
  form.set("operatorName","Example Air");
  form.set("flightNumber","ex12");
  form.set("operationContext","CAT");
  form.set("role","DUAL");
  form.set("instructor","Instructor");
  form.set("purposeSelectionPresent","1");
  form.append("purposeCode","LAPL_FCL140A_REFRESHER");
  form.set("task","Exercise 12");
  const result=normalizeFlightDraft(manualFlightCandidate(form));
  assert.equal(result.error,undefined);
  assert.equal(result.data?.operatorName,"Example Air");
  assert.equal(result.data?.flightNumber,"EX12");
  assert.equal(result.data?.operationContext,"CAT");
  assert.equal(result.data?.purposeCode,"LAPL_FCL140A_REFRESHER");
  assert.equal(result.data?.task,"FCL.140.A refresher training · Exercise 12");
});

test("F1.2 pure normalizer fails closed on unresolved candidate authority",()=>{
  const candidate=gpsFlightCandidate({
    registration:"OK-F12",
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
    role:"PIC",
    billingBasis:"",
    billingShare:"1",
    task:"GPS import",
    reviewedPart:{
      date:"2026-10-01",
      departure:"LKPR",
      arrival:"LKLT",
      offBlock:"10:00",
      takeoff:"10:10",
      landing:"11:00",
      onBlock:"11:10",
      starts:"1",
    },
  });
  const result=normalizeFlightDraft(candidate);
  assert.equal(result.data,undefined);
  assert.match(result.error??"",/launch|operation|landing|night|movement|evidence|configuration/i);
});

test("F1.2 normalizer body has no FormData, DB or account dependency",()=>{
  const source=fs.readFileSync(path.join(root,"lib/flight-input.ts"),"utf8");
  const start=source.indexOf("export function normalizeFlightDraft");
  const end=source.indexOf("export function parseFlightInput",start);
  assert.ok(start>=0&&end>start);
  const normalizer=source.slice(start,end);
  assert.doesNotMatch(normalizer,/FormData|sql\`|requireUser|requireAuth|process\.env/);
  assert.match(source,/return normalizeFlightDraft\(manualFlightCandidate\(form\)\)/);
});
