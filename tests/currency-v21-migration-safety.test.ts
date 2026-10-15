import assert from "node:assert/strict";
import test from "node:test";
import {
  allowDisposableLocalV21Migration,
  assertCurrencyV21SchemaEvidence,
} from "../lib/currency-v21-migration-safety.ts";

const fixture=()=>({
  FLYTALLY_LOCAL_POSTGRES:"1",
  FLYTALLY_AUTH_BROWSER:"1",
  FLYTALLY_CURRENCY_V21_BROWSER:"1",
  DATABASE_URL:"postgresql://flytally@127.0.0.1:61601/flytally_currency_test",
});

test("v21 automatic DDL can run only for the dedicated, explicitly opted-in disposable browser fixture",()=>{
  assert.equal(allowDisposableLocalV21Migration(fixture()),true);
  assert.equal(allowDisposableLocalV21Migration({...fixture(),NODE_ENV:"production"}),true,
    "Local acceptance serves a production Next build against an isolated PG fixture");
  assert.equal(allowDisposableLocalV21Migration({...fixture(),DATABASE_URL:
    "postgres://flytally@127.0.0.1:61601/flytally_currency_test"}),true);
});

test("v21 gate denies every missing or incorrect purpose/routing flag",()=>{
  for(const key of ["FLYTALLY_LOCAL_POSTGRES","FLYTALLY_AUTH_BROWSER","FLYTALLY_CURRENCY_V21_BROWSER"] as const){
    for(const value of [undefined,"","0","true"]){
      const env:{[name:string]:string|undefined}={...fixture(),[key]:value};
      assert.equal(allowDisposableLocalV21Migration(env),false,key+"="+String(value));
    }
  }
  assert.equal(allowDisposableLocalV21Migration({...fixture(),DATABASE_URL:undefined}),false);
});

test("v21 gate denies Vercel, including empty but present Vercel marker",()=>{
  for(const key of ["VERCEL","VERCEL_ENV"]){
    for(const value of ["","0","1","production","preview"]){
      assert.equal(allowDisposableLocalV21Migration({...fixture(),[key]:value}),false,key+"="+value);
    }
  }
});

test("v21 gate denies remote/tunneled or wrong database identity",()=>{
  const badUrls=[
    "postgresql://flytally@127.0.0.1.evil.example:61601/flytally_currency_test",
    "postgresql://flytally@localhost:61601/flytally_currency_test",
    "postgresql://flytally@::1:61601/flytally_currency_test",
    "postgresql://flytally@ep-prod.neon.tech:61601/flytally_currency_test",
    "postgresql://flytally@127.0.0.1/flytally_currency_test",
    "postgresql://flytally@127.0.0.1:5432/flytally_currency_test",
    "postgresql://flytally@127.0.0.1:55432/flytally_currency_test",
    "postgresql://flytally@127.0.0.1:61601/neondb",
    "postgresql://flytally@127.0.0.1:61601/other",
    "postgresql://neondb_owner@127.0.0.1:61601/flytally_currency_test",
    "postgresql://flytally:secret@127.0.0.1:61601/flytally_currency_test",
    "https://flytally@127.0.0.1:61601/flytally_currency_test",
    "not a url",
  ];
  for(const DATABASE_URL of badUrls){
    assert.equal(allowDisposableLocalV21Migration({...fixture(),DATABASE_URL}),false,DATABASE_URL);
  }
});

test("v21 physical schema evidence rejects incorrect registry name or any incomplete shape",()=>{
  const valid={columns_count:12,checks_count:4};
  assert.doesNotThrow(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",valid));
  assert.doesNotThrow(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",
    {columns_count:"12",checks_count:"4"}));
  const invalid=[
    {columns_count:11,checks_count:4},
    {columns_count:12,checks_count:3},
    {columns_count:13,checks_count:4},
    {columns_count:12,checks_count:5},
    {columns_count:12,checks_count:NaN},
    {columns_count:12,checks_count:undefined},
    {columns_count:undefined,checks_count:4},
  ];
  for(const evidence of invalid){
    assert.throws(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",
      evidence as {columns_count:number;checks_count:number}),/physical shape invalid/);
  }
  assert.throws(()=>assertCurrencyV21SchemaEvidence("wrong registry name",valid),/physical shape invalid/);
  assert.throws(()=>assertCurrencyV21SchemaEvidence("source-backed currency exact-money",undefined),
    /physical shape invalid/);
});
