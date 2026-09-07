import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.0 GA release metadata is aligned",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version,"2.0.0");
  assert.equal(lock.version,"2.0.0");
  assert.equal(lock.packages[""].version,"2.0.0");
  assert.match(read("CHANGELOG.md"),/## 2\.0\.0 — Multi-category Pilot Logbook/);
  assert.match(read("ROADMAP.md"),/## Current release — v2\.0\.0 — Multi-category Pilot Logbook/);
});
