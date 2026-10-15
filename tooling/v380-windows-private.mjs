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
  const identity=id.trim().match(/"([^"\r\n]+)"\s*,\s*"(S-1-\d+(?:-\d+)+)"/);
  if(!identity)throw new Error("Cannot determine current Windows account SID.");
  const account=identity[1],sid=identity[2];
  command("icacls.exe",[dir,"/inheritance:r","/grant:r",
    "*"+sid+":(OI)(CI)F","/grant:r","*S-1-5-18:(OI)(CI)F"]);
  const audit=command("icacls.exe",[dir]);
  // icacls usually resolves a numeric SID back to DOMAIN\\username in its
  // display; do not falsely reject correctly restricted NTFS directories.
  if(!audit.includes(sid)&&!audit.toLowerCase().includes(account.toLowerCase()))
    throw new Error("Cannot verify owner-only private directory NTFS ACL.");
  command("icacls.exe",[dir,"/verify"]);
  return sid;
}
export async function createEphemeralPwfile(dir,password){
  if(typeof password!=="string"||password.length<32||/[\r\n]/.test(password))
    throw new Error("Invalid ephemeral PostgreSQL password.");
  const path=join(dir,"pg18-bootstrap-secret.pw");
  await fs.writeFile(path,password+"\n",{encoding:"utf8",flag:"wx",mode:0o600});
  return path;
}
