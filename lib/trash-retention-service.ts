import "server-only";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import {
  positiveTrashOwnerId,requireLegacyTrashRetention,requireV22TrashRetentionApproved,V22_OWNER_TRASH_RETENTION_MODE,
} from "@/lib/v22-trash-retention-mode";

// Both existing expiry entrypoints pass through this boundary. The V22 owner
// writer is NOT enabled: until exact-schema/auth/Neon/legal acceptance, any
// attempt to change its source-frozen state must fail BEFORE issuing SQL.
// No legacy archive UID is minted or inferred here.
function requireV21Compatibility(){
  requireLegacyTrashRetention(V22_OWNER_TRASH_RETENTION_MODE);
}

// The pilot's owner is derived independently from an active authenticated
// session, not trusted merely because a caller passes an integer user ID.
export async function expireTrashForAuthenticatedPilot(ownerId:number):Promise<void>{
  const owner=positiveTrashOwnerId(ownerId);
  const session=await requireUser();
  if(session.userId!==owner) {
    throw new Error("Trash retention owner differs from authenticated session.");
  }
  requireV21Compatibility();
  // Keep the V21 on-read, owner-scoped expiration statement unchanged.
  await sql`DELETE FROM deleted_flights WHERE user_id=${owner} AND purge_after<=NOW()`;
}

// The caller must supply the original CRON request's Authorization header.
// The route checks it first, and the service rechecks it before returning
// any query object or allowing unrelated privacy-retention mutations.
export function authorizedCronTrashExpiryStatement(authorization:unknown){
  if(!cronRequestAuthorized(process.env.CRON_SECRET,authorization)) {
    throw new Error("Unauthorized scheduled Trash retention.");
  }
  requireV21Compatibility();
  // Preserve this statement INSIDE the existing V21 privacy transaction.
// V22 will replace it with bounded per-owner batches once approved.
  return sql`DELETE FROM deleted_flights WHERE purge_after<=NOW()`;
}


// PROPOSED V22 adapter: compiled but not invoked by the existing V21 pilot or
// CRON paths. Source-frozen OFF causes throw BEFORE candidate SQL execution.
// The SQL function is test-only and deliberately cannot be installed remotely.
function requireV22Candidate(){
  requireV22TrashRetentionApproved(V22_OWNER_TRASH_RETENTION_MODE);
}
async function expireV22OwnerBatchCandidate(ownerId:number):Promise<number>{
  const owner=positiveTrashOwnerId(ownerId);
  const rows=(await sql`SELECT public.logbook_v22_expire_owner_candidate(${owner},25) AS expired_count`) as Array<{expired_count:number|string}>;
  const count=Number(rows[0]?.expired_count);
  if(!Number.isSafeInteger(count)||count<0||count>25){
    throw new Error("V22 expiry returned an invalid bounded result.");
  }
  return count;
}
export async function proposedV22ExpireForAuthenticatedPilot(ownerId:number):Promise<number>{
  const owner=positiveTrashOwnerId(ownerId);
  const session=await requireUser();
  if(session.userId!==owner)throw new Error("V22 pilot/owner authorization mismatch.");
  requireV22Candidate();
  return expireV22OwnerBatchCandidate(owner);
}
export async function proposedV22ExpireForAuthorizedCron(authorization:unknown):
  Promise<{owners:number;expired:number}>{
  if(!cronRequestAuthorized(process.env.CRON_SECRET,authorization)){
    throw new Error("Unauthorized V22 scheduled Trash retention.");
  }
  requireV22Candidate();
  // Fresh, deterministic, bounded account list. No global owner=NULL writer.
  const eligible=(await sql`SELECT DISTINCT user_id FROM deleted_flights
    WHERE purge_after<=NOW() ORDER BY user_id LIMIT 25`) as Array<{user_id:number|string}>;
  let expired=0;
  for(const row of eligible){
    expired+=await expireV22OwnerBatchCandidate(positiveTrashOwnerId(Number(row.user_id)));
  }
  return{owners:eligible.length,expired};
}
