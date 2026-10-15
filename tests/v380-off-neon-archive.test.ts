import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {spawn} from "node:child_process";
import {createReadStream,promises as fs} from "node:fs";
import {Readable,Writable} from "node:stream";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {encryptArchive,decryptArchive,fileSha256,retainChildStdout} from "../tooling/v380-backup-archive.mjs";
import {sealManifest,verifyManifest} from "../tooling/v380-backup-manifest.mjs";

async function collect(file,password){
  const parts=[];
  const sink=new Writable({write(buffer,encoding,cb){parts.push(Buffer.from(buffer));cb();}});
  await decryptArchive(file,sink,password);
  return Buffer.concat(parts);
}
test("v380 off-Neon archive AES-GCM round trip is lossless binary and encrypted on disk",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-crypto-test-"));
  try{
    const path=join(dir,"fixture.ftbak");
    const original=Buffer.concat([Buffer.from("PRIVATE DATA NOT PLAINTEXT "),randomBytes(131072)]);
    const result=await encryptArchive(Readable.from([original]),path,"test-only-passphrase-2026!");
    const encrypted=await fs.readFile(path);
    assert.ok(result.sizeBytes>original.length);
    assert.equal(result.sha256,await fileSha256(path));
    assert.ok(!encrypted.includes(Buffer.from("PRIVATE DATA NOT PLAINTEXT")));
    assert.deepEqual(await collect(path,"test-only-passphrase-2026!"),original);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("v380 off-Neon archive refuses wrong password or one-bit tampering",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-auth-test-"));
  try{
    const path=join(dir,"fixture.ftbak");
    await encryptArchive(Readable.from([randomBytes(16384)]),path,"test-only-passphrase-2026!");
    await assert.rejects(()=>collect(path,"wrong-password-1234567"));
    const data=await fs.readFile(path);
    data[100]^=0x01;
    await fs.writeFile(path,data);
    await assert.rejects(()=>collect(path,"test-only-passphrase-2026!"));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("v380 export/restore restrict production target, PG18, TLS, and disposable restore",async()=>{
  const exportSource=await fs.readFile(new URL("../tooling/v380-off-neon-export.mjs",import.meta.url),"utf8");
  const restore=await fs.readFile(new URL("../tooling/v380-off-neon-restore-check.mjs",import.meta.url),"utf8");
  assert.match(exportSource,/ep-proud-bar-b1ts6cq1\.c-5\.eu-central-1\.aws\.neon\.tech/);
  assert.match(exportSource,/\["pg_dump","psql","pg_restore","initdb","pg_ctl","createdb"\]/);
  assert.match(exportSource,/u\.hostname===HOST/);
  assert.match(exportSource,/PGSSLMODE:"verify-full"/);
  assert.match(exportSource,/PGSSLROOTCERT:"system"/);
  assert.match(exportSource,/PGCHANNELBINDING:"require"/);
  assert.match(exportSource,/default_transaction_read_only=on/);
  assert.match(exportSource,/--serializable-deferrable/);
  assert.match(exportSource,/source_branch:"br-raspy-fog-b1btvu5t"/);
  assert.match(exportSource,/encryptArchive\(bufferedDump,partial,password,\{requirePgDumpCustomFormat:true\}\)/);
  assert.match(exportSource,/sealManifest\(finalPath,password,immutable\)/);
  assert.match(exportSource,/manifest_version:2/);
  assert.match(exportSource,/restrictWindowsDirectory\(output\)/);
  assert.doesNotMatch(exportSource,/verified_restore:false/);
  assert.match(exportSource,/const after=preflight\(env\)/);
  assert.match(exportSource,/JSON\.stringify\(after\)===JSON\.stringify\(schema\)/);

  assert.match(restore,/PGHOST:"127\.0\.0\.1"/);
  assert.match(restore,/--single-transaction/);
  assert.match(restore,/--exit-on-error/);
  assert.match(restore,/decryptArchive\(archive,child\.stdin,pass\)/);
  assert.match(restore,/voided_digest/);
  // A preset PGHOSTADDR/PGSERVICE must never override the approved target.
  assert.match(exportSource,/name\.toUpperCase\(\)\.startsWith\("PG"\)/);
  assert.match(restore,/name\.toUpperCase\(\)\.startsWith\("PG"\)/);
  assert.match(restore,/PGHOSTADDR:"127\.0\.0\.1"/);
  // Restore-side Windows pg_ctl must not capture handles inherited by
  // long-lived postgres.exe, and startup failure must remain scoped to its
  // own unique disposable cluster.
  assert.match(restore,/stdio:isCtl\?"ignore"/);
  assert.match(restore,/if\(existsSync\(join\(data,"postmaster\.pid"\)\)\)started=true/);
  assert.match(restore,/Isolated restore PostgreSQL startup log/);
  // Fail-closed: authenticate GCM before initdb, and only then stream to SQL.
  assert.match(restore,/const discard=new Writable/);
  assert.match(restore,/await decryptArchive\(archive,discard,pass\)/);
  assert.ok(restore.indexOf("await decryptArchive(archive,discard,pass)") <
    restore.indexOf('run("initdb"'),"Unverified ciphertext reached an SQL interpreter");
  assert.ok(restore.indexOf("await decryptArchive(archive,discard,pass)") <
    restore.indexOf("decryptArchive(archive,child.stdin,pass)"));
  // Audit PASS marker must be written after the plaintext PG18 cluster was
  // actually stopped and removed, not merely after row counts matched.
  assert.ok(restore.indexOf("must(stopVerified,") <
    restore.indexOf("const receipt={receipt_version:1"));
  assert.ok(restore.indexOf("await fs.rm(dir,{recursive:true,force:true})") <
    restore.indexOf("const receipt={receipt_version:1"));
  assert.match(restore,/await verifyManifest\(archive,pass,manifest\)/);
  assert.match(restore,/"-A","scram-sha-256"/);
  assert.doesNotMatch(restore,/"-A","trust"/);
  assert.match(restore,/restrictWindowsDirectory\(dir\)/);
  assert.match(restore,/createEphemeralPwfile\(dir,ephemeralPassword\)/);
  assert.match(restore,/denied.status!==0/);
  assert.match(restore,/inspectPgRestoreToc\(archive,pass,exe\("pg_restore"\)\)/);
  assert.match(restore,/FLYTALLY_CONFIRMED_ENCRYPTED_VOLUME/);


  assert.doesNotMatch(restore,/restore_snapshot|finalize_branch_restore/);
});


test("v380 synthetic PG18 diagnostic phases and pg_ctl process containment",async()=>{
  const synthetic=await fs.readFile(new URL("../tooling/v380-off-neon-pg18-synthetic-test.mjs",import.meta.url),"utf8");
  assert.match(synthetic,/stdio:isCtl\?"ignore"/);
  assert.match(synthetic,/Owned temp cluster/);
  assert.match(synthetic,/postmaster\.pid/);
  assert.match(synthetic,/PostgreSQL startup log \(synthetic-only\)/);
  assert.match(synthetic,/attempting owned-cluster shutdown/);

  assert.match(synthetic,/timeout:isCtl\?60000:120000/);
  assert.match(synthetic,/process\.on\("SIGINT"/);
  assert.match(synthetic,/notInterrupted\(\)/);
  assert.match(synthetic,/PGHOSTADDR:"127\.0\.0\.1"/);
  assert.match(synthetic,/\[PG18 synthetic\]/);
  for(const stage of ["00/10","01/10","02/10","03/10","04/10","05/10","06/10",
    "07/10","08/10","09/10","10/10"]){
    assert.ok(synthetic.includes(stage),"Missing progress stage "+stage);
  }
  const cleanup=synthetic.indexOf("if(stopped){");
  const pass=synthetic.indexOf('console.log("SYNTHETIC PG18 ENCRYPTED BACKUP/RESTORE PASS.")');
  assert.ok(cleanup>0&&cleanup<pass,"Do not report success before disposable server cleanup");
  assert.match(synthetic,/must\(stopped,"Local PG18 test cluster not confirmed stopped and removed\."\)/);
  assert.match(synthetic,/activeChild=dump/);
  assert.match(synthetic,/activeChild=restore/);
  assert.match(synthetic,/encryptArchive\(bufferedDump,archive,password,\{requirePgDumpCustomFormat:true\}\)/);
  assert.match(synthetic,/Synthetic pg_dump\/archive failed/);
  assert.match(synthetic,/dump\.stderr\.on\("data"/);

});

test("v380 accepts tiny nonempty authenticated payload but refuses empty and non-PGDMP pg_dump output",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-small-archive-"));
  const pass="test-small-payload-2026!";
  try{
    // The format codec permits small bytes, while the pg_dump caller must
    // explicitly require the PostgreSQL custom-format PGDMP signature.
    const tiny=join(dir,"tiny.ftbak");
    const bytes=Buffer.from("PGDMP-small-synthetic-check","utf8");
    const meta=await encryptArchive(Readable.from([bytes.subarray(0,2),bytes.subarray(2,5),bytes.subarray(5)]),
      tiny,pass,{requirePgDumpCustomFormat:true});
    assert.equal(meta.plaintextBytes,bytes.length);
    assert.ok(meta.sizeBytes<1100,"Reintroducing the arbitrary old 1KiB floor");
    assert.deepEqual(await collect(tiny,pass),bytes);
    await assert.rejects(
      ()=>encryptArchive(Readable.from([]),join(dir,"empty.ftbak"),pass,{requirePgDumpCustomFormat:true}),
      /Empty archive source stream/
    );
    await assert.rejects(
      ()=>encryptArchive(Readable.from([Buffer.from("NOTPGDMP")]),
        join(dir,"invalid.ftbak"),pass,{requirePgDumpCustomFormat:true}),
      /missing PGDMP/
    );
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("v380 preserves fast-exit subprocess PGDMP stdout during asynchronous scrypt",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-fast-child-"));
  const payload=Buffer.from("PGDMP-fast-child-test-data");
  try{
    const filename=join(dir,"fast-child.ftbak");
    // Must attach before awaiting scrypt; Node may drain unconsumed pipes after
    // a short child has exited, otherwise falsely returning empty source data.
    const child=spawn(process.execPath,["-e",
      'process.stdout.write(Buffer.from("PGDMP-fast-child-test-data"));'],
      {stdio:["ignore","pipe","pipe"]});
    const buffered=retainChildStdout(child);
    const exited=new Promise((resolve,reject)=>{
      child.once("error",reject);child.once("close",resolve);
    });
    const encrypted=await encryptArchive(buffered,filename,"test-only-fast-child-2026!",
      {requirePgDumpCustomFormat:true});
    assert.equal(await exited,0);
    assert.equal(encrypted.plaintextBytes,payload.length);
    assert.deepEqual(await collect(filename,"test-only-fast-child-2026!"),payload);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("v380 both pg_dump callers attach fast-exit buffer before asynchronous encryption",async()=>{
  const exportSource=await fs.readFile(new URL("../tooling/v380-off-neon-export.mjs",import.meta.url),"utf8");
  const synthetic=await fs.readFile(new URL("../tooling/v380-off-neon-pg18-synthetic-test.mjs",import.meta.url),"utf8");
  for(const [name,source] of [["production export",exportSource],["synthetic fixture",synthetic]]){
    const attach=source.indexOf("const bufferedDump=retainChildStdout(dump)");
    const encrypt=source.indexOf("encryptArchive(bufferedDump,");
    assert.ok(attach>0 && encrypt>attach,name+" starts async KDF before connecting stdout");
    assert.ok(source.includes("{requirePgDumpCustomFormat:true}"),name+" must validate PGDMP custom signature");
  }
});


function unsignedFixture(meta){
  return {manifest_version:2,source_project:"muddy-dust-14049657",
    source_branch:"br-raspy-fog-b1btvu5t",source_host:"approved.test",
    source_schema_preflight:{db:"neondb",flights:315,voided:3},
    created_at:"2026-10-15T12:00:00.000Z",
    encrypted_sha256:meta.sha256,encrypted_size:meta.sizeBytes};
}
test("R1-B signed manifest v2 rejects tampering, swapped archives, wrong passphrase and unsigned legacy",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-manifest-auth-"));
  const pass="manifest-test-passphrase-2026!";
  try{
    const one=join(dir,"one.ftbak"),two=join(dir,"two.ftbak");
    const meta=await encryptArchive(Readable.from([Buffer.from("PGDMP-manifest-data")]),one,pass,
      {requirePgDumpCustomFormat:true});
    const manifest=await sealManifest(one,pass,unsignedFixture(meta));
    const verified=await verifyManifest(one,pass,manifest);
    assert.equal(verified.encrypted_sha256,meta.sha256);
    assert.deepEqual(verified.source_schema_preflight,{db:"neondb",flights:315,voided:3});
    await assert.rejects(()=>verifyManifest(one,"wrong-manifest-passphrase!",manifest),/authentication FAILED/);
    await assert.rejects(()=>verifyManifest(one,pass,{...unsignedFixture(meta),schema:1}),/authentication/);
    await assert.rejects(()=>verifyManifest(one,pass,{...manifest,
      source_schema_preflight:{...manifest.source_schema_preflight,flights:316}}),/authentication FAILED/);
    await assert.rejects(()=>verifyManifest(one,pass,{...manifest,source_host:"forged.test"}),
      /authentication FAILED/);
    await assert.rejects(()=>verifyManifest(one,pass,{...manifest,authentication:{
      ...manifest.authentication,value:"0".repeat(64)}}),/authentication FAILED/);
    await encryptArchive(Readable.from([Buffer.from("PGDMP-other-archive")]),two,pass,
      {requirePgDumpCustomFormat:true});
    await assert.rejects(()=>verifyManifest(two,pass,manifest),/authentication FAILED/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test("R1-C synthetic and actual restore share SCRAM, private NTFS directory and pre-SQL archive inventory",async()=>{
  const synthetic=await fs.readFile(new URL("../tooling/v380-off-neon-pg18-synthetic-test.mjs",import.meta.url),"utf8");
  const restore=await fs.readFile(new URL("../tooling/v380-off-neon-restore-check.mjs",import.meta.url),"utf8");
  const helper=await fs.readFile(new URL("../tooling/v380-windows-private.mjs",import.meta.url),"utf8");
  for(const code of [synthetic,restore]){
    assert.match(code,/"-A","scram-sha-256"/);
    assert.doesNotMatch(code,/"-A","trust"/);
    assert.match(code,/restrictWindowsDirectory\(dir\)/);
    assert.match(code,/createEphemeralPwfile\(dir,ephemeralPassword\)/);
    assert.match(code,/denied.status!==0/);
    assert.match(code,/inspectPgRestoreToc\(archive,/);
  }
  assert.match(helper,/icacls.exe/);
  assert.match(helper,/whoami.exe/);
  assert.match(helper,/\/inheritance:r/);
  const toc=await fs.readFile(new URL("../tooling/v380-backup-toc.mjs",import.meta.url),"utf8");
  assert.match(toc,/\["--list"\]/);
  assert.match(toc,/decryptArchive\(archive,p.stdin,password\)/);
  assert.match(restore,/SELECT name FROM pg_available_extensions/);
  assert.match(restore,/--single-transaction/);
});

test("R1-D encrypted stream propagates backpressure for multi-megabyte slow consumer",async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),"ft380-stream-load-"));
  const p=join(dir,"load.ftbak"),pass="slow-consumer-test-2026!";
  const input=randomBytes(12*1024*1024);
  try{
    await encryptArchive(Readable.from([input]),p,pass);
    const digest=createHash("sha256"),lengths={total:0};
    const slow=new Writable({highWaterMark:4096,write(chunk,enc,done){
      digest.update(chunk);lengths.total+=chunk.length;
      setImmediate(done);
    }});
    await decryptArchive(p,slow,pass);
    assert.equal(lengths.total,input.length);
    assert.equal(digest.digest("hex"),createHash("sha256").update(input).digest("hex"));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
