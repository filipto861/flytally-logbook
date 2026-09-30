import test from "node:test";
import assert from "node:assert/strict";
import { parseFlightInput } from "../lib/flight-input.ts";

function validForm(){const form=new FormData();for(const [key,value] of Object.entries({date:"2026-08-21",registration:"OK-BID",aircraftType:"Bristell B23",offBlock:"13:18",takeoff:"13:23",landing:"14:43",onBlock:"14:48",starts:"1",role:"PIC",evidence:"EASA",aircraftClass:"SEP",billingBasis:"AIR",billingShare:"2"}))form.set(key,value);return form}

test("flight input rejects impossible calendar dates",()=>{
  const form=validForm();form.set("date","2026-02-30");
  assert.equal(parseFlightInput(form).data,undefined);
});

test("flight input protects duration consistency",()=>{
  const form=validForm();form.set("offBlock","13:00");form.set("onBlock","12:59");
  assert.equal(parseFlightInput(form).data,undefined);
});

test("editing values preserve EASA SEP AIR and aircraft type exactly",()=>{
  const parsed=parseFlightInput(validForm());
  assert.equal(parsed.data?.evidence,"EASA");
  assert.equal(parsed.data?.aircraftClass,"SEP");
  assert.equal(parsed.data?.billingBasis,"AIR/2");
  assert.equal(parsed.data?.aircraftType,"Bristell B23");
});

test("parser keeps required regulatory choices fail closed while billing is optional",()=>{
  for(const field of ["evidence","aircraftClass","role"]){
    const form=validForm();form.delete(field);
    const parsed=parseFlightInput(form);
    assert.equal(parsed.data,undefined,`${field} must block save when missing`);
    assert.match(parsed.error??"",/Select a valid/);
  }
  const noBilling=validForm();noBilling.delete("billingBasis");noBilling.delete("billingShare");
  const parsed=parseFlightInput(noBilling);
  assert.equal(parsed.error,undefined);
  assert.equal(parsed.data?.billingBasis,"");
});

test("populated malformed billing still fails closed",()=>{
  const badBasis=validForm();badBasis.set("billingBasis","GROSS");
  assert.equal(parseFlightInput(badBasis).data,undefined);
  assert.match(parseFlightInput(badBasis).error??"",/billing time basis/i);
  const badShare=validForm();badShare.set("billingShare","99");
  assert.equal(parseFlightInput(badShare).data,undefined);
  assert.match(parseFlightInput(badShare).error??"",/billing share/i);
});

test("an instructor name does not override the selected pilot role",()=>{
  const form=validForm();form.set("instructor","Instructor Name");form.set("role","PICUS");form.set("verificationName","Supervising PIC");form.set("verificationReference","Signed ref 123");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.data?.role,"PICUS");
});

test("SPIC and PICUS cannot bypass the countersignature reference server-side",()=>{
  const form=validForm();form.set("role","SPIC");form.set("verificationName","Instructor");
  assert.equal(parseFlightInput(form).data,undefined);
  form.set("verificationReference","Signed ref 123");
  assert.equal(parseFlightInput(form).data?.role,"SPIC");
});
