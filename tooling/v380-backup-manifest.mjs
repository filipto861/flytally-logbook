import {createHmac,scrypt as scryptCb,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {promises as fs} from "node:fs";

const scrypt=promisify(scryptCb);
const MAGIC=Buffer.from("FT380A01","ascii");
const DOMAIN=Buffer.from("FlyTally::v380::manifest-hmac::v2\0","utf8");
const KDF={N:131072,r:8,p:1,maxmem:256*1024*1024};
const VERSION=2;
const SCHEME="HMAC-SHA256-scrypt-domain-v2";
const FIELDS=["manifest_version","source_project","source_branch","source_host",
  "source_schema_preflight","created_at","encrypted_sha256","encrypted_size"];
const isObj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);

function canonical(value){
  if(value===null)return "null";
  if(typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(!isObj(value))throw new Error("Unsupported manifest field type.");
  return "{"+Object.keys(value).sort().map(key=>
    JSON.stringify(key)+":"+canonical(value[key])).join(",")+"}";
}
function validateUnsigned(fields){
  if(!isObj(fields)||Object.keys(fields).sort().join("|")!==[...FIELDS].sort().join("|"))
    throw new Error("Manifest v2 fields do not match immutable schema.");
  if(fields.manifest_version!==VERSION||
     !["muddy-dust-14049657"].includes(fields.source_project)||
     typeof fields.source_branch!=="string"||fields.source_branch.length<2||
     typeof fields.source_host!=="string"||fields.source_host.length<6||
     !isObj(fields.source_schema_preflight)||
     typeof fields.created_at!=="string"||!Number.isFinite(Date.parse(fields.created_at))||
     !/^[a-f0-9]{64}$/.test(fields.encrypted_sha256)||
     !Number.isSafeInteger(fields.encrypted_size)||fields.encrypted_size<=52)
    throw new Error("Malformed or unsupported immutable backup manifest.");
}
async function readSalt(archive){
  const f=await fs.open(archive,"r");
  try{
    const header=Buffer.alloc(24);
    if((await f.read(header,0,24,0)).bytesRead!==24||!header.subarray(0,8).equals(MAGIC))
      throw new Error("Invalid encrypted archive header; cannot authenticate manifest.");
    return Buffer.from(header.subarray(8,24));
  }finally{await f.close();}
}
async function macKey(password,archive){
  if(typeof password!=="string"||password.length<16)
    throw new Error("Invalid manifest authentication password.");
  const salt=await readSalt(archive);
  // Key separation: distinct input domain and purpose from the AES-GCM
  // scrypt(password,salt). A unique 16-byte random per-archive salt comes
  // from the authenticated archive header; never a fixed global KDF salt.
  const purposePassword=Buffer.concat([DOMAIN,Buffer.from(password,"utf8")]);
  try{return await scrypt(purposePassword,salt,32,KDF);}
  finally{purposePassword.fill(0);salt.fill(0);}
}
async function computeMac(archive,password,immutable){
  const key=await macKey(password,archive);
  try{
    return createHmac("sha256",key).update(DOMAIN).update(canonical(immutable),"utf8").digest("hex");
  }finally{key.fill(0);}
}
export async function sealManifest(archive,password,fields){
  validateUnsigned(fields);
  const value=await computeMac(archive,password,fields);
  return {...fields,authentication:{scheme:SCHEME,value}};
}
export async function verifyManifest(archive,password,manifest){
  if(!isObj(manifest)||!isObj(manifest.authentication)||
     manifest.authentication.scheme!==SCHEME||
     !/^[0-9a-f]{64}$/.test(manifest.authentication.value||""))
    throw new Error("Manifest authentication missing/unsupported (unsigned v1 forbidden).");
  const {authentication,...immutable}=manifest;
  validateUnsigned(immutable);
  const expected=Buffer.from(await computeMac(archive,password,immutable),"hex");
  const actual=Buffer.from(authentication.value,"hex");
  try{
    if(!timingSafeEqual(expected,actual))
      throw new Error("Manifest authentication FAILED; untrusted backup evidence.");
  }finally{expected.fill(0);actual.fill(0);}
  return immutable;
}
