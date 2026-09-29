import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseFlightInput } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function goldenPicForm(){
  const form=new FormData();
  const values:Record<string,string>={
    date:"2026-09-29",
    registration:"OK-SP2E",
    aircraftType:"B23",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    evidence:"EASA",
    departure:"LKLT",
    arrival:"LKLT",
    offBlock:"13:18",
    takeoff:"13:23",
    landing:"14:43",
    onBlock:"14:48",
    role:"PIC",
    operationType:"SP",
    engineType:"SE",
    landingsDay:"1",
    landingsNight:"0",
    movementEvidenceRecorded:"yes",
    takeoffsDay:"1",
    takeoffsNight:"0",
    approachesDay:"1",
    approachesNight:"0",
    nightTime:"0:00",
    ifrTime:"0:30",
    commander:"Filip",
    task:"Local flight",
    billingBasis:"AIR",
    billingShare:"2",
    note:"Golden baseline",
    purposeSelectionPresent:"yes",
  };
  for(const [key,value] of Object.entries(values))form.set(key,value);
  return form;
}

test("B0.5 golden PIC payload freezes the canonical parser contract shared by create and update",()=>{
  const parsed=parseFlightInput(goldenPicForm());
  assert.equal(parsed.error,undefined);
  assert.deepEqual(parsed.data,{
    date:"2026-09-29",
    registration:"OK-SP2E",
    aircraftType:"B23",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    balloonClass:"",
    balloonGroup:"",
    balloonOperation:"",
    launchMethod:"",
    launches:0,
    evidence:"EASA",
    departure:"LKLT",
    arrival:"LKLT",
    offBlock:"13:18",
    takeoff:"13:23",
    landing:"14:43",
    onBlock:"14:48",
    starts:1,
    operationType:"SP",
    engineType:"SE",
    operatorName:"",
    flightNumber:"",
    operationContext:"",
    landingsDay:1,
    landingsNight:0,
    movementEvidenceRecorded:true,
    takeoffsDay:1,
    takeoffsNight:0,
    approachesDay:1,
    approachesNight:0,
    nightMinutes:0,
    ifrMinutes:30,
    picMinutes:90,
    copilotMinutes:0,
    dualMinutes:0,
    instructorMinutes:0,
    verificationName:"",
    verificationReference:"",
    commander:"Filip",
    instructor:"",
    role:"PIC",
    task:"Local flight",
    purposeCode:"",
    billingBasis:"AIR/2",
    note:"Golden baseline",
  });
});

test("B0.5 create and update continue through the same canonical input parser",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const createStart=actions.indexOf("export async function createFlight");
  const updateStart=actions.indexOf("export async function updateFlight");
  assert.ok(createStart>=0&&updateStart>createStart);
  const createBlock=actions.slice(createStart,actions.indexOf("export async function importKmlFlight",createStart));
  const updateBlock=actions.slice(updateStart);
  for(const [name,block] of [["create",createBlock],["update",updateBlock]] as const){
    assert.match(block,/const parsed=parseFlightInput\(form\),expenseResult=parseFlightExpenses\(form\)/,name);
    assert.match(block,/const f=parsed\.data/,name);
  }
  assert.equal(actions.match(/parseFlightInput\(form\)/g)?.length,2);
});

test("B0.5 selected-aircraft defaults no longer contain a fail-open ULL repair",()=>{
  const form=read("components/flight-form.tsx");
  for(const forbidden of [
    'normalizeChoice(selected.evidence,EVIDENCE,"ULL")',
    'normalizeChoice(selected.aircraft_class,CLASSES,"ULL")',
    'normalizeChoice(a.evidence,EVIDENCE,"ULL")',
    'normalizeChoice(a.aircraft_class,CLASSES,"ULL")',
  ])assert.ok(!form.includes(forbidden),forbidden);
  assert.match(form,/resolveFlightEntryAircraftProfileDefaults\(selected\)/);
  assert.match(form,/resolveFlightEntryAircraftProfileDefaults\(a\)/);
  assert.match(form,/profileDefaultsApply=shouldApplyAircraftProfileDefaults\(editing,initialRegistration,registration\),profileNeedsConfiguration=Boolean\(selected&&profileDefaultsApply&&!selectedProfile\?\.profile\)/);
  assert.match(form,/restoreInitialAircraftSnapshot/);
  assert.match(form,/if\(editing&&normalized===initialRegistration\)\{restoreInitialAircraftSnapshot\(\);return\}/);
  assert.match(form,/Needs configuration/);
});

test("B0.5 keeps the approved Role, landing and PF preset policy explicit for the redesign",()=>{
  const defaults=read("lib/data/flights.ts"),form=read("components/flight-form.tsx");
  const start=defaults.indexOf("export async function getManualEntryDefaults");
  const end=defaults.indexOf("export async function getFlightNavigation",start);
  const defaultBlock=defaults.slice(start,end);
  assert.match(defaultBlock,/role:String\(cfg\.default_role\|\|"PIC"\)\.toUpperCase\(\)/);
  assert.match(defaultBlock,/starts:1/);
  assert.match(form,/initialLandingsDay=Number\(field\("landings_day",field\("starts","1"\)\)\)\|\|0/);
  assert.match(form,/\["PIC","SOLO"\]\.includes\(rl\)/);
  assert.match(form,/movementRecorded.*autoMovement/);
});

test("B0.5 duplicate landing field submission stays deterministic when values are identical",()=>{
  const form=goldenPicForm();
  form.delete("landingsDay");
  form.append("landingsDay","1");
  form.append("landingsDay","1");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.landingsDay,1);
  assert.equal(parsed.data?.starts,1);
});
