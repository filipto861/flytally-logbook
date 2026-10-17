#!/usr/bin/env node
/**
 * I2-B1 Windows read-only inventory CLI. Never touches a database/cluster.
 * Strict argument gate. Neither this CLI nor its PowerShell child can mutate
 * a server, create directories or grant runtime/cleanup authorization.
 */
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,join,win32} from "node:path";
import {ambientConnectionOverrides} from "./native-pg16-guards.mjs";
import {evaluateReadOnlyInventory} from "./native-pg16-i2b1-inventory.mjs";

function fail(reason){
  process.stderr.write("I2-B1 read-only inventory unavailable: "+reason+". RLS NOT RUN.\n");
  process.exitCode=1;
}
if(process.argv.length!==3||process.argv[2]!=="--read-only-inventory"){
  fail("unsupported arguments");
}else if(process.platform!=="win32"){
  fail("Windows required");
}else if(ambientConnectionOverrides(process.env).length){
  fail("ambient connection overrides");
}else{
  const root=process.env.SystemRoot;
  if(typeof root!=="string"||!win32.isAbsolute(root)||root.startsWith("\\\\")){
    fail("Windows system root unavailable");
  }else{
    const exe=win32.join(root,"System32","WindowsPowerShell","v1.0","powershell.exe");
    const script=join(dirname(fileURLToPath(import.meta.url)),"read-native-pg16-i2b1-inventory.ps1");
    const env={SystemRoot:root,WINDIR:root,USERPROFILE:process.env.USERPROFILE,
      APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,
      TEMP:process.env.TEMP,PATH:process.env.PATH};
    const result=spawnSync(exe,[
      "-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass",
      "-File",script,"-InventoryOnly"
    ],{encoding:"utf8",windowsHide:true,shell:false,timeout:20000,maxBuffer:65536,env});
    if(result.error||result.status!==0||!result.stdout){
      fail("host probe rejected");
    }else{
      let observation;
      try{observation=JSON.parse(result.stdout.trim());}
      catch{observation=null;}
      const decision=evaluateReadOnlyInventory(observation,{});
      if(!decision.accepted){
        fail(decision.reason);
      }else{
        process.stdout.write("I2-B1: READ-ONLY HOST INVENTORY OBSERVED (not attested for native runtime).\n");
        process.stdout.write("Windows token / installed PG16 versions / service statuses / path signals: syntax checked.\n");
        process.stdout.write("ACL trust, cluster identity, process owner and teardown: NOT ATTESTED.\n");
        process.stdout.write("PostgreSQL SQL / RLS: NOT RUN. Runtime permission: DENIED.\n");
      }
    }
  }
}
