import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { releaseAtLeast } from "./release-version.ts";

const root=path.resolve(import.meta.dirname,".."),read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("certification v3 payload remains verifiable after explicit later payload migrations",()=>{
  assert.ok(releaseAtLeast(JSON.parse(read("package.json")).version,1,33,1));
  const integrity=read("lib/certification-integrity.ts");
  assert.match(integrity,/if\(version===3\)return/);
  assert.match(integrity,/purposeCode:text\(row\.purpose_code\)/);
});
