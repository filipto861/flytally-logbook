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
  uniqueAircraft:number;uniqueAirports:number;uniqueRoutes:number;chartFlights:number;invalidDateFlights:number;
  lastFlight:null|{id:number;date:string;registration:string;departure:string;arrival:string};monthly:MonthlyPoint[];
  recentFlights:Array<{id:number;date:string;registration:string;departure:string;arrival:string}>;
  topAircraft:Array<{registration:string;flights:number;minutes:number;cost:number;lastDate:string}>;
  topRoutes:Array<{route:string;departure:string;arrival:string;flights:number;minutes:number;firstDate:string;lastDate:string}>;
  topAirports:Array<{airport:string;visits:number;departures:number;arrivals:number;firstDate:string;lastDate:string}>;
  yearly:Array<{year:number;flights:number;minutes:number;landings:number}>;
};

const n=(value:unknown)=>Number(value??0)||0;
const s=(value:unknown)=>String(value??"").trim();
const jsonObjects=(value:unknown):Array<Record<string,unknown>>=>{if(Array.isArray(value))return value as Array<Record<string,unknown>>;if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{}return[]};
const metric=(row:Record<string,unknown>,prefix:string):PrimaryMetric=>({minutes:n(row[`${prefix}_minutes`]),landings:n(row[`${prefix}_landings`]),flights:n(row[`${prefix}_flights`])});

function bounds(period:DashboardPeriod,today=new Date()){
  const year=today.getUTCFullYear();
  const iso=(date:Date)=>date.toISOString().slice(0,10);
  if(period==="year")return{start:`${year}-01-01`,end:iso(today),label:String(year)};
  if(period==="previous")return{start:`${year-1}-01-01`,end:`${year-1}-12-31`,label:String(year-1)};
  if(period==="12m"){const start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-12,today.getUTCDate()+1));return{start:iso(start),end:iso(today),label:`${start.toLocaleDateString("en-GB")}–${today.toLocaleDateString("en-GB")}`}}
  return{start:null,end:null,label:"all time"};
}

export async function getDashboardData(userId:number,requested:string):Promise<DashboardData>{
  const period:DashboardPeriod=PERIODS.includes(requested as DashboardPeriod)?requested as DashboardPeriod:"all",{start,end,label}=bounds(period);
  const rows=await measureServerTask("dashboard-data",()=>sql`WITH track AS MATERIALIZED(
      SELECT flight_id,COUNT(*)::int track_count,COALESCE(SUM(distance_km),0)::double precision gps_km FROM flight_tracks WHERE user_id=${userId} GROUP BY flight_id
    ),base0 AS MATERIALIZED(
      SELECT f.id,f.date::text date,CASE WHEN f.date::text~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::text ELSE NULL END date_key,
        UPPER(TRIM(COALESCE(f.evidence,''))) evidence,
        CASE WHEN UPPER(TRIM(COALESCE(f.role,'')))='INSTRUKTOR' THEN 'INSTRUCTOR' WHEN UPPER(TRIM(COALESCE(f.role,'')))='STUDENT' OR (TRIM(COALESCE(f.role,''))='' AND TRIM(COALESCE(f.instructor,''))<>'') THEN 'DUAL' ELSE UPPER(TRIM(COALESCE(f.role,''))) END role,
        UPPER(TRIM(COALESCE(f.registration,''))) registration,UPPER(TRIM(COALESCE(f.departure,''))) departure,UPPER(TRIM(COALESCE(f.arrival,''))) arrival,COALESCE(f.off_block,'') off_block,
        GREATEST(COALESCE(f.starts,0),0)::int landings,GREATEST(COALESCE(f.landings_day,0),0)::int day_landings,GREATEST(COALESCE(f.landings_night,0),0)::int night_landings,
        COALESCE(f.night_minutes,0)::int night_minutes,COALESCE(f.ifr_minutes,0)::int ifr_minutes,COALESCE(f.pic_minutes,0)::int stored_pic_minutes,COALESCE(f.copilot_minutes,0)::int copilot_minutes,COALESCE(f.dual_minutes,0)::int dual_minutes,COALESCE(f.instructor_minutes,0)::int instructor_minutes,
        CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440) ELSE 0 END::int block_minutes,
        CASE WHEN f.takeoff~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.landing~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN MOD((split_part(f.landing,':',1)::int*60+split_part(f.landing,':',2)::int)-(split_part(f.takeoff,':',1)::int*60+split_part(f.takeoff,':',2)::int)+1440,1440) ELSE 0 END::int air_minutes,
        GREATEST(COALESCE(f.price_per_hour,0),0)::double precision hourly,UPPER(COALESCE(f.billing_basis,'BLOCK')) billing_basis,
        COALESCE(t.track_count,0)::int track_count,COALESCE(t.gps_km,0)::double precision gps_km
      FROM flights f LEFT JOIN track t ON t.flight_id=f.id WHERE f.user_id=${userId}
        AND (${start}::text IS NULL OR (f.date::text~'^\\d{4}-\\d{2}-\\d{2}$' AND f.date::text>=${start}::text))
        AND (${end}::text IS NULL OR (f.date::text~'^\\d{4}-\\d{2}-\\d{2}$' AND f.date::text<=${end}::text))
    ),base AS MATERIALIZED(
      SELECT *,role IN ('SAFETY PILOT','PAX','OBSERVER') auxiliary,role NOT IN ('PAX','OBSERVER') dashboard_total,
        CASE WHEN stored_pic_minutes>0 THEN stored_pic_minutes WHEN role IN ('PIC','SOLO','SPIC','PICUS','INSTRUCTOR','EXAMINER') THEN block_minutes ELSE 0 END::int pic_minutes,
        hourly*(CASE WHEN billing_basis LIKE 'AIR%' THEN air_minutes ELSE block_minutes END)/60.0/(CASE WHEN split_part(billing_basis,'/',2)~'^[1-9][0-9]*$' AND split_part(billing_basis,'/',2)::int<=20 THEN split_part(billing_basis,'/',2)::numeric ELSE 1 END)::double precision cost
      FROM base0
    ),summary AS(
      SELECT
        COUNT(*) FILTER(WHERE dashboard_total)::int total_flights,COALESCE(SUM(block_minutes) FILTER(WHERE dashboard_total),0)::int total_minutes,COALESCE(SUM(landings) FILTER(WHERE dashboard_total AND NOT auxiliary),0)::int total_landings,
        COUNT(*) FILTER(WHERE evidence='ULL' AND NOT auxiliary)::int ull_flights,COALESCE(SUM(block_minutes) FILTER(WHERE evidence='ULL' AND NOT auxiliary),0)::int ull_minutes,COALESCE(SUM(landings) FILTER(WHERE evidence='ULL' AND NOT auxiliary),0)::int ull_landings,
        COUNT(*) FILTER(WHERE evidence='EASA' AND NOT auxiliary)::int easa_flights,COALESCE(SUM(block_minutes) FILTER(WHERE evidence='EASA' AND NOT auxiliary),0)::int easa_minutes,COALESCE(SUM(landings) FILTER(WHERE evidence='EASA' AND NOT auxiliary),0)::int easa_landings,
        COUNT(*) FILTER(WHERE evidence='ULL' AND NOT auxiliary AND pic_minutes>0)::int pic_ull_flights,COALESCE(SUM(pic_minutes) FILTER(WHERE evidence='ULL' AND NOT auxiliary AND pic_minutes>0),0)::int pic_ull_minutes,COALESCE(SUM(landings) FILTER(WHERE evidence='ULL' AND NOT auxiliary AND pic_minutes>0),0)::int pic_ull_landings,
        COUNT(*) FILTER(WHERE evidence='EASA' AND NOT auxiliary AND pic_minutes>0)::int pic_easa_flights,COALESCE(SUM(pic_minutes) FILTER(WHERE evidence='EASA' AND NOT auxiliary AND pic_minutes>0),0)::int pic_easa_minutes,COALESCE(SUM(landings) FILTER(WHERE evidence='EASA' AND NOT auxiliary AND pic_minutes>0),0)::int pic_easa_landings,
        COALESCE(SUM(air_minutes) FILTER(WHERE NOT auxiliary),0)::int air_minutes,COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary),0)::int pic_minutes,COALESCE(SUM(copilot_minutes) FILTER(WHERE NOT auxiliary),0)::int copilot_minutes,COALESCE(SUM(dual_minutes) FILTER(WHERE NOT auxiliary),0)::int dual_minutes,COALESCE(SUM(instructor_minutes) FILTER(WHERE NOT auxiliary),0)::int instructor_minutes,
        COALESCE(SUM(night_minutes) FILTER(WHERE NOT auxiliary),0)::int night_minutes,COALESCE(SUM(ifr_minutes) FILTER(WHERE NOT auxiliary),0)::int ifr_minutes,COALESCE(SUM(day_landings) FILTER(WHERE NOT auxiliary),0)::int day_landings,COALESCE(SUM(night_landings) FILTER(WHERE NOT auxiliary),0)::int night_landings,
        COALESCE(SUM(block_minutes) FILTER(WHERE role='SAFETY PILOT'),0)::int safety_minutes,COALESCE(SUM(cost),0)::double precision cost,COALESCE(SUM(track_count),0)::int tracks,COALESCE(SUM(gps_km),0)::double precision gps_km,
        COUNT(DISTINCT NULLIF(registration,''))::int unique_aircraft,COUNT(*) FILTER(WHERE dashboard_total AND date_key IS NOT NULL)::int chart_flights,COUNT(*) FILTER(WHERE dashboard_total AND date_key IS NULL)::int invalid_date_flights
      FROM base
    )
    SELECT COALESCE((SELECT display_name FROM users WHERE id=${userId}),'Pilot') display_name,summary.*,
      (SELECT COUNT(DISTINCT airport)::int FROM(SELECT NULLIF(departure,'') airport FROM base WHERE dashboard_total UNION SELECT NULLIF(arrival,'') FROM base WHERE dashboard_total)x WHERE airport IS NOT NULL) unique_airports,
      (SELECT COUNT(*)::int FROM(SELECT departure,arrival FROM base WHERE dashboard_total AND departure<>'' AND arrival<>'' GROUP BY departure,arrival)x) unique_routes,
      COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.date_key DESC NULLS LAST,x.off_block DESC,x.id DESC) FROM(SELECT id,date,date_key,off_block,registration,departure,arrival FROM base ORDER BY date_key DESC NULLS LAST,off_block DESC,id DESC LIMIT 8)x),'[]'::jsonb) recent,
      COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month_key) FROM(SELECT LEFT(date_key,7) AS month_key,COALESCE(SUM(block_minutes) FILTER(WHERE dashboard_total),0)::int total,COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='ULL'),0)::int ull,COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND evidence='EASA'),0)::int easa,COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND evidence='ULL' AND pic_minutes>0),0)::int pic_ull,COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND evidence='EASA' AND pic_minutes>0),0)::int pic_easa,COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int landings FROM base WHERE dashboard_total AND date_key IS NOT NULL GROUP BY LEFT(date_key,7))m),'[]'::jsonb) monthly,
      COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.minutes DESC,a.registration) FROM(SELECT registration,COUNT(*) FILTER(WHERE NOT auxiliary)::int flights,COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary),0)::int minutes,COALESCE(SUM(cost),0)::double precision cost,COALESCE(MAX(date_key),'') last_date FROM base WHERE registration<>'' GROUP BY registration)a),'[]'::jsonb) top_aircraft,
      COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.flights DESC,r.minutes DESC,r.last_date DESC,r.departure,r.arrival) FROM(SELECT departure||'→'||arrival route,departure,arrival,COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes,COALESCE(MIN(date_key),'') first_date,COALESCE(MAX(date_key),'') last_date FROM base WHERE dashboard_total AND departure<>'' AND arrival<>'' GROUP BY departure,arrival ORDER BY COUNT(*) DESC,SUM(block_minutes) DESC,MAX(date_key) DESC NULLS LAST LIMIT 50)r),'[]'::jsonb) top_routes,
      COALESCE((SELECT jsonb_agg(to_jsonb(ap) ORDER BY ap.visits DESC,ap.last_date DESC,ap.airport) FROM(SELECT airport,COUNT(*)::int visits,COALESCE(SUM(dep),0)::int departures,COALESCE(SUM(arr),0)::int arrivals,COALESCE(MIN(date_key),'') first_date,COALESCE(MAX(date_key),'') last_date FROM(SELECT date_key,departure airport,1 dep,CASE WHEN arrival=departure AND arrival<>'' THEN 1 ELSE 0 END arr FROM base WHERE dashboard_total AND departure<>'' UNION ALL SELECT date_key,arrival airport,0 dep,1 arr FROM base WHERE dashboard_total AND arrival<>'' AND arrival<>departure)e GROUP BY airport ORDER BY COUNT(*) DESC,MAX(date_key) DESC NULLS LAST,airport LIMIT 100)ap),'[]'::jsonb) top_airports,
      COALESCE((SELECT jsonb_agg(to_jsonb(y) ORDER BY y.year_key DESC) FROM(SELECT LEFT(date_key,4)::int AS year_key,COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes,COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int landings FROM base WHERE dashboard_total AND date_key IS NOT NULL GROUP BY LEFT(date_key,4))y),'[]'::jsonb) yearly
    FROM summary`,650) as Array<Record<string,unknown>>;
  const row=rows[0]??{},recent=jsonObjects(row.recent).map(item=>({id:n(item.id),date:s(item.date),registration:s(item.registration),departure:s(item.departure),arrival:s(item.arrival)}));
  return{
    displayName:s(row.display_name)||"Pilot",rangeLabel:label,total:metric(row,"total"),ull:metric(row,"ull"),easa:metric(row,"easa"),picUll:metric(row,"pic_ull"),picEasa:metric(row,"pic_easa"),
    airMinutes:n(row.air_minutes),picMinutes:n(row.pic_minutes),copilotMinutes:n(row.copilot_minutes),dualMinutes:n(row.dual_minutes),instructorMinutes:n(row.instructor_minutes),nightMinutes:n(row.night_minutes),ifrMinutes:n(row.ifr_minutes),dayLandings:n(row.day_landings),nightLandings:n(row.night_landings),safetyMinutes:n(row.safety_minutes),cost:n(row.cost),tracks:n(row.tracks),gpsKm:n(row.gps_km),
    uniqueAircraft:n(row.unique_aircraft),uniqueAirports:n(row.unique_airports),uniqueRoutes:n(row.unique_routes),chartFlights:n(row.chart_flights),invalidDateFlights:n(row.invalid_date_flights),lastFlight:recent[0]??null,recentFlights:recent,
    monthly:jsonObjects(row.monthly).map(item=>({month:s(item.month_key),total:n(item.total),ull:n(item.ull),easa:n(item.easa),picUll:n(item.pic_ull),picEasa:n(item.pic_easa),landings:n(item.landings)})),
    topAircraft:jsonObjects(row.top_aircraft).map(item=>({registration:s(item.registration),flights:n(item.flights),minutes:n(item.minutes),cost:n(item.cost),lastDate:s(item.last_date)})),
    topRoutes:jsonObjects(row.top_routes).map(item=>({route:s(item.route),departure:s(item.departure),arrival:s(item.arrival),flights:n(item.flights),minutes:n(item.minutes),firstDate:s(item.first_date),lastDate:s(item.last_date)})),
    topAirports:jsonObjects(row.top_airports).map(item=>({airport:s(item.airport),visits:n(item.visits),departures:n(item.departures),arrivals:n(item.arrivals),firstDate:s(item.first_date),lastDate:s(item.last_date)})),
    yearly:jsonObjects(row.yearly).map(item=>({year:n(item.year_key),flights:n(item.flights),minutes:n(item.minutes),landings:n(item.landings)})),
  };
}

export function formatDuration(minutes:number){const value=Math.max(0,Math.round(minutes));return`${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`}
