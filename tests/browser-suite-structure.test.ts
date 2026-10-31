import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const read=(file:string)=>fs.readFileSync(path.join(root,file),"utf8");
const baseline=JSON.parse(read("tooling/browser-suite-baseline.json"));
const escapeRegExp=(value:string)=>value.replace(/[.*+?^$()|[\]\\{}]/g,"\\$&");

function logicalBrowserTests(){
  const e2eDir=path.join(root,"e2e");
  const excluded=new Set(baseline.excludedSpecs as string[]);
  const names:string[]=[];
  for(const file of fs.readdirSync(e2eDir).filter(name=>name.endsWith(".spec.mjs")&&!excluded.has(name)).sort()){
    for(const line of fs.readFileSync(path.join(e2eDir,file),"utf8").split(/\r?\n/)){
      const match=line.match(/^\s*test\("([^"]+)"/);
      if(match)names.push(match[1]);
    }
  }
  return names;
}

function browserDbExports(){
  const names:string[]=[];
  for(const line of read(baseline.fixtureContract.browserDb).split(/\r?\n/)){
    let match=line.match(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
    if(match)names.push(match[1]);
    match=line.match(/^export\s+const\s+([A-Za-z0-9_]+)/);
    if(match)names.push(match[1]);
  }
  return names.sort();
}

test("Phase 0C browser modules are syntactically parseable before Playwright discovery",()=>{
  const e2eDir=path.join(root,"e2e");
  const files=fs.readdirSync(e2eDir).filter(name=>name.endsWith(".¶»§q«^