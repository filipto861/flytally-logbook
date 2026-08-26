import { createHmac,timingSafeEqual } from "node:crypto";

const canonical=(value:unknown):string=>{
  if(value===null||typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return`[${value.map(canonical).join(",")}]`;
  return`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
};
const secret=()=>process.env.SIGNING_SECRET||process.env.SESSION_SECRET||"";
export function signVerificationPayload(payload:Record<string,unknown>){
  const value=canonical(payload),key=secret();if(key.length<24)throw new Error("Server signing secret is not configured.");
  return createHmac("sha256",key).update(value).digest("hex");
}
export function verifyVerificationSignature(payload:Record<string,unknown>,signature:unknown){
  const actual=String(signature??"");if(!/^[a-f0-9]{64}$/.test(actual))return false;
  const expected=signVerificationPayload(payload);return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(actual,"hex"));
}
