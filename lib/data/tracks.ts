import "server-only";
import { sql } from "@/lib/db";

export type TrackPoint = { lat: number; lon: number; alt?: number; time?: string };
export type MapTrack = {
  id: number; flightId: number; date: string; registration: string; departure: string;
  arrival: string; evidence: string; distanceKm: number; points: TrackPoint[];
  departurePoint?: TrackPoint; arrivalPoint?: TrackPoint;
};
export type RouteLine={departure:string;arrival:string;flights:number;minutes:number;from:MapAirport;to:MapAirport};
export type MapAirport={ident:string;name:string;lat:number;lon:number;flights:number};

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

export type MapFilters={registration?:string;evidence?:string;airport?:string;route?:string;year?:string};
export async function getOverviewTracks(userId: number, limit = 100,filters:MapFilters={}) {
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const registration=filters.registration?.trim()||null,evidence=filters.evidence?.trim()||null,airport=filters.airport?.trim()||null,route=filters.route?.trim()||null,year=filters.year?.trim()||null;
  const rows = await sql`
    SELECT t.id, t.flight_id, t.overview_coordinates_json, COALESCE(t.distance_km,0) AS distance_km,
           f.date, COALESCE(f.registration,'') AS registration, COALESCE(f.departure,'') AS departure,
           COALESCE(f.arrival,'') AS arrival, COALESCE(f.evidence,'') AS evidence,
           dep.latitude_deg dep_lat,dep.longitude_deg dep_lon,arr.latitude_deg arr_lat,arr.longitude_deg arr_lon,
           COUNT(*) OVER()::integer AS total_tracks,
           COALESCE(SUM(COALESCE(t.distance_km,0)) OVER(),0) AS total_distance_km
    FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id
    LEFT JOIN airports dep ON dep.user_id=f.user_id AND UPPER(dep.ident)=UPPER(f.departure) AND dep.active=1
    LEFT JOIN airports arr ON arr.user_id=f.user_id AND UPPER(arr.ident)=UPPER(f.arrival) AND arr.active=1
    WHERE t.user_id=${userId} AND t.overview_coordinates_json IS NOT NULL
      AND t.overview_coordinates_json<>''
      AND (${registration}::text IS NULL OR UPPER(f.registration)=UPPER(${registration}::text))
      AND (${evidence}::text IS NULL OR UPPER(f.evidence)=UPPER(${evidence}::text))
      AND (${airport}::text IS NULL OR UPPER(f.departure)=UPPER(${airport}::text) OR UPPER(f.arrival)=UPPER(${airport}::text))
      AND (${route}::text IS NULL OR UPPER(CONCAT(f.departure,'→',f.arrival))=UPPER(${route}::text))
      AND (${year}::text IS NULL OR EXTRACT(YEAR FROM f.date::date)::text=${year}::text)
    ORDER BY f.date DESC, f.off_block DESC NULLS LAST, t.id DESC LIMIT ${safeLimit}
  ` as Array<Record<string, unknown>>;
  const tracks: MapTrack[] = rows.map((row) => ({
    id: Number(row.id), flightId: Number(row.flight_id), date: String(row.date ?? ""),
    registration: String(row.registration ?? ""), departure: String(row.departure ?? ""),
    arrival: String(row.arrival ?? ""), evidence: String(row.evidence ?? ""),
    distanceKm: Number(row.distance_km ?? 0), points: decodePoints(row.overview_coordinates_json, 140),
    departurePoint:airportPoint(row.dep_lat,row.dep_lon),arrivalPoint:airportPoint(row.arr_lat,row.arr_lon),
  })).filter((track) => track.points.length >= 2);
  return { tracks, total: Number(rows[0]?.total_tracks ?? 0), totalDistanceKm: Number(rows[0]?.total_distance_km ?? 0) };
}

export async function getMapFilterOptions(userId:number){const [regs,evidence,airports,routes,years]=await Promise.all([sql`SELECT DISTINCT UPPER(TRIM(registration)) value FROM flights WHERE user_id=${userId} AND NULLIF(TRIM(registration),'') IS NOT NULL ORDER BY 1`,sql`SELECT DISTINCT UPPER(TRIM(evidence)) value FROM flights WHERE user_id=${userId} AND NULLIF(TRIM(evidence),'') IS NOT NULL ORDER BY 1`,sql`SELECT value FROM (SELECT UPPER(TRIM(departure)) value FROM flights WHERE user_id=${userId} UNION SELECT UPPER(TRIM(arrival)) value FROM flights WHERE user_id=${userId}) a WHERE value<>'' ORDER BY 1`,sql`SELECT DISTINCT UPPER(TRIM(departure))||'→'||UPPER(TRIM(arrival)) value FROM flights WHERE user_id=${userId} AND NULLIF(TRIM(departure),'') IS NOT NULL AND NULLIF(TRIM(arrival),'') IS NOT NULL ORDER BY 1`,sql`SELECT DISTINCT EXTRACT(YEAR FROM date::date)::int value FROM flights WHERE user_id=${userId} ORDER BY 1 DESC`]) as Array<Array<Record<string,unknown>>>;const v=(r:Array<Record<string,unknown>>)=>r.map(x=>String(x.value??""));return{registrations:v(regs),evidence:v(evidence),airports:v(airports),routes:v(routes),years:v(years)}}

export async function getFlightTracks(userId: number, flightId: number) {
  const rows = await sql`
    SELECT t.id,t.flight_id,t.coordinates_json,COALESCE(t.distance_km,0) AS distance_km,
      f.date,COALESCE(f.registration,'') registration,COALESCE(f.departure,'') departure,COALESCE(f.arrival,'') arrival,COALESCE(f.evidence,'') evidence,
      dep.latitude_deg dep_lat,dep.longitude_deg dep_lon,arr.latitude_deg arr_lat,arr.longitude_deg arr_lon
    FROM flight_tracks t JOIN flights f ON f.id=t.flight_id AND f.user_id=t.user_id
    LEFT JOIN airports dep ON dep.user_id=f.user_id AND UPPER(dep.ident)=UPPER(f.departure) AND dep.active=1
    LEFT JOIN airports arr ON arr.user_id=f.user_id AND UPPER(arr.ident)=UPPER(f.arrival) AND arr.active=1
    WHERE t.user_id=${userId} AND t.flight_id=${flightId} ORDER BY t.id
  ` as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: Number(row.id), flightId: Number(row.flight_id), date: String(row.date??""), registration: String(row.registration??""), departure: String(row.departure??""),
    arrival: String(row.arrival??""), evidence: String(row.evidence??""), distanceKm: Number(row.distance_km ?? 0),
    points: decodePoints(row.coordinates_json, 2500),
    departurePoint:airportPoint(row.dep_lat,row.dep_lon),arrivalPoint:airportPoint(row.arr_lat,row.arr_lon),
  } satisfies MapTrack)).filter((track) => track.points.length >= 2);
}

function airportPoint(lat:unknown,lon:unknown):TrackPoint|undefined{const a=Number(lat),o=Number(lon);return Number.isFinite(a)&&Number.isFinite(o)?{lat:a,lon:o}:undefined}

export async function getRouteOverview(userId:number,filters:MapFilters={}){
  const registration=filters.registration?.trim()||null,evidence=filters.evidence?.trim()||null,airport=filters.airport?.trim()||null,route=filters.route?.trim()||null,year=filters.year?.trim()||null;
  const base=sql`SELECT UPPER(TRIM(f.departure)) departure,UPPER(TRIM(f.arrival)) arrival,
    CASE WHEN f.off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END minutes
    FROM flights f WHERE f.user_id=${userId} AND NULLIF(TRIM(f.departure),'') IS NOT NULL AND NULLIF(TRIM(f.arrival),'') IS NOT NULL
    AND (${registration}::text IS NULL OR UPPER(f.registration)=UPPER(${registration}::text)) AND (${evidence}::text IS NULL OR UPPER(f.evidence)=UPPER(${evidence}::text))
    AND (${airport}::text IS NULL OR UPPER(f.departure)=UPPER(${airport}::text) OR UPPER(f.arrival)=UPPER(${airport}::text))
    AND (${route}::text IS NULL OR UPPER(CONCAT(f.departure,'→',f.arrival))=UPPER(${route}::text)) AND (${year}::text IS NULL OR EXTRACT(YEAR FROM f.date::date)::text=${year}::text)`;
  const [routeRows,airportRows]=await Promise.all([
    sql`WITH b AS (${base}),r AS (SELECT departure,arrival,COUNT(*)::int flights,SUM(minutes)::int minutes FROM b GROUP BY 1,2) SELECT r.*,d.name dep_name,d.latitude_deg dep_lat,d.longitude_deg dep_lon,a.name arr_name,a.latitude_deg arr_lat,a.longitude_deg arr_lon FROM r JOIN airports d ON d.user_id=${userId} AND UPPER(d.ident)=r.departure AND d.active=1 JOIN airports a ON a.user_id=${userId} AND UPPER(a.ident)=r.arrival AND a.active=1 ORDER BY flights DESC,departure,arrival`,
    sql`WITH b AS (${base}),movements AS (SELECT departure ident FROM b UNION ALL SELECT arrival FROM b),m AS (SELECT ident,COUNT(*)::int flights FROM movements GROUP BY ident) SELECT m.ident,COALESCE(a.name,'') name,a.latitude_deg lat,a.longitude_deg lon,m.flights FROM m JOIN airports a ON a.user_id=${userId} AND UPPER(a.ident)=m.ident AND a.active=1 ORDER BY m.flights DESC,m.ident`
  ]) as Array<Array<Record<string,unknown>>>;
  const airports:MapAirport[]=airportRows.map(row=>({ident:String(row.ident),name:String(row.name??""),lat:Number(row.lat),lon:Number(row.lon),flights:Number(row.flights)})).filter(a=>Number.isFinite(a.lat)&&Number.isFinite(a.lon));
  const routes:RouteLine[]=routeRows.map(row=>({departure:String(row.departure),arrival:String(row.arrival),flights:Number(row.flights),minutes:Number(row.minutes),from:{ident:String(row.departure),name:String(row.dep_name??""),lat:Number(row.dep_lat),lon:Number(row.dep_lon),flights:Number(row.flights)},to:{ident:String(row.arrival),name:String(row.arr_name??""),lat:Number(row.arr_lat),lon:Number(row.arr_lon),flights:Number(row.flights)}})).filter(r=>Number.isFinite(r.from.lat)&&Number.isFinite(r.to.lat));
  return{routes,airports,totalFlights:routes.reduce((sum,r)=>sum+r.flights,0)};
}
