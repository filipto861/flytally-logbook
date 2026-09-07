import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {releaseAtLeast} from "./release-version.ts";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("v2.2 release remains a preserved baseline for later v2.x releases",()=>{
  const pkg=JSON.parse(read("package.json")),lock=JSON.parse(read("package-lock.json"));
  assert.ok(releaseAtLeast(pkg.version,2,2));
  assert.equal(lock.version,pkg.version);
  assert.equal(lock.packages[""].version,pkg.version);
  assert.match(read("CHANGELOG.md"),/## 2\.2\.0 — Action Center & Shared Flight Workflow/);
  assert.equal(fs.existsSync(path.join(root,".github/workflows/v220-release-cut.yml")),false);
});
