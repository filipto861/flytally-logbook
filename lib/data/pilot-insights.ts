import "server-only";
import { sql } from "@/lib/db";
import { getDashboardData,type DashboardData } from "@/lib/data/dashboard";
import { measureServerTask } from "@/lib/performance";
import { pilotInsightBounds,rollingYearBounds } from "@/lib/pilot-insights";

export type PilotInsightMonthlyPoint={month:string;flights:number;minutes:number;picMinutes:number;nightMinutes:number;ifrMinutes:number;landings:number};
export type PilotRoleBreakdown={role:string;flights:number;minutes:number};
export type PilotAircraftTypeBreakdown={aircraftType:string;registrations:number;flights:number;minutes:number;picMinutes:number;lastDate:string};
export type PilotAircraftClassBreakdown={aircraftClass:string;flights:number;minutes:number;picMinutes:number;lastDate:string};
export type RollingYearSummary={flights:number;minutes:number;picMinutes:number;landings:number;activeMonths:number};
export type PilotCareerSummary={firstDate:string;lastDate:string;flights:number;minutes:number;activeYears:number};
export type PilotInsightsData={
  dashboard:DashboardData;
  rangeLabel:string;
  monthly:PilotInsightMonthlyPoint[];
  roles:PilotRoleBreakdown[];
  aircraftTypes:PilotAircraftTypeBreakdown[];
  aircraftClasses:PilotAircraftClassBreakdown[];
  current12m:RollingYearSummary;
  previous12m:RollingYearSummary;
  career:PilotCareerSummary;
};

const n=(value:unknown)=>Number(value??0)||0;
const s=(value:unknown)=>String(value??"").trim();
const jsonObjects=(value:unknown):Array<Record<string,unknown>>=>{if(Array.isArray(value))return value as Array<Record<string,unknown>>;if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{}return[]};

export async function getPilotInsightsData(userId:number,requested:string):Promise<PilotInsightsData>{
  const bounds=pilotInsightBounds(requested),rolling=rollingYearBounds();
  const [dashboard,rows]=await Promise.all([
    getDashboardData(userId,requested),
    measureServerTask("pilot-insights-data",()=>sql`
      WITH base0 AS MATERIALIZED(
        SELECT f.id,
          CASE WHEN f.date::text~'^\\d{4}-\\d{2}-\\d{2}$' THEN f.date::text ELSE NULL END date_key,
          CASE WHEN UPPER(TRIM(COALESCE(f.role,'')))='INSTRUKTOR' THEN 'INSTRUCTOR'
               WHEN UPPER(TRIM(COALESCE(f.role,'')))='STUDENT' OR (TRIM(COALESCE(f.role,''))='' AND TRIM(COALESCE(f.instructor,''))<>'') THEN 'DUAL'
               ELSE UPPER(TRIM(COALESCE(f.role,''))) END role,
          UPPER(TRIM(COALESCE(f.registration,''))) registration,
          TRIM(COALESCE(f.aircraft_type,'')) aircraft_type,
          UPPER(TRIM(COALESCE(f.aircraft_class,''))) aircraft_class,
          GREATEST(COALESCE(f.starts,0),0)::int landings,
          GREATEST(COALESCE(f.night_minutes,0),0)::int night_minutes,
          GREATEST(COALESCE(f.ifr_minutes,0),0)::int ifr_minutes,
          GREATEST(COALESCE(f.pic_minutes,0),0)::int stored_pic_minutes,
          CASE WHEN f.off_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$' AND f.on_block~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
               THEN MOD((split_part(f.on_block,':',1)::int*60+split_part(f.on_block,':',2)::int)-(split_part(f.off_block,':',1)::int*60+split_part(f.off_block,':',2)::int)+1440,1440)
               ELSE 0 END::int block_minutes
        FROM flights f WHERE f.user_id=${userId}
      ),base AS MATERIALIZED(
        SELECT *,role IN ('SAFETY PILOT','PAX','OBSERVER') auxiliary,
          CASE WHEN stored_pic_minutes>0 THEN stored_pic_minutes
               WHEN role IN ('PIC','SOLO','SPIC','PICUS','INSTRUCTOR','EXAMINER') THEN block_minutes ELSE 0 END::int pic_minutes
        FROM base0
      ),selected AS MATERIALIZED(
        SELECT * FROM base
        WHERE (${bounds.start}::text IS NULL OR date_key>=${bounds.start}::text)
          AND (${bounds.end}::text IS NULL OR date_key<=${bounds.end}::text)
      ),career AS(
        SELECT COALESCE(MIN(date_key),'') first_date,COALESCE(MAX(date_key),'') last_date,
          COUNT(*) FILTER(WHERE NOT auxiliary)::int flights,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary),0)::int minutes,
          COUNT(DISTINCT LEFT(date_key,4)) FILTER(WHERE NOT auxiliary AND date_key IS NOT NULL)::int active_years
        FROM base
      ),rolling_summary AS(
        SELECT
          COUNT(*) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd})::int current_flights,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_minutes,
          COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_pic_minutes,
          COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd}),0)::int current_landings,
          COUNT(DISTINCT LEFT(date_key,7)) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.currentStart} AND ${rolling.currentEnd})::int current_active_months,
          COUNT(*) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd})::int previous_flights,
          COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_minutes,
          COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_pic_minutes,
          COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd}),0)::int previous_landings,
          COUNT(DISTINCT LEFT(date_key,7)) FILTER(WHERE NOT auxiliary AND date_key BETWEEN ${rolling.previousStart} AND ${rolling.previousEnd})::int previous_active_months
        FROM base
      )
      SELECT career.*,rolling_summary.*,
        COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month_key) FROM(
          SELECT LEFT(date_key,7) month_key,
            COUNT(*) FILTER(WHERE NOT auxiliary)::int flights,
            COALESCE(SUM(block_minutes) FILTER(WHERE NOT auxiliary),0)::int minutes,
            COALESCE(SUM(pic_minutes) FILTER(WHERE NOT auxiliary),0)::int pic_minutes,
            COALESCE(SUM(night_minutes) FILTER(WHERE NOT auxiliary),0)::int night_minutes,
            COALESCE(SUM(ifr_minutes) FILTER(WHERE NOT auxiliary),0)::int ifr_minutes,
            COALESCE(SUM(landings) FILTER(WHERE NOT auxiliary),0)::int landings
          FROM selected WHERE date_key IS NOT NULL GROUP BY LEFT(date_key,7)
        )m),'[]'::jsonb) monthly,
        COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.minutes DESC,r.flights DESC,r.role) FROM(
          SELECT COALESCE(NULLIF(role,''),'UNSPECIFIED') role,COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(role,''),'UNSPECIFIED')
        )r),'[]'::jsonb) roles,
        COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.minutes DESC,t.flights DESC,t.aircraft_type) FROM(
          SELECT COALESCE(NULLIF(aircraft_type,''),'Unknown') aircraft_type,COUNT(DISTINCT NULLIF(registration,''))::int registrations,
            COUNT(*)::int flights,COALESCE(SUM(block_minutes),0)::int minutes,COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(aircraft_type,''),'Unknown')
        )t),'[]'::jsonb) aircraft_types,
        COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.minutes DESC,c.flights DESC,c.aircraft_class) FROM(
          SELECT COALESCE(NULLIF(aircraft_class,''),'Unspecified') aircraft_class,COUNT(*)::int flights,
            COALESCE(SUM(block_minutes),0)::int minutes,COALESCE(SUM(pic_minutes),0)::int pic_minutes,COALESCE(MAX(date_key),'') last_date
          FROM selected WHERE NOT auxiliary GROUP BY COALESCE(NULLIF(aircraft_class,''),'Unspecified')
        )c),'[]'::jsonb) aircraft_classes
      FROM career CROSS JOIN rolling_summary
    `,650) as Promise<Array<Record<string,unknown>>>,
  ]);
  const row=rows[0]??{};
  return{
    dashboard,
    rangeLabel:bounds.label,
    monthly:jsonObjects(row.monthly).map(item=>({month:s(item.month_key),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),nightMinutes:n(item.night_minutes),ifrMinutes:n(item.ifr_minutes),landings:n(item.landings)})),
    roles:jsonObjects(row.roles).map(item=>({role:s(item.role),flights:n(item.flights),minutes:n(item.minutes)})),
    aircraftTypes:jsonObjects(row.aircraft_types).map(item=>({aircraftType:s(item.aircraft_type),registrations:n(item.registrations),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),lastDate:s(item.last_date)})),
    aircraftClasses:jsonObjects(row.aircraft_classes).map(item=>({aircraftClass:s(item.aircraft_class),flights:n(item.flights),minutes:n(item.minutes),picMinutes:n(item.pic_minutes),lastDate:s(item.last_date)})),
    current12m:{flights:n(row.current_flights),minutes:n(row.current_minutes),picMinutes:n(row.current_pic_minutes),landings:n(row.current_landings),activeMonths:n(row.current_active_months)},
    previous12m:{flights:n(row.previous_flights),minutes:n(row.previous_minutes),picMinutes:n(row.previous_pic_minutes),landings:n(row.previous_landings),activeMonths:n(row.previous_active_months)},
    career:{firstDate:s(row.first_date),lastDate:s(row.last_date),flights:n(row.flights),minutes:n(row.minutes),activeYears:n(row.active_years)},
  };
}
