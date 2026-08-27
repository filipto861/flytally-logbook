import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { ensureDatabaseOptimizations } from "@/lib/db-optimization";
import { unreadNotificationCount } from "@/lib/notifications";
import { sql } from "@/lib/db";

declare global {
  // eslint-disable-next-line no-var
  var __flytallyLegacyFlight380Cleanup: Promise<void> | undefined;
}

async function cleanupLegacyFlight380() {
  if (!globalThis.__flytallyLegacyFlight380Cleanup) {
    globalThis.__flytallyLegacyFlight380Cleanup = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS flytally_data_cleanups (
        cleanup_key TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      const applied = await sql`SELECT cleanup_key FROM flytally_data_cleanups WHERE cleanup_key='legacy-flight-380' LIMIT 1` as Array<{cleanup_key:string}>;
      if (applied[0]) return;

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
    })().catch((error) => {
      globalThis.__flytallyLegacyFlight380Cleanup = undefined;
      throw error;
    });
  }
  return globalThis.__flytallyLegacyFlight380Cleanup;
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await cleanupLegacyFlight380();
  const session=await requireUser();
  await ensureDatabaseOptimizations();
  const unreadNotifications=await unreadNotificationCount(session.userId);
  return <AppShell role={session.role} unreadNotifications={unreadNotifications}>{children}</AppShell>;
}