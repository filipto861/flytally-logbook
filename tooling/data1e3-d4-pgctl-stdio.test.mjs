// Windows process-pipe regression only. Spawns no PostgreSQL, no DB and does not open SQL.
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
const self=fileURLToPath(import.meta.url);
const mode=process.argv[2]??"";
if(mode==="hold-pipe"){
  // Simulate the long-lived postgres.exe inheriting pg_ctl's standard streams.
  setTimeout(()=>process.exit(0),3900);
}else if(mode==="mock-pg-ctl"){
  const child=spawn(process.execPath,[self,"hold-pipe"],{
    stdio:["ignore","inherit","inherit"],windowsHide:true,detached:true});
  child.unref(); // mock short-lived pg_ctl exits while its child still holds stdout/stderr
}else{
  test("DATA-1E3 D4 pg_ctl start and stop never inherit pipe capture from Node spawnSync",()=>{
    const src=readFileSync(path.join(path.dirname(self),"data1e3-d4-owned-local-pg16.mjs"),"utf8");
    assert.match(src,/"-w","-t","45","start"\],\{env,timeout:90000,stdio:"ignore"\}/);
    assert.match(src,/"-w","-t","45","stop"\],\s*\{env,timeout:90000,stdio:"ignore"\}/);
    assert.match(src,/!status\.error&&!status\.signal&&status\.status!==null&&status\.status!==0/);
    assert.match(src,/D4_CLEANUP_BLOCKED/);
  });
  test("Windows pg_ctl mock: inherited pipe causes ETIMEDOUT after exit 0; ignored streams return promptly",()=>{
    if(process.platform!=="win32")return;
    const args=[self,"mock-pg-ctl"];
    const pipes=spawnSync(process.execPath,args,{
      encoding:"utf8",windowsHide:true,shell:false,timeout:1700,stdio:"pipe"});
    assert.equal(pipes.status,0,"mock pg_ctl itself should have exited normally");
    assert.equal(pipes.error?.code,"ETIMEDOUT",
      "held-inherited stdout should reproduce the original status 0 + ETIMEDOUT");
    const fixed=spawnSync(process.execPath,args,{
      encoding:"utf8",windowsHide:true,shell:false,timeout:1700,stdio:"ignore"});
    assert.equal(fixed.error,undefined,"ignored streams must avoid inherited-pipe timeout");
    assert.equal(fixed.status,0,"mock pg_ctl should exit successfully with ignored stdio");
  });
}
