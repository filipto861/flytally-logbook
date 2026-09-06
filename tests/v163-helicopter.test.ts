import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { aircraftProfileRegulatoryCategory,normalizeAircraftProfileContext } from "../lib/aircraft-profile-context.ts";
import { flightEntryProfile,regulatoryAircraftCategory } from "../lib/flight-entry-profile.ts";
import { parseFlightInput } from "../lib/flight-input.ts";
import { evaluateHelicopterPassengerCurrency,evaluateLaplH,type HelicopterFlight } from "../lib/helicopter-recency.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const baseForm=()=>{const form=new FormData();for(const[key,value]of Object.entries({date:"2026-09-01",registration:"OK-R44",aircraftType:"R44 Raven II",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER",departure:"LKLT",arrival:"LKLT",offBlock:"10:00",takeoff:"10:05",landing:"10:55",onBlock:"11:00",role:"PIC",evidence:"EASA",billingBasis:"BLOCK",billingShare:"1",operationType:"SP",engineType:"SE",landingsDay:"1",landingsNight:"0",takeoffsDay:"1",takeoffsNight:"0",approachesDay:"1",approachesNight:"0",movementEvidenceRecorded:"yes"}))form.set(key,value);return form};
const flight=(overrides:Partial<HelicopterFlight>={}):HelicopterFlight=>({date:"2026-08-01",helicopterType:"R44 Raven II",regulatoryCategory:"HELICOPTER",role:"PIC",minutes:60,movementEvidenceRecorded:true,takeoffsDay:1,takeoffsNight:0,approachesDay:1,approachesNight:0,landingsDay:1,landingsNight:0,purposeCode:"",instructorSigned:false,...overrides});

test("v1.63 canonical aircraft profile maps helicopter to a dedicated regulatory category",()=>{
  assert.equal(aircraftProfileRegulatoryCategory("EASA","HELICOPTER"),"HELICOPTER");
  assert.deepEqual(normalizeAircraftProfileContext("EASA","HELICOPTER","AEROPLANE").context,{evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER"});
  assert.equal(regulatoryAircraftCategory({aircraftClass:"HELICOPTER",evidence:"EASA"}),"HELICOPTER");
});

test("v1.63 helicopter flight entry keeps standard experience and Part-FCL movement evidence",()=>{
  const profile=flightEntryProfile({hasAircraft:true,aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER",evidence:"EASA"});
  assert.equal(profile.category,"helicopter");
  assert.equal(profile.showStandardExperience,true);
  assert.equal(profile.showSailplaneExperience,false);
  assert.equal(profile.showRegulatoryMovements,true);
});

test("v1.63 helicopter parser stores explicit PF movements",()=>{
  const parsed=parseFlightInput(baseForm());
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.aircraftClass,"HELICOPTER");
  assert.equal(parsed.data?.regulatoryCategory,"HELICOPTER");
  assert.equal(parsed.data?.movementEvidenceRecorded,true);
  assert.equal(parsed.data?.takeoffsDay,1);
  assert.equal(parsed.data?.approachesDay,1);
  assert.equal(parsed.data?.landingsDay,1);
});

test("v1.63 helicopter parser refuses an aeroplane regulatory context",()=>{
  const form=baseForm();form.set("regulatoryCategory","AEROPLANE");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.data,undefined);
  assert.match(parsed.error??"",/helicopter.*regulatory category/i);
});

test("FCL.140.H 12-month route is satisfied only on the same helicopter type",()=>{
  const flights:HelicopterFlight[]=[];
  for(let i=0;i<5;i++)flights.push(flight({date:`2026-08-${String(i+1).padStart(2,"0")}`}));
  flights.push(flight({date:"2026-08-06",role:"DUAL",minutes:60,purposeCode:"LAPL_H_FCL140H_REFRESHER",instructorSigned:true}));
  const current=evaluateLaplH(flights,"2026-09-01","R44 Raven II");
  assert.equal(current.status,"current");
  assert.equal(current.requirements.find(item=>item.id==="flight-time")?.current,6);
  assert.equal(current.requirements.find(item=>item.id==="movements")?.current,6);
  assert.equal(current.requirements.find(item=>item.id==="refresher")?.current,1);
  const mixed=[...flights.slice(0,3),...flights.slice(3).map(item=>({...item,helicopterType:"R22 Beta II"}))];
  assert.equal(evaluateLaplH(mixed,"2026-09-01","R44 Raven II").status,"not-current");
});

test("FCL.140.H does not credit unsigned dual or supervised-solo experience",()=>{
  const flights=[flight({role:"DUAL",minutes:360,takeoffsDay:6,approachesDay:6,landingsDay:6,purposeCode:"LAPL_H_FCL140H_REFRESHER",instructorSigned:false})];
  const result=evaluateLaplH(flights,"2026-09-01","R44 Raven II");
  assert.equal(result.status,"not-current");
  assert.equal(result.requirements.find(item=>item.id==="flight-time")?.current,0);
  assert.equal(result.requirements.find(item=>item.id==="refresher")?.current,0);
});

test("FCL.140.H proficiency check is an explicit alternative route on the specific type",()=>{
  const result=evaluateLaplH([],"2026-09-01","R44 Raven II",[{id:1,helicopterType:"R44 Raven II",date:"2026-08-20",signer:"FE(H) Test",reference:"PC-44",note:""}]);
  assert.equal(result.status,"current");
  assert.equal(result.meta?.proficiencyCheck,true);
  assert.equal(evaluateLaplH([],"2026-09-01","R22 Beta II",[{id:1,helicopterType:"R44 Raven II",date:"2026-08-20",signer:"FE(H) Test",reference:"PC-44",note:""}]).status,"not-current");
});

test("FCL.060 helicopter passenger currency requires three explicit PF movement triples on the stored type",()=>{
  const flights=[flight(),flight({date:"2026-08-02"}),flight({date:"2026-08-03"}),flight({date:"2026-08-04",helicopterType:"R22 Beta II"})];
  assert.equal(evaluateHelicopterPassengerCurrency(flights,"2026-09-01","R44 Raven II").status,"current");
  assert.equal(evaluateHelicopterPassengerCurrency(flights.slice(0,2),"2026-09-01","R44 Raven II").status,"not-current");
  assert.equal(evaluateHelicopterPassengerCurrency([flight({movementEvidenceRecorded:false,takeoffsDay:3,approachesDay:3,landingsDay:3})],"2026-09-01","R44 Raven II").status,"not-current");
});

test("FCL.060 helicopter night passenger condition requires a night movement unless IR(H) is current",()=>{
  const dayFlights=[flight({takeoffsDay:3,approachesDay:3,landingsDay:3})];
  assert.equal(evaluateHelicopterPassengerCurrency(dayFlights,"2026-09-01","R44 Raven II",true,false).status,"not-current");
  assert.equal(evaluateHelicopterPassengerCurrency(dayFlights,"2026-09-01","R44 Raven II",true,true).status,"current");
  assert.equal(evaluateHelicopterPassengerCurrency([flight({takeoffsDay:2,approachesDay:2,landingsDay:2,takeoffsNight:1,approachesNight:1,landingsNight:1})],"2026-09-01","R44 Raven II",true,false).status,"current");
});

test("v1.63 credentials and backup plumbing expose helicopter support without replacing SPL",()=>{
  const credentials=read("app/(protected)/credentials/legacy-page.tsx"),schema=read("lib/v163-schema.ts"),backup=read("lib/account-backup.ts"),portable=read("lib/portable-backup.ts"),restore=read("lib/account-restore-v6.ts"),form=read("components/flight-form.tsx");
  assert.match(credentials,/SplRecencyPanel/);assert.match(credentials,/HelicopterRecencyPanel/);assert.match(credentials,/LAPL\(H\)/);assert.match(credentials,/PPL\(H\)/);
  assert.match(schema,/CREATE TABLE IF NOT EXISTS helicopter_recency_evidence/);assert.doesNotMatch(schema,/UPDATE\s+flights/i);
  assert.match(backup,/version:11/);assert.match(backup,/helicopter_recency_evidence/);assert.match(portable,/v10Arrays/);assert.match(restore,/helicopter_recency_evidence/);
  assert.match(form,/entryProfile[.]showRegulatoryMovements/);
});

test("v1.63 keeps the first-save aircraft integrity contract shared by all profile types",()=>{
  const quick=read("components/quick-aircraft-form.tsx"),manager=read("components/aircraft-manager.tsx"),actions=read("app/(protected)/database/actions.ts");
  for(const source of[quick,manager]){assert.match(source,/AIRCRAFT_PROFILE_CLASSES/);assert.match(source,/aircraftProfileRegulatoryCategory/);assert.match(source,/HELICOPTER/)}
  assert.match(actions,/normalizeAircraftProfileContext/);assert.match(actions,/aircraft-profile-persistence-mismatch/);
});
