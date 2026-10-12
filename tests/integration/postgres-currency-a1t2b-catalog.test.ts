import assert from "node:assert/strict";
import {randomUUID, createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {inspectCurrencySchema} from "../../lib/currency-schema-capability.ts";
import {validateDisposablePgTarget,verifyDisposablePg16Identity} from "../../tooling/currency-a1t2b-local-target.ts";

/**
 * A1-T2b: disposable PostgreSQL16 catalog smoke ONLY.
 * No application runtime, signed backup, trash mutation or production-equivalence claim.
 * Never uses a remote database. Only disposable DB + dedicated random schema.
 */
const fixture=new URL("../fixtures/currency-v21-a1t2b-from-322.sql",import.meta.url);
// Windows Git checkout may convert committed LF to CRLF; canonicalize ONLY line endings.
// The Git blob hash still guards every SQL byte after canonical normalization.
const sqlCandidate=readFileSync(fixture,"utf8").replace(/\r\n/g,"\n");
const candidateBlobSha="74b482b265cf3085a99ccbf2837614f382b04ed5";
function gitBlobSha(content:string):string {
  const bytes=Buffer.from(content,"utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

test("Git SQL fingerprint is invariant to Windows CRLF checkout, but rejects content changes",()=>{
  assert.equal(gitBlobSha(sqlCandidate),candidateBlobSha);
  const simulatedWindowsCheckout=sqlCandidate.replace(/\n/g,"\r\n");
  assert.equal(gitBlobSha(simulatedWindowsCheckout.replace(/\r\n/g,"\n")),candidateBlobSha);
  assert.notEqual(gitBlobSha(sqlCandidate.replace("ALTER TABLE flights","ALTER TABLE flightz")),candidateBlobSha);
});

test("fixture is EXACT unregistered SQL candidate from draft #322",()=>{
  assert.equal(gitBlobSha(sqlCandidate),candidateBlobSha,"SQL source drift; do not execute a changed candidate");
  assert.match(sqlCandidate,/REVIEW CANDIDATE ONLY/);
  assert.match(sqlCandidate,/ALTER TABLE flights/);
  assert.match(sqlCandidate,/ALTER TABLE flight_expenses/);
  assert.doesNotMatch(sqlCandidate,/\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|CREATE\s+TRIGGER)\b/i);
});

const flagPg=process.env.FLYTALLY_POSTGRES_INTEGRATION==="1";
const flagDisposable=process.env.FLYTALLY_A1T2B_DISPOSABLE==="1";
const requested=flagPg||flagDisposable;

function execPsql(connection:string,statement:string,searchPath?:string) {
  const cleanEnv: NodeJS.ProcessEnv = {...process.env,PGCONNECT_TIMEOUT:"5"};
  // A PostgreSQL environment variable such as PGHOSTADDR can override URI host.
  for (const key of Object.keys(cleanEnv)) if(key.startsWith("PG") && key!=="PGCONNECT_TIMEOUT") delete cleanEnv[key];
  return spawnSync("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-d",connection],{
    input:searchPath?`SET search_path TO "${searchPath}";\n${statement}`:statement,
    encoding:"utf8",env:cleanEnv,maxBuffer:8*1024*1024,timeout:20000,
  });
}
function pg(connection:string,statement:string,searchPath?:string):string {
  const result=execPsql(connection,statement,searchPath);
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error("Disposable PG16 SQL step failed: "+String(result.stderr||result.stdout).slice(0,500));
  return String(result.stdout||"").trim();
}

test("disposable PG16: v20 -> pinned v21 (twice) -> partial and type-invalid fail closed",{skip:!requested},async()=>{
  if(!flagPg||!flagDisposable)throw new Error("Both FLYTALLY_POSTGRES_INTEGRATION=1 and FLYTALLY_A1T2B_DISPOSABLE=1 are required");
  const connection=process.env.DATABASE_URL;
  const validated=validateDisposablePgTarget(connection);
  assert.equal(validated.ok,true,"Refusing unverified/non-disposable database target");
  if(!validated.ok||!connection)return;

  // No DDL before exact database/user/server version/IPv4/port verification.
  const actual=JSON.parse(pg(connection,`SELECT json_build_object(
    'database',current_database(),'user',current_user,
    'address',host(inet_server_addr()),'port',inet_server_port(),
    'serverVersionNumber',current_setting('server_version_num'))::text`));
  assert.equal(verifyDisposablePg16Identity(actual,validated.target),true,"Wrong PG instance or version; no DDL executed");
  assert.equal(gitBlobSha(sqlCandidate),candidateBlobSha,"Unexpected candidate change");

  const schema="a1t2b_"+randomUUID().replaceAll("-","");
  let created=false;
  try {
    pg(connection,`CREATE SCHEMA "${schema}";`);
    created=true;
    pg(connection,`
      CREATE TABLE rates(id BIGSERIAL PRIMARY KEY, price_per_hour DOUBLE PRECISION, dry_price_per_hour DOUBLE PRECISION);
      CREATE TABLE aircraft(id BIGSERIAL PRIMARY KEY, default_price_per_hour DOUBLE PRECISION);
      CREATE TABLE flights(id BIGSERIAL PRIMARY KEY, price_per_hour DOUBLE PRECISION);
      CREATE TABLE flight_expenses(id BIGSERIAL PRIMARY KEY, flight_id BIGINT, currency TEXT NOT NULL,
        amount_minor BIGINT NOT NULL CHECK (amount_minor>0 AND amount_minor<=1000000000));
    `,schema);
    const read=async(strings:TemplateStringsArray)=>{
      const query=strings.join("").trim().replace(/;$/,"");
      const json=pg(connection,`SELECT COALESCE(json_agg(row_to_json(q)),'[]'::json)::text FROM (${query}) AS q`,schema);
      return JSON.parse(json) as Array<Record<string,unknown>>;
    };
    const before=await inspectCurrencySchema(read);
    assert.equal(before.status,"v20");
    assert.equal(before.missing.length,12);

    pg(connection,sqlCandidate,schema);
    pg(connection,sqlCandidate,schema); // candidate idempotency, isolated fixture
    const after=await inspectCurrencySchema(read);
    assert.deepEqual(after,{status:"v21_shape",missing:[],incompatible:[]});
    assert.equal(pg(connection,`SELECT count(*) FROM pg_constraint WHERE connamespace=current_schema()::regnamespace
      AND conname IN ('rates_exact_currency_tuple_v21_check','aircraft_exact_currency_tuple_v21_check',
        'flights_exact_currency_tuple_v21_check','expenses_amount_encoding_v21_check')`,schema),"4");

    pg(connection,"ALTER TABLE flights DROP COLUMN price_currency_minor_units CASCADE",schema);
    const incomplete=await inspectCurrencySchema(read);
    assert.equal(incomplete.status,"partial_v21");
    assert.deepEqual(incomplete.missing,["flights.price_currency_minor_units"]);

    pg(connection,"ALTER TABLE flight_expenses ALTER COLUMN amount_minor_units TYPE INTEGER",schema);
    const incompatible=await inspectCurrencySchema(read);
    assert.equal(incompatible.status,"partial_v21");
    assert.equal(incompatible.incompatible.length,1);
    assert.match(incompatible.incompatible[0],/flight_expenses\.amount_minor_units/);
  } finally {
    if(created)pg(connection,`DROP SCHEMA "${schema}" CASCADE;`);
  }
});
