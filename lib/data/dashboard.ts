import "server-only";
import { cache } from "react";
import { sql } from "@/lib/db";

export type DashboardData = {
  displayName: string;
  totalMinutes: number;
  picMinutes: number;
  ullMinutes: number;
  easaMinutes: number;
  landings: number;
  flights: number;
};

// React cache deduplicates repeated access during one server render. We avoid a
// shared cross-user cache for private pilot data.
export const getDashboardData = cache(async (userId: number): Promise<DashboardData> => {
  const rows = await sql`
    WITH normalized AS (
      SELECT
        evidence,
        role,
        COALESCE(starts, 0)::integer AS starts,
        CASE
          WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
           AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN MOD(
            (split_part(on_block, ':', 1)::integer * 60 + split_part(on_block, ':', 2)::integer)
            - (split_part(off_block, ':', 1)::integer * 60 + split_part(off_block, ':', 2)::integer)
            + 1440,
            1440
          )
          ELSE 0
        END AS block_minutes
      FROM flights
      WHERE user_id = ${userId}
    )
    SELECT
      u.display_name,
      COUNT(n.*)::integer AS flights,
      COALESCE(SUM(n.block_minutes), 0)::integer AS total_minutes,
      COALESCE(SUM(n.block_minutes) FILTER (WHERE UPPER(n.role) = 'PIC'), 0)::integer AS pic_minutes,
      COALESCE(SUM(n.block_minutes) FILTER (WHERE UPPER(n.evidence) = 'ULL'), 0)::integer AS ull_minutes,
      COALESCE(SUM(n.block_minutes) FILTER (WHERE UPPER(n.evidence) = 'EASA'), 0)::integer AS easa_minutes,
      COALESCE(SUM(n.starts), 0)::integer AS landings
    FROM users u
    LEFT JOIN normalized n ON TRUE
    WHERE u.id = ${userId}
    GROUP BY u.id, u.display_name
  ` as Array<Record<string, string | number>>;
  const row = rows[0] ?? {};
  return {
    displayName: String(row.display_name ?? "Pilot"),
    flights: Number(row.flights ?? 0),
    totalMinutes: Number(row.total_minutes ?? 0),
    picMinutes: Number(row.pic_minutes ?? 0),
    ullMinutes: Number(row.ull_minutes ?? 0),
    easaMinutes: Number(row.easa_minutes ?? 0),
    landings: Number(row.landings ?? 0),
  };
});

export function formatDuration(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}
