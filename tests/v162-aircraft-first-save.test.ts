import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { aircraftProfileRegulatoryCategory,normalizeAircraftProfileContext } from "../lib/aircraft-profile-context.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v1.62 aircraft first-save normalization covers every supported profile class",()=>{
  const matrix=[
    {evidence:"ULL",aircraftClass:"ULL",category:"",expected:{evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"}},
    {evidence:"EASA",aircraftClass:"SEP",category:"",expected:{evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE"}},
    {evidence:"EASA",aircraftClass:"MEP",category:"",expected:{evidence:"EASA",aircraftClass:"MEP",regulatoryCategory:"AEROPLANE"}},
    {evidence:"EASA",aircraftClass:"SET",category:"",expected:{evidence:"EASA",aircraftClass:"SET",regulatoryCategory:"AEROPLANE"}},
    {evidence:"EASA",aircraftClass:"GLIDER",category:"",expected:{evidence:"EASA",aircraftClass:"GLIDER",regulatoryCategory:"SAILPLANE"}},
    {evidence:"EASA",aircraftClass:"HELICOPTER",category:"",expected:{evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER"}},
    {evidence:"EASA",aircraftClass:"TMG",category:"AEROPLANE",expected:{evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:"AEROPLANE"}},
    {evidence:"EASA",aircraftClass:"TMG",category:"SAILPLANE",expected:{evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:"SAILPLANE"}},
    {evidence:"EASA",aircraftClass:"OTHER",category:"OTHER",expected:{evidence:"EASA",aircraftClass:"OTHER",regulatoryCategory:"OTHER"}},
  ];
  for(const item of matrix){
    const result=normalizeAircraftProfileContext(item.evidence,item.aircraftClass,item.category);
    assert.equal(result.error,undefined,`${item.evidence}/${item.aircraftClass}/${item.category}`);
    assert.deepEqual(result.context,item.expected,`${item.evidence}/${item.aircraftClass}/${item.category}`);
  }
});

test("v1.62 TMG defaults safely to Part-FCL but preserves explicit SPL context",()=>{
  assert.equal(aircraftProfileRegulatoryCategory("EASA","TMG",""),"AEROPLANE");
  assert.equal(aircraftProfileRegulatoryCategory("EASA","TMG","SAILPLANE"),"SAILPLANE");
  assert.equal(aircraftProfileRegulatoryCategory("EASA","GLIDER","AEROPLANE"),"SAILPLANE");
  assert.equal(aircraftProfileRegulatoryCategory("ULL","GLIDER","SAILPLANE"),"ULL");
});

test("Quick Add and Aircraft Manager submit the same regulatory profile fields on first save",()=>{
  const quick=read("components/quick-aircraft-form.tsx"),manager=read("components/aircraft-manager.tsx");
  for(const source of [quick,manager]){
    assert.match(source,/aircraftProfileRegulatoryCategory/);
    assert.match(source,/name="evidence"/);
    assert.match(source,/name="aircraft_class"/);
    assert.match(source,/name="regulatory_category"/);
    assert.match(source,/aircraftClass==="TMG"/);
    assert.match(source,/aircraftClass==="GLIDER"/);
    assert.match(source,/Sailplane · SPL \/ Part-SFCL/);
  }
  assert.match(quick,/Regulatory context<select name="regulatory_category"/);
});

test("server canonicalizes and verifies the persisted first-save profile",()=>{
  const actions=read("app/(protected)/database/actions.ts");
  assert.match(actions,/normalizeAircraftProfileContext\([^)]*requestedCategory\)/);
  assert.match(actions,/INSERT INTO aircraft[\s\S]*aircraft_class,regulatory_category,evidence/);
  assert.match(actions,/ON CONFLICT\(user_id,registration\) DO UPDATE SET[\s\S]*aircraft_class=EXCLUDED[.]aircraft_class[\s\S]*regulatory_category=EXCLUDED[.]regulatory_category[\s\S]*evidence=EXCLUDED[.]evidence/);
  assert.match(actions,/SELECT COALESCE\(evidence,''\) evidence,COALESCE\(aircraft_class,''\) aircraft_class,COALESCE\(regulatory_category,''\) regulatory_category FROM aircraft/);
  assert.match(actions,/aircraft-profile-persistence-mismatch/);
});

test("first-save normalization rejects invalid combinations rather than silently falling back to ULL",()=>{
  assert.match(normalizeAircraftProfileContext("EASA","ULL","").error??"",/aircraft class or category/i);
  assert.match(normalizeAircraftProfileContext("","SEP","").error??"",/normal logbook/i);
  assert.equal(normalizeAircraftProfileContext("EASA","GLIDER","SAILPLANE").context?.evidence,"EASA");
});
