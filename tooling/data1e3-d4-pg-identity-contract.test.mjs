import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const launcher=readFileSync(path.join(root,"tooling/data1e3-d4-owned-local-pg16.mjs"),"utf8");
const risk=readFileSync(path.join(root,"tooling/data1e3-d4-source-sql-risk-probe.mjs"),"utf8");

test("DATA-1E3 PG16: normalize the inet host output before strict exact 127.0.0.1 comparison in both gates",()=>{
  for(const [label,source] of [["launcher",launcher],["risk probe",risk]]){
    assert.match(source,/host\(inet_server_addr\(\)\) AS addr/,label+" must use the native PG inet host function");
    assert.doesNotMatch(source,/inet_server_addr\(\)::text AS addr/,label+" must not compare /32 CIDR literal to an IPv4 address");
    assert.match(source,/\.addr,"127\.0\.0\.1"|\.addr!=="127\.0\.0\.1"/,label+" exact localhost enforcement must stay");
    assert.match(source,/current_setting\('data_directory'\)/,label+" physical data directory identity must stay");
    assert.match(source,/current_setting\('server_version_num'\)/,label+" PG16 version identity must stay");
  }
});

test("DATA-1E3 PG16: physical OS ownership and strict cleanup remain required",()=>{
  assert.match(launcher,/physicalPid\(bins,pid,data\)/);
  assert.match(launcher,/assert\.equal\(normalizePath\(row\.datadir\),normalizePath\(data\)\)/);
  assert.match(launcher,/assert\.equal\(row\.role,role\)/);
  assert.match(launcher,/assert\.equal\(row\.port,port\)/);
  assert.match(launcher,/if\(stoppedVerified&&existsSync\(sentinel\)/);
  assert.match(launcher,/D4_CLEANUP_BLOCKED/);
  assert.match(launcher,/stdio:"ignore"/);
});

test("DATA-1E3 PG16: JSON-row fixture timestamps remain PostgreSQL NULL, not invalid empty strings",()=>{
  assert.match(risk,/certified_at:null,certified_by_user_id:7/);
  assert.match(risk,/locked_at:null,locked_by_user_id:7/);
  assert.doesNotMatch(risk,/certified_at:""/);
  assert.doesNotMatch(risk,/locked_at:""/);
  assert.match(risk,/source\.matchAll\(new RegExp/);
  assert.match(risk,/D4_SOURCE_SQL_INTERLEAVING/);
});
