import assert from "node:assert/strict";
import test from "node:test";
import { activePassengerClasses,passengerRecencyOverview } from "../lib/dashboard-passenger-overview.ts";
import { buildCredentialOverview } from "../lib/dashboard-credential-overview.ts";
import type { RecencyFlight } from "../lib/recency-engine.ts";

const today="2026-10-25";
const movement=(date:string,cl="SEP",count=3):RecencyFlight=>({
  date,evidence:"EASA",aircraftClass:cl,role:"PIC",minutes:25,
  landingsDay:count,landingsNight:0,movementEvidenceRecorded:true,
  takeoffsDay:count,takeoffsNight:0,approachesDay:count,approachesNight:0,
});
const qualifying=[{id:1,qualificationType:"SEP",licenceType:"LAPL(A)",validityMode:"recency",validUntil:"",recencyUntil:""}];
const overview=(flights:RecencyFlight[])=>passengerRecencyOverview({flights,classes:["SEP"],qualifications:[],asOf:today});

test("LAPL SEP missing fixed expiry is Recency-based, not falsely expired or orange",()=>{
  const v=buildCredentialOverview({licences:[],qualifications:qualifying,documents:[],asOf:today}).ratings;
  assert.deepEqual(v,{count:1,status:"Recency-based",tone:"muted",reviewCount:0});
  const dated=buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"2026-12-01"}],documents:[],asOf:today}).ratings;
  assert.deepEqual(dated,{count:1,status:"No date alerts",tone:"neutral",reviewCount:0});
});

test("saved rating recency date still alarms when it has actually passed",()=>{
  const v=buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"2026-10-20"}],documents:[],asOf:today}).ratings;
  assert.equal(v.status,"Date passed");
  assert.equal(v.reviewCount,1);
  assert.equal(buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"n/a"}],documents:[],asOf:today}).ratings.status,"Needs review");
});

test("passenger day recency uses certified movement requirements and forecasts next loss of coverage",()=>{
  const [day]=overview([movement("2026-10-20")]);
  assert.equal(day.label,"SEP · Day");
  assert.equal(day.status,"Recorded OK");
  assert.equal(day.tone,"neutral");
  assert.equal(day.until,"2027-01-17");
  assert.match(day.detail,/certified recorded PF movements/);
});

test("passenger recency due soon uses engine forecast and does not invent an extension",()=>{
  const [day]=overview([movement("2026-08-10")]);
  assert.equal(day.status,"Due soon");
  assert.equal(day.tone,"warning");
  assert.equal(day.until,"2026-11-07");
});

test("missing movement evidence cannot generate a positive passenger indicator",()=>{
  const [limited]=overview([{...movement("2026-10-20"),movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0}]);
  assert.equal(limited.status,"Limited evidence");
  assert.equal(limited.until,null);
  const [none]=overview([]);
  assert.equal(none.status,"No flight evidence");
  assert.equal(none.tone,"muted");
  assert.equal(none.until,null);
  const [insufficient]=overview([movement("2026-10-20","SEP",1)]);
  assert.equal(insufficient.status,"Not met in logbook");
});

test("LAPL(A) maps to SEP, while confirmed unrelated qualification cannot masquerade as SEP",()=>{
  assert.deepEqual(activePassengerClasses([{licenceType:"LAPL(A)"}],[]),["SEP"]);
  assert.deepEqual(activePassengerClasses([],[{qualification_type:"SEP(Land)",classification_source:"USER_CONFIRMED",qualification_family:"OTHER",regulatory_category:"OTHER",privilege_role:"PILOT",qualification_scope:"SEP"}]),[]);
  assert.deepEqual(activePassengerClasses([],[{qualification_type:"TMG",classification_source:""}]),["TMG"]);
});

test("passenger night is separately visible only when recorded operational night privilege exists",()=>{
  const qual=[{qualification_type:"NIGHT",classification_source:"",validity_mode:"unlimited"}];
  const rows=passengerRecencyOverview({flights:[movement("2026-10-20")],classes:["SEP"],qualifications:qual,asOf:today});
  assert.equal(rows.length,2);
  assert.equal(rows[0].label,"SEP · Day");
  assert.equal(rows[1].label,"SEP · Night");
  assert.notEqual(rows[1].status,"Recorded OK");
});
