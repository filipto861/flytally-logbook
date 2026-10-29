import type {PortableBackup} from "./portable-backup.ts";
import {
  portableBackupRequiredSections,
  validateOwnership,
  validateBackupRelationships,
  validateBackupArchiveRelationships,
  validateVoidHistoryRelationships,
  validateVoidHistoryDigests,
  validateBackupMonetaryEvidence,
} from "./portable-backup.ts";
import {validateBackupCertificationHistory} from "./backup-certification.ts";

/**
 * DATA-1C: validate the exact v13 payload before calculating its digest or
 * attaching a server signature. Reuse the existing restore/parser contracts;
 * never attempt to repair or infer missing aviation evidence.
 *
 * A valid single MVCC snapshot can still contain an unrecoverable state if a
 * writer commits a multi-step restore in separate transactions.
 */
export class AccountBackupPreSignError extends Error{
  readonly code:"UNRESTORABLE_SOURCE"|"LIMIT_EXCEEDED";
  constructor(code:"UNRESTORABLE_SOURCE"|"LIMIT_EXCEEDED"){
    super(code==="LIMIT_EXCEEDED"
      ?"Account backup exceeds the supported recovery limits; no backup was signed."
      :"Account backup failed recovery-integrity validation; no backup was signed.");
    this.name="AccountBackupPreSignError";
    this.code=code;
  }
}

export async function validateAccountBackupBeforeSigning(
  payload:Omit<PortableBackup,"integrity">,
  userId:number,
):Promise<void>{
  if(!Number.isSafeInteger(userId)||userId<=0||payload.version!==13
    ||payload.format!=="pilot-logbook-portable"){
    throw new AccountBackupPreSignError("UNRESTORABLE_SOURCE");
  }
  // Match the parser's existing limits. The reader must not produce a
  // successfully signed archive that recovery immediately refuses.
  if(payload.flights.length>20_000||payload.flight_tracks.length>30_000){
    throw new AccountBackupPreSignError("LIMIT_EXCEEDED");
  }
  try{
    for(const key of portableBackupRequiredSections(payload.version)){
      const value=(payload as Record<string,unknown>)[key];
      if(!Array.isArray(value)
        ||Number(payload.counts[key])!==value.length){
        throw new Error("Missing or inconsistent portable backup section.");
      }
    }

    // These are the same source ownership and structural rules applied by
    // parsePortableBackup. Shared counterpart records are checked against
    // their relevant participant/actor fields, not assigned to this account.
    validateOwnership(payload as Record<string,unknown>);
    validateBackupRelationships(payload);
    validateBackupArchiveRelationships(payload);

    // An unsigned in-memory view only: no digest, signature or JSON emitted.
    // These validators do not read the integrity field.
    const view:PortableBackup={...payload,integrity:{
      algorithm:"SHA-256",payload_sha256:"",
    }};
    validateVoidHistoryRelationships(view);
    await validateVoidHistoryDigests(view);
    validateBackupCertificationHistory(view,userId);
    const monetaryError=validateBackupMonetaryEvidence(view);
    if(monetaryError)throw new Error("Exact monetary evidence is inconsistent.");
  }catch{
    // Do not expose specific flight identifiers, verification values,
    // account data or GPS history through a public backup error.
    throw new AccountBackupPreSignError("UNRESTORABLE_SOURCE");
  }
}
