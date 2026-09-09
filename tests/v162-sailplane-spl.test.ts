import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { flightCertificationHash,verifyFlightCertification } from "../lib/certification-integrity.ts";
import { flightEntryProfile,regulatoryAircraftCategory } from "../lib/flight-entry-profile.ts";
import { parseFlightInput } from "../lib/flight-input.ts";
import { evaluateLaunchMethod,evaluateSplPassenger,evaluateSplSailplane,evaluateSplTmg,type SplFlight } from "../lib/spl-recency.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const baseForm=()=>{const form=new FormData();for(const [key,value] of Object.entries({date:"2026-09-01",registration:"OK-GLD",aircraftType:"Test sailplane",departure:"LKLT",arrival:"LKLT",offBlock:"10:00",takeoff:"10:05",landing:"10:55",onBlock:"11:00",role:"PIC",evidence:"EASA",billingBasis:"AIR",billingShare:"1",operationType:"SP",engineType:"SE"}))form.set(key,value);return form};
const splFlight=(overrides:Partial<SplFlight>={}):SplFlight=>({date:"2026-08-01",regulatoryCategory:"SAILPLANE",aircraftClass:"GLIDER",role:"PIC",minutes:60,airMinutes:60,launches:1,launchMethod:"WINCH",landingsDay:1,landingsNight:0,takeoffsDay:0,takeoffsNight:0,purposeCode:"",instructorSigned:false,...overrides});

test("v1.62 release metadata and production PR acceptance gate are synchronized",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  const [major,minor]=String(pkg.version).split(".").map(Number);assert.ok(major>1||(major===1&&minor>=62));assert.equal(lock.version,pkg.version);assert.equal(lock.packages?.[""]?.version,pkg.version);
  assert.match(read("ROADMAP.md"),/v1[.]62[.]0 — Sailplane \/ SPL \/ TMG support/);assert.match(read("CHANGELOG.md"),/1[.]62[.]0 — Sailplane \/ SPL \/ TMG support/);
  const workflow=read(".github/workflows/verify-web.yml");assert.match(workflow,/pull_request:[\s\S]*branches:[\s\S]*- main/);assert.match(workflow,/PostgreSQL acceptance tests/);
});

test("v1.62 keeps legacy TMG in Part-FCL unless SPL context is explicit",()=>{
  assert.equal(regulatoryAircraftCategory({aircraftClass:"TMG",evidence:"EASA"}),"AEROPLANE");
  assert.equal(regulatoryAircraftCategory({regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}),"SAILPLANE");
  assert.equal(flightEntryProfile({hasAircraft:true,regulatoryCategory:"SAILPLANE",aircraftClass:"TMG",evidence:"EASA"}).category,"sailplane");
});

test("v1.62 non-TMG sailplane entry stores explicit launch evidence and credits AIR time",()=>{
  const form=baseForm();form.set("aircraftClass","GLIDER");form.set("regulatoryCategory","SAILPLANE");form.set("launchMethod","AEROTOW");form.set("launches","1");form.set("landingsDay","1");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.regulatoryCategory,"SAILPLANE");
  assert.equal(parsed.data?.launchMethod,"AEROTOW");
  assert.equal(parsed.data?.launches,1);
  assert.equal(parsed.data?.starts,1);
  assert.equal(parsed.data?.picMinutes,50);
});

test("v1.62 refuses fabricated non-TMG launch evidence",()=>{
  const form=baseForm();form.set("aircraftClass","GLIDER");form.set("regulatoryCategory","SAILPLANE");form.set("launches","1");form.set("landingsDay","1");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.data,undefined);
  assert.match(parsed.error??"",/launch method/i);
});

test("v1.62 SPL TMG persists explicit take-offs without pretending they are FCL.060 PF evidence",()=>{
  const form=baseForm();form.set("registration","OK-TMG");form.set("aircraftClass","TMG");form.set("regulatoryCategory","SAILPLANE");form.set("landingsDay","2");form.set("landingsNight","1");form.set("takeoffsDay","2");form.set("takeoffsNight","1");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.regulatoryCategory,"SAILPLANE");
  assert.equal(parsed.data?.takeoffsDay,2);
  assert.equal(parsed.data?.takeoffsNight,1);
  assert.equal(parsed.data?.movementEvidenceRecorded,false);
  assert.equal(parsed.data?.launches,0);
});

test("SFCL.160(a) 5-hour total may include SPL TMG time but launch/training requirements remain non-TMG",()=>{
  const flights=[
    splFlight({aircraftClass:"TMG",airMinutes:240,minutes:240,launches:0,launchMethod:"",takeoffsDay:4,landingsDay:4}),
    splFlight({role:"DUAL",airMinutes:30,minutes:30,launches:8,purposeCode:"SPL_SFCL160_TRAINING",instructorSigned:true}),
    splFlight({role:"DUAL",date:"2026-08-02",airMinutes:30,minutes:30,launches:7,purposeCode:"SPL_SFCL160_TRAINING",instructorSigned:true}),
  ];
  const result=evaluateSplSailplane(flights,"2026-09-01");
  assert.equal(result.status,"current");
  assert.equal(result.requirements.find(item=>item.id==="flight-time")?.current,5);
  assert.equal(result.requirements.find(item=>item.id==="launches")?.current,15);
});

test("SFCL.160(c) Part-FCL TMG privilege selects the exemption route explicitly",()=>{
  const result=evaluateSplTmg([],"2026-09-01",[],true);
  assert.equal(result.status,"current");
  assert.equal(result.badge,"PART-FCL ROUTE");
  assert.equal(result.meta?.partFclExemption,true);
});

test("SFCL.155 self-launch recency accepts explicit SPL TMG take-offs",()=>{
  const result=evaluateLaunchMethod([splFlight({aircraftClass:"TMG",launchMethod:"",launches:0,takeoffsDay:5,landingsDay:5})],"2026-09-01","SELF_LAUNCH");
  assert.equal(result.status,"current");
  assert.equal(result.requirements[0]?.current,5);
});

test("SPL TMG night passenger currency requires a night movement among the three",()=>{
  const result=evaluateSplPassenger([splFlight({aircraftClass:"TMG",takeoffsDay:2,takeoffsNight:1,landingsDay:2,landingsNight:1})],"2026-09-01","TMG",true);
  assert.equal(result.status,"current");
  assert.equal(result.requirements.find(item=>item.id==="night-movement")?.current,1);
});

test("v5 certification fingerprint binds regulatory category and launch evidence while legacy v4 stays compatible",()=>{
  const row={id:62,date:"2026-09-01",evidence:"EASA",registration:"OK-GLD",aircraft_type:"Sailplane",aircraft_class:"GLIDER",regulatory_category:"SAILPLANE",launch_method:"WINCH",launches:1,departure:"LKLT",arrival:"LKLT",off_block:"10:00",takeoff:"10:05",landing:"10:55",on_block:"11:00",operation_type:"SP",engine_type:"SE",landings_day:1,landings_night:0,movement_evidence_recorded:false,takeoffs_day:0,takeoffs_night:0,approaches_day:0,approaches_night:0,night_minutes:0,ifr_minutes:0,pic_minutes:50,copilot_minutes:0,dual_minutes:0,instructor_minutes:0,commander:"Pilot",instructor:"",role:"PIC",task:"",note:"",purpose_code:"",verification_name:"",verification_reference:"",record_revision:1,correction_reason:""};
  const hash5=flightCertificationHash({...row,certification_version:5},7,5);
  assert.equal(verifyFlightCertification({...row,certification_version:5,certification_hash:hash5},7).status,"verified");
  assert.equal(verifyFlightCertification({...row,launch_method:"AEROTOW",certification_version:5,certification_hash:hash5},7).status,"mismatch");
  const hash4=flightCertificationHash({...row,certification_version:4},7,4);
  assert.equal(verifyFlightCertification({...row,launch_method:"AEROTOW",certification_version:4,certification_hash:hash4},7).status,"verified");
});

test("v1.62 integrity plumbing preserves SPL fields through UI sharing trash and portable backup",()=>{
  const form=read("components/flight-form.tsx"),shared=read("app/(protected)/flights/shared-actions.ts"),trash=read("lib/flight-trash.ts"),backup=read("lib/account-backup.ts"),portable=read("lib/portable-backup.ts"),detail=read("components/readonly-logbook-entry.tsx");
  assert.match(form,/TMG take-off evidence/);assert.match(form,/name="takeoffsDay"/);assert.match(form,/name="launchMethod"/);
  for(const source of [shared,trash]){assert.match(source,/regulatory_category/);assert.match(source,/launch_method/);assert.match(source,/launches/)}
  const backupVersion=Number(backup.match(/version:(\d+)/)?.[1]??0);assert.ok(backupVersion>=9);assert.match(backup,/spl_recency_evidence/);assert.match(portable,/v9Arrays/);
  assert.match(detail,/Part-SFCL logbook entry/);assert.match(detail,/launch_method/);
});
