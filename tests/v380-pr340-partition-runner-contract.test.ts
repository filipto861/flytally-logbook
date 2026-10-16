import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const script=source("tooling/run-pr340-postgres-partitions-local.ps1");
const node=source("tooling/run-pr340-partition-tests.mjs");
const registry=JSON.parse(source("tooling/postgres-partition-registry.json"));

test("M3 test runner refuses public-v20 catalog and never treats five partitions as full PASS",()=>{
  assert.match(script,/real-v20-catalog/);
  assert.match(script,/Five partitions executed; real-v20-catalog NOT RUN/);
  assert.match(node,/selected\.id==="real-v20-catalog"/);
  assert.match(node,/release_status=NOT RUN/);
  assert.equal(registry.partitions.filter((p:{id:string})=>p.id!=="real-v20-catalog")
    .reduce((n:number,p:{expectedTests:number})=>n+p.expectedTests,0),161);
});
test("M3 test runner requires own verified PG16, exact PR SHA and cleans only its cluster",()=>{
  assert.match(script,/refs\/remotes\/origin\/\$branch/);
  assert.match(script,/git status --porcelain/);
  assert.match(script,/PostgreSQL\\16\\bin/);
  assert.match(script,/pg_ctl\.exe/);
  assert.match(script,/current_database\(\).*inet_server_port\(\)/);
  assert.match(script,/FLYTALLY_V21_RELEASE_DISPOSABLE/);
  assert.match(script,/\$cluster\.Data -m fast -w -t 30 stop/);
  assert.doesNotMatch(script,/DROP SCHEMA|DROP DATABASE|DELETE FROM flights/);
});
test("M3 partition subprocess uses exact registry files and strict TAP, not shell or fake evidence",()=>{
  assert.match(node,/validatePostgresPartitionRegistry\(\)/);
  assert.match(node,/selected\.files\.filter/);
  assert.match(node,/\.\.\.files\.map\(f=>join\(root,"tests\/integration",f\.file\)\)/);
  assert.match(node,/shell:false/);
  assert.match(node,/parseStrictPartitionTap\(stdout,\{expectedTests\}\)/);
  assert.match(node,/writeFileSync\(resolve\(outDir,label\+"\.tap\.txt"\),stdout/);
  assert.doesNotMatch(node,/writeVerificationLedgerEntry|runPostgresVerification\(/);
});

test("M3 shared-core isolates the two observed 50k/100k performance files without relaxing limits",()=>{
  assert.match(node,/postgres-v169-production-hardening\.test\.ts/);
  assert.match(node,/postgres-v230-large-logbook-performance\.test\.ts/);
  assert.match(node,/perf\.length!==2/);
  assert.match(node,/expectedTests,0\)!==10/);
  assert.match(node,/for\(const group of groups\)/);
  assert.match(node,/if\(passed!==selected\.expectedTests\)/);
  assert.doesNotMatch(node,/4_000|3_000|retry|--test-concurrency/);
});
