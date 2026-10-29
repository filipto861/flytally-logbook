import assert from "node:assert/strict";
import {test} from "node:test";
import {applyLocalPostgresTransactionOptions} from "../lib/local-postgres-transaction.ts";

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
