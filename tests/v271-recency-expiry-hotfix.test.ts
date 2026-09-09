import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.7.1 Recency keeps legacy text expiry dates type-safe in PostgreSQL",()=>{
  const service=read("lib/recency-workspace-service.ts");
  assert.match(service,/expiry_date>='9999-01-01'/);
  assert.doesNotMatch(service,/expiry_date>=DATE '9999-01-01'/);
});
