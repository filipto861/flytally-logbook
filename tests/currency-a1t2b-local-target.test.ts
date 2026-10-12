import assert from "node:assert/strict";
import test from "node:test";
import {validateDisposablePgTarget,verifyDisposablePg16Identity} from "../tooling/currency-a1t2b-local-target.ts";

const safe="postgresql://flytally@127.0.0.1:59660/flytally_currency_test";
test("only explicitly scoped disposable loopback target is accepted",()=>{
  const result=validateDisposablePgTarget(safe);
  assert.deepEqual(result,{ok:true,target:{database:"flytally_currency_test",user:"flytally",address:"127.0.0.1",port:59660}});
});
test("missing or malformed connection strings fail closed",()=>{
  for(const s of [null,undefined,"",23,"foo", "postgresql://"])assert.equal(validateDisposablePgTarget(s).ok,false,String(s));
});
test("remote host and arbitrary DNS aliases fail closed",()=>{
  for(const s of [safe.replace("127.0.0.1","localhost"),safe.replace("127.0.0.1","db.neon.tech"),safe.replace("127.0.0.1","192.168.0.5")]) assert.equal(validateDisposablePgTarget(s).ok,false,s);
});
test("wrong user/database and passwords fail closed",()=>{
  for(const s of [safe.replace("flytally@","postgres@"),safe.replace("flytally_currency_test","flytally"),safe.replace("flytally@","flytally:secret@")]) assert.equal(validateDisposablePgTarget(s).ok,false,s);
});
test("libpq query overrides, fragments and unsupported ports fail closed",()=>{
  for(const s of [safe+"?host=remote",safe+"?options=-csearch_path%3Dpublic",safe+"#foo",safe.replace(":59660/",":5432/"),safe.replace(":59660/",":1/")]) assert.equal(validateDisposablePgTarget(s).ok,false,s);
});
test("version 16 matching actual backend identity is required",()=>{
  const result=validateDisposablePgTarget(safe);assert.equal(result.ok,true);if(!result.ok)return;
  assert.equal(verifyDisposablePg16Identity({database:"flytally_currency_test",user:"flytally",address:"127.0.0.1",port:"59660",serverVersionNumber:"160010"},result.target),true);
});
test("v15/v17 and identity mismatch are rejected even on localhost",()=>{
  const result=validateDisposablePgTarget(safe);assert.equal(result.ok,true);if(!result.ok)return;
  const original={database:"flytally_currency_test",user:"flytally",address:"127.0.0.1",port:59660,serverVersionNumber:"160010"};
  for(const x of [{serverVersionNumber:"150012"},{serverVersionNumber:"170010"},{database:"postgres"},{user:"postgres"},{address:"::1"},{port:5432}]) assert.equal(verifyDisposablePg16Identity({...original,...x},result.target),false,JSON.stringify(x));
});
test("pure preflight has no database side effects",()=>{
  assert.equal(validateDisposablePgTarget(safe).ok,true);
  assert.equal(verifyDisposablePg16Identity({database:"a",user:"b",address:"c",port:1,serverVersionNumber:0},{database:"flytally_currency_test",user:"flytally",address:"127.0.0.1",port:5432}),false);
});
