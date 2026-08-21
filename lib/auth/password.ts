import "server-only";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function verifyLegacyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, rawParams, salt64, digest64] = encoded.split("$", 4);
    if (algorithm !== "scrypt" || !rawParams || !salt64 || !digest64) return false;

    const params = Object.fromEntries(
      rawParams.split(",").map((part) => {
        const [key, value] = part.split("=", 2);
        return [key, Number(value)];
      }),
    );
    if (![params.n, params.r, params.p].every(Number.isSafeInteger)) return false;

    const salt = Buffer.from(salt64, "base64url");
    const expected = Buffer.from(digest64, "base64url");
    const actual = (await scrypt(password, salt, expected.length, {
      N: params.n,
      r: params.r,
      p: params.p,
      maxmem: 64 * 1024 * 1024,
    })) as Buffer;

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function hashLegacyPassword(password:string){
  const salt=randomBytes(16);const digest=await scrypt(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt$n=16384,r=8,p=1$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}
