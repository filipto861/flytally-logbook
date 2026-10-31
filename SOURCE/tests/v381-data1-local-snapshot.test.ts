import assert from "node:assert/strict";
import {test} from "node:test";
import {applyLocalPostgresTransactionOptions,parseLocalPostgresTransactionResults} from "../lib/local-postgres-transaction.ts";

const legacy="BEGIN;\nSELECT 1;\nCOMMIT;";

test("DATA-1 A: legacy local mutation transaction script remains byte-for-byte unchanged",()=>{
  assert.equal(applyLocalPostgresTransactionOptions(legacy),legacy);
});

test("DATA-1 A: explicit RepeatableRead+readOnly uses one PostgreSQL transaction",()=>{
  assert.equal(
    applyLocalPostgresTransactionOptions(legacy,{isolationLevel:"RepeatableRead",readOnly:true}),
    "BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY;\nSELECT 1;\nCOMMIT;",
  );
});

test("DATA-1 A: unknown, missing and extra transaction options fail closed",()=>{
  for(const invalid of [
    null,{}, {isolationLevel:"ReadCommitted",readOnly:true},
    {isolationLevel:"RepeatableRead",readOnly:false},
    {isolationLevel:"RepeatableRead"},
    {readOnly:true},
    {isolationLevel:"RepeatableRead",readOnly:true,deferrable:true},
    {isolationLevel:"Serializable",readOnly:true},
    "RepeatableRead",
  ]){
    assert.throws(()=>applyLocalPostgresTransactionOptions(legacy,invalid as never),
      /Unsupported local PostgreSQL transaction options/);
  }
});

test("DATA-1 A: unexpected script shape fails before any SQL can execute",()=>{
  assert.throws(
    ()=>applyLocalPostgresTransactionOptions("SELECT 1;",{isolationLevel:"RepeatableRead",readOnly:true}),
    /Unexpected local PostgreSQL transaction script/,
  );
});

const marker=(index:number,rows:unknown[])=>`__flytally_local_tx__${index}:${JSON.stringify(rows)}`;

test("DATA-1D: every statement produces one indexed result, even zero rows",()=>{
  const output=[marker(2,[]),marker(0,[{n:1}]),marker(1,[])].join("\n");
  assert.deepEqual(parseLocalPostgresTransactionResults(output,3),[[{n:1}],[],[]]);
});

test("DATA-1D: missing, duplicated and out-of-range markers must never become empty sections",()=>{
  for(const invalid of [
    marker(0,[]),
    [marker(0,[]),marker(0,[])].join("\n"),
    [marker(0,[]),marker(2,[])].join("\n"),
    [marker(0,[]),"__flytally_local_tx__01:[]"].join("\n"),
  ])assert.throws(()=>parseLocalPostgresTransactionResults(invalid,2),
    /incomplete|duplicate|unexpected|invalid/);
});

test("DATA-1D: malformed JSON, scalars, non-objects and unexpected output fail closed",()=>{
  for(const invalid of [
    "__flytally_local_tx__0:{\"x\":1}",
    "__flytally_local_tx__0:[null]",
    "__flytally_local_tx__0:[1]",
    "__flytally_local_tx__0:[[]]",
    "__flytally_local_tx__0:not-json",
    "unexpected result\n"+marker(0,[]),
  ])assert.throws(()=>parseLocalPostgresTransactionResults(invalid,1),
    /unexpected|malformed/);
});
