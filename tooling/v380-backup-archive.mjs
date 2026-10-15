import {createCipheriv,createDecipheriv,randomBytes,scrypt as scryptCallback,createHash} from "node:crypto";
import {promisify} from "node:util";
import {createReadStream,createWriteStream,promises as fs} from "node:fs";
import {Transform} from "node:stream";
import {pipeline} from "node:stream/promises";

const scrypt=promisify(scryptCallback);
const MAGIC=Buffer.from("FT380A01","ascii");
const SALT_BYTES=16,IV_BYTES=12,TAG_BYTES=16,HEADER_BYTES=MAGIC.length+SALT_BYTES+IV_BYTES;
const KDF={N:131072,r:8,p:1,maxmem:256*1024*1024};

export async function fileSha256(file){
  const hash=createHash("sha256");
  for await(const part of createReadStream(file))hash.update(part);
  return hash.digest("hex");
}

async function keyFor(passphrase,salt){
  if(typeof passphrase!=="string"||passphrase.length<16)throw new Error("Archive passphrase must have at least 16 characters.");
  return scrypt(passphrase,salt,32,KDF);
}

// AES-256-GCM, scrypt, unique authenticated header, streaming binary output.
// No plaintext temporary pg_dump archive is created.
export async function encryptArchive(readable,outputFile,passphrase,{requirePgDumpCustomFormat=false}={}){
  const salt=randomBytes(SALT_BYTES),iv=randomBytes(IV_BYTES);
  const header=Buffer.concat([MAGIC,salt,iv]);
  const key=await keyFor(passphrase,salt);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  key.fill(0);
  cipher.setAAD(header);
  // Validate the streamed plaintext while it is being encrypted. A fixed
  // 1-KiB ciphertext minimum wrongly rejects small legitimate custom dumps
  // and, worse, masks a pg_dump process failure with an unrelated size error.
  // The format validator is optional because this codec also supports
  // non-PostgreSQL synthetic binary round-trip tests.
  let plaintextBytes=0;
  let signature=Buffer.alloc(0);
  const pgMagic=Buffer.from("PGDMP","ascii");
  const validatePlaintext=new Transform({
    transform(chunk,encoding,callback){
      plaintextBytes+=chunk.length;
      if(requirePgDumpCustomFormat&&signature.length<pgMagic.length){
        signature=Buffer.concat([signature,chunk.subarray(0,pgMagic.length-signature.length)]);
      }
      callback(null,chunk);
    },
    flush(callback){
      if(plaintextBytes===0)return callback(new Error("Empty archive source stream; check pg_dump exit status/stderr."));
      if(requirePgDumpCustomFormat&&!signature.equals(pgMagic)){
        return callback(new Error("pg_dump output missing PGDMP custom-format signature; check pg_dump exit status/stderr."));
      }
      callback();
    }
  });
  const trailer=new Transform({
    transform(chunk,encoding,callback){callback(null,chunk);},
    flush(callback){this.push(cipher.getAuthTag());callback();}
  });
  const writer=createWriteStream(outputFile,{flags:"wx",mode:0o600});
  writer.write(header);
  await pipeline(readable,validatePlaintext,cipher,trailer,writer);
  const stat=await fs.stat(outputFile);
  if(stat.size!==HEADER_BYTES+TAG_BYTES+plaintextBytes)throw new Error("Unexpected encrypted payload byte count.");
  return {sizeBytes:stat.size,plaintextBytes,sha256:await fileSha256(outputFile)};
}

// Authenticated decryption stream. Caller may only send decrypted bytes to a
// disposable local pg_restore process, never to production or a disk file.
export async function decryptArchive(inputFile,writable,passphrase){
  const file=await fs.open(inputFile,"r");
  let header,tag,total;
  try{
    const stat=await file.stat();total=stat.size;
    if(total<=HEADER_BYTES+TAG_BYTES)throw new Error("Invalid/empty archive size.");
    header=Buffer.alloc(HEADER_BYTES);tag=Buffer.alloc(TAG_BYTES);
    if((await file.read(header,0,HEADER_BYTES,0)).bytesRead!==HEADER_BYTES)throw new Error("Truncated archive header.");
    if((await file.read(tag,0,TAG_BYTES,total-TAG_BYTES)).bytesRead!==TAG_BYTES)throw new Error("Truncated archive tag.");
  }finally{await file.close();}
  if(!header.subarray(0,MAGIC.length).equals(MAGIC))throw new Error("Unknown archive format/version.");
  const salt=header.subarray(MAGIC.length,MAGIC.length+SALT_BYTES);
  const iv=header.subarray(MAGIC.length+SALT_BYTES);
  const key=await keyFor(passphrase,salt);
  const decipher=createDecipheriv("aes-256-gcm",key,iv);
  key.fill(0);
  decipher.setAAD(header);decipher.setAuthTag(tag);
  await pipeline(createReadStream(inputFile,{start:HEADER_BYTES,end:total-TAG_BYTES-1}),decipher,writable);
}
