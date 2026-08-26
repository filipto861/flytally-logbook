import "server-only";
import { randomBytes,scrypt as nodeScrypt,timingSafeEqual,type ScryptOptions } from "node:crypto";

const CURRENT_N=131072,CURRENT_R=8,CURRENT_P=1;
function scrypt(password:string,salt:Buffer,keyLength:number,options:ScryptOptions){return new Promise<Buffer>((resolve,reject)=>nodeScrypt(password,salt,keyLength,options,(error,key)=>error?reject(error):resolve(key)));}

export async function verifyPassword(password:string,encoded:string){
  try{
    const [algorithm,rawParams,salt64,digest64]=encoded.split("$",4);if(algorithm!=="scrypt"||!rawParams||!salt64||!digest64)return false;
    const params=Object.fromEntries(rawParams.split(",").map(part=>{const[key,value]=part.split("=",2);return[key,Number(value)]}));
    if(![params.n,params.r,params.p].every(Number.isSafeInteger))return false;
    const salt=Buffer.from(salt64,"base64url"),expected=Buffer.from(digest64,"base64url");
    const actual=await scrypt(password,salt,expected.length,{N:params.n,r:params.r,p:params.p,maxmem:256*1024*1024});
    return actual.length===expected.length&&timingSafeEqual(actual,expected);
  }catch{return false;}
}
export async function hashPassword(password:string){const salt=randomBytes(16),digest=await scrypt(password,salt,32,{N:CURRENT_N,r:CURRENT_R,p:CURRENT_P,maxmem:256*1024*1024});return`scrypt$n=${CURRENT_N},r=${CURRENT_R},p=${CURRENT_P}$${salt.toString("base64url")}$${digest.toString("base64url")}`;}
export function passwordNeedsRehash(encoded:string){return!encoded.startsWith(`scrypt$n=${CURRENT_N},r=${CURRENT_R},p=${CURRENT_P}$`);}

export const verifyLegacyPassword=verifyPassword;
export const hashLegacyPassword=hashPassword;
