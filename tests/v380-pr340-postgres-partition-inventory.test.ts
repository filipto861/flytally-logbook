import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";
import {test} from "node:test";

const integration=new URL("./integration/",import.meta.url);
const root=new URL("../",import.meta.url);
const source=(p:string)=>readFileSync(new URL(p,root),"utf8");

// REVIEW INVENTORY ONLY. This does NOT partition, run, N/A or approve PostgreSQL
// tests. It must not be used as an acceptance-evidence substitute.
// Changing these preexisting opt-in suites requires re-review of fixture ownership.
const purposeBound=[
  {file:"postgres-currency-v21-release.test.ts",count:5,flag:"FLYTALLY_V21_RELEASE_DISPOSABLE"},
  {file:"postgres-v380-d3b-migrations-v1-v20-trash.test.ts",count:19,flag:"FLYTALLY_D3B_MIGRATIONS_PG16_DISPOSABLE"},
  {file:"postgres-v380-d3b-real-trash-races.test.ts",count:6,flag:"FLYTALLY_D3B_TARGETED_PG16_DISPOSABLE"},
  {file:"v380-d3b-full-v20-catalog.test.ts",count:1,flag:"FLYTALLY_D3B_FULL_V20_DISPOSABLE"},
  {file:"v380-d3b-zero-delete-counterexample.test.ts",count:1,flag:"FLYTALLY_D3B_FULL_V20_DISPOSABLE"},
] as const;

test("PR340 PostgreSQL design inventory locks all 32 explicitly opt-in tests without marking any as passed",()=>{
  const actual=new Set(readdirSync(integration).filter(name=>name.endsWith(".test.ts")));
  let counted=0;
  for(const {file,count,flag} of purposeBound){
    assert.ok(actual.has(file),"Missing dedicated PostgreSQL suite: "+file);
    const body=readFileSync(new URL(file,integration),"utf8");
    const declared=[...body.matchAll(/(?:^|\n)\s*test\("/g)].length;
    assert.equal(declared,count,file+" must be reconciled when tests change");
    assert.ok(body.includes("process.env."+flag),"Purpose must remain explicit in "+file);
    assert.match(body,/skip:\s*!enabled|skip:\s*process\.env\./,"Skip guard must remain visible in "+file);
    counted+=declared;
  }
  assert.equal(counted,32,"All independently gated scenarios must remain visible to planning");
});

test("PR340 shared PostgreSQL gate still treats raw skips as incomplete evidence",()=>{
  const pg=source("tooling/verify-postgres.mjs");
  const selector=source("tooling/run-postgres-tests.mjs");
  const evidence=source("tooling/evidence-contract.mjs");
  assert.match(pg,/selectPostgresTests\("full"\)/);
  assert.match(selector,/if \(mode === "full"\) return true/);
  assert.match(evidence,/if \(skipped > 0\) return \{ status: "PARTIAL"/);
  // No execution or status override is authorized by this inventory test.
});
