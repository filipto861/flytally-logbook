import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("browser smoke flight fixture includes historical aircraft identity columns required by runtime migrations",()=>{
  const bootstrap=read("tooling/bootstrap-browser-smoke-db.mjs");
  const start=bootstrap.indexOf("CREATE TABLE flights(");
  const end=bootstrap.indexOf(");",start);
  assert.ok(start>=0&&end>start);
  const flights=bootstrap.slice(start,end);
  assert.match(flights,/aircraft_make TEXT NOT NULL DEFAULT ''/);
  assert.match(flights,/aircraft_model TEXT NOT NULL DEFAULT ''/);
  assert.match(flights,/aircraft_variant TEXT NOT NULL DEFAULT ''/);
});
