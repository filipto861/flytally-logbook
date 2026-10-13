import assert from "node:assert/strict";
import test from "node:test";
import {calculateBilledMoney,formatMoneyAmount,parseMoneyAmount,sumMoneyAmounts} from "../lib/monetary-amount.ts";

const jpy={code:"JPY",minorUnits:0},eur={code:"EUR",minorUnits:2},kwd={code:"KWD",minorUnits:3};

test("ISO per-currency precision: 0, 2 and 3 decimals are exact",()=>{
  assert.deepEqual(parseMoneyAmount("15000",jpy),{ok:true,money:{currency:"JPY",minorUnits:0,minor:15000n}});
  assert.deepEqual(parseMoneyAmount("1,23",eur),{ok:true,money:{currency:"EUR",minorUnits:2,minor:123n}});
  assert.deepEqual(parseMoneyAmount("25.125",kwd),{ok:true,money:{currency:"KWD",minorUnits:3,minor:25125n}});
  assert.deepEqual(parseMoneyAmount("1.234",eur),{ok:false,reason:"too-many-decimals"});
  assert.deepEqual(parseMoneyAmount("1.1",jpy),{ok:false,reason:"too-many-decimals"});
});

test("exact amount parser is fail closed and never accepts arbitrary numeric coercions",()=>{
  for(const input of [undefined,null,1.5,"", "-2", "+2", "1e4", "1 000", "1,000.00", ".5", "01", "Infinity", "NaN"]){
    assert.equal(parseMoneyAmount(input,eur).ok,false,String(input));
  }
  assert.deepEqual(parseMoneyAmount("1.00",{code:"XXX",minorUnits:100}),{ok:false,reason:"invalid-currency-metadata"});
  assert.equal(parseMoneyAmount("999999999999999.12",eur).ok,true,"bigint preserves values above safe integer range");
  assert.equal(parseMoneyAmount("0",eur).ok,true,"zero is distinct from missing");
});

test("exact block/share billing quantizes at ISO minor-unit boundary once",()=>{
  assert.deepEqual(calculateBilledMoney("1234.56",90,2,eur),{ok:true,money:{currency:"EUR",minorUnits:2,minor:92592n}});
  assert.deepEqual(calculateBilledMoney("1001",30,1,jpy),{ok:true,money:{currency:"JPY",minorUnits:0,minor:501n}});
  assert.deepEqual(calculateBilledMoney("1.001",60,1,kwd),{ok:true,money:{currency:"KWD",minorUnits:3,minor:1001n}});
  assert.deepEqual(calculateBilledMoney("1.001",30,1,kwd),{ok:true,money:{currency:"KWD",minorUnits:3,minor:501n}});
  assert.deepEqual(calculateBilledMoney("0",60,1,eur),{ok:true,money:{currency:"EUR",minorUnits:2,minor:0n}});
  assert.deepEqual(calculateBilledMoney("5",-1,1,eur),{ok:false,reason:"invalid-duration"});
  assert.deepEqual(calculateBilledMoney("5",30,0,eur),{ok:false,reason:"invalid-share"});
  assert.deepEqual(calculateBilledMoney("5",30,21,eur),{ok:false,reason:"invalid-share"});
  assert.deepEqual(calculateBilledMoney("5.1234567890123",30,1,eur),{ok:false,reason:"invalid-rate"});
});

test("money formatting and sums never implicitly FX convert or coerce precision",()=>{
  const amount=(code:string,minorUnits:number,minor:bigint)=>({currency:code,minorUnits,minor});
  assert.equal(formatMoneyAmount(amount("JPY",0,15000n)),"15,000 JPY");
  assert.equal(formatMoneyAmount(amount("KWD",3,25125n)),"25.125 KWD");
  assert.equal(formatMoneyAmount(amount("EUR",2,92592n)),"925.92 EUR");
  assert.equal(formatMoneyAmount(amount("EUR",2,99999999999999912n)),"999,999,999,999,999.12 EUR");
  assert.equal(formatMoneyAmount(amount("EUR",2,-1n)),null);
  assert.deepEqual(sumMoneyAmounts([amount("EUR",2,120n),amount("EUR",2,30n)]),{ok:true,money:amount("EUR",2,150n)});
  assert.deepEqual(sumMoneyAmounts([amount("EUR",2,120n),amount("JPY",0,30n)]),{ok:false,reason:"different-currency"});
  assert.deepEqual(sumMoneyAmounts([amount("EUR",2,120n),amount("EUR",3,30n)]),{ok:false,reason:"different-precision"});
  assert.deepEqual(sumMoneyAmounts([]),{ok:false,reason:"empty-input"});
});
