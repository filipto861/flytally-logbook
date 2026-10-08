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
  const files=fs.readdirSync(e2eDir).filter(name=>name.endsWith(".mjs")).sort();
  assert.ok(files.length>0);
  for(const file of files){
    const absolute=path.join(e2eDir,file);
    const result=spawnSync(process.execPath,["--check",absolute],{encoding:"utf8"});
    assert.equal(result.status,0,file+" failed node --check:\n"+result.stderr);
  }
});

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

test("Phase 0C.1 shared browser actions stay generic and cross-domain",()=>{
  const helpers=read("e2e/browser-actions.mjs");
  const shell=read("e2e/public-shell.spec.mjs");
  for(const name of ["expectNoHorizontalOverflow","loginBrowserPilot","expectAuthenticatedRoute","ensureDetailsOpen","holdPost"]){
    assert.match(helpers,new RegExp("export async function "+name));
  }
  assert.doesNotMatch(helpers,/openGps|splitGps|RoleCrew|F35|F43/);
  assert.match(shell,/from "\.\/browser-actions\.mjs"/);
  assert.doesNotMatch(shell,/async function expectNoHorizontalOverflow/);
  assert.doesNotMatch(shell,/async function loginBrowserPilot/);
  assert.doesNotMatch(shell,/async function expectAuthenticatedRoute/);
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
  assert.doesNotMatch(mutations,/async function holdPost/);
  assert.match(mutations,/holdPost/);
  assert.match(mutations,/from "\.\/browser-db\.mjs"/);
  assert.match(mutations,/from "\.\/browser-actions\.mjs"/);
});

test("Phase 0C.2 batch 2 owns advisory presentation flows in one domain spec",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const advisory=read("e2e/advisory-presentation.spec.mjs");
  const names=[
    "E1.1 route assistance stays below aligned Route fields and remains keyboard reachable",
    "E1.2 aircraft default operation prefills Manual and GPS but remains flight-editable",
    "E1.4 certified legacy GPS Task stays raw and annotated in owner and shared read-only views",
    "3.5.2 Settings ignores legacy Night definition preference and exposes no account control",
    "3.5.2 legacy MANUAL preference does not suppress applicable GPS SERA suggestions",
    "E1.3 SERA GPS suggestion is accessible, invalidates on total change and keeps pilot edits sticky",
    "3.4.1 sparse GPS Night-time stays manual with an explicit gap reason",
  ];
  for(const name of names){
    assert.match(advisory,new RegExp('test\\("'+escapeRegExp(name)+'"'));
    assert.doesNotMatch(shell,new RegExp('test\\("'+escapeRegExp(name)+'"'));
  }
  assert.equal((advisory.match(/^test\("/gm)??[]).length,names.length);
  assert.match(advisory,/from "\.\/browser-db\.mjs"/);
  assert.match(advisory,/from "\.\/browser-actions\.mjs"/);
});

test("Phase 0C.2 batch 3 owns manual RoleCrew verification in one domain spec",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const domain=read("e2e/manual-rolecrew-verification.spec.mjs");
  const names=[
    "F2.2 Manual RoleCrew identity is inline and survives unsaved role switches",
    "F2.4C certified verifier evidence stays unbound and exposes both explicit verification paths",
    "Safety Pilot Actual PIC form keeps manual and connected identity explicit",
    "F2.3 Safety Pilot resolver snapshots server identity and fails closed after Connection revocation",
    "certified Safety Pilot can invite only the stored connected Actual PIC",
  ];
  for(const name of names){
    assert.equal(domain.includes('test("'+name+'"'),true);
    assert.equal(shell.includes('test("'+name+'"'),false);
  }
  assert.equal((domain.match(/^test\("/gm)??[]).length,names.length);
  assert.doesNotMatch(domain,/async function expectAuthenticatedRoute/);
  assert.match(domain,/expectAuthenticatedRoute/);
  assert.match(domain,/browser-db\.mjs/);
  assert.match(domain,/browser-actions\.mjs/);
});

test("Phase 0C.2 batch 4 owns Manual authority and certification in one domain spec",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const domain=read("e2e/manual-authority-certification.spec.mjs");
  const names=[
    "GPS and Manual keep profile-owned aircraft context out of generic drift editors",
    "F3.4 Manual compact context exposes only A+ choice and blocks invalid profiles",
    "F3.5 same-registration SNAPSHOT survives invalid current profile and rejects crafted drift",
    "F3.5 PROFILE authority re-resolves on submit and persists only allowed TMG context",
    "F3.5 OTHER and Balloon keep profile-owned context separate from flight-specific choices",
    "F3.5 Quick Add refreshes aircraft authority before immediate flight Save",
    "3.4.0 Manual explicit Save & certify seals the persisted row while Enter remains draft-only",
    "3.5.0 certified flight can be voided from active logbook while permanent audit remains",
  ];
  for(const name of names){
    assert.equal(domain.includes('test("'+name+'"'),true);
    assert.equal(shell.includes('test("'+name+'"'),false);
  }
  assert.equal((domain.match(/^test\("/gm)??[]).length,names.length);
  assert.doesNotMatch(domain,/async function holdPost/);
  assert.match(domain,/holdPost/);
  assert.doesNotMatch(shell,/async function holdPost/);
  assert.match(domain,/browser-db\.mjs/);
  assert.match(domain,/browser-actions\.mjs/);
});

test("Phase 0C.2 batch 5 owns responsive presentation matrices in one domain spec",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const domain=read("e2e/responsive-presentation.spec.mjs");
  const names=[
    "3.4.0 responsive entry shell stays usable across desktop iPad mobile light and dark",
    "F4.4 GPS RoleCrew override UX stays responsive across cockpit viewports and themes",
    "F5.3 common Manual PIC keeps an explicit minimal control and helper allowlist across focused viewports",
    "F5.3 role change keeps required DUAL identity inline and removes the default cue",
    "F6 Manual RoleCrew matrix covers required roles modes viewports themes and 200 percent reflow",
    "F6 GPS single-flight matrix covers PIC DUAL Safety Pilot viewports themes and reflow",
    "F6 GPS multi-part inheritance override matrix stays usable at every required presentation state",
    "F6 invalid-profile recovery remains explicit in Manual and GPS across the full presentation matrix",
    "F2.5 RoleCrew presentation stays usable on desktop iPad and mobile in light and dark",
  ];
  for(const name of names){
    assert.equal(domain.includes('test("'+name+'"'),true);
    assert.equal(shell.includes('test("'+name+'"'),false);
  }
  assert.equal((domain.match(/^test\("/gm)??[]).length,names.length);
  assert.match(domain,/const F6_PRESENTATION_VIEWPORTS=/);
  assert.match(domain,/async function applyF6PresentationState/);
  assert.doesNotMatch(shell,/F6_PRESENTATION_VIEWPORTS/);
  assert.doesNotMatch(shell,/applyF6PresentationState/);
  assert.equal(domain.includes("test.info().project.name"),false,
    "0C.2 is ownership-only; project-matrix deduplication belongs to 0C.3");
});

test("Phase 0C.2 batch 6 owns GPS RoleCrew functionals and leaves public shell focused",()=>{
  const shell=read("e2e/public-shell.spec.mjs");
  const gps=read("e2e/gps-rolecrew.spec.mjs");
  const names=[
    "3.4.0 single GPS Save & certify seals the imported persisted row",
    "3.4.0 GPS quality warning requires one targeted acknowledgement before completion",
    "GPS import fails closed for invalid profile context and exposes only implemented F4 roles",
    "GPS reviewed PIC save persists normalized shared semantics",
    "F4.1 common DUAL invalidates inherited review and persists normalized RoleCrew",
    "F4.2 mixed INHERIT and DUAL OVERRIDE persist independently",
    "F4.2 split-boundary change clears RoleCrew overrides with a visible notice",
    "F4.3 common Manual Safety Pilot persists explicit Actual PIC without account link",
    "F4.3 common connected Safety Pilot snapshots server identity and persists one PIC link",
    "F4.3 revoked per-flight connected Safety Pilot fails closed without partial split persistence",
  ];
  for(const name of names){
    assert.equal(gps.includes('test("'+name+'"'),true);
    assert.equal(shell.includes('test("'+name+'"'),false);
  }
  assert.equal((gps.match(/^test\("/gm)??[]).length,names.length);
  assert.equal((shell.match(/^test\("/gm)??[]).length,5);
  assert.match(gps,/from "\.\/gps-actions\.mjs"/);
  assert.doesNotMatch(gps,/async function openGpsFlightContext|async function splitGpsIntoTwo|async function completeF43GpsPart/);
  assert.doesNotMatch(shell,/browser-db\.mjs/);
  assert.doesNotMatch(shell,/openGpsFlightContext|splitGpsIntoTwo|completeF43GpsPart/);
});

test("Phase 0C.2a reconciles generic and GPS-specific browser helper ownership",()=>{
  const generic=read("e2e/browser-actions.mjs");
  const gpsActions=read("e2e/gps-actions.mjs");
  const gps=read("e2e/gps-rolecrew.spec.mjs");
  const responsive=read("e2e/responsive-presentation.spec.mjs");
  const authority=read("e2e/manual-authority-certification.spec.mjs");
  const mutations=read("e2e/settings-connections-mutations.spec.mjs");
  const shell=read("e2e/public-shell.spec.mjs");
  const manualRoleCrew=read("e2e/manual-rolecrew-verification.spec.mjs");

  for(const name of ["expectAuthenticatedRoute","ensureDetailsOpen","holdPost"]){
    assert.match(generic,new RegExp("export async function "+name));
  }
  assert.doesNotMatch(generic,/openGpsFlightContext|selectGpsCommonRole|selectGpsActualPicMode|splitGpsIntoTwo|completeF43GpsPart/);

  for(const name of ["openGpsFlightContext","selectGpsCommonRole","selectGpsActualPicMode","openGpsTrackReview","splitGpsIntoTwo","completeF43GpsPart"]){
    assert.match(gpsActions,new RegExp("export async function "+name));
  }
  assert.match(gpsActions,/ensureDetailsOpen/);
  assert.match(gps,/from "\.\/gps-actions\.mjs"/);
  assert.match(responsive,/from "\.\/gps-actions\.mjs"/);
  assert.doesNotMatch(gps,/async function (?:ensureDetailsOpen|openGpsFlightContext|selectGpsCommonRole|selectGpsActualPicMode|openGpsTrackReview|splitGpsIntoTwo|completeF43GpsPart)/);
  assert.doesNotMatch(responsive,/async function (?:ensureDetailsOpen|openGpsFlightContext|selectGpsCommonRole|selectGpsActualPicMode|openGpsTrackReview|splitGpsIntoTwo|completeF43GpsPart)/);

  assert.match(authority,/holdPost/);
  assert.match(mutations,/holdPost/);
  assert.doesNotMatch(authority,/async function holdPost/);
  assert.doesNotMatch(mutations,/async function holdPost/);

  assert.match(shell,/expectAuthenticatedRoute/);
  assert.match(manualRoleCrew,/expectAuthenticatedRoute/);
  assert.doesNotMatch(shell,/async function expectAuthenticatedRoute/);
  assert.doesNotMatch(manualRoleCrew,/async function expectAuthenticatedRoute/);
});

test("Phase 0C.3 deduplicates only full self-managed presentation matrices",()=>{
  const responsive=read("e2e/responsive-presentation.spec.mjs");
  const config=read("playwright.config.mjs");
  const tag="@self-managed-presentation";
  const names=[
    "F6 Manual RoleCrew matrix covers required roles modes viewports themes and 200 percent reflow",
    "F6 GPS single-flight matrix covers PIC DUAL Safety Pilot viewports themes and reflow",
    "F6 GPS multi-part inheritance override matrix stays usable at every required presentation state",
    "F6 invalid-profile recovery remains explicit in Manual and GPS across the full presentation matrix"
  ];
  for(const name of names){
    assert.equal(responsive.includes('test("'+name+'",{tag:"'+tag+'"}'),true);
  }
  assert.equal((responsive.match(new RegExp('tag:"'+tag+'"',"g"))??[]).length,names.length);
  assert.match(config,/mobile-chromium".*grepInvert:\/@self-managed-presentation\//);
  assert.equal((responsive.match(/for\(const viewport of F6_PRESENTATION_VIEWPORTS\)/g)??[]).length,4);
  assert.ok((responsive.match(/for\(const theme of \["light","dark"\]\)/g)??[]).length>=4);
  assert.doesNotMatch(responsive,/navigator\.userAgent|userAgentData|hasTouch|deviceScaleFactor|visualViewport|matchMedia|pointerType/);
  for(const name of [
    "3.4.0 responsive entry shell stays usable across desktop iPad mobile light and dark",
    "F4.4 GPS RoleCrew override UX stays responsive across cockpit viewports and themes",
    "F5.3 common Manual PIC keeps an explicit minimal control and helper allowlist across focused viewports",
    "F5.3 role change keeps required DUAL identity inline and removes the default cue",
    "F2.5 RoleCrew presentation stays usable on desktop iPad and mobile in light and dark",
  ]){
    assert.equal(responsive.includes('test("'+name+'",{tag:"'+tag+'"}'),false,
      "partial/focused matrices must retain both Playwright projects");
  }
});

test("Phase 0C baseline documents the previously verified full-gate execution count",()=>{
  assert.deepEqual(baseline.expectedFullGate,{passed:96,skipped:2,failed:0,totalExecutions:98});
});
