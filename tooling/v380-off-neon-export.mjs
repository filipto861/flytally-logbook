import {spawn,spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {existsSync,promises as fs} from "node:fs";
import {join,resolve,relative,sep} from "node:path";
import {encryptArchive,retainChildStdout} from "./v380-backup-archive.mjs";
import {sealManifest} from "./v380-backup-manifest.mjs";
import {restrictWindowsDirectory} from "./v380-windows-private.mjs";

// Explicit owner-local off-Neon export; no production writes or raw dump files.
// Only the current canonical direct production endpoint is accepted.
const HOST="ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech";
const DB="neondb";
const bin=join(process.env.ProgramFiles||"C:\\Program Files","PostgreSQL","18","bin");
const exe=name=>join(bin,name+".exe");
const fail=(message)=>{throw new Error(message);};
const must=(ok,message)=>{if(!ok)fail(message);};

function tool(name){
  must(existsSync(exe(name)),"PostgreSQL 18 "+name+" not installed. Check C:\\Program Files\\PostgreSQL\\18\\bin.");
  const p=spawnSync(exe(name),["--version"],{encoding:"utf8",timeout:10000});
  must(!p.error&&p.status===0&&/\b18\.\d+\b/.test(String(p.stdout||"")),"PostgreSQL 18 "+name+" required.");
  return exe(name);
}
function hidden(question){
  must(process.stdin.isTTY&&typeof process.stdin.setRawMode==="function","Interactive PowerShell terminal required.");
  return new Promise((resolveValue,reject)=>{
    let value="";
    process.stdout.write(question);
    process.stdin.setRawMode(true);process.stdin.resume();
    const end=err=>{
      process.stdin.off("data",onData);process.stdin.setRawMode(false);
      process.stdin.pause();process.stdout.write("\n");
      if(err)reject(err);else resolveValue(value);
    };
    const onData=buffer=>{
      for(const c of buffer.toString("utf8")){
        if(c==="\r"||c==="\n"){end();return;}
        if(c==="\u0003"){end(new Error("Cancelled."));return;}
        if(c==="\b"||c==="\u007f"){value=value.slice(0,-1);continue;}
        if(c>=" "){value+=c;}
        if(value.length>10000){end(new Error("Unexpectedly long input."));return;}
      }
    };
    process.stdin.on("data",onData);
  });
}
function sourceEnvironment(raw){
  let u;try{u=new URL(raw);}catch{fail("Invalid Neon connection URL.");}
  must(["postgresql:","postgres:"].includes(u.protocol)&&u.hostname===HOST,
    "Wrong endpoint. Only approved direct Neon production host is allowed.");
  must(u.pathname==="/"+DB&&(!u.port||u.port==="5432"),"Wrong database or port.");
  must(u.username.length>0&&u.password.length>0&&!u.hash,"Invalid source credentials.");
  for(const [k,v] of u.searchParams){
    must(["sslmode","channel_binding"].includes(k),"Unexpected URL parameter.");
    if(k==="sslmode")must(v==="require"||v==="verify-full","Unsafe SSL mode.");
    if(k==="channel_binding")must(v==="require","Unexpected channel binding.");
  }
  // Never inherit libpq connection overrides (especially PGHOSTADDR,
  // PGSERVICE/PGSERVICEFILE and PGPASSFILE) from the operator's shell.
  // PGHOSTADDR could silently route the dump to the wrong server even when
  // the visible PGHOST/URL has the intended hostname.
  const safeEnv=Object.fromEntries(Object.entries(process.env)
    .filter(([name])=>!name.toUpperCase().startsWith("PG")&&name.toUpperCase()!=="DATABASE_URL"));
  return {...safeEnv,
    PGHOST:HOST,PGPORT:"5432",PGDATABASE:DB,PGUSER:decodeURIComponent(u.username),
    PGPASSWORD:decodeURIComponent(u.password),PGSSLMODE:"verify-full",
    PGSSLROOTCERT:"system",PGCHANNELBINDING:"require",
    PGCONNECT_TIMEOUT:"10",PGTZ:"UTC",PGOPTIONS:"-c TimeZone=UTC -c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=5000"};
}
function preflight(env){
  const q="SELECT current_database()||'|'||current_setting('server_version_num')||'|'"+
    "(SELECT COUNT(*) FROM pg_stat_ssl WHERE pid=pg_backend_pid() AND ssl)||'|'"+
    "(SELECT COUNT(*) FROM public.flytally_schema_migrations)||'|'"+
    "(SELECT MIN(version) FROM public.flytally_schema_migrations)||'|'"+
    "(SELECT MAX(version) FROM public.flytally_schema_migrations)||'|'"+
    "(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND column_name IN "+
    "('currency_code','currency_minor_units','price_per_hour_decimal','dry_price_per_hour_decimal',"+
    "'default_price_currency_code','default_price_currency_minor_units','default_price_per_hour_decimal',"+
    "'price_currency_code','price_currency_minor_units','amount_encoding','amount_minor_units'))||'|'"+
    "(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')||'|'"+
    "(SELECT COUNT(*) FROM public.flights)||'|'"+
    "(SELECT COUNT(*) FROM public.aircraft)||'|'"+
    "(SELECT COUNT(*) FROM public.rates)||'|'"+
    "(SELECT COUNT(*) FROM public.account_backups)||'|'"+
    "(SELECT COUNT(*) FROM public.voided_certified_flights)||'|'"+
    "(SELECT COUNT(*) FROM public.flight_source_provenance)||'|'"+
    "(SELECT md5(COALESCE(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.voided_certified_flights x)||'|'"+
    "(SELECT md5(COALESCE(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM public.flight_source_provenance x)";
  const r=spawnSync(exe("psql"),["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",q],
    {env,encoding:"utf8",timeout:45000});
  must(!r.error&&r.status===0,"Source preflight connection/query failed. Nothing exported.");
  const parts=String(r.stdout||"").trim().split("|");
  must(parts.length===16&&parts[0]===DB&&Number(parts[1])>=180000&&Number(parts[1])<190000&&
    parts[2]==="1"&&parts[3]==="20"&&parts[4]==="1"&&parts[5]==="20"&&
    parts[6]==="0"&&Number(parts[7])>=50,
    "Unexpected production schema/SSL/version. Refusing backup.");
  for(let i=8;i<=13;i++)must(Number.isSafeInteger(Number(parts[i]))&&Number(parts[i])>=0,
    "Invalid protected data count in backup preflight.");
  for(const i of [14,15])must(/^[0-9a-f]{32}$/.test(parts[i]),
    "Missing protected history digest in backup preflight.");
  return {db:DB,pg_version:parts[1],ssl_verified:true,migrations:20,
    v21_columns:0,public_tables:Number(parts[7]),flights:Number(parts[8]),
    aircraft:Number(parts[9]),rates:Number(parts[10]),account_backups:Number(parts[11]),
    voided:Number(parts[12]),provenance:Number(parts[13]),
    voided_digest:parts[14],provenance_digest:parts[15]};
}
async function main(){
  must(process.platform==="win32"&&process.versions.node.split(".")[0]==="24",
    "Windows PowerShell and Node 24 are required.");
  // Prerequisite gate covers both export AND later isolated PG18 restore.
  for(const name of ["pg_dump","psql","pg_restore","initdb","pg_ctl","createdb"])tool(name);
  if(process.argv[2]==="check"){console.log("PG18 clients found. Backup NOT RUN.");return;}
  must(process.argv[2]==="export"&&process.argv.length===3,
    "Usage: node tooling/v380-off-neon-export.mjs check|export");
  const url=await hidden("Paste DIRECT Neon production connection URL (hidden): ");
  const env=sourceEnvironment(url),schema=preflight(env);
  console.log("READ-ONLY source identity / TLS / v20 schema verified.");
  const password=await hidden("Create archive passphrase (minimum 16 characters, hidden): ");
  const confirm=await hidden("Repeat archive passphrase (hidden): ");
  must(password.length>=16&&password===confirm,"Encryption passphrase confirmation failed.");
  must(process.env.LOCALAPPDATA,"Windows LOCALAPPDATA is required.");
  const output=resolve(process.env.LOCALAPPDATA,"FlyTally","PrivateProductionBackups");
  const relation=relative(process.cwd(),output);
  must(relation===".."||relation.startsWith(".."+sep),"Archive must be outside repo.");
  await fs.mkdir(output,{recursive:true});
  // Encrypted archive metadata still identifies customer evidence. Enforce
  // owner-only ACL rather than trusting POSIX mode 0o600 on Windows/NTFS.
  const outputStat=await fs.lstat(output);
  must(outputStat.isDirectory()&&!outputStat.isSymbolicLink(),
    "Backup directory must be a real private local directory, not a link.");
  restrictWindowsDirectory(output);
  const name="flytally-pre-v21-"+new Date().toISOString().replace(/[:.]/g,"-")+
    "-"+randomBytes(4).toString("hex")+".ftbak";
  const finalPath=join(output,name),partial=finalPath+".partial";
  let dump,exit,done=false,finalCreated=false,manifestCreated=false;
  try{
    dump=spawn(exe("pg_dump"),
      ["-Fc","--no-owner","--no-acl","--serializable-deferrable",
        "--lock-wait-timeout=5000","--dbname="+DB],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
    // Connect stdout synchronously: scrypt runs async and a short-lived
    // pg_dump can exit before encryption starts consuming the readable.
    const bufferedDump=retainChildStdout(dump);
    let errorText="";
    dump.stderr.on("data",x=>{errorText=(errorText+x.toString("utf8")).slice(-1200);});
    exit=new Promise((resolveExit,reject)=>{
      dump.once("error",reject);dump.once("close",resolveExit);
    });
    let metadata;
    try{
      metadata=await encryptArchive(bufferedDump,partial,password,{requirePgDumpCustomFormat:true});
      const exitCode=await exit;
      must(exitCode===0,"pg_dump exited with nonzero status: "+exitCode+"; "+errorText.slice(-700));
    }catch(error){
      if(dump.exitCode===null)dump.kill();
      await exit.catch(()=>{});
      // Archive validation must never disguise a failed pg_dump process.
      throw new Error("pg_dump/export invalid: "+String(error.message||error)+
        "; pg_dump stderr: "+(errorText||"(empty)").slice(-700));
    }
    // The manifest records a separate pre-dump SELECT, while pg_dump uses
    // its own MVCC snapshot. Refuse to claim parity if any monitored counts,
    // protected row digests or schema identity changed during acquisition.
    const after=preflight(env);
    must(JSON.stringify(after)===JSON.stringify(schema),
      "Production schema/record evidence changed during export; discard and retry in a quiet window.");
    // Exclusive hard-link creation is atomic and will never overwrite an
    // existing archive even under a random-name collision.
    await fs.link(partial,finalPath);
    finalCreated=true;
    await fs.unlink(partial);
    const immutable={manifest_version:2,source_project:"muddy-dust-14049657",
      source_branch:"br-raspy-fog-b1btvu5t",source_host:HOST,
      source_schema_preflight:schema,created_at:new Date().toISOString(),
      encrypted_sha256:metadata.sha256,encrypted_size:metadata.sizeBytes};
    // Authenticated immutable evidence; no mutable verified_restore in MAC.
    const manifest=await sealManifest(finalPath,password,immutable);
    await fs.writeFile(finalPath+".manifest.json",JSON.stringify(manifest,null,2)+"\n",
      {encoding:"utf8",flag:"wx",mode:0o600});
    manifestCreated=true;
    done=true;
    console.log("ENCRYPTED OFF-NEON EXPORT CREATED. RESTORE NOT YET VERIFIED.");
    console.log("Archive: "+finalPath);
    console.log("SHA256: "+metadata.sha256);
    console.log("Keep your passphrase separately. Never share the archive or Neon URL.");
  }finally{
    if(dump&&!done)dump.kill();
    await fs.rm(partial,{force:true}).catch(()=>{});
    if(!done&&manifestCreated)await fs.rm(finalPath+".manifest.json",{force:true}).catch(()=>{});
    if(!done&&finalCreated)await fs.rm(finalPath,{force:true}).catch(()=>{});
  }
}
main().catch(e=>{console.error("BACKUP NOT COMPLETE: "+String(e.message||e).slice(0,1000));process.exitCode=1;});
