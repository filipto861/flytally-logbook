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
export async function encryptArchive(readable,outputFile,passphrase){
  const salt=randomBytes(SALT_BYTES),iv=randomBytes(IV_BYTES);
  const header=Buffer.concat([MAGIC,salt,iv]);
  const key=await keyFor(passphrase,salt);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  key.fill(0);
  cipher.setAAD(header);
  const trailer=new Transform({
    transform(chunk,encoding,callback){callback(null,chunk);},
    flush(callback){this.push(cipher.getAuthTag());callback();}
  });
  const writer=createWriteStream(outputFile,{flags:"wx",mode:0o600});
  writer.write(header);
  await pipeline(readable,cipher,trailer,writer);
  const stat=await fs.stat(outputFile);
  if(stat.size<=HEADER_BYTES+TAG_BYTES+1024)throw new Error("Encrypted database archive unexpectedly small.");
  return {sizeBytes:stat.size,sha256:await fileSha256(outputFile)};
}

// Authenticated decryption stream. Caller may only send decrypted bytes to a
// disposable local pg_restore process, never to production or a disk file.
export async function decryptArchive(inputFile,writable,passphrase){
  const file=await fs.open(inputFile,"r");
  let header,tag,total;
  try{
    const stat=await file.stat();total=stat.size;
    if(total<=HEADER_BYTES+TAG_BYTES+1024)throw new Error("Invalid archive size.");
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
