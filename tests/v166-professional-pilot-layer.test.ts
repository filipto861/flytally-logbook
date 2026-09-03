import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flightCertificationHash,flightCertificationPayload } from "../lib/certification-integrity.ts";
import { fcl050FlightCompliance } from "../lib/fcl050-compliance.ts";
import { normalizeProfessionalOperationContext,roleRequiresMultiPilotOperation,supportsProfessionalContext } from "../lib/professional-context.ts";
import { professionalCreditableMinutes,professionalExperienceSummary } from "../lib/professional-experience.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(relative:string)=>fs.readFileSync(path.join(root,relative),"utf8");
const certified={certified_at:"2026-09-03T10:00:00Z",evidence:"EASA",regulatory_category:"AEROPLANE"};

test("v1.66 professional context is explicit and limited to Part-FCL aeroplane/helicopter records",()=>{
  assert.equal(normalizeProfessionalOperationContext("cat"),"CAT");
  assert.equal(normalizeProfessionalOperationContext("airline"),"");
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"AEROPLANE"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"HELICOPTER"}),true);
  assert.equal(supportsProfessionalContext({evidence:"EASA",regulatoryCategory:"SAILPLANE"}),false);
  assert.equal(supportsProfessionalContext({evidence:"ULL",regulatoryCategory:"ULL"}),false);
});

test("v1.66 co-pilot functions require an explicit multi-pilot operation",()=>{
  assert.equal(roleRequiresMultiPilotOperation("CO-PILOT"),true);
  assert.equal(roleRequiresMultiPilotOperation("CRUISE-RELIEF CO-PILOT"),true);
  assert.equal(roleRequiresMultiPilotOperation("PIC"),false);
  assert.equal(roleRequiresMultiPilotOperation("PICUS"),false);
  const base={evidence:"EASA",date:"2026-09-03",departure:"LKPR",arrival:"EDDF",off_block:"10:00",on_block:"11:00",registration:"OK-ABC",aircraft_make:"Test",aircraft_model:"Jet",engine_type:"ME",operation_type:"SP",role:"CO-PILOT",commander:"Captain",copilot_minutes:60,pic_minutes:0,dual_minutes:0,instructor_minutes:0,landings_day:1,landings_night:0,starts:1};
  assert.ok(fcl050FlightCompliance(base).some(item=>item.code==="copilot_requires_mp"&&item.severity==="error"));
  assert.ok(!fcl050FlightCompliance({...base,operation_type:"MP"}).some(item=>item.code==="copilot_requires_mp"));
});

test("v1.66 certification v8 protects professional context while v7 remains bit-compatible",()=>{
  const row:Record<string,unknown>={id:166,date:"2026-09-03",evidence:"EASA",registration:"OK-JET",aircraft_make:"Example",aircraft_model:"Jet",aircraft_type:"JET",aircraft_class:"MEP",regulatory_category:"AEROPLANE",departure:"LKPR",arrival:"EDDF",off_block:"10:00",takeoff:"10:10",landing:"11:20",on_block:"11:30",operation_type:"MP",engine_type:"ME",landings_day:1,landings_night:0,night_minutes:0,ifr_minutes:80,pic_minutes:0,copilot_minutes:90,dual_minutes:0,instructor_minutes:0,commander:"Captain",role:"CO-PILOT",purpose_code:"",movement_evidence_recorded:true,takeoffs_day:1,takeoffs_night:0,approaches_day:1,approaches_night:0,launch_method:"",launches:0,balloon_class:"",balloon_group:"",balloon_operation:"",record_revision:1,operator_name:"Example Air",flight_number:"EX166",operation_context:"CAT"};
  const changed={...row,flight_number:"EX167"};
  assert.equal(flightCertificationHash(row,7,7),flightCertificationHash(changed,7,7));
  assert.notEqual(flightCertificationHash(row,7,8),flightCertificationHash(changed,7,8));
  assert.deepEqual((flightCertificationPayload(row,7,8) as Record<string,unknown>).professionalContext,{operatorName:"Example Air",flightNumber:"EX166",operationContext:"CAT"});
  assert.match(read("app/(protected)/flights/certification-actions.ts"),/certification_version=8/);
});

test("v1.66 professional experience excludes uncertified and non-Part-FCL records",()=>{
  assert.equal(professionalCreditableMinutes({...certified,role:"PIC",pic_minutes:90}),90);
  assert.equal(professionalCreditableMinutes({...certified,certified_at:null,role:"PIC",pic_minutes:90}),0);
  assert.equal(professionalCreditableMinutes({...certified,regulatory_category:"BALLOON",role:"PIC",pic_minutes:90}),0);
  assert.equal(professionalCreditableMinutes({...certified,role:"SAFETY PILOT",pic_minutes:90}),0);
});

test("v1.66 keeps PICUS and SPIC separate from ordinary PIC experience",()=>{
  const result=professionalExperienceSummary([
    {...certified,role:"PIC",pic_minutes:60,operation_type:"SP",ifr_minutes:20,night_minutes:10},
    {...certified,role:"SPIC",pic_minutes:45,operation_type:"SP"},
    {...certified,role:"PICUS",pic_minutes:75,operation_type:"MP"},
    {...certified,role:"CO-PILOT",copilot_minutes:80,operation_type:"MP"},
    {...certified,role:"CRUISE-RELIEF CO-PILOT",copilot_minutes:40,operation_type:"MP",operation_context:"CAT"},
  ]);
  assert.equal(result.flights,5);
  assert.equal(result.picMinutes,60);
  assert.equal(result.spicMinutes,45);
  assert.equal(result.picusMinutes,75);
  assert.equal(result.copilotMinutes,80);
  assert.equal(result.cruiseReliefMinutes,40);
  assert.equal(result.multiPilotMinutes,195);
  assert.equal(result.catMinutes,40);
  assert.equal(result.totalMinutes,300);
});

test("v1.66 instructor overlap is not double-counted in total experience",()=>{
  const result=professionalExperienceSummary([{...certified,role:"INSTRUCTOR",pic_minutes:70,instructor_minutes:70,operation_type:"SP"}]);
  assert.equal(result.totalMinutes,70);
  assert.equal(result.picMinutes,70);
  assert.equal(result.instructorMinutes,70);
});

test("v1.66 schema is additive and runtime initialized without historical backfill",()=>{
  const schema=read("lib/v166-schema.ts"),runtime=read("lib/runtime-schema.ts");
  for(const column of ["operator_name","flight_number","operation_context"])assert.match(schema,new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
  assert.doesNotMatch(schema,/UPDATE\s+flights\s+SET\s+(?:operator_name|flight_number|operation_context)/i);
  assert.match(runtime,/ensureV166Schema/);
});