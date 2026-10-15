import {spawnSync} from "node:child_process";
import {promises as fs} from "node:fs";
import {join} from "node:path";

function command(program,args){
  const r=spawnSync(program,args,{encoding:"utf8",timeout:20000,windowsHide:true,
    stdio:["ignore","pipe","pipe"]});
  if(r.error||r.status!==0)throw new Error("Windows private-directory ACL command failed: "+program);
  return String(r.stdout||"");
}
export function restrictWindowsDirectory(dir){
  if(process.platform!=="win32")throw new Error("Real-data PG18 restore requires Windows ACL enforcement.");
  // SID avoids localized usernames, spaces and non-ASCII account names.
  const id=command("whoami.exe",["/user","/fo","csv","/nh"]);
  const sid=id.match(/S-1-\d+(?:-\d+)+/)?.[0];
  if(!sid)throw new Error("Cannot determine current Windows account SID.");
  command("icacls.exe",[dir,"/inheritance:r","/grant:r",
    "*"+sid+":(OI)(CI)F","/grant:r","*S-1-5-18:(OI)(CI)F"]);
  const audit=command("icacls.exe",[dir]);
  if(!audit.includes(sid))throw new Error("Cannot verify private directory NTFS ACL.");
  return sid;
}
export async function createEphemeralPwfile(dir,password){
  if(typeof password!=="string"||password.length<32||/[\r\n]/.test(password))
    throw new Error("Invalid ephemeral PostgreSQL password.");
  const path=join(dir,"pg18-bootstrap-secret.pw");
  await fs.writeFile(path,password+"\n",{encoding:"utf8",flag:"wx",mode:0o600});
  return path;
}
