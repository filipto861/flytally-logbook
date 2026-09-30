import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolveGpsImportAircraftContext,validateGpsImportRole,validateGpsImportSubmittedAircraftContext } from "../lib/gps-import-integrity.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const gpsForm=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");

const importStart=actions.indexOf("export async function importKmlFlight");
const importEnd=actions.indexOf("\nexport async function",importStart+40);
const importAction=actions.slice(importStart,importEnd>importStart?importEnd:actions.length);

const easaProfile={
  aircraft_make:"BRM Aero",
  aircraft_model:"Bristell B23",
  evidence:"EASA",
  aircraft_class:"SEP",
  regulatory_category:"AEROPLANE",
  balloon_class:"",
  balloon_group:"",
};

test("F0.1 accepts valid EASA and explicit ULL aircraft contexts but rejects malformed context",()=>{
  const easa=resolveGpsImportAircraftContext(easaProfile);
  assert.equal(easa.error,undefined);
  assert.equal(easa.profile?.evidence,"EASA");
  assert.equal(easa.profile?.aircraftClass,"SEP");
  assert.equal(easa.profile?.regulatoryCategory,"AEROPLANE");

  const ull=resolveGpsImportAircraftContext({
    aircraft_make:"",
    aircraft_model:"",
    evidence:"ULL",
    aircraft_class:"ULL",
    regulatory_category:"ULL",
    balloon_class:"",
    balloon_group:"",
  });
  assert.equal(ull.error,undefined);
  assert.equal(ull.profile?.evidence,"ULL");
  assert.equal(ull.profile?.aircraftClass,"ULL");
  assert.equal(ull.profile?.regulatoryCategory,"ULL");

  const missingEvidence=resolveGpsImportAircraftContext({...easaProfile,evidence:""});
  assert.equal(missingEvidence.profile,undefined);
  assert.ok(missingEvidence.error);

  const malformedEasa=resolveGpsImportAircraftContext({...easaProfile,aircraft_make:""});
  assert.equal(malformedEasa.profile,undefined);
  assert.match(malformedEasa.error??"",/requires both manufacturer/i);
});

test("F0.1 GPS interim role contract accepts PIC only and rejects crafted roles",()=>{
  assert.deepEqual(validateGpsImportRole("PIC"),{role:"PIC"});
  for(const role of ["","DUAL","SAFETY PILOT","INSTRUCTOR","INSTRUKTOR","CO-PILOT","PAX","OBSERVER","SPIC","PICUS","ADMIN"]){
    const result=validateGpsImportRole(role);
    assert.equal(result.role,undefined,role);
    assert.match(result.error??"",/supports PIC only/i);
  }
});

test("F0.1 rejects submitted class/logbook drift from the selected canonical profile",()=>{
  const resolved=resolveGpsImportAircraftContext(easaProfile);
  assert.ok(resolved.profile);
  assert.deepEqual(validateGpsImportSubmittedAircraftContext({evidence:"EASA",aircraftClass:"SEP"},resolved.profile!),{});
  assert.match(validateGpsImportSubmittedAircraftContext({evidence:"ULL",aircraftClass:"ULL"},resolved.profile!).error??"",/must use the selected aircraft profile/i);
  assert.match(validateGpsImportSubmittedAircraftContext({evidence:"",aircraftClass:"SEP"},resolved.profile!).error??"",/must use the selected aircraft profile/i);
});

test("F0.1 removes GPS ULL fallbacks and exposes unresolved profile state instead",()=>{
  assert.doesNotMatch(gpsForm,/selectedAircraft\?\.aircraft_class\|\|"ULL"/);
  assert.doesNotMatch(gpsForm,/selectedAircraft\?\.evidence\|\|"ULL"/);
  assert.doesNotMatch(importAction,/form\.get\("evidence"\)\|\|"ULL"/);
  assert.doesNotMatch(importAction,/form\.get\("aircraftClass"\)\|\|"ULL"/);
  assert.doesNotMatch(importAction,/form\.get\("role"\)\|\|"PIC"/);
  assert.match(gpsForm,/resolveGpsImportAircraftContext/);
  assert.match(gpsForm,/profileError/);
  assert.match(gpsForm,/Needs configuration/);
  assert.match(gpsForm,/Boolean\(selectedProfile\).*parts\.length>0/);
  assert.match(gpsForm,/name="aircraftClass" value=\{selectedProfile\?\.aircraftClass\|\|""\}/);
  assert.match(gpsForm,/name="evidence" value=\{selectedProfile\?\.evidence\|\|""\}/);
});

test("F0.1 GPS UI exposes only the supported PIC role",()=>{
  assert.match(gpsForm,/name="role" defaultValue="PIC"><option>PIC<\/option><\/select>/);
  for(const unsupported of ["DUAL","INSTRUKTOR","SAFETY PILOT","CO-PILOT","PAX","OBSERVER"]){
    assert.doesNotMatch(gpsForm,new RegExp(`<option(?: value="[^"]+")?>${unsupported.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}</option>`));
  }
});

test("F0.1 server resolves active aircraft profile and does not trust submitted identity defaults",()=>{
  assert.match(importAction,/validateGpsImportRole\(form\.get\("role"\)\)/);
  assert.match(importAction,/FROM aircraft WHERE user_id=\$\{userId\} AND UPPER\(TRIM\(registration\)\)=\$\{registration\} AND active=1 LIMIT 1/);
  assert.match(importAction,/resolveGpsImportAircraftContext/);
  assert.match(importAction,/validateGpsImportSubmittedAircraftContext/);
  assert.match(importAction,/const evidence=profileResult\.profile\.evidence/);
  assert.match(importAction,/aircraftClass=profileResult\.profile\.aircraftClass/);
  assert.match(importAction,/regulatoryCategory=profileResult\.profile\.regulatoryCategory/);
  assert.match(importAction,/aircraftType=String\(selectedAircraft\.aircraft_type\|\|""\)/);
});

test("F0.1 preserves GPS duplicate locking and atomic transaction behavior",()=>{
  assert.match(importAction,/new Set\(prepared\.map\(item=>item\.fingerprint\)\)\.size!==prepared\.length/);
  assert.match(importAction,/pg_advisory_xact_lock/);
  assert.match(importAction,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(importAction,/WHERE NOT EXISTS\(SELECT 1 FROM flights/);
  assert.match(importAction,/rolled back\. No partial flights were created/);
});

test("F0.1 visual review track no longer invents ULL provenance",()=>{
  assert.doesNotMatch(gpsForm,/evidence:"ULL"/);
  assert.match(gpsForm,/evidence:""/);
});
