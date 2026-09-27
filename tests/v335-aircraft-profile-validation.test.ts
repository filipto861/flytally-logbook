import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateAircraftProfile } from "../lib/aircraft-profile-validation.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const validEasa=(overrides:Record<string,unknown>={})=>validateAircraftProfile({
  aircraftMake:"Example",
  aircraftModel:"Model",
  evidence:"EASA",
  aircraftClass:"SEP",
  regulatoryCategory:"AEROPLANE",
  ...overrides,
});

test("M1 canonical aircraft profile validator covers every supported regulatory profile family",()=>{
  const matrix=[
    {input:{aircraftMake:"",aircraftModel:"",evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"},expected:["ULL","ULL","ULL"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE"},expected:["EASA","SEP","AEROPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"MEP",regulatoryCategory:"AEROPLANE"},expected:["EASA","MEP","AEROPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"SET",regulatoryCategory:"AEROPLANE"},expected:["EASA","SET","AEROPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:"AEROPLANE"},expected:["EASA","TMG","AEROPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"TMG",regulatoryCategory:"SAILPLANE"},expected:["EASA","TMG","SAILPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"GLIDER",regulatoryCategory:"SAILPLANE"},expected:["EASA","GLIDER","SAILPLANE"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"HELICOPTER"},expected:["EASA","HELICOPTER","HELICOPTER"]},
    {input:{aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"OTHER",regulatoryCategory:"OTHER"},expected:["EASA","OTHER","OTHER"]},
  ];
  for(const item of matrix){
    const result=validateAircraftProfile(item.input);
    assert.equal(result.error,undefined,JSON.stringify(item.input));
    assert.deepEqual(result.profile&&[result.profile.evidence,result.profile.aircraftClass,result.profile.regulatoryCategory],item.expected);
  }

  const balloon=validateAircraftProfile({aircraftMake:"Cameron",aircraftModel:"Z-105",evidence:"EASA",aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:"B"});
  assert.equal(balloon.error,undefined);
  assert.equal(balloon.profile?.balloonClass,"HOT_AIR_BALLOON");
  assert.equal(balloon.profile?.balloonGroup,"B");
});

test("M1 validator fails closed on explicit regulatory mismatches instead of repairing them",()=>{
  for(const input of [
    {aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"SAILPLANE"},
    {aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"HELICOPTER",regulatoryCategory:"AEROPLANE"},
    {aircraftMake:"A",aircraftModel:"B",evidence:"EASA",aircraftClass:"GLIDER",regulatoryCategory:"AEROPLANE"},
    {evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"AEROPLANE"},
  ])assert.match(validateAircraftProfile(input).error??"",/do not match/i);
});

test("M1 validator enforces EASA identity and BFCL applicability while clearing nothing silently",()=>{
  assert.match(validEasa({aircraftMake:""}).error??"",/requires both manufacturer/i);
  assert.match(validEasa({aircraftModel:""}).error??"",/requires both manufacturer/i);

  assert.match(validEasa({aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:""}).error??"",/balloon class/i);
  assert.match(validEasa({aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:"HOT_AIR_BALLOON",balloonGroup:""}).error??"",/group A, B, C or D/i);
  assert.match(validEasa({aircraftClass:"BALLOON",regulatoryCategory:"BALLOON",balloonClass:"GAS_BALLOON",balloonGroup:"A"}).error??"",/not applicable/i);
  assert.match(validEasa({balloonClass:"HOT_AIR_BALLOON",balloonGroup:"A"}).error??"",/only be stored/i);
});

test("M1 validator preserves explicit Part-FCL credit provenance and rejects malformed overrides",()=>{
  const valid=validateAircraftProfile({
    evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",
    partFclCreditClass:"TMG",partFclCreditBasis:"Documented mapping",partFclCreditFrom:"2026-01-15",
  });
  assert.equal(valid.error,undefined);
  assert.equal(valid.profile?.partFclCreditClass,"TMG");
  assert.equal(valid.profile?.partFclCreditBasis,"Documented mapping");
  assert.equal(valid.profile?.partFclCreditFrom,"2026-01-15");

  assert.match(validateAircraftProfile({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",partFclCreditClass:"MEP",partFclCreditBasis:"x",partFclCreditFrom:"2026-01-01"}).error??"",/valid Part-FCL credit class/i);
  assert.match(validateAircraftProfile({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",partFclCreditClass:"SEP",partFclCreditBasis:"",partFclCreditFrom:"2026-01-01"}).error??"",/basis\/reference/i);
  assert.match(validateAircraftProfile({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",partFclCreditClass:"SEP",partFclCreditBasis:"basis",partFclCreditFrom:"bad"}).error??"",/valid-from date/i);
});

test("M1 direct Add/Edit and shared import use the same canonical validator while exact restore stays separate",()=>{
  const direct=read("app/(protected)/database/actions.ts");
  const share=read("app/(protected)/connections/aircraft-share-actions.ts");
  const restore=read("lib/account-restore-v6.ts");
  const review=read("app/(protected)/connections/aircraft/[id]/page.tsx");

  assert.match(direct,/validateAircraftProfile\(\{/);
  assert.match(share,/validateAircraftProfile\(\{/);
  assert.ok(share.includes("?error=profile"));
  const validation=share.indexOf("const validated=validateAircraftProfile");
  const rejection=share.indexOf("if(!validated.profile)redirect",validation);
  const persistence=share.indexOf("const queries=[",validation);
  assert.ok(validation>=0&&rejection>validation&&persistence>rejection,"shared profile validation must fail before persistence queries are built");
  assert.match(share,/canonical[.]aircraftClass/);
  assert.match(share,/canonical[.]regulatoryCategory/);
  assert.match(review,/regulatory data FlyTally cannot import safely/);
  assert.doesNotMatch(restore,/validateAircraftProfile/);
});

test("M1 catalogue/manual identity boundary remains unchanged",()=>{
  const picker=read("components/aircraft-type-picker.tsx");
  assert.match(picker,/Can’t find the aircraft[?] Just enter it manually/);
  assert.match(picker,/Confirm the Part-FCL class separately/);
  assert.doesNotMatch(picker,/name="aircraft_class"/);
});
