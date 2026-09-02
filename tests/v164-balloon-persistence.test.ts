import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flightCertificationHash,flightCertificationPayload } from "../lib/certification-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.64 normal create/edit and GPS import persist balloon context and purpose",()=>{
  const source=read("app/(protected)/flights/actions.ts");
  assert.match(source,/regulatory_category,balloon_class,balloon_group,launch_method/);
  assert.match(source,/task,purpose_code,price_per_hour/);
  assert.match(source,/balloon_class=\$\{f\.balloonClass\}/);
  assert.match(source,/balloon_group=\$\{f\.balloonGroup\}/);
  assert.match(source,/purpose_code=\$\{f\.purposeCode\}/);
  assert.match(source,/SELECT COALESCE\(regulatory_category,''\) regulatory_category,COALESCE\(balloon_class,''\) balloon_class,COALESCE\(balloon_group,''\) balloon_group FROM aircraft/);
});

test("v1.64 database aircraft editor round-trips explicit balloon class and group",()=>{
  const manager=read("components/aircraft-manager.tsx"),data=read("lib/data/database-v164.ts");
  assert.match(manager,/name="balloon_class"/);assert.match(manager,/name="balloon_group"/);
  assert.match(manager,/Select balloon class/);assert.match(manager,/Select group/);
  assert.match(data,/COALESCE\(balloon_class,''\) balloon_class/);assert.match(data,/COALESCE\(balloon_group,''\) balloon_group/);
});

test("certification v6 protects balloon class and group without changing v5 semantics",()=>{
  const row:Record<string,unknown>={id:64,date:"2026-09-02",evidence:"EASA",registration:"OK-BAL",aircraft_type:"Balloon",aircraft_class:"BALLOON",regulatory_category:"BALLOON",balloon_class:"HOT_AIR_BALLOON",balloon_group:"B",departure:"SITE-A",arrival:"SITE-B",off_block:"09:50",takeoff:"10:00",landing:"11:00",on_block:"11:10",operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,role:"PIC",record_revision:1,purpose_code:"",movement_evidence_recorded:false,takeoffs_day:1,takeoffs_night:0,approaches_day:0,approaches_night:0,launch_method:"",launches:0};
  const changed={...row,balloon_group:"C"};
  assert.equal(flightCertificationHash(row,9,5),flightCertificationHash(changed,9,5));
  assert.notEqual(flightCertificationHash(row,9,6),flightCertificationHash(changed,9,6));
  const payload=flightCertificationPayload(row,9,6) as Record<string,unknown>;
  assert.deepEqual(payload.balloonContext,{balloonClass:"HOT_AIR_BALLOON",balloonGroup:"B"});
  assert.equal(flightCertificationPayload(row,9,7),null);
  assert.match(read("app/(protected)/flights/certification-actions.ts"),/certification_version=6/);
});
