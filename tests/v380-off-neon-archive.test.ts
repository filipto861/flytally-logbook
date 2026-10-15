import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {createReadStream,promises as fs} from "node:fs";
import {Readable,Writable} from "node:stream";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {encryptArchive,decryptArchive,fileSha256} from "../tooling/v380-backup-archive.mjs";

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
  assert.match(exportSource,/encryptArchive\(dump\.stdout,partial,password,\{requirePgDumpCustomFormat:true\}\)/);
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
    restore.indexOf("manifest.verified_restore=true"));
  assert.ok(restore.indexOf("await fs.rm(dir,{recursive:true,force:true})") <
    restore.indexOf("manifest.verified_restore=true"));


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
