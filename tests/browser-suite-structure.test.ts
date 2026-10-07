import assert from "node:assert/strict";
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

test("Phase 0C preserves the exact 48 logical authenticated browser tests",()=>{
  const actual=logicalBrowserTests();
  assert.equal(actual.length,48);
  assert.equal(new Set(actual).size,actual.length,"browser test names must remain unique and grep-able");
  assert.deepEqual([...actual].sort(),[...baseline.acceptanceLogicalTests].sort());
});

test("Phase 0C keeps the serialized two-project Playwright contract",()=>{
  const config=read("playwright.config.mjs");
  assert.match(config,/fullyParallel:false/);
  assert.match(config,/workers:1/);
  assert.match(config,/retries:process\.env\.CI\?1:0/);
  for(const project of baseline.playwright.projects){
    assert.match(config,new RegExp('name:"'+escapeRegExp(project)+'"'));
  }
});

test("Phase 0C keeps browser DB helper ownership and fixture identities centralized",()=>{
  assert.equal(fs.existsSync(path.join(root,baseline.fixtureContract.browserDb)),true);
  assert.equal(fs.existsSync(path.join(root,baseline.fixtureContract.bootstrap)),true);
  assert.deepEqual(browserDbExports(),[...baseline.fixtureContract.exportedHelpers].sort());

  const db=read(baseline.fixtureContract.browserDb);
  const ids=[...new Set(db.match(/\b9\d{3}\b/g)??[])].sort();
  assert.deepEqual(ids,[...baseline.fixtureContract.numericFixtureIds].sort());
  for(const email of baseline.fixtureContract.primaryUsers){
    assert.match(read(baseline.fixtureContract.bootstrap),new RegExp(escapeRegExp(email)));
  }

  const e2eFiles=fs.readdirSync(path.join(root,"e2e"));
  assert.equal(
    e2eFiles.filter(name=>/^browser-db.*\.(?:mjs|js|ts)$/.test(name)).join(","),
    path.basename(baseline.fixtureContract.browserDb),
    "browser DB reset/query ownership must remain single-sourced during Phase 0C",
  );
});

test("Phase 0C baseline records every required viewport and theme state",()=>{
  const allSpecs=fs.readdirSync(path.join(root,"e2e"))
    .filter(name=>name.endsWith(".spec.mjs"))
    .map(name=>fs.readFileSync(path.join(root,"e2e",name),"utf8"))
    .join("\n");

  for(const state of baseline.requiredPresentationStates.f6Viewports){
    assert.match(allSpecs,new RegExp('["\\\']'+escapeRegExp(state)+'["\\\']'),"missing required F6 viewport state: "+state);
  }
  for(const theme of baseline.requiredPresentationStates.themes){
    assert.match(allSpecs,new RegExp('["\\\']'+escapeRegExp(theme)+'["\\\']'),"missing required theme: "+theme);
  }
  for(const state of baseline.requiredPresentationStates.uiAuditViewports){
    assert.match(read("e2e/ui-audit-capture.spec.mjs"),new RegExp('name:"'+escapeRegExp(state)+'"'));
  }
  assert.match(
    read("e2e/ui-audit-capture.spec.mjs"),
    /testInfo\.project\.name!=="desktop-chromium"/,
    "self-managed UI audit matrix must stay single-project",
  );
});

test("Phase 0C.1 shared browser actions stay minimal and cross-domain",()=>{
  const helpers=read("e2e/browser-actions.mjs");
  const shell=read("e2e/public-shell.spec.mjs");
  assert.match(helpers,/export async function expectNoHorizontalOverflow/);
  assert.match(helpers,/export async function loginBrowserPilot/);
  assert.doesNotMatch(helpers,/openGps|splitGps|RoleCrew|F35|F43/);
  assert.match(shell,/from "\.\/browser-actions\.mjs"/);
  assert.doesNotMatch(shell,/async function expectNoHorizontalOverflow/);
  assert.doesNotMatch(shell,/async function loginBrowserPilot/);
});

test("Phase 0C.2 batch 1 owns settings and connection mutations in one domain spec",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const mutations=read("e2e/settings-connections-mutations.spec.mjs");
  for(const name of [
    "appearance mutation disables duplicate submit and persists",
    "connection acceptance disables duplicate submit and persists",
    "account settings transaction disables duplicate submit and persists both records",
    "connection access update disables duplicate submit and persists",
  ]){
    assert.match(mutations,new RegExp('test\\("'+escapeRegExp(name)+'"'));
    assert.doesNotMatch(shell,new RegExp('test\\("'+escapeRegExp(name)+'"'));
  }
  assert.match(mutations,/async function holdPost/);
  assert.match(mutations,/from "\.\/browser-db\.mjs"/);
  assert.match(mutations,/from "\.\/browser-actions\.mjs"/);
});

test("Phase 0C baseline documents the previously verified full-gate execution count",()=>{
  assert.deepEqual(baseline.expectedFullGate,{passed:96,skipped:2,failed:0,totalExecutions:98});
});
