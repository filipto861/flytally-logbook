import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateAircraftProfile,validateStoredAircraftProfile } from "../lib/aircraft-profile-validation.ts";
import { allowedFlightContexts } from "../lib/flight-aircraft-context-authority.ts";
import { isAnnexCreditForClass,resolveAnnexCredit,type RecencyFlight } from "../lib/recency-engine.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

const ullFlight=(overrides:Partial<RecencyFlight>={}):RecencyFlight=>({
  date:"2026-09-10",
  evidence:"ULL",
  aircraftClass:"ULL",
  role:"PIC",
  minutes:60,
  landingsDay:1,
  landingsNight:0,
  ...overrides,
});

test("3.5 Phase 2 limits aeroplane recency current-profile authority to explicit Part-FCL credit provenance",()=>{
  for(const file of ["lib/recency-service.ts","lib/recency-audit-service.ts"]){
    const source=read(file);
    assert.match(source,/LEFT JOIN aircraft a ON a[.]user_id=f[.]user_id AND UPPER\(TRIM\(a[.]registration\)\)=UPPER\(TRIM\(f[.]registration\)\)/);
    for(const field of ["part_fcl_credit_class","part_fcl_credit_basis","part_fcl_credit_from"]){
      assert.match(source,new RegExp(`a[.]${field}`),`${file} must read only the explicit credit tuple from the current aircraft row`);
    }
    for(const forbidden of ["evidence","aircraft_class","regulatory_category","aircraft_type","aircraft_make","aircraft_model","aircraft_variant"]){
      assert.doesNotMatch(source,new RegExp(`a[.]${forbidden}\\b`),`${file} must not reinterpret historical flight ${forbidden} from today's aircraft profile`);
    }
  }
});

test("3.5 Phase 2 category recency and professional credit remain flight-snapshot based",()=>{
  const helicopter=read("lib/helicopter-recency-service.ts");
  assert.match(helicopter,/COALESCE\(NULLIF\(TRIM\(f[.]aircraft_model\),''\),NULLIF\(TRIM\(f[.]aircraft_type\),''\),''\) helicopter_type/);
  assert.match(helicopter,/SELECT registration,aircraft_type,aircraft_model FROM aircraft/);
  assert.doesNotMatch(helicopter,/COALESCE\(NULLIF\(TRIM\(a[.]aircraft_model\)/);

  for(const file of ["lib/spl-recency-service.ts","lib/balloon-recency-service.ts","lib/professional-experience-service.ts"]){
    const source=read(file);
    assert.match(source,/FROM flights f|FROM flights WHERE/);
    assert.doesNotMatch(source,/JOIN aircraft\b|LEFT JOIN aircraft\b/);
  }

  for(const file of ["lib/data/dashboard.ts","lib/data/pilot-insights.ts"]){
    const source=read(file);
    assert.match(source,/f[.]regulatory_category/);
    assert.match(source,/f[.]aircraft_class/);
    assert.doesNotMatch(source,/JOIN aircraft\b|LEFT JOIN aircraft\b/);
  }
});

test("3.5 Phase 2 Manual and GPS share PROFILE authority while same-registration edits preserve SNAPSHOT authority",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  const createStart=actions.indexOf("export async function createFlight");
  const gpsStart=actions.indexOf("export async function importKmlFlight",createStart);
  const updateStart=actions.indexOf("export async function updateFlight",gpsStart);
  assert.ok(createStart>=0&&gpsStart>createStart&&updateStart>gpsStart);

  const manual=actions.slice(createStart,gpsStart);
  const gps=actions.slice(gpsStart,updateStart);
  const update=actions.slice(updateStart);

  assert.match(manual,/aircraftAuthorityProfile\(userId,f[.]registration,false\)/);
  assert.match(manual,/authorizeProfileFlightContext\(profile,flightAircraftContextFromForm\(form\)\)/);
  for(const field of ["evidence","aircraftType","aircraftClass","regulatoryCategory","balloonClass","balloonGroup"]){
    assert.match(manual,new RegExp(`authorityContext[.]${field}`));
  }

  assert.match(gps,/aircraftAuthorityProfile\(userId,registration,true\)/);
  assert.match(gps,/authorizeProfileFlightContext\(selectedAircraft,flightAircraftContextFromForm\(form\)\)/);
  for(const field of ["evidence","aircraftType","aircraftClass","regulatoryCategory","balloonClass","balloonGroup"]){
    assert.match(gps,new RegExp(`authorityContext[.]${field}`));
  }

  assert.match(update,/resolveFlightAircraftContextAuthority/);
  assert.match(update,/authorityKind[.]authority==="PROFILE"/);
  assert.match(update,/authorizeUnchangedSnapshotFlightContext/);

  const migration=read("lib/db-optimization.ts");
  assert.match(migration,/IF TG_OP='INSERT' THEN/);
  assert.match(migration,/ELSIF NEW[.]registration IS DISTINCT FROM OLD[.]registration THEN/);
});

test("3.5 Phase 2 characterizes the legacy explicit-credit compatibility boundary before changing it",()=>{
  const ordinary=ullFlight();
  assert.equal(isAnnexCreditForClass(ordinary,"SEP"),true);
  assert.equal(isAnnexCreditForClass(ordinary,"TMG"),false);

  const historicalClassOnly=ullFlight({partFclCreditClass:"TMG"});
  assert.equal(isAnnexCreditForClass(historicalClassOnly,"TMG"),true);
  assert.equal(isAnnexCreditForClass(historicalClassOnly,"SEP"),false);

  const invalidCurrentProfile=validateAircraftProfile({
    aircraftMake:"",
    aircraftModel:"",
    evidence:"ULL",
    aircraftClass:"ULL",
    regulatoryCategory:"ULL",
    partFclCreditClass:"TMG",
    partFclCreditBasis:"",
    partFclCreditFrom:"",
  });
  assert.match(invalidCurrentProfile.error??"",/basis\/reference/i);

  const future=ullFlight({partFclCreditClass:"TMG",partFclCreditBasis:"legacy reference",partFclCreditFrom:"2026-10-01"});
  assert.equal(isAnnexCreditForClass(future,"TMG"),false);
});


test("3.5 Phase 2 preserves v1.51.3 stored override shapes without weakening strict new writes",()=>{
  const legacyShapes=[
    {partFclCreditClass:"TMG"},
    {partFclCreditClass:"TMG",partFclCreditBasis:"legacy note"},
    {partFclCreditClass:"TMG",partFclCreditFrom:"2026-01-15"},
    {partFclCreditClass:"TMG",partFclCreditBasis:"legacy note",partFclCreditFrom:"2026-01-15"},
  ];
  for(const shape of legacyShapes){
    const input={evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",...shape};
    assert.equal(validateStoredAircraftProfile(input).error,undefined,JSON.stringify(shape));
  }
  assert.match(validateAircraftProfile({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",partFclCreditClass:"TMG"}).error??"",/basis\/reference/i);
  assert.match(validateStoredAircraftProfile({evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL",partFclCreditClass:"TMG",partFclCreditFrom:"2026-01-15junk"}).error??"",/valid-from date/i);
});

test("3.5 Phase 2 existing legacy credit metadata cannot block Manual/GPS aircraft context authority",()=>{
  const resolved=allowedFlightContexts({
    aircraft_type:"ULL",
    aircraft_make:"",
    aircraft_model:"",
    evidence:"ULL",
    aircraft_class:"ULL",
    regulatory_category:"ULL",
    part_fcl_credit_class:"TMG",
    part_fcl_credit_basis:"",
    part_fcl_credit_from:"",
  });
  assert.equal(resolved.error,undefined);
  assert.equal(resolved.profile?.partFclCreditClass,"TMG");
  assert.equal(resolved.contexts?.[0]?.regulatoryCategory,"ULL");

  const source=read("app/(protected)/database/actions.ts");
  assert.match(source,/existingCredit\?validateStoredAircraftProfile\(profileInput\):validateAircraftProfile\(profileInput\)/);
  assert.match(source,/COALESCE\(part_fcl_credit_class,''\) part_fcl_credit_class/);
});

test("3.5 Phase 2 canonical Annex-I resolver preserves legacy semantics and fails closed on malformed effectivity",()=>{
  const classOnly=ullFlight({partFclCreditClass:"TMG"});
  assert.deepEqual(resolveAnnexCredit(classOnly),{kind:"explicit",creditClass:"TMG",effectiveFrom:"",provenance:"legacy-compatible"});
  assert.equal(isAnnexCreditForClass(classOnly,"TMG"),true);

  const basisOnly=ullFlight({partFclCreditClass:"TMG",partFclCreditBasis:"legacy note"});
  assert.equal(resolveAnnexCredit(basisOnly).kind,"explicit");
  assert.equal(isAnnexCreditForClass(basisOnly,"TMG"),true);

  const effectiveOnlyBefore=ullFlight({date:"2026-01-14",partFclCreditClass:"TMG",partFclCreditFrom:"2026-01-15"});
  const effectiveOnlyOn=ullFlight({date:"2026-01-15",partFclCreditClass:"TMG",partFclCreditFrom:"2026-01-15"});
  assert.equal(isAnnexCreditForClass(effectiveOnlyBefore,"TMG"),false);
  assert.equal(isAnnexCreditForClass(effectiveOnlyOn,"TMG"),true);

  const malformed=ullFlight({partFclCreditClass:"TMG",partFclCreditFrom:"2026-01-15junk"});
  assert.deepEqual(resolveAnnexCredit(malformed),{kind:"invalid",reason:"effective-date"});
  assert.equal(isAnnexCreditForClass(malformed,"TMG"),false);
  assert.equal(isAnnexCreditForClass(malformed,"SEP"),false);
});

test("3.5 Phase 2 recency audit and calculation stay on the same Annex-I eligibility resolver",()=>{
  const audit=read("lib/recency-audit.ts");
  assert.match(audit,/import \{ isAnnexCreditForClass/);
  assert.match(audit,/isAnnexCreditForClass\(/);
  const engineSource=read("lib/recency-engine.ts");
  assert.match(engineSource,/const annexCredit=isAnnexCreditForClass/);
});
