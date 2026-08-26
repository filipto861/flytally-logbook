import test from "node:test";
import assert from "node:assert/strict";
import { DATABASE_MIGRATIONS,DATABASE_SCHEMA_VERSION,pendingMigrationVersions } from "../lib/migration-plan.ts";

test("database migrations are sequential and end at the advertised schema version",()=>{
  assert.deepEqual(DATABASE_MIGRATIONS.map(item=>item.version),[1,2,3,4,5,6,7,8,9]);
  assert.equal(DATABASE_MIGRATIONS.at(-1)?.version,DATABASE_SCHEMA_VERSION);
});

test("only unapplied database migrations are planned",()=>{
  assert.deepEqual(pendingMigrationVersions([1,3]),[2,4,5,6,7,8,9]);
  assert.deepEqual(pendingMigrationVersions([1,2,3,4,5,6,7,8,9]),[]);
});
