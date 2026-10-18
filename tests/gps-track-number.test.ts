import test from "node:test";
import assert from "node:assert/strict";
import {optionalGpsNumber} from "../lib/gps-track-number.ts";

test("D2-C.1 shared CSV/saved-track decoder retains measured zero, negative altitude and decimal legacy values",()=>{
  for(const token of [0,"0"," 0 ","+0","-0"])assert.equal(optionalGpsNumber(token),0);
  assert.equal(optionalGpsNumber(-123),-123);
  assert.equal(optionalGpsNumber(" 50,25 "),50.25);
  assert.equal(optionalGpsNumber("1e2"),100);
  assert.equal(optionalGpsNumber(".5"),.5);
});

test("D2-C.1 shared CSV/saved-track decoder never converts missing or non-decimal data to zero or a plausible fix",()=>{
  for(const invalid of [null,undefined,"","   ","0x10","0b101","0o17","1_0","Infinity","NaN","1,2,3",{},[]]){
    assert.equal(optionalGpsNumber(invalid),null,String(invalid));
  }
  assert.equal(optionalGpsNumber(Number.NaN),null);
  assert.equal(optionalGpsNumber(Infinity),null);
});
