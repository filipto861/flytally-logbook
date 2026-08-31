import "server-only";
import { verifyVerificationSignature } from "@/lib/verification-signature";

const text=(value:unknown)=>String(value??"").trim();
const integer=(value:unknown)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?parsed:0};
const object=(value:unknown):Record<string,unknown>=>{
  if(value&&typeof value==="object"&&!Array.isArray(value))return value as Record<string,unknown>;
  try{const parsed=JSON.parse(String(value??"{}"));return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{} }catch{return{}};
};

export type AircraftTrainingVerificationStatus="unsigned"|"pending"|"declined"|"verified"|"revoked"|"invalid";

export function aircraftTrainingVerificationPayload(row:Record<string,unknown>,credentialSnapshot:Record<string,unknown>,signerUserId:number|null){
  return{
    kind:"AIRCRAFT_TRAINING",
    version:Math.max(1,Number(row.verification_version)||1),
    recordId:integer(row.id),
    ownerUserId:integer(row.user_id),
    signerUserId:signerUserId&&Number.isSafeInteger(signerUserId)&&signerUserId>0?signerUserId:null,
    verificationRole:text(row.verification_role)||"INSTRUCTOR",
    training:{
      trainingKind:text(row.training_kind),
      classOrType:text(row.qualification_type),
      certificateReference:text(row.certificate_reference),
      linkedLicenceId:integer(row.linked_licence_id)||null,
      aircraftMake:text(row.aircraft_make),
      aircraftModel:text(row.aircraft_model),
      aircraftVariant:text(row.aircraft_variant),
      differences:text(row.differences),
      completedOn:text(row.completed_on).slice(0,10),
      instructorName:text(row.instructor_name),
      trainingOrganisation:text(row.training_organisation),
      notes:text(row.notes),
    },
    credentialSnapshot,
  } as Record<string,unknown>;
}

export function aircraftTrainingVerificationStatus(row:Record<string,unknown>):AircraftTrainingVerificationStatus{
  const stored=text(row.signature_status).toLowerCase();
  if(stored==="revoked")return"revoked";
  if(!row.verified_at){if(stored==="pending")return"pending";if(stored==="declined")return"declined";return"unsigned"}
  const snapshot=object(row.verification_snapshot),signer=integer(row.verified_by_user_id)||null,signature=text(row.verification_signature);
  if(!signature||!Object.keys(snapshot).length)return"invalid";
  try{return verifyVerificationSignature(aircraftTrainingVerificationPayload(row,snapshot,signer),signature)?"verified":"invalid"}catch{return"invalid"}
}

export function aircraftTrainingCredentialSnapshot(value:unknown){return object(value)}
