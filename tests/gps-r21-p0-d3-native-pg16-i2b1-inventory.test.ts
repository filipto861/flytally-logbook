import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {
  validateReadOnlyWindowsInventory,evaluateReadOnlyInventory
} from "../research/gps-r21-p0-d3-synthetic-security/native-pg16-i2b1-inventory.mjs";
import {validateOfflineWindowsEvidence}
  from "../research/gps-r21-p0-d3-synthetic-security/native-pg16-i2-offline.mjs";

const binaries=["initdb","pg_ctl","psql","postgres","pg_controldata"];
const version=Object.fromEntries(binaries.map(n=>[n,n+" (PostgreSQL) 16.15"]));
const signal=()=>({exists:true,reparsePoint:false,aclReadable:true,aclTrusted:false});
const good=()=>({
  format:"flytally-i2b1-windows-inventory-v1",platform:"win32",
  readOnly:true,runtimeAuthorization:false,permitsClusterMutation:false,
  effectiveToken:{elevated:false,source:"WindowsPrincipal.IsInRole",identityAttested:false},
  binVersions:{...version},
  serviceStatus:{"postgresql-x64-16":"Running","postgresql-x64-18":"Running"},
  pathObservations:{userProfile:signal(),appData:signal(),localAppData:signal(),
    candidateRoot:{exists:false,reparsePoint:null,aclReadable:false,aclTrusted:false}}
});
test("I2-B1: read-only valid host inventory is not runtime attestation",()=>{
  const v=good();
  assert.equal(validateReadOnlyWindowsInventory(v),true);
  assert.deepEqual(evaluateReadOnlyInventory(v),{
    accepted:true,reason:"read-only-inventory-only",permitsRuntime:false
  });
  assert.equal(validateOfflineWindowsEvidence(v).ok,false);
});
test("I2-B1: reject elevated, reparse and environment override signals",()=>{
  const elevated=good();elevated.effectiveToken.elevated=true;
  assert.deepEqual(evaluateReadOnlyInventory(elevated),{
    accepted:false,reason:"elevated-process",permitsRuntime:false
  });
  const reparse=good();reparse.pathObservations.localAppData.reparsePoint=true;
  assert.equal(evaluateReadOnlyInventory(reparse).accepted,false);
  assert.equal(evaluateReadOnlyInventory(good(),{PGHOST:"localhost"}).accepted,false);
});
test("I2-B1: refuse fabricated trust, privileges, versions and service inventory",()=>{
  const mutations:((x:any)=>void)[]=[
    x=>x.runtimeAuthorization=true,
    x=>x.permitsClusterMutation=true,
    x=>x.effectiveToken.identityAttested=true,
    x=>x.effectiveToken.source="self-report",
    x=>x.binVersions.postgres="postgres (PostgreSQL) 18.1",
    x=>delete x.binVersions.psql,
    x=>x.serviceStatus["postgresql-x64-16"]="Unknown",
    x=>delete x.serviceStatus["postgresql-x64-18"],
    x=>x.pathObservations.userProfile.aclTrusted=true,
    x=>x.pathObservations.candidateRoot.aclReadable=true,
    x=>x.pathObservations.appData.reparsePoint=null,
    x=>x.platform="linux"
  ];
  for(const mutate of mutations){
    const x:any=structuredClone(good());mutate(x);
    assert.equal(validateReadOnlyWindowsInventory(x),false);
  }
});
test("I2-B1: strictly no filesystem or server mutations in PowerShell probe source",()=>{
  const path=join(process.cwd(),"research","gps-r21-p0-d3-synthetic-security",
    "read-native-pg16-i2b1-inventory.ps1");
  const src=readFileSync(path,"utf8");
  assert.ok([...src].every(c=>c.codePointAt(0)!>0&&c.codePointAt(0)!<128));
  assert.match(src,/InventoryOnly/);
  assert.match(src,/Get-Acl/);
  assert.match(src,/Get-Service/);
  assert.match(src,/WindowsPrincipal/);
  assert.match(src,/--version/);
  assert.doesNotMatch(src,/^\s*(?:Start-Service|Stop-Service|Remove-Item|New-Item|Set-Acl|Set-Content|Out-File|psql|initdb|pg_ctl|taskkill)\b/im);
});
test("I2-B1: unsupported CLI modes always refuse before Windows/PG probing",()=>{
  const entry=join(process.cwd(),"research","gps-r21-p0-d3-synthetic-security",
    "run-native-pg16-i2b1-inventory.mjs");
  for(const args of [[],["--synthetic-only"],["--run"],["--stop"],["--delete"],["--read-only-inventory","--run"]]){
    const run=spawnSync(process.execPath,[entry,...args],{
      encoding:"utf8",timeout:4000,env:{...process.env}
    });
    assert.notEqual(run.status,0,JSON.stringify(args));
    assert.match(run.stderr,/RLS NOT RUN/);
    assert.doesNotMatch(run.stdout,/OBSERVED/);
  }
});
