import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAircraftProfileContext } from "../lib/aircraft-profile-context.ts";
import { evaluateBplAdditionalClass,evaluateBplBaseClass,findBplAnchorClass,type BalloonFlight } from "../lib/balloon-recency.ts";
import { parseFlightInput } from "../lib/flight-input.ts";

const flight=(overrides:Partial<BalloonFlight>={}):BalloonFlight=>({date:"2026-08-01",regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:"B",role:"PIC",airMinutes:60,takeoffs:1,landings:1,purposeCode:"",instructorSigned:false,...overrides});
const balloonForm=()=>{const form=new FormData();for(const [key,value] of Object.entries({date:"2026-09-01",registration:"OK-BAL",aircraftType:"Test balloon",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:"B",evidence:"EASA",departure:"SITE-A",arrival:"SITE-B",offBlock:"09:50",takeoff:"10:00",landing:"11:00",onBlock:"11:10",role:"PIC",billingBasis:"AIR",billingShare:"1",operationType:"SP",engineType:"SE",landingsDay:"1",landingsNight:"0",takeoffsDay:"1",takeoffsNight:"0"}))form.set(key,value);return form};

test("v1.64 canonical aircraft profile maps BALLOON to Part-BFCL",()=>{
  assert.deepEqual(normalizeAircraftProfileContext("EASA","BALLOON","BALLOON").context,{evidence:"EASA",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON"});
});

test("v1.64 balloon parser snapshots explicit class/group and credits AIR time",()=>{
  const parsed=parseFlightInput(balloonForm());
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.balloonClass,"HOT_AIR_BALLOON");
  assert.equal(parsed.data?.balloonGroup,"B");
  assert.equal(parsed.data?.takeoffsDay,1);
  assert.equal(parsed.data?.landingsDay,1);
  assert.equal(parsed.data?.movementEvidenceRecorded,false);
  assert.equal(parsed.data?.picMinutes,60);
});

test("v1.64 hot-air balloon flight refuses missing group",()=>{
  const form=balloonForm();form.set("balloonGroup","");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.data,undefined);
  assert.match(parsed.error??"",/group A, B, C or D/i);
});

test("BFCL.160 base route requires 6 h 10 movements and signed training within its windows",()=>{
  const flights=[...Array.from({length:10},(_,index)=>flight({date:`2026-08-${String(index+1).padStart(2,"0")}`,airMinutes:36})),flight({date:"2026-07-01",role:"DUAL",airMinutes:10,takeoffs:0,landings:0,purposeCode:"BPL_BFCL160_TRAINING",instructorSigned:true})];
  const result=evaluateBplBaseClass(flights,"2026-09-01","HOT_AIR_BALLOON");
  assert.equal(result.status,"current");
  assert.equal(result.requirements.find(item=>item.id==="flight-time")?.current,6.17);
  assert.equal(result.requirements.find(item=>item.id==="movements")?.current,10);
});

test("BFCL.160 does not accept an unsigned training flight",()=>{
  const flights=[...Array.from({length:10},(_,index)=>flight({date:`2026-08-${String(index+1).padStart(2,"0")}`,airMinutes:36})),flight({date:"2026-07-01",role:"DUAL",airMinutes:10,takeoffs:0,landings:0,purposeCode:"BPL_BFCL160_TRAINING",instructorSigned:false})];
  assert.equal(evaluateBplBaseClass(flights,"2026-09-01","HOT_AIR_BALLOON").status,"not-current");
});

test("BFCL.160 additional class needs 3 h and does not borrow hours from another class",()=>{
  const flights=[flight({balloonClass:"GAS_BALLOON",balloonGroup:"",airMinutes:120}),flight({date:"2026-08-02",balloonClass:"GAS_BALLOON",balloonGroup:"",airMinutes:60}),flight({date:"2026-08-03",airMinutes:600})];
  assert.equal(evaluateBplAdditionalClass(flights,"2026-09-01","GAS_BALLOON").status,"current");
  assert.equal(evaluateBplAdditionalClass(flights,"2026-09-01","HOT_AIR_AIRSHIP").status,"not-current");
});

test("multi-class BPL selects a valid anchor and requires every additional held class",()=>{
  const hot=[...Array.from({length:10},(_,index)=>flight({date:`2026-08-${String(index+1).padStart(2,"0")}`,airMinutes:36})),flight({date:"2026-07-01",role:"DUAL",airMinutes:10,takeoffs:0,landings:0,purposeCode:"BPL_BFCL160_TRAINING",instructorSigned:true})],gas=[flight({date:"2026-08-20",balloonClass:"GAS_BALLOON",balloonGroup:"",airMinutes:180})];
  const state=findBplAnchorClass([...hot,...gas],"2026-09-01",["HOT_AIR_BALLOON","GAS_BALLOON"]);
  assert.equal(state.current,true);
  assert.equal(state.anchorClass,"HOT_AIR_BALLOON");
});
