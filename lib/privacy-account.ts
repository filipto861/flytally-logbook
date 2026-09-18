import "server-only";
import { sql } from "@/lib/db";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { countActiveFlightShares, ensureFlightSharingSchema, purgeRevokedFlightShares, revokeAllFlightShares } from "@/lib/flight-sharing";

export type AccountPrivacySummary=Readonly<{
  activePublicShares:number;
  storedBackups:number;
  gpsTracks:number;
  deletedFlightCopies:number;
  expenses:number;
  coreFlightRecords:number;
  fstdRecords:number;
  signedEvidence:number;
}>;

const n=(value:unknown)=>Number(value)||0;

export async function getAccountPrivacySummary(userId:number):Promise<AccountPrivacySummary>{
  await Promise.all([ensureDatabaseOptimizations(),ensureFlightSharingSchema()]);
  const [activePublicShares,rows]=await Promise.all([
    countActiveFlightShares(userId),
    sql`SELECT
      (SELECT COUNT(*) FROM account_backups WHERE user_id=${userId}) stored_backups,
      (SELECT COUNT(*) FROM flight_tracks WHERE user_id=${userId}) gps_tracks,
      (SELECT COUNT(*) FROM deleted_flights WHERE user_id=${userId} AND restored_at IS NULL AND purge_after>NOW()) deleted_flight_copies,
      (SELECT COUNT(*) FROM flight_expenses WHERE user_id=${userId}) expenses,
      (SELECT COUNT(*) FROM flights WHERE user_id=${userId}) core_flight_records,
      (SELECT COUNT(*) FROM fstd_sessions WHERE user_id=${userId}) fstd_records,
      (SELECT COUNT(*) FROM flight_verifications WHERE status='signed' AND (flight_user_id=${userId} OR signer_user_id=${userId})) signed_evidence` as unknown as Array<Record<string,unknown>>,
  ]);
  const row=rows[0]??{};
  return{
    activePublicShares,storedBackups:n(row.stored_backups),gpsTracks:n(row.gps_tracks),
    deletedFlightCopies:n(row.deleted_flight_copies),expenses:n(row.expenses),
    coreFlightRecords:n(row.core_flight_records),fstdRecords:n(row.fstd_records),signedEvidence:n(row.signed_evidence),
  };
}

export async function revokeAccountPublicShares(userId:number){await revokeAllFlightShares(userId)}

export async function runPrivacyRetentionSweep(){
  await Promise.all([ensureDatabaseOptimizations(),ensureFlightSharingSchema()]);
  await purgeRevokedFlightShares();
  await sql.transaction([
    sql`DELETE FROM deleted_flights WHERE purge_after<=NOW()`,
    sql`DELETE FROM auth_password_resets WHERE expires_at<NOW()-INTERVAL '30 days' OR (used_at IS NOT NULL AND used_at<NOW()-INTERVAL '30 days')`,
    sql`DELETE FROM auth_sessions WHERE expires_at<NOW()-INTERVAL '30 days' OR (revoked_at IS NOT NULL AND revoked_at<NOW()-INTERVAL '30 days')`,
    sql`DELETE FROM auth_events WHERE event_at<NOW()-INTERVAL '90 days'`,
  ]);
}

export async function eraseAccountForPrivacy(userId:number){
  await Promise.all([ensureDatabaseOptimizations(),ensureFlightSharingSchema()]);
  const replacement=`deleted-${userId}@flytally.invalid`;
  await sql.transaction([
    sql`UPDATE pilot_connections SET status='cancelled',revoked_at=COALESCE(revoked_at,NOW()),updated_at=NOW(),requester_shares_logbook=CASE WHEN requester_user_id=${userId} THEN FALSE ELSE requester_shares_logbook END,recipient_shares_logbook=CASE WHEN recipient_user_id=${userId} THEN FALSE ELSE recipient_shares_logbook END,requester_label=CASE WHEN requester_user_id=${userId} THEN 'Deleted pilot' ELSE requester_label END,recipient_label=CASE WHEN recipient_user_id=${userId} THEN 'Deleted pilot' ELSE recipient_label END WHERE requester_user_id=${userId} OR recipient_user_id=${userId}`,
    sql`UPDATE flight_participations SET status='cancelled',cancelled_at=COALESCE(cancelled_at,NOW()),responded_at=COALESCE(responded_at,NOW()),decision_note='Account deleted.' WHERE status='pending' AND (source_user_id=${userId} OR participant_user_id=${userId})`,
    sql`UPDATE instructor_flight_approvals SET status='cancelled',decided_at=COALESCE(decided_at,NOW()),decision_note='Account deleted.' WHERE status='pending' AND (student_user_id=${userId} OR instructor_user_id=${userId})`,
    sql`UPDATE flight_verifications SET status='cancelled',cancelled_at=COALESCE(cancelled_at,NOW()),decision_note='Account deleted.' WHERE status='pending' AND (flight_user_id=${userId} OR signer_user_id=${userId})`,
    sql`UPDATE connection_audit_log SET details='{}'::jsonb WHERE actor_user_id=${userId} OR subject_user_id=${userId}`,
    sql`DELETE FROM flight_public_shares WHERE user_id=${userId}`,
    sql`DELETE FROM account_backups WHERE user_id=${userId}`,
    sql`DELETE FROM deleted_flights WHERE user_id=${userId}`,
    sql`DELETE FROM track_points WHERE user_id=${userId}`,
    sql`DELETE FROM flight_tracks WHERE user_id=${userId}`,
    sql`DELETE FROM flight_expenses WHERE user_id=${userId}`,
    sql`DELETE FROM bpl_recency_evidence WHERE user_id=${userId}`,
    sql`DELETE FROM helicopter_recency_evidence WHERE user_id=${userId}`,
    sql`DELETE FROM spl_recency_evidence WHERE user_id=${userId}`,
    sql`DELETE FROM pilot_qualifications WHERE user_id=${userId}`,
    sql`DELETE FROM pilot_licences WHERE user_id=${userId}`,
    sql`DELETE FROM user_expiries WHERE user_id=${userId}`,
    sql`DELETE FROM rates WHERE user_id=${userId}`,
    sql`DELETE FROM airports WHERE user_id=${userId}`,
    sql`DELETE FROM aircraft WHERE user_id=${userId}`,
    sql`DELETE FROM user_settings WHERE user_id=${userId}`,
    sql`DELETE FROM user_notifications WHERE user_id=${userId}`,
    sql`DELETE FROM auth_password_resets WHERE user_id=${userId}`,
    sql`DELETE FROM auth_identities WHERE user_id=${userId}`,
    sql`DELETE FROM user_credentials WHERE user_id=${userId}`,
    sql`DELETE FROM auth_sessions WHERE user_id=${userId}`,
    sql`DELETE FROM auth_events WHERE user_id=${userId}`,
    sql`UPDATE users SET active=0,email=${replacement},display_name='Deleted pilot',slug=${`deleted-${userId}`},deleted_at=NOW(),updated_at=NOW() WHERE id=${userId}`,
  ]);
}
