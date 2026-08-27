import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { unreadNotificationCount } from "@/lib/notifications";
import { sql } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __flytallyLegacyCleanup: Promise<void> | undefined;
}

async function cleanupLegacyData() {
  if (!globalThis.__flytallyLegacyCleanup) {
    globalThis.__flytallyLegacyCleanup = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS flytally_data_cleanups (
        cleanup_key TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      const appliedRows = await sql`SELECT cleanup_key FROM flytally_data_cleanups WHERE cleanup_key IN ('legacy-flight-380','legacy-instructor-approval-1')` as Array<{cleanup_key:string}>;
      const applied = new Set(appliedRows.map(row => row.cleanup_key));

      if (!applied.has('legacy-flight-380')) {
        await sql.transaction([
          sql`SELECT pg_advisory_xact_lock(3800311)`,
          sql`UPDATE flights SET locked_at=NULL,locked_by_user_id=NULL WHERE id=380 AND UPPER(TRIM(registration))='OK-BID' AND UPPER(TRIM(COALESCE(role,'')))='DUAL' AND certified_at IS NULL`,
          sql`DELETE FROM user_notifications WHERE href LIKE '/flights/380%'`,
          sql`DELETE FROM track_points WHERE track_id IN (SELECT id FROM flight_tracks WHERE flight_id=380)`,
          sql`DELETE FROM flight_tracks WHERE flight_id=380`,
          sql`DELETE FROM flight_verifications WHERE flight_id=380`,
          sql`DELETE FROM flight_certified_revisions WHERE flight_id=380`,
          sql`DELETE FROM flights WHERE id=380 AND UPPER(TRIM(registration))='OK-BID' AND UPPER(TRIM(COALESCE(role,'')))='DUAL' AND certified_at IS NULL`,
          sql`DELETE FROM flight_audit_log WHERE flight_id=380`,
          sql`INSERT INTO flytally_data_cleanups(cleanup_key) VALUES('legacy-flight-380') ON CONFLICT(cleanup_key) DO NOTHING`,
        ]);
      }

      if (!applied.has('legacy-instructor-approval-1')) {
        await sql.transaction([
          sql`SELECT pg_advisory_xact_lock(10010824)`,
          sql`DELETE FROM user_notifications WHERE href='/connections/flight/1' OR dedupe_key IN ('approval:1','approval-decision:1:approved','approval-signed:1')`,
          sql`DELETE FROM flight_verifications v USING instructor_flight_approvals a, flights f
              WHERE a.id=1 AND f.id=a.flight_id AND UPPER(TRIM(f.registration))='OK-BIN' AND f.date::text='2026-08-24'
                AND v.flight_id=a.flight_id AND v.flight_user_id=a.student_user_id AND v.signer_user_id=a.instructor_user_id AND v.record_revision=a.record_revision`,
          sql`DELETE FROM flight_participations p USING instructor_flight_approvals a, flights f
              WHERE a.id=1 AND f.id=a.flight_id AND UPPER(TRIM(f.registration))='OK-BIN' AND f.date::text='2026-08-24'
                AND p.source_flight_id=a.flight_id AND p.source_revision=a.record_revision AND p.participant_user_id=a.instructor_user_id AND p.participant_flight_id IS NULL`,
          sql`DELETE FROM instructor_flight_approvals a USING flights f
              WHERE a.id=1 AND f.id=a.flight_id AND UPPER(TRIM(f.registration))='OK-BIN' AND f.date::text='2026-08-24'`,
          sql`INSERT INTO flytally_data_cleanups(cleanup_key) VALUES('legacy-instructor-approval-1') ON CONFLICT(cleanup_key) DO NOTHING`,
        ]);
      }
    })().catch((error) => {
      globalThis.__flytallyLegacyCleanup = undefined;
      throw error;
    });
  }
  return globalThis.__flytallyLegacyCleanup;
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await cleanupLegacyData();
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  const unreadNotifications=await unreadNotificationCount(session.userId);
  return <AppShell role={session.role} unreadNotifications={unreadNotifications}>{children}</AppShell>;
}
