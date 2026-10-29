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
  // Reject malformed sections before accessing .length. In particular,
  // an absent track array must return a typed error rather than TypeError.
  if(!Array.isArray(payload.flights)||!Array.isArray(payload.flight_tracks)){
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
    // The v13 payload intentionally omits the deprecated track_points array.
    // The existing parser normalizes it to [] before ownership checks. Do
    // exactly the same in a temporary validator-only view; never add it to
    // the signed v13 payload or its declared counts.
    const view:PortableBackup={...payload,track_points:[],integrity:{
      algorithm:"SHA-256",payload_sha256:"",
    }};
    validateOwnership(view as unknown as Record<string,unknown>);
    validateBackupRelationships(view);
    validateBackupArchiveRelationships(view);

    // An unsigned in-memory view only: no digest, signature or JSON emitted.
    // These validators do not read the integrity field.
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
