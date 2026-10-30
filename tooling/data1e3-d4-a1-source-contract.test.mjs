import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";
const read=(p)=>readFileSync(path.resolve(import.meta.dirname,"..",p),"utf8");
test("D4 A1 runner guards",()=>{
 const src=read("tooling/data1e3-d4-a1-owned-local-pg16.mjs");
 assert.ok(src.includes("--expected-sha="),"--expected-sha=");
 assert.ok(src.includes("--confirm=DATA1E3-A1-LOCAL-ONLY"),"--confirm=DATA1E3-A1-LOCAL-ONLY");
 assert.ok(src.includes("physicalPid(bins,pid,data)"),"physicalPid(bins,pid,data)");
 assert.ok(src.includes(".data1e3-owned"),"\\.data1e3-owned");
 assert.ok(src.includes("onlyOwnedTempDirectory:true"),"onlyOwnedTempDirectory:true");
 assert.ok(src.includes("Inherited PostgreSQL/cloud/CI setting must be cleared"),"Inherited PostgreSQL/cloud/CI setting must be cleared");
});
test("D4 A1 probe guards",()=>{
 const src=read("tooling/data1e3-d4-a1-source-sql-probe.mjs");
 assert.ok(src.includes("FLYTALLY_D4_A1_LOCAL_PROBE"),"FLYTALLY_D4_A1_LOCAL_PROBE");
 assert.ok(src.includes("FLYTALLY_D4_A1_OWNERSHIP_TOKEN"),"FLYTALLY_D4_A1_OWNERSHIP_TOKEN");
 assert.ok(src.includes("realpathSync(tmpdir())"),"realpathSync(tmpdir())");
 assert.ok(src.includes("D4_A1_TARGET_REJECTED"),"D4_A1_TARGET_REJECTED");
 assert.ok(src.includes("DROP SCHEMA"),"DROP SCHEMA");
});
test("D4 A1 two-session coverage",()=>{
 const src=read("tooling/data1e3-d4-a1-source-sql-probe.mjs");
 assert.ok(src.includes("[\"flight\",1001,true]"),"[\"flight\",1001,true]");
 assert.ok(src.includes("[\"fstd\",2001,true]"),"[\"fstd\",2001,true]");
 assert.ok(src.includes("[\"flight\",1003,false]"),"[\"flight\",1003,false]");
 assert.ok(src.includes("[\"fstd\",2003,false]"),"[\"fstd\",2003,false]");
 assert.ok(src.includes("racingSession(kind,ready,sqlAfter,rowId,certified)"),"racingSession(kind,ready,sqlAfter,rowId,certified)");
 assert.ok(src.includes("assert.equal(idVal(table,id),existing)"),"assert.equal(idVal(table,id),existing)");
 assert.ok(src.includes("assert.equal(auditState(),audits)"),"assert.equal(auditState(),audits)");
 assert.ok(src.includes("assert.equal(markerCount(),0)"),"assert.equal(markerCount(),0)");
});
