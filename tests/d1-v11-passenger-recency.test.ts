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

test("LAPL SEP dates cannot masquerade as the FCL.140.A engine result",()=>{
  const v=buildCredentialOverview({licences:[],qualifications:qualifying,documents:[],asOf:today}).ratings;
  assert.deepEqual(v,{count:1,status:"UNVERIFIED",tone:"muted",reviewCount:1});
  const dated=buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"2026-12-01"}],documents:[],asOf:today}).ratings;
  assert.deepEqual(dated,{count:1,status:"UNVERIFIED",tone:"muted",reviewCount:1});
});

test("LAPL saved recency dates do not override actual FCL.140.A evidence",()=>{
  const v=buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"2026-10-20"}],documents:[],asOf:today}).ratings;
  assert.equal(v.status,"UNVERIFIED");
  assert.equal(v.reviewCount,1);
  assert.equal(buildCredentialOverview({licences:[],qualifications:[{...qualifying[0],recencyUntil:"n/a"}],documents:[],asOf:today}).ratings.status,"UNVERIFIED");
});

test("passenger day recency uses certified movement requirements and forecasts next loss of coverage",()=>{
  const [day]=overview([movement("2026-10-20")]);
  assert.equal(day.label,"SEP · Day");
  assert.equal(day.status,"CURRENT");
  assert.equal(day.tone,"neutral");
  assert.equal(day.until,"2027-01-17");
  assert.match(day.detail,/certified recorded PF movements/);
});

test("passenger recency due soon uses engine forecast and does not invent an extension",()=>{
  const [day]=overview([movement("2026-08-10")]);
  assert.equal(day.status,"CURRENT");
  assert.equal(day.dueSoon,true);
  assert.equal(day.tone,"warning");
  assert.equal(day.until,"2026-11-07");
});

test("missing movement evidence cannot generate a positive passenger indicator",()=>{
  const [limited]=overview([{...movement("2026-10-20"),movementEvidenceRecorded:false,takeoffsDay:0,approachesDay:0}]);
  assert.equal(limited.status,"UNVERIFIED");
  assert.equal(limited.until,null);
  const [none]=overview([]);
  assert.equal(none.status,"UNVERIFIED");
  assert.equal(none.tone,"muted");
  assert.equal(none.until,null);
  const [insufficient]=overview([movement("2026-10-20","SEP",1)]);
  assert.equal(insufficient.status,"NOT CURRENT");
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
  assert.notEqual(rows[1].status,"CURRENT");
});

test("malformed or ambiguous IR/Night validity cannot enable passenger night indication",()=>{
  const invalid=[
    {qualification_type:"IR(A)",validity_mode:"date",valid_until:"not-a-date"},
    {qualification_type:"IR(A)",validity_mode:"date",valid_until:"2027-02-31"},
    {qualification_type:"NIGHT",validity_mode:"recency",recency_until:"0000-01-01"},
    {qualification_type:"NIGHT",validity_mode:"legacy",valid_until:"2027-01-01"},
    {qualification_type:"IR(A)",validity_mode:"recency",recency_until:""},
    {qualification_type:"IR(A)",validity_mode:"date",valid_until:"2026-10-24"},
  ];
  for(const qualification of invalid){
    const rows=passengerRecencyOverview({
      flights:[movement("2026-10-20")],classes:["SEP"],qualifications:[qualification],asOf:today,
    });
    assert.deepEqual(rows.map(row=>row.label),["SEP · Day"],JSON.stringify(qualification));
  }
  const validIr=passengerRecencyOverview({
    flights:[movement("2026-10-20")],classes:["SEP"],
    qualifications:[{qualification_type:"IR(A)",validity_mode:"date",valid_until:"2027-02-28"}],asOf:today,
  });
  assert.equal(validIr.length,2);
  assert.equal(validIr[1].label,"SEP · Night");
  assert.equal(validIr[1].status,"CURRENT");

  const validNight=passengerRecencyOverview({
    flights:[movement("2026-10-20")],classes:["SEP"],
    qualifications:[{qualification_type:"NIGHT",validity_mode:"unlimited"}],asOf:today,
  });
  assert.equal(validNight.length,2);
  assert.notEqual(validNight[1].status,"CURRENT");
});

test("no flight evidence stays UNVERIFIED even when saved credentials have a future date",()=>{
  const [day]=overview([]);
  assert.equal(day.status,"UNVERIFIED");
  assert.equal(day.dueSoon,false);
  assert.equal(day.until,null);
});

