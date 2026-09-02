import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");

test("global shell exposes the package version and support feedback link",()=>{
  const shell=read("components/app-shell.tsx");
  assert.match(shell,/import packageMetadata from "@\/package[.]json"/);
  assert.match(shell,/FlyTally v\{appVersion\}/);
  assert.match(shell,/mailto:support@fly-tally[.]com/);
  assert.match(shell,/FlyTally feedback · v/);
});

test("v1.64 development metadata is synchronized",()=>{
  const pkg=JSON.parse(read("package.json")) as {version?:string};
  assert.equal(pkg.version,"1.64.0");
});
