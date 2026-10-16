import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  parseStrictPartitionTap,aggregatePartitionTapEvidence,
  type PartitionEvidenceObservation,
} from "../tooling/postgres-partition-tap.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const registry=JSON.parse(readFileSync(path.join(root,"tooling/postgres-partition-registry.json"),"utf8"));
const identity={
  candidateId:"1".repeat(64),headSha:"2".repeat(40),
  configHash:"3".repeat(64),toolchainHash:"4".repeat(64),registrySha256:"5".repeat(64),
};
function syntheticTap(tests:number,extra={} as Record<string,number>){
  const lines=["TAP version 13"];
  for(let i=1;i<=tests;i++){
    lines.push("# Subtest: case-"+i,"ok "+i+" - case-"+i,
      "  ---","  duration_ms: 0.5","  type: 'test'","  ...");
  }
  lines.push("1.."+tests,
    "# tests "+tests,
    "# suites "+(extra.suites??0),
    "# pass "+(extra.pass??tests),
    "# fail "+(extra.fail??0),
    "# cancelled "+(extra.cancelled??0),
    "# skipped "+(extra.skipped??0),
    "# todo "+(extra.todo??0),
    "# duration_ms 5.2","");
  return lines.join("\n");
}
function observation(partition:{id:string;expectedTests:number},i:number):PartitionEvidenceObservation{
  return {
    ...identity,partitionId:partition.id,command:"node --test --test-reporter=tap --experimental-strip-types "+
      partition.id+".test.ts",
    databaseIdentity:"flytally_currency_test|flytally|127.0.0.1|"+(46000+i)+"|160009",
    exitCode:0,stderr:"",stdout:syntheticTap(partition.expectedTests),
  };
}
function collect():PartitionEvidenceObservation[]{
  return registry.partitions.map((p:{id:string;expectedTests:number},i:number)=>observation(p,i));
}
function rejected(override:(all:PartitionEvidenceObservation[])=>PartitionEvidenceObservation[]){
  assert.throws(()=>aggregatePartitionTapEvidence({registry,...identity,observations:override(collect())}),
    /PARTITION_TAP_INVALID/);
}

test("M2 strict TAP counts typed assertions, never trusts a bare summary",()=>{
  const out=syntheticTap(3);
  const parsed=parseStrictPartitionTap(out,{expectedTests:3});
  assert.equal(parsed.planned,3);
  assert.equal(parsed.passed,3);
  assert.equal(parsed.rootAssertions,3);
  assert.match(parsed.tapSha256,/^[0-9a-f]{64}$/);
  assert.throws(()=>parseStrictPartitionTap(out.slice(out.indexOf("1..3")),{expectedTests:3}),
    /PARTITION_TAP_INVALID/);
});

test("M2 rejects incomplete, duplicated, malformed or contradictory TAP",()=>{
  const good=syntheticTap(3);
  const inputs=[
    good.replace("TAP version 13","TAP version 12"),
    good.replace("1..3\n",""),
    good.replace("1..3\n","1..2\n"),
    good.replace("# tests 3\n","# tests 2\n"),
    good.replace("# pass 3\n","# pass 2\n"),
    good.replace("# fail 0\n","# fail 1\n"),
    good.replace("# skipped 0\n","# skipped 1\n"),
    good.replace("# cancelled 0\n","# cancelled 1\n"),
    good.replace("# todo 0\n","# todo 1\n"),
    good.replace("# pass 3\n","# pass 3\n# pass 3\n"),
    good.replace("type: 'test'","type: 'suite'"),
    good.replace("ok 2 - case-2","ok 1 - case-2"),
    good.replace("ok 1 - case-1","not ok 1 - case-1"),
    good.replace("ok 1 - case-1","ok 1 - case-1 # SKIP"),
    good.replace("ok 1 - case-1","ok 1 - case-1 # TODO"),
    good.replace("# duration_ms 5.2\n","# duration_ms 5.2\npartial output\n"),
    good.replace("# duration_ms 5.2\n",""),
    good.replace("TAP version 13\n","TAP version 13\n# tests 3\n"),
    good.replace("1..3\n","1..3\n1..3\n"),
  ];
  for(const [i,input] of inputs.entries()){
    assert.throws(()=>parseStrictPartitionTap(input,{expectedTests:3}),
      /PARTITION_TAP_INVALID/,"Rejected synthetic TAP mismatch "+i);
  }
  assert.throws(()=>parseStrictPartitionTap(good,{expectedTests:4}),/PARTITION_TAP_INVALID/);
});

test("M2 accepts real Node test runner TAP, including nested suites without double counting",()=>{
  const dir=mkdtempSync(path.join(tmpdir(),"flytally-m2-tap-"));
  try{
    const spec=path.join(dir,"real-tap.test.mjs");
    writeFileSync(spec,[
      "import {describe,it} from 'node:test';",
      "describe('group',()=>{it('one',()=>{});it('two',()=>{});});",
      "it('top-level',()=>{});",
    ].join("\n"));
    const result=spawnSync(process.execPath,["--test","--test-reporter=tap",spec],
      {encoding:"utf8",timeout:15000,env:{...process.env,DATABASE_URL:""}});
    assert.equal(result.status,0,result.stderr);
    const parsed=parseStrictPartitionTap(result.stdout,{expectedTests:3});
    assert.equal(parsed.passed,3);
    assert.equal(parsed.suites,1);
    assert.equal(parsed.rootAssertions,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("M2 real Node TAP TODO and SKIP cases remain disallowed, even if process exits zero",()=>{
  const dir=mkdtempSync(path.join(tmpdir(),"flytally-m2-tap-neg-"));
  try{
    const spec=path.join(dir,"cases.test.mjs");
    writeFileSync(spec,[
      "import test from 'node:test';",
      "test('yes',()=>{});test.todo('later');test.skip('skipped');",
    ].join("\n"));
    const result=spawnSync(process.execPath,["--test","--test-reporter=tap",spec],
      {encoding:"utf8",timeout:15000});
    assert.equal(result.status,0,result.stderr);
    assert.throws(()=>parseStrictPartitionTap(result.stdout,{expectedTests:3}),
      /PARTITION_TAP_INVALID/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test("M2 six-partition aggregate validates exact candidate and never grants release PASS",()=>{
  const summary=aggregatePartitionTapEvidence({registry,...identity,observations:collect()});
  assert.equal(summary.planned,163);
  assert.equal(summary.passed,163);
  assert.equal(summary.partitions.length,6);
  assert.equal(summary.status,"VALIDATED-ONLY");
  assert.equal(summary.releaseEvidence,"NOT RUN");
});

test("M2 aggregate rejects wrong SHA/config/toolchain/registry and incomplete/duplicate partitions",()=>{
  rejected(all=>all.slice(1));
  rejected(all=>[all[0],all[0],...all.slice(2)]);
  rejected(all=>all.map((x,i)=>i===0?{...x,partitionId:"nonexistent"}:x));
  for(const key of ["candidateId","headSha","configHash","toolchainHash","registrySha256"] as const){
    rejected(all=>all.map((x,i)=>i===0?{...x,[key]:"f".repeat(key==="headSha"?40:64)}:x));
  }
});
test("M2 aggregate rejects tampered commands, subprocess errors and reused/cross-target databases",()=>{
  rejected(all=>all.map((x,i)=>i===0?{...x,exitCode:1}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,stderr:"PostgreSQL ERROR"}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,command:"node something.js"}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,databaseIdentity:"neon-prod"}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,databaseIdentity:all[1].databaseIdentity}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,databaseIdentity:"flytally_currency_test|flytally|127.0.0.1|5432|160009"}:x));
  rejected(all=>all.map((x,i)=>i===0?{...x,stdout:syntheticTap(x.partitionId==="shared-core"?122:1)}:x));
});

test("M2 cannot replace canonical PG gate or create ledger evidence yet",()=>{
  const runner=readFileSync(path.join(root,"tooling/verify-postgres.mjs"),"utf8");
  const parser=readFileSync(path.join(root,"tooling/postgres-partition-tap.mjs"),"utf8");
  assert.match(runner,/runNodeTests\(tests/);
  assert.doesNotMatch(runner,/aggregatePartitionTapEvidence/);
  assert.doesNotMatch(parser,/writeVerificationLedgerEntry|DATABASE_URL|spawnSync|postgresVerificationConfiguration/);
  const identitySource=readFileSync(path.join(root,"tooling/verification-identity.mjs"),"utf8");
  assert.match(identitySource,/tooling\/postgres-partition-tap\.mjs/);
  assert.match(identitySource,/tooling\/postgres-partition-tap\.d\.mts/);
});
