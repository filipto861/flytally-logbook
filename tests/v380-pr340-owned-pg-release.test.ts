import test from "node:test";
import assert from "node:assert/strict";
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
});
