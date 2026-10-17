import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
import {
  validatePg16Versions,ambientConnectionOverrides,validateNativeRunPaths,
  validateMinimalHba,validateStartupLog,parseControlSystemIdentifier,
  validateServerAttestation,validateOwnedPostmaster,validateRunOwnershipForCleanup,
  ATTEST_SQL, type CheckedPath
} from "../research/gps-r21-p0-d3-synthetic-security/native-pg16-guards.mjs";

const root=String.raw`C:\Users\syntheticowner\AppData\Local\FlyTallySyntheticPG16`;
const profile=String.raw`C:\Users\syntheticowner`;
const run=String.raw`C:\Users\syntheticowner\AppData\Local\FlyTallySyntheticPG16\flytally-r21-123e4567-e89b-42d3-a456-426614174000`;
const pgdata=run+"\\pgdata";
const port=55444;
const systemId="7378234355145561083";
const nonce="synthetic".repeat(8);
const versions={
  initdb:"initdb (PostgreSQL) 16.15",
  pg_ctl:"pg_ctl (PostgreSQL) 16.15",
  psql:"psql (PostgreSQL) 16.15",
  postgres:"postgres (PostgreSQL) 16.15",
  pg_controldata:"pg_controldata (PostgreSQL) 16.15"
};
const goodPaths:CheckedPath[]=[
 profile,profile+"\\AppData",profile+"\\AppData\\Local",root,run,pgdata
].map(path=>({path,isReparsePoint:false,aclTrusted:true,trustedOwner:true,exists:true}));
const paths=()=>({root,runDir:run,pgdata,ownerProfile:profile,entries:structuredClone(goodPaths)});

test("native I1: PostgreSQL executable versions must match exact 16.15",()=>{
  assert.equal(validatePg16Versions(versions),true);
  assert.equal(validatePg16Versions({...versions,postgres:"postgres (PostgreSQL) 18.1"}),false);
  assert.equal(validatePg16Versions({...versions,pg_controldata:""}),false);
  assert.equal(validatePg16Versions({initdb:"initdb (PostgreSQL) 16.15"}),false);
});

test("native I1: hidden ambient connection settings fail without printing values",()=>{
  assert.deepEqual(ambientConnectionOverrides({PATH:"safe"}),[]);
  const keys=ambientConnectionOverrides({PGPORT:"12345",DATABASE_URL:"secret",DIRECT_URL:"",DOCKER_HOST:"tcp://remote"});
  assert.deepEqual(keys,["PGPORT","DATABASE_URL","DOCKER_HOST"]);
});

test("native I1: owner-only UUID PGDATA path passes; ancestor junction/ACL fails",()=>{
  assert.equal(validateNativeRunPaths(paths()),true);
  const junction=paths();junction.entries[1]!.isReparsePoint=true;
  assert.equal(validateNativeRunPaths(junction),false);
  const acl=paths();acl.entries[2]!.aclTrusted=false;
  assert.equal(validateNativeRunPaths(acl),false);
  const untrusted=paths();untrusted.entries[0]!.trustedOwner=false;
  assert.equal(validateNativeRunPaths(untrusted),false);
  const absent=paths();absent.entries.pop();
  assert.equal(validateNativeRunPaths(absent),false);
});

test("native I1: path crossing into another run or existing service PGDATA refused",()=>{
  assert.equal(validateNativeRunPaths({...paths(),pgdata:String.raw`C:\Program Files\PostgreSQL\16\data`}),false);
  assert.equal(validateNativeRunPaths({...paths(),runDir:root+"\\flytally-r21-fixed"}),false);
  assert.equal(validateNativeRunPaths({...paths(),pgdata:run+"\\..\\foreign"}),false);
  assert.equal(validateNativeRunPaths({...paths(),ownerProfile:String.raw`C:\Users\another`}),false);
});

test("native I1: HBA must be exclusively bootstrap SCRAM on IPv4 loopback",()=>{
  const valid="# only synthetic\nhost all postgres 127.0.0.1/32 scram-sha-256\n";
  assert.equal(validateMinimalHba(valid),true);
  for(const wrong of [
    "host all all 127.0.0.1/32 scram-sha-256",
    "host all postgres 0.0.0.0/0 scram-sha-256",
    "host all postgres 127.0.0.1/32 trust",
    "host all postgres 127.0.0.1/32 md5",
    "local all all trust",
    "include_dir 'hba.d'",
    valid+"host all all ::1/128 trust"
  ])assert.equal(validateMinimalHba(wrong),false,wrong);
});

test("native I1: startup log requires exact IPv4 loopback bind and port",()=>{
  const ok='2026-10-17 LOG: listening on IPv4 address "127.0.0.1", port 55444\n';
  assert.equal(validateStartupLog(ok,port),true);
  assert.equal(validateStartupLog(ok.replace("127.0.0.1","0.0.0.0"),port),false);
  assert.equal(validateStartupLog(ok.replace("55444","5432"),port),false);
  assert.equal(validateStartupLog(ok+"FATAL: could not bind IPv4 socket\n",port),false);
  assert.equal(validateStartupLog(ok,5432),false);
});

test("native I1: system ID extracted as decimal string without JS precision loss",()=>{
  assert.equal(parseControlSystemIdentifier("Database system identifier: 7378234355145561083\n"),systemId);
  assert.equal(parseControlSystemIdentifier("Database system identifier: not-a-number\n"),null);
});

const verified={
  data_directory:pgdata,server_version_num:"160015",
  listen_addresses:"127.0.0.1",server_addr:"127.0.0.1",
  server_port:port,system_identifier:systemId,nonce
};
const expected={pgdata,port,systemId,nonce};
test("native I1: attestation requires server PGDATA, version, port, system ID and nonce",()=>{
  assert.equal(validateServerAttestation(expected,JSON.stringify(verified)),true);
  assert.match(ATTEST_SQL,/pg_control_system\(\)/);
  assert.match(ATTEST_SQL,/pg_read_file\('r21_nonce.txt'\)/);
  const mutations=[
    {data_directory:String.raw`C:\Program Files\PostgreSQL\16\data`},
    {server_version_num:"180001"},{listen_addresses:"*"},
    {server_addr:"127.0.0.2"},{server_port:5432},
    {system_identifier:"7378234355145561084"},{nonce:"wrongnonce".repeat(8)}
  ];
  for(const m of mutations)assert.equal(validateServerAttestation(expected,{...verified,...m}),false,JSON.stringify(m));
  assert.equal(validateServerAttestation(expected,"not-json"),false);
  assert.equal(validateServerAttestation(expected,{...verified,system_identifier:Number(systemId)}),false);
});

test("native I1: postmaster pid/executable/path must match before any stop",()=>{
  const process={pid:14500,executable:String.raw`C:\Program Files\PostgreSQL\16\bin\postgres.exe`,
    startedByThisRun:true,commandLineMatchesPgdata:true};
  const pidfile="14500\n"+pgdata+"\n1700000000\n55444\n\n127.0.0.1\n";
  assert.equal(validateOwnedPostmaster({pidfile,pgdata,port,expectedPid:14500,process}),true);
  assert.equal(validateOwnedPostmaster({pidfile:pidfile.replace(pgdata,String.raw`C:\Program Files\PostgreSQL\16\data`),pgdata,port,expectedPid:14500,process}),false);
  assert.equal(validateOwnedPostmaster({pidfile,pgdata,port,expectedPid:14500,process:{...process,pid:9456}}),false);
  assert.equal(validateOwnedPostmaster({pidfile,pgdata,port,expectedPid:14500,process:{...process,startedByThisRun:false}}),false);
});

test("native I1: cleanup must preserve suspicious or still-live directories",()=>{
  const safe={createdByThisRun:true,stoppedVerified:true,pidNotAliveVerified:true,aclTrusted:true,
    noReparsePoints:true,markerMatched:true,systemId,expectedSystemId:systemId,pathOwnedVerified:true};
  assert.equal(validateRunOwnershipForCleanup(safe),true);
  for(const prop of ["createdByThisRun","stoppedVerified","pidNotAliveVerified","aclTrusted",
    "noReparsePoints","markerMatched","pathOwnedVerified"] as const){
    assert.equal(validateRunOwnershipForCleanup({...safe,[prop]:false}),false,prop);
  }
  assert.equal(validateRunOwnershipForCleanup({...safe,systemId:"other"}),false);
});

const entry=join(process.cwd(),"research","gps-r21-p0-d3-synthetic-security","run-native-pg16-preflight.mjs");
function invoke(args:string[],extraEnv:Record<string,string>={}){
  const env:NodeJS.ProcessEnv={...process.env};
  for(const key of Object.keys(env))
    if(/^PG[A-Z0-9_]*$/i.test(key)||["DATABASE_URL","DIRECT_URL","NEON_DATABASE_URL","DOCKER_HOST","DOCKER_CONTEXT"].includes(key.toUpperCase()))
      delete env[key];
  return spawnSync(process.execPath,[entry,...args],{encoding:"utf8",env:{...env,...extraEnv},timeout:4000});
}
test("native I1: offline CLI produces NOT RUN without touching database tools",()=>{
  const run=invoke(["--offline-only"]);
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/OFFLINE ONLY/);
  assert.match(run.stdout,/RLS: NOT RUN/);
});

test("native I1: no opt-in or runtime flags can start PostgreSQL",()=>{
  for(const args of [[],["--synthetic-only"],["--run"],["--offline-only","--run"],["--allow-existing-db"]]){
    const r=invoke(args);
    assert.notEqual(r.status,0,JSON.stringify(args));
    assert.doesNotMatch(r.stdout,/OFFLINE ONLY/);
  }
  const inherited=invoke(["--offline-only"],{PGDATABASE:"postgres"});
  assert.notEqual(inherited.status,0);
  assert.doesNotMatch(inherited.stderr,/postgres$/m);
});
