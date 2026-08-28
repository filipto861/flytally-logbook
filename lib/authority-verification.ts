import { createHash } from "node:crypto";
import { verifyVerificationSignature } from "./verification-signature.ts";

const text=(value:unknown)=>String(value??"").trim();

export function storedObject(value:unknown):Record<string,unknown>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  try{const parsed=JSON.parse(String(value||"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{} }catch{return{}}
}

export function verificationPayloadFromRow(row:Record<string,unknown>){
  return{
    flightId:Number(row.flight_id),
    flightUserId:Number(row.flight_user_id),
    signerUserId:row.signer_user_id===null||row.signer_user_id===undefined?null:Number(row.signer_user_id),
    recordRevision:Number(row.record_revision),
    flightHash:text(row.flight_hash),
    verificationRole:text(row.verification_role),
    credentialSnapshot:storedObject(row.credential_snapshot),
  };
}

export function verificationCryptographicStatus(row:Record<string,unknown>){
  if(!text(row.server_signature))return"missing" as const;
  try{return verifyVerificationSignature(verificationPayloadFromRow(row),row.server_signature)?"verified" as const:"invalid" as const}catch{return"unavailable" as const}
}

export function verificationIdentity(row:Record<string,unknown>){
  const credentials=storedObject(row.credential_snapshot);
  return text(credentials.identity)||text(row.signer_name)||"Unidentified signer";
}

export function verificationSource(row:Record<string,unknown>){return text(storedObject(row.credential_snapshot).source)||"FlyTally account"}

export function authorityReportReference(flightId:number,revision:number,hash:unknown){
  const digest=createHash("sha256").update(`flytally-authority:${flightId}:${revision}:${text(hash)}`).digest("hex").slice(0,12).toUpperCase();
  return`FT-${flightId}-R${revision}-${digest}`;
}

export function credentialLines(value:unknown){
  const credentials=storedObject(value),licences=Array.isArray(credentials.licences)?credentials.licences:[],qualifications=Array.isArray(credentials.qualifications)?credentials.qualifications:[];
  const licenceLines=licences.map(item=>{const row=storedObject(item);return[text(row.licence_type),text(row.licence_number),text(row.authority)].filter(Boolean).join(" · ")}).filter(Boolean);
  const qualificationLines=qualifications.map(item=>{const row=storedObject(item);return[text(row.qualification_type),text(row.certificate_reference)].filter(Boolean).join(" · ")}).filter(Boolean);
  const manual=[text(credentials.licenceNumber),text(credentials.qualification),text(credentials.qualificationReference)].filter(Boolean).join(" · ");
  return{licences:licenceLines,qualifications:qualificationLines,manual};
}
