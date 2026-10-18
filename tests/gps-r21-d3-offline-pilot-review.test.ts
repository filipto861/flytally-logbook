import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOfflinePilotReviewDto,
  R21_D3_ALGORITHM_REVISION,
} from "../research/gps-detection-r21/pilot-review-dto.ts";

const rows=[
  "50.123456,14.654321,,2026-10-18T10:00:00Z",
  "50.223456,14.754321,0,2026-10-18T10:01:00Z",
  "50.323456,14.854321,125,2026-10-18T10:02:00Z",
];
const csv=(points=rows,header="lat,lon,altitudeM,time")=>[header,...points].join("\n");
const context=()=>({
  uploadRevision:7,splitRevision:3,
  split:{start:0,endExclusive:3},
  algorithmRevision:R21_D3_ALGORITHM_REVISION,
});
const make=(overrides:Record<string,unknown>={})=>
  buildOfflinePilotReviewDto({sourceText:csv(),context:context(),...overrides});
const assertNoAuthority=(result:ReturnType<typeof buildOfflinePilotReviewDto>)=>{
  assert.equal(result.status,"UNAVAILABLE");
  assert.equal(result.pilot.physicalContact,"UNRESOLVED");
  assert.equal(result.pilot.fullFlightLandingCount,"UNAVAILABLE");
  assert.equal(result.pilot.canAffectCanonicalFlight,false);
  assert.equal(result.pilot.altitudeCandidates,"HIDDEN");
  assert.equal(result.pilot.horizontalCandidates,"HIDDEN");
  assert.equal(result.pilot.eventTime,"UNAVAILABLE");
  assert.equal(result.notePolicy.persistence,"NONE");
  assert.equal(result.notePolicy.initial,"LEAVE_UNRESOLVED");
  assert.equal(result.notePolicy.canAddNotes,false);
};

test("D3-01 source with missing and measured-zero altitude never unlocks pilot claims",()=>{
  const result=make();
  assertNoAuthority(result);
  assert.equal(result.reason,"SOURCE_NOT_VERIFIED");
  assert.equal(result.source?.status,"PARSED_DIAGNOSTIC_ONLY");
  if(result.source?.status==="PARSED_DIAGNOSTIC_ONLY"){
    assert.equal(result.source.normalizedPoints,3);
    assert.equal(result.source.selectedPoints,3);
    assert.equal(result.source.sourceAccuracy,"UNKNOWN");
    assert.equal(result.source.altitudeMode,"UNKNOWN");
    assert.equal(result.source.verticalDatum,"UNKNOWN");
  }
  assert.equal(result.session?.notes.length,0);
});

test("D3-02a extra caller trust flags and forged source claims fail closed",()=>{
  for(const unexpected of [
    {validated:true},
    {sourceProvenanceStatus:"VALIDATED"},
    {approvedSensor:true},
    {authSubject:"forged"}
  ]){
    const result=make(unexpected);
    assertNoAuthority(result);
    assert.equal(result.reason,"INVALID_CONTEXT");
    assert.equal(result.session,null);
  }
});

test("D3-02b unknown, malformed or extra context fields are denied",()=>{
  const badContexts=[
    null,{}, {...context(),validated:true},
    {...context(),uploadRevision:-1},
    {...context(),uploadRevision:1.2},
    {...context(),splitRevision:NaN},
    {...context(),split:{start:-1,endExclusive:3}},
    {...context(),split:{start:0,endExclusive:4}},
    {...context(),split:{start:2,endExclusive:2}},
    {...context(),split:{start:2,endExclusive:3}},
    {...context(),split:{start:0,endExclusive:3,claimedTrusted:true}},
    {...context(),algorithmRevision:"R21_D3_OFFLINE_V2"},
  ];
  for(const bad of badContexts){
    const result=make({context:bad});
    assertNoAuthority(result);
    assert.equal(result.reason,"INVALID_CONTEXT");
  }
});

test("D3-03 bad, unsupported or discontinuous source returns unavailable diagnostic",()=>{
  const sources=[
    "lat,lon,altitudeM,time\n,14.1,100,2026-10-18T10:00:00Z\n50,14.2,110,2026-10-18T10:01:00Z",
    csv([rows[0],rows[0]]),
    csv([rows[0],"50,14,0,2026-02-30T10:01:00Z"]),
    csv([rows[0],"50,14,0,2026-10-18T10:01:00"]),
    csv([rows[0],"50,14,0,2026-10-18T10:01:00Z"],"latitude,longitude,alt,time"),
    {source:csv(),validated:true},
  ];
  for(const sourceText of sources){
    const result=make({sourceText,context:{...context(),split:{start:0,endExclusive:2}}});
    assertNoAuthority(result);
    assert.equal(result.reason,"SOURCE_UNAVAILABLE");
    assert.equal(result.source?.status,"UNAVAILABLE");
    assert.equal(result.session,null);
  }
});

test("D3-04a unchanged exact source, split and version preserve local equality binding",()=>{
  const first=make(),next=make({previousSession:first.session});
  assertNoAuthority(next);
  assert.equal(first.reason,"SOURCE_NOT_VERIFIED");
  assert.equal(next.reason,"SOURCE_NOT_VERIFIED");
  assert.deepEqual(next.session,first.session);
  assert.match(first.session?.binding.sourceSha256??"",/^[a-f0-9]{64}$/);
});

test("D3-04b changing exact source text invalidates earlier review even when fix count stays same",()=>{
  const first=make();
  const altered=csv([rows[0].replace("50.123456","50.123457"),rows[1],rows[2]]);
  const result=make({sourceText:altered,previousSession:first.session});
  assertNoAuthority(result);
  assert.equal(result.reason,"STALE_CONTEXT");
  assert.equal(result.session,null);
});

test("D3-04c upload, split revision and split range invalidate prior session",()=>{
  const prior=make().session;
  for(const changed of [
    {...context(),uploadRevision:8},
    {...context(),splitRevision:4},
    {...context(),split:{start:1,endExclusive:3}},
    {...context(),split:{start:0,endExclusive:2}},
  ]){
    const result=make({context:changed,previousSession:prior});
    assertNoAuthority(result);
    assert.equal(result.reason,"STALE_CONTEXT");
    assert.equal(result.session,null);
  }
});

test("D3-04d unsupported future algorithm fails closed instead of carrying notes",()=>{
  const previousSession=make().session;
  const result=make({
    context:{...context(),algorithmRevision:"R21_D3_OFFLINE_V2"},
    previousSession
  });
  assertNoAuthority(result);
  assert.equal(result.reason,"INVALID_CONTEXT");
  assert.equal(result.session,null);
});

test("D3-05a caller-created nonempty notes and modified session are rejected",()=>{
  const previousSession=make().session;
  assert.ok(previousSession);
  const bad=[
    {...previousSession,notes:[{event:"landing",choice:"REVIEWED"}]},
    {...previousSession,notes:[{event:"touch-and-go",choice:"LEAVE_UNRESOLVED"}]},
    {...previousSession,authorized:true},
    {...previousSession,binding:{...previousSession.binding,sourceSha256:"invalid"}},
    {...previousSession,binding:{...previousSession.binding,parserRevision:"forged"}},
    null,undefined,"old-notes"
  ];
  for(const prev of bad){
    const result=make({previousSession:prev});
    assertNoAuthority(result);
    assert.equal(result.reason,"INVALID_REVIEW_STATE");
    assert.equal(result.session,null);
  }
});

test("D3-05b no previous session field is distinct from explicit null",()=>{
  assert.equal(make().reason,"SOURCE_NOT_VERIFIED");
  assert.equal(make({previousSession:null}).reason,"INVALID_REVIEW_STATE");
});

test("D3-06 declared feet and metres never validate instrument mode, datum or contact",()=>{
  for(const header of ["lat,lon,altitudeM,time","lat,lon,altitudeFt,time"]){
    const result=make({sourceText:csv(rows,header)});
    assertNoAuthority(result);
    assert.equal(result.reason,"SOURCE_NOT_VERIFIED");
    assert.equal(result.source?.status,"PARSED_DIAGNOSTIC_ONLY");
    if(result.source?.status==="PARSED_DIAGNOSTIC_ONLY"){
      assert.equal(result.source.declaredUnit,header.includes("Ft")?"ft":"m");
      assert.equal(result.source.altitudeMode,"UNKNOWN");
      assert.equal(result.source.verticalDatum,"UNKNOWN");
    }
  }
});

test("D3-07 DTO never echoes raw positions, timestamps, source text or flight metadata",()=>{
  const result=make();
  const json=JSON.stringify(result);
  for(const forbidden of [
    "50.123456","14.654321","2026-10-18T10:00:00Z",
    "lat,lon,altitudeM,time","flightId","userId","registration",
    "certifiedAt","sourceLine"
  ]) assert.ok(!json.includes(forbidden),forbidden);
  assert.ok(!json.includes('"canAffectCanonicalFlight":true'));
  assert.ok(!json.includes('"status":"AVAILABLE"'));
});

test("D3-08 context prevents cross-split binding and retains no review decisions",()=>{
  const result=make({
    context:{...context(),split:{start:1,endExclusive:3}}
  });
  assertNoAuthority(result);
  assert.equal(result.source?.status,"PARSED_DIAGNOSTIC_ONLY");
  if(result.source?.status==="PARSED_DIAGNOSTIC_ONLY")
    assert.equal(result.source.selectedPoints,2);
  assert.deepEqual(result.session?.notes,[]);
});
