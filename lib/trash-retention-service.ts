import "server-only";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import {
  positiveTrashOwnerId,requireLegacyTrashRetention,V22_OWNER_TRASH_RETENTION_MODE,
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
