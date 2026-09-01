import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const source=fs.readFileSync(path.join(root,"lib/v162-schema.ts"),"utf8");

test("v1.62 runtime migration never backfills certified flights",()=>{
  assert.match(source,/UPDATE flights SET regulatory_category=CASE[\s\S]*WHERE COALESCE\(regulatory_category,''\)='' AND certified_at IS NULL/);
  assert.doesNotMatch(source,/DISABLE TRIGGER|session_replication_role|ALTER TABLE flights DISABLE/i);
  assert.match(source,/INSERT INTO flytally_feature_migrations\(migration_key\)/);
});
