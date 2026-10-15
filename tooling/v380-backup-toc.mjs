import {spawn} from "node:child_process";
import {decryptArchive} from "./v380-backup-archive.mjs";

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
  const lines=output.split(/\r?\n/);
  const tableCount=lines.filter(line=>/^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+\S+\s+\S+\s+\S+/.test(line)).length;
  const extensions=lines.flatMap(line=>{
    const x=line.match(/^\s*\d+;\s+\d+\s+\d+\s+EXTENSION\s+-\s+(\S+)\s+\S+\s*$/);
    return x?[x[1]]:[];
  });
  if(!output.includes("Format: CUSTOM")||tableCount===0)
    throw new Error("pg_restore --list did not identify PostgreSQL custom-format tables.");
  return {tableCount,extensions:[...new Set(extensions)].sort()};
}
