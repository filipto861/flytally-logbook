import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { calculatedFlightPrice,parseOptionalBilling,serializeOptionalBilling } from "../lib/billing.ts";
import { parseFlightInput } from "../lib/flight-input.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

function validFlightForm(){
  const form=new FormData();
  for(const [key,value] of Object.entries({
    date:"2026-09-30",
    registration:"OK-SP2E",
    aircraftType:"B23",
    aircraftClass:"SEP",
    regulatoryCategory:"AEROPLANE",
    evidence:"EASA",
    role:"PIC",
    operationType:"SP",
    engineType:"SE",
    landingsDay:"1",
    landingsNight:"0",
  }))form.set(key,value);
  return form;
}

test("B1A empty billing is a first-class not-tracked state",()=>{
  assert.deepEqual(parseOptionalBilling(""),{value:"",settings:null});
  assert.deepEqual(serializeOptionalBilling("",1),{value:"",settings:null});
  assert.equal(calculatedFlightPrice(2400,90,60,""),0);
  const parsed=parseFlightInput(validFlightForm());
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.billingBasis,"");
});

test("B1A populated billing remains canonical and malformed values fail closed",()=>{
  assert.deepEqual(serializeOptionalBilling("BLOCK",2),{value:"BLOCK/2",settings:{basis:"BLOCK",share:2}});
  assert.deepEqual(parseOptionalBilling("air/4"),{value:"AIR/4",settings:{basis:"AIR",share:4}});
  assert.match(serializeOptionalBilling("gross",1).error??"",/billing time basis/i);
  assert.match(serializeOptionalBilling("AIR",21).error??"",/billing share/i);
  const malformed=validFlightForm();malformed.set("billingBasis","GROSS");
  assert.equal(parseFlightInput(malformed).data,undefined);
});

test("B1A New Flight no longer treats billing as a draft-save blocker",()=>{
  const form=read("components/flight-form.tsx");
  assert.doesNotMatch(form,/!billing&&"billing"/);
  assert.doesNotMatch(form,/if\(registration&&!billing\)setCostOpen\(true\)/);
  assert.match(form,/<option value="">Not tracked<\/option>/);
  assert.match(form,/billing==="INVALID"\?"Needs configuration"/);
  assert.match(form,/Stored billing is invalid/);
  assert.match(form,/Aircraft cost not tracked/);
  assert.doesNotMatch(form,/Billing time <span className="field-hint"[^>]*>Required/);
  assert.doesNotMatch(form,/name="billingBasis"[^>]*required/);
});

test("B1A aircraft defaults preserve absence instead of synthesizing BLOCK",()=>{
  const options=read("lib/data/aircraft.ts"),actions=read("app/(protected)/database/actions.ts"),manager=read("components/aircraft-manager.tsx"),quick=read("components/quick-aircraft-form.tsx");
  assert.match(options,/COALESCE\(billing_basis, ''\) AS billing_basis/);
  assert.doesNotMatch(options,/COALESCE\(billing_basis, 'BLOCK'\)/);
  assert.match(actions,/serializeOptionalBilling\(s\(form,"billing_basis"\),s\(form,"billing_share"\)\)/);
  assert.match(actions,/const billing=billingResult[.]value/);
  assert.match(manager,/parseOptionalBilling\(aircraft\?\.billing_basis\)/);
  assert.match(manager,/billingResult\.error\?"INVALID"/);
  assert.match(manager,/<option value="">Not tracked<\/option>/);
  assert.match(quick,/name="billing_basis" defaultValue=""><option value="">Not tracked<\/option>/);
});

test("B1A aircraft sharing carries explicit no-billing state without repair",()=>{
  const parser=read("lib/aircraft-sharing.ts"),actions=read("app/(protected)/connections/aircraft-share-actions.ts");
  assert.match(parser,/parseOptionalBilling\(defaults[.]billingBasis\)/);
  assert.doesNotMatch(parser,/billingBasis:text\(defaults[.]billingBasis\)\|\|"BLOCK"/);
  assert.match(actions,/billingBasis:text\(aircraft[.]billing_basis\)/);
  assert.doesNotMatch(actions,/billingBasis:text\(aircraft[.]billing_basis\)\|\|"BLOCK"/);
  assert.match(actions,/billing_basis=\$\{snapshot[.]defaults[.]billingBasis\}/);
  assert.doesNotMatch(actions,/snapshot[.]defaults[.]billingBasis\|\|"BLOCK"/);
  assert.match(actions,/importDefaults&&snapshot[.]defaults\?\.billingError/);
  assert.match(parser,/billingError/);
});

test("B1A flight persistence snapshots a rate only when normalized billing is tracked",()=>{
  const actions=read("app/(protected)/flights/actions.ts");
  assert.match(actions,/price=f[.]billingBasis\?await resolvedPrice\(userId,f[.]registration,f[.]date\):null/);
  assert.match(actions,/const price=!f[.]billingBasis\?null:shouldResolveStoredPrice/);
  assert.match(actions,/if\(flight\.billingBasis\)\{price=priceCache[.]get\(flight\.date\)\?\?null/);
  assert.match(actions,/billingBasis:form\.get\("billingBasis"\)/);
  assert.match(actions,/billingShare:form\.get\("billingShare"\)/);
});


test("B1A GPS import uses the shared normalizer optional billing semantics",()=>{
  const form=read("components/kml-import-form.tsx"),actions=read("app/(protected)/flights/actions.ts"),flightInput=read("lib/flight-input.ts");
  assert.match(form,/parseOptionalBilling\(selectedAircraft\?\.billing_basis\)/);
  assert.match(form,/<option value="">Not tracked<\/option>/);
  assert.match(form,/billing!=="INVALID"/);
  assert.match(form,/Stored aircraft billing is invalid/);
  assert.doesNotMatch(form,/defaultValue=\{selectedBilling[.]basis\}/);
  assert.match(actions,/billingBasis:form\.get\("billingBasis"\)/);
  assert.match(actions,/billingShare:form\.get\("billingShare"\)/);
  assert.match(actions,/normalizeFlightDraft\(candidate\)/);
  assert.match(flightInput,/serializeOptionalBilling\(candidate\.billingBasis,candidate\.billingShare\)/);
});

test("B1A legacy restore distinguishes a missing historical field from explicit untracked billing",()=>{
  const restore=read("app/(protected)/export/actions.ts");
  assert.match(restore,/Object[.]prototype[.]hasOwnProperty[.]call\(row,"billing_basis"\)\?text\(row,"billing_basis",40\):"BLOCK"/);
  assert.equal((restore.match(/\$\{legacyBilling\(row\)\}/g)||[]).length,2);
  assert.doesNotMatch(restore,/text\(row,"billing_basis",40\)\|\|"BLOCK"/);
});

test("B1A aggregate cost models treat untracked billing as zero rather than BLOCK",()=>{
  const dashboard=read("lib/data/dashboard.ts"),flights=read("lib/data/flights.ts"),fast=read("lib/data/flights-fast.ts"),health=read("lib/data/database.ts");
  assert.doesNotMatch(dashboard,/COALESCE\(f[.]billing_basis,'BLOCK'\)/);
  assert.match(dashboard,/WHEN billing_basis LIKE 'BLOCK%' THEN block_minutes ELSE 0 END/);
  for(const source of [flights,fast]){
    assert.doesNotMatch(source,/COALESCE\(billing_basis,'BLOCK'\)/);
    assert.match(source,/WHEN UPPER\(COALESCE\(billing_basis,''\)\) LIKE 'BLOCK%' THEN block_minutes ELSE 0 END/);
  }
  assert.match(health,/NULLIF\(TRIM\(COALESCE\(billing_basis,''\)\),''\) IS NOT NULL AND \(price_per_hour IS NULL OR price_per_hour<=0\)/);
});
