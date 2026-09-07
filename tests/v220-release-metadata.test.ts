import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.2 release metadata is aligned",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  assert.equal(pkg.version,"2.2.0");
  assert.equal(lock.version,"2.2.0");
  assert.equal(lock.packages[""].version,"2.2.0");
  assert.match(read("CHANGELOG.md"),/## 2\.2\.0 — Action Center & Shared Flight Workflow/);
  assert.match(read("ROADMAP.md"),/## Current release — v2\.2\.0 — Action Center & Shared Flight Workflow/);
  assert.equal(fs.existsSync(path.join(root,".github/workflows/v220-release-cut.yml")),false);
});
