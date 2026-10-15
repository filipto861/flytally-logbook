import test from "node:test";
import assert from "node:assert/strict";
import { DATABASE_MIGRATIONS,DATABASE_SCHEMA_VERSION,pendingMigrationVersions } from "../lib/migration-plan.ts";

test("database migrations are sequential and end at the advertised schema version",()=>{
  // Preserve the complete historical v1-v20 sequence; v21 is the new tail.
  const historical=Array.from({length:20},(_,index)=>index+1);
  assert.deepEqual(DATABASE_MIGRATIONS.slice(0,20).map(item=>item.version),historical);
  assert.deepEqual(DATABASE_MIGRATIONS.map(item=>item.version),[...historical,21]);
  assert.equal(DATABASE_MIGRATIONS.at(-1)?.version,DATABASE_SCHEMA_VERSION);
});

test("only unapplied database migrations are planned",()=>{
  assert.deepEqual(pendingMigrationVersions([1,3]),[2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]);
  assert.deepEqual(pendingMigrationVersions([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]),[19,20,21]);
  assert.deepEqual(pendingMigrationVersions(Array.from({length:20},(_,index)=>index+1)),[21]);
  assert.deepEqual(pendingMigrationVersions(Array.from({length:21},(_,index)=>index+1)),[]);
});
