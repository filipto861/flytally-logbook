import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root=path.resolve(import.meta.dirname,"..");
const moduleUrl=pathToFileURL(path.join(root,"tooling/evidence-contract.mjs")).href;

function evaluate(payload:Record<string,unknown>){
  const script=[
    `import { evaluateEvidenceMatrix } from ${JSON.stringify(moduleUrl)};`,
    `const input=JSON.parse(process.argv[1]);`,
    `console.log(JSON.stringify(evaluateEvidenceMatrix(input)));`,
  ].join("");
  const result=spawnSync(process.execPath,["--input-type=module","-e",script,JSON.stringify(payload)],{cwd:root,encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout.trim());
}

const browserTargets=Array.from({length:6},(_,index)=>({
  id:"browser-"+index,
  spec:"e2e/example.spec.mjs",
  title:"Example "+index,
  project:index%2===0?"desktop-chromium":"mobile-chromium",
}));

const observation=(overrides:Record<string,unknown>={})=>({
  command:"npm run test:group -- ui-contract",
  sourceGates:["ui-contract"],
  coverage:"targeted",
  planned:10,
  passed:10,
  failed:0,
  skipped:0,
  notApplicable:0,
  retries:0,
  ...overrides,
});

test("source-contract PASS proves only application/source-contract evidence",()=>{
  const result=evaluate({
    requiredEvidence:["application-source-contract"],
    observations:{"application-source-contract":observation()},
  });
  assert.equal(result.evidence["application-source-contract"].status,"PASS");
  assert.equal(result.evidence["domain-unit"].status,"N/A");
  assert.equal(result.evidence["postgres-acceptance"].status,"N/A");
  assert.equal(result.evidence["browser-acceptance"].status,"N/A");
  assert.equal(result.overallStatus,"PASS");
});

test("source-contract output cannot masquerade as browser acceptance",()=>{
  const result=evaluate({
    requiredEvidence:["browser-acceptance"],
    observations:{"browser-acceptance":observation()},
  });
  assert.equal(result.evidence["browser-acceptance"].status,"PARTIAL");
  assert.equal(result.overallStatus,"FAIL");
});

test("direct domain-unit evidence requires the canonical domain source",()=>{
  const result=evaluate({
    requiredEvidence:["domain-unit"],
    observations:{
      "domain-unit":observation({
        command:"npm run test:target -- tests/domain-behavior.test.ts",
        sourceGates:["domain-unit"],coverage:"targeted",
      }),
    },
  });
  assert.equal(result.evidence["domain-unit"].status,"PASS");
  assert.equal(result.overallStatus,"PASS");
});

test("aggregate full tests cannot synthesize domain-unit evidence",()=>{
  const result=evaluate({
    requiredEvidence:["domain-unit"],
    observations:{"domain-unit":observation({sourceGates:["full-tests"],command:"npm test",coverage:"full"})},
  });
  assert.equal(result.evidence["domain-unit"].status,"PARTIAL");
  assert.equal(result.overallStatus,"FAIL");
});

test("build artifact cannot synthesize behavioral evidence",()=>{
  const result=evaluate({
    requiredEvidence:["browser-acceptance"],
    observations:{"browser-acceptance":observation({sourceGates:["build"],command:"npm run build",coverage:"full"})},
    buildRequired:true,
    buildObservation:{sourceGate:"build",ran:true,failed:false},
  });
  assert.equal(result.build.status,"PASS");
  assert.equal(result.evidence["browser-acceptance"].status,"PARTIAL");
  assert.equal(result.overallStatus,"FAIL");
});

test("required evidence that did not run fails closed as NOT RUN",()=>{
  const result=evaluate({requiredEvidence:["browser-acceptance"]});
  assert.equal(result.evidence["browser-acceptance"].status,"NOT RUN");
  assert.equal(result.overallStatus,"NOT RUN");
});

test("browser acceptance permits explicit N/A cases but not raw skips",()=>{
  const accepted=evaluate({
    requiredEvidence:["browser-acceptance"],
    observations:{
      "browser-acceptance":observation({
        command:"npm run test:browser -- --retries=0",
        sourceGates:["browser-risk"],coverage:"targeted",planned:6,passed:4,notApplicable:2,retries:0,
        authority:"release",selectionHash:"a".repeat(64),targets:browserTargets,
      }),
    },
  });
  assert.equal(accepted.evidence["browser-acceptance"].status,"PASS");

  const skipped=evaluate({
    requiredEvidence:["browser-acceptance"],
    observations:{
      "browser-acceptance":observation({
        command:"npm run test:browser -- --retries=0",
        sourceGates:["browser-risk"],coverage:"targeted",planned:6,passed:4,skipped:2,retries:0,
        authority:"release",selectionHash:"a".repeat(64),targets:browserTargets,
      }),
    },
  });
  assert.equal(skipped.evidence["browser-acceptance"].status,"PARTIAL");
  assert.equal(skipped.overallStatus,"FAIL");
});

test("legacy full browser diagnostics cannot satisfy authoritative browser acceptance",()=>{
  const result=evaluate({
    requiredEvidence:["browser-acceptance"],
    observations:{
      "browser-acceptance":observation({
        command:"npm run verify:browser -- --base HEAD~1",
        sourceGates:["browser-diagnostic"],coverage:"full",planned:94,passed:92,notApplicable:2,retries:0,
      }),
    },
  });
  assert.equal(result.evidence["browser-acceptance"].status,"PARTIAL");
  assert.equal(result.overallStatus,"FAIL");
});

test("acceptance evidence with retries is not PASS",()=>{
  const result=evaluate({
    requiredEvidence:["postgres-acceptance"],
    observations:{
      "postgres-acceptance":observation({
        command:"npm run test:postgres:full",
        sourceGates:["postgres"],coverage:"full",planned:99,passed:99,retries:1,
      }),
    },
  });
  assert.equal(result.evidence["postgres-acceptance"].status,"PARTIAL");
  assert.equal(result.overallStatus,"FAIL");
});

test("build is reported independently from behavioral evidence",()=>{
  const result=evaluate({
    buildRequired:true,
    buildObservation:{sourceGate:"build",ran:true,failed:false},
  });
  assert.equal(result.build.status,"PASS");
  assert.equal(result.evidence["domain-unit"].status,"N/A");
  assert.equal(result.evidence["application-source-contract"].status,"N/A");
  assert.equal(result.evidence["postgres-acceptance"].status,"N/A");
  assert.equal(result.evidence["browser-acceptance"].status,"N/A");
  assert.equal(result.overallStatus,"PASS");
});
