import "server-only";
import { sql } from "@/lib/db";
import { measureServerTask } from "@/lib/performance";

export const PERIODS=["all","year","12m","previous"] as const;
export type DashboardPeriod=(typeof PERIODS)[number];
export type PrimaryMetric={minutes:number;landings:number;flights:number};
export type MonthlyPoint={month:string;total:number;ull:number;easa:number;picUll:number;picEasa:number;landings:number};
export type DashboardData={
  displayName:string;rangeLabel:string;total:PrimaryMetric;ull:PrimaryMetric;easa:PrimaryMetric;picUll:PrimaryMetric;picEasa:PrimaryMetric;
  airMinutes:number;picMinutes:number;copilotMinutes:number;dualMinutes:number;instructorMinutes:number;nightMinutes:number;ifrMinutes:number;dayLandings:number;nightLandings:number;safetyMinutes:number;cost:number;tracks:number;gpsKm:number;
  uniqueAircraft:number;uniqueAirports:number;chartFlights:number;invalidDateFlights:number;
  lastFlight:null|{id:number;date:string;registration:string;departure:string;arrival:string};monthly:MonthlyPoint[];
  recentFlights:Array<{id:number;date:string;registration:string;departure:string;arrival:string}>;
  topAircraft:Array<{registration:string;flights:number;minutes:number;cost:number}>;
  topRoutes:Array<{route:string;flights:number;minutes:number}>;
  yearly:Array<{year:number;flights:number;minutes:number;landings:number}>;
};

const num=(value:unknown)=>Number(value??0)||0;
const text=(value:unknown)=>String(value??"").trim();
const records=(value:unknown):Array<Record<string,unknown>>=>{
  if(Array.isArray(value))return value.filter(item=>item&&typeof item==="object") as Array<Record<string,unknown>>;
  if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}
  return[];
};

function bounds(period:DashboardPeriod,today=new Date()){
  const year=today.getUTCFullYear();
  const iso=(date:Date)=>date.toISOString().slice(0,10);
  if(period==="year")return{start:`${year}-01-01`,end:iso(today),label:String(year)};
  if(period==="previous")return{start:`${year-1}-01-01`,end:`${year-1}-12-31`,label:String(year-1)};
  if(period==="12m"){
    const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1));
    return{start:iso(start),end:iso(today),label:`${start.toLocaleDateString("en-GB")}–${today.toLocaleDateString("en-GB")}`};
  }
  return{start:null,end:null,label:"all time"};
}

export async function getDashboardData(userId:number,requested:string):Promise<DashboardData>{
  const period:DashboardPeriod=PERIODS.includes(requested as DashboardPeriod)?requested as DashboardPeriod:"all";
  const {start,end,label}=bounds(period);
  const rows=await measureServerTask("dashboard-data",()=>sql`
    WITH track AS MATERIALIZED (
      SELECT t.flight_id,COUNT(*)::int track_count,COALESCE(SUM(t.distance_km),0) gps_km
      FROM flight_tracks t
      JOIN flights tf ON tf.id=t.flight_id AND tf.user_id=t.user_id
      WHERE t.user_id=${userId}
        AND (${start}::date IS NULL OR tf.date>=${start}::date)
        AND (${end}::date IS NULL OR tf.date<=${end}::date)
      GROUP BY t.flight_id
    ), normalized AS MATERIALIZED (
      SELECT f.id,f.date::text date,COALESCE(f.off_block,'') off_block,
        UPPER(TRIM(COALESCE(f.evidence,''))) evidence,
        CASE WHEN NULLIF(TRIM(COALESCE(f.instructor,'')),'') IS NOT NULL OR UPPER(TRIM(COALESCE(f.role,'')))='STUDENT' THEN 'DUAL' ELSE UPPER(TRIM(COALESCE(f.role,''))) END role,
        UPPER(TRIM(COALESCE(f.registration,''))) registration,UPPER(TRIM(COALESCE(f.departure,''))) departure,UPPER(TRIM(COALESCE(f.arrival,''))) arrival,
        GREATEST(COALESCE(f.starts,0),0)::int landings,COALESCE(f.landings_day,0)::int day_landings,COALESCE(f.landings_night,0)::int night_landings,
        COALESCE(f.pic_minutes,0)::int pic_minutes,COALESCE(f.copilot_minutes,0)::int copilot_minutes,COALESCE(f.dual_minutes,0)::int dual_minutes,COALESCE(f.instructor_minutes,0)::int instructor_minutes,
        COALESCE(f.night_minutes,0)::int night_minutes,COALESCE(f.ifr_minutes,0)::int ifr_minutes,
        CASE WHEN f.off_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes,
        CASE WHEN f.takeoff ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.landing ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)-(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440) ELSE 0 END::int air_minutes,
        GREATEST(COALESCE(f.price_per_hour,0),0) price_per_hour,UPPER(COALESCE(f.billing_basis,'BLOCK')) billing_basis,
        COALESCE(t.track_count,0)::int track_count,COALESCE(t.gps_km,0) gps_km
      FROM flights f LEFT JOIN track t ON t.flight_id=f.id
      WHERE f.user_id=${userId}
        AND (${start}::date IS NULL OR f.date>=${start}::date)
        AND (${end}::date IS NULL OR f.date<=${end}::date)
    ), b AS MATERIALIZED (
      SELECT n.*,
        n.role IN ('SAFETY PILOT','PAX','OBSERVER') auxiliary,
        n.role='SAFETY PILOT' safety,
        GREATEST(n.price_per_hour,0)*(CASE WHEN n.billing_basis LIKE 'AIR%' THEN n.air_minutes ELSE n.block_minutes END)/60.0/
          (CASE WHEN split_part(n.billing_basis,'/',2) ~ '^[1-9][0-9]*$' THEN LEAST(GREATEST(split_part(n.billing_basis,'/',2)::numeric,1),20) ELSE 1 END) cost
      FROM normalized n
    ), core AS (
      SELECT
        COUNT(*) FILTER(WHERE NOT auxiliary OR safety)::int total_flights,
        COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary OR safety),0)::int total_minutes,
        COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int total_landings,
        COUNT(*) FILTER(WHERE NOT auxiliary AND evidence='ULL')::int ull_flights,
        COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='ULL'),0)::int ull_minutes,
        COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND evidence='ULL'),0)::int ull_landings,
        COUNT(*) FILTER(WHERE NOT auxiliary AND evidence='EASA')::int easa_flights,
        COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='EASA'),0)::int easa_minutes,
        COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND evidence='EASA'),0)::int easa_landings,
        COUNT(*) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='ULL')::int pic_ull_flights,
        COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='ULL'),0)::int pic_ull_minutes,
        COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='ULL'),0)::int pic_ull_landings,
        COUNT(*) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='EASA')::int pic_easa_flights,
        COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='EASA'),0)::int pic_easa_minutes,
        COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='EASA'),0)::int pic_easa_landings,
        COALESCE(SUM(air_minutes) FILTER(WHERE NOT auxiliary),0)::int air_minutes,
        COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary),0)::int pic_minutes,
        COALESCE(SUM(copilot_minutes) FILTER(WHERE NOT auxiliary),0)::int copilot_minutes,
        COALESCE(SUM(dual_minutes) FILTER(WHERE NOT auxiliary),0)::int dual_minutes,
        COALESCE(SUM(instructor_minutes) FILTER(WHERE NOT auxiliary),0)::int instructor_minutes,
        COALESCE(SUM(night_minutes) FILTER(WHERE NOT auxiliary),0)::int night_minutes,
        COALESCE(SUM(ifr_minutes) FILTER(WHERE NOT auxiliary),0)::int ifr_minutes,
        COALESCE(SUM(day_landings) FILTER(WHERE NOT auxiliary),0)::int day_landings,
        COALESCE(SUM(night_landings) FILTER(WHERE NOT auxiliary),0)::int night_landings,
        COALESCE(SUM(block_minutes) FILTER(WHERE safety),0)::int safety_minutes,
        COALESCE(SUM(cost),0) cost,COALESCE(SUM(track_count),0)::int tracks,COALESCE(SUM(gps_km),0) gps_km,
        COUNT(DISTINCT NULLIF(registration,''))::int unique_aircraft
      FROM b
    )
    SELECT COALESCE((SELECT NULLIF(TRIM(display_name),'') FROM users WHERE id=${userId} LIMIT 1),'Pilot') display_name,c.*,
      (SELECT COUNT(*)::int FROM (SELECT departure ident FROM b WHERE departure<>'' UNION SELECT arrival FROM b WHERE arrival<>'') a) unique_airports,
      c.total_flights chart_flights,0::int invalid_date_flights,
      COALESCE((SELECT jsonb_agg(to_jsonb(r)-'off_block' ORDER BY r.date DESC,r.off_block DESC,r.id DESC) FROM (SELECT id,date,registration,departure,arrival,off_block FROM b ORDER BY date DESC,off_block DESC,id DESC LIMIT 8) r),'[]'::jsonb) recent_flights,
      COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month) FROM (
        SELECT LEFT(date,7) month,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary OR safety),0)::int total,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='ULL'),0)::int ull,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='EASA'),0)::int easa,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='ULL'),0)::int pic_ull,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND role='PIC' AND evidence='EASA'),0)::int pic_easa,
          COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int landings
        FROM b WHERE NOT auxiliary OR safety GROUP BY LEFT(date,7)
      ) m),'[]'::jsonb) monthly,
      COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.minutes DESC,a.registration) FROM (
        SELECT registration,COUNT(*) FILTER(WHERE NOT auxiliary)::int flights,COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary),0)::int minutes,COALESCE(SUM(cost),0) cost
        FROM b WHERE registration<>'' GROUP BY registration
      ) a),'[]'::jsonb) top_aircraft,
      COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.flights DESC,r.minutes DESC) FROM (
        SELECT departure||'–'||arrival route,COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes
        FROM b WHERE NOT auxiliary AND departure<>'' AND arrival<>'' GROUP BY departure,arrival ORDER BY COUNT(*) DESC,SUM(block_minutes) DESC LIMIT 8
      ) r),'[]'::jsonb) top_routes,
      COALESCE((SELECT jsonb_agg(to_jsonb(y) ORDER BY y.year DESC) FROM (
        SELECT LEFT(date,4)::int year,COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes,COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int landings
        FROM b WHERE NOT auxiliary OR safety GROUP BY LEFT(date,4)
      ) y),'[]'::jsonb) yearly
    FROM core c
  `,500) as Array<Record<string,unknown>>;
  const row=rows[0]??{};
  const recentFlights=records(row.recent_flights).map(item=>({id:num(item.id),date:text(item.date),registration:text(item.registration),departure:text(item.departure),arrival:text(item.arrival)}));
  const monthly=records(row.monthly).map(item=>({month:text(item.month),total:num(item.total),ull:num(item.ull),easa:num(item.easa),picUll:num(item.pic_ull),picEasa:num(item.pic_easa),landings:num(item.landings)}));
  const topAircraft=records(row.top_aircraft).map(item=>({registration:text(item.registration),flights:num(item.flights),minutes:num(item.minutes),cost:num(item.cost)}));
  const topRoutes=records(row.top_routes).map(item=>({route:text(item.route),flights:num(item.flights),minutes:num(item.minutes)}));
  const yearly=records(row.yearly).map(item=>({year:num(item.year),flights:num(item.flights),minutes:num(item.minutes),landings:num(item.landings)}));
  return{
    displayName:text(row.display_name)||"Pilot",rangeLabel:label,
    total:{minutes:num(row.total_minutes),landings:num(row.total_landings),flights:num(row.total_flights)},
    ull:{minutes:num(row.ull_minutes),landings:num(row.ull_landings),flights:num(row.ull_flights)},
    easa:{minutes:num(row.easa_minutes),landings:num(row.easa_landings),flights:num(row.easa_flights)},
    picUll:{minutes:num(row.pic_ull_minutes),landings:num(row.pic_ull_landings),flights:num(row.pic_ull_flights)},
    picEasa:{minutes:num(row.pic_easa_minutes),landings:num(row.pic_easa_landings),flights:num(row.pic_easa_flights)},
    airMinutes:num(row.air_minutes),picMinutes:num(row.pic_minutes),copilotMinutes:num(row.copilot_minutes),dualMinutes:num(row.dual_minutes),instructorMinutes:num(row.instructor_minutes),nightMinutes:num(row.night_minutes),ifrMinutes:num(row.ifr_minutes),dayLandings:num(row.day_landings),nightLandings:num(row.night_landings),safetyMinutes:num(row.safety_minutes),cost:num(row.cost),tracks:num(row.tracks),gpsKm:num(row.gps_km),
    uniqueAircraft:num(row.unique_aircraft),uniqueAirports:num(row.unique_airports),chartFlights:num(row.chart_flights),invalidDateFlights:num(row.invalid_date_flights),
    lastFlight:recentFlights[0]??null,recentFlights,monthly,topAircraft,topRoutes,yearly,
  };
}

export function formatDuration(minutes:number){const value=Math.max(0,Math.round(minutes));return`${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`}
