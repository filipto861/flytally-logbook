import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { after,before,test } from "node:test";

const enabled=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const databaseUrl=process.env.DATABASE_URL??"";
const schemaName=`ft_optional_billing_${randomUUID().replaceAll("-","")}`;
const quoted=`"${schemaName}"`;

function raw(statement:string){
  return spawnSync("psql",["-d",databaseUrl,"-X","-v","ON_ERROR_STOP=1","-qAt","-c",statement],{encoding:"utf8",env:{...process.env,PGCONNECT_TIMEOUT:"5"}});
}
function run(statement:string){
  const result=raw(`SET search_path TO ${quoted};\n${statement}`);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
  return String(result.stdout??"").trim();
}

before(()=>{
  if(!enabled)return;
  assert.ok(databaseUrl);
  const setup=raw(`CREATE SCHEMA ${quoted};SET search_path TO ${quoted};
    CREATE TABLE aircraft(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      billing_basis TEXT NOT NULL DEFAULT 'BLOCK',
      UNIQUE(user_id,registration)
    );
    CREATE TABLE flights(
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      registration TEXT NOT NULL,
      billing_basis TEXT NOT NULL DEFAULT 'BLOCK',
      price_per_hour NUMERIC NULL
    );`);
  if(setup.status!==0)throw new Error(setup.stderr||setup.stdout);
});

after(()=>{if(enabled)raw(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`)});

test("B1A explicit empty billing survives PostgreSQL even with a legacy BLOCK default",{skip:!enabled},()=>{
  run("INSERT INTO aircraft(user_id,registration,billing_basis) VALUES(1,'OK-NOCOST','')");
  run("INSERT INTO flights(user_id,registration,billing_basis,price_per_hour) VALUES(1,'OK-NOCOST','',NULL)");
  assert.equal(run("SELECT CASE WHEN billing_basis='' THEN '<empty>' ELSE billing_basis END FROM aircraft WHERE registration='OK-NOCOST'"),"<empty>");
  assert.equal(run("SELECT (CASE WHEN billing_basis='' THEN '<empty>' ELSE billing_basis END)||'|'||COALESCE(price_per_hour::text,'NULL') FROM flights WHERE registration='OK-NOCOST'"),"<empty>|NULL");
});

test("B1A legacy inserts that omit billing still retain their historical BLOCK default",{skip:!enabled},()=>{
  run("INSERT INTO aircraft(user_id,registration) VALUES(1,'OK-LEGACY')");
  run("INSERT INTO flights(user_id,registration) VALUES(1,'OK-LEGACY')");
  assert.equal(run("SELECT billing_basis FROM aircraft WHERE registration='OK-LEGACY'"),"BLOCK");
  assert.equal(run("SELECT billing_basis FROM flights WHERE registration='OK-LEGACY'"),"BLOCK");
});
