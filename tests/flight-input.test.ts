import test from "node:test";
import assert from "node:assert/strict";
import { parseFlightInput } from "../lib/flight-input.ts";

function validForm(){const form=new FormData();for(const [key,value] of Object.entries({date:"2026-08-21",registration:"OK-BID",offBlock:"13:18",takeoff:"13:23",landing:"14:43",onBlock:"14:48",starts:"1",role:"PIC",evidence:"EASA",aircraftClass:"SEP",billingBasis:"BLOCK",billingShare:"2"}))form.set(key,value);return form}

test("flight input rejects impossible calendar dates",()=>{
  const form=validForm();form.set("date","2026-02-30");
  assert.equal(parseFlightInput(form).data,undefined);
});

test("flight input protects duration consistency",()=>{
  const form=validForm();form.set("offBlock","13:00");form.set("onBlock","12:59");
  assert.equal(parseFlightInput(form).data,undefined);
});

test("an instructor automatically records the flight as DUAL",()=>{
  const form=validForm();form.set("instructor","Instruktor");
  const parsed=parseFlightInput(form);
  assert.equal(parsed.data?.role,"DUAL");
  assert.equal(parsed.data?.billingBasis,"BLOCK/2");
});
