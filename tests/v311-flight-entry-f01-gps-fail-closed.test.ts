import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseGpsImportRole,resolveGpsImportAircraftContext } from "../lib/gps-import-contract.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const form=read("components/kml-import-form.tsx");
const actions=read("app/(protected)/flights/actions.ts");

const importStart=actions.indexOf("export async function importKmlFlight");
const importEnd=actions.indexOf("\nexport async function",importStart+40);
const importAction=actions.slice(importStart,importEnd>importStart?importEnd:actions.length);

test("F0.1 GPS aircraft context preserves valid EASA and ULL profiles",()=>{
  const easa=resolveGpsImportAircraftContext({
    aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",
    evidence:"EASA",aircraft_class:"SEP",regulatory_category:"AEROPLANE"
  });
  assert.deepEqual(easa.profile&&{
    evidence:easa.profile.evidence,
    aircraftClass:easa.profile.aircraftClass,
    regulatoryCategory:easa.profile.regulatoryCategory
  },{evidence:"EASA",aircraftClass:"SEP",regulatoryCategory:"AEROPLANE"});

  const ull=resolveGpsImportAircraftContext({
    evidence:"ULL",aircraft_class:"ULL",regulatory_category:"ULL"
  });
  assert.deepEqual(ull.profile&&{
    evidence:ull.profile.evidence,
    aircraftClass:ull.profile.aircraftClass,
    regulatoryCategory:ull.profile.regulatoryCategory
  },{evidence:"ULL",aircraftClass:"ULL",regulatoryCategory:"ULL"});
});

test("F0.1 GPS aircraft context fails closed for missing or malformed profiles",()=>{
  for(const input of [
    {aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",evidence:"",aircraft_class:"SEP",regulatory_category:"AEROPLANE"},
    {aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",evidence:"EASA",aircraft_class:"",regulatory_category:"AEROPLANE"},
    {aircraft_make:"BRM Aero",aircraft_model:"Bristell B23",evidence:"EASA",aircraft_class:"ULL",regulatory_category:"AEROPLANE"},
    {aircraft_make:"",aircraft_model:"",evidence:"EASA",aircraft_class:"SEP",regulatory_category:"AEROPLANE"}
  ]){
    const result=resolveGpsImportAircraftContext(input);
    assert.equal(result.profile,undefined);
    assert.ok(result.error);
  }
});

test("F0.1 GPS interim role contract accepts PIC only",()=>{
  assert.deepEqual(parseGpsImportRole("PIC"),{role:"PIC"});
  for(const role of ["","DUAL","SAFETY PILOT","INSTRUKTOR","INSTRUCTOR","CO-PILOT","PAX","OBSERVER","SPIC","PICUS","ROOT"]){
    const result=parseGpsImportRole(role);
    assert.equal(result.role,undefined,role);
    assert.match(result.error??"",/supports PIC only/);
  }
});

test("F0.1 GPS UI no longer renders ULL fallback or unsupported role choices",()=>{
  assert.match(form,/resolveGpsImportAircraftContext\(selectedAircraft\)/);
  assert.match(form,/profileNeedsConfiguration/);
  assert.match(form,/Boolean\(selectedProfile\).*billing!==/);
  assert.doesNotMatch(form,/selectedAircraft\?\.aircraft_class\|\|"ULL"/);
  assert.doesNotMatch(form,/selectedAircraft\?\.evidence\|\|"ULL"/);
  assert.match(form,/name="aircraftClass" value=\{selectedProfile\?\.aircraftClass\|\|""\}/);
  assert.match(form,/name="evidence" value=\{selectedProfile\?\.evidence\|\|""\}/);
  assert.match(form,/name="role" value="PIC"/);
  assert.doesNotMatch(form,/<option>DUAL<\/option>|value="INSTRUKTOR"|<option>SAFETY PILOT<\/option>|<option>CO-PILOT<\/option>/);
  assert.match(form,/Needs configuration · fix this aircraft profile before GPS import\./);
});

test("F0.1 GPS server derives profile context from the owned active aircraft row",()=>{
  assert.match(importAction,/parseGpsImportRole\(form\.get\("role"\)\)/);
  assert.doesNotMatch(importAction,/form\.get\("role"\)\|\|"PIC"/);
  assert.doesNotMatch(importAction,/form\.get\("evidence"\)\|\|"ULL"/);
  assert.doesNotMatch(importAction,/form\.get\("aircraftClass"\)\|\|"ULL"/);
  assert.match(importAction,/FROM aircraft WHERE user_id=\$\{userId\} AND UPPER\(TRIM\(registration\)\)=\$\{registration\} AND active=1 LIMIT 1/);
  assert.match(importAction,/if\(!contextRows\[0\]\)return\{error:"Selected aircraft profile is unavailable\./);
  assert.match(importAction,/resolveGpsImportAircraftContext\(contextRows\[0\]\)/);
  assert.match(importAction,/if\(!profileResult\.profile\)return\{error:"Selected aircraft profile needs configuration before GPS import\."/);
  assert.match(importAction,/const\{evidence,aircraftClass,regulatoryCategory,balloonClass,balloonGroup\}=profileResult\.profile/);
});

test("F0.1 preserves GPS duplicate protection and atomic persistence",()=>{
  assert.match(importAction,/new Set\(prepared\.map\(item=>item\.fingerprint\)\)\.size!==prepared\.length/);
  assert.match(importAction,/pg_advisory_xact_lock/);
  assert.match(importAction,/sql\.transaction\(\[\.\.\.locks,\.\.\.inserts\]\)/);
  assert.match(importAction,/No partial flights were created\./);
});
