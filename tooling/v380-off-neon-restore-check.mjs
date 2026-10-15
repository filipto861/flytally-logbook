import {spawn,spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createServer} from "node:net";
import {Writable} from "node:stream";
import {existsSync,promises as fs} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,relative,sep,basename} from "node:path";
import {decryptArchive,fileSha256} from "./v380-backup-archive.mjs";
import {verifyManifest} from "./v380-backup-manifest.mjs";
import {inspectPgRestoreToc} from "./v380-backup-toc.mjs";
import {restrictWindowsDirectory,createEphemeralPwfile} from "./v380-windows-private.mjs";

// Owner-local only. NEVER connect pg_restore to production, Neon, or any
// pre-existing database. The archive stays encrypted until piped into the
// disposable local PG18 server's stdin. Local PG data is transient plaintext.
const name="flytally_restore_test",user="flytally_restore";
const bin=join(process.env.ProgramFiles||"C:\\Program Files","PostgreSQL","18","bin");
const exe=tool=>join(bin,tool+".exe");
const must=(ok,msg)=>{if(!ok)throw new Error(msg);};
const command=process.argv[2];
let interrupted=false,activeChild=null;
process.on("SIGINT",()=>{
  interrupted=true;
  if(activeChild)activeChild.kill();
  console.error("Operator interrupted real-data restore; cleaning ONLY the owned local cluster.");
});
function notInterrupted(){
  must(!interrupted,"Operator interrupted; verified-restore PASS refused.");
}

function tools(){
  must(process.platform==="win32"&&process.versions.node.split(".")[0]==="24",
    "Windows and Node 24 required.");
  for(const n of ["initdb","pg_ctl","createdb","psql","pg_restore"]){
    must(existsSync(exe(n)),"Missing PostgreSQL 18 binary: "+exe(n));
    const v=spawnSync(exe(n),["--version"],{encoding:"utf8",timeout:10000});
    must(!v.error&&v.status===0&&/\b18\.\d+\b/.test(String(v.stdout||"")),
      "PostgreSQL 18 required: "+n);
  }
}
function run(binName,args,env,timeout=90000){
  // On Windows pg_ctl starts a long-lived postgres.exe process. The
  // child server can inherit captured stdout/stderr handles and keep
  // spawnSync waiting despite pg_ctl having exited. Use log-file output
  // through pg_ctl -l and no captured pipes for start/stop.
  const isCtl=binName==="pg_ctl";
  const r=spawnSync(exe(binName),args,{
    env,encoding:"utf8",timeout,maxBuffer:1024*1024,windowsHide:true,
    stdio:isCtl?"ignore":["ignore","pipe","pipe"]
  });
  must(!r.error&&r.status===0,binName+" failed: "+String(r.stderr||r.error?.message||"").slice(-1200));
  return String(r.stdout||"").trim();
}
function hidden(question){
  must(process.stdin.isTTY&&typeof process.stdin.setRawMode==="function","Interactive terminal required.");
  return new Promise((resolveValue,reject)=>{
    let value="";process.stdout.write(question);
    process.stdin.setRawMode(true);process.stdin.resume();
    const finish=err=>{
      process.stdin.off("data",read);process.stdin.setRawMode(false);
      process.stdin.pause();process.stdout.write("\n");
      if(err)reject(err);else resolveValue(value);
    };
    const read=buf=>{
      for(const ch of buf.toString("utf8")){
        if(ch==="\r"||ch==="\n"){finish();return;}
        if(ch==="\u0003"){finish(new Error("Cancelled."));return;}
        if(ch==="\b"||ch==="\u007f"){value=value.slice(0,-1);continue;}
        if(ch>=" ")value+=ch;
        if(value.length>10000){finish(new Error("Unexpected long input."));return;}
      }
    };
    process.stdin.on("data",read);
  });
}
function localEnv(port,database,password){
  // Never inherit libpq service, host-address or SSL overrides from the
  // operator shell. In particular PGHOSTADDR could bypass PGHOST and send a
  // RESTORE to an unrelated remote server. Fail-closed local endpoint only.
  const safeEnv=Object.fromEntries(Object.entries(process.env)
    .filter(([name])=>!name.toUpperCase().startsWith("PG")&&name.toUpperCase()!=="DATABASE_URL"));
  return {...safeEnv,PGHOST:"127.0.0.1",PGHOSTADDR:"127.0.0.1",PGPORT:String(port),
    PGUSER:user,PGDATABASE:database,PGPASSWORD:password,PGSSLMODE:"disable",
    PGOPTIONS:"-c TimeZone=UTC",PGTZ:"UTC",PGCONNECT_TIMEOUT:"5"};
}
async function openPort(){
  const server=createServer();
  await new Promise((resolveValue,reject)=>{
    server.once("error",reject);server.listen(0,"127.0.0.1",resolveValue);
  });
  const p=server.address().port;
  await new Promise(resolveValue=>server.close(resolveValue));
  must(p!==5432&&p!==55432,"Refusing reserved PostgreSQL port.");
  return p;
}
function restoredEvidence(env){
  const q="SELECT "+
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
  const rows=run("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",q],env).split("|");
  must(rows.length===13,"Restore database response incomplete.");
  return {migrations:Number(rows[0]),first:Number(rows[1]),last:Number(rows[2]),
    currency_columns:Number(rows[3]),public_tables:Number(rows[4]),flights:Number(rows[5]),
    aircraft:Number(rows[6]),rates:Number(rows[7]),account_backups:Number(rows[8]),
    voided:Number(rows[9]),provenance:Number(rows[10]),voided_digest:rows[11],
    provenance_digest:rows[12]};
}
async function main(){
  must(command==="verify"&&process.argv.length===4,
    "Usage: node tooling/v380-off-neon-restore-check.mjs verify <archive.ftbak>");
  tools();
  must(process.env.LOCALAPPDATA,"LOCALAPPDATA required.");
  const home=resolve(process.env.LOCALAPPDATA,"FlyTally","PrivateProductionBackups");
  const archive=resolve(process.argv[3]),rel=relative(home,archive);
  must(rel&&rel!==".."&&!rel.startsWith(".."+sep)&&!rel.startsWith(sep)&&
    basename(archive).endsWith(".ftbak"),"Archive must be inside private off-Neon backup directory.");
  for(const file of [home,archive,archive+".manifest.json"]){
    const stat=await fs.lstat(file);
    must(!stat.isSymbolicLink(),"Refusing backup directory/archive/manifest symbolic link.");
  }
  const rawManifest=await fs.readFile(archive+".manifest.json","utf8");
  must(rawManifest.length<1024*1024,"Unexpectedly large manifest.");
  const manifest=JSON.parse(rawManifest);
  const pass=await hidden("Archive passphrase (hidden): ");
  // NEVER trust source identity or evidence until the immutable manifest
  // is authenticated with its separate domain-separated HMAC key.
  const verifiedManifest=await verifyManifest(archive,pass,manifest);
  must(verifiedManifest.source_project==="muddy-dust-14049657"&&
    verifiedManifest.source_branch==="br-raspy-fog-b1btvu5t"&&
    verifiedManifest.source_host==="ep-proud-bar-b1ts6cq1.c-5.eu-central-1.aws.neon.tech",
    "Unexpected authenticated source provenance.");
  must((await fileSha256(archive))===verifiedManifest.encrypted_sha256,
    "Archive digest mismatches authenticated immutable manifest.");
  // Authenticate the COMPLETE ciphertext before starting PostgreSQL or
  // piping a single plaintext byte to pg_restore. AES-GCM authenticates at
  // EOF, so a single-pass stream could otherwise feed invalid data into a
  // running SQL interpreter before detecting tampering.
  const discard=new Writable({write(_chunk,_encoding,next){next();}});
  await decryptArchive(archive,discard,pass);
  must((await fileSha256(archive))===manifest.encrypted_sha256,
    "Archive changed between initial checksum and authenticated read.");
  console.log("Archive checksum, source manifest and complete GCM tag PASS.");
  console.log("CAUTION: isolated local test briefly contains decrypted production data.");
  const accepted=await hidden("Type RESTORE_TEST to confirm isolated local restore only (hidden): ");
  must(accepted==="RESTORE_TEST","Operator did not confirm temporary local restore.");
  const toc=await inspectPgRestoreToc(archive,pass,exe("pg_restore"));
  notInterrupted();
  must(toc.tableCount>=50,"Authenticated archive TOC has fewer than 50 TABLE objects.");
  console.log("Authenticated PG18 archive TOC: "+toc.tableCount+
    " tables; "+toc.extensions.length+" extensions. No database connection used.");
  // Real decrypted production records may live temporarily on this device.
  // Fail closed unless the owner confirms a trusted, encrypted local volume.
  must(process.env.FLYTALLY_CONFIRMED_ENCRYPTED_VOLUME==="YES",
    "Set FLYTALLY_CONFIRMED_ENCRYPTED_VOLUME=YES only on a trusted encrypted volume.");
  const dir=await fs.mkdtemp(join(tmpdir(),"flytally-380-pg18-restore-"));
  const data=join(dir,"postgres-data"),log=join(dir,"postgres.log");
  let started=false,stopVerified=false,attempted=false,verifiedEvidence=null;
  const port=await openPort();
  const ephemeralPassword=randomBytes(36).toString("base64url");
  const env=localEnv(port,name,ephemeralPassword);
  let pwfile;
  try{
    restrictWindowsDirectory(dir);
    pwfile=await createEphemeralPwfile(dir,ephemeralPassword);
    try{
      run("initdb",["-D",data,"-U",user,"-A","scram-sha-256",
        "--pwfile="+pwfile,"--encoding=UTF8","--no-instructions"],env,120000);
    }finally{
      await fs.rm(pwfile,{force:true});
      pwfile=null;
    }
    attempted=true;
    try {
      run("pg_ctl",["-D",data,"-l",log,"-o","-h 127.0.0.1 -p "+port,
        "-w","-t","30","start"],env,90000);
      started=true;
    } catch(error) {
      // A failed pg_ctl can leave a running server. Only inspect/stop the
      // unique cluster created by THIS invocation, never unrelated services.
      if(existsSync(join(data,"postmaster.pid")))started=true;
      let excerpt="";
      try{excerpt=(await fs.readFile(log,"utf8")).slice(-1400);}catch{}
      if(excerpt)console.error("Isolated restore PostgreSQL startup log: "+excerpt);
      throw error;
    }
    run("createdb",["-h","127.0.0.1","-p",String(port),"-U",user,name],localEnv(port,"postgres",ephemeralPassword));
    const id=run("psql",["-X","-w","-qAt","-c",
      "SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())"],env);
    must(id===name+"|"+user+"|127.0.0.1","Restoration target identity mismatch.");
    const invalidEnv={...env,PGPASSWORD:"wrong-ephemeral-password"};
    const denied=spawnSync(exe("psql"),["-X","-w","-qAt","-c","SELECT 1"],{
      env:invalidEnv,encoding:"utf8",timeout:15000,windowsHide:true});
    must(denied.status!==0&&!denied.error,
      "SCRAM denial test FAILED; local PG18 accepts an invalid password.");
    // The fresh local PG18 must actually ship every extension referenced by
    // the immutable, authenticated source archive before any SQL is executed.
    const available=run("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1",
      "-c","SELECT name FROM pg_available_extensions"],env);
    const installed=new Set(available.split(/\r?\n/).filter(Boolean));
    for(const ext of toc.extensions)
      must(installed.has(ext),"Restored archive references missing local PostgreSQL extension: "+ext);
    notInterrupted();
    const child=spawn(exe("pg_restore"),
      ["--single-transaction","--exit-on-error","--no-owner","--no-acl","--dbname="+name],
      {env,stdio:["pipe","ignore","pipe"],windowsHide:true});
    activeChild=child;
    let stderr="";
    child.stderr.on("data",chunk=>{stderr=(stderr+chunk.toString("utf8")).slice(-1800);});
    const exit=new Promise((resolveValue,reject)=>{
      child.once("error",reject);child.once("close",resolveValue);
    });
    try{
      await decryptArchive(archive,child.stdin,pass);
      must((await exit)===0,"Local pg_restore failed: "+stderr.slice(-1200));
      activeChild=null;
    }catch(error){child.kill();await exit.catch(()=>{});activeChild=null;throw error;}
    notInterrupted();
    const actual=restoredEvidence(env),expected=verifiedManifest.source_schema_preflight;
    must(actual.migrations===20&&actual.first===1&&actual.last===20&&actual.currency_columns===0,
      "Restored schema registry drift.");
    for(const key of ["public_tables","flights","aircraft","rates","account_backups",
      "voided","provenance","voided_digest","provenance_digest"]){
      must(String(actual[key])===String(expected[key]),
        "Restore integrity mismatch: "+key+". No release approval.");
    }
    // Hold success evidence in memory until PostgreSQL is stopped and
    // the plaintext test cluster is actually removed. Do not mark PASS early.
    verifiedEvidence=actual;
  }finally{
    activeChild=null;
    if(pwfile)await fs.rm(pwfile,{force:true}).catch(()=>{});
    if(started){
      try{
        run("pg_ctl",["-D",data,"-m","fast","-w","-t","30","stop"],env,90000);
        stopVerified=true;
      }catch{console.warn("Local PG18 stop failed; preserve directory for manual inspection: "+dir);}
    }else if(!attempted||!existsSync(join(data,"postmaster.pid")))stopVerified=true;
    if(stopVerified){
      try{await fs.rm(dir,{recursive:true,force:true});}
      catch{stopVerified=false;console.warn("Private restored cluster could not be removed: "+dir);}
    }
  }
  must(stopVerified,"Local PG18 test instance was not safely stopped/removed; restore remains unverified.");
  notInterrupted();
  must(verifiedEvidence,"No verified restored-data evidence.");
  // The v2 manifest remains IMMUTABLE. This separate receipt is an
  // untrusted local audit marker, never a new source of archive authority.
  const receipt={receipt_version:1,verified_at:new Date().toISOString(),
    source_archive_sha256:verifiedManifest.encrypted_sha256,
    verification_scope:"isolated PG18 logical restore + selected counts/digests",
    restored_public_tables:verifiedEvidence.public_tables,
    restored_flights:verifiedEvidence.flights};
  const receiptPath=archive+".verification-"+Date.now()+".json";
  await fs.writeFile(receiptPath,JSON.stringify(receipt,null,2)+"\n",
    {encoding:"utf8",flag:"wx",mode:0o600});
  console.log("OFF-NEON RESTORE CHECK PASS: local PG18 restored "+verifiedEvidence.public_tables+
    " tables, "+verifiedEvidence.flights+" flights; protected history digests match.");
  console.log("Not proof of signed account v13 workflow recovery or live PG18 release.");
}
main().catch(error=>{
  console.error("RESTORE CHECK NOT PASS: "+String(error.message||error).slice(0,1400));
  process.exitCode=1;
});
