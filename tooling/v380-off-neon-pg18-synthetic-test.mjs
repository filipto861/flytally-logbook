import {spawn,spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {createServer} from "node:net";
import {Writable} from "node:stream";
import {existsSync,promises as fs} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {encryptArchive,decryptArchive,retainChildStdout} from "./v380-backup-archive.mjs";

// No Neon URL or production data; a disposable local PostgreSQL 18 only.
const pgBin=join(process.env.ProgramFiles||"C:\\Program Files","PostgreSQL","18","bin");
const exe=name=>join(pgBin,name+".exe");
const must=(ok,msg)=>{if(!ok)throw new Error(msg);};
const report=message=>console.log("[PG18 synthetic] "+message);
let interrupted=false,activeChild=null;
process.on("SIGINT",()=>{
  interrupted=true;
  console.error("[PG18 synthetic] Interrupted; attempting owned local cluster cleanup.");
  if(activeChild)activeChild.kill();
});
function notInterrupted(){must(!interrupted,"Operator interrupted the test.");}
function tools(){
  must(process.platform==="win32"&&process.versions.node.split(".")[0]==="24",
    "Windows and Node24 required.");
  for(const name of ["initdb","pg_ctl","createdb","psql","pg_dump","pg_restore"]){
    must(existsSync(exe(name)),"Missing PG18 binary "+name);
    const p=spawnSync(exe(name),["--version"],{encoding:"utf8"});
    must(!p.error&&p.status===0&&/\b18\.\d+\b/.test(p.stdout||""),"Wrong PG18 version "+name);
  }
}
async function port(){
  const server=createServer();
  await new Promise((yes,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",yes);});
  const value=server.address().port;
  await new Promise(yes=>server.close(yes));
  must(value!==5432&&value!==55432,"Reserved port.");
  return value;
}
function environment(port,database){
  const e=Object.fromEntries(Object.entries(process.env).filter(([name])=>
    !name.toUpperCase().startsWith("PG")&&name.toUpperCase()!=="DATABASE_URL"));
  return {...e,PGHOST:"127.0.0.1",PGHOSTADDR:"127.0.0.1",PGPORT:String(port),
    PGUSER:"ft380_synthetic",PGDATABASE:database,PGPASSWORD:"",
    PGSSLMODE:"disable",PGOPTIONS:"-c TimeZone=UTC",PGTZ:"UTC",PGCONNECT_TIMEOUT:"5"};
}
function run(name,args,env){
  // Windows PostgreSQL pg_ctl may start a long-lived postmaster. Do NOT
  // capture inherited stdout/stderr pipes when starting/stopping the server:
  // open pipe handles owned by the postmaster can stall spawnSync after
  // pg_ctl itself has already exited. pg_ctl -l writes diagnostics to log.
  const isCtl=name==="pg_ctl";
  const result=spawnSync(exe(name),args,{env,encoding:"utf8",
    stdio:isCtl?"ignore":["ignore","pipe","pipe"],
    timeout:isCtl?60000:120000,maxBuffer:1024*1024,windowsHide:true});
  must(!result.error&&result.status===0,
    name+" failed: "+String(result.stderr||result.error?.message||"").slice(-1200));
  return String(result.stdout||"").trim();
}
function sql(env,query){
  return run("psql",["-X","-w","-qAt","-v","ON_ERROR_STOP=1","-c",query],env);
}
function exitOf(child){
  return new Promise((yes,no)=>{child.once("error",no);child.once("close",yes);});
}
async function main(){
  report("00/10 Checking local PostgreSQL 18 binaries (no Neon access).");
  tools();notInterrupted();
  const dir=await fs.mkdtemp(join(tmpdir(),"flytally-380-pg18-synthetic-"));
  const data=join(dir,"pgdata"),log=join(dir,"postgres.log"),archive=join(dir,"synthetic.ftbak");
  report("Owned temp cluster: "+dir);
  const p=await port(),admin=environment(p,"postgres"),src=environment(p,"ft380_source"),
    dst=environment(p,"ft380_target");
  let startAttempted=false,started=false,stopped=false,verified=false;
  try{
    report("01/10 Initializing private disposable PG18 cluster.");
    notInterrupted();
    run("initdb",["-D",data,"-U","ft380_synthetic","-A","trust","--encoding=UTF8","--no-instructions"],admin);
    startAttempted=true;
    report("02/10 Starting local PG18 on loopback random port "+p+".");
    notInterrupted();
    try{
      run("pg_ctl",["-D",data,"-l",log,"-o","-h 127.0.0.1 -p "+p,"-w","-t","30","start"],admin);
      started=true;
    }catch(error){
      // pg_ctl might time out after postmaster has already started.
      // The PID file belongs ONLY to this newly created unique directory.
      if(existsSync(join(data,"postmaster.pid"))){
        started=true; // allow finally to attempt stopping this owned cluster
        console.warn("[PG18 synthetic] Startup failed but own postmaster.pid exists; attempting owned-cluster shutdown.");
      }
      let logExcerpt="";
      try{logExcerpt=(await fs.readFile(log,"utf8")).slice(-1600);}catch{}
      if(logExcerpt)console.error("[PG18 synthetic] PostgreSQL startup log (synthetic-only):\n"+logExcerpt);
      throw error;
    }
    report("03/10 Creating two isolated synthetic databases.");
    notInterrupted();
    for(const db of ["ft380_source","ft380_target"])
      run("createdb",["-h","127.0.0.1","-p",String(p),"-U","ft380_synthetic",
        "-T","template0",db],admin);
    for(const [env,db] of [[src,"ft380_source"],[dst,"ft380_target"]])
      must(sql(env,"SELECT current_database()||'|'||current_user||'|'||host(inet_server_addr())")===
        db+"|ft380_synthetic|127.0.0.1","Synthetic local DB identity mismatch.");
    report("04/10 Inserting test-only flight and archive rows.");
    notInterrupted();
    sql(src,"CREATE TABLE flight_sample(id BIGINT PRIMARY KEY,price NUMERIC NOT NULL,certified_at TIMESTAMPTZ,protected_history JSONB NOT NULL);"+
      "INSERT INTO flight_sample VALUES (1,1250.125,'2026-10-15T08:00:00Z','{\"certified\":true,\"revision\":2}'::jsonb),"+
      "(2,0.000,NULL,'{\"certified\":false,\"revision\":1}'::jsonb);"+
      "CREATE TABLE archive_sample(id BIGINT PRIMARY KEY,sha256 TEXT NOT NULL);"+
      "INSERT INTO archive_sample VALUES(10,repeat('a',64)),(11,repeat('b',64));");
    const evidence="SELECT COUNT(*)||'|'||SUM(price)::text||'|'||"+
      "(SELECT COUNT(*) FROM archive_sample)||'|'||"+
      "md5(string_agg(protected_history::text,',' ORDER BY id)) FROM flight_sample";
    const expected=sql(src,evidence);
    const password="synthetic-test-only-"+randomBytes(8).toString("hex");
    report("05/10 Streaming synthetic pg_dump into encrypted archive.");
    notInterrupted();
    const dump=spawn(exe("pg_dump"),["-Fc","--no-owner","--no-acl","--dbname=ft380_source"],
      {env:src,stdio:["ignore","pipe","pipe"],windowsHide:true});
    activeChild=dump;
    // Attach synchronously before scrypt's asynchronous KDF step so short
    // pg_dump subprocesses cannot lose stdout on process exit.
    const bufferedDump=retainChildStdout(dump);
    let dumpError="";
    dump.stderr.on("data",chunk=>{dumpError=(dumpError+chunk.toString("utf8")).slice(-2000);});
    const dumped=exitOf(dump);
    try{
      const meta=await encryptArchive(bufferedDump,archive,password,{requirePgDumpCustomFormat:true});
      const exit=await dumped;
      must(exit===0,"Synthetic pg_dump exited with code "+exit+": "+dumpError);
      activeChild=null;
      report("pg_dump completed successfully; custom-format payload "+meta.plaintextBytes+" bytes.");
    }catch(error){
      if(dump.exitCode===null)dump.kill();
      const exit=await dumped.catch(()=>null);
      activeChild=null;
      throw new Error("Synthetic pg_dump/archive failed (exit "+exit+"): "+
        String(error.message||error)+"; stderr: "+(dumpError||"(empty)"));
    }
    // Complete authenticated preflight BEFORE starting pg_restore.
    report("06/10 Authenticating complete encrypted archive before restore.");
    notInterrupted();
    await decryptArchive(archive,new Writable({write(_chunk,_enc,cb){cb();}}),password);
    report("07/10 Restoring verified ciphertext into separate local PG18 database.");
    notInterrupted();
    const restore=spawn(exe("pg_restore"),
      ["--single-transaction","--exit-on-error","--no-owner","--no-acl","--dbname=ft380_target"],
      {env:dst,stdio:["pipe","ignore","pipe"],windowsHide:true});
    activeChild=restore;
    const restored=exitOf(restore);
    try{
      await decryptArchive(archive,restore.stdin,password);
      must((await restored)===0,"Synthetic pg_restore failed.");
      activeChild=null;
    }catch(error){restore.kill();await restored.catch(()=>{});throw error;}
    report("08/10 Comparing synthetic prices, certificate evidence and row hashes.");
    notInterrupted();
    const actual=sql(dst,evidence);
    must(actual===expected,"Synthetic PostgreSQL18 restored data mismatch.");
    report("09/10 SQL/data verification passed; stopping local PG18 next.");
    notInterrupted();
    // Final success message is printed only after a verified stop/cleanup.
    verified=true;
  }finally{
    activeChild=null;
    if(started){
      report("10/10 Stopping and cleaning owned PG18 test cluster.");
      try{
        run("pg_ctl",["-D",data,"-m","fast","-w","-t","30","stop"],admin);
        stopped=true;
      }catch{console.warn("Local PG18 stop failed; private synthetic fixture retained at "+dir);}
    }else if(!startAttempted||!existsSync(join(data,"postmaster.pid")))stopped=true;
    else console.warn("[PG18 synthetic] Startup outcome uncertain; OWNED TEST CLUSTER RETAINED: "+dir);
    if(stopped){
      try{await fs.rm(dir,{recursive:true,force:true});}
      catch(error){stopped=false;console.warn("Test data cleanup failed; inspect "+dir+" before removal: "+error.message);}
    }
  }
  must(stopped,"Local PG18 test cluster not confirmed stopped and removed.");
  notInterrupted();
  must(verified,"Synthetic restore/data verification incomplete.");
  console.log("SYNTHETIC PG18 ENCRYPTED BACKUP/RESTORE PASS.");
  console.log("Actual pg_dump -Fc / authenticated AES-256-GCM / pg_restore single-transaction.");
  console.log("Counts/hashes matched; no Neon credentials or production data used.");
}
main().catch(error=>{
  console.error("SYNTHETIC PG18 CHECK NOT PASS: "+String(error.message||error).slice(0,1400));
  process.exitCode=1;
});
