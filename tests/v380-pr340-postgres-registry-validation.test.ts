import test from "node:test";
import assert from "node:assert/strict";
import {cpSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {validatePostgresPartitionRegistry} from "../tooling/validate-postgres-partition-registry.mjs";

const root=fileURLToPath(new URL("../",import.meta.url));
const canonicalDirectory=path.join(root,"tests/integration");
const registryFile=path.join(root,"tooling/postgres-partition-registry.json");
const validatorFile=path.join(root,"tooling/validate-postgres-partition-registry.mjs");
const baseline=JSON.parse(readFileSync(registryFile,"utf8"));
const fixture=()=>{const tmp=mkdtempSync(path.join(os.tmpdir(),"flytally-pg-registry-"));
  const dir=path.join(tmp,"integration");
  cpSync(canonicalDirectory,dir,{recursive:true});
  const registryPath=path.join(tmp,"registry.json");
  writeFileSync(registryPath,JSON.stringify(baseline)+"\n");
  return {tmp,dir,registryPath};
};
function rejected(modify:(value:ReturnType<typeof fixture>)=>void){
  const f=fixture();
  try{
    modify(f);
    assert.throws(()=>validatePostgresPartitionRegistry({registryPath:f.registryPath,directory:f.dir}),
      /PARTITION_REGISTRY_DRIFT/);
  }finally{rmSync(f.tmp,{recursive:true,force:true});}
}

test("M1 positive: all 42 actual integration files and 163 declared cases are hash-pinned once",()=>{
  const r=validatePostgresPartitionRegistry();
  assert.equal(r.status,"PASS");
  assert.equal(r.files,42);
  assert.equal(r.tests,163);
  assert.equal(r.partitions,6);
  assert.match(r.registrySha256,/^[a-f0-9]{64}$/);
  assert.match(r.note,/PostgreSQL NOT RUN/);
});
test("M1 validates both LF and CRLF worktrees while still rejecting changed source",()=>{
  const f=fixture();
  try{
    const target=path.join(f.dir,"postgres-aircraft-profile-validation.test.ts");
    const original=readFileSync(target,"utf8");
    const crlf=original.replace(/\r?\n/g,"\r\n");
    writeFileSync(target,crlf);
    const result=validatePostgresPartitionRegistry({registryPath:f.registryPath,directory:f.dir});
    assert.equal(result.status,"PASS","Git for Windows CRLF must not change canonical source hash");
    const originalRegistrySha=result.registrySha256;
    writeFileSync(f.registryPath,readFileSync(f.registryPath,"utf8").replace(/\r?\n/g,"\r\n"));
    assert.equal(validatePostgresPartitionRegistry({
      registryPath:f.registryPath,directory:f.dir
    }).registrySha256,originalRegistrySha,"Registry identity must also be platform-independent");
    writeFileSync(target,crlf+"// altered content\r\n");
    assert.throws(()=>validatePostgresPartitionRegistry({registryPath:f.registryPath,directory:f.dir}),
      /PARTITION_REGISTRY_DRIFT: SHA-256 mismatch/);
  }finally{rmSync(f.tmp,{recursive:true,force:true});}
});
test("M1 fails closed on a bare carriage return and a malformed UTF-8 file",()=>{
  rejected(f=>{
    const file=path.join(f.dir,"postgres-aircraft-profile-validation.test.ts");
    writeFileSync(file,readFileSync(file,"utf8")+"\runexpected");
  });
  rejected(f=>{
    const file=path.join(f.dir,"postgres-aircraft-profile-validation.test.ts");
    writeFileSync(file,Buffer.from([0xc3,0x28]));
  });
});
test("M1 rejects actual test-file content mutation, not just an inventory count difference",()=>{
  rejected(f=>{
    const target=path.join(f.dir,"postgres-pilot-insights.test.ts");
    writeFileSync(target,readFileSync(target,"utf8")+"\n// modified\n");
  });
});
test("M1 rejects a newly added or deleted integration spec even if the registry itself did not change",()=>{
  rejected(f=>writeFileSync(path.join(f.dir,"postgres-new-unreviewed.test.ts"),'test("new",()=>{});\n'));
  rejected(f=>rmSync(path.join(f.dir,"postgres-certification.test.ts")));
});
test("M1 rejects registry hash, test count and totals tampering",()=>{
  for(const mutation of [
    (r:typeof baseline)=>{r.partitions[0].files[0].sha256="0".repeat(64);},
    (r:typeof baseline)=>{r.partitions[0].files[0].expectedTests+=1;},
    (r:typeof baseline)=>{r.expectedTests+=1;},
    (r:typeof baseline)=>{r.expectedFiles+=1;},
  ]){
    rejected(f=>{
      const changed=structuredClone(baseline);
      mutation(changed);
      writeFileSync(f.registryPath,JSON.stringify(changed));
    });
  }
});
test("M1 rejects unapproved partition flags, duplicate suites or moving a protected suite",()=>{
  for(const mutation of [
    (r:typeof baseline)=>{r.partitions[2].purposeFlags.push("FLYTALLY_D3B_FULL_V20_DISPOSABLE");},
    (r:typeof baseline)=>{r.partitions[0].files.push(r.partitions[0].files[0]);},
    (r:typeof baseline)=>{r.partitions[2].files[0].file="postgres-v380-full-v20-restore.test.ts";},
  ]){
    rejected(f=>{
      const changed=structuredClone(baseline);
      mutation(changed);
      writeFileSync(f.registryPath,JSON.stringify(changed));
    });
  }
});
test("M1 cli is read-only source validation; no database flags or connection are required",()=>{
  const result=spawnSync(process.execPath,[validatorFile],{encoding:"utf8",timeout:10000,
    env:{...process.env,DATABASE_URL:"",FLYTALLY_POSTGRES_INTEGRATION:""}});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/postgres_registry_status=PASS/);
  assert.match(result.stdout,/files=42 tests=163 partitions=6/);
  assert.match(result.stdout,/postgres_execution=NOT RUN/);
});
test("M1 registry files and validator are included in release configuration hash inputs",()=>{
  const cfg=readFileSync(path.join(root,"tooling/verification-identity.mjs"),"utf8");
  assert.match(cfg,/tooling\/postgres-partition-registry\.json/);
  assert.match(cfg,/tooling\/validate-postgres-partition-registry\.mjs/);
  const manifest=JSON.parse(readFileSync(path.join(root,"tooling/development-modules.json"),"utf8"));
  assert.ok(manifest.testGroups["development-pipeline"].tests.includes(
    "tests/v380-pr340-postgres-registry-validation.test.ts"));
});
