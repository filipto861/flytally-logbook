import { signVerificationPayload,verifyVerificationSignature } from "./verification-signature.ts";

export type BackupAuthenticityStatus="verified"|"unsigned"|"invalid";
export type BackupAuthenticityInput={version:number;profile:Record<string,unknown>;integrity:{signature_version?:number;server_signature?:string}};
export const SERVER_AUTHORITATIVE_BACKUP_SECTIONS:ReadonlySet<string>=new Set(["pilot_connections","instructor_flight_approvals","flight_participations","flight_verifications","connection_audit_log"]);

const signaturePayload=(version:number,sourceUserId:number,digest:string)=>({purpose:"flytally-portable-backup",signatureVersion:1,backupVersion:Math.trunc(version),sourceUserId:Math.trunc(sourceUserId),payloadSha256:String(digest)});
const validDigest=(value:string)=>/^[a-f0-9]{64}$/.test(value);

export function signPortableBackup(version:number,sourceUserId:number,digest:string){
  if(!Number.isSafeInteger(sourceUserId)||sourceUserId<=0||!validDigest(digest))throw new Error("Backup signing input is not valid.");
  return signVerificationPayload(signaturePayload(version,sourceUserId,digest));
}

export function portableBackupAuthenticity(backup:BackupAuthenticityInput,digest:string):BackupAuthenticityStatus{
  const signature=String(backup.integrity?.server_signature??"").trim(),signatureVersion=Number(backup.integrity?.signature_version||0),sourceUserId=Number(backup.profile?.id||0);
  if(!signature)return Number(backup.version)>=12?"invalid":"unsigned";
  if(signatureVersion!==1||!Number.isSafeInteger(sourceUserId)||sourceUserId<=0||!validDigest(digest))return"invalid";
  try{return verifyVerificationSignature(signaturePayload(backup.version,sourceUserId,digest),signature)?"verified":"invalid"}catch{return"invalid"}
}
