import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {readFileSync} from "node:fs";
import {assertPr340AcceptancePreflight} from "../tooling/pr340-owned-postgres-acceptance.mjs";

const source=(name:string)=>readFileSync(new URL("../tooling/"+name,import.meta.url),"utf8");
const candidate={headSha:"a".repeat(40),worktree:{files:[]}};
test("PR340 executable PG release gate refuses missing explicit authorization before any database access",()=>{
  assert.throws(()=>assertPr340AcceptancePreflight({candidate,env:{}}),/Explicit isolated PR340 acceptance intent/);
});
test("PR340 executor refuses production and CI environments even with intent",()=>{
  for(const name of ["CI","VERCEL","VERCEL_ENV"]){
    assert.throws(()=>assertPr340AcceptancePreflight({
      candidate,env:{FLYTALLY_PR340_PARTITION_RELEASE:"1",[name]:"1"},
    }),/Refuse CI\/production marker/);
  }
});
test("PR340 release verifier does not accept imported TAP files as canonical ledger",()=>{
  const bridge=source("verify-postgres.mjs");
  const executor=source("pr340-owned-postgres-acceptance.mjs");
  assert.match(bridge,/runOwnedPr340PostgresAcceptance\(\{candidate,env\}\)/);
  assert.match(bridge,/assertPr340AcceptancePreflight\(\{candidate,env\}\)/);
  assert.match(executor,/mkdtempSync\(path\.join\(tmpdir\(\),"flytally-pr340-release-"\)\)/);
  assert.match(executor,/assertPr340AcceptancePreflight\(\{candidate,env\}\)/);
  assert.match(executor,/parseStrictPartitionTap\(stdout,\{expectedTests:segment\.expectedTests\}\)/);
  assert.match(executor,/assert\.equal\(completed,163/);
  assert.match(executor,/ownedClusterStopped:true/);
  assert.doesNotMatch(executor,/writeVerificationLedgerEntry\(/);
});
test("PR340 benchmark profile is explicit, local and does not rewrite SQL or test thresholds",()=>{
  const executor=source("pr340-owned-postgres-acceptance.mjs");
  assert.match(executor,/if\(part\.id==="shared-core"\)/);
  assert.match(executor,/ALTER DATABASE flytally_currency_test SET work_mem = '64MB'/);
  assert.match(executor,/assert\.equal\(proc\(bins\.psql,[\s\S]*?"SHOW work_mem"/);
  assert.match(executor,/profile:"controlled-local-pg16-shared-core-work_mem-64MB"/);
  const wrapper=source("run-v380-cost-summary-acceptance-local.ps1");
  assert.match(wrapper,/\$env:FLYTALLY_PR340_PARTITION_RELEASE = "1"/);
  assert.match(wrapper,/Restore-Env "FLYTALLY_PR340_PARTITION_RELEASE"/);
  assert.match(wrapper,/verify:release:risk/);
  assert.match(wrapper,/param\(\[switch\]\$BrowserOnly\)/);
  assert.match(wrapper,/if \(\$BrowserOnly\) \{[\s\S]*?npm\.cmd run verify:browser:risk -- --base origin\/main/);
  assert.match(wrapper,/NOT FULL RELEASE PASS/);
  assert.match(wrapper,/PR340 candidate-bound browser risk gate/);
  // Both cheap guards must run before any PostgreSQL cluster is created.
  const preflight=wrapper.indexOf("npm.cmd run test:target -- tests/v380-pr340-owned-pg-release.test.ts");
  const typecheck=wrapper.indexOf("npm.cmd run typecheck");
  const cluster=wrapper.indexOf("Creating isolated PostgreSQL 16 cluster");
  assert.ok(typecheck>=0&&preflight>typecheck&&cluster>preflight,
    "Cheap TypeScript and fixture contracts must run before expensive cluster startup");
  assert.match(wrapper,/Assert-Exit "PR340 fast preflight fixture contracts"/);
});

test("PR340 accepts only independently owned PG16 clusters with exact identity and full strict TAP",()=>{
  const executor=source("pr340-owned-postgres-acceptance.mjs");
  assert.match(executor,/refs\/remotes\/origin\/fix\/3\.8\.0-flights-exact-cost-summary/);
  assert.match(executor,/assert\.deepEqual\(candidate\?\.worktree\?\.files,\[\]/);
  assert.match(executor,/new Set\(observations\.map\(x=>x\.databaseIdentity\)\)\.size,6/);
  assert.match(executor,/if\(part\.id==="real-v20-catalog"\)/);
  assert.match(executor,/bootstrap-pr340-real-v20-local\.mjs/);
  assert.match(executor,/\.stderr\.txt"/);
  assert.match(executor,/assert\.equal\(stderr,""/);
  assert.match(executor,/pg_ctl/);
  assert.match(executor,/stdio:"ignore"/);
  assert.match(executor,/error="\+\(r\.error\?\.code/);
});


test("PR340 optional Quick Add pricing preserves missing currency rather than inventing zero money",()=>{
  const source=readFileSync(new URL("../app/(protected)/database/actions.ts",import.meta.url),"utf8");
  assert.match(source,/initialPrice=initialDecimal===null\?null:Number\(initialDecimal\)/);
  assert.match(source,/\$\{initialPrice\?\?0\},\$\{initialCurrency\?\.code\?\?null\},\$\{initialCurrency\?\.minorUnits\?\?null\},\$\{initialDecimal\}/);
  assert.doesNotMatch(source,/\$\{initialDecimal\?\?["']0["']\}/);
});
test("PR340 Safety Pilot browser seed signs actual persisted v8 row and rejects mismatch",()=>{
  const source=readFileSync(new URL("../e2e/browser-db.mjs",import.meta.url),"utf8");
  const begin=source.indexOf("export function resetSafetyPilotPicInviteFixture()");
  const end=source.indexOf("export function resetE14LegacyTaskFixture()",begin);
  assert.ok(begin>=0&&end>begin);
  const fixture=source.slice(begin,end);
  assert.doesNotMatch(fixture,/browser-sp3-hash/);
  assert.match(fixture,/signCertifiedBrowserFixture\(9903\)/);
  assert.match(source,/signCertifiedBrowserFixture\(9904\)/);
  assert.match(source,/function signCertifiedBrowserFixture\(flightId\)/);
  assert.match(source,/browserFixtureCertification\("sign",unsignedRow\)/);
  assert.match(source,/browserFixtureCertification\("verify",signedRow\)!=="verified"/);
  assert.doesNotMatch(source,/browser-f24-hash/);
  const helper=source.slice(source.indexOf("function signCertifiedBrowserFixture(flightId)"),begin);
  assert.match(helper,/runBrowserFlightFixtureCleanup\(`UPDATE flights SET certification_hash=/);
  const cli=readFileSync(new URL("../tooling/certification-browser-fixture-cli.mjs",import.meta.url),"utf8");
  assert.match(cli,/flightCertificationHash\(row,9001,8\)/);
  assert.match(cli,/verifyFlightCertification\(row,9001\)\.status!=="verified"/);
  assert.match(cli,/FLYTALLY_LOCAL_POSTGRES/);
  assert.match(cli,/\[\[9903,"SAFETY PILOT"\],\[9904,"DUAL"\]\]/);
  assert.doesNotMatch(source,/import \{flightCertificationHash,verifyFlightCertification\} from/);
  assert.match(source,/--experimental-strip-types/);
});

test("PR340 native browser certificate bridge signs, verifies and refuses altered data",()=>{
  const script=fileURLToPath(new URL("../tooling/certification-browser-fixture-cli.mjs",import.meta.url));
  const row={
    id:9903,user_id:9001,certification_version:8,certified_by_user_id:9001,
    certified_at:"2026-10-16T07:00:00.000Z",
    certification_hash:"PENDING_FIXTURE_SIGNATURE",
    date:"2026-09-20",registration:"OK-SP2E",evidence:"EASA",
    aircraft_type:"B23",aircraft_class:"SEP",departure:"LKLT",arrival:"LKPR",
    off_block:"10:00",takeoff:"10:05",landing:"11:05",on_block:"11:12",
    role:"SAFETY PILOT",starts:3,commander:"Browser Friend",landings_day:3,
    movement_evidence_recorded:true,takeoffs_day:3,approaches_day:3,
  };
  const env={...process.env,FLYTALLY_AUTH_BROWSER:"1",FLYTALLY_LOCAL_POSTGRES:"1"};
  const invoke=(mode:string,value:Record<string,unknown>,processEnv=env)=>
    spawnSync(process.execPath,["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",script,mode],{
      input:JSON.stringify(value),encoding:"utf8",env:processEnv,timeout:10000,
    });
  const missingPurpose=invoke("sign",row,{...env,FLYTALLY_AUTH_BROWSER:"0"});
  assert.notEqual(missingPurpose.status,0);
  const signed=invoke("sign",row);
  assert.equal(signed.status,0,signed.stderr);
  assert.match(signed.stdout,/^[0-9a-f]{64}$/);
  const verified=invoke("verify",{...row,certification_hash:signed.stdout});
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(verified.stdout,"verified");
  const tampered=invoke("verify",{...row,registration:"OK-ALTERED",certification_hash:signed.stdout});
  assert.notEqual(tampered.status,0);
  const secondRow={...row,id:9904,role:"DUAL",date:"2026-09-21"};
  const secondSigned=invoke("sign",secondRow);
  assert.equal(secondSigned.status,0,secondSigned.stderr);
  assert.match(secondSigned.stdout,/^[0-9a-f]{64}$/);
  const secondVerified=invoke("verify",{...secondRow,certification_hash:secondSigned.stdout});
  assert.equal(secondVerified.status,0,secondVerified.stderr);
  assert.equal(secondVerified.stdout,"verified");
  assert.notEqual(invoke("verify",{...secondRow,role:"PIC",certification_hash:secondSigned.stdout}).status,0);
  const wrongSource=invoke("sign",{...row,id:9905});
  assert.notEqual(wrongSource.status,0);
});
