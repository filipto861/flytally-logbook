import "server-only";
import { sql } from "@/lib/db";

export const PERIODS = ["all", "year", "12m", "previous"] as const;
export type DashboardPeriod = (typeof PERIODS)[number];
export type PrimaryMetric = { minutes: number; landings: number; flights: number };
export type MonthlyPoint = { month:string; total:number; ull:number; easa:number; picUll:number; picEasa:number; landings:number };
export type DashboardData = {
  displayName:string; rangeLabel:string; total:PrimaryMetric; ull:PrimaryMetric; easa:PrimaryMetric; picUll:PrimaryMetric; picEasa:PrimaryMetric;
  airMinutes:number; picMinutes:number; dualMinutes:number; safetyMinutes:number; cost:number; tracks:number; gpsKm:number;
  uniqueAircraft:number; uniqueAirports:number;
  lastFlight:null|{id:number;date:string;registration:string;departure:string;arrival:string}; monthly:MonthlyPoint[];
  topAircraft:Array<{registration:string;flights:number;minutes:number}>; topRoutes:Array<{route:string;flights:number;minutes:number}>;
  yearly:Array<{year:number;flights:number;minutes:number;landings:number}>;
};

function bounds(period:DashboardPeriod,today=new Date()) {
  const year=today.getUTCFullYear(); const iso=(d:Date)=>d.toISOString().slice(0,10);
  if(period==="year") return {start:`${year}-01-01`,end:iso(today),label:String(year)};
  if(period==="previous") return {start:`${year-1}-01-01`,end:`${year-1}-12-31`,label:String(year-1)};
  if(period==="12m") { const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1)); return {start:iso(start),end:iso(today),label:`${start.toLocaleDateString("cs-CZ")}–${today.toLocaleDateString("cs-CZ")}`}; }
  return {start:null,end:null,label:"celá historie"};
}
const num=(v:unknown)=>Number(v??0); const txt=(v:unknown)=>String(v??"");
const metric=(r:Record<string,unknown>,key:string):PrimaryMetric=>({minutes:num(r[`${key}_minutes`]),landings:num(r[`${key}_landings`]),flights:num(r[`${key}_flights`])});

async function fallbackDashboard(userId:number,rangeLabel:string):Promise<DashboardData>{
  const [rows,trackRows,latestRows]=await Promise.all([
    sql`WITH normalized AS (SELECT id,evidence,role,registration,departure,arrival,COALESCE(starts,0)::integer starts,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::integer*60+split_part(on_block,':',2)::integer)-(split_part(off_block,':',1)::integer*60+split_part(off_block,':',2)::integer)+1440,1440) ELSE 0 END block_minutes FROM flights WHERE user_id=${userId}) SELECT u.display_name,COUNT(n.id)::integer total_flights,COALESCE(SUM(n.block_minutes),0)::integer total_minutes,COALESCE(SUM(n.starts),0)::integer total_landings,COUNT(n.id) FILTER(WHERE UPPER(n.evidence)='ULL')::integer ull_flights,COALESCE(SUM(n.block_minutes) FILTER(WHERE UPPER(n.evidence)='ULL'),0)::integer ull_minutes,COALESCE(SUM(n.starts) FILTER(WHERE UPPER(n.evidence)='ULL'),0)::integer ull_landings,COUNT(n.id) FILTER(WHERE UPPER(n.evidence)='EASA')::integer easa_flights,COALESCE(SUM(n.block_minutes) FILTER(WHERE UPPER(n.evidence)='EASA'),0)::integer easa_minutes,COALESCE(SUM(n.starts) FILTER(WHERE UPPER(n.evidence)='EASA'),0)::integer easa_landings,COUNT(n.id) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='ULL')::integer pic_ull_flights,COALESCE(SUM(n.block_minutes) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='ULL'),0)::integer pic_ull_minutes,COALESCE(SUM(n.starts) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='ULL'),0)::integer pic_ull_landings,COUNT(n.id) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='EASA')::integer pic_easa_flights,COALESCE(SUM(n.block_minutes) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='EASA'),0)::integer pic_easa_minutes,COALESCE(SUM(n.starts) FILTER(WHERE UPPER(n.role)='PIC' AND UPPER(n.evidence)='EASA'),0)::integer pic_easa_landings,COALESCE(SUM(n.block_minutes) FILTER(WHERE UPPER(n.role)='PIC'),0)::integer pic_minutes,COUNT(DISTINCT NULLIF(UPPER(n.registration),''))::integer unique_aircraft FROM users u LEFT JOIN normalized n ON TRUE WHERE u.id=${userId} GROUP BY u.id,u.display_name`,
    sql`SELECT COUNT(*)::integer tracks,COALESCE(SUM(distance_km),0) gps_km FROM flight_tracks WHERE user_id=${userId}`,
    sql`SELECT id,date,COALESCE(registration,'') registration,COALESCE(departure,'') departure,COALESCE(arrival,'') arrival FROM flights WHERE user_id=${userId} ORDER BY date DESC,off_block DESC NULLS LAST,id DESC LIMIT 1`
  ]) as Array<Array<Record<string,unknown>>>;const r=rows[0]??{},tr=trackRows[0]??{};
  return {displayName:txt(r.display_name)||"Pilot",rangeLabel,total:metric(r,"total"),ull:metric(r,"ull"),easa:metric(r,"easa"),picUll:metric(r,"pic_ull"),picEasa:metric(r,"pic_easa"),airMinutes:0,picMinutes:num(r.pic_minutes),dualMinutes:0,safetyMinutes:0,cost:0,tracks:num(tr.tracks),gpsKm:num(tr.gps_km),uniqueAircraft:num(r.unique_aircraft),uniqueAirports:0,lastFlight:latestRows[0]?{id:num(latestRows[0].id),date:txt(latestRows[0].date),registration:txt(latestRows[0].registration),departure:txt(latestRows[0].departure),arrival:txt(latestRows[0].arrival)}:null,monthly:[],topAircraft:[],topRoutes:[],yearly:[]};
}

export async function getDashboardData(userId:number,requested:string):Promise<DashboardData>{
  const period:DashboardPeriod=PERIODS.includes(requested as DashboardPeriod)?requested as DashboardPeriod:"all";
  const {start,end,label}=bounds(period);
  let result:Array<Array<Record<string,unknown>>>;
  try { result=await Promise.all([
    sql`
      WITH base AS (
        SELECT f.*,
          CASE WHEN f.off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END block_minutes,
          CASE WHEN f.takeoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.landing ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)-(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440) ELSE 0 END air_minutes
        FROM flights f WHERE f.user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date)
      ), track AS (
        SELECT COUNT(*)::int tracks,COALESCE(SUM(t.distance_km),0) gps_km FROM flight_tracks t JOIN base b ON b.id=t.flight_id WHERE t.user_id=${userId}
      ), base_stats AS (
        SELECT COUNT(*)::int total_flights,COALESCE(SUM(block_minutes),0)::int total_minutes,COALESCE(SUM(starts),0)::int total_landings,
          COUNT(*) FILTER(WHERE UPPER(TRIM(evidence))='ULL')::int ull_flights,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(evidence))='ULL'),0)::int ull_minutes,COALESCE(SUM(starts) FILTER(WHERE UPPER(TRIM(evidence))='ULL'),0)::int ull_landings,
          COUNT(*) FILTER(WHERE UPPER(TRIM(evidence))='EASA')::int easa_flights,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(evidence))='EASA'),0)::int easa_minutes,COALESCE(SUM(starts) FILTER(WHERE UPPER(TRIM(evidence))='EASA'),0)::int easa_landings,
          COUNT(*) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='ULL')::int pic_ull_flights,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='ULL'),0)::int pic_ull_minutes,COALESCE(SUM(starts) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='ULL'),0)::int pic_ull_landings,
          COUNT(*) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='EASA')::int pic_easa_flights,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='EASA'),0)::int pic_easa_minutes,COALESCE(SUM(starts) FILTER(WHERE UPPER(TRIM(role))='PIC' AND UPPER(TRIM(evidence))='EASA'),0)::int pic_easa_landings,
          COALESCE(SUM(air_minutes),0)::int air_minutes,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(role))='PIC'),0)::int pic_minutes,
          COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(role))='DUAL'),0)::int dual_minutes,COALESCE(SUM(block_minutes) FILTER(WHERE UPPER(TRIM(role))='SAFETY PILOT'),0)::int safety_minutes,
          COUNT(DISTINCT NULLIF(UPPER(TRIM(registration)),''))::int unique_aircraft,
          COALESCE(SUM((CASE WHEN UPPER(COALESCE(billing_basis,'BLOCK'))='AIR' THEN air_minutes ELSE block_minutes END)::numeric/60*COALESCE(price_per_hour,0)),0) cost
        FROM base
      ), airports AS (SELECT COUNT(DISTINCT code)::int unique_airports FROM (SELECT NULLIF(UPPER(TRIM(departure)),'') code FROM base UNION SELECT NULLIF(UPPER(TRIM(arrival)),'') FROM base) x WHERE code IS NOT NULL)
      SELECT u.display_name,s.*,a.unique_airports,t.tracks,t.gps_km FROM users u CROSS JOIN base_stats s CROSS JOIN airports a CROSS JOIN track t WHERE u.id=${userId}`,
    sql`WITH b AS (SELECT date_trunc('month',f.date::date) month,COALESCE(starts,0) starts,UPPER(TRIM(evidence)) evidence,UPPER(TRIM(role)) role,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END mins FROM flights f WHERE user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date)) SELECT to_char(month,'YYYY-MM') month,SUM(mins)::int total,COALESCE(SUM(mins) FILTER(WHERE evidence='ULL'),0)::int ull,COALESCE(SUM(mins) FILTER(WHERE evidence='EASA'),0)::int easa,COALESCE(SUM(mins) FILTER(WHERE role='PIC' AND evidence='ULL'),0)::int pic_ull,COALESCE(SUM(mins) FILTER(WHERE role='PIC' AND evidence='EASA'),0)::int pic_easa,SUM(starts)::int landings FROM b GROUP BY month ORDER BY month`,
    sql`WITH b AS (SELECT registration,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END mins FROM flights f WHERE user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date)) SELECT UPPER(TRIM(registration)) registration,COUNT(*)::int flights,SUM(mins)::int minutes FROM b WHERE NULLIF(TRIM(registration),'') IS NOT NULL GROUP BY 1 ORDER BY minutes DESC LIMIT 6`,
    sql`WITH b AS (SELECT UPPER(TRIM(departure)) dep,UPPER(TRIM(arrival)) arr,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END mins FROM flights f WHERE user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date)) SELECT dep||'–'||arr route,COUNT(*)::int flights,SUM(mins)::int minutes FROM b WHERE dep<>'' AND arr<>'' GROUP BY 1 ORDER BY flights DESC,minutes DESC LIMIT 6`,
    sql`WITH b AS (SELECT EXTRACT(YEAR FROM date::date)::int year,COALESCE(starts,0) starts,CASE WHEN off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(on_block,':',1)::int*60+split_part(on_block,':',2)::int)-(split_part(off_block,':',1)::int*60+split_part(off_block,':',2)::int)+1440,1440) ELSE 0 END mins FROM flights f WHERE user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date)) SELECT year,COUNT(*)::int flights,SUM(mins)::int minutes,SUM(starts)::int landings FROM b GROUP BY year ORDER BY year DESC`,
    sql`SELECT id,date,COALESCE(registration,'') registration,COALESCE(departure,'') departure,COALESCE(arrival,'') arrival FROM flights f WHERE user_id=${userId} AND (${start}::date IS NULL OR f.date::date>=${start}::date) AND (${end}::date IS NULL OR f.date::date<=${end}::date) ORDER BY date DESC,off_block DESC NULLS LAST,id DESC LIMIT 1`
  ]) as Array<Array<Record<string,unknown>>>; }
  catch(error){console.error("dashboard-aggregate-fallback",error);return fallbackDashboard(userId,label);}
  const [statsRows,monthRows,aircraftRows,routeRows,yearRows,latestRows]=result;
  const r=statsRows[0]??{};
  return {displayName:txt(r.display_name)||"Pilot",rangeLabel:label,total:metric(r,"total"),ull:metric(r,"ull"),easa:metric(r,"easa"),picUll:metric(r,"pic_ull"),picEasa:metric(r,"pic_easa"),airMinutes:num(r.air_minutes),picMinutes:num(r.pic_minutes),dualMinutes:num(r.dual_minutes),safetyMinutes:num(r.safety_minutes),cost:num(r.cost),tracks:num(r.tracks),gpsKm:num(r.gps_km),uniqueAircraft:num(r.unique_aircraft),uniqueAirports:num(r.unique_airports),lastFlight:latestRows[0]?{id:num(latestRows[0].id),date:txt(latestRows[0].date),registration:txt(latestRows[0].registration),departure:txt(latestRows[0].departure),arrival:txt(latestRows[0].arrival)}:null,monthly:monthRows.map(r=>({month:txt(r.month),total:num(r.total),ull:num(r.ull),easa:num(r.easa),picUll:num(r.pic_ull),picEasa:num(r.pic_easa),landings:num(r.landings)})),topAircraft:aircraftRows.map(r=>({registration:txt(r.registration),flights:num(r.flights),minutes:num(r.minutes)})),topRoutes:routeRows.map(r=>({route:txt(r.route),flights:num(r.flights),minutes:num(r.minutes)})),yearly:yearRows.map(r=>({year:num(r.year),flights:num(r.flights),minutes:num(r.minutes),landings:num(r.landings)}))};
}
export function formatDuration(minutes:number){const v=Math.max(0,Math.round(minutes));return `${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}`;}
