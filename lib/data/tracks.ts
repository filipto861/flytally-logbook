import "server-only";
import { sql } from "@/lib/db";

export type TrackPoint = { lat: number; lon: number; alt?: number; time?: string };
export type MapTrack = {
  id: number; flightId: number; date: string; registration: string; departure: string;
  arrival: string; evidence: string; distanceKm: number; points: TrackPoint[];
};

function decodePoints(payload: unknown, maxPoints: number): TrackPoint[] {
  try {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!Array.isArray(parsed)) return [];
    const valid: TrackPoint[] = [];
    for (const item of parsed) {
      const lat = Number(item?.lat); const lon = Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      const point: TrackPoint = { lat, lon };
      const alt = Number(item?.alt); if (Number.isFinite(alt)) point.alt = alt;
      if (item?.time) point.time = String(item.time);
      valid.push(point);
    }
    if (valid.length <= maxPoints) return valid;
    const stride = Math.max(1, Math.ceil(valid.length / maxPoints));
    const sampled = valid.filter((_, index) => index === 0 || index === valid.length - 1 || index % stride === 0);
    return sampled.slice(0, maxPoints - 1).concat(valid.at(-1)!);
  } catch { return []; }
}

export async function getOverviewTracks(userId: number, limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = await sql`
    SELECT t.id, t.flight_id, t.overview_coordinates_json, COALESCE(t.distance_km,0) AS distance_km,
           f.date, COALESCE(f.registration,'') AS registration, COALESCE(f.departure,'') AS departure,
           COALESCE(f.arrival,'') AS arrival, COALESCE(f.evidence,'') AS evidence,
           COUNT(*) OVER()::integer AS total_tracks,
           COALESCE(SUM(COALESCE(t.distance_km,0)) OVER(),0) AS total_distance_km
    FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id
    WHERE t.user_id=${userId} AND t.overview_coordinates_json IS NOT NULL
      AND t.overview_coordinates_json<>''
    ORDER BY f.date DESC, f.off_block DESC NULLS LAST, t.id DESC LIMIT ${safeLimit}
  ` as Array<Record<string, unknown>>;
  const tracks: MapTrack[] = rows.map((row) => ({
    id: Number(row.id), flightId: Number(row.flight_id), date: String(row.date ?? ""),
    registration: String(row.registration ?? ""), departure: String(row.departure ?? ""),
    arrival: String(row.arrival ?? ""), evidence: String(row.evidence ?? ""),
    distanceKm: Number(row.distance_km ?? 0), points: decodePoints(row.overview_coordinates_json, 140),
  })).filter((track) => track.points.length >= 2);
  return { tracks, total: Number(rows[0]?.total_tracks ?? 0), totalDistanceKm: Number(rows[0]?.total_distance_km ?? 0) };
}

export async function getFlightTracks(userId: number, flightId: number) {
  const rows = await sql`
    SELECT id,flight_id,coordinates_json,COALESCE(distance_km,0) AS distance_km
    FROM flight_tracks WHERE user_id=${userId} AND flight_id=${flightId} ORDER BY id
  ` as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: Number(row.id), flightId: Number(row.flight_id), date: "", registration: "", departure: "",
    arrival: "", evidence: "", distanceKm: Number(row.distance_km ?? 0),
    points: decodePoints(row.coordinates_json, 2500),
  } satisfies MapTrack)).filter((track) => track.points.length >= 2);
}
