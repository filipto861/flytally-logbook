import "server-only";
import { sql } from "@/lib/db";
import { getCatalogAirport } from "@/lib/airport-catalog";
import { routePairKey } from "@/lib/route-filter";

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
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 || (Math.abs(lat)<.001&&Math.abs(lon)<.001)) continue;
      const point: TrackPoint = { lat, lon };
      const alt = Number(item?.alt); if (Number.isFinite(alt)) point.alt = alt;
      if (item?.time) point.time = String(item.time);
      valid.push(point);
    }
    const segments:TrackPoint[][]=[];let segment:TrackPoint[]=[];
    for(const point of valid){if(segment.length&&pointGap(segment.at(-1)!,point)>250){if(segment.length>=2)segments.push(segment);segment=[]}segment.push(point)}
    if(segment.length>=2)segments.push(segment);
    const clean=(segments.sort((a,b)=>b.length-a.length)[0]??valid);
    if (clean.length <= maxPoints) return clean;
    const stride = Math.max(1, Math.ceil(clean.length / maxPoints));
    const sampled = clean.filter((_, index) => index === 0 || index === clean.length - 1 || index % stride === 0);
    return sampled.slice(0, maxPoints - 1).concat(clean.at(-1)!);
  } catch { return []; }
}

function pointGap(a:TrackPoint,b:TrackPoint){const p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p,q=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 12742.0176*Math.asin(Math.sqrt(q))}

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
    LEFT JOIN LATERAL (SELECT latitude_deg,longitude_deg FROM airports x WHERE UPPER(x.ident)=UPPER(f.departure) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=f.user_id OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%') ORDER BY (x.user_id=f.user_id) DESC LIMIT 1) dep ON TRUE
    LEFT JOIN LATERAL (SELECT latitude_deg,longitude_deg FROM airports x WHERE UPPER(x.ident)=UPPER(f.arrival) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=f.user_id OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%') ORDER BY (x.user_id=f.user_id) DESC LIMIT 1) arr ON TRUE
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
    departurePoint:airportPoint(row.dep_lat,row.dep_lon)??catalogPoint(String(row.departure??"")),arrivalPoint:airportPoint(row.arr_lat,row.arr_lon)??catalogPoint(String(row.arrival??"")),
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
    LEFT JOIN LATERAL (SELECT latitude_deg,longitude_deg FROM airports x WHERE UPPER(x.ident)=UPPER(f.departure) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=f.user_id OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%') ORDER BY (x.user_id=f.user_id) DESC LIMIT 1) dep ON TRUE
    LEFT JOIN LATERAL (SELECT latitude_deg,longitude_deg FROM airports x WHERE UPPER(x.ident)=UPPER(f.arrival) AND x.active=1 AND COALESCE(x.closed,0)=0 AND (x.user_id=f.user_id OR LOWER(COALESCE(x.source,'')) LIKE 'ourairports%') ORDER BY (x.user_id=f.user_id) DESC LIMIT 1) arr ON TRUE
    WHERE t.user_id=${userId} AND t.flight_id=${flightId} ORDER BY t.id
  ` as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: Number(row.id), flightId: Number(row.flight_id), date: String(row.date??""), registration: String(row.registration??""), departure: String(row.departure??""),
    arrival: String(row.arrival??""), evidence: String(row.evidence??""), distanceKm: Number(row.distance_km ?? 0),
    points: decodePoints(row.coordinates_json, 2500),
    departurePoint:airportPoint(row.dep_lat,row.dep_lon)??catalogPoint(String(row.departure??"")),arrivalPoint:airportPoint(row.arr_lat,row.arr_lon)??catalogPoint(String(row.arrival??"")),
  } satisfies MapTrack)).filter((track) => track.points.length >= 2);
}

function airportPoint(lat:unknown,lon:unknown):TrackPoint|undefined{
  // A missing LEFT JOIN value is null. Number(null) is 0, which previously
  // produced a fake point in the Gulf of Guinea and prevented the catalogue
  // fallback for manually entered airport identifiers.
  if(lat===null||lat===undefined||lon===null||lon===undefined||lat===""||lon==="")return undefined;
  const a=Number(lat),o=Number(lon);
  return Number.isFinite(a)&&Number.isFinite(o)&&a>=-90&&a<=90&&o>=-180&&o<=180?{lat:a,lon:o}:undefined;
}
function catalogPoint(ident:string):TrackPoint|undefined{const airport=getCatalogAirport(ident);return airport?{lat:airport.lat,lon:airport.lon}:undefined}

export async function getRouteOverview(userId:number,filters:MapFilters={}){
  const registration=filters.registration?.trim()||null,evidence=filters.evidence?.trim()||null,airport=filters.airport?.trim()||null,route=filters.route?.trim()||null,year=filters.year?.trim()||null;
  const [routeRows,airportRows,customAirportRows]=await Promise.all([
    sql`WITH b AS (SELECT UPPER(TRIM(f.departure)) departure,UPPER(TRIM(f.arrival)) arrival,CASE WHEN f.off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END minutes FROM flights f WHERE f.user_id=${userId} AND NULLIF(TRIM(f.departure),'') IS NOT NULL AND NULLIF(TRIM(f.arrival),'') IS NOT NULL AND (${registration}::text IS NULL OR UPPER(f.registration)=UPPER(${registration}::text)) AND (${evidence}::text IS NULL OR UPPER(f.evidence)=UPPER(${evidence}::text)) AND (${airport}::text IS NULL OR UPPER(f.departure)=UPPER(${airport}::text) OR UPPER(f.arrival)=UPPER(${airport}::text)) AND (${route}::text IS NULL OR UPPER(CONCAT(f.departure,'→',f.arrival))=UPPER(${route}::text)) AND (${year}::text IS NULL OR EXTRACT(YEAR FROM f.date::date)::text=${year}::text)) SELECT departure,arrival,COUNT(*)::int flights,SUM(minutes)::int minutes FROM b GROUP BY 1,2 ORDER BY flights DESC,departure,arrival`,
    sql`WITH b AS (SELECT UPPER(TRIM(f.departure)) departure,UPPER(TRIM(f.arrival)) arrival FROM flights f WHERE f.user_id=${userId} AND NULLIF(TRIM(f.departure),'') IS NOT NULL AND NULLIF(TRIM(f.arrival),'') IS NOT NULL AND (${registration}::text IS NULL OR UPPER(f.registration)=UPPER(${registration}::text)) AND (${evidence}::text IS NULL OR UPPER(f.evidence)=UPPER(${evidence}::text)) AND (${airport}::text IS NULL OR UPPER(f.departure)=UPPER(${airport}::text) OR UPPER(f.arrival)=UPPER(${airport}::text)) AND (${route}::text IS NULL OR UPPER(CONCAT(f.departure,'→',f.arrival))=UPPER(${route}::text)) AND (${year}::text IS NULL OR EXTRACT(YEAR FROM f.date::date)::text=${year}::text)),movements AS (SELECT departure ident FROM b UNION ALL SELECT arrival FROM b) SELECT ident,COUNT(*)::int flights FROM movements GROUP BY ident ORDER BY flights DESC,ident`,
    sql`SELECT UPPER(TRIM(ident)) ident,COALESCE(name,'') name,latitude_deg lat,longitude_deg lon FROM airports WHERE user_id=${userId} AND active=1 AND COALESCE(closed,0)=0 AND LOWER(COALESCE(source,'')) NOT LIKE 'ourairports%' LIMIT 2000`
  ]) as Array<Array<Record<string,unknown>>>;
  const custom=new Map(customAirportRows.map(row=>[String(row.ident),row]));
  const airportFor=(ident:string,flights:number):MapAirport|null=>{const own=custom.get(ident);if(own&&Number.isFinite(Number(own.lat))&&Number.isFinite(Number(own.lon)))return{ident,name:String(own.name??""),lat:Number(own.lat),lon:Number(own.lon),flights};const item=getCatalogAirport(ident);return item?{ident:item.ident,name:item.name,lat:item.lat,lon:item.lon,flights}:null};
  const airports:MapAirport[]=airportRows.map(row=>airportFor(String(row.ident),Number(row.flights))).filter((value):value is MapAirport=>value!==null);
  const grouped=new Map<string,{departure:string;arrival:string;flights:number;minutes:number}>();
  for(const row of routeRows){const key=routePairKey(row.departure,row.arrival);if(!key)continue;const [departure,arrival]=key.split("↔"),current=grouped.get(key)??{departure,arrival,flights:0,minutes:0};current.flights+=Number(row.flights||0);current.minutes+=Number(row.minutes||0);grouped.set(key,current)}
  const routes:RouteLine[]=[...grouped.values()].map(row=>{const from=airportFor(row.departure,row.flights),to=airportFor(row.arrival,row.flights);return from&&to?{...row,from,to}:null}).filter((value):value is RouteLine=>value!==null).sort((a,b)=>b.flights-a.flights||a.departure.localeCompare(b.departure)||a.arrival.localeCompare(b.arrival));
  return{routes,airports,totalFlights:routes.reduce((sum,r)=>sum+r.flights,0)};
}
