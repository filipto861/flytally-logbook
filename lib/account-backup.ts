import "server-only";
import { sql } from "@/lib/db";
import { DATABASE_SCHEMA_VERSION } from "@/lib/migration-plan";
import { portableBackupDigest,type BackupRow,type PortableBackup } from "@/lib/portable-backup";

export async function buildAccountBackup(userId:number):Promise<{backup:PortableBackup;json:string;digest:string}>{
  const [flights,aircraft,rates,airports,expiries,settings,tracks,trackPoints,audit,fstdSessions,flightRevisions,fstdRevisions,deletedFlights,connections,participations,approvals,licences,qualifications,notifications,verifications,connectionAudit,user]=await Promise.all([
    sql`SELECT * FROM flights WHERE user_id=${userId} ORDER BY date,off_block,id`,
    sql`SELECT * FROM aircraft WHERE user_id=${userId} ORDER BY registration,id`,
    sql`SELECT * FROM rates WHERE user_id=${userId} ORDER BY registration,valid_from,id`,
    sql`SELECT * FROM airports WHERE user_id=${userId} ORDER BY ident,id`,
    sql`SELECT * FROM user_expiries WHERE user_id=${userId} ORDER BY expiry_date,id`,
    sql`SELECT * FROM user_settings WHERE user_id=${userId}`,
    sql`SELECT * FROM flight_tracks WHERE user_id=${userId} ORDER BY id`,
    sql`SELECT p.* FROM track_points p JOIN flight_tracks t ON t.id=p.track_id AND t.user_id=p.user_id WHERE p.user_id=${userId} ORDER BY p.track_id,p.seq`,
    sql`SELECT * FROM flight_audit_log WHERE user_id=${userId} ORDER BY changed_at,id`,
    sql`SELECT * FROM fstd_sessions WHERE user_id=${userId} ORDER BY session_date,id`,
    sql`SELECT * FROM flight_certified_revisions WHERE user_id=${userId} ORDER BY flight_id,revision_number,id`,
    sql`SELECT * FROM fstd_certified_revisions WHERE user_id=${userId} ORDER BY fstd_session_id,revision_number,id`,
    sql`SELECT * FROM deleted_flights WHERE user_id=${userId} AND restored_at IS NULL AND purge_after>NOW() ORDER BY deleted_at,id`,
    sql`SELECT * FROM pilot_connections WHERE requester_user_id=${userId} OR recipient_user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM flight_participations WHERE source_user_id=${userId} OR participant_user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM instructor_flight_approvals WHERE student_user_id=${userId} OR instructor_user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM pilot_licences WHERE user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM pilot_qualifications WHERE user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM user_notifications WHERE user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM flight_verifications WHERE flight_user_id=${userId} OR signer_user_id=${userId} ORDER BY id`,
    sql`SELECT * FROM connection_audit_log WHERE actor_user_id=${userId} OR subject_user_id=${userId} ORDER BY id`,
    sql`SELECT id,email,display_name,slug,role,created_at,updated_at FROM users WHERE id=${userId}`,
  ]) as Array<Array<BackupRow>>;
  const counts={flights:flights.length,aircraft:aircraft.length,rates:rates.length,airports:airports.length,expiries:expiries.length,settings:settings.length,flight_tracks:tracks.length,track_points:trackPoints.length,audit_log:audit.length,fstd_sessions:fstdSessions.length,flight_certified_revisions:flightRevisions.length,fstd_certified_revisions:fstdRevisions.length,deleted_flights:deletedFlights.length,pilot_connections:connections.length,flight_participations:participations.length,instructor_flight_approvals:approvals.length,pilot_licences:licences.length,pilot_qualifications:qualifications.length,user_notifications:notifications.length,flight_verifications:verifications.length,connection_audit_log:connectionAudit.length};
  const payload={format:"pilot-logbook-portable",version:7,schema_version:DATABASE_SCHEMA_VERSION,exported_at:new Date().toISOString(),profile:user[0]??{},counts,flights,aircraft,rates,airports,expiries,settings,flight_tracks:tracks,track_points:trackPoints,audit_log:audit,fstd_sessions:fstdSessions,flight_certified_revisions:flightRevisions,fstd_certified_revisions:fstdRevisions,deleted_flights:deletedFlights,pilot_connections:connections,flight_participations:participations,instructor_flight_approvals:approvals,pilot_licences:licences,pilot_qualifications:qualifications,user_notifications:notifications,flight_verifications:verifications,connection_audit_log:connectionAudit};
  const digest=await portableBackupDigest(JSON.stringify(payload)),backup={...payload,integrity:{algorithm:"SHA-256",payload_sha256:digest}} satisfies PortableBackup;
  return{backup,json:JSON.stringify(backup,null,2),digest};
}
