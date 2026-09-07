import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { blockingComplianceIssues,flightCertificationCompliance } from "../lib/fcl050-compliance.ts";
import { sharedFlightCreditMinutes } from "../lib/shared-flight-credit.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const codes=(row:Record<string,unknown>)=>blockingComplianceIssues(flightCertificationCompliance(row,"RC Pilot")).map(item=>item.code);
const base=(overrides:Record<string,unknown>={})=>({
  evidence:"EASA",regulatory_category:"",aircraft_class:"SEP",date:"2026-09-07",registration:"OK-RC1",aircraft_make:"Bristell",aircraft_model:"B23",aircraft_type:"B23",
  departure:"LKPR",arrival:"LKBE",off_block:"08:00",takeoff:"08:10",landing:"08:50",on_block:"09:00",operation_type:"SP",engine_type:"SE",
  starts:1,landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:60,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,
  commander:"",instructor:"",role:"PIC",task:"RC acceptance",note:"",verification_name:"",verification_reference:"",launch_method:"",launches:0,
  balloon_class:"",balloon_group:"",balloon_operation:"",...overrides
});

test("v2.0-RC keeps legacy TMG in Part-FCL and BLOCK-based certification",()=>{
  assert.deepEqual(codes(base({aircraft_class:"TMG",pic_minutes:60})),[]);
  assert.ok(codes(base({aircraft_class:"TMG",pic_minutes:40})).includes("function_time_allocation"),"legacy TMG must not silently switch to AIR credit");
});

test("v2.0-RC routes explicit SFCL TMG and legacy GLIDER through category-aware AIR certification",()=>{
  const tmg=base({regulatory_category:"SAILPLANE",aircraft_class:"TMG",operation_type:"",engine_type:"",pic_minutes:40});
  assert.deepEqual(codes(tmg),[],"explicit SFCL TMG must use AIR credit without FCL.050 SP/MP or SE/ME requirements");
  const glider=base({aircraft_class:"GLIDER",operation_type:"",engine_type:"",pic_minutes:40,launch_method:"WINCH",launches:1});
  assert.deepEqual(codes(glider),[],"legacy GLIDER must resolve conservatively to Part-SFCL");
});

test("v2.0-RC routes legacy Balloon to BFCL integrity checks instead of FCL.050",()=>{
  const balloon=base({aircraft_class:"BALLOON",operation_type:"",engine_type:"",off_block:"08:00",takeoff:"08:15",landing:"09:15",on_block:"09:30",pic_minutes:60,balloon_class:"HOT_AIR_BALLOON",balloon_group:"A",balloon_operation:"FREE"});
  assert.deepEqual(codes(balloon),[]);
  assert.ok(codes({...balloon,balloon_operation:""}).includes("balloon_operation"));
  assert.ok(codes({...balloon,balloon_class:"HOT_AIR_BALLOON",balloon_group:""}).includes("balloon_group"));
});

test("v2.0-RC keeps Helicopter and unclassified EASA records on the existing FCL.050 gate",()=>{
  assert.ok(codes(base({regulatory_category:"HELICOPTER",aircraft_class:"HELICOPTER",engine_type:""})).includes("engine_type"));
  assert.ok(codes(base({regulatory_category:"OTHER",aircraft_class:"OTHER",operation_type:""})).includes("operation_type"));
});

test("v2.0-RC shared-flight credit uses conservative legacy resolution without rewriting snapshots",()=>{
  const time={off_block:"10:00",on_block:"11:20",takeoff:"10:20",landing:"11:00",evidence:"EASA"};
  assert.equal(sharedFlightCreditMinutes({...time,regulatory_category:"",aircraft_class:"GLIDER"}),40);
  assert.equal(sharedFlightCreditMinutes({...time,regulatory_category:"SAILPLANE",aircraft_class:"TMG"}),40);
  assert.equal(sharedFlightCreditMinutes({...time,regulatory_category:"",aircraft_class:"TMG"}),80);
  assert.equal(sharedFlightCreditMinutes({...time,regulatory_category:"",aircraft_class:"BALLOON"}),40);
  assert.equal(sharedFlightCreditMinutes({...time,evidence:"ULL",regulatory_category:"",aircraft_class:"ULL"}),80);
  const sharing=read("app/(protected)/flights/shared-actions.ts");
  assert.match(sharing,/sharedFlightCreditMinutes\(row\)/);
  assert.match(sharing,/\$\{text\(row\.regulatory_category\)\}/,"participant copy must preserve the source regulatory-category snapshot rather than rewriting history");
});

test("v2.0-RC certification action uses the category router and revision archive keeps the complete certified snapshot",()=>{
  const action=read("app/(protected)/flights/certification-actions.ts"),integrity=read("lib/certification-integrity.ts");
  assert.match(action,/flightCertificationCompliance\(row,text\(row\.pilot_name\)\)/);
  assert.doesNotMatch(action,/const compliance=fcl050FlightCompliance/);
  assert.match(action,/to_jsonb\(f\).*flight_certified_revisions/s);
  for(const field of ["regulatory_category","balloon_class","balloon_group","balloon_operation","launch_method","launches"])assert.match(integrity,new RegExp(field));
});

test("v2.0-RC portable backup, restore and trash paths preserve category evidence",()=>{
  const backup=read("lib/account-backup.ts"),restore=read("lib/account-restore-v6.ts"),trash=read("lib/flight-trash.ts");
  assert.match(backup,/format:"pilot-logbook-portable",version:11/);
  assert.match(backup,/SELECT \* FROM flights WHERE user_id=/);
  assert.match(restore,/jsonb_populate_record\(NULL::flights/);
  assert.match(restore,/flight_certified_revisions/);
  for(const field of ["regulatory_category","balloon_class","balloon_group","balloon_operation","launch_method","launches"])assert.match(trash,new RegExp(field));
});

test("v2.0-RC category migrations remain conservative for historical certified evidence",()=>{
  const sailplane=read("lib/v162-schema.ts"),balloon=read("lib/v164-schema.ts");
  assert.match(sailplane,/UPDATE flights SET regulatory_category=CASE[\s\S]*certified_at IS NULL/);
  assert.doesNotMatch(sailplane,/UPDATE flights SET regulatory_category=CASE[\s\S]*certified_at IS NOT NULL/);
  assert.doesNotMatch(balloon,/UPDATE flights SET/);
  assert.match(sailplane,/TMG','MEP','SET'\) THEN 'AEROPLANE'/);
});
