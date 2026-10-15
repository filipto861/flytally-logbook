import {spawn} from "node:child_process";
import {decryptArchive} from "./v380-backup-archive.mjs";

// Pure parser for PostgreSQL 18 pg_restore --list output. IMPORTANT:
// "TABLE" is a schema object, "TABLE DATA" is its row payload, and
// "TABLE ATTACH" is partition attachment metadata. Counting entries with a
// prefix-only /TABLE\\s/ regex double-counts ordinary tables and creates
// false preflight failures. Fail closed for malformed TABLE entries.
export function parsePgRestoreTocOutput(output){
  if(typeof output!=="string"||
     !/^;\\s+Format:\\s+CUSTOM\\s*$/m.test(output)){
    throw new Error("pg_restore --list did not identify a CUSTOM format archive.");
  }
  let tableCount=0,tableDataCount=0;
  const extensions=new Set();
  for(const line of output.split(/\\r?\\n/)){
    const match=line.match(/^\\s*\\d+;\\s+\\d+\\s+\\d+\\s+(.+?)\\s*$/);
    if(!match)continue; // comments, archive header and other diagnostics
    const entry=match[1];
    if(/^TABLE DATA(?:\\s|$)/.test(entry)){
      tableDataCount++;
      continue;
    }
    if(/^TABLE ATTACH(?:\\s|$)/.test(entry))continue;
    if(/^TABLE(?:\\s|$)/.test(entry)){
      // At least schema, table name and owner must be present. Names may
      // contain spaces, so do not split solely by a fixed token count.
      if(!/^TABLE\\s+\\S+\\s+.+\\s+\\S+$/.test(entry))
        throw new Error("Malformed TABLE entry in authenticated archive TOC.");
      tableCount++;
      continue;
    }
    if(/^EXTENSION(?:\\s|$)/.test(entry)){
      const ext=entry.match(/^EXTENSION\\s+-\\s+(\\S+)\\s+\\S+$/);
      if(!ext)throw new Error("Malformed EXTENSION entry in authenticated archive TOC.");
      extensions.add(ext[1]);
    }
  }
  if(tableCount===0)throw new Error("pg_restore --list did not identify any TABLE definitions.");
  return {tableCount,tableDataCount,extensions:[...extensions].sort()};
}

// TOC inspection executes pg_restore --list WITHOUT a database connection.
// The authenticated archive is streamed into stdin; never written unencrypted
// to disk. This does not guarantee source DB/extension parity by itself.
export async function inspectPgRestoreToc(archive,password,pgRestorePath){
  const p=spawn(pgRestorePath,["--list"],{
    stdio:["pipe","pipe","pipe"],windowsHide:true,
    env:Object.fromEntries(Object.entries(process.env).filter(([key])=>
      !key.toUpperCase().startsWith("PG")&&key.toUpperCase()!=="DATABASE_URL"))
  });
  let output="",stderr="",overLimit=false;
  const MAX=3*1024*1024;
  p.stdout.on("data",bytes=>{
    if(overLimit)return;
    output+=bytes.toString("utf8");
    if(output.length>MAX){overLimit=true;p.kill();}
  });
  p.stderr.on("data",bytes=>{stderr=(stderr+bytes.toString("utf8")).slice(-900);});
  const exit=new Promise((resolve,reject)=>{
    p.once("error",reject);
    p.once("close",resolve);
  });
  try{
    await decryptArchive(archive,p.stdin,password);
    const code=await exit;
    if(overLimit||code!==0)throw new Error("pg_restore --list failed/too large: "+stderr.slice(-500));
  }catch(error){
    if(p.exitCode===null)p.kill();
    await exit.catch(()=>{});
    throw error;
  }
  return parsePgRestoreTocOutput(output);
}
